/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Store, ShoppingBag, AlertTriangle, BookOpen, TrendingUp, TrendingDown, Calendar, LayoutDashboard, QrCode, Smartphone, X, Copy, Check, LogOut, Settings, User, Key, Info, HelpCircle, Database, Wifi, WifiOff } from 'lucide-react';
import { formatRupiah } from '../utils/format';
import { RegisteredUser } from './LoginPortal';
import warungLogo from '../assets/images/saf_kasir_logo.jpg';

interface HeaderProps {
  totalSalesToday: number;
  totalProfitToday: number;
  lowStockCount: number;
  totalDebtAmount: number;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  // Multi-Store additions
  stores: { id: string; name: string }[];
  activeStoreId: string;
  onAddStore: (name: string) => void;
  onSwitchStore: (id: string) => void;
  // Auth additions
  currentUser: RegisteredUser | null;
  onLogout: () => void;
  onUpdateUser: (user: RegisteredUser) => void;
}

export default function Header({
  totalSalesToday,
  totalProfitToday,
  lowStockCount,
  totalDebtAmount,
  activeTab,
  setActiveTab,
  stores,
  activeStoreId,
  onAddStore,
  onSwitchStore,
  currentUser,
  onLogout,
  onUpdateUser
}: HeaderProps) {
  const [time, setTime] = useState(new Date());
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Active polling fallback for iframes/sandboxed environments where events might be suppressed
    const interval = setInterval(() => {
      setIsOnline(navigator.onLine);
    }, 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  // Form states for profile and settings
  const [storeName, setStoreName] = useState(currentUser?.storeName || '');
  const [storeAddress, setStoreAddress] = useState(currentUser?.address || '');
  const [userEmail, setUserEmail] = useState(currentUser?.email || '');
  const [qrisData, setQrisData] = useState(currentUser?.qrisData || '');
  const [qrisImage, setQrisImage] = useState(currentUser?.qrisImage || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMess, setErrorMess] = useState('');
  const [successMess, setSuccessMess] = useState('');

  // Sync state values when current user details load
  useEffect(() => {
    if (currentUser) {
      setStoreName(currentUser.storeName);
      setStoreAddress(currentUser.address || '');
      setUserEmail(currentUser.email || '');
      setQrisData(currentUser.qrisData || '');
      setQrisImage(currentUser.qrisImage || '');
    }
  }, [currentUser]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const formatHeaderDate = (d: Date) => {
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const navItems = [
    { id: 'summary', name: 'Ringkasan', icon: LayoutDashboard, color: 'text-indigo-600 bg-indigo-50 border-indigo-100 hover:bg-indigo-100', tooltip: 'Melihat ringkasan laba rugi, barang kritis, & rincian kas masuk/keluar hari ini' },
    { id: 'pos', name: 'Kasir', icon: ShoppingBag, color: 'text-emerald-600 bg-emerald-50 border-emerald-100 hover:bg-emerald-100', tooltip: 'Menu kasir penjualan utama, input transaksi belanja, scan barcode, & pembayaran' },
    { id: 'stock', name: 'Stok', icon: Store, color: 'text-blue-600 bg-blue-50 border-blue-100 hover:bg-blue-100', tooltip: 'Kelola persediaan barang, edit modal belanja, harga jual, stok minimum, & kategori' },
    { id: 'debt', name: 'Utang', icon: BookOpen, color: 'text-rose-600 bg-rose-50 border-rose-100 hover:bg-rose-100', tooltip: 'Catatan kasbon pelanggan kasir, cicilan utang, & sisa tunggakan pembayaran' },
    { id: 'expense', name: 'Biaya', icon: TrendingDown, color: 'text-red-600 bg-red-50 border-red-100 hover:bg-red-100', tooltip: 'Mencatat pengeluaran operasional kasir, seperti beli token listrik, air, & gaji' },
    { id: 'history', name: 'Laporan', icon: TrendingUp, color: 'text-purple-600 bg-purple-50 border-purple-100 hover:bg-purple-150', tooltip: 'Rincian grafik keuangan bulanan, riwayat penjualan, & daftar transaksi lengkap' },
    { id: 'backup', name: 'Backup', icon: Database, color: 'text-amber-600 bg-amber-50 border-amber-100 hover:bg-amber-100', tooltip: 'Unduh seluruh data backup kasir Anda atau pulihkan data lama dengan file JSON' }
  ];

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMess('');
    setSuccessMess('');

    if (!storeName.trim() || !storeAddress.trim() || !userEmail.trim()) {
      setErrorMess('Harap lengkapi nama toko, alamat toko dan email pemilik.');
      return;
    }

    if (storeName.trim().length > 25) {
      setErrorMess('Nama toko dibatasi maksimal 25 karakter.');
      return;
    }

    if (storeAddress.trim().length > 50) {
      setErrorMess('Alamat toko dibatasi maksimal 50 karakter.');
      return;
    }

    // Handing password update if typed
    let nextPassword = currentUser?.password || '';
    if (newPassword) {
      if (newPassword.length < 6) {
        setErrorMess('Password baru minimal harus berisi 6 karakter.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMess('Konfirmasi password baru tidak cocok!');
        return;
      }
      nextPassword = newPassword;
    }

    if (!currentUser) return;

    const updatedUser: RegisteredUser = {
      ...currentUser,
      storeName: storeName.trim(),
      address: storeAddress.trim(),
      email: userEmail.trim(),
      password: nextPassword,
      qrisData: qrisData.trim(),
      qrisImage: qrisImage.trim()
    };

    onUpdateUser(updatedUser);
    setSuccessMess('Profil kasir berhasil diperbarui!');
    setNewPassword('');
    setConfirmPassword('');
    
    setTimeout(() => {
      setShowSettingsModal(false);
      setSuccessMess('');
    }, 1200);
  };

  return (
    <header id="app-header" className="bg-white border-b border-slate-100 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6 lg:px-8">
        
        {/* Parent row: forced inline layout so 'Keluar' is always on the top bar aligned right */}
        <div className="flex flex-row items-center justify-between gap-2.5">
          
          {/* Left Block: Logo & Clock / KOP Nama Warung */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full border border-slate-100 p-0.5 overflow-hidden shrink-0 shadow-xs bg-white">
              <img 
                src={warungLogo} 
                alt="SAF Kasir Logo" 
                className="w-full h-full object-cover rounded-full"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="font-display font-black text-xs sm:text-base tracking-tight text-indigo-800 leading-tight uppercase font-mono truncate">
                  {currentUser ? currentUser.storeName : 'Kasir'}
                </h1>
                <span className="bg-emerald-50 border border-emerald-250 text-emerald-700 text-[8.5px] font-black px-1.5 py-[0.5px] rounded-sm uppercase tracking-wider scale-95 origin-left">
                  Gratis
                </span>
                {isOnline ? (
                  <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[8.5px] font-bold px-1.5 py-[0.5px] rounded-sm uppercase tracking-wider scale-95 origin-left flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <Wifi className="w-2.5 h-2.5 text-emerald-600" />
                    Online
                  </span>
                ) : (
                  <span className="bg-amber-50 text-amber-900 border border-amber-300 text-[8.5px] font-extrabold px-1.5 py-[0.5px] rounded-sm uppercase tracking-wider scale-95 origin-left flex items-center gap-1 shrink-0 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                    <WifiOff className="w-2.5 h-2.5 text-amber-700" />
                    Offline (Simpan Lokal)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-slate-500 font-medium leading-none mt-0.5">
                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{formatHeaderDate(time)} • {time.toLocaleTimeString('id-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
              </div>
            </div>
          </div>

          {/* Right Block: Action Buttons Cog Settings & Logout */}
          <div id="hp-header-actions" className="flex items-center gap-1.5 shrink-0">
            {currentUser && (
              <button
                onClick={() => {
                  setErrorMess('');
                  setSuccessMess('');
                  setShowSettingsModal(true);
                }}
                className="flex items-center justify-center p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60 rounded-lg transition-all cursor-pointer"
                title="Kelola Profil Kasir & Ganti Password"
              >
                <Settings className="w-4 h-4 text-slate-500" />
              </button>
            )}

            <button
              onClick={onLogout}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-705 border border-rose-100 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer select-none active:scale-95 text-rose-700"
              title="Keluar dari akun Kasir Anda"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>

        </div>

        {!isOnline && (
          <div className="mt-2.5 p-2.5 bg-amber-50/90 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-900 animate-fade-in text-left">
            <WifiOff className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[10.5px] leading-relaxed font-sans">
              <span className="font-extrabold block text-[11px] mb-0.5 text-amber-950">💡 Koneksi Terputus (Mode Offline Aktif)</span>
              Semua fitur kasir penjualan, hitung stok, pengeluaran, dan buku utang tetap berfungsi 100% normal. Seluruh data disimpan aman di HP/komputer Anda dan akan **disinkronkan otomatis** ke database online (Firestore) seketika Anda mendapatkan sinyal internet kembali!
            </div>
          </div>
        )}

        {/* Global Tab / Menu Navigation */}
        <div className="flex flex-nowrap overflow-x-auto sm:flex-wrap items-center gap-1.5 mt-2.5 pb-1.5 select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4 sm:mx-0 sm:px-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap border shrink-0 ${
                  isActive 
                    ? 'bg-emerald-100 text-emerald-950 border-emerald-300 shadow-sm shadow-emerald-100/50 scale-[1.01]' 
                    : 'bg-white text-slate-600 border-slate-200/80 hover:bg-emerald-50 hover:text-emerald-950 hover:border-emerald-250'
                }`}
                title={item.tooltip}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-800' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Settings Modal (Edit Profile & Password Modifier) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setShowSettingsModal(false)}
          />
          <div className="mt-24 sm:mt-32 mb-12 relative bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-100 p-6 flex flex-col gap-4 z-10 max-h-[85vh] sm:max-h-[80vh] overflow-y-auto font-sans">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-1.5">
                <Settings className="w-5 h-5 text-indigo-600" />
                <h3 className="font-display font-bold text-xs sm:text-sm text-slate-800 uppercase tracking-wider">Pengaturan Profil Kasir</h3>
              </div>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-650 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMess && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-[11px] text-rose-700 font-bold leading-normal flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{errorMess}</span>
              </div>
            )}

            {successMess && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-[11px] text-emerald-800 font-bold leading-normal flex items-start gap-1.5">
                <Check className="w-4 h-4 text-emerald-550 shrink-0" />
                <span>{successMess}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="flex flex-col gap-3.5 text-xs text-slate-600">
              
              <div className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <label className="font-bold text-[10.5px] uppercase text-slate-500 tracking-wider">Nama Toko / Kasir</label>
                  <span className="text-[9px] text-slate-400 font-bold">{storeName.length}/25</span>
                </div>
                <input
                  type="text"
                  maxLength={25}
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="bg-slate-50 border border-slate-205 focus:bg-white focus:border-indigo-500 rounded-xl px-3 py-2 outline-none font-medium text-slate-800"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <label className="font-bold text-[10.5px] uppercase text-slate-500 tracking-wider">Alamat Sembako</label>
                  <span className="text-[9px] text-slate-400 font-bold">{storeAddress.length}/50</span>
                </div>
                <input
                  type="text"
                  maxLength={50}
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  className="bg-slate-50 border border-slate-205 focus:bg-white focus:border-indigo-500 rounded-xl px-3 py-2 outline-none font-medium text-slate-800"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-bold text-[10.5px] uppercase text-slate-500 tracking-wider">Email Pemilik Akun</label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="bg-slate-50 border border-slate-205 focus:bg-white focus:border-indigo-500 rounded-xl px-3 py-2 outline-none font-medium text-slate-800"
                />
              </div>

              <div className="border-t border-slate-100 pt-3 mt-1.5 flex flex-col gap-3">
                <span className="text-[10.5px] font-bold text-indigo-700 block mb-0.5 uppercase tracking-wide">Pengaturan Pembayaran QRIS</span>
                <p className="text-[10px] text-slate-450 leading-relaxed -mt-1 py-0.5">
                  Atur kode QRIS kasir Anda agar tampil otomatis di layar kasir saat pelanggan memilih metode pembayaran QRIS.
                </p>
                
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-[10px] text-slate-500 uppercase">Teks Digital QRIS (ID QRIS / Teks Barcode)</label>
                    <input
                      type="text"
                      value={qrisData}
                      placeholder="Contoh: ID1020304050607 atau link transfer"
                      onChange={(e) => setQrisData(e.target.value)}
                      className="bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl px-3 py-2 outline-none font-medium text-slate-800"
                    />
                    <p className="text-[9px] text-indigo-600 font-bold leading-normal">
                      *Jika diisi, aplikasi akan otomatis mem-generate QR Code dinamis untuk Anda!
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-[10px] text-slate-500 uppercase">Gambar Kode QRIS (URL atau Unggah File)</label>
                    
                    <input
                      type="text"
                      value={qrisImage.startsWith('data:') ? '' : qrisImage}
                      placeholder={qrisImage.startsWith('data:') ? "File Berkas diunggah (Base64)" : "Masukkan URL Gambar QRIS (jika ada)"}
                      onChange={(e) => setQrisImage(e.target.value)}
                      className="bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl px-3 py-2 outline-none font-medium text-slate-800"
                    />

                    <div className="flex items-center gap-2">
                      <label className="flex-1 flex items-center justify-center gap-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg border border-slate-250 cursor-pointer select-none text-[10.5px] transition-colors">
                        <span>Pilih File Gambar</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 150 * 1024) {
                                setErrorMess('Gambar QRIS terlalu besar! Mohon gunakan file di bawah 150KB.');
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                if (event.target?.result) {
                                  setQrisImage(event.target.result as string);
                                  setErrorMess('');
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      {qrisImage && (
                        <button
                          type="button"
                          onClick={() => setQrisImage('')}
                          className="text-rose-650 hover:text-rose-800 font-bold text-[10.5px] px-2 py-1 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                        >
                          Hapus Gambar
                        </button>
                      )}
                    </div>

                    {qrisImage && (
                      <div className="border border-slate-100 rounded-xl p-2 bg-slate-50 flex items-center justify-center">
                        <img 
                          src={qrisImage} 
                          alt="QRIS Preview" 
                          referrerPolicy="no-referrer"
                          className="h-28 w-28 object-contain rounded-lg border border-slate-200" 
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* WANODYA Creator Attribution Card */}
              <div className="mt-3.5 p-3 rounded-xl bg-indigo-50/50 border border-indigo-100/60 flex items-start gap-2 select-all">
                <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[9.5px] font-bold text-slate-400 block uppercase tracking-wide">Informasi Lisensi</span>
                  <p className="text-[10.5px] text-indigo-950 font-bold leading-relaxed mt-0.5">
                    Aplikasi dibuat dan dikelola oleh <span className="underline">Jopur</span> dari kursus <span className="underline text-indigo-650">WANODYA Bandung</span>.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition-colors cursor-pointer mt-1"
              >
                Simpan Pembaharuan
              </button>
            </form>

          </div>
        </div>
      )}
    </header>
  );
}
