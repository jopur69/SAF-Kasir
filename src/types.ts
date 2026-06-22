/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  name: string;
  barcode?: string;
  category: string;
  purchasePrice: number;
  sellPrice: number;
  stock: number;
  minStock: number;
  unit: string; // e.g., 'kg', 'pcs', 'sachet', 'liter', 'bungkus'
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface TransactionItem {
  productId: string;
  name: string;
  quantity: number;
  sellPrice: number;
  purchasePrice: number;
  unit: string;
}

export interface Transaction {
  id: string;
  date: string;
  items: TransactionItem[];
  totalBill: number;
  paidAmount: number;
  changeAmount: number;
  profit: number;
  paymentMethod: 'Tunai' | 'QRIS' | 'Utang';
  customerName?: string;
}

export interface DebtPayment {
  id: string;
  date: string;
  amount: number;
}

export interface Debt {
  id: string;
  customerName: string;
  phone: string;
  totalDebt: number;
  remainingDebt: number;
  notes: string;
  dateCreated: string;
  status: 'Belum Lunas' | 'Lunas';
  payments: DebtPayment[];
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  notes: string;
}

export const EXPENSE_CATEGORIES = [
  'Belanja Stok/Kulakan',
  'Gaji Karyawan',
  'Operasional (Listrik, Air, Internet)',
  'Akomodasi & Transportasi',
  'Sewa Tempat',
  'Kerusakan/Penyusutan Barang',
  'Lain-lain'
];

export const PRODUCT_CATEGORIES = [
  'Bahan Pokok (Beras, Minyak, Telur)',
  'Mie & Makanan Instan',
  'Gula, Kopi & Teh',
  'Bumbu & Penyedap',
  'Sabun, Sampo & Deterjen',
  'Camilan & Jajanan',
  'Minuman Dingin & Susu',
  'Lain-lain'
];

export const PRODUCT_UNITS = [
  'pcs (Biji)',
  'kg (Kilogram)',
  'liter (L)',
  'sachet',
  'bungkus (bks)',
  'botol',
  'karton (Dus)',
  'renceng'
];
