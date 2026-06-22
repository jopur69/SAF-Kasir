/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown,
  AlertTriangle, 
  BookOpen, 
  ArrowUpRight, 
  ChevronRight, 
  Users, 
  Package, 
  CheckCircle2, 
  DollarSign,
  Activity,
  ShieldAlert,
  Info,
  X,
  Download,
  Upload
} from 'lucide-react';
import { Product, Debt, Transaction, Expense } from '../types';
import { formatRupiah } from '../utils/format';
import { RegisteredUser } from './LoginPortal';
import QuickPollWidget from './QuickPollWidget';

interface SummaryViewProps {
  products: Product[];
  debts: Debt[];
  transactions: Transaction[];
  expenses?: Expense[];
  setActiveTab: (tab: string) => void;
  totalSalesToday: number;
  totalProfitToday: number;
  lowStockCount: number;
  totalDebtAmount: number;
  currentUser?: RegisteredUser;
}

export default function SummaryView({
  products,
  debts,
  transactions,
  expenses = [],
  setActiveTab,
  totalSalesToday,
  totalProfitToday,
  lowStockCount,
  totalDebtAmount,
  currentUser
}: SummaryViewProps) {
  const [showDisclaimer, setShowDisclaimer] = useState<boolean>(() => {
    return localStorage.getItem('kasir_hide_disclaimer_banner') !== 'true';
  });
  const [showModal, setShowModal] = useState<boolean>(false);
  
  // Custom period selection states
  const [period, setPeriod] = useState<'1-day' | '1-week' | '1-month' | '1-year' | 'custom'>('1-day');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const handleDismissBanner = () => {
    setShowDisclaimer(false);
    localStorage.setItem('kasir_hide_disclaimer_banner', 'true');
  };

  const handleShowBanner = () => {
    setShowDisclaimer(true);
    localStorage.removeItem('kasir_hide_disclaimer_banner');
  };

  // Helper to format date in Indonesian local format
  const formatDateLabel = (date: Date) => {
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Calculate dynamic date range based on selected period
  const getFilterRange = () => {
    const now = new Date();
    const start = new Date();
    const end = new Date();

    switch (period) {
      case '1-day':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case '1-week':
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case '1-month':
        start.setMonth(now.getMonth() - 1);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case '1-year':
        start.setFullYear(now.getFullYear() - 1);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'custom':
        const customStart = new Date(customStartDate || now.toISOString().split('T')[0]);
        customStart.setHours(0, 0, 0, 0);
        const customEnd = new Date(customEndDate || now.toISOString().split('T')[0]);
        customEnd.setHours(23, 59, 59, 999);
        return { start: customStart, end: customEnd };
    }
    return { start, end };
  };

  const { start: filterStart, end: filterEnd } = getFilterRange();

  // Filter transactions & expenses based on active selection
  const filteredTransactions = transactions.filter(tx => {
    const txDate = new Date(tx.date);
    return txDate >= filterStart && txDate <= filterEnd;
  });

  const filteredExpenses = expenses.filter(exp => {
    const expDate = new Date(exp.date);
    return expDate >= filterStart && expDate <= filterEnd;
  });

  const periodSales = filteredTransactions.reduce((sum, tx) => sum + tx.totalBill, 0);
  const periodProfitKotor = filteredTransactions.reduce((sum, tx) => sum + tx.profit, 0);
  const periodExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const periodProfitBersih = periodProfitKotor - periodExpenses;

  // Calculate real-time Expense figures
  const todayStr = new Date().toDateString();
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const totalExpensesToday = expenses.reduce((sum, exp) => {
    return new Date(exp.date).toDateString() === todayStr ? sum + exp.amount : sum;
  }, 0);

  const totalExpensesThisMonth = expenses.reduce((sum, exp) => {
    const expDate = new Date(exp.date);
    return (expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear) ? sum + exp.amount : sum;
  }, 0);
  
  // Get active items
  const lowStockProducts = products.filter(p => p.stock <= p.minStock);
  const activeDebts = debts.filter(d => d.remainingDebt > 0).sort((a, b) => b.remainingDebt - a.remainingDebt);
  const recentTransactions = transactions.slice(0, 3);

  const periodOptions = [
    { value: '1-day', label: '1 Hari' },
    { value: '1-week', label: '1 Minggu' },
    { value: '1-month', label: '1 Bulan' },
    { value: '1-year', label: '1 Tahun' },
    { value: 'custom', label: 'Kustom' }
  ];

  return (
    <div className="space-y-4">
      {/* Period Selection Controls */}
      <div className="bg-white rounded-xl border border-slate-150 p-3 sm:p-4 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="font-display font-black text-xs sm:text-sm text-slate-800 leading-none">Filter Periode Ringkasan</h2>
            <p className="text-slate-400 text-[10px] mt-1.5 font-bold">
              Rentang: <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">{formatDateLabel(filterStart)}</span> s/d <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">{formatDateLabel(filterEnd)}</span>
            </p>
          </div>
          
          <div className="flex flex-wrap gap-1.5">
            {periodOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setPeriod(option.value as any)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border cursor-pointer select-none ${
                  period === option.value
                    ? 'bg-emerald-100 text-emerald-950 border-emerald-300 shadow-sm shadow-emerald-50 scale-[1.01]'
                    : 'bg-white text-slate-600 border-slate-200/80 hover:bg-emerald-50/50 hover:text-emerald-950 hover:border-emerald-250'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Period Input Controls */}
        {period === 'custom' && (
          <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tanggal Mulai:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-450 focus:border-transparent text-slate-700 font-medium"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tanggal Selesai:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-450 focus:border-transparent text-slate-700 font-medium"
              />
            </div>
          </div>
        )}
      </div>

      {/* Grid: Core Stats Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        
        {/* Omset Card */}
        <div className="bg-white rounded-xl border border-slate-150/70 p-3 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {period === '1-day' ? 'Omset Hari Ini' : 'Omset Periode Ini'}
            </span>
            <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600 shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-mono text-base sm:text-lg font-black text-slate-850 truncate">{formatRupiah(periodSales)}</p>
            <p className="text-[9px] text-slate-400 font-medium leading-none mt-0.5">
              {period === '1-day' ? 'Kotor dari kasir' : 'Kotor dari kasir terfilter'}
            </p>
          </div>
        </div>

        {/* Profit Card */}
        <div className="bg-white rounded-xl border border-slate-150/70 p-3 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {period === '1-day' ? 'Laba Bersih Hari Ini' : 'Laba Bersih Periode'}
            </span>
            <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600 shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className={`font-mono text-base sm:text-lg font-black truncate relative ${periodProfitBersih < 0 ? 'text-rose-600' : 'text-slate-850'}`}>
              {formatRupiah(periodProfitBersih)}
            </p>
            <p className="text-[9px] text-slate-450 font-bold leading-tight mt-0.5">
              Laba kotor: <span className="text-emerald-600">+{formatRupiah(periodProfitKotor)}</span><br />
              Pengeluaran: <span className="text-rose-600">-{formatRupiah(periodExpenses)}</span>
            </p>
          </div>
        </div>

        {/* Low Stock Card */}
        <div className="bg-white rounded-xl border border-slate-150/70 p-3 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stok Tipis</span>
            <div className={`p-1.5 rounded-lg shrink-0 ${lowStockCount > 0 ? 'bg-amber-50 text-amber-600 animate-pulse' : 'bg-slate-50 text-slate-550'}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-mono text-base sm:text-lg font-black text-slate-850 truncate">{lowStockCount} Macam</p>
            <p className="text-[9px] text-slate-400 font-medium leading-none mt-0.5">Sembako butuh kulakan</p>
          </div>
        </div>

        {/* Debts Card */}
        <div className="bg-white rounded-xl border border-slate-150/70 p-3 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kasbon Aktif</span>
            <div className="p-1.5 bg-rose-50 rounded-lg text-rose-600 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-mono text-base sm:text-lg font-black text-slate-850 truncate">{formatRupiah(totalDebtAmount)}</p>
            <p className="text-[9px] text-slate-400 font-medium leading-none mt-0.5">Sisa bon belum lunas</p>
          </div>
        </div>

      </div>

      {/* Real-time Quick Poll Section for Aspirations */}
      {currentUser && currentUser.id !== 'default' && (
        <QuickPollWidget currentUser={currentUser} />
      )}

      {/* Visual Cash Flow Summary Panel */}
      {expenses.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 font-sans select-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
              <TrendingDown className="w-5 h-5 shrink-0" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">
                Aliran Kas & Pengeluaran Bulan Ini
              </p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                Total pengeluaran biaya operasional bulan ini tercatat sebesar <strong className="text-rose-600">{formatRupiah(totalExpensesThisMonth)}</strong>.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="py-1 px-3 bg-slate-50 border border-slate-200/50 rounded-xl">
              <span className="text-[9px] font-bold text-slate-400 block uppercase">Biaya Hari Ini</span>
              <span className="font-mono font-black text-rose-600">{formatRupiah(totalExpensesToday)}</span>
            </div>
            <div className="py-1 px-3 bg-indigo-50/40 border border-indigo-100/40 rounded-xl">
              <span className="text-[9px] font-bold text-slate-400 block uppercase">Laba Kotor Bulanan (Estimasi)</span>
              <span className="font-mono font-black text-indigo-700">
                {formatRupiah(transactions.reduce((sum, tx) => {
                  const txDate = new Date(tx.date);
                  return (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) ? sum + tx.profit : sum;
                }, 0))}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Sections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Section: Stok Menipis Alert List */}
        <div className="bg-white rounded-2xl border border-slate-150/60 shadow-2xs flex flex-col overflow-hidden">
          <div className="p-3.5 border-b border-slate-155 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-1.5">
              <div className="p-1 bg-amber-50 rounded text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-slate-800 text-[11px] sm:text-xs leading-none">Sembako Di Ambang Habis</h3>
                <p className="text-[9px] text-slate-400 font-bold leading-none mt-1">Harap segera belanja ke agen/grosir</p>
              </div>
            </div>
            <button 
              onClick={() => setActiveTab('stock')}
              className="text-[10px] font-black text-indigo-600 hover:text-indigo-750 flex items-center gap-0.5 cursor-pointer bg-white px-2 py-1 rounded-md border border-slate-200"
            >
              <span>Kulakan</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="p-3 flex-1">
            {lowStockProducts.length > 0 ? (
              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                {lowStockProducts.map(p => {
                  const isSevere = p.stock === 0;
                  return (
                    <div 
                      key={p.id} 
                      className={`flex items-center justify-between p-2 rounded-lg border text-[11px] ${
                        isSevere 
                          ? 'bg-rose-50/30 border-rose-100 text-rose-800' 
                          : 'bg-amber-50/20 border-amber-100 text-amber-800'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-slate-800 leading-tight">{p.name}</p>
                        <p className="text-[9px] text-slate-400 font-medium uppercase mt-0.5">{p.unit} • {p.category.split(' ')[0]}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                          isSevere ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          Stok: {p.stock} {p.unit.split(' ')[0]}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5" />
                <p className="font-bold text-xs text-slate-700">Stok Sembako Aman!</p>
                <p className="text-[9px] text-slate-400 mt-0.5">Semua barang melebihi batas minimum.</p>
              </div>
            )}
          </div>
        </div>

        {/* Section: Rincian Kasbon / Piutang Belum Lunas */}
        <div className="bg-white rounded-2xl border border-slate-150/60 shadow-2xs flex flex-col overflow-hidden">
          <div className="p-3.5 border-b border-slate-155 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-1.5">
              <div className="p-1 bg-rose-50 rounded text-rose-700">
                <BookOpen className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-slate-800 text-[11px] sm:text-xs leading-none">Piutang Kasbon Terbesar</h3>
                <p className="text-[9px] text-slate-400 font-bold leading-none mt-1">Daftar tetangga dengan saldo bon aktif</p>
              </div>
            </div>
            <button 
              onClick={() => setActiveTab('debt')}
              className="text-[10px] font-black text-indigo-600 hover:text-indigo-750 flex items-center gap-0.5 cursor-pointer bg-white px-2 py-1 rounded-md border border-slate-200"
            >
              <span>Kasbon</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="p-3 flex-1">
            {activeDebts.length > 0 ? (
              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                {activeDebts.map(d => (
                  <div 
                    key={d.id} 
                    className="flex items-center justify-between p-2 bg-slate-50/60 border border-slate-100 rounded-lg text-[11px]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="font-bold text-slate-800 truncate">{d.customerName}</span>
                      </div>
                      <p className="text-[9px] text-slate-400 font-medium truncate mt-0.5">
                        {d.notes}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="font-mono font-black text-rose-700 leading-none">{formatRupiah(d.remainingDebt)}</p>
                      <p className="text-[8px] text-slate-400 font-bold mt-1">Awal: {formatRupiah(d.totalDebt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5" />
                <p className="font-bold text-xs text-slate-705">Buku Utang Lunas!</p>
                <p className="text-[9px] text-slate-400 mt-0.5">Tidak ada sisa utang kasbon aktif.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Section: Ringkasan Aktivitas Terakhir */}
      <div className="bg-white rounded-2xl border border-slate-150/60 shadow-2xs p-3.5 overflow-hidden">
        <div className="flex items-center gap-1.5 mb-3">
          <div className="p-1 bg-indigo-50 rounded text-indigo-700 shrink-0">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-display font-extrabold text-slate-800 text-[11px] sm:text-xs leading-none">Aktivitas Kasir Terakhir</h3>
            <p className="text-[9px] text-slate-400 font-bold leading-none mt-1">Riwayat transaksi penjualan di kasir</p>
          </div>
        </div>

        {recentTransactions.length > 0 ? (
          <div className="space-y-1.5">
            {recentTransactions.map(tx => (
              <div key={tx.id} className="flex items-center justify-between p-2 hover:bg-slate-50/50 rounded-lg border border-slate-100 text-[11px]">
                <div>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[9px] bg-slate-100 px-1 py-0.5 rounded text-slate-650 font-bold">#{tx.id.substring(tx.id.length - 4).toUpperCase()}</span>
                    <span className="font-bold text-slate-800">Sembako</span>
                  </div>
                  <p className="text-[8px] text-slate-400 font-bold mt-0.5">
                    {new Date(tx.date).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })} • {tx.paymentMethod}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-black text-slate-800 leading-none">{formatRupiah(tx.totalBill)}</p>
                  <p className="text-[9px] text-emerald-600 font-bold mt-1">Untung: +{formatRupiah(tx.profit)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-4 text-center text-slate-400 text-[10px] font-bold">
            Belum ada transaksi hari ini.
          </div>
        )}
      </div>

      {/* Interactive Guidance Modal for Data Backup & Chrome Security Disclaimer */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center p-2 sm:p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="mt-24 sm:mt-32 mb-12 bg-white rounded-2xl max-w-lg w-full shadow-xl border border-slate-150 overflow-hidden text-slate-800 flex flex-col max-h-[85vh] sm:max-h-[80vh]">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-550 to-orange-600 px-4 py-3 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 animate-pulse" />
                <h3 className="font-display font-black text-xs uppercase tracking-wider">Disclaimer & Panduan Keamanan Data</h3>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-white/20 rounded-md transition-colors cursor-pointer text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs leading-relaxed max-h-[60vh]">
              
              {/* Hukum Disclaimer Banner */}
              <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl text-rose-950">
                <p className="font-extrabold text-[11px] uppercase mb-1 flex items-center gap-1 text-rose-800">
                  ⚠️ Disclaimer Hukum Penting
                </p>
                <p className="text-[10px] font-bold leading-relaxed">
                  Selaku pengguna, Anda memahami penuh bahwa aplikasi ini berjalan secara mandiri. Segala kerugian, kerusakan, kesalahan laporan, atau kehilangan data adalah risiko mandiri pengguna. <strong>Pembuat aplikasi tidak bisa dituntut secara hukum</strong> dalam bentuk apa pun dan di bawah yurisdiksi hukum mana pun.
                </p>
              </div>

              {/* Question & Answer 1 */}
              <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-xl">
                <p className="font-extrabold text-amber-950 text-[11px] mb-1">
                  ❓ Apakah data saya akan hilang jika Chrome dihapus / bersihkan data?
                </p>
                <p className="text-[10px] text-amber-900 font-medium leading-relaxed">
                  <strong>YA, BETUL.</strong> Aplikasi <strong>SAF Kasir</strong> ini didesain agar bisa bekerja offline dengan cepat secara mandiri tanpa internet. Semua transaksi, stok produk, dan kasbon utang disimpan langsung di memori browser (Chrome <span className="font-mono bg-amber-150 px-1 rounded">localStorage</span>). 
                </p>
              </div>

              {/* Question & Answer 2 - Developer Privacy */}
              <div className="bg-indigo-50/60 border border-indigo-100 p-3 rounded-xl">
                <p className="font-extrabold text-indigo-950 text-[11px] mb-1">
                  ❓ Apakah pengembang (developer/admin) bisa mengintip / mengedit data kasir saya?
                </p>
                <p className="text-[10px] text-indigo-900 font-medium leading-relaxed">
                  <strong>SAMA SEKALI TIDAK BISA.</strong> Karena aplikasi ini berbasis penyimpanan lokal murni tanpa server database pusat terpadu, pengembang atau superadmin tidak memiliki akses, sarana teknis, ataupun kuasa data untuk melihat laporan harian, harga modal barang, keuntungan, nama pelanggan, maupun catatan piutang Anda. Privasi keuangan Anda 100% aman dan hanya ada di HP Anda.
                </p>
              </div>

              {/* Warning Checklist */}
              <div>
                <p className="font-extrabold text-slate-800 mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-3 bg-red-500 rounded-full inline-block"></span>
                  <span>Tindakan yang BISA menghapus data kasir Anda:</span>
                </p>
                <div className="space-y-1.5 pl-3">
                  <div className="flex items-start gap-2">
                    <span className="text-red-500 font-extrabold shrink-0">❌</span>
                    <p className="text-[10px] text-slate-600"><strong>Menghapus Data Penjelajahan Chrome</strong> (Clear History, Cookies, atau Cache) dengan mencentang pilihan "Hapus Data Situs/LocalStorage".</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-red-500 font-extrabold shrink-0">❌</span>
                    <p className="text-[10px] text-slate-600"><strong>Menghapus / Uninstall Google Chrome</strong> dari HP atau Laptop Anda.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-red-500 font-extrabold shrink-0">❌</span>
                    <p className="text-[10px] text-slate-600">Menggunakan aplikasi kasir ini dalam <strong>Mode Penyamaran (Incognito Mode)</strong>, karena sistem otomatis membersihkan data saat browser ditutup.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-red-500 font-extrabold shrink-0">❌</span>
                    <p className="text-[10px] text-slate-600">Aplikasi pembersih memori (Cleaner HP) yang sangat agresif yang otomatis membersihkan cache & local storage aplikasi browser.</p>
                  </div>
                </div>
              </div>

              {/* Recommendations/Saran Keamanan */}
              <div className="border-t border-slate-100 pt-3.5">
                <p className="font-extrabold text-slate-800 mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-3 bg-emerald-550 rounded-full inline-block"></span>
                  <span className="text-emerald-700">Solusi & Saran agar Data Selalu Aman:</span>
                </p>
                <div className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-150">
                  <div className="flex gap-2">
                    <div className="bg-indigo-100 text-indigo-700 p-1 rounded font-bold text-[9px] h-5 w-5 flex items-center justify-center shrink-0">1</div>
                    <div>
                      <p className="font-bold text-slate-850">Lakukan Ekspor Cadangan (Backup) Berkala</p>
                      <p className="text-[10px] text-slate-550 mt-0.5">Masuk ke menu <strong>Riwayat</strong> &gt; klik <strong>Ekspor Cadangan (Backup)</strong>. Data toko akan diunduh dalam bentuk file kecil berkode (.json).</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="bg-indigo-100 text-indigo-700 p-1 rounded font-bold text-[9px] h-5 w-5 flex items-center justify-center shrink-0">2</div>
                    <div>
                      <p className="font-bold text-slate-850">Simpan File Cadangan di Tempat Aman</p>
                      <p className="text-[10px] text-slate-550 mt-0.5">Kirim file backup tersebut ke <strong>WhatsApp pribadi</strong>, simpan di <strong>Google Drive</strong>, atau email agar tidak hilang jika HP rusak.</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="bg-indigo-100 text-indigo-700 p-1 rounded font-bold text-[9px] h-5 w-5 flex items-center justify-center shrink-0">3</div>
                    <div>
                      <p className="font-bold text-slate-850">Gunakan Impor Cadangan (Restore) untuk Pemulihan</p>
                      <p className="text-[10px] text-slate-550 mt-0.5">Jika di kemudian hari data Anda terhapus, Anda cukup klik <strong>Impor Cadangan</strong> di tab Riwayat, lalu pilih berkas tersebut. Data toko Anda seketika kembali 100% utuh.</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Actions Footer */}
            <div className="border-t border-slate-150 bg-slate-50 p-3.5 flex flex-col sm:flex-row gap-2 justify-end">
              <button 
                onClick={() => {
                  setShowModal(false);
                  setActiveTab('history');
                }}
                className="px-3.5 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Buka Menu Riwayat & Backup Sekarang</span>
              </button>
              <button 
                onClick={() => setShowModal(false)}
                className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
              >
                Saya Selesai & Mengerti
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
