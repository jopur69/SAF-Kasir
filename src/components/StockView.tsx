/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Search, Plus, Edit3, Trash2, ArrowUpRight, ArrowDownRight, Archive, Check, AlertCircle, RefreshCw, Layers, ArrowRight, Coins, TrendingUp } from 'lucide-react';
import { Product, PRODUCT_CATEGORIES, PRODUCT_UNITS, Expense } from '../types';
import { formatRupiah } from '../utils/format';
import { INITIAL_PRODUCTS } from '../initialData';

interface StockViewProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onAddExpense?: (expense: Expense) => void;
}

export default function StockView({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onAddExpense
}: StockViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [stockStatusFilter, setStockStatusFilter] = useState<'Semua' | 'Habis' | 'Menipis' | 'Aman'>('Semua');

  // Modal form states
  const [showProductModal, setShowProductModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Connection states
  const [recordAsExpense, setRecordAsExpense] = useState(true);
  const [originalStock, setOriginalStock] = useState<number>(0);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formCategory, setFormCategory] = useState(PRODUCT_CATEGORIES[0]);
  const [formPurchasePrice, setFormPurchasePrice] = useState<number>(0);
  const [formSellPrice, setFormSellPrice] = useState<number>(0);
  const [formStock, setFormStock] = useState<number>(0);
  const [formMinStock, setFormMinStock] = useState<number>(5);
  const [formUnit, setFormUnit] = useState(PRODUCT_UNITS[0]);

  // Restock Quick Dialog
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockAmount, setRestockAmount] = useState<number>(10);

  // Custom Delete warning state
  const [deleteConf, setDeleteConf] = useState<{ productId: string, name: string } | null>(null);

  // Audit Flow / Jendela Alur Aliran Dana popup state
  const [auditDetails, setAuditDetails] = useState<{
    title: string;
    productName: string;
    unit: string;
    diffStock: number;
    previousStock: number;
    currentStock: number;
    purchasePrice: number;
    totalCost: number;
    isExpenseRecorded: boolean;
    expenseCategory: string;
    expenseNotes: string;
  } | null>(null);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.barcode && p.barcode.includes(searchQuery));
      const matchCategory = selectedCategory === 'Semua' || p.category === selectedCategory;
      
      let matchStatus = true;
      if (stockStatusFilter === 'Habis') {
        matchStatus = p.stock <= 0;
      } else if (stockStatusFilter === 'Menipis') {
        matchStatus = p.stock > 0 && p.stock <= p.minStock;
      } else if (stockStatusFilter === 'Aman') {
        matchStatus = p.stock > p.minStock;
      }

      return matchSearch && matchCategory && matchStatus;
    });
  }, [products, searchQuery, selectedCategory, stockStatusFilter]);

  const [isPopulatingDemo, setIsPopulatingDemo] = useState(false);

  const handleLoadDemoData = async () => {
    setIsPopulatingDemo(true);
    try {
      for (const prod of INITIAL_PRODUCTS) {
        const isDuplicate = products.some(
          p => p.name.toLowerCase() === prod.name.toLowerCase() || 
          (prod.barcode && p.barcode === prod.barcode)
        );
        if (!isDuplicate) {
          onAddProduct(prod);
        }
      }
    } catch (err) {
      console.error('Gagal memuat barang demo:', err);
    } finally {
      setIsPopulatingDemo(false);
    }
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setEditingProductId(null);
    setFormName('');
    setFormBarcode('');
    setFormCategory(PRODUCT_CATEGORIES[0]);
    setFormPurchasePrice(0);
    setFormSellPrice(0);
    setFormStock(0);
    setFormMinStock(5);
    setFormUnit(PRODUCT_UNITS[0]);
    setRecordAsExpense(true);
    setOriginalStock(0);
    setShowProductModal(true);
  };

  const openEditModal = (product: Product) => {
    setIsEditMode(true);
    setEditingProductId(product.id);
    setFormName(product.name);
    setFormBarcode(product.barcode || '');
    setFormCategory(product.category);
    setFormPurchasePrice(product.purchasePrice);
    setFormSellPrice(product.sellPrice);
    setFormStock(product.stock);
    setFormMinStock(product.minStock);
    setFormUnit(product.unit);
    setRecordAsExpense(true);
    setOriginalStock(product.stock);
    setShowProductModal(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const productData: Product = {
      id: isEditMode && editingProductId ? editingProductId : `prod-${Date.now()}`,
      name: formName.trim(),
      barcode: formBarcode.trim() || undefined,
      category: formCategory,
      purchasePrice: Number(formPurchasePrice),
      sellPrice: Number(formSellPrice),
      stock: Number(formStock),
      minStock: Number(formMinStock),
      unit: formUnit
    };

    let auditInfo: typeof auditDetails = null;

    if (isEditMode) {
      const diff = Number(formStock) - originalStock;
      const isExpense = recordAsExpense && onAddExpense && diff !== 0;
      let expenseCategory = '';
      let expenseNotes = '';
      
      if (isExpense) {
        if (diff > 0) {
          expenseCategory = 'Belanja Stok/Kulakan';
          expenseNotes = `Restock/Ubah Rincian Stok (+${diff} ${formUnit}): ${formName.trim()}`;
          onAddExpense({
            id: `exp-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            category: expenseCategory,
            amount: diff * Number(formPurchasePrice),
            notes: expenseNotes
          });
        } else if (diff < 0) {
          expenseCategory = 'Kerusakan/Penyusutan Barang';
          expenseNotes = `Penyusutan/Rusak (-${Math.abs(diff)} ${formUnit}): ${formName.trim()}`;
          onAddExpense({
            id: `exp-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            category: expenseCategory,
            amount: Math.abs(diff) * Number(formPurchasePrice),
            notes: expenseNotes
          });
        }
      }
      
      auditInfo = {
        title: 'Laporan Aliran Dana & Penyesuaian Barang',
        productName: formName.trim(),
        unit: formUnit,
        diffStock: diff,
        previousStock: originalStock,
        currentStock: Number(formStock),
        purchasePrice: Number(formPurchasePrice),
        totalCost: Math.abs(diff) * Number(formPurchasePrice),
        isExpenseRecorded: isExpense,
        expenseCategory,
        expenseNotes
      };
      onUpdateProduct(productData);
    } else {
      const isExpense = recordAsExpense && onAddExpense && Number(formStock) > 0;
      let expenseCategory = '';
      let expenseNotes = '';
      
      if (isExpense) {
        expenseCategory = 'Belanja Stok/Kulakan';
        expenseNotes = `Modal Awal Stok: ${formStock} ${formUnit} - ${formName.trim()}`;
        onAddExpense({
          id: `exp-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          category: expenseCategory,
          amount: Number(formStock) * Number(formPurchasePrice),
          notes: expenseNotes
        });
      }
      
      auditInfo = {
        title: 'Laporan Aliran Barang Baru & Investasi Modal',
        productName: formName.trim(),
        unit: formUnit,
        diffStock: Number(formStock),
        previousStock: 0,
        currentStock: Number(formStock),
        purchasePrice: Number(formPurchasePrice),
        totalCost: Number(formStock) * Number(formPurchasePrice),
        isExpenseRecorded: isExpense,
        expenseCategory,
        expenseNotes
      };
      onAddProduct(productData);
    }

    setAuditDetails(auditInfo);
    setShowProductModal(false);
  };

  const openRestockModal = (product: Product) => {
    setRestockProduct(product);
    setRestockAmount(10); // default restock quantity
    setRecordAsExpense(true);
    setShowRestockModal(true);
  };

  const handleSaveRestock = () => {
    if (!restockProduct) return;
    const updated: Product = {
      ...restockProduct,
      stock: restockProduct.stock + Number(restockAmount)
    };
    
    const isExpense = recordAsExpense && onAddExpense;
    let expenseCategory = '';
    let expenseNotes = '';
    
    if (isExpense) {
      expenseCategory = 'Belanja Stok/Kulakan';
      expenseNotes = `Pasok Stok: +${restockAmount} ${restockProduct.unit} - ${restockProduct.name}`;
      onAddExpense({
        id: `exp-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        category: expenseCategory,
        amount: Number(restockAmount) * restockProduct.purchasePrice,
        notes: expenseNotes
      });
    }

    const auditInfo: typeof auditDetails = {
      title: 'Laporan Aliran Dana Pasok Stok (Restock)',
      productName: restockProduct.name,
      unit: restockProduct.unit,
      diffStock: Number(restockAmount),
      previousStock: restockProduct.stock,
      currentStock: restockProduct.stock + Number(restockAmount),
      purchasePrice: restockProduct.purchasePrice,
      totalCost: Number(restockAmount) * restockProduct.purchasePrice,
      isExpenseRecorded: isExpense,
      expenseCategory,
      expenseNotes
    };

    onUpdateProduct(updated);
    setAuditDetails(auditInfo);
    setShowRestockModal(false);
  };

  const handleDeleteClick = (productId: string, name: string) => {
    setDeleteConf({ productId, name });
  };

  const totalAssetValue = useMemo(() => {
    return products.reduce((sum, p) => sum + (p.purchasePrice * p.stock), 0);
  }, [products]);

  const totalRetailValue = useMemo(() => {
    return products.reduce((sum, p) => sum + (p.sellPrice * p.stock), 0);
  }, [products]);

  return (
    <div id="stock-view-container" className="flex flex-col gap-4 animate-fade-in">
      
      {/* Top Inventory Summary Cards */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-4">
        <div className="bg-white rounded-xl p-2 sm:p-4 border border-slate-150/60 shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Jenis Barang</span>
            <span className="font-display font-bold text-xs sm:text-lg text-slate-800 truncate block">{products.length} Macam</span>
          </div>
          <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600 shrink-0 hidden sm:block">
            <Archive className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-2 sm:p-4 border border-slate-150/60 shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Nilai Asset</span>
            <span className="font-display font-mono font-bold text-xs sm:text-base text-slate-850 truncate block">{formatRupiah(totalAssetValue)}</span>
          </div>
          <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600 shrink-0 hidden sm:block">
            <ArrowDownRight className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-2 sm:p-4 border border-slate-150/60 shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Sembako Jual</span>
            <span className="font-display font-mono font-bold text-xs sm:text-base text-slate-800 truncate block">{formatRupiah(totalRetailValue)}</span>
          </div>
          <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600 shrink-0 hidden sm:block">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Control Area */}
      <div className="bg-white p-3 rounded-xl border border-slate-150/70 shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2 ml-0.5 text-slate-400 w-3.5 h-3.5" />
            <input
              type="text"
              placeholder="Cari barang atau barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-1.5 sm:flex sm:items-center">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-600 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="Semua">Kategori</option>
              {PRODUCT_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value as any)}
              className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-600 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="Semua">Status Stok</option>
              <option value="Habis">Stok Habis (= 0)</option>
              <option value="Menipis">Hampir Habis (≤ Batas)</option>
              <option value="Aman">Aman & Banyak</option>
            </select>
          </div>
        </div>

        {/* Action Add Button */}
        <div className="flex items-center gap-2 self-stretch md:self-auto">
          {products.length > 0 && (
            <button
              onClick={handleLoadDemoData}
              disabled={isPopulatingDemo}
              className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-extrabold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200"
              title="Muat 12 Sembako Populer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isPopulatingDemo ? 'animate-spin' : ''}`} />
              <span>Muat Contoh</span>
            </button>
          )}

          <button
            onClick={openAddModal}
            id="btn-add-product"
            className="py-1.5 px-3 bg-emerald-100 hover:bg-emerald-200 active:bg-emerald-305 text-emerald-950 font-extrabold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 self-stretch md:self-auto cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Barang</span>
          </button>
        </div>

      </div>

      {/* Main Stock Table / HP List */}
      {products.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-slate-150/75 shadow-2xs text-center flex flex-col items-center justify-center max-w-xl mx-auto my-8 animate-fade-in relative overflow-hidden">
          <div className="absolute right-0 top-0 -translate-y-12 translate-x-12 w-32 h-32 bg-emerald-50/30 rounded-full blur-2xl pointer-events-none"></div>
          <div className="absolute left-0 bottom-0 translate-y-12 -translate-x-12 w-32 h-32 bg-indigo-50/20 rounded-full blur-2xl pointer-events-none"></div>

          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-4 shadow-sm shadow-emerald-100/50 relative z-10 animate-pulse">
            <Layers className="w-7 h-7" />
          </div>
          <h3 className="font-display font-black text-slate-800 text-sm relative z-10">Stok Barang Anda Masih Kosong</h3>
          <p className="text-slate-500 text-[11px] leading-relaxed max-w-sm mt-1.5 font-bold relative z-10">
            Aplikasi Anda siap dipakai! Anda bisa memasukkan <span className="text-slate-700 font-extrabold">12 jenis barang sembako populer</span> untuk uji coba atau latihan jualan instan, atau menambahkan produk baru secara manual.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full relative z-10">
            <button
              onClick={handleLoadDemoData}
              disabled={isPopulatingDemo}
              className="flex-1 py-3 px-4 bg-emerald-100 hover:bg-emerald-200 active:bg-emerald-300 text-emerald-950 font-extrabold rounded-xl transition-all shadow-md shadow-emerald-50 flex items-center justify-center gap-2 cursor-pointer text-xs select-none"
            >
              <RefreshCw className={`w-4 h-4 ${isPopulatingDemo ? 'animate-spin' : ''}`} />
              <span>{isPopulatingDemo ? 'Sedang Memasukkan...' : 'Muat 12 Sembako Populer'}</span>
            </button>
            <button
              onClick={openAddModal}
              className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs select-none border border-slate-200"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Manual</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        
        {/* Responsive Table for Desktop, Card List for Mobile */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4 font-semibold">Nama Barang</th>
                <th className="py-3.5 px-4 font-semibold">Kategori</th>
                <th className="py-3.5 px-4 font-semibold text-right">Harga Beli</th>
                <th className="py-3.5 px-4 font-semibold text-right">Harga Jual</th>
                <th className="py-3.5 px-4 font-semibold text-center">Stok</th>
                <th className="py-3.5 px-4 font-semibold text-center">Satuan</th>
                <th className="py-3.5 px-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
              {filteredProducts.map(product => {
                const isOutOfStock = product.stock <= 0;
                const isLowStock = product.stock > 0 && product.stock <= product.minStock;

                return (
                  <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{product.name}</div>
                      {product.barcode && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">Barcode: {product.barcode}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] bg-slate-100 text-slate-655 px-2 py-0.5 rounded-md font-bold text-slate-600">{product.category.split(' ')[0]}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">{formatRupiah(product.purchasePrice)}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-800 font-bold">{formatRupiah(product.sellPrice)}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                          isOutOfStock
                            ? 'bg-rose-100 text-rose-800'
                            : isLowStock
                            ? 'bg-amber-140 text-amber-800 bg-amber-100'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {product.stock}
                        </span>
                        {product.stock <= product.minStock && (
                          <span className="text-[9px] bg-amber-50 text-amber-600 font-bold px-1.5 py-0.5 rounded border border-amber-200 animate-pulse">Min: {product.minStock}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-500">{product.unit || 'pcs'}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openRestockModal(product)}
                          className="px-2 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 rounded text-[10px] font-bold text-slate-600 transition-colors flex items-center gap-1"
                          title="Tambah Stok Cepat"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Pasok</span>
                        </button>
                        <button
                          onClick={() => openEditModal(product)}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors"
                          title="Ubah Rincian"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(product.id, product.name)}
                          className="p-1 text-slate-350 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                          title="Hapus Barang"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Archive className="w-8 h-8 text-slate-350 mx-auto mb-1.5" />
                    <span>Tidak ada barang dengan kriteria tersebut.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Grid Layout for HP */}
        <div className="block md:hidden divide-y divide-slate-100">
          {filteredProducts.map(product => {
            const isOutOfStock = product.stock <= 0;
            const isLowStock = product.stock > 0 && product.stock <= product.minStock;

            return (
              <div key={product.id} className="p-4 flex flex-col gap-2.5 hover:bg-slate-50/50">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm">{product.name}</h4>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{product.unit} {product.barcode ? `• ${product.barcode}` : ''}</p>
                    <span className="text-[9px] bg-slate-100 text-slate-630 px-2 py-0.5 rounded-md font-bold mt-1.5 inline-block text-slate-500">{product.category.split(' ')[0]}</span>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                      isOutOfStock
                        ? 'bg-rose-100 text-rose-800'
                        : isLowStock
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      Stok: {product.stock}
                    </span>
                    {isLowStock && (
                      <span className="text-[9px] text-amber-600 font-bold bg-amber-50 px-1 py-0.5 rounded border border-amber-100 animate-pulse">Min: {product.minStock}</span>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center bg-slate-50/70 p-2 rounded-xl text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-medium block">Beli / Modal</span>
                    <span className="font-sans font-semibold text-slate-600">{formatRupiah(product.purchasePrice)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-medium block">Harga Jual</span>
                    <span className="font-sans font-bold text-indigo-700">{formatRupiah(product.sellPrice)}</span>
                  </div>
                </div>

                {/* Mobile Touch Actions */}
                <div className="flex items-center justify-end gap-1.5 mt-1">
                  <button
                    onClick={() => openRestockModal(product)}
                    className="flex-1 py-2 bg-slate-50 active:bg-slate-100 text-indigo-650 hover:text-indigo-700 rounded-xl border border-slate-200 text-xs font-bold flex items-center justify-center gap-1 mt-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Pasok</span>
                  </button>
                  <button
                    onClick={() => openEditModal(product)}
                    className="p-2 py-1.5 text-slate-500 bg-slate-50 border border-slate-200 rounded-xl active:bg-slate-100"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(product.id, product.name)}
                    className="p-2 py-1.5 text-rose-600 bg-rose-50 rounded-xl active:bg-rose-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {filteredProducts.length === 0 && (
            <div className="p-8 text-center text-slate-400">
              <Archive className="w-8 h-8 text-slate-350 mx-auto mb-1.5" />
              <p className="text-xs">Barang tidak ditemukan</p>
            </div>
          )}
        </div>

      </div>

      )}

      {/* MODAL: RESTOCK ONLY QUANTITY (TAMBAH STOK CEPAT) */}
      {showRestockModal && restockProduct && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="mt-24 sm:mt-32 mb-12 bg-white rounded-3xl border border-slate-100 w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[80vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-display font-bold text-slate-800 text-sm">Pasok / Kulakan Stok</h3>
              <button 
                onClick={() => setShowRestockModal(false)} 
                className="text-slate-400 hover:text-slate-600 font-bold text-xs p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
              >
                Batal
              </button>
            </div>
            
            <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-4">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Nama Barang</p>
                <p className="font-semibold text-slate-850 text-sm">{restockProduct.name}</p>
                <p className="text-xs text-slate-500 mt-1">Stok saat ini: <span className="font-mono font-bold text-slate-800">{restockProduct.stock} {restockProduct.unit}</span></p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1.5">Jumlah Stok yang Dibeli (+)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={restockAmount}
                    onChange={(e) => setRestockAmount(Number(e.target.value))}
                    className="w-full text-center text-lg font-mono font-bold px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    min={1}
                  />
                  <span className="text-xs text-slate-500 font-semibold">{restockProduct.unit}</span>
                </div>
              </div>

              <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-[11px] leading-relaxed text-indigo-800 font-semibold mb-2">
                Estimasi Total Modal Kulakan: {formatRupiah(restockProduct.purchasePrice * restockAmount)} 
                <span className="block font-normal text-[10px] text-slate-450 mt-0.5">(Menggunakan harga beli modal terdaftar {formatRupiah(restockProduct.purchasePrice)} / {restockProduct.unit})</span>
              </div>

              <label className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-205 cursor-pointer hover:bg-slate-100/70 transition-colors select-none">
                <input
                  type="checkbox"
                  checked={recordAsExpense}
                  onChange={(e) => setRecordAsExpense(e.target.checked)}
                  className="mt-1 h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <div className="text-left">
                  <span className="font-display font-bold text-slate-800 text-xs leading-none block">Catat Otomatis ke Pengeluaran</span>
                  <span className="text-[9.5px] text-slate-500 font-semibold leading-normal block mt-1">
                    Buat catatan pengeluaran belanja cabang sebesar {formatRupiah(restockProduct.purchasePrice * restockAmount)}
                  </span>
                </div>
              </label>
            </div>

            <div className="p-4 border-t border-slate-100 flex gap-2 shrink-0">
              <button
                onClick={() => setShowRestockModal(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-205 rounded-xl font-semibold text-xs text-slate-650"
              >
                Batal
              </button>
              <button
                onClick={handleSaveRestock}
                className="flex-1 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-semibold rounded-xl text-xs shadow-md shadow-emerald-100/50"
              >
                Simpan Stok Baru
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT PRODUCT FULL */}
      {showProductModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="mt-24 sm:mt-32 mb-12 bg-white rounded-3xl border border-slate-100 w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[80vh]">
            
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <h3 className="font-display font-bold text-slate-800 text-md">
                {isEditMode ? 'Ubah Rincian Barang' : 'Tambah Barang Baru'}
              </h3>
              <button
                onClick={() => setShowProductModal(false)}
                className="text-slate-400 hover:text-slate-605 font-bold text-xs p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
              >
                Batal
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-4">
                
                {/* Product Name */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Nama Barang Sembako (Wajib)</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Beras SPHP, Minyak Kita 1L, Mie Indomie..."
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-505/20 focus:border-indigo-500"
                  />
                </div>

                {/* Barcode & Category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Barcode / Kode Batang</label>
                    <input
                      type="text"
                      value={formBarcode}
                      onChange={(e) => setFormBarcode(e.target.value)}
                      placeholder="Barcode scanner scan..."
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Kategori Sembako</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-550/20"
                    >
                      {PRODUCT_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Buy Price & Sell Price */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div>
                    <label className="text-xs font-bold text-slate-550 block mb-1">Harga Beli / Modal (Rp)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={formPurchasePrice === 0 ? '' : new Intl.NumberFormat('id-ID').format(formPurchasePrice)}
                      onChange={(e) => {
                        const cleanVal = e.target.value.replace(/\D/g, '');
                        const numericVal = cleanVal ? parseInt(cleanVal, 10) : 0;
                        setFormPurchasePrice(numericVal);
                      }}
                      placeholder="e.g. 15.000"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-mono text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-550 block mb-1">Harga Jual Konsumen (Rp)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={formSellPrice === 0 ? '' : new Intl.NumberFormat('id-ID').format(formSellPrice)}
                      onChange={(e) => {
                        const cleanVal = e.target.value.replace(/\D/g, '');
                        const numericVal = cleanVal ? parseInt(cleanVal, 10) : 0;
                        setFormSellPrice(numericVal);
                      }}
                      placeholder="e.g. 18.000"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-mono text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                {/* Profit Gap Notification */}
                {formSellPrice > 0 && formPurchasePrice > 0 && (
                  <div className={`text-[10px] p-2.5 rounded-lg font-semibold leading-tight ${
                    formSellPrice < formPurchasePrice 
                      ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                      : 'bg-emerald-50 text-emerald-800'
                  }`}>
                    {formSellPrice < formPurchasePrice ? (
                      <div className="flex items-start gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600 mt-0.5" />
                        <span>PERINGATAN: Harga jual lebih rendah dari modal beli! Toko akan mengalami kerugian sebesar {formatRupiah(formPurchasePrice - formSellPrice)} tiap transaksi.</span>
                      </div>
                    ) : (
                      <span>Keuntungan kotor per barang: **{formatRupiah(formSellPrice - formPurchasePrice)}** ({((formSellPrice - formPurchasePrice) / formPurchasePrice * 100).toFixed(0)}% Margin keuntungan)</span>
                    )}
                  </div>
                )}

                {/* Stock Inputs */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Stok Awal</label>
                    <input
                      type="number"
                      required
                      value={formStock}
                      onChange={(e) => setFormStock(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-center"
                      min={0}
                    />
                  </div>

                  <div className="col-span-1">
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Batas Menipis</label>
                    <input
                      type="number"
                      required
                      value={formMinStock}
                      onChange={(e) => setFormMinStock(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-center"
                      min={0}
                    />
                  </div>

                  <div className="col-span-1">
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Satuan Barang</label>
                    <select
                      value={formUnit}
                      onChange={(e) => setFormUnit(e.target.value)}
                      className="w-full px-1.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-center focus:outline-none"
                    >
                      {PRODUCT_UNITS.map(unit => (
                        <option key={unit} value={unit}>{unit.split(' ')[0]}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Contextual Expense Integration Checkbox */}
                {((!isEditMode && Number(formStock) > 0) || (isEditMode && Number(formStock) !== originalStock)) && (
                  <label className="flex items-start gap-2.5 bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-100/60 cursor-pointer hover:bg-indigo-50 transition-colors select-none">
                    <input
                      type="checkbox"
                      checked={recordAsExpense}
                      onChange={(e) => setRecordAsExpense(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500/20 border-indigo-200 cursor-pointer"
                    />
                    <div className="text-left">
                      <span className="font-display font-extrabold text-slate-850 text-xs leading-none block">
                        Catat Transaksi Kasbon / Pengeluaran Toko
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold leading-relaxed block mt-1.5">
                        {!isEditMode ? (
                          <>
                            Catat modal awal persediaan sebesar <strong className="text-indigo-700 font-bold">{formatRupiah(Number(formStock) * Number(formPurchasePrice))}</strong> ({formStock} {formUnit}) ke daftar Pengeluaran (Belanja Stok).
                          </>
                        ) : (
                          <>
                            {Number(formStock) > originalStock ? (
                              <>
                                Persediaan bertambah <strong className="text-indigo-700 font-bold">+{Number(formStock) - originalStock}</strong>. Catat tambahan modal belanja sebesar <strong className="text-indigo-700 font-bold">{formatRupiah((Number(formStock) - originalStock) * Number(formPurchasePrice))}</strong>.
                              </>
                            ) : (
                              <>
                                Persediaan menyusut <strong className="text-rose-700 font-bold">{Number(formStock) - originalStock}</strong>. Catat kerugian barang rusak/hilang sebesar <strong className="text-rose-700 font-bold">{formatRupiah(Math.abs(Number(formStock) - originalStock) * Number(formPurchasePrice))}</strong> ke Pengeluaran (Penyusutan/Rusak).
                              </>
                            )}
                          </>
                        )}
                      </span>
                    </div>
                  </label>
                )}

              </div>

              {/* Form submit footer */}
              <div className="p-4 border-t border-slate-100 flex gap-2 bg-slate-50 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-semibold rounded-xl text-xs shadow-md shadow-emerald-100/50"
                >
                  {isEditMode ? 'Simpan Perubahan' : 'Tambah Barang'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Custom Non-blocking Delete Confirmation Modal */}
      {deleteConf && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setDeleteConf(null)}
          />
          <div className="mt-24 sm:mt-32 mb-12 relative bg-white w-full max-w-sm rounded-2xl shadow-xl border border-slate-100 p-6 flex flex-col items-center text-center z-10 max-h-[85vh] sm:max-h-[80vh] overflow-y-auto">
            <div className="p-3 bg-rose-50 rounded-full text-rose-600 mb-3">
              <AlertCircle className="w-8 h-8 text-rose-500 animate-bounce" />
            </div>
            
            <h3 className="font-display font-black text-slate-800 text-sm sm:text-base uppercase tracking-wide">
              Hapus Barang Sembako?
            </h3>
            
            <p className="text-xs text-slate-505 leading-relaxed mt-2 font-medium">
              Apakah Anda yakin ingin menghapus barang <strong className="text-slate-800 text-indigo-600 font-bold font-mono">"{deleteConf.name}"</strong>? Data stok lama ini akan dihapus permanen dari database cloud Anda.
            </p>

            <div className="flex gap-2.5 w-full mt-5">
              <button
                type="button"
                onClick={() => setDeleteConf(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteProduct(deleteConf.productId);
                  setDeleteConf(null);
                }}
                className="flex-1 py-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 rounded-xl text-xs font-bold cursor-pointer items-center justify-center flex gap-1 shadow-md shadow-emerald-100/50 transition-all select-none active:scale-[0.98]"
              >
                <span>Hapus</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AUDIT LOG FLOW (Jendela Alur Aliran Barang & Dana) */}
      {auditDetails && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="mt-20 sm:mt-24 mb-12 bg-white rounded-3xl border border-slate-100 w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-105 flex items-center justify-between bg-indigo-50 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <span className="text-[9px] font-black text-indigo-650 uppercase tracking-widest block leading-none">LAPORAN MUTASI</span>
                  <h3 className="font-display font-black text-slate-800 text-xs mt-1">
                    {auditDetails.title}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setAuditDetails(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xs p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
              >
                Tutup
              </button>
            </div>

            {/* Audit Flow Workspace */}
            <div className="p-5 overflow-y-auto flex flex-col gap-6">
              
              {/* Visual Flow Diagram */}
              <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 flex flex-col items-center relative gap-4">
                
                {/* Flow Node 1: Capital / Cash Box */}
                <div className="bg-white border border-slate-200 shadow-xs rounded-xl p-3 w-full flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-amber-50 border border-amber-105 text-amber-600 rounded-lg">
                      <Coins className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block leading-none">KAS KELUAR / MODAL</span>
                      <span className="font-mono font-black text-slate-700 text-xs mt-1 block">
                        {auditDetails.totalCost > 0 ? formatRupiah(auditDetails.totalCost) : 'Rp 0'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-150 px-2 py-0.5 rounded-full">
                    {auditDetails.isExpenseRecorded ? 'Terpotong' : 'Fisik Saja'}
                  </span>
                </div>

                {/* Arrow Connector with Icon */}
                <div className="flex flex-col items-center justify-center -my-1 h-6">
                  <div className="w-0.5 h-full bg-indigo-200 border-dashed border-l border-indigo-400"></div>
                  <div className="bg-indigo-600 text-white p-1 rounded-full text-[9px] font-black absolute">
                    <ArrowRight className="w-3.5 h-3.5 rotate-90" />
                  </div>
                </div>

                {/* Flow Node 2: Goods Store persediaan */}
                <div className="bg-white border border-slate-200 shadow-xs rounded-xl p-3 w-full flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-50 border border-indigo-105 text-indigo-600 rounded-lg">
                      <Archive className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block leading-none">MUTASI FISIK BARANG</span>
                      <span className="font-sans font-black text-slate-800 text-xs mt-1 block truncate max-w-[200px]">
                        {auditDetails.productName}
                      </span>
                    </div>
                  </div>
                  <span className={`text-[10.5px] font-black font-mono px-2 py-0.5 rounded-full ${
                    auditDetails.diffStock > 0 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                      : auditDetails.diffStock < 0 
                        ? 'bg-rose-50 text-rose-700 border border-rose-150' 
                        : 'bg-slate-50 text-slate-500 border border-slate-150'
                  }`}>
                    {auditDetails.diffStock > 0 ? `+${auditDetails.diffStock}` : auditDetails.diffStock} {auditDetails.unit}
                  </span>
                </div>

              </div>

              {/* Detailed Breakdown */}
              <div className="flex flex-col gap-3">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest leading-none">RINCIAN ALUR & HISTORI</h4>
                
                <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 flex flex-col gap-2.5 text-xs text-slate-600">
                  <div className="flex justify-between items-center py-1">
                    <span className="font-bold text-slate-400">Nama Barang:</span>
                    <span className="font-extrabold text-slate-850 truncate max-w-[220px]">{auditDetails.productName}</span>
                  </div>
                  <div className="h-px bg-slate-155" />
                  <div className="flex justify-between items-center py-1">
                    <span className="font-bold text-slate-400">Harga Beli Rata-rata:</span>
                    <span className="font-mono font-bold text-slate-800">{formatRupiah(auditDetails.purchasePrice)} / {auditDetails.unit}</span>
                  </div>
                  <div className="h-px bg-slate-155" />
                  <div className="flex justify-between items-center py-1">
                    <span className="font-bold text-slate-400">Riwayat Stok Fisik:</span>
                    <span className="font-mono font-extrabold text-slate-800 flex items-center gap-1.5 font-bold">
                      <span>{auditDetails.previousStock}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="text-indigo-600">{auditDetails.currentStock}</span>
                      <span className="text-[10.5px] text-slate-500 font-medium">({auditDetails.diffStock > 0 ? `+${auditDetails.diffStock}` : auditDetails.diffStock} {auditDetails.unit})</span>
                    </span>
                  </div>
                  <div className="h-px bg-slate-155" />
                  <div className="flex justify-between items-start py-1 gap-2">
                    <span className="font-bold text-slate-400 shrink-0">Alokasi Kas Toko:</span>
                    <span className="font-mono font-black text-right text-slate-800">
                      {formatRupiah(auditDetails.totalCost)}
                      <span className="block text-[9px] font-sans font-bold text-slate-400 mt-0.5">
                        ({Math.abs(auditDetails.diffStock)} {auditDetails.unit} × {formatRupiah(auditDetails.purchasePrice)})
                      </span>
                    </span>
                  </div>
                </div>

                {/* Expense Ledger Status */}
                <div className={`p-4 rounded-2xl border flex items-start gap-2.5 ${
                  auditDetails.isExpenseRecorded
                    ? 'bg-emerald-50 text-emerald-850 border-emerald-100'
                    : 'bg-slate-50 border-slate-150 text-slate-500'
                }`}>
                  <div className={`p-1.5 rounded-lg mt-0.5 shrink-0 ${
                    auditDetails.isExpenseRecorded ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-left text-xs">
                    <span className={`font-display font-black leading-none block ${
                      auditDetails.isExpenseRecorded ? 'text-emerald-955 font-bold' : 'text-slate-705'
                    }`}>
                      {auditDetails.isExpenseRecorded ? 'Terintegrasi Kas Pengeluaran' : 'Hanya Penyesuaian Fisik'}
                    </span>
                    <span className="text-[10px] leading-relaxed font-semibold mt-1.5 block leading-normal text-slate-600">
                      {auditDetails.isExpenseRecorded ? (
                        <>
                          Anggaran otomatis tercatat sebagai beban <strong className="text-emerald-805 font-extrabold">"{auditDetails.expenseCategory}"</strong> dengan rincian nota: <span className="font-mono bg-emerald-100/40 px-1 rounded block mt-1 py-0.5 text-slate-650 font-bold">"{auditDetails.expenseNotes}"</span>
                        </>
                      ) : (
                        'Perubahan stok disesuaikan secara fisik tanpa memotong anggaran kas belanja aktif pada laporan keuangan laba rugi.'
                      )}
                    </span>
                  </div>
                </div>

              </div>

            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2">
              <button
                type="button"
                onClick={() => setAuditDetails(null)}
                className="flex-1 py-2.5 bg-indigo-650 hover:bg-indigo-705 active:scale-95 text-white font-black rounded-xl text-xs shadow-md shadow-indigo-100 transition-all cursor-pointer select-none text-center"
              >
                Selesai & Tutup Laporan
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
