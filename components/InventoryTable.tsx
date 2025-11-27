import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Product, Supplier } from '../types';
import { AlertTriangle, CheckCircle, Edit2, Save, X, BellRing, FileSpreadsheet, MinusCircle, Search, Trash2, Download } from 'lucide-react';
import { InventoryService } from '../services/inventoryService';

interface InventoryTableProps {
  products: Product[];
  onDataChange: () => void;
  currency: 'USD' | 'Bs';
  exchangeRate: number;
}

export const InventoryTable: React.FC<InventoryTableProps> = ({ products, onDataChange, currency, exchangeRate }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // EditValues store raw input. We handle conversion on Save.
  // minStock is number, price is number.
  const [editValues, setEditValues] = useState<{minStock: number, price: number}>({minStock: 0, price: 0});
  
  // States for Quick Stock Out
  const [stockOutValues, setStockOutValues] = useState<{[key: string]: string}>({});
  
  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Fetch suppliers to allow filtering by supplier name
    const loadSuppliers = async () => {
        const data = await InventoryService.getSuppliers();
        setSuppliers(data);
    };
    loadSuppliers();
  }, []);

  const sortedProducts = useMemo(() => {
    // 1. Filter
    const term = searchTerm.toLowerCase();
    const filtered = products.filter(p => {
        const matchesName = p.name.toLowerCase().includes(term);
        // Find supplier name if product has supplierId
        const supplier = p.supplierId ? suppliers.find(s => s.id === p.supplierId) : null;
        const matchesSupplier = supplier ? supplier.name.toLowerCase().includes(term) : false;
        const matchesCategory = p.category ? p.category.toLowerCase().includes(term) : false;

        return matchesName || matchesSupplier || matchesCategory;
    });

    // 2. Sort (Low stock first)
    return filtered.sort((a, b) => {
        const aLow = a.quantity <= a.minStock ? 1 : 0;
        const bLow = b.quantity <= b.minStock ? 1 : 0;
        return bLow - aLow; 
    });
  }, [products, searchTerm, suppliers]);

  const handleEditClick = (product: Product) => {
    setEditingId(product.id);
    // Initialize with current display values
    // If currency is Bs, we want the input to show Bs.
    const displayPrice = currency === 'Bs' ? product.price * exchangeRate : product.price;
    setEditValues({ minStock: product.minStock, price: displayPrice });
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const handleSave = async (id: string) => {
    if (editValues) {
      // Logic: The DB stores USD.
      // If we are editing in Bs, we must convert back to USD before saving.
      const priceToSave = currency === 'Bs' ? editValues.price / exchangeRate : editValues.price;

      await InventoryService.updateProductDetails(id, {
          minStock: editValues.minStock,
          price: priceToSave
      });
      onDataChange();
      setEditingId(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        const text = event.target?.result as string;
        await InventoryService.importFromCSV(text);
        onDataChange();
        alert('Stock importado exitosamente desde el archivo.');
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExportCSV = () => {
    // Define headers
    const headers = ['ID', 'Producto', 'Categoria', 'Proveedor', 'Precio Base (USD)', 'Stock Actual', 'Stock Minimo', 'Ultima Actualizacion'];
    
    // Map products to rows
    const rows = products.map(product => {
        const supplierName = suppliers.find(s => s.id === product.supplierId)?.name || 'N/A';
        // Escape quotes and commas in strings to prevent CSV breakage
        const safeName = `"${product.name.replace(/"/g, '""')}"`;
        const safeSupplier = `"${supplierName.replace(/"/g, '""')}"`;
        const safeCategory = `"${(product.category || 'General').replace(/"/g, '""')}"`;
        
        return [
            product.id,
            safeName,
            safeCategory,
            safeSupplier,
            product.price.toFixed(2),
            product.quantity,
            product.minStock,
            product.lastUpdated
        ].join(',');
    });

    // Combine headers and rows
    const csvContent = [headers.join(','), ...rows].join('\n');

    // Create blob and link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bbc_inventario_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleStockOutChange = (id: string, val: string) => {
      setStockOutValues(prev => ({...prev, [id]: val}));
  };

  const handleExecuteStockOut = async (id: string) => {
      const amount = parseInt(stockOutValues[id]);
      if (amount && amount > 0) {
          await InventoryService.registerStockOut(id, amount);
          onDataChange();
          // Clear input
          setStockOutValues(prev => ({...prev, [id]: ''}));
      }
  };

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm gap-4">
         <div>
            <h3 className="font-bold text-slate-700">Listado de Productos</h3>
            <p className="text-xs text-slate-400">{products.length} items registrados</p>
         </div>
         
         <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Buscar por nombre, categoría o proveedor..." 
                    className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 w-full md:w-80"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <button 
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap"
                title="Descargar inventario completo en CSV"
            >
                <Download size={18} />
                <span>Exportar CSV</span>
            </button>

            <input 
                type="file" 
                accept=".csv" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileUpload} 
            />
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium whitespace-nowrap"
                title="Importar CSV exportado de Google Sheets"
            >
                <FileSpreadsheet size={18} />
                <span>Importar CSV</span>
            </button>
         </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                <th className="px-6 py-4">Producto / Categoría</th>
                <th className="px-6 py-4 text-right">Precio ({currency})</th>
                <th className="px-6 py-4 text-center">Stock</th>
                <th className="px-6 py-4 text-center bg-red-50/50 border-l border-slate-100">Salida Diaria</th>
                <th className="px-6 py-4 text-center">Estado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {sortedProducts.map((product) => {
                const isEditing = editingId === product.id;
                const isLowStock = product.quantity <= product.minStock;
                const stockOutVal = stockOutValues[product.id] || '';

                // Calculate display price (Product stores USD)
                const displayPrice = currency === 'Bs' ? product.price * exchangeRate : product.price;

                return (
                    <tr key={product.id} className={`hover:bg-slate-50 transition-colors ${isEditing ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-6 py-4 font-medium text-slate-900">
                        <div className="flex flex-col">
                            <span className="text-base">{product.name}</span>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {product.category || 'General'}
                                </span>
                                {product.supplierId && (
                                    <span className="text-xs text-slate-400 font-normal">
                                        • {suppliers.find(s => s.id === product.supplierId)?.name || 'Proveedor N/A'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </td>
                    
                    {/* Precio Editable */}
                    <td className="px-6 py-4 text-right text-slate-700 font-mono">
                        {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                            <input 
                                type="number" 
                                value={editValues.price}
                                onChange={(e) => setEditValues({...editValues, price: parseFloat(e.target.value)})}
                                className="w-24 text-right border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500 font-bold"
                                step="0.01"
                            />
                        </div>
                        ) : (
                            <span>{displayPrice.toFixed(2)}</span>
                        )}
                    </td>

                    <td className="px-6 py-4 text-center font-semibold text-lg">
                        {product.quantity}
                    </td>

                    {/* Quick Stock Out Column */}
                    <td className="px-6 py-4 text-center bg-red-50/30 border-l border-slate-100">
                        <div className="flex items-center justify-center gap-2">
                            <input 
                                type="number" 
                                placeholder="0"
                                className="w-16 border border-slate-300 rounded-lg px-2 py-1 text-center focus:outline-none focus:border-red-400 text-slate-700"
                                value={stockOutVal}
                                onChange={(e) => handleStockOutChange(product.id, e.target.value)}
                            />
                            <button 
                                onClick={() => handleExecuteStockOut(product.id)}
                                disabled={!stockOutVal || parseInt(stockOutVal) <= 0}
                                className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                title="Registrar Salida"
                            >
                                <MinusCircle size={16} />
                            </button>
                        </div>
                    </td>
                    
                    {/* Estado */}
                    <td className="px-6 py-4">
                        <div className="flex flex-col items-center gap-1">
                            <div className={`flex items-center justify-center gap-2 px-3 py-1 rounded-full text-xs font-semibold w-fit mx-auto ${isLowStock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {isLowStock ? (
                                    <>
                                    <AlertTriangle size={14} />
                                    <span>Bajo</span>
                                    </>
                                ) : (
                                    <>
                                    <CheckCircle size={14} />
                                    <span>OK</span>
                                    </>
                                )}
                            </div>
                            
                            {/* Min Stock Indicator/Edit */}
                            {isEditing ? (
                                <div className="flex items-center justify-center gap-1 mt-1">
                                    <BellRing size={12} className="text-slate-400"/>
                                    <input 
                                        type="number" 
                                        value={editValues.minStock}
                                        onChange={(e) => setEditValues({...editValues, minStock: parseInt(e.target.value)})}
                                        className="w-14 text-center border border-slate-300 rounded px-1 py-0.5 text-xs font-bold"
                                    />
                                </div>
                            ) : (
                                <div className="text-xs text-slate-400">Mín: {product.minStock}</div>
                            )}
                        </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                        {isEditing ? (
                        <div className="flex justify-end gap-2">
                            <button onClick={() => handleSave(product.id)} className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200">
                            <Save size={16} />
                            </button>
                            <button onClick={handleCancel} className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200">
                            <X size={16} />
                            </button>
                        </div>
                        ) : (
                        <button 
                            onClick={() => handleEditClick(product)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Editar alertas y precio"
                        >
                            <Edit2 size={16} />
                        </button>
                        )}
                    </td>
                    </tr>
                );
                })}
                {products.length === 0 && (
                <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                        {searchTerm ? 'No se encontraron productos con ese criterio.' : 'No hay productos en el inventario.'}
                    </td>
                </tr>
                )}
            </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};