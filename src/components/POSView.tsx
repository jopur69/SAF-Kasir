/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { Search, ShoppingCart, Trash2, Plus, Minus, Check, Printer, AlertTriangle, UserCheck, CreditCard, Wallet, QrCode } from 'lucide-react';
import { Product, CartItem, Transaction, PRODUCT_CATEGORIES, Debt } from '../types';
import { formatRupiah } from '../utils/format';

interface POSViewProps {
  products: Product[];
  debts: Debt[];
  onAddTransaction: (transaction: Transaction) => void;
  onModifyStock: (productId: string, quantityToDeduct: number) => void;
  onAddOrExtendDebt: (customerName: string, amount: number, notes: string) => void;
  activeStoreName?: string;
  currentUser?: any;
}

export default function POSView({
  products,
  debts,
  onAddTransaction,
  onModifyStock,
  onAddOrExtendDebt,
  activeStoreName,
  currentUser
}: POSViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Checkout Modal State
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Tunai' | 'QRIS' | 'Utang'>('Tunai');
  const [customerName, setCustomerName] = useState('');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [activeDebtSelected, setActiveDebtSelected] = useState<string>('');

  // Receipt Modal State
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  // Barcode State
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);

  const handleSimulateScan = (barcodeStr: string) => {
    const foundProduct = products.find(p => p.barcode === barcodeStr);
    if (foundProduct) {
      if (foundProduct.stock > 0) {
        addToCart(foundProduct);
      } else {
        alert(`Gagal! Stok ${foundProduct.name} sedang habis.`);
      }
    } else {
      alert(`Barcode "${barcodeStr}" tidak ditemukan di database.`);
    }
  };

  // Filter products based on search and category
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.barcode && p.barcode.includes(searchQuery));
      const matchCategory = selectedCategory === 'Semua' || p.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        // Prevent adding more than available stock
        const nextQty = existing.quantity + 1;
        if (nextQty > product.stock) return prev;
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: nextQty } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          const targetProduct = products.find(p => p.id === productId);
          if (!targetProduct) return item;
          if (newQty <= 0) return null;
          if (newQty > targetProduct.stock) return item; // limit
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const clearCart = () => setCart([]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.product.sellPrice * item.quantity), 0);
  }, [cart]);

  const cartTotalProfit = useMemo(() => {
    return cart.reduce((sum, item) => {
      const profitPerItem = item.product.sellPrice - item.product.purchasePrice;
      return sum + (profitPerItem * item.quantity);
    }, 0);
  }, [cart]);

  // Initiate checkout
  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    setPayAmount(cartTotal);
    setPaymentMethod('Tunai');
    setCustomerName('');
    setActiveDebtSelected('');
    setShowCheckoutModal(true);
  };

  const changeDue = useMemo(() => {
    if (paymentMethod === 'Utang') return 0;
    const diff = payAmount - cartTotal;
    return diff > 0 ? diff : 0;
  }, [payAmount, cartTotal, paymentMethod]);

  const isCheckoutValid = useMemo(() => {
    if (paymentMethod === 'Utang') {
      const selectedOrTypedName = activeDebtSelected === 'new' || activeDebtSelected === '' ? customerName.trim() : activeDebtSelected;
      return selectedOrTypedName.length > 0;
    }
    return payAmount >= cartTotal;
  }, [payAmount, cartTotal, paymentMethod, customerName, activeDebtSelected]);

  // Handle final purchase completion
  const handleCompleteTransaction = () => {
    if (!isCheckoutValid) return;

    let finalCustomerName = '';
    if (paymentMethod === 'Utang') {
      finalCustomerName = activeDebtSelected === 'new' || activeDebtSelected === '' ? customerName.trim() : activeDebtSelected;
    } else {
      finalCustomerName = customerName.trim() || 'Pelanggan Umum';
    }

    const txItems = cart.map(item => ({
      productId: item.product.id,
      name: item.product.name,
      quantity: item.quantity,
      sellPrice: item.product.sellPrice,
      purchasePrice: item.product.purchasePrice,
      unit: item.product.unit
    }));

    const nextTx: Transaction = {
      id: `tx-${Date.now()}`,
      date: new Date().toISOString(),
      items: txItems,
      totalBill: cartTotal,
      paidAmount: paymentMethod === 'Utang' ? 0 : payAmount,
      changeAmount: paymentMethod === 'Utang' ? 0 : changeDue,
      profit: cartTotalProfit,
      paymentMethod,
      customerName: finalCustomerName
    };

    // 1. Deduct stock from state in parent
    cart.forEach(item => {
      onModifyStock(item.product.id, item.quantity);
    });

    // 2. If it is high-debt (Utang), register the customer debt
    if (paymentMethod === 'Utang') {
      onAddOrExtendDebt(
        finalCustomerName,
        cartTotal,
        `Belanja sembako: ${cart.map(i => `${i.product.name} (${i.quantity}x)`).join(', ')}`
      );
    }

    // 3. Add transaction
    onAddTransaction(nextTx);

    // 4. Save to show receipt
    setLastTransaction(nextTx);
    setCart([]);
    setShowCheckoutModal(false);
    setShowReceiptModal(true);
  };

  const handleQuickPay = (amount: number) => {
    setPayAmount(amount);
  };

  const handlePrintReceipt = () => {
    setIsPrinting(true);
    
    // Play hardware-like print-confirmation beep
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const audioCtx = new AudioContextClass();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1100, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
      }
    } catch (e) {
      // Safe fallback if audio context is blocked
    }

    window.print();
    
    setTimeout(() => {
      setIsPrinting(false);
    }, 1200);
  };

  return (
    <div id="pos-view-container" className="animate-fade-in max-w-5xl mx-auto flex flex-col gap-6">
      
      {/* Upper Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-slate-800 text-sm">Kasir (POS) Digital</h2>
            <p className="text-[10px] text-slate-500 font-medium">Kelola antrean transaksi kasir sembako secara instan</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto self-stretch sm:self-auto">
          <button
            onClick={() => setShowAddProductModal(true)}
            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-100/40 transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Barang</span>
          </button>
        </div>
      </div>

      {/* Main Cart Workspace */}
      <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-indigo-650" />
            <span className="font-display font-bold text-slate-800 text-sm">Daftar Belanjaan Aktif (Keranjang)</span>
            <span className="bg-indigo-100 text-indigo-800 font-mono text-xs font-bold px-2 py-0.5 rounded-full">
              {cart.reduce((sum, item) => sum + item.quantity, 0)} item
            </span>
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="p-1 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Kosongkan</span>
            </button>
          )}
        </div>

        {/* Dynamic Cart Table Content */}
        {cart.length > 0 ? (
          <div className="flex flex-col">
            
            {/* 1. DESKTOP/TABLET TABLE LAYOUT (Hidden on Mobile) */}
            <div className="hidden md:block overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50/40 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-5 text-center w-12">No</th>
                    <th className="py-3 px-4">Nama Sembako</th>
                    <th className="py-3 px-4 text-right">Harga Satuan</th>
                    <th className="py-3 px-4 text-center w-40">Jumlah</th>
                    <th className="py-3 px-4 text-right">Subtotal</th>
                    <th className="py-3 px-4 text-center w-36">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/70">
                  {cart.map((item, index) => (
                    <tr key={item.product.id} className="hover:bg-indigo-50/10 transition-colors text-xs font-semibold text-slate-700">
                      <td className="py-3.5 px-5 text-center text-slate-400 font-mono">
                        {index + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col pr-2">
                          <span className="font-bold text-slate-800 leading-tight">{item.product.name}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-extrabold text-indigo-700 uppercase tracking-wider bg-indigo-50 px-1.5 py-0.5 rounded-md">
                              {item.product.category.split(' ')[0]}
                            </span>
                            {item.product.barcode && (
                              <span className="text-[9px] text-slate-400 font-mono font-medium">
                                Barcode: {item.product.barcode}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                        {formatRupiah(item.product.sellPrice)}
                        <span className="text-[10px] text-slate-405 block font-sans font-medium">
                          /{item.product.unit}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {/* Quantity display with Minus and Plus controls */}
                        <div className="flex items-center justify-center gap-1.5 bg-white border border-slate-205 rounded-xl p-1 max-w-[110px] mx-auto shadow-2xs">
                          <button
                            onClick={() => updateCartQuantity(item.product.id, -1)}
                            className="p-1 bg-slate-5/80 hover:bg-slate-100 text-slate-500 border border-slate-205 rounded-lg transition-colors cursor-pointer"
                            title="Kurangi jumlah"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            value={item.quantity === 0 ? '' : item.quantity}
                            onChange={(e) => {
                              const val = e.target.value;
                              const parsed = val === '' ? 0 : parseInt(val, 10);
                              const targetProduct = products.find(p => p.id === item.product.id);
                              if (!targetProduct) return;
                              
                              setCart(prev => prev.map(c => {
                                if (c.product.id === item.product.id) {
                                  if (isNaN(parsed) || parsed < 0) {
                                    return { ...c, quantity: 0 };
                                  }
                                  const finalVal = Math.min(parsed, targetProduct.stock);
                                  return { ...c, quantity: finalVal };
                                }
                                return c;
                              }));
                            }}
                            onBlur={() => {
                              if (item.quantity <= 0) {
                                setCart(prev => prev.map(c => {
                                  if (c.product.id === item.product.id) {
                                    return { ...c, quantity: 1 };
                                  }
                                  return c;
                                }));
                              }
                            }}
                            min="1"
                            max={item.product.stock}
                            className="font-mono text-xs font-black w-10 text-center text-slate-800 bg-slate-50 border border-slate-200 rounded py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            onClick={() => updateCartQuantity(item.product.id, 1)}
                            disabled={item.quantity >= item.product.stock}
                            className="p-1 bg-slate-5/80 hover:bg-indigo-50 text-slate-500 hover:text-indigo-750 border border-slate-205 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                            title="Tambah jumlah"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {formatRupiah(item.product.sellPrice * item.quantity)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-650 hover:text-rose-700 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-[10px] font-bold mx-auto border border-rose-100/60"
                          title="Hapus barang dari keranjang"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>Hapus</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50/60 font-semibold text-slate-800 border-t-2 border-slate-200">
                    <td colSpan={2} className="py-4 px-5 text-left text-xs text-slate-500">
                      <div className="flex gap-4">
                        <span>Total Jenis: <strong className="text-slate-700">{cart.length} barang</strong></span>
                        <span>Total Kuantitas: <strong className="text-slate-700">{cart.reduce((sum, item) => sum + item.quantity, 0)} Pcs</strong></span>
                      </div>
                    </td>
                    <td colSpan={2} className="py-4 px-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Total Belanja (Subtotal):
                    </td>
                    <td className="py-4 px-4 text-right text-indigo-700 font-mono text-base font-black bg-indigo-50/30">
                      {formatRupiah(cartTotal)}
                    </td>
                    <td className="py-4 px-4"></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 2. SMARTPHONE/MOBILE HYBRID CARD LAYOUT (Shown only on Mobile) */}
            <div className="md:hidden flex flex-col divide-y divide-slate-100/80 max-h-[60vh] overflow-y-auto">
              {cart.map((item, index) => {
                return (
                  <div key={item.product.id} className="p-4 bg-white flex flex-col gap-3">
                    
                    {/* Upper row: No, Name and deletion option */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="bg-slate-100 text-slate-500 text-[9px] font-mono px-1.5 py-0.5 rounded">
                            #{index + 1}
                          </span>
                          <span className="bg-indigo-55 text-indigo-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-wide uppercase">
                            {item.product.category.split(' ')[0]}
                          </span>
                          {item.product.barcode && (
                            <span className="text-[9px] text-slate-400 font-mono font-medium">
                              [{item.product.barcode}]
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-slate-800 text-xs mt-1.5 leading-snug break-words">
                          {item.product.name}
                        </h4>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all cursor-pointer shrink-0"
                        title="Hapus barang"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Lower row: Details, Quantities & pricing */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100/70">
                      
                      {/* Price information */}
                      <div className="flex flex-col">
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Harga</span>
                        <span className="text-xs font-mono font-bold text-slate-700">
                          {formatRupiah(item.product.sellPrice)}
                          <span className="text-[10px] text-slate-400 font-sans font-medium">/{item.product.unit}</span>
                        </span>
                      </div>

                      {/* Tap controls with typeable input */}
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] text-slate-400 font-bold mb-0.5 uppercase tracking-wider">Qty</span>
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1 shadow-2xs">
                          <button
                            onClick={() => updateCartQuantity(item.product.id, -1)}
                            className="p-1 px-1.5 bg-white hover:bg-slate-100 text-slate-500 border border-slate-205 rounded-lg transition-colors cursor-pointer"
                            title="Kurangi jumlah"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <input
                            type="number"
                            value={item.quantity === 0 ? '' : item.quantity}
                            onChange={(e) => {
                              const val = e.target.value;
                              const parsed = val === '' ? 0 : parseInt(val, 10);
                              const targetProduct = products.find(p => p.id === item.product.id);
                              if (!targetProduct) return;
                              
                              setCart(prev => prev.map(c => {
                                if (c.product.id === item.product.id) {
                                  if (isNaN(parsed) || parsed < 0) {
                                    return { ...c, quantity: 0 };
                                  }
                                  const finalVal = Math.min(parsed, targetProduct.stock);
                                  return { ...c, quantity: finalVal };
                                }
                                return c;
                              }));
                            }}
                            onBlur={() => {
                              if (item.quantity <= 0) {
                                setCart(prev => prev.map(c => {
                                  if (c.product.id === item.product.id) {
                                    return { ...c, quantity: 1 };
                                  }
                                  return c;
                                }));
                              }
                            }}
                            min="1"
                            max={item.product.stock}
                            className="font-mono text-xs font-black w-8 text-center text-slate-800 bg-white border border-slate-200 rounded py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            onClick={() => updateCartQuantity(item.product.id, 1)}
                            disabled={item.quantity >= item.product.stock}
                            className="p-1 px-1.5 bg-white hover:bg-slate-105 text-slate-500 border border-slate-205 rounded-lg transition-colors cursor-pointer disabled:opacity-45"
                            title="Tambah jumlah"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>

                      {/* Individual Subtotal */}
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Subtotal</span>
                        <span className="text-xs font-mono font-bold text-indigo-700">
                          {formatRupiah(item.product.sellPrice * item.quantity)}
                        </span>
                      </div>

                    </div>

                  </div>
                );
              })}
            </div>

            {/* Sticky Mobile Summary area on smartphones */}
            <div className="md:hidden p-4 bg-slate-50 border-t border-slate-150 flex flex-col gap-2.5">
              <div className="flex justify-between items-center text-xs text-slate-500 font-bold">
                <span>Rincian Keranjang</span>
                <span>{cart.length} Jenis • {cart.reduce((sum, item) => sum + item.quantity, 0)} Pcs</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-200/60 pt-2">
                <span className="text-xs font-bold text-slate-700">Total Belanja:</span>
                <span className="text-xl font-display font-black text-indigo-700 font-mono">{formatRupiah(cartTotal)}</span>
              </div>
              <button
                onClick={handleOpenCheckout}
                className="w-full mt-1.5 py-3 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-bold rounded-2xl shadow-md shadow-emerald-100/50 transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Bayar Sekarang ({formatRupiah(cartTotal)})</span>
              </button>
            </div>

            {/* Actions Bar Directly Below Table (Desktop Mode Only) */}
            <div className="hidden md:flex p-4 bg-slate-50/50 border-t border-slate-100 flex-row justify-between items-center gap-3">
              <span className="text-[10px] text-slate-400 font-semibold tracking-wide flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Metode pembayaran tunai, QRIS, & kasbon didukung di langkah berikutnya.
              </span>
              <button
                onClick={handleOpenCheckout}
                className="w-full sm:w-auto px-7 py-3 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-bold rounded-2xl shadow-md shadow-emerald-100/50 transition-all flex items-center justify-center gap-2 text-xs cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
              >
                <Check className="w-4.5 h-4.5" />
                <span>Lanjut Bayar Sekarang ({formatRupiah(cartTotal)})</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-20 bg-white p-5">
            <div className="p-5 bg-indigo-50 text-indigo-650 rounded-full mb-4 animate-bounce">
              <ShoppingCart className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-slate-705">Keranjang Belanja Masih Kosong</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">
              Belum ada sembako yang ditambahkan. Ketuk tombol di bawah untuk memilih sembako yang dibeli pelanggan.
            </p>
            <div className="mt-6">
              <button
                onClick={() => setShowAddProductModal(true)}
                className="px-6 py-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-extrabold rounded-xl text-xs shadow-md shadow-emerald-100/50 transition-all cursor-pointer"
              >
                + Pilih Sembako Sekarang
              </button>
            </div>
          </div>
        )}

      </div>

      {/* POPUP MODAL: DATA BARANG (TAMBAH BARANG) */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="mt-24 sm:mt-32 mb-12 bg-white rounded-3xl border border-slate-100 w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[80vh]">
            
            {/* Modal Header */}
            <div className="p-3.5 px-4 border-b border-slate-150/60 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-xs shrink-0">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-slate-800 text-xs sm:text-sm leading-tight">Pilih Sembako untuk Keranjang</h2>
                  <p className="text-[9px] text-slate-500 font-bold leading-none mt-0.5">Ketuk barang sembako di bawah untuk dimasukkan ke daftar belanjaan</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddProductModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-[10px] p-1.5 px-2 bg-slate-150/40 hover:bg-slate-200/60 rounded-lg transition-all"
              >
                Tutup
              </button>
            </div>

            {/* Modal Search & Filters */}
            <div className="p-2.5 bg-white border-b border-slate-100 flex flex-row gap-2.5 items-center shrink-0">
              <div className="relative flex-1 text-xs">
                <Search className="absolute left-3 top-2.5 text-slate-400 w-3.5 h-3.5" />
                <input
                  type="text"
                  placeholder="Cari nama atau barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8.5 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-850 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-[11px]"
                  autoFocus
                />
              </div>
            </div>

            {/* Category tabs */}
            <div className="px-3 py-1.5 bg-slate-50/55 border-b border-slate-100 flex gap-1 overflow-x-auto scrollbar-none shrink-0">
              <button
                onClick={() => setSelectedCategory('Semua')}
                className={`px-2 py-1 rounded-md text-[9px] font-extrabold whitespace-nowrap transition-all ${
                  selectedCategory === 'Semua'
                    ? 'bg-emerald-400 text-emerald-950'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/50 shadow-2xs'
                }`}
              >
                Semua ({products.length})
              </button>
              {PRODUCT_CATEGORIES.map(category => {
                const count = products.filter(p => p.category === category).length;
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-2 py-1 rounded-md text-[9px] font-extrabold whitespace-nowrap transition-all ${
                      selectedCategory === category
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/50 shadow-2xs'
                    }`}
                  >
                    {category.split(' ')[0]} ({count})
                  </button>
                );
              })}
            </div>

            {/* Products List Grid inside modal */}
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50/20">
              {filteredProducts.map(product => {
                const isOutOfStock = product.stock <= 0;
                const isLowStock = product.stock <= product.minStock && product.stock > 0;
                const itemInCart = cart.find(c => c.product.id === product.id);
                const qtyInCart = itemInCart ? itemInCart.quantity : 0;
                const remainingStock = product.stock - qtyInCart;

                return (
                  <div
                    key={product.id}
                    onClick={() => {
                      if (remainingStock > 0) {
                        addToCart(product);
                        setShowAddProductModal(false);
                      }
                    }}
                    className={`group bg-white rounded-xl p-2.5 border transition-all duration-150 flex flex-col justify-between cursor-pointer select-none relative h-28 ${
                      isOutOfStock 
                        ? 'opacity-60 border-slate-250 bg-slate-100/40 cursor-not-allowed' 
                        : remainingStock <= 0
                        ? 'border-indigo-200 bg-indigo-50/10'
                        : 'border-slate-150/70 hover:border-indigo-300 hover:shadow-2xs active:scale-[0.98]'
                    }`}
                  >
                    {/* Active Cart Qty Badge */}
                    {qtyInCart > 0 && (
                      <div className="absolute top-1.5 right-1.5 bg-indigo-600 text-white font-mono text-[8px] font-black px-1.5 py-0.5 rounded ml-1 tracking-wide shadow-2xs z-10">
                        {qtyInCart} pc
                      </div>
                    )}

                    <div>
                      <span className="text-[8px] font-black text-indigo-500 tracking-wider block uppercase mb-0.5">
                        {product.category.split(' ')[0]}
                      </span>
                      <h3 className="font-bold text-slate-800 text-[11px] leading-tight line-clamp-2 group-hover:text-indigo-600 transition-colors">
                        {product.name}
                      </h3>
                      <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
                        {product.unit.split(' ')[0]} {product.barcode ? `• #${product.barcode}` : ''}
                      </span>
                    </div>

                    <div className="mt-1 text-[9px] font-bold">
                      <div className="flex items-center justify-between mb-1 leading-none">
                        <span className="text-slate-400 font-medium">Stok:</span>
                        {isOutOfStock ? (
                          <span className="text-rose-600">Habis</span>
                        ) : remainingStock <= 0 ? (
                          <span className="text-indigo-600 font-semibold text-[8px] uppercase">Penuh</span>
                        ) : isLowStock ? (
                          <span className="text-amber-600">{product.stock} pcs</span>
                        ) : (
                          <span className="text-slate-650 font-mono font-medium">{product.stock}</span>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 leading-none">
                        <span className="text-[11px] font-black text-indigo-750 font-mono">
                          {formatRupiah(product.sellPrice)}
                        </span>

                        {remainingStock > 0 && (
                          <span className="py-0.5 px-1.5 bg-indigo-50 text-indigo-750 group-hover:bg-indigo-600 group-hover:text-white rounded text-[8px] font-extrabold transition-all leading-none">
                            + Pilih
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredProducts.length === 0 && (
                <div className="col-span-full bg-white border border-dashed border-slate-200 rounded-2xl py-10 px-4 text-center">
                  <AlertTriangle className="w-8 h-8 text-slate-350 mx-auto mb-1.5" />
                  <p className="text-xs font-bold text-slate-600">Barang sembako tidak ditemukan</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Silakan ketik nama barang lain atau periksa filter Kategori</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-end items-center shrink-0">
              <button
                onClick={() => setShowAddProductModal(false)}
                className="px-4 py-1.5 bg-slate-200/80 hover:bg-slate-300/80 text-slate-700 font-bold rounded-xl text-[11px] transition-colors cursor-pointer"
              >
                Kembali ke Keranjang
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: CHECKOUT & PAYMENT METHOD */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="mt-24 sm:mt-32 mb-12 bg-white rounded-3xl border border-slate-100 w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[80vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <h2 className="font-display font-bold text-lg text-slate-800">Proses Pembayaran</h2>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="text-slate-400 hover:text-slate-600 font-semibold text-sm"
              >
                Batal
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-4">
              
              {/* Total Bill Display */}
              <div className="bg-indigo-600 rounded-2xl p-4 text-white text-center">
                <p className="text-xs text-indigo-150 font-semibold mb-1">TOTAL HARUS DIBAYAR</p>
                <p className="font-display font-bold text-2xl font-mono">{formatRupiah(cartTotal)}</p>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Metode Pembayaran</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => { setPaymentMethod('Tunai'); setPayAmount(cartTotal); }}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 font-semibold text-xs transition-all ${
                      paymentMethod === 'Tunai'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Wallet className="w-5 h-5 text-emerald-650" />
                    <span>Uang Tunai</span>
                  </button>

                  <button
                    onClick={() => { setPaymentMethod('QRIS'); setPayAmount(cartTotal); }}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 font-semibold text-xs transition-all ${
                      paymentMethod === 'QRIS'
                        ? 'bg-blue-50 border-blue-500 text-blue-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <QrCode className="w-5 h-5 text-blue-600" />
                    <span>QRIS (E-Wallet)</span>
                  </button>

                  <button
                    onClick={() => { setPaymentMethod('Utang'); setPayAmount(0); }}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 font-semibold text-xs transition-all ${
                      paymentMethod === 'Utang'
                        ? 'bg-rose-50 border-rose-500 text-rose-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <UserCheck className="w-5 h-5 text-rose-600" />
                    <span>Buku Utang</span>
                  </button>
                </div>
              </div>

              {/* Action based on method */}
              {paymentMethod === 'Tunai' && (
                <div className="flex flex-col gap-3">
                  
                  {/* Paid Cash Input */}
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Jumlah Uang Diterima (Rp)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={payAmount === 0 ? '' : new Intl.NumberFormat('id-ID').format(payAmount)}
                      onChange={(e) => {
                        const cleanVal = e.target.value.replace(/\D/g, '');
                        const numericVal = cleanVal ? parseInt(cleanVal, 10) : 0;
                        setPayAmount(numericVal);
                      }}
                      placeholder="Masukkan nilai uang..."
                      className="w-full text-lg font-mono font-bold px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  {/* Quick Payment Buttons */}
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => handleQuickPay(cartTotal)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all"
                    >
                      Uang Pas
                    </button>
                    {[10000, 20000, 50000, 100000].map(amount => (
                      amount >= cartTotal && (
                        <button
                          key={amount}
                          onClick={() => handleQuickPay(amount)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-cyan-50 hover:text-cyan-800 border border-transparent hover:border-cyan-200 text-slate-700 rounded-lg text-xs font-mono font-bold transition-all"
                        >
                          {formatRupiah(amount)}
                        </button>
                      )
                    ))}
                  </div>

                  {/* Change Calculation */}
                  <div className="bg-emerald-55/40 rounded-xl p-3 flex items-center justify-between border border-emerald-100/30">
                    <span className="text-xs font-semibold text-emerald-805">Uang Kembali:</span>
                    <span className="font-mono text-lg font-bold text-emerald-800">
                      {formatRupiah(changeDue)}
                    </span>
                  </div>

                  {/* Optional Buyer Name */}
                  <div>
                    <label className="text-xs font-bold text-slate-400 tag block mb-1">Nama Pembeli (Opsional)</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Bu Joko, Mas Budi..."
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-505/20 focus:border-indigo-500 text-xs"
                    />
                  </div>

                </div>
              )}

              {paymentMethod === 'QRIS' && (
                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-150 text-center gap-3">
                  <div className="w-40 h-40 bg-white border border-slate-200 p-2.5 rounded-xl flex items-center justify-center relative shadow-sm">
                    {currentUser?.qrisImage ? (
                      <img
                        src={currentUser.qrisImage}
                        alt="Kode QRIS Toko"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain rounded"
                      />
                    ) : currentUser?.qrisData ? (
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(currentUser.qrisData)}`}
                        alt="Sandi QRIS Otomatis"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-50 rounded-md flex flex-col items-center justify-center p-2 border border-dashed border-slate-300">
                        <QrCode className="w-12 h-12 text-slate-400 mb-1" />
                        <span className="text-[10px] font-mono font-black text-slate-500">QRIS DINAMIS</span>
                        <span className="text-[8px] text-indigo-650 font-bold tracking-tight text-center">Belum diatur di Pengaturan (Mockup)</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-700">Tampilkan Kode QR Ini ke Pembeli</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Setelah pembeli selesai memindai dan transfer berhasil, klik tombol di bawah.</p>
                  </div>
                </div>
              )}

              {paymentMethod === 'Utang' && (
                <div className="flex flex-col gap-3 bg-rose-50/20 border border-rose-100/60 p-4 rounded-2xl">
                  
                  {/* Select Customer Profile or Add New */}
                  <div>
                    <label className="text-xs font-bold text-rose-800 uppercase tracking-wider block mb-2">Pilih Akun Buku Utang</label>
                    <select
                      value={activeDebtSelected}
                      onChange={(e) => {
                        setActiveDebtSelected(e.target.value);
                        if (e.target.value !== 'new' && e.target.value !== '') {
                          setCustomerName('');
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-750 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-sm mb-3"
                    >
                      <option value="">-- Pilih Pembeli Berutang Langganan --</option>
                      {debts.map(debt => (
                        <option key={debt.id} value={debt.customerName}>
                          {debt.customerName} (Sisa tagihan: {formatRupiah(debt.remainingDebt)})
                        </option>
                      ))}
                      <option value="new">+ Tambah Nama Baru</option>
                    </select>
                  </div>

                  {/* Manual input if 'new' or no customer profile selected */}
                  {(activeDebtSelected === 'new' || activeDebtSelected === '') && (
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1.5">Nama Pembeli Baru (Wajib)</label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Ketik nama lengkap pembeli..."
                        className="w-full px-4 py-2 bg-white border border-slate-250 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                      />
                    </div>
                  )}

                  <div className="mt-2 text-rose-800 text-[11px] bg-rose-50 p-2.5 rounded-lg flex items-start gap-1.5 leading-relaxed">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>Catatan: Transaksi ini akan tercatat sebagai **piutang** di Buku Utang secara otomatis dengan masa jatuh tempo atau total saldo yang bertambah.</span>
                  </div>

                </div>
              )}

            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2 shrink-0">
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
              >
                Kembali
              </button>
              <button
                onClick={handleCompleteTransaction}
                disabled={!isCheckoutValid}
                className={`flex-1 py-2.5 font-semibold rounded-xl text-xs transition-colors ${
                  paymentMethod === 'Utang'
                    ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-950 disabled:bg-slate-300 shadow-md shadow-emerald-50'
                    : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-950 disabled:bg-slate-300 shadow-md shadow-emerald-50'
                }`}
              >
                Konfirmasi Transaksi
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: PRINT THERMAL RECEIPT PREVIEW (STRUK BELANJA) */}
      {showReceiptModal && lastTransaction && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-start justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="mt-24 sm:mt-32 mb-12 bg-white rounded-3xl border border-slate-100 w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[80vh]">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <span className="font-display font-bold text-sm text-slate-700 flex items-center gap-1.5">
                <Printer className="w-4 h-4 text-emerald-600" />
                <span>Transaksi Sukses!</span>
              </span>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                Tutup
              </button>
            </div>

            {/* Receipt Content - styled like local cash receipt */}
            <div className="p-6 bg-slate-50 flex-1 overflow-y-auto flex justify-center">
              <div id="receipt-thermal" className="bg-white p-5 border border-slate-200 shadow-sm w-full font-mono text-xs text-slate-800 leading-normal max-w-[280px]">
                
                <div className="text-center mb-4">
                  <h3 className="font-bold text-[13px] uppercase tracking-wide text-indigo-950 font-mono">{activeStoreName || "KASIR"}</h3>
                  <p className="text-[9.5px] text-slate-500 leading-tight">Sistem Kasir Digital Portable</p>
                  <p className="text-[9.5px] text-slate-400">Bukti Struk Pembelian Sembako Sah</p>
                  <div className="border-b border-dashed border-slate-300 my-2"></div>
                </div>

                {/* Meta details */}
                <div className="flex flex-col gap-0.5 text-[10px] mb-3 text-slate-600">
                  <div className="flex justify-between">
                    <span>ID Transaksi:</span>
                    <span className="text-slate-800 font-bold">{lastTransaction.id.substring(3, 11)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tgl:</span>
                    <span>{new Date(lastTransaction.date).toLocaleDateString('id-ID')} {new Date(lastTransaction.date).toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Metode:</span>
                    <span className="font-semibold">{lastTransaction.paymentMethod}</span>
                  </div>
                  {lastTransaction.customerName && (
                    <div className="flex justify-between">
                      <span>Plg:</span>
                      <span className="text-indigo-650 font-bold uppercase">{lastTransaction.customerName}</span>
                    </div>
                  )}
                </div>

                <div className="border-b border-dashed border-slate-300 my-2"></div>

                {/* Items list */}
                <div className="flex flex-col gap-2 my-2">
                  {lastTransaction.items.map((item, idx) => (
                    <div key={idx} className="flex flex-col">
                      <span className="text-slate-800 truncate">{item.name}</span>
                      <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                        <span>{item.quantity} x {formatRupiah(item.sellPrice)}</span>
                        <span className="font-bold text-slate-800 font-mono">{formatRupiah(item.quantity * item.sellPrice)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-b border-dashed border-slate-300 my-2"></div>

                {/* Calculations */}
                <div className="flex flex-col gap-1 text-slate-800 font-bold my-2">
                  <div className="flex justify-between">
                    <span>TOTAL:</span>
                    <span className="font-mono">{formatRupiah(lastTransaction.totalBill)}</span>
                  </div>
                  {lastTransaction.paymentMethod !== 'Utang' ? (
                    <>
                      <div className="flex justify-between font-normal text-slate-505 text-[10.5px]">
                        <span>DIBAYAR:</span>
                        <span className="font-mono">{formatRupiah(lastTransaction.paidAmount)}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span>KEMBALI:</span>
                        <span className="font-mono text-emerald-800">{formatRupiah(lastTransaction.changeAmount)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-rose-800 text-[10px] text-center bg-rose-50 p-1.5 rounded-md mt-1 font-bold">
                      TAGIHAN BUKU UTANG SISA
                    </div>
                  )}
                </div>

                <div className="border-b border-dashed border-slate-300 my-3"></div>

                <div className="text-center text-[9px] text-slate-400 leading-tight">
                  <p>Terima Kasih Atas Kunjungan Anda!</p>
                  <p className="mt-1 font-bold">Layanan Digital POS</p>
                </div>

              </div>
            </div>

             {/* Print action simulate buttons */}
             <div className="p-3 border-t border-slate-100 bg-slate-50 flex gap-2 shrink-0">
                <button
                  onClick={handlePrintReceipt}
                  disabled={isPrinting}
                  className={`flex-[1.5] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm select-none active:scale-[0.96] cursor-pointer ${
                    isPrinting 
                      ? 'bg-slate-400 text-white cursor-not-allowed' 
                      : 'bg-emerald-100 hover:bg-emerald-200 active:bg-emerald-300 text-emerald-950 shadow-md shadow-emerald-50'
                  }`}
                >
                  <Printer className={`w-3.5 h-3.5 ${isPrinting ? 'animate-bounce' : ''}`} />
                  <span>{isPrinting ? 'Mencetak...' : 'Cetak Struk'}</span>
                </button>
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="flex-1 py-2 px-3 bg-emerald-100 hover:bg-emerald-200 active:bg-emerald-300 text-emerald-950 font-bold rounded-xl text-xs transition-colors shadow-md shadow-emerald-50 flex items-center justify-center select-none cursor-pointer"
                >
                  Selesai
                </button>
              </div>

          </div>
        </div>
      )}
    </div>
  );
}
