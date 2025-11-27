import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Box, ScanLine, AlertTriangle, PackageOpen, DollarSign, TrendingUp, X, Building2, RefreshCw, LogOut, User as UserIcon, Loader2, DatabaseZap } from 'lucide-react';
import { InventoryService } from './services/inventoryService';
import { ExchangeRateService, ExchangeRates } from './services/exchangeRateService';
import { EmailService } from './services/emailService';
import { Product, AppView, User } from './types';
import { StatsCard } from './components/StatsCard';
import { InventoryTable } from './components/InventoryTable';
import { Scanner } from './components/Scanner';
import { SupplierPanel } from './components/SupplierPanel';
import { LoginPanel } from './components/LoginPanel';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { supabase } from './services/supabaseClient';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [inventory, setInventory] = useState<Product[]>([]);
  const [stats, setStats] = useState({ totalItems: 0, totalValue: 0, lowStockCount: 0 });
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'warning' | 'error'} | null>(null);
  const [currency, setCurrency] = useState<'USD' | 'Bs'>('Bs');
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);

  // Auth Listener Supabase
  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
            firstName: session.user.user_metadata.first_name || 'Usuario',
            lastName: session.user.user_metadata.last_name || '',
            email: session.user.email || ''
        });
      }
      setIsLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
            firstName: session.user.user_metadata.first_name || 'Usuario',
            lastName: session.user.user_metadata.last_name || '',
            email: session.user.email || ''
        });
      } else {
        setUser(null);
      }
      setIsLoadingAuth(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load data when user is present
  useEffect(() => {
    if (user) {
      refreshData();
      fetchRates();
    }
  }, [user]);

  const handleLogin = (userData: User) => {
    // Handled by onAuthStateChange
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Handled by onAuthStateChange
  };

  const refreshData = async () => {
    try {
      setDbError(null);
      const data = await InventoryService.getAll();
      setInventory(data);
      const calculatedStats = await InventoryService.getStats();
      setStats(calculatedStats);
      return data;
    } catch (err: any) {
      console.error("Failed to load inventory:", err);
      setDbError(err.message || "Error conectando a la base de datos.");
      showNotification("Error de conexión con Supabase", "error");
      return [];
    }
  };

  const fetchRates = async () => {
    const rates = await ExchangeRateService.getRates();
    if (rates) {
      setExchangeRates(rates);
    }
  };

  const handleScanComplete = async () => {
    await refreshData();
    setCurrentView(AppView.INVENTORY);
    showNotification("Inventario y Proveedor actualizados correctamente en la nube.", "success");
  };

  const handleManualUpdate = async () => {
    const updatedData = await refreshData();
    
    // Check for low stock notification
    if (updatedData.length > 0 && user?.email) {
       const lowStockItems = updatedData.filter(p => p.quantity <= p.minStock);
       if (lowStockItems.length > 0) {
           const sent = await EmailService.sendLowStockAlert(user.email, lowStockItems);
           if (sent) {
               showNotification(`Inventario actualizado. Alerta de stock enviada a ${user.email}`, 'warning');
               return; // Skip the default success message
           }
       }
    }

    showNotification("Inventario actualizado.", "success");
  };

  const showNotification = (msg: string, type: 'success' | 'warning' | 'error') => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const currentRate = exchangeRates?.bcv || 1;

  const formatMoney = (amountUSD: number) => {
    if (currency === 'USD') {
      return `$${amountUSD.toFixed(2)}`;
    } else {
      const amountBs = amountUSD * currentRate;
      return `Bs ${amountBs.toFixed(2)}`;
    }
  };

  const NavItem = ({ view, icon: Icon, label }: { view: AppView, icon: any, label: string }) => (
    <button 
      onClick={() => setCurrentView(view)}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left font-medium ${currentView === view ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );

  if (isLoadingAuth) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
              <div className="flex flex-col items-center gap-4">
                <Loader2 size={48} className="text-blue-600 animate-spin" />
                <p className="text-slate-500 font-medium">Conectando con Supabase...</p>
              </div>
          </div>
      );
  }

  if (!user) {
    return <LoginPanel onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f8fafc]">
      
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 p-6 flex flex-col gap-8 sticky top-0 md:h-screen z-10">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-blue-300 shadow-md">
            <PackageOpen size={24} />
          </div>
          <h1 className="text-xl font-bold text-slate-800 leading-tight">BBC<br/><span className="text-blue-600">Inventario</span></h1>
        </div>

        <nav className="space-y-2 flex-1">
          <NavItem view={AppView.DASHBOARD} icon={LayoutDashboard} label="Panel Principal" />
          <NavItem view={AppView.INVENTORY} icon={Box} label="Inventario" />
          <NavItem view={AppView.SUPPLIERS} icon={Building2} label="Proveedores" />
          <NavItem view={AppView.SCANNER} icon={ScanLine} label="Cargar Factura" />
        </nav>

        {/* User Profile & Logout */}
        <div className="space-y-4">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                {user.firstName.charAt(0)}{user.lastName.charAt(0)}
             </div>
             <div className="overflow-hidden">
                <div className="text-sm font-bold text-slate-700 truncate">{user.firstName}</div>
                <div className="text-xs text-slate-400 truncate">Online</div>
             </div>
          </div>
          
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-slate-400 hover:text-red-500 px-2 py-1 transition-colors text-sm w-full"
          >
            <LogOut size={16} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto relative">
        
        {/* Toast Notification */}
        {notification && (
          <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce-in ${notification.type === 'success' ? 'bg-green-600' : notification.type === 'warning' ? 'bg-amber-500' : 'bg-red-600'} text-white`}>
            {notification.type === 'success' ? <PackageOpen size={20}/> : <AlertTriangle size={20}/>}
            <span className="font-medium">{notification.message}</span>
            <button onClick={() => setNotification(null)} className="ml-2 opacity-80 hover:opacity-100"><X size={16}/></button>
          </div>
        )}

        {/* DB Error State */}
        {dbError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6 flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
                <div className="p-3 bg-red-100 text-red-600 rounded-full">
                    <DatabaseZap size={24} />
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-red-800">Error de Base de Datos</h3>
                    <p className="text-red-600">{dbError}</p>
                    <p className="text-sm text-red-500 mt-1">Asegúrate de haber ejecutado el script SQL en Supabase.</p>
                </div>
                <button 
                    onClick={refreshData}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 font-semibold shadow-sm"
                >
                    <RefreshCw size={16} />
                    Reintentar
                </button>
            </div>
        )}

        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              {currentView === AppView.DASHBOARD && 'Resumen General'}
              {currentView === AppView.INVENTORY && 'Gestión de Inventario'}
              {currentView === AppView.SUPPLIERS && 'Directorio de Proveedores'}
              {currentView === AppView.SCANNER && 'Cargar Factura'}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Datos sincronizados en tiempo real.
            </p>
          </div>
          
          <div className="flex flex-col md:flex-row items-end md:items-center gap-3">
             {/* Exchange Rates Widget */}
             {exchangeRates && (
               <div className="flex items-center gap-3 bg-white px-4 py-1.5 rounded-lg border border-slate-200 shadow-sm text-xs md:text-sm">
                  <div className="flex flex-col md:flex-row gap-x-3">
                    <span className="font-semibold text-slate-600">
                      BCV: <span className="text-slate-900">Bs {exchangeRates.bcv.toFixed(2)}</span>
                    </span>
                    <span className="hidden md:inline text-slate-300">|</span>
                    <span className="font-semibold text-slate-600">
                      Paralelo: <span className="text-slate-900">Bs {exchangeRates.parallel.toFixed(2)}</span>
                    </span>
                  </div>
                  <button onClick={fetchRates} title="Actualizar Tasas" className="p-1 hover:bg-slate-100 rounded-full text-slate-400">
                    <RefreshCw size={12} />
                  </button>
               </div>
             )}

             {/* Currency Toggle */}
             <div className="flex bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
                <button 
                  onClick={() => setCurrency('Bs')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${currency === 'Bs' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  Bs
                </button>
                <button 
                  onClick={() => setCurrency('USD')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${currency === 'USD' ? 'bg-green-100 text-green-700' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  $ USD
                </button>
             </div>

             {currentView !== AppView.SCANNER && (
                <button 
                  onClick={() => setCurrentView(AppView.SCANNER)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg shadow-md transition-colors font-medium flex items-center gap-2"
                >
                  <ScanLine size={18} />
                  <span className="hidden sm:inline">Nueva Factura</span>
                </button>
             )}
          </div>
        </header>

        {/* Dashboard View */}
        {currentView === AppView.DASHBOARD && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatsCard 
                title="Valor Total Inventario" 
                value={formatMoney(stats.totalValue)} 
                icon={<DollarSign className="text-green-600" />} 
                color="green"
              />
              <StatsCard 
                title="Productos en Stock" 
                value={stats.totalItems} 
                icon={<Box className="text-blue-600" />} 
                color="blue"
              />
              <StatsCard 
                title="Alerta Stock Bajo" 
                value={stats.lowStockCount} 
                icon={<AlertTriangle className="text-red-600" />} 
                color="red"
                trend={stats.lowStockCount > 0 ? "Reponer Urgente" : "Óptimo"}
              />
            </div>

            {/* Charts & Lists Row */}
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Chart Section */}
              <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <TrendingUp size={20} className="text-blue-500" />
                  Niveles de Stock vs Alerta Mínima
                </h3>
                <div className="h-64">
                   <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={inventory.slice(0, 10)}>
                      <XAxis dataKey="name" tick={{fontSize: 10}} interval={0} height={40} tickFormatter={(val) => val.slice(0, 10) + '...'} />
                      <YAxis />
                      <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                      <Bar dataKey="quantity" name="Stock Actual" radius={[4, 4, 0, 0]}>
                        {inventory.slice(0,10).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.quantity <= entry.minStock ? '#ef4444' : '#3b82f6'} />
                        ))}
                      </Bar>
                      <Bar dataKey="minStock" name="Alerta Mínima" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                    </BarChart>
                   </ResponsiveContainer>
                </div>
              </div>

              {/* Quick Actions / Low Stock List */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                <h3 className="font-bold text-slate-800 mb-4 text-red-600 flex items-center gap-2">
                  <AlertTriangle size={20} />
                  Alertas de Reposición
                </h3>
                <div className="space-y-4 flex-1 overflow-y-auto max-h-64 pr-2">
                  {inventory.filter(i => i.quantity <= i.minStock).map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                      <div>
                        <div className="font-medium text-slate-800 text-sm">{item.name}</div>
                        <div className="text-xs text-red-600 font-semibold">Stock: {item.quantity} (Mín: {item.minStock})</div>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    </div>
                  ))}
                  {inventory.filter(i => i.quantity <= i.minStock).length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-2 text-green-500">
                        <Box size={20} />
                      </div>
                      Inventario Saludable
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Inventory View */}
        {currentView === AppView.INVENTORY && (
          <InventoryTable 
            products={inventory} 
            onDataChange={handleManualUpdate} 
            currency={currency}
            exchangeRate={currentRate}
          />
        )}

        {/* Suppliers View */}
        {currentView === AppView.SUPPLIERS && (
            <div className="space-y-6">
                <SupplierPanel />
            </div>
        )}

        {/* Scanner View */}
        {currentView === AppView.SCANNER && (
          <Scanner 
            onScanComplete={handleScanComplete} 
            existingProducts={inventory} 
            currency={currency} 
            exchangeRate={currentRate}
          />
        )}

      </main>
    </div>
  );
}

export default App;
