/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product } from './types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Beras Pandan Wangi Premium',
    barcode: '899123456001',
    category: 'Bahan Pokok (Beras, Minyak, Telur)',
    purchasePrice: 13500,
    sellPrice: 16000,
    stock: 50,
    minStock: 10,
    unit: 'kg (Kilogram)'
  },
  {
    id: 'prod-2',
    name: 'Minyak Goreng Bimoli 1 Liter',
    barcode: '899123456002',
    category: 'Bahan Pokok (Beras, Minyak, Telur)',
    purchasePrice: 15500,
    sellPrice: 18500,
    stock: 24,
    minStock: 8,
    unit: 'botol'
  },
  {
    id: 'prod-3',
    name: 'Telur Ayam Ras Curah',
    barcode: '',
    category: 'Bahan Pokok (Beras, Minyak, Telur)',
    purchasePrice: 24000,
    sellPrice: 28000,
    stock: 30,
    minStock: 5,
    unit: 'kg (Kilogram)'
  },
  {
    id: 'prod-4',
    name: 'Indomie Goreng Spesial',
    barcode: '089686011301',
    category: 'Mie & Makanan Instan',
    purchasePrice: 2600,
    sellPrice: 3200,
    stock: 120,
    minStock: 20,
    unit: 'bungkus (bks)'
  },
  {
    id: 'prod-5',
    name: 'Mie Sedaap Soto',
    barcode: '089686011302',
    category: 'Mie & Makanan Instan',
    purchasePrice: 2500,
    sellPrice: 3100,
    stock: 80,
    minStock: 20,
    unit: 'bungkus (bks)'
  },
  {
    id: 'prod-6',
    name: 'Gula Pasir Gulaku 1kg',
    barcode: '899512345601',
    category: 'Gula, Kopi & Teh',
    purchasePrice: 14500,
    sellPrice: 17000,
    stock: 15,
    minStock: 5,
    unit: 'pcs (Biji)'
  },
  {
    id: 'prod-7',
    name: 'Kopi Kapal Api Special 165g',
    barcode: '899321456003',
    category: 'Gula, Kopi & Teh',
    purchasePrice: 12100,
    sellPrice: 14000,
    stock: 20,
    minStock: 5,
    unit: 'pcs (Biji)'
  },
  {
    id: 'prod-8',
    name: 'Teh Celup SariWangi isi 25',
    barcode: '899876543001',
    category: 'Gula, Kopi & Teh',
    purchasePrice: 5000,
    sellPrice: 6500,
    stock: 25,
    minStock: 6,
    unit: 'pcs (Biji)'
  },
  {
    id: 'prod-9',
    name: 'Royco Kaldu Ayam Sachet 9g',
    barcode: '899876543002',
    category: 'Bumbu & Penyedap',
    purchasePrice: 450,
    sellPrice: 600,
    stock: 200,
    minStock: 30,
    unit: 'sachet'
  },
  {
    id: 'prod-10',
    name: 'Deterjen Rinso Molto 800g',
    barcode: '899876543003',
    category: 'Sabun, Sampo & Deterjen',
    purchasePrice: 18000,
    sellPrice: 21500,
    stock: 12,
    minStock: 4,
    unit: 'pcs (Biji)'
  },
  {
    id: 'prod-11',
    name: 'Sabun Mandi Lifebuoy Merah 85g',
    barcode: '899876543004',
    category: 'Sabun, Sampo & Deterjen',
    purchasePrice: 3200,
    sellPrice: 4000,
    stock: 40,
    minStock: 8,
    unit: 'pcs (Biji)'
  },
  {
    id: 'prod-12',
    name: 'Le Minerale Botol 600ml',
    barcode: '899700123045',
    category: 'Minuman Dingin & Susu',
    purchasePrice: 2100,
    sellPrice: 3000,
    stock: 48,
    minStock: 12,
    unit: 'botol'
  }
];
