import React, { useState, useRef } from 'react';
import { Camera, X, Check, Loader2, AlertCircle, CheckCircle, ArrowRight, AlertTriangle, Building2, Calculator, Pencil, DollarSign, PieChart, Tag } from 'lucide-react';
import { fileToGenerativePart, parseInvoiceImage } from '../services/geminiService';
import { InvoiceData, Product } from '../types';
import { InventoryService } from '../services/inventoryService';

interface ScannerProps {
  onScanComplete: () => void;
  existingProducts: Product[];
  currency: 'USD' | 'Bs';
  exchangeRate: number;
}

export const Scanner: React.FC<ScannerProps> = ({ onScanComplete, existingProducts, currency, exchangeRate }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<InvoiceData | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        setError(null);
        const base64 = await fileToGenerativePart(file);
        setImagePreview(`data:${file.type};base64,${base64}`);
        
        setIsProcessing(true);
        // Apply aliases immediately
        const data = await parseInvoiceImage(base64);
        
        // Resolve aliases for existing supplier if found in text
        if (data.supplier?.name) {
           const suppliers = await InventoryService.getSuppliers();
           // Find if this raw supplier matches an existing one (simple check)
           const existingSup = suppliers.find(s => s.name.toLowerCase().includes(data.supplier!.name.toLowerCase()));
           if (existingSup) {
               data.supplier.name = existingSup.name;
               data.supplier.rif = existingSup.rif; // Use stored clean data
           }
           
           // Resolve Item Aliases (ASYNC AWAIT ADDED HERE)
           data.items = await InventoryService.resolveInvoiceAliases(data.items, data.supplier.name);
        }

        setScanResult(data);
      } catch (err: any) {
        setError(err.message || "Error al procesar la imagen");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleConfirm = async () => {
    if (scanResult) {
      // Pass currency and exchange rate. 
      // scanResult.currency is the currency DETECTED on the invoice (Bs or USD).
      
      const invoiceCurrency = (scanResult.currency as 'USD' | 'Bs') || 'Bs'; // Default fallback
      
      await InventoryService.updateStock(scanResult.items, scanResult.supplier, invoiceCurrency, exchangeRate);
      setScanResult(null);
      setImagePreview(null);
      onScanComplete();
    }
  };

  const handleCancel = () => {
    setScanResult(null);
    setImagePreview(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleQuantityChange = (index: number, newValue: string) => {
    if (!scanResult) return;
    
    const val = parseInt(newValue);
    if (isNaN(val) || val < 0) return;

    const newItems = [...scanResult.items];
    newItems[index] = { ...newItems[index], quantity: val };
    setScanResult({ ...scanResult, items: newItems });
  };
  
  const handleProductNameChange = (index: number, newName: string) => {
      if (!scanResult) return;
      const newItems = [...scanResult.items];
      newItems[index] = { ...newItems[index], productName: newName };
      setScanResult({ ...scanResult, items: newItems });
  };

  const handleCategoryChange = (index: number, newCat: string) => {
    if (!scanResult) return;
    const newItems = [...scanResult.items];
    newItems[index] = { ...newItems[index], category: newCat };
    setScanResult({ ...scanResult, items: newItems });
  };

  const handleSupplierChange = (field: 'name' | 'rif', value: string) => {
      if (!scanResult || !scanResult.supplier) return;
      setScanResult({
          ...scanResult,
          supplier: {
              ...scanResult.supplier,
              [field]: value
          }
      });
  };
  
  const handleInvoiceCurrencyChange = (newCurrency: string) => {
      if (!scanResult) return;
      setScanResult({ ...scanResult, currency: newCurrency });
  };

  // Helper to find matching existing product
  const getMatch = (itemName: string) => {
    return existingProducts.find(p => 
      p.name.toLowerCase().trim() === itemName.toLowerCase().trim() ||
      p.name.toLowerCase().includes(itemName.toLowerCase()) || 
      itemName.toLowerCase().includes(p.name.toLowerCase())
    );
  };
  
  // Calculate total estimate based on displayed currency
  const totalEstimate = scanResult?.items.reduce((acc, item) => acc + (item.originalQuantity || item.quantity) * item.price, 0) || 0;
  const activeCurrency = scanResult?.currency || 'Bs';

  // Calculate Breakdown by Category
  const categoryTotals = scanResult?.items.reduce((acc, item) => {
    const cat = item.category || 'Sin Categoría';
    const total = (item.originalQuantity || item.quantity) * item.price;
    acc[cat] = (acc[cat] || 0) + total;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Upload Area */}
      {!imagePreview && (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-3 border-dashed border-slate-300 rounded-3xl p-16 text-center hover:bg-slate-50 hover:border-blue-400 transition-all cursor-pointer group"
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={handleFileSelect}
          />
          <div className="w-24 h-24 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-all duration-300 shadow-sm ring-0 group-hover:ring-8 group-hover:ring-blue-100">
            <Camera size={48} />
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mb-3">Sube tu Factura o Ticket</h3>
          <p className="text-slate-500 max-w-md mx-auto">
            La IA detectará los productos, los <strong>desglosará por categoría</strong> y calculará el total en la moneda correcta.
          </p>
          <div className="mt-6 flex gap-3 justify-center text-sm text-slate-400">
             <span className="bg-slate-100 px-3 py-1 rounded-full">JPG, PNG</span>
             <span className="bg-slate-100 px-3 py-1 rounded-full">Tickets Térmicos</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isProcessing && (
        <div className="bg-white p-12 rounded-2xl shadow-lg border border-slate-100 text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
             <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
             <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Desglosando Mercancía...</h3>
          <p className="text-slate-500">Clasificando productos y verificando precios.</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 text-red-700 p-6 rounded-xl flex items-start gap-4 shadow-sm border border-red-100">
          <AlertCircle className="mt-1" />
          <div className="flex-1">
            <h4 className="font-bold mb-1">Hubo un problema</h4>
            <p>{error}</p>
          </div>
          <button onClick={handleCancel} className="bg-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm text-slate-700 hover:bg-slate-50">Intentar de nuevo</button>
        </div>
      )}

      {/* Review Screen */}
      {scanResult && !isProcessing && (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 flex flex-col h-[calc(100vh-200px)]">
          {/* Header with Actions */}
          <div className="p-6 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-4 justify-between items-center flex-shrink-0 z-10 sticky top-0">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Revisión y Desglose</h2>
              <p className="text-sm text-slate-500">Confirma las categorías y cantidades</p>
            </div>
            
            {/* Invoice Currency Selector */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm ${activeCurrency === 'Bs' ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
                <div className={`p-1 rounded-full ${activeCurrency === 'Bs' ? 'bg-blue-200 text-blue-700' : 'bg-green-200 text-green-700'}`}>
                    {activeCurrency === 'Bs' ? <span className="text-xs font-bold">Bs</span> : <DollarSign size={12}/>}
                </div>
                <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block leading-none mb-0.5">Moneda Detectada</span>
                    <select 
                        value={activeCurrency} 
                        onChange={(e) => handleInvoiceCurrencyChange(e.target.value)}
                        className="text-sm font-bold text-slate-800 bg-transparent outline-none cursor-pointer w-full"
                    >
                        <option value="Bs">Bolívares (Bs)</option>
                        <option value="USD">Dólares (USD)</option>
                    </select>
                </div>
            </div>

            <div className="flex gap-3">
              <button onClick={handleCancel} className="px-5 py-2.5 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors font-medium border border-transparent hover:border-slate-300">
                Cancelar
              </button>
              <button 
                  onClick={handleConfirm}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-lg shadow-md shadow-blue-200 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98]"
                >
                  <CheckCircle size={20} />
                  <span>Confirmar Ingreso</span>
                </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden grid lg:grid-cols-2">
            {/* Image Preview & Supplier Info & Breakdown */}
            <div className="bg-slate-900 overflow-auto flex flex-col items-center justify-start p-4 gap-4">
              
              {/* Supplier Card */}
              <div className="w-full bg-white/95 backdrop-blur rounded-xl p-4 shadow-lg text-slate-800 border border-slate-200">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                        <Building2 size={20} />
                    </div>
                    <div className="flex-1">
                        <div className="text-xs text-slate-500 font-bold uppercase mb-1">Proveedor (Editable)</div>
                        <input 
                            type="text" 
                            className="font-bold text-lg leading-tight w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:ring-2 focus:ring-purple-500 outline-none"
                            value={scanResult.supplier?.name || ''}
                            onChange={(e) => handleSupplierChange('name', e.target.value)}
                            placeholder="Nombre del Proveedor"
                        />
                    </div>
                </div>
                <div className="text-sm text-slate-500 pl-11 flex items-center gap-2">
                    <span className="whitespace-nowrap">RIF/ID:</span>
                    <input 
                        type="text"
                        className="font-mono bg-slate-100 px-2 py-0.5 rounded border border-transparent hover:border-slate-300 focus:border-purple-500 outline-none w-32"
                        value={scanResult.supplier?.rif || ''}
                        onChange={(e) => handleSupplierChange('rif', e.target.value)}
                    />
                </div>
              </div>

              {/* Breakdown Card (New Feature) */}
              <div className="w-full bg-white/95 backdrop-blur rounded-xl p-4 shadow-lg text-slate-800 border border-slate-200">
                  <h4 className="font-bold text-sm text-slate-700 mb-3 flex items-center gap-2 pb-2 border-b border-slate-100">
                    <PieChart size={16} className="text-blue-500"/>
                    Desglose de Mercancía
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(categoryTotals).map(([cat, total]) => (
                      <div key={cat} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                            <span className="text-slate-600 font-medium">{cat}</span>
                        </div>
                        <span className="font-bold text-slate-800">
                           {activeCurrency === 'Bs' ? 'Bs' : '$'} {total.toFixed(2)}
                        </span>
                      </div>
                    ))}
                    <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between items-center font-bold">
                        <span>Total</span>
                        <span>{activeCurrency === 'Bs' ? 'Bs' : '$'} {totalEstimate.toFixed(2)}</span>
                    </div>
                  </div>
              </div>

              {imagePreview && (
                <img 
                  src={imagePreview} 
                  alt="Factura" 
                  className="max-w-full shadow-2xl rounded-lg border-2 border-slate-700"
                />
              )}
            </div>

            {/* Extracted Data List */}
            <div className="flex flex-col h-full bg-slate-50/50 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <h3 className="font-semibold text-slate-700 mb-2">Productos ({scanResult.items.length})</h3>
                {scanResult.items.map((item, idx) => {
                  const match = getMatch(item.productName);
                  const currentStock = match ? match.quantity : 0;
                  const newStock = currentStock + item.quantity;
                  const minStock = match ? match.minStock : 10;
                  const willBeLow = newStock <= minStock;
                  
                  const isPackConversion = item.detectedPackSize && item.detectedPackSize > 1;

                  return (
                    <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                      <div className="flex flex-col gap-3 mb-3">
                        {/* Editable Name & Category */}
                        <div className="flex flex-col gap-1">
                             <div className="flex items-start gap-2">
                                <input 
                                    type="text"
                                    value={item.productName}
                                    onChange={(e) => handleProductNameChange(idx, e.target.value)}
                                    className="font-bold text-slate-900 text-lg bg-transparent hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded px-1 w-full focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                                <Pencil size={16} className="text-slate-300 mt-1 flex-shrink-0" />
                             </div>
                             
                             {/* Category Input */}
                             <div className="flex items-center gap-1.5 px-1">
                                <Tag size={12} className="text-slate-400" />
                                <input 
                                    type="text"
                                    value={item.category || 'General'}
                                    onChange={(e) => handleCategoryChange(idx, e.target.value)}
                                    className="text-xs font-semibold text-slate-500 bg-slate-100 rounded px-2 py-0.5 border border-transparent hover:border-slate-300 focus:border-blue-500 outline-none w-auto"
                                    title="Categoría detectada"
                                />
                             </div>
                        </div>

                        <div className="flex justify-between items-end border-t border-slate-50 pt-2">
                            <div className="text-sm text-slate-600 font-mono flex flex-col">
                                <span className="text-xs text-slate-400">Precio Unitario</span>
                                <div className="font-bold text-base">
                                   {activeCurrency === 'Bs' ? 'Bs' : '$'} {item.price.toFixed(2)}
                                </div>
                            </div>
                            
                            {/* Editable Quantity */}
                            <div className="flex flex-col items-end">
                                <label className="text-xs text-slate-400 font-medium mb-1">Cant. Total</label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="number" 
                                        value={item.quantity}
                                        onChange={(e) => handleQuantityChange(idx, e.target.value)}
                                        className="w-20 text-center font-bold text-lg border border-blue-200 bg-blue-50 text-blue-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Calculation explanation */}
                        {isPackConversion && (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 border border-amber-100 text-amber-800 text-xs font-medium w-fit mt-1">
                                <Calculator size={12} />
                                <span>
                                    Detectado: {item.originalQuantity} x {item.detectedPackSize} unid. = <strong>{item.quantity} Total</strong>
                                </span>
                            </div>
                        )}
                      </div>

                      {/* Stock Comparison Logic */}
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-slate-500">
                          <span>Stock: {currentStock}</span>
                          <ArrowRight size={14} />
                          <span className={`font-bold ${willBeLow ? 'text-amber-600' : 'text-green-600'}`}>
                             {newStock}
                          </span>
                        </div>
                        
                        {match ? (
                            <div className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                                <CheckCircle size={12} />
                                <span>Existe</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 text-xs text-purple-600 font-medium">
                                <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                <span>Nuevo</span>
                            </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Footer Totals */}
              <div className="bg-slate-100 p-4 border-t border-slate-200 text-right">
                  <div className="text-xs text-slate-500 uppercase font-semibold">Total Estimado de Factura</div>
                  <div className="text-2xl font-bold text-slate-800">
                      {activeCurrency === 'Bs' ? 'Bs' : '$'} {totalEstimate.toFixed(2)}
                  </div>
                  {activeCurrency === 'Bs' && exchangeRate > 1 && (
                      <div className="text-xs font-semibold text-green-600 mt-1">
                          ≈ $ {(totalEstimate / exchangeRate).toFixed(2)} USD (Tasa: {exchangeRate})
                      </div>
                  )}
                  <div className="text-[10px] text-slate-400 mt-1">
                      (Suma de Cantidad Original * Precio Unitario)
                  </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};