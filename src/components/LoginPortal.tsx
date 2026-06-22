import React, { useState, useEffect } from 'react';
import { Store, Key, User, Shield, Eye, EyeOff, HelpCircle, Lock, ArrowRight, CheckCircle2, Mail, Send, RefreshCw, Check, Smartphone, X, Copy, Phone, CloudOff, Database, AlertTriangle } from 'lucide-react';
import { auth, db, isFirebasePlaceholder } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import warungLogo from '../assets/images/saf_kasir_logo.jpg';
import { INITIAL_PRODUCTS } from '../initialData';

export interface RegisteredUser {
  id: string;
  storeName: string;
  username: string;
  email: string;
  password: string;
  address?: string;
  securityQuestion?: string;
  securityAnswer?: string;
  dateCreated: string;
  expiryDate?: string;       // YYYY-MM-DD
  maxTransactions?: number;  // max transaction limit, 0/undefined means unlimited
  status?: 'active' | 'suspended';
  qrisData?: string;
  qrisImage?: string;
}

interface LoginPortalProps {
  onLoginSuccess: (user: RegisteredUser) => void;
  onAdminLoginSuccess: () => void;
}

export default function LoginPortal({ onLoginSuccess, onAdminLoginSuccess }: LoginPortalProps) {
  // Tabs: 'login' | 'register' | 'forgot'
  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>('login');
  
  // Custom states
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmRegPassword, setConfirmRegPassword] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMess, setErrorMess] = useState('');
  const [successMess, setSuccessMess] = useState('');
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showSuperAdmin, setShowSuperAdmin] = useState(false);

  // Offline / Emergency setup states
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [offlineMode, setOfflineMode] = useState<'demo' | 'custom'>('demo');
  const [offlineStoreName, setOfflineStoreName] = useState('Kasir Mandiri');
  const [offlineStoreAddress, setOfflineStoreAddress] = useState('Jl. Raya No. 123');
  const [offlineDatabaseOption, setOfflineDatabaseOption] = useState<'clean' | 'demo'>('demo');
  const [offlineDisclaimerChecked, setOfflineDisclaimerChecked] = useState(false);

  // Google Sign In Custom Store Profile states
  const [googleRegUser, setGoogleRegUser] = useState<any>(null);
  const [googleStoreName, setGoogleStoreName] = useState('');
  const [googleStoreAddress, setGoogleStoreAddress] = useState('');
  const [showGoogleRegModal, setShowGoogleRegModal] = useState(false);
  const [isFinishingGoogleReg, setIsFinishingGoogleReg] = useState(false);

  // Password recovery states
  const [recoverUser, setRecoverUser] = useState('');
  const [foundUser, setFoundUser] = useState<RegisteredUser | null>(null);

  // Email recovery OTP flow states
  const [recoveryMethod, setRecoveryMethod] = useState<'select' | 'email'>('select');
  const [otpCode, setOtpCode] = useState('');
  const [inputOtp, setInputOtp] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [timer, setTimer] = useState(0);
  const [simulatedEmailSent, setSimulatedEmailSent] = useState<{
    to: string;
    subject: string;
    otp: string;
    time: string;
  } | null>(null);

  // Check online status dynamically
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? window.navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Active polling fallback for iframes/sandboxed environments where events might be suppressed
    const interval = setInterval(() => {
      if (typeof window !== 'undefined') {
        setIsOnline(window.navigator.onLine);
      }
    }, 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  // Dynamic Superadmin support profile loaded from localStorage/Firestore
  const [adminProfile, setAdminProfile] = useState({
    name: 'Jopur (kursus WANODYA Bandung)',
    phone: '085872329811',
    email: 'adminkursus@gmail.com',
    notes: '',
    hidePhone: false,
    hideEmail: false
  });

  React.useEffect(() => {
    if (showSuperAdmin) {
      // Auto-fetch superadmin password silently behind the scenes so they don't have to fill it in presentation
      const fetchPasswordSilently = async () => {
        if (isFirebasePlaceholder || !navigator.onLine) {
          setPassword(localStorage.getItem('kasir_superadmin_password') || 'superadmin');
          return;
        }
        try {
          const docRef = doc(db, 'config', 'superadmin');
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().password) {
            setPassword(docSnap.data().password);
          } else {
            setPassword(localStorage.getItem('kasir_superadmin_password') || 'superadmin');
          }
        } catch {
          setPassword(localStorage.getItem('kasir_superadmin_password') || 'superadmin');
        }
      };
      fetchPasswordSilently();
    } else {
      setPassword('');
    }
  }, [showSuperAdmin]);

  React.useEffect(() => {
    const fetchSuperadminProfile = async () => {
      // Use local fallback immediately if offline or Firebase is placeholder
      if (isFirebasePlaceholder || !navigator.onLine) {
        const savedProfile = localStorage.getItem('kasir_superadmin_profile');
        if (savedProfile) {
          try {
            const parsed = JSON.parse(savedProfile);
            let parsedPhone = parsed.phone || '085872329811';
            if (parsedPhone === '081234567890') {
              parsedPhone = '085872329811';
            }
            let parsedEmail = parsed.email || 'adminkursus@gmail.com';
            if (parsedEmail === 'support.kasir@gmail.com') {
              parsedEmail = 'adminkursus@gmail.com';
            }
            let parsedNotes = parsed.notes || '';
            if (parsedNotes.includes('Bantuan Teknis Kasir Sembako')) {
              parsedNotes = '';
            }
            setAdminProfile({
              name: parsed.name || 'Jopur (kursus WANODYA Bandung)',
              phone: parsedPhone,
              email: parsedEmail,
              notes: parsedNotes,
              hidePhone: !!parsed.hidePhone,
              hideEmail: !!parsed.hideEmail
            });
          } catch {}
        }
        return;
      }

      try {
        const docRef = doc(db, 'config', 'superadmin');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const parsed = docSnap.data();
          let parsedPhone = parsed.phone || '085872329811';
          if (parsedPhone === '081234567890') {
            parsedPhone = '085872329811';
          }
          let parsedEmail = parsed.email || 'adminkursus@gmail.com';
          if (parsedEmail === 'support.kasir@gmail.com') {
            parsedEmail = 'adminkursus@gmail.com';
          }
          let parsedNotes = parsed.notes || '';
          if (parsedNotes.includes('Bantuan Teknis Kasir Sembako')) {
            parsedNotes = '';
          }
          
          setAdminProfile({
            name: parsed.name || 'Jopur (kursus WANODYA Bandung)',
            phone: parsedPhone,
            email: parsedEmail,
            notes: parsedNotes,
            hidePhone: !!parsed.hidePhone,
            hideEmail: !!parsed.hideEmail
          });
        } else {
          // Initialize if it doesn't exist (only admins can write; others will fail gracefully)
          const defaultProfile = {
            name: 'Jopur (kursus WANODYA Bandung)',
            phone: '085872329811',
            email: 'adminkursus@gmail.com',
            notes: '',
            hidePhone: false,
            hideEmail: false
          };
          try {
            await setDoc(docRef, defaultProfile);
          } catch (writeErr) {
            console.log('Skipping Firestore initialization of superadmin profile (guest user has no write permission).');
          }
        }
      } catch (e) {
        console.warn('Gagal membaca profil superadmin di Firestore (menggunakan data lokal/fallback)', e);
        // Fallback to local
        const savedProfile = localStorage.getItem('kasir_superadmin_profile');
        if (savedProfile) {
          try {
            const parsed = JSON.parse(savedProfile);
            let parsedPhone = parsed.phone || '085872329811';
            if (parsedPhone === '081234567890') {
              parsedPhone = '085872329811';
            }
            let parsedEmail = parsed.email || 'adminkursus@gmail.com';
            if (parsedEmail === 'support.kasir@gmail.com') {
              parsedEmail = 'adminkursus@gmail.com';
            }
            let parsedNotes = parsed.notes || '';
            if (parsedNotes.includes('Bantuan Teknis Kasir Sembako')) {
              parsedNotes = '';
            }
            setAdminProfile({
              name: parsed.name || 'Jopur (kursus WANODYA Bandung)',
              phone: parsedPhone,
              email: parsedEmail,
              notes: parsedNotes,
              hidePhone: !!parsed.hidePhone,
              hideEmail: !!parsed.hideEmail
            });
          } catch {}
        }
      }
    };
    fetchSuperadminProfile();
  }, []);

  // Removed local getRegisteredUsers as we query Firestore instead

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMess('');
    setSuccessMess('');

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setErrorMess('Harap isi username dan password Anda.');
      return;
    }

    // Direct Super Admin Bypass & Login
    if (trimmedUsername.toLowerCase() === 'admin') {
      try {
        // Read password from Firestore superadmin config
        const superDoc = await getDoc(doc(db, 'config', 'superadmin'));
        let firestoreSuperPass = 'superadmin';
        if (superDoc.exists() && superDoc.data()?.password) {
          firestoreSuperPass = superDoc.data().password;
        }

        if (trimmedPassword === firestoreSuperPass) {
          // Sign in to Firebase Auth as admin@kasirpintar.com
          try {
            await signInWithEmailAndPassword(auth, 'admin@kasirpintar.com', trimmedPassword);
          } catch (signInErr: any) {
            // If the user doesn't exist and email/auth is allowed, create it
            if (signInErr.code === 'auth/user-not-found' || signInErr.message?.includes('user-not-found') || signInErr.code === 'auth/invalid-credential') {
              try {
                await createUserWithEmailAndPassword(auth, 'admin@kasirpintar.com', trimmedPassword);
              } catch (createErr) {
                console.warn('Failed to create admin user, attempting direct bypass', createErr);
              }
            }
          }
          setSuccessMess('Selamat datang, Pemilik Aplikasi (Super Admin)!');
          setTimeout(() => {
            onAdminLoginSuccess();
          }, 2000);
          return;
        } else {
          setErrorMess('Password Superadmin salah.');
          return;
        }
      } catch (err: any) {
        console.error('Error in superadmin login:', err);
        // Fallback to local superadmin password
        const savedSuperPass = localStorage.getItem('kasir_superadmin_password') || 'superadmin';
        if (trimmedPassword === savedSuperPass) {
          setSuccessMess('Selamat datang, Pemilik Aplikasi (Super Admin)! (Offline Bypass)');
          setTimeout(() => {
            onAdminLoginSuccess();
          }, 2000);
          return;
        } else {
          setErrorMess('Password Superadmin salah (Bypass Error).');
          return;
        }
      }
    }

    // Normal User Login
    try {
      const usernameLower = trimmedUsername.toLowerCase();
      // Look up target mapping in /usernames/{username}
      const uMapSnap = await getDoc(doc(db, 'usernames', usernameLower));
      
      if (!uMapSnap.exists()) {
        setErrorMess('Username tidak ditemukan! Periksa kembali atau daftar akun baru.');
        return;
      }

      const { email: registeredEmail, userId } = uMapSnap.data();

      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, registeredEmail, trimmedPassword);
      
      // Load user registry details from /registered_users/{userId}
      const regSnap = await getDoc(doc(db, 'registered_users', userId));
      if (!regSnap.exists()) {
        setErrorMess('Gagal memuat profil akun kasir Anda.');
        return;
      }

      const matched = regSnap.data() as RegisteredUser;
      
      // Update local storage values for sync / quick load
      localStorage.setItem('kasir_current_user', JSON.stringify(matched));
      
      setSuccessMess(`Selamat datang kembali di ${matched.storeName}!`);
      setTimeout(() => {
        onLoginSuccess(matched);
      }, 2200);
    } catch (e: any) {
      console.error('Login error:', e);
      let errMsg = 'Gagal login: Perbaiki password atau periksa koneksi internet Anda.';
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found') {
        errMsg = 'Username atau Password salah! Periksa kembali atau daftar akun baru.';
      } else if (e.code === 'auth/operation-not-allowed') {
        errMsg = 'Metode email & password dinonaktifkan di Firebase Console. Gunakan Mode Offline di bawah!';
      }
      setErrorMess(errMsg);
    }
  };

  const handleOfflineCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMess('');
    setSuccessMess('');

    const trimmedName = offlineStoreName.trim() || 'Kasir Mandiri';
    const trimmedAddress = offlineStoreAddress.trim() || 'Alamat Kasir';

    if (trimmedName.length > 25) {
      setErrorMess('Nama kasir dibatasi maksimal 25 karakter agar pas di layar HP.');
      return;
    }

    if (trimmedAddress.length > 50) {
      setErrorMess('Alamat kasir dibatasi maksimal 50 karakter agar hemat ruang.');
      return;
    }

    setSuccessMess(`Memulai Toko Offline Mandiri: "${trimmedName}"...`);

    const offlineUser: RegisteredUser = {
      id: 'default',
      storeName: trimmedName,
      username: 'offline_mandiri',
      email: 'offline@kasir.local',
      password: '',
      address: trimmedAddress,
      dateCreated: new Date().toISOString(),
    };

    // Clean or prepare database based on selection
    if (offlineDatabaseOption === 'clean') {
      localStorage.setItem('kasir_products', JSON.stringify([]));
      localStorage.setItem('kasir_products_default', JSON.stringify([]));
      localStorage.setItem('kasir_transactions', JSON.stringify([]));
      localStorage.setItem('kasir_transactions_default', JSON.stringify([]));
      localStorage.setItem('kasir_debts', JSON.stringify([]));
      localStorage.setItem('kasir_debts_default', JSON.stringify([]));
      localStorage.setItem('kasir_expenses', JSON.stringify([]));
      localStorage.setItem('kasir_expenses_default', JSON.stringify([]));
    } else {
      // populate with INITIAL_PRODUCTS
      localStorage.setItem('kasir_products', JSON.stringify(INITIAL_PRODUCTS));
      localStorage.setItem('kasir_products_default', JSON.stringify(INITIAL_PRODUCTS));
    }

    localStorage.setItem('kasir_current_user', JSON.stringify(offlineUser));

    setTimeout(() => {
      setShowOfflineModal(false);
      onLoginSuccess(offlineUser);
    }, 1500);
  };

  const handleGuestLogin = () => {
    setErrorMess('');
    setSuccessMess('');
    setShowOfflineModal(true);
  };

  const handleGoogleLogin = async () => {
    setErrorMess('');
    setSuccessMess('');
    if (isFirebasePlaceholder || !navigator.onLine) {
      setErrorMess('Gagal: Mode Offline Aktif / Layanan Cloud belum dikonfigurasi. Silakan sentuh tombol "Coba Demo / Mode Offline" di bawah untuk menggunakan aplikasi secara offline!');
      return;
    }
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;
      
      const uid = googleUser.uid;
      const emailLower = (googleUser.email || '').toLowerCase();
      
      const isUserAdmin = emailLower === 'admin@kasirpintar.com' || emailLower === 'adminkursus@gmail.com';
      if (isUserAdmin) {
        setSuccessMess('Selamat datang, Pemilik Aplikasi (Super Admin) via Google!');
        setTimeout(() => {
          onAdminLoginSuccess();
        }, 1500);
        return;
      }
      
      // Look up if user already exists
      const regSnap = await getDoc(doc(db, 'registered_users', uid));
      
      if (regSnap.exists()) {
        const matched = regSnap.data() as RegisteredUser;
        localStorage.setItem('kasir_current_user', JSON.stringify(matched));
        
        const savedStores = localStorage.getItem('kasir_stores');
        let storeList = [];
        if (savedStores) {
          try {
            storeList = JSON.parse(savedStores);
          } catch {
            storeList = [];
          }
        }
        const filteredStoreList = storeList.filter((s: any) => s.id !== 'default');
        const newStoreEntry = { id: uid, name: matched.storeName };
        localStorage.setItem('kasir_stores', JSON.stringify([...filteredStoreList, newStoreEntry]));
        
        setSuccessMess(`Selamat datang kembali di ${matched.storeName}!`);
        setTimeout(() => {
          onLoginSuccess(matched);
        }, 1550);
      } else {
        // First-time Google user! Show modal to input actual Store Name and Address
        setGoogleRegUser(googleUser);
        setGoogleStoreName(`Kasir ${googleUser.displayName || 'Pintar'}`);
        setGoogleStoreAddress('');
        setDisclaimerChecked(false);
        setShowGoogleRegModal(true);
      }
    } catch (err: any) {
      console.error('Google Auth login error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setErrorMess('Google Login belum diijinkan di Firebase Console > Authentication.');
      } else {
        setErrorMess('Gagal login via Google: ' + (err.message || 'Silakan coba lagi.'));
      }
    }
  };

  const handleFinishGoogleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleRegUser) return;
    
    if (!disclaimerChecked) {
      setErrorMess('Anda harus menyetujui Kebijakan Privasi & Disclaimer Penggunaan sebelum melanjutkan.');
      return;
    }
    
    setErrorMess('');
    setSuccessMess('');
    setIsFinishingGoogleReg(true);
    
    const trimmedStoreName = googleStoreName.trim();
    const trimmedAddress = googleStoreAddress.trim();
    const uid = googleRegUser.uid;
    const emailLower = (googleRegUser.email || '').toLowerCase();
    
    if (!trimmedStoreName || !trimmedAddress) {
      setErrorMess('Harap lengkapi nama toko/kasir dan alamat kasir Anda.');
      setIsFinishingGoogleReg(false);
      return;
    }
    
    if (trimmedStoreName.length > 25) {
      setErrorMess('Nama toko/kasir dibatasi maksimal 25 karakter agar pas di layar HP.');
      setIsFinishingGoogleReg(false);
      return;
    }
    
    if (trimmedAddress.length > 50) {
      setErrorMess('Alamat kasir dibatasi maksimal 50 karakter agar hemat ruang.');
      setIsFinishingGoogleReg(false);
      return;
    }
    
    try {
      const defaultExpiry = new Date();
      defaultExpiry.setMonth(defaultExpiry.getMonth() + 3);
      
      const parts = emailLower.split('@');
      const baseUsername = parts[0].replace(/[^a-zA-Z0-9]/g, '') || `user${Date.now().toString().slice(-6)}`;
      
      let usernameCandidate = baseUsername;
      let checkMap = await getDoc(doc(db, 'usernames', usernameCandidate));
      let counter = 1;
      while (checkMap.exists()) {
        usernameCandidate = `${baseUsername}${counter}`;
        checkMap = await getDoc(doc(db, 'usernames', usernameCandidate));
        counter++;
      }
      
      const matched: RegisteredUser = {
        id: uid,
        storeName: trimmedStoreName,
        username: usernameCandidate,
        email: emailLower,
        password: '',
        address: trimmedAddress,
        securityQuestion: '',
        securityAnswer: '',
        dateCreated: new Date().toISOString(),
        expiryDate: defaultExpiry.toISOString().split('T')[0]
      };
      
      await setDoc(doc(db, 'registered_users', uid), matched);
      await setDoc(doc(db, 'usernames', usernameCandidate), {
        email: emailLower,
        userId: uid
      });
      await setDoc(doc(db, 'users', uid), {
        userId: uid,
        name: matched.storeName,
        address: matched.address,
        createdAt: new Date().toISOString()
      });
      
      localStorage.setItem('kasir_current_user', JSON.stringify(matched));
      
      const savedStores = localStorage.getItem('kasir_stores');
      let storeList = [];
      if (savedStores) {
        try {
          storeList = JSON.parse(savedStores);
        } catch {
          storeList = [];
        }
      }
      const filteredStoreList = storeList.filter((s: any) => s.id !== 'default');
      const newStoreEntry = { id: uid, name: matched.storeName };
      localStorage.setItem('kasir_stores', JSON.stringify([...filteredStoreList, newStoreEntry]));
      
      setShowGoogleRegModal(false);
      setSuccessMess(`Pendaftaran berhasil! Selamat datang di ${matched.storeName}.`);
      
      setTimeout(() => {
        onLoginSuccess(matched);
      }, 1550);
      
    } catch (err: any) {
      console.error('Finish Google registration error:', err);
      setErrorMess('Gagal menyelesaikan registrasi: ' + (err.message || 'Silakan coba lagi.'));
    } finally {
      setIsFinishingGoogleReg(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMess('');
    setSuccessMess('');

    const trimmedStoreName = storeName.trim();
    const trimmedAddress = storeAddress.trim();
    const trimmedUsername = username.trim();
    // Email is now optional! If left blank, we generate a virtual email under the hood.
    const isEmailBlank = !email.trim();
    const trimmedEmail = isEmailBlank 
      ? `${trimmedUsername.toLowerCase()}@kasirpintar.com` 
      : email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedStoreName || !trimmedAddress || !trimmedUsername || !trimmedPassword || !confirmRegPassword.trim()) {
      setErrorMess('Harap lengkapi seluruh formulir registrasi termasuk alamat kasir.');
      return;
    }

    if (trimmedStoreName.length > 25) {
      setErrorMess('Nama toko/kasir dibatasi maksimal 25 karakter agar pas di layar HP.');
      return;
    }

    if (trimmedAddress.length > 50) {
      setErrorMess('Alamat kasir dibatasi maksimal 50 karakter agar hemat ruang.');
      return;
    }

    if (trimmedPassword.length < 6) {
      setErrorMess('Sandi/Password minimal harus terdiri dari 6 karakter.');
      return;
    }

    if (trimmedPassword !== confirmRegPassword.trim()) {
      setErrorMess('Konfirmasi password tidak cocok! Pastikan kedua input password sama.');
      return;
    }

    if (!isEmailBlank) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        setErrorMess('Format alamat email tidak valid.');
        return;
      }
    }

    const normalizedUser = trimmedUsername.toLowerCase();
    if (normalizedUser === 'admin') {
      setErrorMess('Username "admin" dilindungi untuk kebutuhan Super Admin.');
      return;
    }

    try {
      // 1. Check uniqueness of username mapping in Firestore
      const uMapSnap = await getDoc(doc(db, 'usernames', normalizedUser));
      if (uMapSnap.exists()) {
        setErrorMess('Username sudah digunakan kasir lain! Pilih username unik lainnya.');
        return;
      }

      // 2. Create the user inside Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
      const uid = userCredential.user.uid;

      const defaultExpiry = new Date();
      defaultExpiry.setMonth(defaultExpiry.getMonth() + 3);
      
      const newUser: RegisteredUser = {
        id: uid,
        storeName: trimmedStoreName,
        username: trimmedUsername,
        email: trimmedEmail,
        password: trimmedPassword,
        address: trimmedAddress,
        securityQuestion: '',
        securityAnswer: '',
        dateCreated: new Date().toISOString(),
        expiryDate: defaultExpiry.toISOString().split('T')[0]
      };

      // 3. Save to /registered_users/{uid}
      await setDoc(doc(db, 'registered_users', uid), newUser);

      // 4. Save mapping /usernames/{username}
      await setDoc(doc(db, 'usernames', normalizedUser), {
        email: trimmedEmail,
        userId: uid
      });

      // 5. Save users settings /users/{uid}
      await setDoc(doc(db, 'users', uid), {
        userId: uid,
        name: trimmedStoreName,
        address: trimmedAddress,
        createdAt: new Date().toISOString()
      });

      // Maintain local variables for local cache fallbacks
      localStorage.setItem('kasir_current_user', JSON.stringify(newUser));
      
      // Initialize in local stores list too
      const savedStores = localStorage.getItem('kasir_stores');
      let storeList = [];
      if (savedStores) {
        try {
          storeList = JSON.parse(savedStores);
        } catch {
          storeList = [];
        }
      }
      const filteredStoreList = storeList.filter((s: any) => s.id !== 'default');
      const newStoreEntry = { id: uid, name: trimmedStoreName };
      localStorage.setItem('kasir_stores', JSON.stringify([...filteredStoreList, newStoreEntry]));

      // Keep user list in localStorage as a quick cache
      const savedLocalUsers = localStorage.getItem('kasir_registered_users');
      let localUsersList = [];
      if (savedLocalUsers) {
        try {
          localUsersList = JSON.parse(savedLocalUsers);
        } catch {}
      }
      localStorage.setItem('kasir_registered_users', JSON.stringify([...localUsersList.filter((u: any) => u.id !== uid), newUser]));

      setSuccessMess('Registrasi Kasir Berhasil! Mempersiapkan sistem Anda...');
      setTimeout(() => {
        onLoginSuccess(newUser);
      }, 2500);
    } catch (e: any) {
      console.error('Registration error:', e);
      let errMsg = e.message || 'Gagal mendaftarkan akun.';
      if (e.code === 'auth/email-already-in-use') {
        errMsg = 'Alamat email sudah terdaftar di sistem! Silakan gunakan email lain atau login.';
      }
      setErrorMess(errMsg);
    }
  };

  // Timer countdown hook for OTP code lifetimes
  React.useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleFindAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMess('');
    setSimulatedEmailSent(null);

    const trimmedRecoverUser = recoverUser.trim();
    if (!trimmedRecoverUser) {
      setErrorMess('Harap masukkan username atau alamat email pemilik kasir.');
      return;
    }

    try {
      let matched: RegisteredUser | undefined;

      if (trimmedRecoverUser.includes('@')) {
        const q = query(collection(db, 'registered_users'), where('email', '==', trimmedRecoverUser.toLowerCase()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          matched = snap.docs[0].data() as RegisteredUser;
        }
      } else {
        const uMapSnap = await getDoc(doc(db, 'usernames', trimmedRecoverUser.toLowerCase()));
        if (uMapSnap.exists()) {
          const { userId } = uMapSnap.data();
          const regSnap = await getDoc(doc(db, 'registered_users', userId));
          if (regSnap.exists()) {
            matched = regSnap.data() as RegisteredUser;
          }
        }
      }

      if (!matched) {
        setErrorMess('Username atau Alamat Email tidak ditemukan di database cloud.');
        setFoundUser(null);
        return;
      }

      setFoundUser(matched);
      setRecoveryMethod('select');
    } catch (error: any) {
      console.error(error);
      setErrorMess('Gagal mencari akun: ' + error.message);
    }
  };

  const obfuscateEmail = (emailStr: string) => {
    if (!emailStr) return '';
    const parts = emailStr.split('@');
    if (parts.length !== 2) return emailStr;
    const name = parts[0];
    const domain = parts[1];
    if (name.length <= 2) return `${name[0]}*@${domain}`;
    return `${name.slice(0, 2)}*****${name.slice(-1)}@${domain}`;
  };

  const sendEmailOTP = async () => {
    if (!foundUser) return;
    setErrorMess('');
    setSuccessMess('');

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setOtpCode(otp);
    setInputOtp('');
    setOtpVerified(false);
    
    setNewPassword('');
    setConfirmNewPassword('');

    const userEmail = foundUser.email || `${foundUser.username}@gmail.com`;

    setSimulatedEmailSent({
      to: userEmail,
      subject: "🔒 KODE AKTIVASI PEMULIHAN SANDI SAF KASIR",
      otp: otp,
      time: new Date().toLocaleTimeString('id-US', { hour12: false }),
    });

    setSuccessMess(`Simulasi Kode Pemulihan OTP dikirim ke email: ${obfuscateEmail(userEmail)}! Silakan lihat kotak surat simulasi di bawah.`);
    setRecoveryMethod('email');
    setTimer(60);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMess('');
    setSuccessMess('');

    if (!inputOtp.trim()) {
      setErrorMess('Harap masukkan kode OTP 6-digit.');
      return;
    }

    if (inputOtp.trim() === otpCode) {
      setOtpVerified(true);
      setSuccessMess('Integrasi sukses! Sandi email terverifikasi, silakan buat password baru Anda.');
      setSimulatedEmailSent(null);
    } else {
      setErrorMess('Kode verifikasi OTP salah atau telah kedaluwarsa! Cek email Anda kembali.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMess('');
    setSuccessMess('');

    if (!newPassword.trim() || !confirmNewPassword.trim()) {
      setErrorMess('Harap isi password baru dan konfirmasinya.');
      return;
    }

    if (newPassword.trim().length < 6) {
      setErrorMess('Sandi/Password baru minimal harus terdiri dari 6 karakter.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMess('Konfirmasi password baru tidak cocok!');
      return;
    }

    if (!foundUser) return;

    try {
      await updateDoc(doc(db, 'registered_users', foundUser.id), {
        password: newPassword.trim()
      });
      
      setSuccessMess('Selamat! Password kasir Anda telah direset di database. Silakan login kembali.');
      setTimeout(() => {
        // Reset state
        setTab('login');
        setRecoverUser('');
        setFoundUser(null);
        setOtpCode('');
        setInputOtp('');
        setOtpVerified(false);
        setNewPassword('');
        setConfirmNewPassword('');
        setErrorMess('');
        setRecoveryMethod('select');
      }, 1500);
    } catch (e: any) {
      console.error(e);
      setErrorMess('Gagal mengupdate password di database cloud. Hubungi admin.');
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-tr from-emerald-50 via-slate-50 to-emerald-100/50 flex items-center justify-center p-4 relative overflow-y-auto font-sans py-8">
      
      {/* Absolute Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-60 -z-10" />

      <div className="w-full max-w-md flex flex-col gap-5 relative z-10">

        {/* SIMULATED OUTBOX/INBOX POPUP (Simulasi Pengiriman Email OTP) */}
        {simulatedEmailSent && (
          <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl shadow-xl p-4 sm:p-5 flex flex-col gap-2.5 animate-fadeIn font-mono text-xs max-w-md w-full">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5 text-[11px] font-black tracking-wide text-indigo-400">
                <Mail className="w-4 h-4 text-indigo-400 animate-bounce shrink-0" />
                <span>📬 AIR-SANDBOX MAIL DELIVERED</span>
              </div>
              <span className="text-[9.5px] text-slate-500 font-extrabold bg-slate-800 px-2 py-0.5 rounded-full uppercase">
                Simulasi Server SMTP
              </span>
            </div>

            <div className="flex flex-col gap-1 text-[10.5px]">
              <div><span className="text-slate-500 font-mono">Kepada  :</span> <span className="text-emerald-300 font-bold">{simulatedEmailSent.to}</span></div>
              <div><span className="text-slate-500 font-mono">Subjek  :</span> <span className="text-slate-300 font-bold">{simulatedEmailSent.subject}</span></div>
              <div><span className="text-slate-500 font-mono">Waktu   :</span> <span className="text-slate-400">{simulatedEmailSent.time} • Baru Saja</span></div>
            </div>

            <div className="bg-indigo-950/40 border border-indigo-905/50 rounded-2xl p-3.5 mt-1 flex flex-col gap-1 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-8 h-8 rounded-bl-xl bg-indigo-500/10 flex items-center justify-center text-[10px] font-black text-indigo-400">
                OTP
              </div>
              <p className="text-slate-300 text-[11px] leading-snug">
                Halo Pemilik Toko, kami menerima permintaan reset sandi untuk akun kasir Anda. Silakan masukkan kode OTP rahasia berikut:
              </p>
              <div className="font-mono text-2xl font-black text-white hover:text-indigo-300 transition-colors py-1.5 tracking-widest my-1 border border-dashed border-indigo-805 bg-indigo-900/30 rounded-xl select-all select-none cursor-pointer" title="Klik untuk memblokir kode">
                {simulatedEmailSent.otp}
              </div>
              <p className="text-[10px] text-indigo-300">
                ⚠️ Kode ini hanya berlaku 60 detik. Jangan pernah berikan kode ini kepada pihak lain!
              </p>
            </div>
          </div>
        )}

        {/* MAIN ID CARD */}
        <div className="w-full bg-white/95 backdrop-blur-md rounded-3xl border border-emerald-100/80 shadow-2xl shadow-emerald-950/5 overflow-hidden p-6 sm:p-8 flex flex-col gap-6">
        
          {/* Brand KOP Header branding */}
          <div className="flex flex-col items-center text-center gap-2 border-b border-slate-100/80 pb-5 relative">
            {/* Super Admin Trigger Icon */}
            <button
              type="button"
              onClick={() => setShowSuperAdmin(!showSuperAdmin)}
              title="Akses Super Admin Panel"
              className="absolute top-0 right-0 p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-xl transition-all cursor-pointer"
            >
              <Shield className="w-4 h-4" />
            </button>
            <div className="w-16 h-16 rounded-full border-2 border-emerald-100 p-0.5 overflow-hidden shadow-md bg-white flex items-center justify-center">
              <img 
                src={warungLogo} 
                alt="SAF Kasir Logo" 
                className="w-full h-full object-cover rounded-full"
                referrerPolicy="no-referrer"
              />
            </div>
            <h1 className="font-display font-black text-2xl text-slate-800 tracking-tight mt-1">
              SAF <span className="text-emerald-600 font-extrabold">Kasir</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Sistem Kasir Modern, Rekap Stok & Buku Utang Digital
            </p>
            <div className={`mt-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 transition-all duration-300 ${isOnline ? 'bg-emerald-50 text-emerald-700 border-emerald-150' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
              <span className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`}></span>
              {isOnline ? 'Mode ON-LINE' : 'Mode OFF-LINE'}
            </div>
          </div>

          {/* Success/Error Toast alert banner */}
          {errorMess && (
            <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 font-bold leading-relaxed flex items-start gap-2 animate-shake">
              <Lock className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMess}</span>
            </div>
          )}

          {successMess && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 font-bold leading-relaxed flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMess}</span>
            </div>
          )}

          {/* Main interactive sign-in methods */}
          {!showSuperAdmin ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3.5">
                <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-center">
                  Metode Akses Instan & Aman
                </div>
                
                {/* GOOGLE PRIMARY ACTION */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-4 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-95 shadow-md shadow-indigo-100 hover:shadow-indigo-200"
                >
                  <svg className="w-4.5 h-4.5 shrink-0 bg-white p-0.5 rounded-full" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.103C18.23 1.83 15.49 1 12.24 1a10.957 10.957 0 0 0-11 11 10.957 10.957 0 0 0 11 11c6.56 0 10.94-4.5 10.94-10.875 0-.743-.075-1.3-.175-1.84H12.24z"
                    />
                  </svg>
                  <span>Masuk & Daftar Otomatis via Google</span>
                </button>

                {/* OFFLINE GUEST ACTION */}
                <button
                  type="button"
                  onClick={handleGuestLogin}
                  className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-250/45 font-bold py-3.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-95"
                >
                  <Store className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Coba Demo / Mode Offline</span>
                </button>

                {/* SUPER ADMIN SHORTCUT TRIGGER */}
                <div className="text-center pt-1.5 border-t border-slate-100 mt-1">
                  <button
                    type="button"
                    onClick={() => setShowSuperAdmin(true)}
                    className="text-[10.5px] font-bold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    ⚙️ Masuk sebagai Super Admin (Pengembang)
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* SUPER ADMIN LOGIN FORM */
            <form onSubmit={handleLogin} className="flex flex-col gap-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-705">
                  <Shield className="w-4 h-4 text-indigo-500" />
                  <span>MASUK SUPER ADMIN KASIR</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowSuperAdmin(false);
                    setErrorMess('');
                  }}
                  className="text-[10.5px] font-bold text-indigo-650 hover:underline cursor-pointer"
                >
                  Kembali
                </button>
              </div>

               <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Sandi Rahasia Superadmin</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Key className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password admin Anda"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl py-3 pl-10 pr-10 text-xs font-semibold text-slate-800 outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span>Verifikasi & Masuk Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>

        {isFirebasePlaceholder && (
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-3xl p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex items-start gap-2.5">
              <CloudOff className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-xs font-bold text-amber-800">Layanan Cloud Belum Aktif</h4>
                <p className="text-[10.5px] text-amber-700 font-semibold leading-relaxed mt-1">
                  Aplikasi saat ini berjalan dalam <strong>Mode Offline Mandiri</strong> karena kredensial Firebase Cloud Anda belum diaktifkan/dikonfigurasi secara penuh.
                </p>
                <div className="mt-2.5 text-[10px] text-slate-700 leading-normal pl-3 border-l-2 border-amber-300">
                  <p className="font-semibold">💡 Cara Mudah Memulai:</p>
                  <ul className="list-disc pl-3 mt-1 space-y-1 font-medium">
                    <li>
                      <strong>Penggunaan Mandiri (Lokal):</strong> Cukup sentuh tombol <strong>"Coba Demo / Mode Offline"</strong> di bagian atas. Anda bisa langsung masuk dan mengelola barang, mencatat penjualan, serta piutang 100% aman di HP tanpa daftar!
                    </li>
                    <li>
                      <strong>Sinkronisasi Cloud (Online):</strong> Jika butuh sinkronisasi data online jarak jauh, Anda bisa menghubungkan database Firebase menggunakan panel konfigurasi AI Studio di atas.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bantuan & Kontak Pengembang */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100/80 border border-slate-200/60 rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col items-center text-center gap-3">
          <div className="flex flex-col items-center text-center gap-2 pb-2 border-b border-slate-150/60 w-full">
            <div>
              <span className="text-[9px] font-black text-indigo-650 uppercase tracking-wider block leading-none text-center">Bantuan & Kontak Pengembang</span>
              <h3 className="font-display font-bold text-slate-800 text-[12px] leading-tight mt-1 text-center">
                {adminProfile.name}
              </h3>
            </div>
          </div>

          {adminProfile.notes && (
            <p className="text-[10.5px] text-slate-600 leading-normal font-medium text-center">
              {adminProfile.notes}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2 mt-0.5 w-full justify-center">
            {!adminProfile.hidePhone && adminProfile.phone && (
              <div className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white text-xs font-bold text-slate-705 border border-slate-200/80 rounded-xl shadow-xs transition-colors select-none">
                <Phone className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="font-mono text-[11px] whitespace-nowrap">Telp: {adminProfile.phone}</span>
              </div>
            )}

            {!adminProfile.hideEmail && adminProfile.email && (
              <div className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white text-[11px] font-bold text-slate-705 border border-slate-200/80 rounded-xl shadow-xs transition-colors min-w-0 select-all">
                <Mail className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="text-slate-705 block select-all tracking-tight break-all truncate">
                  {adminProfile.email}
                </span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Google Play Policy Complaint Privacy Policy & Disclaimer Modal */}
      {showDisclaimerModal && (
        <div className="fixed inset-0 z-[150] flex items-start justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setShowDisclaimerModal(false)}
          />
          <div className="mt-24 sm:mt-32 mb-12 relative bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-100 p-6 flex flex-col gap-4 z-10 max-h-[85vh] sm:max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                <h3 className="font-display font-bold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">Kebijakan Privasi & Disclaimer Penggunaan</h3>
              </div>
              <button 
                onClick={() => setShowDisclaimerModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed space-y-3 font-medium">
              <p>
                Selamat datang di <strong>SAF Kasir</strong>. Aplikasi kami dirancang dengan arsitektur Hybrid (Online & Offline) demi fleksibilitas operasional bisnis Anda:
              </p>
              
              <div className="bg-emerald-50/40 p-3 rounded-xl border border-emerald-100 space-y-2">
                <h4 className="font-bold text-[11px] text-emerald-800 uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>1. Mode Online dengan Sinkronisasi Cloud</span>
                </h4>
                <p className="text-[10.5px] text-slate-705">
                  Jika Anda login akun secara online, seluruh transaksi penjualan, data stok, pengeluaran, dan buku utang disinkronkan ke database cloud (Firestore). Berkat fitur <strong>Persistent Cache</strong> terbaru, aplikasi tetap bisa dipakai mencatat transaksi saat internet rumah/toko putus, dan otomatis mendistribusikan data ke cloud begitu sinyal kembali.
                </p>
              </div>

              <div className="bg-amber-50/40 p-3 rounded-xl border border-amber-200/60 space-y-2">
                <h4 className="font-bold text-[11px] text-amber-800 uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  <span>2. Mode Jualan Darurat / Toko Mandiri Offline</span>
                </h4>
                <p className="text-[10.5px] text-slate-705">
                  Jika pertama kali membuka aplikasi Anda tidak memiliki koneksi internet, Anda dapat melewati login dan mengaktifkan <strong>Toko Mandiri Offline</strong>. Seluruh data operasional akan disimpan 100% lokal di browser Anda (Local Storage) tanpa bergantung pada server, menjamin aktivitas jualan kasir Anda tidak terhambat sama sekali.
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-150/60 space-y-2">
                <h4 className="font-bold text-[11px] text-slate-800 uppercase">3. Keamanan Data & Cadangan Mandiri</h4>
                <p className="text-[10.5px]">
                  Bagi pengguna <strong>Toko Mandiri Offline (Tanpa Akun Cloud)</strong>, sangat disarankan untuk melakukan backup data berkala ke format JSON melalui menu <strong>Backup/Restore</strong> ke memori HP. Hal ini mencegah kehilangan data apabila browser dibersihkan, ganti HP, atau terhapus otomatis oleh sistem pembersih sampah HP.
                </p>
              </div>

              <div className="bg-rose-50/25 p-3 rounded-xl border border-rose-100 space-y-1.5">
                <h4 className="font-bold text-[11px] text-rose-800 uppercase flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-rose-600" />
                  <span>4. Pembatasan Tanggung Jawab Kehilangan Data (Bebas Tuntutan Hukum)</span>
                </h4>
                <p className="text-[10px] text-slate-750 font-semibold leading-relaxed">
                  Pengembang / pembuat aplikasi sama sekali tidak bertanggung jawab atas hilangnya data usaha Anda jika Anda memilih mode 100% offline dan tidak melakukan pencadangan mandiri secara rutin. Segala akibat pembersihan cache browser oleh aplikasi booster pihak ketiga atau kelalaian pemeliharaan cadangan adalah tanggung jawab mutlak pengguna, dan <strong>pembuat aplikasi tidak bisa dituntut secara hukum</strong> yang berlaku di daerah mana pun atas alasan apa pun.
                </p>
              </div>

              <div className="bg-indigo-50/30 p-3 rounded-xl border border-indigo-100 space-y-1.5">
                <h4 className="font-bold text-[11px] text-indigo-800 uppercase flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-indigo-600" />
                  <span>5. Jaminan Privasi Mutlak</span>
                </h4>
                <p className="text-[10.5px] text-slate-705 font-semibold">
                  Kami berkomitmen tinggi menjaga rahasia dapur kasir Anda. Pengembang aplikasi tidak memiliki kunci akses untuk memata-matai keuangan, stok modal, laba-rugi, maupun data utang piutang pelanggan Anda. Seluruh intel bisnis dienkripsi & dilokalisasi demi kenyamanan operasional Anda.
                </p>
              </div>

              <div className="bg-sky-50/40 p-3 rounded-xl border border-sky-100 space-y-1.5">
                <h4 className="font-bold text-[11px] text-sky-800 uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
                  <span>6. Disclaimer & Ketentuan Sinkronisasi Online</span>
                </h4>
                <p className="text-[10.5px] text-slate-705 font-semibold leading-relaxed">
                  Bagi pengguna mode Online (Sinkronisasi Cloud Google Firestore): Keberhasilan pengiriman data transaksi ke server cloud sangat bergantung pada stabilitas koneksi jaringan internet di wilayah toko/usaha Anda. Pengembang tidak bertanggung jawab atas kegagalan pembaruan laporan real-time yang disebabkan oleh sinyal internet lambat, kuota internet habis, gangguan operator seluler, maupun modifikasi firewall HP. Pengguna disarankan tetap memanfaatkan fitur ekspor data cadangan (Backup JSON) secara berkala demi lapisan pengamanan ganda.
                </p>
              </div>

              <p className="text-[11px] text-slate-550 italic font-semibold leading-relaxed">
                Dengan mencentang persetujuan ini, Anda menyatakan memahami secara sadar sistem kerja hybrid di atas dan siap mengelola aktivitas jualan secara tertib.
              </p>
            </div>

            <button 
              type="button"
              onClick={() => {
                setShowDisclaimerModal(false);
                setDisclaimerChecked(true);
              }}
              className="mt-2 w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2.5 rounded-xl text-xs shadow-sm cursor-pointer transition-colors"
            >
              Saya Mengerti & Setuju
            </button>
          </div>
        </div>
      )}

      {/* Google Sign-In Complete Registration Modal */}
      {showGoogleRegModal && (
        <div className="fixed inset-0 z-55 flex items-start justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in animate-duration-150">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setShowGoogleRegModal(false)}
          />
          <form 
            onSubmit={handleFinishGoogleRegistration}
            className="mt-24 sm:mt-32 mb-12 relative bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-100 p-6 flex flex-col gap-4 z-10"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-indigo-600" />
                <h3 className="font-display font-bold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">Pendaftaran Toko Baru (melalui E-Mail)</h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowGoogleRegModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed font-semibold bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/40">
              Akun Google Anda <span className="font-bold text-indigo-700">{googleRegUser?.email}</span> berhasil dikoneksikan. Silakan tentukan nama toko dan alamat fisik kasir Anda.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                  Nama Toko / Kasir <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Store className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={25}
                    value={googleStoreName}
                    onChange={(e) => setGoogleStoreName(e.target.value)}
                    placeholder="Contoh: Sembako Makmur"
                    className="block w-full pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all placeholder:text-slate-400 font-semibold text-slate-700 bg-slate-50/40"
                  />
                </div>
                <p className="text-[9.5px] text-slate-400 mt-1 font-medium">Batas maks. 25 karakter agar muat di layar HP.</p>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                  Alamat Lengkap Kasir <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={50}
                    value={googleStoreAddress}
                    onChange={(e) => setGoogleStoreAddress(e.target.value)}
                    placeholder="Contoh: Jl. Dipatiukur No. 10, Bandung"
                    className="block w-full pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all placeholder:text-slate-400 font-semibold text-slate-700 bg-slate-50/40"
                  />
                </div>
                <p className="text-[9.5px] text-slate-400 mt-1 font-medium">Batas maks. 50 karakter agar ringkas.</p>
              </div>

              <div className="pt-2 flex items-start gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-150">
                <input
                  type="checkbox"
                  required
                  id="google-disclaimer-checkbox"
                  checked={disclaimerChecked}
                  onChange={(e) => setDisclaimerChecked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-350 text-indigo-650 focus:ring-indigo-500/20 cursor-pointer"
                />
                <label htmlFor="google-disclaimer-checkbox" className="text-[10px] text-slate-650 font-bold leading-tight select-none cursor-pointer">
                  Saya menyetujui <button type="button" onClick={() => setShowDisclaimerModal(true)} className="text-indigo-650 hover:text-indigo-800 font-extrabold underline inline cursor-pointer">Kebijakan Privasi & Disclaimer Penggunaan</button> aplikasi ini, termasuk batasan tanggung jawab kehilangan data dan pembuat aplikasi tidak bisa dituntut secara hukum. <span className="text-red-500">*</span>
                </label>
              </div>
            </div>

            {errorMess && (
              <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-[10.5px] text-rose-600 font-semibold leading-relaxed animate-shake">
                {errorMess}
              </div>
            )}

            <button
              type="submit"
              disabled={isFinishingGoogleReg}
              className="mt-2 w-full bg-indigo-500 hover:bg-indigo-600 active:scale-98 text-white font-bold py-2.5 rounded-xl text-xs shadow-sm cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isFinishingGoogleReg ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Mendaftarkan Toko...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Selesaikan Pendaftaran & Masuk</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Offline setup choice and customization Modal */}
      {showOfflineModal && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in font-sans">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setShowOfflineModal(false)}
          />
          <div className="mt-16 sm:mt-24 mb-12 relative bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 flex flex-col gap-4 z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-emerald-600" />
                <h3 className="font-display font-black text-sm text-slate-800 uppercase tracking-wide">Mode Akses Offline / Tanpa Internet</h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowOfflineModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed font-semibold bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-100/40 text-center flex flex-col items-center gap-1">
              <span className="text-[13px] text-emerald-950 font-black block">💡 Solusi Jualan Darurat & Mandiri</span>
              Jika tidak ada sinyal internet, Anda tidak perlu login online. Silakan pilih mode operasi di bawah ini agar transaksi/operasional kasir tetap berjalan lancar!
            </div>

            {/* Selector: Demo Mode or Custom Offline Store */}
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                onClick={() => setOfflineMode('demo')}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1.5 transition-all text-xs cursor-pointer ${
                  offlineMode === 'demo'
                    ? 'border-indigo-500 bg-indigo-50/30 ring-1 ring-indigo-500'
                    : 'border-slate-200 hover:border-slate-350 bg-slate-50/20'
                }`}
              >
                <span className="font-black text-indigo-900 flex items-center gap-1">
                  🧪 Mode Demo Saja
                </span>
                <span className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                  Mulai cepat dengan contoh produk & transaksi bawaan untuk dicoba.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setOfflineMode('custom')}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1.5 transition-all text-xs cursor-pointer ${
                  offlineMode === 'custom'
                    ? 'border-emerald-500 bg-emerald-50/30 ring-1 ring-emerald-505'
                    : 'border-slate-200 hover:border-slate-350 bg-slate-50/20'
                }`}
              >
                <span className="font-black text-emerald-900 flex items-center gap-1">
                  🏪 Toko Mandiri Nyata
                </span>
                <span className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                  Buat toko baru siap pakai untuk jualan nyata (nama & alamat buatan Anda).
                </span>
              </button>
            </div>

            {offlineMode === 'demo' ? (
              <div className="flex flex-col gap-4 animate-fade-in">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2 text-slate-650 font-semibold leading-relaxed">
                  <p className="font-bold text-slate-800">📋 Rincian Mode Demo:</p>
                  <ul className="list-disc list-inside space-y-1 text-[11px]">
                    <li>Nama Toko Bawaan: <strong className="text-slate-900">"Kasir Demo (Offline)"</strong></li>
                    <li>Sudah terisi <strong className="text-slate-900">12 barang sembako</strong> populer</li>
                    <li>Semua data penjualan disimpan secara aman di perangkat lokal</li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const guestUser: RegisteredUser = {
                      id: 'default',
                      storeName: 'Kasir Demo (Offline)',
                      username: 'offline',
                      email: 'offline@kasir.local',
                      password: '',
                      address: 'Penyimpanan Lokal Browser',
                      dateCreated: new Date().toISOString(),
                    };
                    localStorage.setItem('kasir_current_user', JSON.stringify(guestUser));
                    localStorage.setItem('kasir_products', JSON.stringify(INITIAL_PRODUCTS));
                    localStorage.setItem('kasir_products_default', JSON.stringify(INITIAL_PRODUCTS));
                    setSuccessMess('Mempersiapkan Mode Demo Offline...');
                    setTimeout(() => {
                      setShowOfflineModal(false);
                      onLoginSuccess(guestUser);
                    }, 1200);
                  }}
                  className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5 animate-pulse"
                >
                  <span>Mulai Coba Mode Demo</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleOfflineCustomLogin} className="flex flex-col gap-4 animate-fade-in">
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                      Nama Toko / Kasir Anda <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Store className="h-4 w-4 text-emerald-600" />
                      </div>
                      <input
                        type="text"
                        required
                        maxLength={25}
                        placeholder="Contoh: Sembako Makmur"
                        onChange={(e) => setOfflineStoreName(e.target.value)}
                        className="block w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-semibold text-slate-705 bg-slate-50/40"
                      />
                    </div>
                    <p className="text-[9.5px] text-slate-400 mt-1 font-medium">Batas maks. 25 karakter agar muat di layar HP & struk.</p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                      Alamat Lengkap Kasir <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-emerald-600" />
                      </div>
                      <input
                        type="text"
                        required
                        maxLength={50}
                        placeholder="Contoh: Jl. Dipatiukur No. 10, Bandung"
                        onChange={(e) => setOfflineStoreAddress(e.target.value)}
                        className="block w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-semibold text-slate-705 bg-slate-50/40"
                      />
                    </div>
                    <p className="text-[9.5px] text-slate-400 mt-1 font-medium">Karakter maks 50 untuk alamat nota ringkas.</p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                      Pilihan Database Barang Awal <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className={`p-2.5 rounded-xl border flex items-center gap-2 text-[10.5px] cursor-pointer font-bold leading-tight ${
                        offlineDatabaseOption === 'demo'
                          ? 'border-emerald-500 bg-emerald-50/20 text-emerald-900'
                          : 'border-slate-200 bg-slate-50/20 text-slate-600'
                      }`}>
                        <input
                          type="radio"
                          name="offline-database-opt"
                          checked={offlineDatabaseOption === 'demo'}
                          onChange={() => setOfflineDatabaseOption('demo')}
                          className="w-3.5 h-3.5 text-emerald-600 focus:ring-emerald-500/20 cursor-pointer"
                        />
                        <span>Produk Sembako Bawaan (12)</span>
                      </label>

                      <label className={`p-2.5 rounded-xl border flex items-center gap-2 text-[10.5px] cursor-pointer font-bold leading-tight ${
                        offlineDatabaseOption === 'clean'
                          ? 'border-emerald-500 bg-emerald-50/20 text-emerald-900'
                          : 'border-slate-200 bg-slate-50/20 text-slate-600'
                      }`}>
                        <input
                          type="radio"
                          name="offline-database-opt"
                          checked={offlineDatabaseOption === 'clean'}
                          onChange={() => setOfflineDatabaseOption('clean')}
                          className="w-3.5 h-3.5 text-emerald-600 focus:ring-emerald-500/20 cursor-pointer"
                        />
                        <span>Mulai Bersih (Kosong)</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* Agreement Text and Trigger Component */}
                  <div className="pt-2 flex items-start gap-2.5 bg-emerald-50/30 p-3 rounded-2xl border border-emerald-150/50">
                    <input
                      type="checkbox"
                      required
                      id="custom-offline-disclaimer-checkbox"
                      checked={offlineDisclaimerChecked}
                      onChange={(e) => setOfflineDisclaimerChecked(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-350 text-emerald-600 focus:ring-emerald-500/20 cursor-pointer accent-emerald-600 shrink-0"
                    />
                    <label htmlFor="custom-offline-disclaimer-checkbox" className="text-[10px] text-slate-650 font-bold leading-tight select-none cursor-pointer">
                      Saya menyetujui <button type="button" onClick={() => setShowDisclaimerModal(true)} className="text-emerald-600 hover:text-emerald-800 font-extrabold underline inline cursor-pointer">Kebijakan Privasi & Disclaimer Penggunaan</button> aplikasi ini, termasuk batasan tanggung jawab kehilangan data dan pembuat aplikasi tidak bisa dituntut secara hukum. <span className="text-red-500">*</span>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!offlineDisclaimerChecked}
                  className={`w-full mt-2 font-bold py-3 text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 ${
                    offlineDisclaimerChecked
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer hover:shadow-lg scale-[1.01]'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 shadow-none'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Aktifkan Toko Darurat Offline</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
