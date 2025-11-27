import React, { useState, useEffect } from 'react';
import { Supplier } from '../types';
import { InventoryService } from '../services/inventoryService';
import { Building2, Search, Calendar } from 'lucide-react';

export const SupplierPanel: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchSuppliers = async () => {
        const data = await InventoryService.getSuppliers();
        setSuppliers(data);
    };
    fetchSuppliers();
  }, []);

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.rif.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="text-purple-600" />
            Panel de Proveedores
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Gestión automática de empresas detectadas en facturas.
          </p>
        </div>
        
        <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input 
                type="text" 
                placeholder="Buscar por Nombre o RIF..." 
                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 w-64 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSuppliers.map((supplier) => (
            <div key={supplier.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center font-bold text-lg">
                        {supplier.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="px-2 py-1 bg-slate-100 rounded text-xs font-mono text-slate-600">
                        {supplier.rif}
                    </div>
                </div>
                <h3 className="font-bold text-slate-800 text-lg mb-1">{supplier.name}</h3>
                
                <div className="mt-4 pt-4 border-t border-slate-100 text-sm text-slate-500 flex items-center gap-2">
                    <Calendar size={14} />
                    <span>Registrado: {new Date(supplier.firstSeen).toLocaleDateString()}</span>
                </div>
            </div>
        ))}

        {filteredSuppliers.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200 border-dashed">
                <Building2 size={48} className="mx-auto mb-4 opacity-30" />
                <p>No se encontraron proveedores registrados.</p>
                <p className="text-sm">Sube una factura para agregar uno automáticamente.</p>
            </div>
        )}
      </div>
    </div>
  );
};