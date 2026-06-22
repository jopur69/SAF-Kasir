import React, { useState, useEffect, useMemo } from 'react';
import { Shield, Trash2, Store, Calendar, LogOut, Info, AlertTriangle, Users, UserCheck, Phone, Mail, FileText, Check, Key, Settings, X, Sliders, Lock, Unlock, Eye, EyeOff, MessageSquare, Clock, Filter, Search, Database } from 'lucide-react';
import { RegisteredUser } from './LoginPortal';
import { db, handleFirestoreError, OperationType, isFirebasePlaceholder } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';

interface AdminPanelProps {
  onLogout: () => void;
}

export default function AdminPanel({ onLogout }: AdminPanelProps) {
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [showConfirmId, setShowConfirmId] = useState<string | null>(null);

  // States for Editing individual user usage limits
  const [editingUser, setEditingUser] = useState<RegisteredUser | null>(null);
  const [editStatus, setEditStatus] = useState<'active' | 'suspended'>('active');
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [editMaxTransactions, setEditMaxTransactions] = useState<number>(0);

  // Superadmin profile states
  const [showAdminProfileModal, setShowAdminProfileModal] = useState(false);
  const [adminName, setAdminName] = useState('Jopur (kursus WANODYA Bandung)');
  const [adminPhone, setAdminPhone] = useState('085872329811');
  const [adminEmail, setAdminEmail] = useState('adminkursus@gmail.com');
  const [adminNotes, setAdminNotes] = useState('');
  const [hidePhone, setHidePhone] = useState(false);
  const [hideEmail, setHideEmail] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [disableFeedback, setDisableFeedback] = useState(false);
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // States for User Feedbacks
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [fbFilterCategory, setFbFilterCategory] = useState<string>('Semua');
  const [fbConfirmDeleteId, setFbConfirmDeleteId] = useState<string | null>(null);

  // States for Quick Polling Management
  const [polls, setPolls] = useState<any[]>([]);
  const [pollResponses, setPollResponses] = useState<any[]>([]);
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [opt1, setOpt1] = useState('');
  const [opt2, setOpt2] = useState('');
  const [opt3, setOpt3] = useState('');
  const [opt4, setOpt4] = useState('');
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  const [pollError, setPollError] = useState('');
  const [pollSuccess, setPollSuccess] = useState('');
  const [pollConfirmDeleteId, setPollConfirmDeleteId] = useState<string | null>(null);

  // States for Admin Dashboard Navigation Menu & User Searching
  const [activeTab, setActiveTab] = useState<'kasir' | 'feedback' | 'polling'>('kasir');
  const [searchTerm, setSearchTerm] = useState('');

  // States for database capacity warning simulation (so superadmin can test the feature)
  const [forceSimulateWarning, setForceSimulateWarning] = useState(false);

  // Calculate cloud database storage usage (Estimating against Firestore Spark Plan limit of 1 GB)
  const cloudStorageStatus = useMemo(() => {
    // 1 GB standard free Firebase Spark Storage space is 1,048,576 KB
    const standardLimitKB = 1024 * 1024;
    
    // Estimate bytes of current dashboard data
    const serializedUsers = JSON.stringify(users).length * 2;
    const serializedFeedbacks = JSON.stringify(feedbacks).length * 2;
    const serializedPolls = JSON.stringify(polls).length * 2;
    const serializedPollResponses = JSON.stringify(pollResponses).length * 2;
    
    const coreDataBytes = serializedUsers + serializedFeedbacks + serializedPolls + serializedPollResponses;
    // Estimate that each active registered shop has on average 150 KB of total operational record data in Firestore
    const estimatedStoreUsageBytes = users.length * 150 * 1024;
    
    const totalBytes = coreDataBytes + estimatedStoreUsageBytes;
    let totalKB = totalBytes / 1024;
    
    // If warning simulation is forced, adjust usage to 92.5% to display the warning instantly inside Admin Panel
    if (forceSimulateWarning) {
      totalKB = standardLimitKB * 0.925;
    }
    
    const percentage = (totalKB / standardLimitKB) * 100;
    
    return {
      usedKB: Math.round(totalKB),
      limitKB: standardLimitKB,
      percentage: Math.min(100, Math.round(percentage * 10) / 10),
      isNearLimit: percentage >= 90 // Warn when within 10% (i.e. >= 90% full)
    };
  }, [users, feedbacks, polls, pollResponses, forceSimulateWarning]);

  // Load registered users & profile on mount
  useEffect(() => {
    fetchUsersAndProfiles();
  }, []);

  const fetchUsersAndProfiles = async () => {
    if (isFirebasePlaceholder || !navigator.onLine) {
      console.log('Skipping cloud sync in AdminPanel (Offline/Placeholder Mode)');
      loadUsers();
      
      // Load local superadmin profile
      const savedProfile = localStorage.getItem('kasir_superadmin_profile');
      if (savedProfile) {
        try {
          const parsed = JSON.parse(savedProfile);
          if (parsed.name) setAdminName(parsed.name);
          let loadedPhone = parsed.phone || '085872329811';
          if (loadedPhone === '081234567890') loadedPhone = '085872329811';
          setAdminPhone(loadedPhone);
          let loadedEmail = parsed.email || 'adminkursus@gmail.com';
          if (loadedEmail === 'support.kasir@gmail.com' || loadedEmail === 'support.warung@gmail.com') loadedEmail = 'adminkursus@gmail.com';
          setAdminEmail(loadedEmail);
          let loadedNotes = parsed.notes || '';
          if (loadedNotes.includes('Bantuan Teknis Kasir Sembako')) loadedNotes = '';
          setAdminNotes(loadedNotes);
          setDisableFeedback(!!parsed.disableFeedback);
          setHidePhone(!!parsed.hidePhone);
          setHideEmail(!!parsed.hideEmail);
        } catch {}
      }
      return;
    }

    try {
      // Fetch users from cloud Firestore
      const snap = await getDocs(collection(db, 'registered_users'));
      const userList: RegisteredUser[] = [];
      snap.forEach(docSnap => {
        userList.push(docSnap.data() as RegisteredUser);
      });
      // Sort users by dateCreated desc
      userList.sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());
      setUsers(userList);
      localStorage.setItem('kasir_registered_users', JSON.stringify(userList));
    } catch (err) {
      console.error('Failed to load registered users from cloud, loading from local cache:', err);
      loadUsers();
    }

    // Load User Feedbacks from cloud database
    try {
      const fbSnap = await getDocs(collection(db, 'feedback'));
      const fbList: any[] = [];
      fbSnap.forEach(docSnap => {
        fbList.push(docSnap.data());
      });
      fbList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setFeedbacks(fbList);
    } catch (err) {
      console.error('Failed to load user feedbacks from cloud database:', err);
      handleFirestoreError(err, OperationType.GET, 'feedback');
    }

    // Load polls from cloud database
    try {
      const pollsSnap = await getDocs(collection(db, 'polls'));
      const pollsList: any[] = [];
      pollsSnap.forEach(docSnap => {
        pollsList.push(docSnap.data());
      });
      pollsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPolls(pollsList);
    } catch (err) {
      console.error('Failed to load polls from cloud database:', err);
      handleFirestoreError(err, OperationType.GET, 'polls');
    }

    // Load poll responses to count aggregate tallies
    try {
      const respSnap = await getDocs(collection(db, 'poll_responses'));
      const respList: any[] = [];
      respSnap.forEach(docSnap => {
        respList.push(docSnap.data());
      });
      setPollResponses(respList);
    } catch (err) {
      console.error('Failed to load poll responses from cloud database:', err);
      handleFirestoreError(err, OperationType.GET, 'poll_responses');
    }

    try {
      // Load Superadmin profile from config/superadmin
      const superDoc = await getDoc(doc(db, 'config', 'superadmin'));
      if (superDoc.exists()) {
        const parsed = superDoc.data();
        if (parsed.name) setAdminName(parsed.name);
        
        let loadedPhone = parsed.phone || '085872329811';
        if (loadedPhone === '081234567890') loadedPhone = '085872329811';
        setAdminPhone(loadedPhone);

        let loadedEmail = parsed.email || 'adminkursus@gmail.com';
        if (loadedEmail === 'support.kasir@gmail.com' || loadedEmail === 'support.warung@gmail.com') loadedEmail = 'adminkursus@gmail.com';
        setAdminEmail(loadedEmail);

        let loadedNotes = parsed.notes || '';
        if (loadedNotes.includes('Bantuan Teknis Kasir Sembako')) loadedNotes = '';
        setAdminNotes(loadedNotes);

        setDisableFeedback(!!parsed.disableFeedback);
        setHidePhone(!!parsed.hidePhone);
        setHideEmail(!!parsed.hideEmail);
      } else {
        // Default local fallback
        const savedProfile = localStorage.getItem('kasir_superadmin_profile');
        if (savedProfile) {
          try {
            const parsed = JSON.parse(savedProfile);
            if (parsed.name) setAdminName(parsed.name);
            
            let loadedPhone = parsed.phone || '085872329811';
            if (loadedPhone === '081234567890') loadedPhone = '085872329811';
            setAdminPhone(loadedPhone);

            let loadedEmail = parsed.email || 'adminkursus@gmail.com';
            if (loadedEmail === 'support.kasir@gmail.com' || loadedEmail === 'support.warung@gmail.com') loadedEmail = 'adminkursus@gmail.com';
            setAdminEmail(loadedEmail);

            let loadedNotes = parsed.notes || '';
            if (loadedNotes.includes('Bantuan Teknis Kasir Sembako')) loadedNotes = '';
            setAdminNotes(loadedNotes);

            setDisableFeedback(!!parsed.disableFeedback);
            setHidePhone(!!parsed.hidePhone);
            setHideEmail(!!parsed.hideEmail);
          } catch {}
        }
      }
    } catch (err) {
      console.error('Failed to load superadmin profile from cloud:', err);
    }
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    setPollError('');
    setPollSuccess('');
    
    if (!newPollQuestion.trim()) {
      setPollError('Pertanyaan polling tidak boleh kosong.');
      return;
    }

    const optionsList = [opt1, opt2, opt3, opt4]
      .map(o => o.trim())
      .filter(o => o.length > 0);

    if (optionsList.length < 2) {
      setPollError('Harap berikan minimal 2 pilihan jawaban.');
      return;
    }

    setIsCreatingPoll(true);
    const pollId = `poll_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    try {
      const payload = {
        id: pollId,
        question: newPollQuestion.trim(),
        options: optionsList,
        status: 'Aktif',
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'polls', pollId), payload);
      
      // Reset form fields
      setNewPollQuestion('');
      setOpt1('');
      setOpt2('');
      setOpt3('');
      setOpt4('');
      setPollSuccess('Polling cepat berhasil diterbitkan ke jejaring kasir pelanggan!');
      
      // Reload polls cached list
      await fetchUsersAndProfiles();
    } catch (err: any) {
      console.error('Failed to publish poll:', err);
      setPollError('Gagal menerbitkan polling: ' + (err.message || 'Error'));
    } finally {
      setIsCreatingPoll(false);
    }
  };

  const handleDeletePoll = async (pollId: string) => {
    setPollError('');
    setPollSuccess('');
    try {
      // 1. Delete poll document
      await deleteDoc(doc(db, 'polls', pollId));

      // 2. Clear matching responses to keep database consistent
      const associatedResponses = pollResponses.filter(r => r.pollId === pollId);
      for (const resp of associatedResponses) {
        await deleteDoc(doc(db, 'poll_responses', resp.id));
      }

      setPollSuccess('Polling dan seluruh data tanggapannya berhasil dihapus.');
      setPollConfirmDeleteId(null);
      await fetchUsersAndProfiles();
    } catch (err: any) {
      console.error('Failed to delete poll:', err);
      setPollError('Gagal menghapus polling: ' + (err.message || 'Error'));
    }
  };

  const handleTogglePollStatus = async (pollId: string, currentStatus: string) => {
    setPollError('');
    const nextStatus = currentStatus === 'Aktif' ? 'Nonaktif' : 'Aktif';
    try {
      await updateDoc(doc(db, 'polls', pollId), {
        status: nextStatus
      });
      await fetchUsersAndProfiles();
    } catch (err: any) {
      console.error('Failed to toggle poll status:', err);
      setPollError('Gagal mengubah status: ' + (err.message || 'Error'));
    }
  };

  const loadUsers = () => {
    const saved = localStorage.getItem('kasir_registered_users');
    if (saved) {
      try {
        setUsers(JSON.parse(saved));
      } catch (e) {
        console.error("Gagal membaca list registrasi: ", e);
      }
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    let updatedPassword = '';
    if (newAdminPassword) {
      if (newAdminPassword.length < 6) {
        setPasswordError('Sandi baru Super Admin minimal harus terdiri dari 6 karakter.');
        return;
      }
      if (newAdminPassword !== confirmAdminPassword) {
        setPasswordError('Konfirmasi sandi baru Super Admin tidak cocok!');
        return;
      }
      updatedPassword = newAdminPassword.trim();
    }

    try {
      const profile: any = {
        name: adminName.trim(),
        phone: adminPhone.trim(),
        email: adminEmail.trim(),
        notes: adminNotes.trim(),
        hidePhone: hidePhone,
        hideEmail: hideEmail,
      };
      if (updatedPassword) {
        profile.password = updatedPassword;
      }

      await setDoc(doc(db, 'config', 'superadmin'), profile, { merge: true });

      // Local storage cache
      localStorage.setItem('kasir_superadmin_profile', JSON.stringify(profile));
      if (updatedPassword) {
        localStorage.setItem('kasir_superadmin_password', updatedPassword);
        setNewAdminPassword('');
        setConfirmAdminPassword('');
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setShowAdminProfileModal(false);
      }, 2000);
    } catch (err: any) {
      console.error('Error saving superadmin profile to cloud:', err);
      setPasswordError('Gagal menyimpan ke cloud: ' + err.message);
    }
  };

  const handleDeleteKasir = async (userId: string) => {
    try {
      const targetUser = users.find(u => u.id === userId);
      
      // 1. Delete from Firestore registered_users
      await deleteDoc(doc(db, 'registered_users', userId));

      // 2. Delete mapping in usernames
      if (targetUser && targetUser.username) {
        await deleteDoc(doc(db, 'usernames', targetUser.username.toLowerCase()));
      }

      // 3. Delete user configuration
      await deleteDoc(doc(db, 'users', userId));

      // Clear local caches as well
      const updatedUsers = users.filter(u => u.id !== userId);
      localStorage.setItem('kasir_registered_users', JSON.stringify(updatedUsers));
      
      const savedStores = localStorage.getItem('kasir_stores');
      if (savedStores) {
        try {
          const storeEntries = JSON.parse(savedStores);
          const filteredStoreEntries = storeEntries.filter((s: any) => s.id !== userId);
          localStorage.setItem('kasir_stores', JSON.stringify(filteredStoreEntries));
        } catch {}
      }

      localStorage.removeItem(`kasir_products_${userId}`);
      localStorage.removeItem(`kasir_transactions_${userId}`);
      localStorage.removeItem(`kasir_debts_${userId}`);
      localStorage.removeItem(`kasir_expenses_${userId}`);

      setUsers(updatedUsers);
      setShowConfirmId(null);
    } catch (err: any) {
      console.error('Error deleting user from cloud:', err);
      alert('Gagal menghapus kasir dari cloud database: ' + err.message);
    }
  };

  const getTxCount = (userId: string) => {
    const key = userId === 'default' ? 'kasir_transactions' : `kasir_transactions_${userId}`;
    const data = localStorage.getItem(key);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed.length : 0;
      } catch {}
    }
    return 0;
  };

  const handleOpenLimitModal = (user: RegisteredUser) => {
    setEditingUser(user);
    setEditStatus(user.status || 'active');
    setEditExpiryDate(user.expiryDate || '');
    setEditMaxTransactions(user.maxTransactions || 0);
  };

  const handleSaveUserLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const updatedFields: any = {
        status: editStatus,
        expiryDate: editExpiryDate || null,
        maxTransactions: editMaxTransactions > 0 ? editMaxTransactions : null
      };

      // Update in Firestore
      await setDoc(doc(db, 'registered_users', editingUser.id), updatedFields, { merge: true });

      // Update local set state
      const updated = users.map(u => {
        if (u.id === editingUser.id) {
          return {
            ...u,
            status: editStatus,
            expiryDate: editExpiryDate || undefined,
            maxTransactions: editMaxTransactions > 0 ? editMaxTransactions : undefined
          };
        }
        return u;
      });

      localStorage.setItem('kasir_registered_users', JSON.stringify(updated));
      setUsers(updated);

      // Sync active cache
      const savedActiveUserStr = localStorage.getItem('kasir_current_user');
      if (savedActiveUserStr) {
        try {
          const activeUserObj = JSON.parse(savedActiveUserStr);
          if (activeUserObj.id === editingUser.id) {
            const updatedActiveUser = {
              ...activeUserObj,
              status: editStatus,
              expiryDate: editExpiryDate || undefined,
              maxTransactions: editMaxTransactions > 0 ? editMaxTransactions : undefined
            };
            localStorage.setItem('kasir_current_user', JSON.stringify(updatedActiveUser));
          }
        } catch {}
      }

      setEditingUser(null);
    } catch (err: any) {
      console.error('Error updating limits in cloud:', err);
      alert('Gagal menyimpan batasan ke cloud database: ' + err.message);
    }
  };

  const handleUpdateFeedbackStatus = async (fbId: string, nextStatus: string) => {
    try {
      await updateDoc(doc(db, 'feedback', fbId), { status: nextStatus });
      setFeedbacks(prev => prev.map(f => f.id === fbId ? { ...f, status: nextStatus } : f));
    } catch (err: any) {
      console.error('Failed to update feedback status in cloud:', err);
      alert('Gagal merubah status saran: ' + err.message);
    }
  };

  const handleDeleteFeedback = async (fbId: string) => {
    try {
      await deleteDoc(doc(db, 'feedback', fbId));
      setFeedbacks(prev => prev.filter(f => f.id !== fbId));
      setFbConfirmDeleteId(null);
    } catch (err: any) {
      console.error('Failed to delete feedback from cloud:', err);
      alert('Gagal menghapus saran dari cloud database: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      
      {/* Sticky Navigation Header Bar (Matching the Kasir Header aesthetic) */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-2.5 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          
          {/* Logo brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 bg-rose-600 rounded-lg text-white shadow-sm shadow-rose-100 shrink-0">
              <Shield className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-black text-xs sm:text-base tracking-tight text-rose-700 leading-none uppercase font-mono truncate">
                Panel Superadmin
              </h1>
              <span className="text-[9px] sm:text-[10px] text-slate-500 font-bold leading-none mt-1 block">
                Monitoring Penggunaan & Batas Layanan Aplikasi
              </span>
            </div>
          </div>

          {/* Top Right Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Gear Cog icon with explicit tooltip */}
            <button
              onClick={() => {
                setPasswordError('');
                setShowAdminProfileModal(true);
              }}
              className="flex items-center justify-center p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 rounded-xl transition-all cursor-pointer active:scale-95 relative group"
              title="Pengaturan Kontak & Profil Pengembang (Ubah Sandi & Profil)"
            >
              <Settings className="w-4.5 h-4.5 text-slate-550 animate-spin-slow" />
              {/* Tooltip */}
              <div className="invisible group-hover:visible absolute right-0 top-full mt-2 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-md whitespace-nowrap z-50">
                Profil Kontak & Ganti Sandi Admin
              </div>
            </button>

            {/* Logout panel */}
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-705 border border-rose-100 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer select-none active:scale-95 text-rose-700"
              title="Keluar dari Panel Utama Superadmin"
            >
              <LogOut className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="hidden sm:inline">Keluar panel Admin</span>
            </button>
          </div>

        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6 animate-fade-in">

        {/* CLOUD DATABASE RESOURCE WARNING BANNER (Alerts when <= 10% space remaining) */}
        {cloudStorageStatus.isNearLimit && (
          <div className="bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-bounce-slow relative overflow-hidden">
            <div className="absolute right-0 top-0 -translate-y-4 translate-x-4 w-32 h-32 bg-red-200/20 rounded-full blur-2xl pointer-events-none"></div>
            <div className="flex gap-4 relative z-10">
              <div className="p-3 bg-red-100 text-red-705 border border-red-200 rounded-2xl shrink-0 h-12 w-12 flex items-center justify-center shadow-2xs">
                <AlertTriangle className="w-6 h-6 text-red-650 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                    SIAGA REKOR CLOUD (SISA {(100 - cloudStorageStatus.percentage).toFixed(1)}%)
                  </span>
                </div>
                <h3 className="font-display font-black text-slate-800 text-sm mt-1.5 leading-tight">
                  Kapasitas Cloud Database Firestore Menyusut Tajam!
                  {forceSimulateWarning && <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded ml-2">Simulasi Aktif</span>}
                </h3>
                <p className="text-xs text-slate-650 mt-1 leading-relaxed max-w-2xl font-semibold">
                  Penyimpanan cloud database aplikasi Anda sudah terpakai sebesar <strong className="text-red-700 font-extrabold">{cloudStorageStatus.percentage}%</strong> ({cloudStorageStatus.usedKB} KB dari batas uji Spark gratis {cloudStorageStatus.limitKB} KB). Segera tingkatkan ke paket **Blaze (Pay-as-you-go)** di Firebase Developer Console agar aktivitas operasional semua kasir tetap lancar tanpa kendala batas tulis!
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0 w-full md:w-auto mt-2 md:mt-0 relative z-10">
              <a
                href="https://console.firebase.google.com/"
                target="_blank"
                rel="noreferrer"
                className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md shadow-red-150 transition-all text-center cursor-pointer select-none"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Buka Firebase Console</span>
              </a>
              {forceSimulateWarning && (
                <button
                  onClick={() => setForceSimulateWarning(false)}
                  className="px-3 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        )}

        {/* Counter cards block */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200/50 rounded-3xl p-5 flex items-center justify-between shadow-xs">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest leading-none">TOTAL PENDAFTAR</span>
              <span className="font-mono font-black text-2xl text-slate-800 leading-none mt-1">
                {users.length} <span className="text-sm font-semibold text-slate-500">Kasir</span>
              </span>
            </div>
            <div className="p-3 bg-indigo-50 border border-indigo-100/50 rounded-2xl text-indigo-650 shrink-0">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white border border-slate-200/50 rounded-3xl p-5 flex items-center justify-between shadow-xs">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest leading-none">SARAN & MASUKAN</span>
              <span className="font-mono font-black text-2xl text-indigo-600 leading-none mt-1">
                {feedbacks.length} <span className="text-sm font-semibold text-slate-505">Aspirasi</span>
              </span>
            </div>
            <div className="p-3 bg-indigo-50 border border-indigo-100/50 rounded-2xl text-indigo-600 shrink-0">
              <MessageSquare className="w-6 h-6 animate-pulse" />
            </div>
          </div>

          <div className="bg-indigo-900 border border-indigo-950 rounded-3xl p-5 sm:col-span-2 lg:col-span-1 flex items-center justify-between text-white shadow-xs">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest block leading-none">OTORISASI KEAMANAN</span>
              <p className="text-[10.5px] text-indigo-100 leading-normal mt-1 min-w-[190px]">
                Privasi Keuangan 100% terjaga. Data sensitif kasir tidak dapat diintip oleh superadmin.
              </p>
            </div>
            <div className="p-3 bg-indigo-800 rounded-2xl text-indigo-300 shrink-0 ml-1">
              <Info className="w-4.5 h-4.5" />
            </div>
          </div>
        </div>



        {/* Dynamic Cloud Capacity Progress Monitor & Simulation Hub */}
        <div className="bg-white border border-slate-200/50 rounded-3xl p-5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5 col-span-full">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-600 shrink-0" />
              <div>
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider block leading-none">MONITOR KAPASITAS FIREBASE CLOUD</span>
                <h4 className="font-display font-bold text-slate-800 text-xs mt-1 leading-none">
                  Penggunaan Ruang Penyimpanan Cloud Database
                </h4>
              </div>
            </div>
            
            <div className="mt-3 flex items-center gap-3">
              {/* Progress bar */}
              <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-150/50">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    cloudStorageStatus.percentage >= 90 
                      ? 'bg-red-500 animate-pulse' 
                      : cloudStorageStatus.percentage >= 70 
                        ? 'bg-amber-500' 
                        : 'bg-indigo-600'
                  }`}
                  style={{ width: `${cloudStorageStatus.percentage}%` }}
                ></div>
              </div>
              <span className="font-mono font-bold text-xs text-slate-700 shrink-0">
                {cloudStorageStatus.percentage}%
              </span>
            </div>
            
            <div className="mt-2 flex items-center justify-between text-[10.5px] text-slate-400 font-bold">
              <span>Terestimasi: {cloudStorageStatus.usedKB} KB ({Math.round(cloudStorageStatus.usedKB / 10.24) / 100} MB)</span>
              <span>Batas Spark Plan: 1,048,576 KB (1 GB)</span>
            </div>
          </div>

          <div className="border-t md:border-t-0 md:border-l border-slate-150/60 pt-4 md:pt-0 md:pl-5 flex flex-col justify-center min-w-[200px]">
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex flex-col">
                <span className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest block leading-none">PEMELIHARAAN SYSTEM</span>
                <span className="text-xs font-bold text-slate-700 mt-1 leading-tight block">Simulasikan Peringatan</span>
                <span className="text-[9.5px] text-slate-450 leading-none mt-0.5 block font-medium">Paksa database terisi &gt;90%</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                <input 
                  type="checkbox" 
                  checked={forceSimulateWarning}
                  onChange={(e) => setForceSimulateWarning(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
              </label>
            </div>
          </div>
        </div>



        {/* Navigation Tabs Menu */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/60 max-w-lg select-none">
          <button
            type="button"
            onClick={() => setActiveTab('kasir')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'kasir'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-205/30'
                : 'text-slate-500 hover:text-slate-850'
            }`}
          >
            <Store className="w-4 h-4 shrink-0" />
            <span>Daftar Kasir ({users.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('feedback')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'feedback'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-205/30'
                : 'text-slate-500 hover:text-slate-850'
            }`}
          >
            <MessageSquare className="w-4 h-4 shrink-0" />
            <span>Saran ({feedbacks.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('polling')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'polling'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-205/30'
                : 'text-slate-500 hover:text-slate-855'
            }`}
          >
            <Sliders className="w-4 h-4 shrink-0" />
            <span>Kelola Polling ({polls.length})</span>
          </button>
        </div>

        {/* TAB CONTENT 1: DAFTAR KASIR (🏬) */}
        {activeTab === 'kasir' && (
          <div className="bg-white rounded-3xl border border-slate-200/50 p-5 sm:p-6 shadow-sm transition-all duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="font-display font-black text-slate-800 text-sm tracking-tight flex items-center gap-1.5">
                  <Store className="w-4.5 h-4.5 text-indigo-600" />
                  <span>Daftar Kasir Terdaftar ({users.length})</span>
                </h2>
                <span className="text-[10px] text-slate-400 font-bold block mt-1 leading-none">
                  Manajemen batasan akun, masa aktif gratis, dan kapasitas pencatatan digital kasir pelanggan Anda
                </span>
              </div>
            </div>

            {/* Kotak Pencarian Pintar */}
            <div className="relative mb-4">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Cari nama toko/kasir, nama pemilik (username), atau email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl py-2.5 pl-10 pr-10 text-xs font-bold text-slate-700 outline-none transition-all placeholder:text-slate-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-450 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {(() => {
              const filteredList = users.filter((item) => {
                const term = searchTerm.toLowerCase().trim();
                return (
                  item.storeName.toLowerCase().includes(term) ||
                  item.username.toLowerCase().includes(term) ||
                  (item.email && item.email.toLowerCase().includes(term))
                );
              });

              if (filteredList.length === 0) {
                return (
                  <div className="p-12 border border-dashed border-slate-200 rounded-2xl text-center text-slate-400 text-xs font-semibold leading-relaxed flex flex-col items-center justify-center gap-2 bg-slate-50/20">
                    <Store className="w-8 h-8 text-slate-300" />
                    <span>Tidak ada hasil pencarian yang cocok dengan kata kunci &quot;{searchTerm}&quot;.</span>
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                        <th className="py-3 px-3">Nama Toko/Kasir (KOP) / Pemilik</th>
                        <th className="py-3 px-3">Status Akun</th>
                        <th className="py-3 px-3">Batas Transaksi</th>
                        <th className="py-3 px-3">Masa Aktif Aplikasi</th>
                        <th className="py-3 px-3 text-right">Tindakan Superadmin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredList.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                                {item.storeName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-bold text-slate-800 text-[12.5px] block leading-snug">{item.storeName}</span>
                                <span className="text-[10px] text-slate-405 block -mt-0.5 font-medium">
                                  Username: <strong className="text-slate-600">{item.username}</strong> {item.email ? `| ${item.email}` : ''}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-slate-600 font-medium whitespace-nowrap">
                            {item.status === 'suspended' ? (
                              <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-rose-100 uppercase tracking-wider">
                                <Lock className="w-2.5 h-2.5 text-rose-500" /> Tangguh / Off
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-100 uppercase tracking-wider">
                                <Unlock className="w-2.5 h-2.5 text-emerald-555" /> Aktif
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="flex flex-col">
                              <span className="font-mono text-[11px] font-extrabold text-slate-700">
                                {getTxCount(item.id)} TX
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold block mt-0.5 leading-none">
                                {item.maxTransactions ? `Maks: ${item.maxTransactions} TX` : 'Tanpa Batas'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            {(() => {
                              const extDate = item.expiryDate || (() => {
                                const created = new Date(item.dateCreated || Date.now());
                                created.setMonth(created.getMonth() + 3);
                                return created.toISOString().split('T')[0];
                              })();
                              
                              return (
                                <div className="flex flex-col select-none">
                                  <span className="font-mono text-[11px] font-bold text-slate-700 leading-none">
                                    {new Date(extDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </span>
                                  {new Date(extDate) < new Date() ? (
                                    <span className="text-[9.5px] text-rose-600 font-extrabold tracking-tight mt-1 animate-pulse leading-none uppercase">
                                      Masa Habis
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-indigo-650 font-bold tracking-tight mt-0.5 leading-none">
                                      Sisa {Math.max(0, Math.ceil((new Date(extDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24)))} Hari
                                    </span>
                                  )}
                                  {!item.expiryDate && (
                                    <span className="text-[8px] text-slate-400 font-semibold uppercase mt-0.5 tracking-tight leading-none">
                                      (Uji Coba Default)
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            {showConfirmId === item.id ? (
                              <div className="inline-flex items-center justify-end gap-1.5 w-full">
                                <span className="text-[10px] text-rose-605 font-extrabold uppercase tracking-wider animate-pulse flex items-center gap-0.5">
                                  <AlertTriangle className="w-3 h-3" /> Hapus?
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteKasir(item.id)}
                                  className="px-2 py-1 bg-rose-605 hover:bg-rose-700 text-white font-extrabold text-[9.5px] rounded-lg transition-colors cursor-pointer"
                                >
                                  Ya
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowConfirmId(null)}
                                  className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-705 font-bold text-[9.5px] rounded-lg transition-colors cursor-pointer"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenLimitModal(item)}
                                  className="px-2 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-150 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                                  title="Setel batas masa aktif & jumlah transaksi kasir ini"
                                >
                                  <Sliders className="w-3 h-3 text-indigo-600" />
                                  <span>Atur Batas</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setShowConfirmId(item.id)}
                                  className="px-2 py-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-100 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                                  title="Hapus kasir ini secara permanen"
                                >
                                  <Trash2 className="w-3 h-3 text-slate-450" />
                                  <span>Hapus</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* Informative warning alert box */}
            <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-3xl flex items-start gap-2.5 text-xs text-amber-800 leading-relaxed font-medium">
              <AlertTriangle className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="font-bold">Perhatian Penghapusan Data:</span>
                <span>Tindakan menghapus kasir bersifat permanen. Seluruh cache produk sembako, riwayat transaksi, dan buku piutang dagang milik kasir tersebut akan dibersihkan sepenuhnya dari browser klien ini dan tidak dapat dikembalikan.</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT 2: SARAN & MASUKAN PENGGUNA (💬) */}
        {activeTab === 'feedback' && (
          <div className="bg-white rounded-3xl border border-slate-200/50 p-5 sm:p-6 shadow-sm transition-all duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <h2 className="font-display font-black text-slate-800 text-sm tracking-tight flex items-center gap-1.5 leading-none">
                  <MessageSquare className="w-4.5 h-4.5 text-indigo-600 animate-pulse" />
                  <span>Saran & Masukan Pengguna ({feedbacks.length})</span>
                </h2>
                <span className="text-[10px] text-slate-400 font-bold block mt-1.5 leading-none">
                  Kritik, saran, dan ide perbaikan kualitas aplikasi dari juragan kasir pelanggan Anda
                </span>
              </div>

              {/* Category Filter dropdown */}
              <div className="flex items-center gap-2 font-semibold text-xs text-slate-455">
                <Filter className="w-3.5 h-3.5 text-slate-405" />
                <select
                  value={fbFilterCategory}
                  onChange={(e) => setFbFilterCategory(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl py-1 px-3 text-[11px] font-bold outline-none cursor-pointer focus:border-indigo-505"
                >
                  <option value="Semua">📁 Semua Kategori</option>
                  <option value="POS Kasir">🛒 POS Kasir / Struk</option>
                  <option value="Kelola Barang (Stock)">📦 Kelola Barang (Stock)</option>
                  <option value="Hutang / Piutang">📝 Pembukuan Kasbon</option>
                  <option value="Keuangan & Laba">📈 Laporan Profit</option>
                  <option value="Tampilan & Desain">🎨 Desain & Tampilan</option>
                  <option value="Lainnya">💡 Lainnya</option>
                </select>
              </div>
            </div>

            {/* Toggle Switch Banner for client-side Feedback FAB visibility */}
            <div className="mb-6 p-4.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-xl shrink-0 ${disableFeedback ? 'bg-amber-100 text-amber-600 border border-amber-200' : 'bg-emerald-100 text-emerald-600 border border-emerald-200'}`}>
                  <MessageSquare className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="text-[12.5px] font-bold text-slate-800 leading-tight">
                    Fitur "Saran Aplikasi" di Sisi Pengguna
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">
                    {disableFeedback 
                      ? 'Fitur saran saat ini DINONAKTIFKAN di sisi pengguna. Tombol melayang (FAB) tidak akan muncul.' 
                      : 'Fitur saran saat ini AKTIF di sisi pengguna. Pengguna dapat mengirim saran melalui tombol melayang.'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                <span className={`text-[10px] uppercase tracking-wider font-extrabold ${disableFeedback ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {disableFeedback ? 'NONAKTIF' : 'AKTIF'}
                </span>
                
                <button
                  type="button"
                  onClick={async () => {
                    const newStatus = !disableFeedback;
                    setDisableFeedback(newStatus);
                    try {
                      await setDoc(doc(db, 'config', 'superadmin'), { disableFeedback: newStatus }, { merge: true });
                      const savedProfile = localStorage.getItem('kasir_superadmin_profile');
                      if (savedProfile) {
                        try {
                          const parsed = JSON.parse(savedProfile);
                          parsed.disableFeedback = newStatus;
                          localStorage.setItem('kasir_superadmin_profile', JSON.stringify(parsed));
                        } catch {}
                      }
                    } catch (err) {
                      console.error('Failed to change feedback disabled state:', err);
                    }
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    disableFeedback ? 'bg-slate-300' : 'bg-indigo-600'
                  }`}
                  id="toggle-saran-fitur"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      disableFeedback ? 'translate-x-0' : 'translate-x-5'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Feed of Suggestions */}
            {(() => {
              const listToRender = feedbacks.filter(f => fbFilterCategory === 'Semua' || f.category === fbFilterCategory);
              
              if (listToRender.length === 0) {
                return (
                  <div className="p-8 border border-dashed border-slate-250 rounded-2xl text-center text-slate-400 text-xs font-semibold leading-relaxed flex flex-col items-center justify-center gap-2">
                    <MessageSquare className="w-8 h-8 text-slate-300" />
                    <span>Tidak ada saran yang masuk untuk kategori ini.</span>
                  </div>
                );
              }

              return (
                <div className="flex flex-col gap-4">
                  {listToRender.map((fb) => (
                    <div key={fb.id} className="border border-slate-105 rounded-2xl p-4 bg-slate-50/40 hover:bg-slate-50 transition-colors flex flex-col gap-3 text-xs">
                      
                      {/* Feedback Header */}
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2.5 bg-transparent">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-750 flex items-center justify-center font-extrabold text-[11.5px] font-mono shrink-0">
                            {fb.storeName ? fb.storeName.charAt(0).toUpperCase() : 'K'}
                          </div>
                          <div>
                            <strong className="text-slate-800 text-[12.5px] block leading-snug">{fb.storeName || 'Kasir Tanpa Nama'}</strong>
                            <span className="text-[10px] text-slate-405 block font-semibold leading-snug">
                              Oleh: <strong className="text-slate-600">{fb.username || 'user'}</strong> ({fb.email || 'offline'})
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="bg-indigo-50 text-indigo-850 px-2.5 py-0.5 rounded-lg border border-indigo-100 font-bold text-[9px] uppercase tracking-wider">
                            {fb.category}
                          </span>

                          {fb.urgency && (
                            <span className={`px-1.5 py-0.5 rounded-lg font-bold text-[9px] uppercase tracking-wider ${
                              fb.urgency.includes('Penting')
                                ? 'bg-rose-50 text-rose-700 border border-rose-100 animate-pulse'
                                : fb.urgency.includes('Desain')
                                ? 'bg-purple-50 text-purple-700 border border-purple-100'
                                : 'bg-slate-100 text-slate-550 border border-slate-200'
                            }`}>
                              {fb.urgency.includes('Penting') ? '🚨 Masalah' : fb.urgency.includes('Desain') ? '🎨 Estetika' : '💡 Usulan'}
                            </span>
                          )}

                          <div className="flex items-center gap-1 text-slate-400 font-bold ml-1 text-[10px]">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span className="font-mono text-[10.5px]">
                              {fb.createdAt ? new Date(fb.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Feedback Message */}
                      <div className="text-xs text-slate-700 leading-relaxed font-semibold bg-white p-3.5 rounded-xl border border-slate-150/60 whitespace-pre-wrap">
                        {fb.message}
                      </div>

                      {/* Status Management */}
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <div className="flex items-center gap-1.5 select-none">
                          <span className="text-[10px] text-slate-500 font-black uppercase">Status:</span>
                          {fb.status === 'Baru' && (
                            <span className="bg-amber-50 text-amber-800 text-[9.5px] font-black px-2 py-0.5 rounded-full border border-amber-100 uppercase tracking-widest">
                              🆕 Baru
                            </span>
                          )}
                          {fb.status === 'Diproses' && (
                            <span className="bg-indigo-50 text-indigo-805 text-[9.5px] font-black px-2 py-0.5 rounded-full border border-indigo-150 uppercase tracking-widest">
                              ⚡ Diproses
                            </span>
                          )}
                          {fb.status === 'Selesai' && (
                            <span className="bg-emerald-50 text-emerald-800 text-[9.5px] font-black px-2 py-0.5 rounded-full border border-emerald-100 uppercase tracking-widest">
                              ✅ Selesai
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {fb.status === 'Baru' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateFeedbackStatus(fb.id, 'Diproses')}
                              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-150 text-[10px] font-bold rounded-xl cursor-pointer active:scale-95 transition-all text-xs"
                            >
                              Proses Masukan
                            </button>
                          )}
                          
                          {fb.status !== 'Selesai' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateFeedbackStatus(fb.id, 'Selesai')}
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-150 text-[10px] font-bold rounded-xl cursor-pointer active:scale-95 transition-all flex items-center gap-1 text-xs"
                            >
                              <Check className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                              <span>Selesai</span>
                            </button>
                          )}

                          {fbConfirmDeleteId === fb.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDeleteFeedback(fb.id)}
                                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 font-extrabold text-white text-[9.5px] rounded-lg cursor-pointer transition-colors"
                              >
                                Ya
                              </button>
                              <button
                                type="button"
                                onClick={() => setFbConfirmDeleteId(null)}
                                className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-705 text-[9.5px] font-bold rounded-lg cursor-pointer transition-colors"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setFbConfirmDeleteId(fb.id)}
                              className="p-1.5 px-2 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-100 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                            >
                              <Trash2 className="w-3.5 h-3.5 shrink-0" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB CONTENT 3: PANEL KELOLA POLLING KILAT (🗳️) */}
        {activeTab === 'polling' && (
          <div className="bg-white rounded-3xl border border-slate-200/50 p-5 sm:p-6 shadow-sm transition-all duration-300">
            <div className="mb-6">
              <h2 className="font-display font-black text-slate-800 text-sm tracking-tight flex items-center gap-1.5 leading-none">
                <Sliders className="w-4.5 h-4.5 text-indigo-600 animate-pulse" />
                <span>Kelola Polling Kilat (Aspirasi Kasir)</span>
              </h2>
              <span className="text-[10px] text-slate-400 font-bold block mt-1.5 leading-none">
                Dapatkan umpan balik cepat dan data kuantitatif dari juragan kasir secara instan & non-intrusif
              </span>
            </div>

            {pollError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-105 rounded-xl text-rose-700 text-[11px] font-bold">
                ⚠️ {pollError}
              </div>
            )}

            {pollSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-[11px] font-bold">
                ✅ {pollSuccess}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* COLUMN: BUAT POLLING */}
              <form onSubmit={handleCreatePoll} className="lg:col-span-5 flex flex-col gap-4 border border-slate-100 p-4 rounded-2xl bg-slate-50/50">
                <span className="text-xs font-black text-slate-855 border-b border-slate-100 pb-1.5 uppercase tracking-wider block">
                  📝 Buat Polling Baru
                </span>
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Pertanyaan Polling</label>
                  <textarea
                    value={newPollQuestion}
                    onChange={(e) => setNewPollQuestion(e.target.value)}
                    placeholder="Contoh: Apakah Anda butuh integrasi printer Bluetooth thermal?"
                    className="bg-white border border-slate-205 text-slate-705 rounded-xl py-2 px-3 text-[11px] font-bold outline-none focus:border-indigo-505 min-h-[60px]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Pilihan 1 (Wajib)</label>
                  <input
                    type="text"
                    value={opt1}
                    onChange={(e) => setOpt1(e.target.value)}
                    placeholder="Contoh: Sangat Butuh"
                    className="bg-white border border-slate-205 text-slate-705 rounded-xl py-2 px-3 text-[11px] font-bold outline-none focus:border-indigo-505"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Pilihan 2 (Wajib)</label>
                  <input
                    type="text"
                    value={opt2}
                    onChange={(e) => setOpt2(e.target.value)}
                    placeholder="Contoh: Biasa Saja"
                    className="bg-white border border-slate-205 text-slate-705 rounded-xl py-2 px-3 text-[11px] font-bold outline-none focus:border-indigo-505"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Pilihan 3 (Opsional)</label>
                  <input
                    type="text"
                    value={opt3}
                    onChange={(e) => setOpt3(e.target.value)}
                    placeholder="Contoh: Tidak Butuh / Jarang"
                    className="bg-white border border-slate-205 text-slate-755 rounded-xl py-2 px-3 text-[11px] font-bold outline-none focus:border-indigo-505"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Pilihan 4 (Opsional)</label>
                  <input
                    type="text"
                    value={opt4}
                    onChange={(e) => setOpt4(e.target.value)}
                    placeholder="Lengkapi jika perlu"
                    className="bg-white border border-slate-205 text-slate-755 rounded-xl py-2 px-3 text-[11px] font-bold outline-none focus:border-indigo-505"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isCreatingPoll}
                  className="w-full py-2.5 bg-emerald-100 hover:bg-emerald-200 active:scale-95 text-emerald-950 font-extrabold text-xs rounded-xl shadow-xs transition-colors select-none cursor-pointer mt-1 text-center"
                >
                  {isCreatingPoll ? 'Menerbitkan...' : 'Terbitkan Polling'}
                </button>
              </form>

              {/* COLUMN: DAFTAR POLLING & REKAP JAWABAN */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <span className="text-xs font-black text-slate-855 border-b border-slate-100 pb-1.5 uppercase tracking-wider block">
                  📊 Daftar Polling & Hasil Voted
                </span>

                {polls.length === 0 ? (
                  <div className="p-12 border border-dashed border-slate-200 rounded-2xl text-center text-slate-400 text-xs font-semibold leading-relaxed flex flex-col items-center justify-center gap-2 bg-slate-50/10">
                    <MessageSquare className="w-8 h-8 text-slate-300" />
                    <span>Belum ada polling yang diterbitkan.</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {polls.map((poll) => {
                      const poolVotesList = pollResponses.filter(r => r.pollId === poll.id);
                      const totalVotes = poolVotesList.length;

                      return (
                        <div key={poll.id} className="border border-slate-100 rounded-2xl p-4 bg-slate-50/40 hover:bg-slate-50 transition-colors flex flex-col gap-3 text-xs">
                          
                          {/* Question and Header metrics */}
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex flex-col gap-1 flex-1">
                              <span className="font-bold text-slate-800 text-[12.5px] leading-tight font-display">
                                {poll.question}
                              </span>
                              <span className="text-[9.5px] font-mono text-slate-400 leading-none font-bold">
                                Dibuat: {new Date(poll.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 select-none">
                              <button
                                type="button"
                                onClick={() => handleTogglePollStatus(poll.id, poll.status)}
                                className={`px-2.5 py-1 text-[9.5px] font-black rounded-lg border uppercase tracking-wider transition-all cursor-pointer ${
                                  poll.status === 'Aktif' 
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-100 hover:bg-emerald-100' 
                                    : 'bg-slate-100 text-slate-550 border-slate-200 hover:bg-slate-150'
                                }`}
                                title={poll.status === 'Aktif' ? 'Sembunyikan dari Kasir' : 'Tampilkan di Kasir'}
                              >
                                ● {poll.status}
                              </button>
                            </div>
                          </div>

                          {/* Votes breakdown representation */}
                          <div className="bg-white p-3.5 rounded-xl border border-slate-150/60 flex flex-col gap-2.5">
                            <span className="text-[10px] font-bold text-slate-400 block border-b border-slate-50 pb-1 mb-1 lowercase tracking-wider">
                              rekapitulasi tanggapan ({totalVotes} responden):
                            </span>

                            <div className="flex flex-col gap-2">
                              {poll.options.map((option: string, idx: number) => {
                                const voteCount = poolVotesList.filter(v => v.selectedOption === option).length;
                                const percent = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 105) / 1.05 : 0;

                                return (
                                  <div key={idx}>
                                    <div className="flex justify-between text-[11px] font-semibold text-slate-650 mb-0.5">
                                      <span>{option}</span>
                                      <span className="font-mono text-slate-505 font-bold">
                                        {Math.round(percent)}% <span className="text-[10px] text-slate-400">({voteCount} Toko)</span>
                                      </span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                                        style={{ width: `${percent}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Roster of who voted which choice */}
                          {totalVotes > 0 && (
                            <div className="flex flex-col gap-1 p-2 bg-slate-100/50 rounded-xl border border-slate-150/40 text-[10.5px]">
                              <span className="font-bold text-[9.5px] text-slate-505 mb-1 block uppercase tracking-wide">Daftar Toko yang Memilih:</span>
                              <div className="flex flex-wrap gap-1.5">
                                {poolVotesList.map((resp: any, idx: number) => (
                                  <span key={idx} className="bg-white px-2 py-0.5 border border-slate-200/80 rounded-lg font-bold text-slate-600 shadow-2xs">
                                    <strong>{resp.storeName}</strong>: {resp.selectedOption}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Delete action */}
                          <div className="flex justify-end pt-1">
                            {pollConfirmDeleteId === poll.id ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-rose-600 mr-1.5 font-sans">Yakin hapus polling data?</span>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePoll(poll.id)}
                                  className="px-2.5 py-1 bg-rose-500 hover:bg-rose-600 font-extrabold text-white text-[9.5px] rounded-lg cursor-pointer transition-colors"
                                >
                                  Ya
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPollConfirmDeleteId(null)}
                                  className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-705 text-[9.5px] font-bold rounded-lg cursor-pointer transition-colors"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPollConfirmDeleteId(poll.id)}
                                className="p-1 px-2.5 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-100 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold text-rose-650 shadow-2xs"
                              >
                                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                <span>Hapus Polling</span>
                              </button>
                            )}
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

      </div>

      {/* POPUP MODAL: PENGATURAN KONTAK & PROFIL SUPER ADMIN */}
      {showAdminProfileModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="mt-24 sm:mt-32 mb-12 bg-white rounded-3xl border border-slate-100 w-full max-w-sm sm:max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[80vh]">
            
            {/* Modal Header */}
            <div className="p-3.5 px-4 border-b border-slate-150/60 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-rose-600 shrink-0" />
                <h3 className="font-display font-bold text-slate-800 text-xs sm:text-[13px] uppercase tracking-wider">
                  Profil Kontak & Sandi Admin
                </h3>
              </div>
              <button 
                onClick={() => setShowAdminProfileModal(false)}
                className="p-1 rounded-lg hover:bg-slate-150/60 text-slate-400 hover:text-slate-650 shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Form Fields body */}
            <form onSubmit={handleSaveProfile} className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4 font-sans text-xs text-slate-600">
              
              <p className="text-[11px] text-slate-500 font-medium">
                Data kontak ini akan ditampilkan secara dinamis di halaman depan login aplikasi sehingga pengguna baru dapat berkonsultasi secara langsung.
              </p>

              {passwordError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-slate-700 font-bold leading-normal flex items-start gap-1.5 animate-pulse shrink-0 text-[11px]">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{passwordError}</span>
                </div>
              )}

              {saveSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 font-bold leading-normal flex items-start gap-1.5 animate-pulse shrink-0 text-[11px]">
                  <Check className="w-4 h-4 text-emerald-555 shrink-0 mt-0.5" />
                  <span>Profil kontak & kata sandi berhasil diperbarui!</span>
                </div>
              )}

              {/* Name Block */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Nama Admin / Developer</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10">
                    <UserCheck className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Contoh: Admin SAF Kasir"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl py-2 pl-10 pr-3 font-semibold text-slate-800 outline-none"
                  />
                </div>
              </div>

              {/* Phone Block */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Nomor HP / WhatsApp Kontak</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10">
                    <Phone className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={adminPhone}
                    onChange={(e) => setAdminPhone(e.target.value)}
                    placeholder="Contoh: 085872329811"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl py-2 pl-10 pr-3 font-mono font-bold text-slate-800 outline-none"
                  />
                </div>
              </div>

              {/* Email Block */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Email Support (Opsional)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="Contoh: adminkursus@gmail.com"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl py-2 pl-10 pr-3 font-semibold text-slate-800 outline-none"
                  />
                </div>
              </div>

              {/* Notes Block */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Catatan Bantuan Operasional</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10">
                    <FileText className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Contoh: Senin-Sabtu jam 08:00 - 17:00"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl py-2 pl-10 pr-3 font-semibold text-slate-800 outline-none"
                  />
                </div>
              </div>

              {/* Toggles show/hide kontak pengembang */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 flex flex-col gap-3">
                <span className="text-[10px] font-extrabold text-indigo-750 uppercase tracking-widest block font-sans">
                  Sembunyikan Informasi Kontak Pengembang
                </span>
                <p className="text-[10px] text-slate-400 font-medium leading-normal -mt-1.5">
                  Atur informasi kontak mana yang ingin disembunyikan agar tidak muncul di portal login pengguna aplikasi.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                  <label className="flex items-center gap-2.5 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={hidePhone}
                      onChange={(e) => setHidePhone(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-705">Sembunyikan Telepon</span>
                      <span className="text-[9px] text-slate-400">Tidak menampilkan no. handphone</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={hideEmail}
                      onChange={(e) => setHideEmail(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-705">Sembunyikan Email</span>
                      <span className="text-[9px] text-slate-400">Tidak menampilkan alamat email</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 hidden">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Sandi Baru (Min. 6 Karakter)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 z-10 text-slate-400">
                    <Key className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="Masukkan sandi baru"
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl py-2 pl-10 pr-10 font-semibold text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 hidden">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Konfirmasi Sandi Baru</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 z-10 text-slate-400">
                    <Key className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    value={confirmAdminPassword}
                    onChange={(e) => setConfirmAdminPassword(e.target.value)}
                    placeholder="Masukkan kembali sandi"
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl py-2 pl-10 pr-10 font-semibold text-slate-800 outline-none"
                  />
                </div>
              </div>

              {/* Action buttons inside superadmin modal */}
              <div className="flex gap-2.5 pt-4 border-t border-slate-150 mt-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAdminProfileModal(false)}
                  className="flex-1 py-2.5 border border-slate-205 text-slate-500 hover:bg-slate-50 rounded-xl font-bold transition-all cursor-pointer active:scale-95 text-center"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-extrabold rounded-xl transition-colors cursor-pointer shadow-md shadow-emerald-100/50 flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL: ATUR BATAS PENGGUNAAN KASIR */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="mt-24 sm:mt-32 mb-12 bg-white rounded-3xl border border-slate-100 w-full max-w-sm sm:max-w-md shadow-2xl overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="p-3.5 px-4 border-b border-slate-150/60 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <Sliders className="w-4 h-4 text-indigo-700 shrink-0" />
                <h3 className="font-display font-black text-slate-800 text-xs sm:text-[13px] uppercase tracking-wider">
                  Atur Batas: {editingUser.storeName}
                </h3>
              </div>
              <button 
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-lg hover:bg-slate-150 text-slate-400 hover:text-slate-650 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Modal Body form */}
            <form onSubmit={handleSaveUserLimits} className="p-4 sm:p-5 flex flex-col gap-4 text-xs">
              <p className="text-[11px] text-slate-550 leading-normal font-medium mb-1">
                Setel status keaktifan akun, batas maksimal nominal input transaksi penjualan kasir, atau tanggal kedalewarsa uji coba aplikasi kasir ini.
              </p>

              {/* Status Droplist */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Status Keaktifan Akun</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'active' | 'suspended')}
                  className="w-full bg-slate-50 border border-slate-200 outline-none focus:border-indigo-505 rounded-xl py-2 px-3 text-xs font-bold text-slate-800"
                >
                  <option value="active">🟢 AKTIF (Bisa digunakan tanpa kendala)</option>
                  <option value="suspended">🔴 SUSPENDED / NON-AKTIF (Kunci Akses)</option>
                </select>
              </div>

              {/* Max Transaction Limit */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Batas Maksimal Jumlah Transaksi (TX)</label>
                <input
                  type="number"
                  min="0"
                  value={editMaxTransactions === 0 ? "" : editMaxTransactions}
                  onChange={(e) => setEditMaxTransactions(Math.max(0, parseInt(e.target.value || "0")))}
                  placeholder="Contoh: 100 (Kosongkan atau isi 0 untuk tanpa batas)"
                  className="w-full bg-slate-50 border border-slate-200 outline-none focus:border-indigo-500 rounded-xl py-2 px-3 text-xs font-semibold text-slate-800 font-mono"
                />
                <span className="text-[9.5px] text-slate-400 -mt-0.5">
                  Saat ini kasir sudah melakukan <strong className="text-slate-600">{getTxCount(editingUser.id)} transaksi</strong> di perangkat ini.
                </span>
              </div>

              {/* Expiry Date limit */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tanggal Batas Kedaluwarsa Uji Coba</label>
                <input
                  type="date"
                  value={editExpiryDate}
                  onChange={(e) => setEditExpiryDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 outline-none focus:border-indigo-500 rounded-xl py-2 px-3 text-xs font-semibold text-slate-800 font-mono"
                />
                <span className="text-[11px] text-slate-400 -mt-1 leading-normal">
                  Kosongkan/kosong jika ingin akun pemilik kasir aktif seterusnya secara permanen.
                </span>
              </div>

              {/* Action save/cancel */}
              <div className="flex gap-2.5 pt-4 border-t border-slate-150 mt-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-2 text-slate-500 bg-white hover:bg-slate-50 border border-slate-250 font-bold rounded-xl transition-all text-center leading-normal active:scale-95 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-extrabold rounded-xl transition-colors shadow-md shadow-emerald-100/50 flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer text-xs"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Kebijakan</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
