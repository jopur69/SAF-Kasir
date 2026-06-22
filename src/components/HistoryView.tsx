/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { TrendingUp, FolderDown, FolderUp, RefreshCw, Calendar, Sparkles, DollarSign, Activity, FileText, CheckCircle2, X, AlertTriangle } from 'lucide-react';
import { Transaction } from '../types';
import { formatRupiah, formatDate } from '../utils/format';

interface HistoryViewProps {
  transactions: Transaction[];
  onImportBackup: (importedData: { products: any[], debts: any[], transactions: any[] }) => void;
  fullBackupData: () => { products: any[], debts: any[], transactions: any[] };
  onClearHistory: () => void;
}

export default function HistoryView({
  transactions,
  onImportBackup,
  fullBackupData,
  onClearHistory
}: HistoryViewProps) {
  const [filterPeriod, setFilterPeriod] = useState<'today' | '7days' | 'all'>('all');
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // High-fidelity backup operations notifications state
  const [notif, setNotif] = useState<{
    show: boolean;
    type: 'idle' | 'backup_progress' | 'backup_success' | 'confirm_restore' | 'restore_progress' | 'restore_success' | 'err';
    title: string;
    message: string;
    progress: number;
    stepText: string;
    stats?: { products: number; transactions: number; debts: number };
    tempImportData?: any;
  }>({
    show: false,
    type: 'idle',
    title: '',
    message: '',
    progress: 0,
    stepText: ''
  });

  // Filtered list based on timeframe
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();

    return transactions.filter(tx => {
      const txDate = new Date(tx.date);
      if (filterPeriod === 'today') {
        return txDate.toDateString() === todayStr;
      } else if (filterPeriod === '7days') {
        const diffTime = Math.abs(now.getTime() - txDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      }
      return true; // all
    }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, filterPeriod]);

  // Calculations for periods
  const metrics = useMemo(() => {
    let revenue = 0;
    let profit = 0;
    let tunaiCount = 0;
    let qrisCount = 0;
    let utangCount = 0;

    filteredTransactions.forEach(tx => {
      revenue += tx.totalBill;
      profit += tx.profit;
      if (tx.paymentMethod === 'Tunai') tunaiCount += tx.totalBill;
      else if (tx.paymentMethod === 'QRIS') qrisCount += tx.totalBill;
      else if (tx.paymentMethod === 'Utang') utangCount += tx.totalBill;
    });

    return {
      revenue,
      profit,
      transactionCount: filteredTransactions.length,
      tunaiCount,
      qrisCount,
      utangCount
    };
  }, [filteredTransactions]);

  // Aggregate daily history for chart (last 7 days)
  const chartData = useMemo(() => {
    const days: { [key: string]: { dateLabel: string, revenue: number, profit: number } } = {};
    const now = new Date();

    // Init last 7 days keys
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const key = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      days[key] = { dateLabel: key, revenue: 0, profit: 0 };
    }

    // Populate
    transactions.forEach(tx => {
      const txDate = new Date(tx.date);
      const key = txDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      if (days[key]) {
        days[key].revenue += tx.totalBill;
        days[key].profit += tx.profit;
      }
    });

    return Object.values(days);
  }, [transactions]);

  // Max value in chart data to scale the height dynamically
  const chartMaxVal = useMemo(() => {
    const max = Math.max(...chartData.map(d => d.revenue), 100000);
    return max * 1.15; // 15% padding
  }, [chartData]);

  // Backup exporter with beautiful custom steps notification
  const handleExportBackup = () => {
    const data = fullBackupData();
    const stats = {
      products: data.products?.length || 0,
      transactions: data.transactions?.length || 0,
      debts: data.debts?.length || 0
    };

    setNotif({
      show: true,
      type: 'backup_progress',
      title: 'Mempersiapkan Berkas Cadangan',
      message: 'Arsip log keuangan Anda sedang diproses dan dienkapsulasi aman...',
      progress: 20,
      stepText: 'Membaca riwayat transaksi & kasbon...',
      stats
    });

    setTimeout(() => {
      setNotif(prev => ({
        ...prev,
        progress: 60,
        stepText: `Mengonversi ${stats.transactions} transaksi dan data produk...`
      }));
    }, 450);

    setTimeout(() => {
      setNotif(prev => ({
        ...prev,
        progress: 90,
        stepText: 'Mengompilasi format JSON...'
      }));
    }, 900);

    setTimeout(() => {
      try {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `kasir-sembako-cadangan-${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();

        setNotif(prev => ({
          ...prev,
          type: 'backup_success',
          title: 'Unduh Cadangan Berhasil!',
          message: 'Berkas JSON data kasir Anda telah berhasil dikompilasi dan disimpan di memori perangkat.',
          progress: 100,
          stepText: 'Pencadangan sukses.'
        }));
      } catch (err) {
        setNotif({
          show: true,
          type: 'err',
          title: 'Pencadangan Gagal',
          message: 'Terjadi masalah teknis di browser saat mengemas berkas cadangan.',
          progress: 0,
          stepText: 'Proses gagal.'
        });
      }
    }, 1350);
  };

  // Backup importer with confirmation dialog and warning notification
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileReader = new FileReader();
    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && (parsed.products || parsed.transactions || parsed.debts)) {
          const stats = {
            products: parsed.products?.length || 0,
            transactions: parsed.transactions?.length || 0,
            debts: parsed.debts?.length || 0
          };

          setNotif({
            show: true,
            type: 'confirm_restore',
            title: 'Konfirmasi Unggah Cadangan',
            message: 'Tindakan ini akan menghapus dan menimpa seluruh produk, riwayat, dan transaksi kasir Anda saat ini!',
            progress: 0,
            stepText: 'Menunggu persetujuan Anda...',
            stats,
            tempImportData: parsed
          });
        } else {
          setNotif({
            show: true,
            type: 'err',
            title: 'Arsip Berkas Tidak Valid',
            message: 'File JSON yang diunggah tidak didukung atau memiliki struktur berkas yang salah.',
            progress: 0,
            stepText: 'Integritas file ditolak.'
          });
        }
      } catch (err) {
        setNotif({
          show: true,
          type: 'err',
          title: 'Gagal Membaca File',
          message: 'Gagal menganalisis dokumen cadangan. Silakan pastikan file tidak rusak.',
          progress: 0,
          stepText: 'Parser error.'
        });
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    fileReader.readAsText(files[0]);
  };

  const executeApplyRestore = () => {
    const parsed = notif.tempImportData;
    if (!parsed) return;

    setNotif(prev => ({
      ...prev,
      type: 'restore_progress',
      title: 'Menyelaraskan Memori Lokal',
      message: 'Membersihkan tabel data lama dan mengintegrasikan berkas baru...',
      progress: 25,
      stepText: 'Meregenerasi database lokal...'
    }));

    setTimeout(() => {
      setNotif(prev => ({
        ...prev,
        progress: 75,
        stepText: `Menyalin ${notif.stats?.products || 0} produk dan ${notif.stats?.transactions || 0} riwayat transaksi...`
      }));
    }, 450);

    setTimeout(() => {
      try {
        onImportBackup(parsed);
        setNotif(prev => ({
          ...prev,
          type: 'restore_success',
          title: 'Pemulihan Data Berhasil!',
          message: 'Luar biasa! Seluruh log transaksi beserta produk berhasil dipulihkan.',
          progress: 100,
          stepText: 'Pemulihan selesai.'
        }));
      } catch (err) {
        setNotif({
          show: true,
          type: 'err',
          title: 'Gagal Pemulihan',
          message: 'Sistem browser gagal menulis baris database lokal.',
          progress: 0,
          stepText: 'Gagal menulis.'
        });
      }
    }, 1000);
  };

  const closeNotif = () => setNotif(prev => ({ ...prev, show: false }));

  return (
    <div id="history-view-container" className="flex flex-col gap-4 animate-fade-in">
      
      {/* High impact Backup/Restore Notification Overlay */}
      {notif.show && (
        <div id="history-notif-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs animate-fade-in">
          <div id="history-notif-card" className="bg-white rounded-3xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden flex flex-col p-6 animate-scale-up">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-50">
              <span className="font-sans font-black text-xs uppercase tracking-widest text-slate-400">
                Layanan Cadangan Riwayat
              </span>
              {(notif.type === 'backup_success' || notif.type === 'restore_success' || notif.type === 'err' || notif.type === 'confirm_restore') && (
                <button
                  id="close-history-notif-btn"
                  onClick={closeNotif}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="mt-5 flex flex-col items-center text-center">
              {notif.type.includes('progress') ? (
                <div id="hist-progress-spinner" className="p-4 bg-indigo-50 text-indigo-600 rounded-full mb-4 animate-spin-slow">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                </div>
              ) : notif.type.includes('success') ? (
                <div id="hist-success-icon" className="p-4 bg-emerald-50 text-emerald-600 rounded-full mb-4">
                  <CheckCircle2 className="w-8 h-8 animate-bounce-short" />
                </div>
              ) : notif.type === 'confirm_restore' ? (
                <div id="hist-warning-icon" className="p-4 bg-rose-50 text-rose-600 rounded-full mb-4">
                  <AlertTriangle className="w-8 h-8 animate-pulse" />
                </div>
              ) : (
                <div id="hist-error-icon" className="p-4 bg-rose-50 text-rose-600 rounded-full mb-4">
                  <AlertTriangle className="w-8 h-8" />
                </div>
              )}

              <h3 id="hist-notification-title" className="font-display font-black text-slate-800 text-sm sm:text-base tracking-tight">
                {notif.title}
              </h3>
              <p id="hist-notification-description" className="text-xs text-slate-550 mt-1.5 leading-relaxed">
                {notif.message}
              </p>

              {notif.stats && (
                <div id="hist-notif-stats" className="mt-3.5 w-full bg-slate-50 rounded-2xl p-3 border border-slate-100 flex flex-col gap-1.5 text-left">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">
                    Item Ditemukan:
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 bg-white rounded-lg border border-slate-100 flex flex-col">
                      <span className="text-[10px] text-slate-400">Barang</span>
                      <strong className="text-slate-800 font-bold">{notif.stats.products}</strong>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-100 flex flex-col">
                      <span className="text-[10px] text-slate-400">Arsip Sales</span>
                      <strong className="text-slate-800 font-bold">{notif.stats.transactions}</strong>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-100 flex flex-col">
                      <span className="text-[10px] text-slate-400">Kasbon</span>
                      <strong className="text-slate-800 font-bold">{notif.stats.debts}</strong>
                    </div>
                  </div>
                </div>
              )}

              {notif.type.includes('progress') && (
                <div id="hist-notif-progress" className="mt-5 w-full">
                  <div className="flex justify-between items-center text-[10px] font-bold text-indigo-650 mb-1">
                    <span className="uppercase tracking-wider">{notif.stepText}</span>
                    <span>{notif.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-150 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${notif.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div id="hist-notif-footer" className="mt-5 pt-3 border-t border-slate-50 flex gap-2.5">
              {notif.type === 'confirm_restore' ? (
                <>
                  <button
                    id="hist-cancel-restore"
                    onClick={closeNotif}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer select-none"
                  >
                    Batal
                  </button>
                  <button
                    id="hist-confirm-restore"
                    onClick={executeApplyRestore}
                    className="flex-1 py-2 bg-emerald-100 hover:bg-emerald-200 active:scale-95 text-emerald-950 rounded-xl text-xs font-bold transition-all cursor-pointer select-none"
                  >
                    Ya, Ganti Data
                  </button>
                </>
              ) : (
                <button
                  id="hist-dismiss-notif"
                  onClick={closeNotif}
                  className="w-full py-2 bg-emerald-100 hover:bg-emerald-200 active:scale-95 text-emerald-950 rounded-xl text-xs font-black shadow-md shadow-emerald-100/50 transition-all cursor-pointer select-none"
                >
                  Oke
                </button>
              )}
            </div>

          </div>
        </div>
      )}
      
      {/* Time filters & Tools Area */}
      <div className="bg-white p-3 rounded-xl border border-slate-150/70 shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        
        {/* Period Selector Tabs */}
        <div className="flex bg-slate-100 p-0.5 rounded-lg self-start w-full md:w-auto overflow-x-auto scrollbar-none">
          <button
            onClick={() => setFilterPeriod('all')}
            className={`flex-1 md:flex-none px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-all ${
              filterPeriod === 'all' ? 'bg-white text-slate-850 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Semua
          </button>
          <button
            onClick={() => setFilterPeriod('7days')}
            className={`flex-1 md:flex-none px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-all ${
              filterPeriod === '7days' ? 'bg-white text-slate-850 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            7 Hari
          </button>
          <button
            onClick={() => setFilterPeriod('today')}
            className={`flex-1 md:flex-none px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-all ${
              filterPeriod === 'today' ? 'bg-white text-slate-850 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Hari Ini
          </button>
        </div>

        {/* Data Tools Actions (Backup/Restore) */}
        <div className="flex items-center gap-1.5 w-full md:w-auto justify-between md:justify-end">
          
          <button
            onClick={handleExportBackup}
            className="flex-1 md:flex-none p-1.5 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1"
            title="Sangat berguna untuk mencadangkan data jika ingin pindah HP!"
          >
            <FolderDown className="w-3.5 h-3.5" />
            <span>Unduh Backup</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportBackup}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 md:flex-none p-1.5 px-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border border-emerald-200 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1"
            title="Pulihkan data toko dari file cadangan sebelumnya"
          >
            <FolderUp className="w-3.5 h-3.5" />
            <span>Unggah Backup</span>
          </button>

        </div>
      </div>

      {/* Numerical Metrics Summary Block */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        
        <div className="bg-white rounded-xl p-3 border border-slate-150/70 shadow-2xs">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">OMSET KAS MASUK</span>
          <span className="font-display font-mono font-bold text-sm sm:text-base text-slate-805 block truncate">{formatRupiah(metrics.revenue)}</span>
          <p className="text-[9px] text-slate-400 mt-1">Kotor dari {metrics.transactionCount} transaksi</p>
        </div>

        <div className="bg-white rounded-xl p-3 border border-indigo-100/70 shadow-2xs">
          <span className="text-[9px] font-bold text-indigo-650 uppercase tracking-wider block mb-0.5">UNTUNG BERSIH</span>
          <span className="font-display font-mono font-bold text-sm sm:text-base text-indigo-700 block truncate">{formatRupiah(metrics.profit)}</span>
          <p className="text-[9px] text-indigo-400 mt-1">Sisa bersih setelah modal</p>
        </div>

        <div className="bg-white rounded-xl p-3 border border-slate-150/70 shadow-2xs">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">RATA-RATA BON / JUAL</span>
          <span className="font-display font-mono font-bold text-sm sm:text-base text-slate-805 block truncate">
            {metrics.transactionCount > 0 ? formatRupiah(metrics.revenue / metrics.transactionCount) : 'Rp 0'}
          </span>
          <p className="text-[9px] text-slate-400 mt-1">Nilai per struk kasir</p>
        </div>

        <div className="bg-white rounded-xl p-2.5 border border-slate-150/70 shadow-2xs">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">METODE BAYAR</span>
          <div className="flex flex-col gap-0.5 mt-0.5 text-[9px] font-semibold text-slate-500">
            <div className="flex justify-between">
              <span>Tunai:</span>
              <span className="font-mono text-emerald-700 font-bold">{formatRupiah(metrics.tunaiCount)}</span>
            </div>
            <div className="flex justify-between">
              <span>QRIS/Kasbon:</span>
              <span className="font-mono text-indigo-700 font-bold">{formatRupiah(metrics.qrisCount + metrics.utangCount)}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Revenue & Profit Trends Line Graph (Visualizer) */}
      <div className="bg-white p-4 rounded-xl border border-slate-150/70 shadow-2xs flex flex-col gap-3">
        
        <div>
          <h3 className="font-display font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <span>Tren Omset & Keuntungan Sembako (7 Hari Terakhir)</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Grafik garis bantu memantau kenaikan omset dan laba bersih secara visual.</p>
        </div>

        {/* Custom Responsive SVG Line Chart */}
        <div className="relative w-full border-b border-l border-slate-100/70 mt-2 p-2">
          
          {/* Custom interactive tooltip overlay indicator */}
          <div className="absolute inset-x-0 bottom-4 top-2 pointer-events-none z-20 flex justify-between px-6">
            {chartData.map((day, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center group/dot pointer-events-auto cursor-pointer relative">
                
                {/* Simulated vertical tracker line on hover */}
                <div className="absolute inset-y-0 w-px bg-slate-150/50 hidden group-hover/dot:block" />
                
                {/* Floating summary speech balloon on hover list */}
                <div className="absolute -top-16 bg-slate-900 text-white rounded-lg p-2.5 text-[9.5px] hidden group-hover/dot:flex flex-col gap-0.5 shadow-xl min-w-[130px] pointer-events-none z-30 font-mono">
                  <span className="font-sans font-extrabold text-indigo-300 text-[9px] border-b border-slate-750 pb-1 mb-1 block">{day.dateLabel}</span>
                  <span className="text-indigo-300 font-bold">Omset: {formatRupiah(day.revenue)}</span>
                  <span className="text-teal-305 font-bold text-emerald-400">Untung: {formatRupiah(day.profit)}</span>
                </div>
              </div>
            ))}
          </div>

          <svg viewBox="0 0 500 160" className="w-full h-44 overflow-visible" id="svg-line-graph-trend">
            <defs>
              {/* Fade gradients */}
              <linearGradient id="revenue-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="profit-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0d9488" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#0d9488" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal helper gridlines */}
            <line x1="10" y1="20" x2="490" y2="20" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="10" y1="75" x2="490" y2="75" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="10" y1="130" x2="490" y2="130" stroke="#f1f5f9" strokeWidth="1" />

            {/* Generating coordinates and draw svg lines */}
            {(() => {
              const ptsRev = chartData.map((d, index) => {
                const x = 30 + (index / 6) * 440;
                const y = 135 - (d.revenue / chartMaxVal) * 110;
                return { x, y };
              });

              const ptsProfit = chartData.map((d, index) => {
                const x = 30 + (index / 6) * 440;
                const y = 135 - (d.profit / chartMaxVal) * 110;
                return { x, y };
              });

              // Create path strings
              const pathRevD = ptsRev.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '');
              const pathProfitD = ptsProfit.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '');

              // Create closed shapes for area gradient rendering
              const areaRevD = `${pathRevD} L ${ptsRev[ptsRev.length-1].x} 135 L ${ptsRev[0].x} 135 Z`;
              const areaProfitD = `${pathProfitD} L ${ptsProfit[ptsProfit.length-1].x} 135 L ${ptsProfit[0].x} 135 Z`;

              return (
                <g>
                  {/* Fill shades */}
                  {ptsRev.length > 0 && <path d={areaRevD} fill="url(#revenue-grad)" />}
                  {ptsProfit.length > 0 && <path d={areaProfitD} fill="url(#profit-grad)" />}

                  {/* Draw main stroke graphs */}
                  {ptsRev.length > 0 && (
                    <path 
                      d={pathRevD} 
                      fill="none" 
                      stroke="#4f46e5" 
                      strokeWidth="2.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      className="drop-shadow-[0_1px_3px_rgba(79,70,229,0.3)]"
                    />
                  )}
                  {ptsProfit.length > 0 && (
                    <path 
                      d={pathProfitD} 
                      fill="none" 
                      stroke="#0d9488" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Data Point Circles */}
                  {ptsRev.map((p, i) => (
                    <g key={`rev-pts-${i}`}>
                      <circle cx={p.x} cy={p.y} r="4" fill="#ffffff" stroke="#4f46e5" strokeWidth="2.5" />
                      <text x={p.x} y="152" textAnchor="middle" className="text-[8px] font-bold fill-slate-400 font-sans">{chartData[i].dateLabel}</text>
                    </g>
                  ))}

                  {ptsProfit.map((p, i) => (
                    <circle key={`prof-pts-${i}`} cx={p.x} cy={p.y} r="3" fill="#ffffff" stroke="#0d9488" strokeWidth="2" />
                  ))}
                </g>
              );
            })()}
          </svg>

        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 mt-1 pl-1">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 rounded-full bg-indigo-600 border border-indigo-600"></div>
            <span>Kas Omset (Penjualan Sembako)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 rounded-full bg-teal-600 border border-teal-650"></div>
            <span>Laba Untung Bersih Sembako</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium italic ml-auto">(Arahkan kursor/sentuh titik grafik untuk melihat rincian Rupiah)</p>
        </div>

      </div>

      {/* Table List of Transactions */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h3 className="font-display font-bold text-slate-800 text-sm">Log Transaksi Keluar Masuk</h3>
          {filteredTransactions.length > 0 && (
            <button
               onClick={() => setShowConfirmClear(true)}
               className="text-[10px] bg-rose-50 hover:bg-rose-100 hover:text-rose-700 text-rose-600 px-2.5 py-1 rounded-lg font-bold transition-colors"
            >
               Hapus Semua Riwayat
            </button>
          )}
        </div>

        {/* Confirmation dialogue for history reset */}
        {showConfirmClear && (
          <div className="p-4 bg-rose-55 rounded-xl border border-rose-100/40 m-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
            <span className="text-slate-700">Apakah Anda benar-benar ingin mereset/menghapus <strong>seluruh data penjualan</strong> selamanya? Stok tidak akan terpengaruh.</span>
            <div className="flex items-center gap-1.5 shrink-0 self-end">
              <button onClick={() => setShowConfirmClear(false)} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded font-semibold text-slate-655 text-xs">Batal</button>
              <button
                onClick={() => {
                  onClearHistory();
                  setShowConfirmClear(false);
                  alert("Seluruh riwayat transaksi berhasil dikosongkan.");
                }}
                className="px-2 py-1 bg-rose-500 hover:bg-rose-600 rounded font-bold text-white text-xs"
              >
                Ya, Hapus Semua
              </button>
            </div>
          </div>
        )}

        {/* Transaction listing */}
        <div className="divide-y divide-slate-100">
          {filteredTransactions.map(tx => (
            <div key={tx.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-50/50 transition-all text-xs">
              
              {/* Left Details */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 font-mono uppercase">#{tx.id.substring(3, 11)}</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                    tx.paymentMethod === 'Tunai' 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : tx.paymentMethod === 'QRIS' 
                      ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {tx.paymentMethod}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">{formatDate(tx.date)}</span>
                </div>

                {/* Items sold preview list */}
                <p className="mt-1.5 text-slate-600 line-clamp-2 leading-relaxed font-medium">
                  {tx.items.map(i => `${i.name} (${i.quantity} ${i.unit || 'pcs'})`).join(', ')}
                </p>

                {tx.customerName && (
                  <div className="mt-1 flex items-center gap-1 text-[10.5px] font-bold text-indigo-650 uppercase">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Pembeli: {tx.customerName}</span>
                  </div>
                )}
              </div>

              {/* Right monetary values */}
              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t border-slate-50 sm:border-0 pt-2.5 sm:pt-0 shrink-0">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block sm:hidden">Total Belanja</span>
                  <span className="font-mono text-sm font-bold text-slate-800">{formatRupiah(tx.totalBill)}</span>
                </div>
                <div className="text-right mt-0.5">
                  <span className="text-[10px] text-slate-400 block sm:hidden">Laba Bersih</span>
                  <span className="font-mono text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded" title="Untung kotor untuk pemilik kasir">
                    Untung: {formatRupiah(tx.profit)}
                  </span>
                </div>
              </div>

            </div>
          ))}

          {filteredTransactions.length === 0 && (
            <div className="p-12 text-center text-slate-400">
              <FileText className="w-8 h-8 text-slate-350 mx-auto mb-1.5" />
              <p className="text-xs">Ubah filter period untuk melihat data penjualan</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
