/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { Database, FolderDown, FolderUp, CheckCircle2, AlertTriangle, RefreshCw, X, Check, ArrowRight } from 'lucide-react';

interface BackupRestoreViewProps {
  fullBackupData: () => { products: any[], debts: any[], transactions: any[], expenses?: any[] };
  onImportBackup: (importedData: { products: any[], debts: any[], transactions: any[], expenses?: any[] }) => void;
  currentUserStoreName: string;
}

export default function BackupRestoreView({
  fullBackupData,
  onImportBackup,
  currentUserStoreName
}: BackupRestoreViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Custom interactive notification state
  const [notification, setNotification] = useState<{
    show: boolean;
    type: 'idle' | 'backup_progress' | 'backup_success' | 'confirm_restore' | 'restore_progress' | 'restore_success' | 'error';
    title: string;
    message: string;
    progress: number;
    stepText: string;
    stats?: { products: number; transactions: number; debts: number; expenses: number };
    tempImportData?: any;
  }>({
    show: false,
    type: 'idle',
    title: '',
    message: '',
    progress: 0,
    stepText: ''
  });

  const handleExportBackup = () => {
    try {
      const data = fullBackupData();
      const stats = {
        products: data.products?.length || 0,
        transactions: data.transactions?.length || 0,
        debts: data.debts?.length || 0,
        expenses: data.expenses?.length || 0
      };

      // Start animated backup notification sequence
      setNotification({
        show: true,
        type: 'backup_progress',
        title: 'Mempersiapkan Cadangan Data',
        message: 'Sistem sedang membaca database lokal dan mengompilasi data kasir Anda...',
        progress: 15,
        stepText: 'Membuka penyimpanan lokal perangkat...',
        stats
      });

      // Animated steps for realistic look and premium responsiveness
      setTimeout(() => {
        setNotification(prev => ({
          ...prev,
          progress: 45,
          stepText: `Mengompres ${stats.products} produk & ${stats.transactions} riwayat transaksi...`
        }));
      }, 500);

      setTimeout(() => {
        setNotification(prev => ({
          ...prev,
          progress: 80,
          stepText: `Mengonversi ${stats.debts} log buku kasbon & ${stats.expenses || 0} pengeluaran...`
        }));
      }, 1000);

      setTimeout(() => {
        setNotification(prev => ({
          ...prev,
          progress: 95,
          stepText: 'Membuat tautan unduhan aman berkas cadangan...'
        }));
      }, 1500);

      setTimeout(() => {
        try {
          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
          const downloadAnchor = document.createElement('a');
          downloadAnchor.setAttribute("href", dataStr);
          downloadAnchor.setAttribute("download", `Backup-${currentUserStoreName.replace(/\s+/g, '_')}-${new Date().toISOString().split('T')[0]}.json`);
          document.body.appendChild(downloadAnchor);
          downloadAnchor.click();
          downloadAnchor.remove();

          setNotification(prev => ({
            ...prev,
            type: 'backup_success',
            title: 'Pencadangan Berhasil!',
            message: 'Seluruh arsip data kasir Anda telah berhasil dikompilasi ke dalam file JSON berkas portabel.',
            progress: 100,
            stepText: 'Arsip JSON diunduh dengan aman.'
          }));
        } catch (err) {
          setNotification({
            show: true,
            type: 'error',
            title: 'Pencadangan Gagal',
            message: 'Terjadi masalah kegagalan format file pada sistem browser.',
            progress: 0,
            stepText: 'Gagal membuat file.'
          });
        }
      }, 1900);

    } catch (err) {
      setNotification({
        show: true,
        type: 'error',
        title: 'Gagal Memproses Data',
        message: 'Sistem kasir mendeteksi kesalahan data internal dalam database.',
        progress: 0,
        stepText: 'Gagal.'
      });
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileReader = new FileReader();
    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && (parsed.products || parsed.transactions || parsed.debts || parsed.expenses)) {
          const stats = {
            products: parsed.products?.length || 0,
            transactions: parsed.transactions?.length || 0,
            debts: parsed.debts?.length || 0,
            expenses: parsed.expenses?.length || 0
          };

          // Trigger explicit Confirmation Dialog notification before modifying state
          setNotification({
            show: true,
            type: 'confirm_restore',
            title: 'Konfirmasi Pemulihan Data',
            message: 'Apakah Anda yakin ingin memulihkan data? Seluruh produk, transaksi, hutang, dan sisa kasbon Anda saat ini akan dihapus dan digantikan sepenuhnya oleh data dari file cadangan ini.',
            progress: 0,
            stepText: 'Menunggu keputusan Anda...',
            stats,
            tempImportData: parsed
          });
        } else {
          setNotification({
            show: true,
            type: 'error',
            title: 'Format Berkas Salah',
            message: 'File JSON yang diunggah tidak memiliki struktur data toko Kasir Sembako resmi.',
            progress: 0,
            stepText: 'Integritas file ditolak.'
          });
        }
      } catch (err) {
        setNotification({
          show: true,
          type: 'error',
          title: 'Gagal Membaca File',
          message: 'Berkas cadangan tidak bisa dimuat oleh parser JSON. Kemungkinan file rusak atau terpotong.',
          progress: 0,
          stepText: 'Gagal parsing JSON.'
        });
      }
      // Reset input element value so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    fileReader.readAsText(files[0]);
  };

  const executeApplyRestore = () => {
    const parsed = notification.tempImportData;
    if (!parsed) return;

    setNotification(prev => ({
      ...prev,
      type: 'restore_progress',
      title: 'Memasukkan Data Cadangan',
      message: 'Menghubungkan set data baru ke sistem memori perangkat Anda...',
      progress: 20,
      stepText: 'Membersihkan tabel memori saat ini...'
    }));

    setTimeout(() => {
      setNotification(prev => ({
        ...prev,
        progress: 60,
        stepText: `Memulihkan ${notification.stats?.products || 0} produk & ${notification.stats?.transactions || 0} riwayat transaksi...`
      }));
    }, 500);

    setTimeout(() => {
      setNotification(prev => ({
        ...prev,
        progress: 85,
        stepText: 'Menghubungkan buku catatan kasbon dan pengeluaran harian...'
      }));
    }, 1000);

    setTimeout(() => {
      try {
        onImportBackup(parsed);
        setNotification(prev => ({
          ...prev,
          type: 'restore_success',
          title: 'Pemulihan Berhasil Selesai!',
          message: 'Luar biasa! Seluruh produk, transaksi penjualan, catatan kasbon, & sisa data telah dikembalikan ke kondisi cadangan.',
          progress: 100,
          stepText: 'Penyimpanan lokal berhasil disinkronkan.'
        }));
      } catch (err) {
        setNotification({
          show: true,
          type: 'error',
          title: 'Gagal Menyimpan Data',
          message: 'Sistem mengalami kegagalan saat menulis data cadangan ke penyimpanan Google Chrome local.',
          progress: 0,
          stepText: 'Kegagalan penyimpanan lokal.'
        });
      }
    }, 1500);
  };

  const closeNotification = () => {
    setNotification(prev => ({ ...prev, show: false }));
  };

  return (
    <div id="backup-view-root" className="bg-white rounded-2xl border border-slate-150/70 p-6 flex flex-col gap-6 max-w-2xl mx-auto shadow-xs mt-4 animate-fade-in relative">
      
      {/* Dynamic Popover Modal Notification System */}
      {notification.show && (
        <div id="backup-notification-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs animate-fade-in">
          <div id="backup-notification-card" className="bg-white rounded-3xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden flex flex-col p-6 animate-scale-up">
            
            {/* Header (Allows closing on success/error/confirm states) */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-50">
              <span className="font-sans font-black text-xs uppercase tracking-widest text-slate-400">
                Notifikasi Sistem Data
              </span>
              {(notification.type === 'backup_success' || notification.type === 'restore_success' || notification.type === 'error' || notification.type === 'confirm_restore') && (
                <button
                  id="close-notification-btn"
                  onClick={closeNotification}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Content Area */}
            <div className="mt-5 flex flex-col items-center text-center">
              
              {/* Dynamic Status Icon Circle */}
              {notification.type.includes('progress') ? (
                <div id="progress-spinner-wrapper" className="p-4 bg-indigo-50 text-indigo-600 rounded-full mb-4 animate-spin-slow">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                </div>
              ) : notification.type.includes('success') ? (
                <div id="success-icon-wrapper" className="p-4 bg-emerald-50 text-emerald-600 rounded-full mb-4">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
              ) : notification.type === 'confirm_restore' ? (
                <div id="warning-icon-wrapper" className="p-4 bg-amber-50 text-amber-600 rounded-full mb-4">
                  <AlertTriangle className="w-8 h-8 animate-pulse" />
                </div>
              ) : (
                <div id="error-icon-wrapper" className="p-4 bg-rose-50 text-rose-600 rounded-full mb-4">
                  <AlertTriangle className="w-8 h-8" />
                </div>
              )}

              {/* Title & Main Context */}
              <h3 id="notification-title" className="font-display font-black text-slate-800 text-base sm:text-lg tracking-tight">
                {notification.title}
              </h3>
              <p id="notification-description" className="text-xs text-slate-600 mt-2 leading-relaxed px-1">
                {notification.message}
              </p>

              {/* Statistics Details Grid */}
              {notification.stats && (
                <div id="notif-stats-box" className="mt-4 w-full bg-slate-50/80 rounded-2xl p-3 border border-slate-100 flex flex-col gap-1.5 text-left">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Isi Berkas Data:
                  </span>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-650">
                      <span>• Total Produk:</span>
                      <strong className="text-slate-800 font-bold">{notification.stats.products}</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-650">
                      <span>• Riwayat Sales:</span>
                      <strong className="text-slate-800 font-bold">{notification.stats.transactions}</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-650">
                      <span>• Buku Kasbon:</span>
                      <strong className="text-slate-800 font-bold">{notification.stats.debts}</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-650">
                      <span>• Pengeluaran:</span>
                      <strong className="text-slate-800 font-bold">{notification.stats.expenses}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Process micro-stepper and Progress Indicator */}
              {notification.type.includes('progress') && (
                <div id="notif-progress-wrapper" className="mt-5 w-full">
                  <div className="flex justify-between items-center text-[10px] font-extrabold text-indigo-650 mb-1.5">
                    <span className="uppercase tracking-widest">{notification.stepText}</span>
                    <span>{notification.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${notification.progress}%` }}
                    />
                  </div>
                </div>
              )}

            </div>

            {/* Dynamic Buttons for Actions */}
            <div id="notif-action-footer" className="mt-6 pt-4 border-t border-slate-50 flex items-center gap-3">
              {notification.type === 'confirm_restore' ? (
                <>
                  <button
                    id="cancel-restore-btn"
                    onClick={closeNotification}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl text-xs font-black transition-all cursor-pointer select-none"
                  >
                    Batalkan
                  </button>
                  <button
                    id="confirm-apply-restore-btn"
                    onClick={executeApplyRestore}
                    className="flex-1 py-2.5 bg-emerald-100 hover:bg-emerald-200 active:scale-95 text-emerald-950 rounded-xl text-xs font-black shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer select-none"
                  >
                    <span>Ya, Pulihkan</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <button
                  id="dismiss-notif-btn"
                  onClick={closeNotification}
                  className="w-full py-2.5 bg-emerald-100 hover:bg-emerald-200 active:scale-95 text-emerald-950 rounded-xl text-xs font-black shadow-md shadow-emerald-100/50 transition-all cursor-pointer select-none"
                >
                  Selesai
                </button>
              )}
            </div>

          </div>
        </div>
      )}
      
      {/* Title Header */}
      <div id="backup-heading-block" className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
          <Database className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-display font-black text-slate-800 text-sm sm:text-base uppercase tracking-wider">
            Manajemen Pencadangan Data Toko
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Sangat disarankan untuk mencadangkan data Anda secara berkala guna mencegah kehilangan akibat hapus cache browser.
          </p>
        </div>
      </div>

      {/* Explanation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        
        {/* Export Details */}
        <div id="export-card-wrapper" className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
          <div>
            <span className="font-extrabold text-[10px] text-indigo-600 uppercase tracking-widest block mb-1">Unduh Data Toko</span>
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
              Ekspor seluruh data barang stok, log transaksi, buku catatan kasbon, beserta pengeluaran operasional ke dalam file format JSON portabel.
            </p>
          </div>
          <button
            id="export-action-btn"
            onClick={handleExportBackup}
            className="mt-6 w-full py-3 bg-emerald-100 hover:bg-emerald-200 active:scale-[98%] text-emerald-950 rounded-xl text-xs font-black shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none"
          >
            <FolderDown className="w-4 h-4 text-white" />
            <span>Pencadangan Instan (Backup)</span>
          </button>
        </div>

        {/* Import Details */}
        <div id="import-card-wrapper" className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
          <div>
            <span className="font-extrabold text-[10px] text-amber-600 uppercase tracking-widest block mb-1">Pulihkan Data Toko</span>
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
              Pilih file data JSON cadangan Anda yang telah diunduh sebelumnya untuk mengembalikan isi data toko secara instan.
            </p>
          </div>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportBackup}
            accept=".json"
            className="hidden"
          />
          <button
            id="import-action-btn"
            onClick={() => fileInputRef.current?.click()}
            className="mt-6 w-full py-3 bg-amber-500 hover:bg-amber-600 active:scale-[98%] text-white rounded-xl text-xs font-black shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none"
          >
            <FolderUp className="w-4 h-4 text-white" />
            <span>Pulihkan Cadangan (Restore)</span>
          </button>
        </div>

      </div>

      {/* Tips footer block */}
      <div id="offline-policy-block" className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-100 flex gap-2.5">
        <Database className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-[11.5px] text-emerald-950 font-medium leading-relaxed">
          <strong>Keamanan Data Offline-First:</strong> Karena aplikasi berjalan 100% lokal, proses ekspor dan impor file cadangan terjadi seketika langsung di memori perangkat Anda tanpa membutuhkan kuota internet atau dependensi cloud eksternal.
        </div>
      </div>

    </div>
  );
}
