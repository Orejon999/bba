import { Product, ActivityLog, Supplier, InvoiceItem } from "../types";
import { supabase } from "./supabaseClient";

export const InventoryService = {
  // --- Products ---
  getAll: async (): Promise<Product[]> => {
    const { data, error } = await supabase
      .from('products')
      .select('*');
    
    if (error) {
      console.error("Error fetching products:", error);
      throw new Error("No se pudo conectar con la base de datos. Verifica tu configuración en Supabase.");
    }

    // Map snake_case (DB) to camelCase (Frontend)
    return data.map((item: any) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      minStock: item.min_stock,
      price: item.price,
      category: item.category,
      lastUpdated: item.last_updated,
      supplierId: item.supplier_id
    }));
  },

  updateProductDetails: async (id: string, updates: Partial<Product>) => {
    // Map updates back to snake_case
    const dbUpdates: any = {};
    if (updates.minStock !== undefined) dbUpdates.min_stock = updates.minStock;
    if (updates.price !== undefined) dbUpdates.price = updates.price;
    if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;

    dbUpdates.last_updated = new Date().toISOString();

    const { error } = await supabase
      .from('products')
      .update(dbUpdates)
      .eq('id', id);

    if (error) throw error;
    
    // Return fresh list
    return await InventoryService.getAll();
  },

  // --- Suppliers ---
  getSuppliers: async (): Promise<Supplier[]> => {
    const { data, error } = await supabase.from('suppliers').select('*');
    if (error) {
        console.error("Error fetching suppliers:", error);
        return [];
    }
    
    return data.map((s: any) => ({
      id: s.id,
      name: s.name,
      rif: s.rif,
      firstSeen: s.created_at
    }));
  },

  addSupplier: async (name: string, rif: string): Promise<Supplier> => {
    // Check if exists
    const { data: existing } = await supabase
      .from('suppliers')
      .select('*')
      .or(`rif.eq.${rif},name.ilike.${name}`)
      .single();

    if (existing) {
      return {
        id: existing.id,
        name: existing.name,
        rif: existing.rif,
        firstSeen: existing.created_at
      };
    }

    const { data, error } = await supabase
      .from('suppliers')
      .insert([{ name, rif }])
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      rif: data.rif,
      firstSeen: data.created_at
    };
  },

  resolveInvoiceAliases: async (items: InvoiceItem[], supplierName: string): Promise<InvoiceItem[]> => {
    // Basic implementation: fuzzy match against existing DB products
    try {
        const products = await InventoryService.getAll();
        
        return items.map(item => {
        const existing = products.find(p => p.name.toLowerCase().trim() === item.productName.toLowerCase().trim());
        if (existing) {
            // Keep the category of the existing product if we have it, or use the new one if not
            return { ...item, productName: existing.name, category: existing.category || item.category };
        }
        return item;
        });
    } catch (e) {
        // If getAll fails (e.g. DB error), return items as is to not block scanner
        return items;
    }
  },

  // --- Stock Operations ---
  updateStock: async (items: InvoiceItem[], supplierInfo?: { name: string, rif: string }, invoiceCurrency: 'USD' | 'Bs' = 'USD', exchangeRate: number = 1) => {
    
    // 1. Handle Supplier
    let supplierId = null;
    if (supplierInfo && supplierInfo.name) {
      const supplier = await InventoryService.addSupplier(supplierInfo.name, supplierInfo.rif || 'N/A');
      supplierId = supplier.id;
    }

    // 2. Process Items
    for (const newItem of items) {
      const newItemName = newItem.productName || "Producto Desconocido";
      const priceInUSD = invoiceCurrency === 'Bs' ? newItem.price / exchangeRate : newItem.price;

      // Check existence by name
      const { data: existingProducts } = await supabase
        .from('products')
        .select('*')
        .ilike('name', newItemName);

      const existing = existingProducts && existingProducts.length > 0 ? existingProducts[0] : null;

      if (existing) {
        // Update
        const newQuantity = existing.quantity + newItem.quantity;
        await supabase.from('products').update({
          quantity: newQuantity,
          price: priceInUSD,
          last_updated: new Date().toISOString(),
          supplier_id: supplierId || existing.supplier_id
        }).eq('id', existing.id);

        await InventoryService.logActivity('IN', `Factura ${supplierInfo?.name || ''}: ${newItemName}`, newItem.quantity);

      } else {
        // Create
        await supabase.from('products').insert({
          name: newItemName,
          quantity: newItem.quantity,
          min_stock: 10,
          price: priceInUSD,
          category: newItem.category || 'General',
          last_updated: new Date().toISOString(),
          supplier_id: supplierId
        });

        await InventoryService.logActivity('IN', `Nuevo (${supplierInfo?.name || 'Manual'}): ${newItemName}`, newItem.quantity);
      }
    }
    
    return await InventoryService.getAll();
  },

  registerStockOut: async (productId: string, amount: number) => {
    const { data: product } = await supabase.from('products').select('*').eq('id', productId).single();
    
    if (product) {
       const newQuantity = Math.max(0, product.quantity - amount);
       const actualDiff = product.quantity - newQuantity;

       if (actualDiff > 0) {
           await supabase.from('products').update({
               quantity: newQuantity,
               last_updated: new Date().toISOString()
           }).eq('id', productId);

           await InventoryService.logActivity('OUT', `Salida Manual: ${product.name}`, actualDiff);
       }
    }
  },

  importFromCSV: async (csvText: string) => {
    const lines = csvText.split('\n');
    let addedCount = 0;
    let updatedCount = 0;

    // Fetch all products once to minimize queries
    const currentProducts = await InventoryService.getAll();

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',');
        
        if (cols.length >= 2) {
            const name = cols[0]?.trim();
            const quantity = parseInt(cols[1]?.trim()) || 0;
            const price = parseFloat(cols[2]?.trim()) || 0;
            const minStock = parseInt(cols[3]?.trim()) || 10;
            const category = cols[4]?.trim() || 'General';

            const existing = currentProducts.find(p => p.name.toLowerCase() === name.toLowerCase());

            if (existing) {
                await supabase.from('products').update({
                    quantity: existing.quantity + quantity,
                    price: price > 0 ? price : existing.price,
                    last_updated: new Date().toISOString()
                }).eq('id', existing.id);
                updatedCount++;
            } else {
                await supabase.from('products').insert({
                    name: name,
                    quantity: quantity,
                    price: price,
                    min_stock: minStock,
                    category: category,
                    last_updated: new Date().toISOString()
                });
                addedCount++;
            }
        }
    }

    await InventoryService.logActivity('IMPORT', `Importación CSV: ${addedCount} nuevos, ${updatedCount} act.`, addedCount + updatedCount);
    return { addedCount, updatedCount };
  },

  // --- Logs ---
  logActivity: async (type: string, description: string, amount: number) => {
      await supabase.from('activity_logs').insert({
          type,
          description,
          amount,
          date: new Date().toISOString()
      });
  },
  
  getStats: async () => {
      // Use try-catch to avoid crashing if getAll throws
      try {
        const products = await InventoryService.getAll();
        const totalItems = products.reduce((acc, curr) => acc + curr.quantity, 0);
        const totalValue = products.reduce((acc, curr) => acc + (curr.quantity * curr.price), 0);
        const lowStockCount = products.filter(p => p.quantity <= p.minStock).length;
        return { totalItems, totalValue, lowStockCount };
      } catch (e) {
        return { totalItems: 0, totalValue: 0, lowStockCount: 0 };
      }
  }
};