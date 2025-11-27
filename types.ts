export interface Product {
  id: string;
  name: string;
  quantity: number;
  minStock: number;
  price: number;
  category: string;
  lastUpdated: string;
  supplierId?: string;
}

export interface Supplier {
  id: string;
  name: string;
  rif: string; // Tax ID
  firstSeen: string;
}

export interface User {
  firstName: string;
  lastName: string;
  email: string;
}

export interface InvoiceItem {
  productName: string;
  quantity: number; // The calculated total (original * packSize)
  price: number;
  confidence?: number;
  originalQuantity?: number; // The quantity explicitly stated on the invoice row
  detectedPackSize?: number; // The multiplier found in the description (e.g., 24 for "x24")
  category?: string; // New field for AI classification
}

export interface InvoiceData {
  items: InvoiceItem[];
  supplier?: {
    name: string;
    rif: string;
  };
  currency?: string;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  INVENTORY = 'INVENTORY',
  SCANNER = 'SCANNER',
  SUPPLIERS = 'SUPPLIERS',
  HISTORY = 'HISTORY'
}

export interface ActivityLog {
  id: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'IMPORT';
  date: string;
  description: string;
  amount: number;
}