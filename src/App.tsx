/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, BookOpen, Warehouse, Heart, BadgeAlert, Loader2, Smartphone, CloudUpload, CloudDownload, RefreshCw, CheckCircle, AlertTriangle, X, Database, Mail } from 'lucide-react';
import Header from './components/Header';
import POSView from './components/POSView';
import StockView from './components/StockView';
import HistoryView from './components/HistoryView';
import DebtView from './components/DebtView';
import SummaryView from './components/SummaryView';
import BackupRestoreView from './components/BackupRestoreView';
import LoginPortal, { RegisteredUser } from './components/LoginPortal';
import AdminPanel from './components/AdminPanel';
import ExpenseView from './components/ExpenseView';
import FeedbackFAB from './components/FeedbackFAB';
import { INITIAL_PRODUCTS } from './initialData';
import { Product, Transaction, Debt, Expense } from './types';
import { db, auth, handleFirestoreError, OperationType, isFirebasePlaceholder } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('pos');

  // Master Authentication States
  const [currentUser, setCurrentUser] = useState<RegisteredUser | null>(() => {
    const saved = localStorage.getItem('kasir_current_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);

  // Firebase Authentication State Tracking
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Firebase Auth State Changed:', user?.email, user?.uid);
      setFirebaseUser(user);
      setIsAuthReady(true);
      if (user && (user.email === 'admin@kasirpintar.com' || user.email === 'adminkursus@gmail.com')) {
        setIsAdminLoggedIn(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // Multi-Store Profiles List
  const [stores, setStores] = useState<{ id: string; name: string }[]>(() => {
    const saved = localStorage.getItem('kasir_stores');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((s: any) => 
            s.id === 'default' && s.name === 'Kasir Sembako Utama' 
              ? { ...s, name: 'Kasir' } 
              : s
          );
        }
      } catch (e) {
        console.error(e);
      }
    }
    return [{ id: 'default', name: 'Kasir' }];
  });

  const [activeStoreId, setActiveStoreId] = useState<string>(() => {
    const savedUser = localStorage.getItem('kasir_current_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.id) return parsed.id;
      } catch {}
    }
    return localStorage.getItem('kasir_active_store_id') || 'default';
  });

  const [loadedStoreId, setLoadedStoreId] = useState<string>('');

  // Dynamic Local states supporting fast transitions
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Sync store directories
  useEffect(() => {
    localStorage.setItem('kasir_stores', JSON.stringify(stores));
  }, [stores]);

  useEffect(() => {
    localStorage.setItem('kasir_active_store_id', activeStoreId);
  }, [activeStoreId]);

  // Sync activeStoreId with currentUser id and register in stores
  useEffect(() => {
    if (currentUser) {
      localStorage.removeItem('kasir_explicit_logout');
      setActiveStoreId(currentUser.id);
      setStores(prev => {
        const exists = prev.some(s => s.id === currentUser.id);
        if (!exists) {
          return [...prev, { id: currentUser.id, name: currentUser.storeName }];
        }
        return prev;
      });
    }
  }, [currentUser]);

  // Load proper store state whenever activeStoreId changes offline / initial load
  useEffect(() => {
    const loadStateData = () => {
      const prodKey = `kasir_products_${activeStoreId}`;
      const txKey = `kasir_transactions_${activeStoreId}`;
      const debtKey = `kasir_debts_${activeStoreId}`;
      const expKey = `kasir_expenses_${activeStoreId}`;

      const savedProds = localStorage.getItem(prodKey);
      const savedTxs = localStorage.getItem(txKey);
      const savedDebts = localStorage.getItem(debtKey);
      const savedExps = localStorage.getItem(expKey);

      let loadedProducts: Product[] = [];
      let loadedTransactions: Transaction[] = [];
      let loadedDebts: Debt[] = [];
      let loadedExpenses: Expense[] = [];

      const oldProd = localStorage.getItem('kasir_products');
      const oldTx = localStorage.getItem('kasir_transactions');
      const oldDebt = localStorage.getItem('kasir_debts');
      const oldExp = localStorage.getItem('kasir_expenses');

      if (activeStoreId === 'default') {
        loadedProducts = savedProds ? JSON.parse(savedProds) : (oldProd ? JSON.parse(oldProd) : INITIAL_PRODUCTS);
        loadedTransactions = savedTxs ? JSON.parse(savedTxs) : (oldTx ? JSON.parse(oldTx) : []);
        loadedDebts = savedDebts ? JSON.parse(savedDebts) : (oldDebt ? JSON.parse(oldDebt) : []);
        loadedExpenses = savedExps ? JSON.parse(savedExps) : (oldExp ? JSON.parse(oldExp) : []);
      } else {
        // Users registered start with cached offline data if available, or empty state
        loadedProducts = savedProds ? JSON.parse(savedProds) : [];
        loadedTransactions = savedTxs ? JSON.parse(savedTxs) : [];
        loadedDebts = savedDebts ? JSON.parse(savedDebts) : [];
        loadedExpenses = savedExps ? JSON.parse(savedExps) : [];
      }

      setProducts(loadedProducts);
      setTransactions(loadedTransactions);
      setDebts(loadedDebts);
      setExpenses(loadedExpenses);
      setLoadedStoreId(activeStoreId);
    };

    loadStateData();
  }, [activeStoreId]);

  // Firestore Live Listener Synchronizer
  useEffect(() => {
    if (!activeStoreId || activeStoreId === 'default' || isFirebasePlaceholder) {
      return;
    }

    if (!isAuthReady || !firebaseUser) {
      console.log('Postponing mounting Firestore Live Sync: Auth is not ready or user is not logged in.');
      return;
    }

    const isUserAdmin = firebaseUser.email === 'admin@kasirpintar.com' || firebaseUser.email === 'adminkursus@gmail.com';
    const isStoreOwner = firebaseUser.uid === activeStoreId;
    if (!isStoreOwner && !isUserAdmin) {
      console.log('Postponing mounting Firestore Live Sync: Logged in user is neither the owner nor an admin.', firebaseUser.uid, activeStoreId);
      return;
    }

    console.log('Mounting Firestore Live Sync for Store ID:', activeStoreId);

    // 1. Sync User Registry Entry
    const userPath = `registered_users/${activeStoreId}`;
    const unsubscribeUserRecord = onSnapshot(
      doc(db, 'registered_users', activeStoreId),
      (docSnap) => {
        if (docSnap.exists()) {
          const updatedUser = docSnap.data() as RegisteredUser;
          setCurrentUser(updatedUser);
          localStorage.setItem('kasir_current_user', JSON.stringify(updatedUser));
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, userPath);
      }
    );

    // 2. Sync Products
    const productsPath = `users/${activeStoreId}/products`;
    const unsubscribeProducts = onSnapshot(
      collection(db, 'users', activeStoreId, 'products'),
      (snap) => {
        const prodList: Product[] = [];
        snap.forEach((docSnap) => {
          prodList.push(docSnap.data() as Product);
        });
        setProducts(prodList);
        localStorage.setItem(`kasir_products_${activeStoreId}`, JSON.stringify(prodList));
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, productsPath);
      }
    );

    // 3. Sync Transactions
    const txPath = `users/${activeStoreId}/transactions`;
    const unsubscribeTransactions = onSnapshot(
      collection(db, 'users', activeStoreId, 'transactions'),
      (snap) => {
        const txList: Transaction[] = [];
        snap.forEach((docSnap) => {
          txList.push(docSnap.data() as Transaction);
        });
        // Sort transactions desc by date
        txList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setTransactions(txList);
        localStorage.setItem(`kasir_transactions_${activeStoreId}`, JSON.stringify(txList));
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, txPath);
      }
    );

    // 4. Sync Debts
    const debtsPath = `users/${activeStoreId}/debts`;
    const unsubscribeDebts = onSnapshot(
      collection(db, 'users', activeStoreId, 'debts'),
      (snap) => {
        const debtList: Debt[] = [];
        snap.forEach((docSnap) => {
          debtList.push(docSnap.data() as Debt);
        });
        setDebts(debtList);
        localStorage.setItem(`kasir_debts_${activeStoreId}`, JSON.stringify(debtList));
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, debtsPath);
      }
    );

    // 5. Sync Expenses
    const expensesPath = `users/${activeStoreId}/expenses`;
    const unsubscribeExpenses = onSnapshot(
      collection(db, 'users', activeStoreId, 'expenses'),
      (snap) => {
        const expList: Expense[] = [];
        snap.forEach((docSnap) => {
          expList.push(docSnap.data() as Expense);
        });
        setExpenses(expList);
        localStorage.setItem(`kasir_expenses_${activeStoreId}`, JSON.stringify(expList));
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, expensesPath);
      }
    );

    // Cleanups
    return () => {
      unsubscribeUserRecord();
      unsubscribeProducts();
      unsubscribeTransactions();
      unsubscribeDebts();
      unsubscribeExpenses();
    };
  }, [activeStoreId, isAuthReady, firebaseUser]);

  // Guest-only auto-save backup triggers
  useEffect(() => {
    if (activeStoreId === 'default' && products) {
      localStorage.setItem('kasir_products', JSON.stringify(products));
      localStorage.setItem('kasir_products_default', JSON.stringify(products));
    }
  }, [products, activeStoreId]);

  useEffect(() => {
    if (activeStoreId === 'default' && transactions) {
      localStorage.setItem('kasir_transactions', JSON.stringify(transactions));
      localStorage.setItem('kasir_transactions_default', JSON.stringify(transactions));
    }
  }, [transactions, activeStoreId]);

  useEffect(() => {
    if (activeStoreId === 'default' && debts) {
      localStorage.setItem('kasir_debts', JSON.stringify(debts));
      localStorage.setItem('kasir_debts_default', JSON.stringify(debts));
    }
  }, [debts, activeStoreId]);

  useEffect(() => {
    if (activeStoreId === 'default' && expenses) {
      localStorage.setItem('kasir_expenses', JSON.stringify(expenses));
      localStorage.setItem('kasir_expenses_default', JSON.stringify(expenses));
    }
  }, [expenses, activeStoreId]);

  // Operations and switches
  const handleAddStore = (name: string) => {
    const newStore = { id: `store-${Date.now()}`, name };
    setStores(prev => [...prev, newStore]);
    setActiveStoreId(newStore.id);
  };

  const handleSwitchStore = (id: string) => {
    setActiveStoreId(id);
  };

  // Calculations for global statistics
  const totalSalesToday = useMemo(() => {
    const today = new Date().toDateString();
    return transactions
      .filter(tx => new Date(tx.date).toDateString() === today)
      .reduce((sum, tx) => sum + tx.totalBill, 0);
  }, [transactions]);

  const totalProfitToday = useMemo(() => {
    const today = new Date().toDateString();
    return transactions
      .filter(tx => new Date(tx.date).toDateString() === today)
      .reduce((sum, tx) => sum + tx.profit, 0);
  }, [transactions]);

  const lowStockCount = useMemo(() => {
    return products.filter(p => p.stock <= p.minStock).length;
  }, [products]);

  const totalDebtAmount = useMemo(() => {
    return debts.reduce((sum, d) => sum + d.remainingDebt, 0);
  }, [debts]);

  // UTILITY CARRIERS: Stock Adjustments
  const handleModifyStock = async (productId: string, quantityToDeduct: number) => {
    if (activeStoreId !== 'default') {
      try {
        const prodRef = doc(db, 'users', activeStoreId, 'products', productId);
        const prodSnap = await getDoc(prodRef);
        if (prodSnap.exists()) {
          const currentData = prodSnap.data() as Product;
          const nextStock = Math.max(0, currentData.stock - quantityToDeduct);
          await updateDoc(prodRef, { stock: nextStock });
        }
      } catch (err) {
        console.error('Failed to update stock in Firestore:', err);
      }
    } else {
      setProducts(prevProducts => {
        return prevProducts.map(p => {
          if (p.id === productId) {
            const nextStock = Math.max(0, p.stock - quantityToDeduct);
            return { ...p, stock: nextStock };
          }
          return p;
        });
      });
    }
  };

  const handleUpdateProduct = async (updatedProduct: Product) => {
    if (activeStoreId !== 'default') {
      try {
        await setDoc(doc(db, 'users', activeStoreId, 'products', updatedProduct.id), updatedProduct);
      } catch (err) {
        console.error('Failed to update product in Firestore:', err);
      }
    } else {
      setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    }
  };

  const handleAddProduct = async (newProduct: Product) => {
    if (activeStoreId !== 'default') {
      try {
        await setDoc(doc(db, 'users', activeStoreId, 'products', newProduct.id), newProduct);
      } catch (err) {
        console.error('Failed to add product in Firestore:', err);
      }
    } else {
      setProducts(prev => [...prev, newProduct]);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (activeStoreId !== 'default') {
      try {
        await deleteDoc(doc(db, 'users', activeStoreId, 'products', productId));
      } catch (err) {
        console.error('Failed to delete product from Firestore:', err);
      }
    } else {
      setProducts(prev => prev.filter(p => p.id !== productId));
    }
  };

  // UTILITY CARRIERS: Transaction Add
  const handleAddTransaction = async (newTx: Transaction) => {
    if (activeStoreId !== 'default') {
      try {
        await setDoc(doc(db, 'users', activeStoreId, 'transactions', newTx.id), newTx);
      } catch (err) {
        console.error('Failed to record transaction in Firestore:', err);
      }
    } else {
      setTransactions(prev => [newTx, ...prev]);
    }
  };

  // UTILITY CARRIERS: Debt Management
  const handleAddOrExtendDebt = async (customerName: string, amount: number, notes: string) => {
    if (activeStoreId !== 'default') {
      try {
        const existingIdx = debts.findIndex(d => d.customerName.toLowerCase() === customerName.toLowerCase());
        const nowString = new Date().toISOString();

        if (existingIdx !== -1) {
          const existing = debts[existingIdx];
          const updated: Debt = {
            ...existing,
            totalDebt: existing.totalDebt + amount,
            remainingDebt: existing.remainingDebt + amount,
            notes: `${existing.notes}; ${notes}`,
            status: 'Belum Lunas'
          };
          await setDoc(doc(db, 'users', activeStoreId, 'debts', existing.id), updated);
        } else {
          const newDebt: Debt = {
            id: `debt-${Date.now()}`,
            customerName,
            phone: '',
            totalDebt: amount,
            remainingDebt: amount,
            notes,
            dateCreated: nowString,
            status: 'Belum Lunas',
            payments: []
          };
          await setDoc(doc(db, 'users', activeStoreId, 'debts', newDebt.id), newDebt);
        }
      } catch (err) {
        console.error('Failed to add/extend debt in Firestore:', err);
      }
    } else {
      setDebts(prevDebts => {
        const existingIdx = prevDebts.findIndex(d => d.customerName.toLowerCase() === customerName.toLowerCase());
        const nowString = new Date().toISOString();

        if (existingIdx !== -1) {
          const existing = prevDebts[existingIdx];
          const updated: Debt = {
            ...existing,
            totalDebt: existing.totalDebt + amount,
            remainingDebt: existing.remainingDebt + amount,
            notes: `${existing.notes}; ${notes}`,
            status: 'Belum Lunas'
          };
          const nextDebts = [...prevDebts];
          nextDebts[existingIdx] = updated;
          return nextDebts;
        } else {
          const newDebt: Debt = {
            id: `debt-${Date.now()}`,
            customerName,
            phone: '',
            totalDebt: amount,
            remainingDebt: amount,
            notes,
            dateCreated: nowString,
            status: 'Belum Lunas',
            payments: []
          };
          return [newDebt, ...prevDebts];
        }
      });
    }
  };

  const handleAddDebtProfileManually = async (name: string, phone: string, amount: number, notes: string) => {
    const nowString = new Date().toISOString();
    const newDebt: Debt = {
      id: `debt-${Date.now()}`,
      customerName: name,
      phone,
      totalDebt: amount,
      remainingDebt: amount,
      notes: notes || 'Kasbon manual',
      dateCreated: nowString,
      status: amount > 0 ? 'Belum Lunas' : 'Lunas',
      payments: []
    };

    if (activeStoreId !== 'default') {
      try {
        await setDoc(doc(db, 'users', activeStoreId, 'debts', newDebt.id), newDebt);
      } catch (err) {
        console.error('Failed to add custom debt in Firestore:', err);
      }
    } else {
      setDebts(prev => [newDebt, ...prev]);
    }
  };

  const handleRecordDebtPayment = async (debtId: string, amount: number) => {
    if (activeStoreId !== 'default') {
      try {
        const existing = debts.find(d => d.id === debtId);
        if (existing) {
          const nextRemaining = Math.max(0, existing.remainingDebt - amount);
          const nextPayment: any = {
            id: `pay-${Date.now()}`,
            date: new Date().toISOString(),
            amount: amount
          };
          const updated = {
            ...existing,
            remainingDebt: nextRemaining,
            status: nextRemaining <= 0 ? 'Lunas' : 'Belum Lunas',
            payments: [nextPayment, ...(existing.payments || [])]
          };
          await setDoc(doc(db, 'users', activeStoreId, 'debts', debtId), updated);
        }
      } catch (err) {
        console.error('Failed to record debt payment in Firestore:', err);
      }
    } else {
      setDebts(prevDebts => {
        return prevDebts.map(d => {
          if (d.id === debtId) {
            const nextRemaining = Math.max(0, d.remainingDebt - amount);
            const nextPaymentStr: any = {
              id: `pay-${Date.now()}`,
              date: new Date().toISOString(),
              amount: amount
            };
            const updated = {
              ...d,
              remainingDebt: nextRemaining,
              status: nextRemaining <= 0 ? 'Lunas' : 'Belum Lunas',
              payments: [nextPaymentStr, ...(d.payments || [])]
            };
            return updated;
          }
          return d;
        });
      });
    }
  };

  const handleDeleteDebtProfile = async (debtId: string) => {
    if (activeStoreId !== 'default') {
      try {
        await deleteDoc(doc(db, 'users', activeStoreId, 'debts', debtId));
      } catch (err) {
        console.error('Failed to delete debt profile from Firestore:', err);
      }
    } else {
      setDebts(prev => prev.filter(d => d.id !== debtId));
    }
  };

  const handleAddExpense = async (newExp: Expense) => {
    if (activeStoreId !== 'default') {
      try {
        await setDoc(doc(db, 'users', activeStoreId, 'expenses', newExp.id), newExp);
      } catch (err) {
        console.error('Failed to add expense to Firestore:', err);
      }
    } else {
      setExpenses(prev => [newExp, ...prev]);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (activeStoreId !== 'default') {
      try {
        await deleteDoc(doc(db, 'users', activeStoreId, 'expenses', expenseId));
      } catch (err) {
        console.error('Failed to delete expense from Firestore:', err);
      }
    } else {
      setExpenses(prev => prev.filter(e => e.id !== expenseId));
    }
  };

  // FULL SECURITY AND BACKUP HANDLERS
  const fullBackupData = () => {
    return {
      products,
      debts,
      transactions,
      expenses
    };
  };

  const handleImportBackup = async (importedData: { products: any[], debts: any[], transactions: any[], expenses?: any[] }) => {
    if (importedData.products) setProducts(importedData.products);
    if (importedData.debts) setDebts(importedData.debts);
    if (importedData.transactions) setTransactions(importedData.transactions);
    if (importedData.expenses) setExpenses(importedData.expenses);
  };

  const handleClearHistory = async () => {
    setTransactions([]);
  };

  const handleUpdateUser = async (updatedUser: RegisteredUser) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('kasir_current_user', JSON.stringify(updatedUser));
    if (updatedUser.id !== 'default') {
      try {
        await setDoc(doc(db, 'registered_users', updatedUser.id), updatedUser, { merge: true });
      } catch (err) {
        console.error('Failed to update user profile in Firestore:', err);
      }
    }
  };

  // Synchronize currentUser values with the registry list (kasir_registered_users) inside localStorage/Firestore
  const synchronizedUser = currentUser;

  // Local storage usage monitoring (Alerts user if within 10% of limits - i.e. >= 90% full)
  const localStorageStatus = useMemo(() => {
    let totalBytes = 0;
    try {
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalBytes += (key.length + (localStorage.getItem(key) || '').length) * 2;
        }
      }
    } catch (e) {
      console.error('Error estimating localStorage usage:', e);
    }
    const maxBytes = 5 * 1024 * 1024; // 5 MB standard limit
    const percentage = (totalBytes / maxBytes) * 100;
    return {
      usedKB: Math.round(totalBytes / 1024),
      limitKB: 5120,
      percentage: Math.min(100, Math.round(percentage * 10) / 10),
      isNearLimit: percentage >= 90 // 10% remaining
    };
  }, [products, transactions, debts, expenses, activeStoreId]);

  // Calculate remaining days for trial warning banner of registered users
  const trialDaysRemaining = useMemo(() => {
    if (!synchronizedUser || synchronizedUser.id === 'default') return null;
    
    const activeExpiryStr = synchronizedUser.expiryDate || (() => {
      const created = new Date(synchronizedUser.dateCreated || Date.now());
      created.setMonth(created.getMonth() + 3);
      return created.toISOString().split('T')[0];
    })();

    if (activeExpiryStr) {
      const expiry = new Date(activeExpiryStr);
      expiry.setHours(23, 59, 59, 999);
      const diffMs = expiry.getTime() - new Date().getTime();
      return Math.ceil(diffMs / (1000 * 3600 * 24));
    }
    return null;
  }, [synchronizedUser]);

  // Determine if the current user has hit any application usage bounds
  const restriction = useMemo(() => {
    if (!synchronizedUser) return null;
    
    // 1. Check account status suspend
    if (synchronizedUser.status === 'suspended') {
      return {
        type: 'suspended',
        message: 'Akses akun kasir Anda ditangguhkan/dinonaktifkan sementara oleh Superadmin.'
      };
    }
    
    // 2. Check trial expiry dates limit
    const activeExpiryStr = synchronizedUser.expiryDate || (synchronizedUser.id === 'default' ? undefined : (() => {
      // Fallback: 3 months from creation date
      const created = new Date(synchronizedUser.dateCreated || Date.now());
      created.setMonth(created.getMonth() + 3);
      return created.toISOString().split('T')[0];
    })());

    if (activeExpiryStr) {
      const expiry = new Date(activeExpiryStr);
      expiry.setHours(23, 59, 59, 999);
      if (new Date() > expiry) {
        return {
          type: 'expired',
          message: `Masa uji coba aplikasi Anda telah berakhir pada tanggal ${new Date(activeExpiryStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.`
        };
      }
    }
    
    // 3. Check maximum transaction limit
    if (synchronizedUser.maxTransactions) {
      if (transactions.length >= synchronizedUser.maxTransactions) {
        return {
          type: 'limit_exceeded',
          message: `Batas jumlah transaksi maksimal yang diperbolehkan telah terlampaui (${transactions.length} dari maksimal ${synchronizedUser.maxTransactions} transaksi).`
        };
      }
    }
    
    return null;
  }, [synchronizedUser, transactions.length]);

  // 1. Super Admin Panel Gating
  if (isAdminLoggedIn) {
    return (
      <AdminPanel
        onLogout={async () => {
          setIsAdminLoggedIn(false);
          try {
            await auth.signOut();
          } catch (e) {
            console.error('Gagal sign out admin dari Firebase:', e);
          }
        }}
      />
    );
  }

  // 2. Regular User Login Gating
  if (!currentUser) {
    return (
      <LoginPortal
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setActiveStoreId(user.id);
          setActiveTab('pos');
          localStorage.setItem('kasir_current_user', JSON.stringify(user));
        }}
        onAdminLoginSuccess={() => {
          setIsAdminLoggedIn(true);
        }}
      />
    );
  }

  // 3. User usage limit block screen gating
  if (currentUser && restriction) {
    const savedProfile = localStorage.getItem('kasir_superadmin_profile');
    let adminProfile = {
      name: 'Jopur (kursus WANODYA Bandung)',
      phone: '085872329811',
      email: 'adminkursus@gmail.com',
      notes: ''
    };
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        let parsedPhone = parsed.phone || '085872329811';
        if (parsedPhone === '081234567890') parsedPhone = '085872329811';
        let parsedEmail = parsed.email || 'adminkursus@gmail.com';
        if (parsedEmail === 'support.kasir@gmail.com') parsedEmail = 'adminkursus@gmail.com';
        let parsedNotes = parsed.notes || '';
        if (parsedNotes.includes('Bantuan Teknis Kasir Sembako')) parsedNotes = '';
        
        adminProfile = {
          name: parsed.name || 'Jopur (kursus WANODYA Bandung)',
          phone: parsedPhone,
          email: parsedEmail,
          notes: parsedNotes
        };
      } catch {}
    }

    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl border border-rose-150 p-6 sm:p-8 shadow-xl flex flex-col items-center text-center gap-5">
          
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-full text-rose-600 animate-bounce">
            <BadgeAlert className="w-8 h-8" />
          </div>

          <div>
            <span className="bg-rose-100 text-rose-850 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Batas Penggunaan Tercapai
            </span>
            <h2 className="font-display font-black text-slate-800 text-lg mt-2 leading-tight">
              Akses Aplikasi Dibatasi!
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Akun kasir <strong className="text-slate-700">{currentUser.storeName}</strong> saat ini tidak dapat mengakses menu kasir operasional.
            </p>
          </div>

          {/* Restriction Reason Alert Box */}
          <div className="w-full p-4 bg-rose-50/50 border border-rose-100/60 rounded-2xl text-rose-950 text-xs font-bold leading-relaxed text-left flex gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <span className="block text-[10px] text-rose-455 font-black uppercase tracking-wider mb-0.5">Alasan Pembatasan:</span>
              <p className="text-[11px] leading-relaxed text-slate-700">{restriction.message}</p>
            </div>
          </div>

          {/* Support Contacts Card */}
          <div className="w-full bg-slate-50 border border-slate-200/50 rounded-2xl p-4 text-left flex flex-col gap-3">
            <div className="flex items-center gap-2 pb-1.5 border-b border-slate-150">
              <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin-slow" />
              <div>
                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest block leading-none">Konsultasi / Aktivasi</span>
                <span className="font-bold text-slate-800 text-xs mt-0.5 block">{adminProfile.name}</span>
              </div>
            </div>

            <p className="text-[10.5px] text-slate-650 leading-relaxed font-semibold">
              {adminProfile.notes || 'Hubungi kontak kami di bawah ini untuk mengaktifkan kembali akun Anda secara penuh / menambah batasan transaksi.'}
            </p>

            <div className="flex gap-2">
              <a
                href={`https://wa.me/${adminProfile.phone.replace(/[^0-9]/g, '').startsWith('0') ? '62' + adminProfile.phone.replace(/[^0-9]/g, '').substring(1) : adminProfile.phone.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-250 rounded-xl font-bold text-[11px] text-slate-705 active:scale-95 transition-colors text-center shrink-0 cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="font-mono text-[10.5px]">WA: {adminProfile.phone}</span>
              </a>
              {adminProfile.email && (
                <a
                  href={`mailto:${adminProfile.email}`}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-250 rounded-xl font-bold text-[11px] text-slate-705 active:scale-95 transition-colors text-center shrink-0 cursor-pointer truncate"
                  title={adminProfile.email}
                >
                  <Mail className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="truncate block font-mono text-[10px] text-slate-705">{adminProfile.email}</span>
                </a>
              )}
            </div>
          </div>

          {/* Escape Option: Log Out button */}
          <button
            onClick={() => {
              setCurrentUser(null);
              localStorage.removeItem('kasir_current_user');
            }}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-650 font-bold text-xs rounded-xl transition-all cursor-pointer select-none active:scale-95 text-center mt-1"
          >
            Keluar dari Akun
          </button>

        </div>
      </div>
    );
  }

  // 4. Authenticated App Workspace
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      
      <div className="flex-1">
        {/* Responsive Header Navigation Context */}
        <Header
          totalSalesToday={totalSalesToday}
          totalProfitToday={totalProfitToday}
          lowStockCount={lowStockCount}
          totalDebtAmount={totalDebtAmount}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          stores={stores}
          activeStoreId={activeStoreId}
          onAddStore={handleAddStore}
          onSwitchStore={handleSwitchStore}
          currentUser={currentUser}
          onLogout={() => {
            setCurrentUser(null);
            localStorage.removeItem('kasir_current_user');
            localStorage.setItem('kasir_explicit_logout', 'true');
          }}
          onUpdateUser={handleUpdateUser}
        />

        {/* Dynamic Display of Subview Panels */}
        <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 relative">

          {/* LocalStorage Limit Warnings (Shown if >= 90% full, warning that only 10% is left) */}
          {localStorageStatus.isNearLimit && (
            <div className="mb-6 bg-gradient-to-r from-rose-50 to-red-50 border border-rose-200 rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
              <div className="flex gap-3">
                <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl shrink-0 h-10 w-10 flex items-center justify-center">
                  <Database className="w-5 h-5 animate-bounce text-rose-600" />
                </div>
                <div>
                  <h3 className="font-display font-black text-slate-800 text-sm leading-tight flex items-center gap-1.5">
                    <span className="bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider">SIAGA MEMORI</span>
                    <span>Memori Penyimpanan Browser Hampir Penuh!</span>
                  </h3>
                  <p className="text-xs text-slate-650 mt-1 leading-relaxed font-semibold">
                    Penggunaan memori lokal browser Anda sudah mencapai <strong className="text-rose-700 font-extrabold">{localStorageStatus.percentage}%</strong> ({localStorageStatus.usedKB} KB dari total kapasitas {localStorageStatus.limitKB} KB). Segera lakukan **Backup Cadangan Data** dan hapus transaksi lama di tab **Riwayat** untuk mencegah hilangnya data baru!
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setActiveTab('backup')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all text-center cursor-pointer select-none"
                >
                  <CloudUpload className="w-3.5 h-3.5 shrink-0" />
                  Selesaikan Backup
                </button>
              </div>
            </div>
          )}

          {/* Proactive Trial Warning Banner (Shown if <= 30 days left) */}
          {trialDaysRemaining !== null && trialDaysRemaining <= 30 && trialDaysRemaining >= 0 && (
            <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
              <div className="flex gap-3">
                <div className="p-2.5 bg-amber-100/80 text-amber-700 rounded-xl shrink-0 h-10 w-10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-slate-800 text-sm leading-tight">
                    Masa Uji Coba Segera Berakhir!
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Sisa waktu pakai aplikasi Anda adalah <strong className="text-amber-700 font-black">{trialDaysRemaining} Hari</strong> lagi. Hubungi kami untuk melakukan perpanjangan masa aktif sebelum akses operasional dibatasi.
                  </p>
                </div>
              </div>
              
              {/* Call-to-action button */}
              <div className="flex items-center gap-2 shrink-0">
                {(() => {
                  const savedProfile = localStorage.getItem('kasir_superadmin_profile');
                  let adminProfile = {
                    name: 'Jopur (kursus WANODYA Bandung)',
                    phone: '085872329811',
                  };
                  if (savedProfile) {
                    try {
                      const parsed = JSON.parse(savedProfile);
                      let parsedPhone = parsed.phone || '085872329811';
                      if (parsedPhone === '081234567890') parsedPhone = '085872329811';
                      adminProfile = { ...adminProfile, name: parsed.name || adminProfile.name, phone: parsedPhone };
                    } catch {}
                  }
                  const waUrl = `https://wa.me/${adminProfile.phone.replace(/[^0-9]/g, '').startsWith('0') ? '62' + adminProfile.phone.replace(/[^0-9]/g, '').substring(1) : adminProfile.phone.replace(/[^0-9]/g, '')}?text=Halo%20Admin,%20saya%20ingin%20memperpanjang%20masa%20aktif%20aplikasi%20untuk%20kasir%20${encodeURIComponent(currentUser?.storeName || '')}`;
                  
                  return (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-sm transition-all text-center cursor-pointer select-none"
                    >
                      <Smartphone className="w-3.5 h-3.5 shrink-0" />
                      Perpanjang Sekarang
                    </a>
                  );
                })()}
              </div>
            </div>
          )}


          {activeTab === 'summary' && (
            <SummaryView
              products={products}
              debts={debts}
              transactions={transactions}
              expenses={expenses}
              setActiveTab={setActiveTab}
              totalSalesToday={totalSalesToday}
              totalProfitToday={totalProfitToday}
              lowStockCount={lowStockCount}
              totalDebtAmount={totalDebtAmount}
              currentUser={currentUser}
            />
          )}
 
          {activeTab === 'expense' && (
            <ExpenseView
              expenses={expenses}
              onAddExpense={handleAddExpense}
              onDeleteExpense={handleDeleteExpense}
            />
          )}

          {activeTab === 'pos' && (
            <POSView
              products={products}
              debts={debts}
              onAddTransaction={handleAddTransaction}
              onModifyStock={handleModifyStock}
              onAddOrExtendDebt={handleAddOrExtendDebt}
              activeStoreName={currentUser.storeName}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'stock' && (
            <StockView
              products={products}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProduct={handleDeleteProduct}
              onAddExpense={handleAddExpense}
            />
          )}

          {activeTab === 'debt' && (
            <DebtView
              debts={debts}
              onAddDebtProfile={handleAddDebtProfileManually}
              onRecordDebtPayment={handleRecordDebtPayment}
              onDeleteDebtProfile={handleDeleteDebtProfile}
            />
          )}

          {activeTab === 'history' && (
            <HistoryView
              transactions={transactions}
              onImportBackup={handleImportBackup}
              fullBackupData={fullBackupData}
              onClearHistory={handleClearHistory}
            />
          )}

          {activeTab === 'backup' && (
            <BackupRestoreView
              fullBackupData={fullBackupData}
              onImportBackup={handleImportBackup}
              currentUserStoreName={currentUser ? currentUser.storeName : 'Kasir'}
            />
          )}

        </main>
      </div>

      {/* Suggestion floating button always visible to users */}
      <FeedbackFAB currentUser={currentUser} />

      {/* Aesthetic Footer Branding */}
      <footer className="bg-white border-t border-slate-100 py-4 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Warehouse className="w-4 h-4 text-emerald-500" />
            <span className="font-semibold text-slate-500">SAF Kasir - Kasir & Buku Utang</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-medium">
            <span>Dibuat dengan</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 animate-pulse" />
            <span>untuk Usaha Rakyat Indonesia</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
