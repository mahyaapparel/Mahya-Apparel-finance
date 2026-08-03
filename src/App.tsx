import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  Tag, 
  Layers, 
  PlusCircle, 
  Trash2, 
  Pencil,
  Copy, 
  Check, 
  FileCode, 
  Sparkles, 
  Eraser, 
  RefreshCw,
  Info,
  ChevronRight,
  Calculator,
  Shirt,
  Palette,
  Gem,
  Search,
  CheckCircle,
  FileText,
  Lock,
  Unlock,
  User,
  Users,
  Shield,
  ShieldCheck,
  Download,
  LogOut,
  FileSpreadsheet,
  Link2,
  ExternalLink,
  Eye,
  EyeOff,
  Chrome,
  AlertTriangle,
  Wrench,
  Clock,
  Paperclip,
  Upload,
  Receipt,
  ShoppingCart,
  Printer,
  X,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, Division, TransactionType, ApprovalRequest, AppUser } from './types';
import { auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, signInAnonymously, OperationType, handleFirestoreError } from './firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx-js-style';

// Data Sampel Awal
const initialSampleTransactions: Transaction[] = [
  {
    id: 'tx-1',
    date: '2026-06-28',
    division: 'Konveksi',
    type: 'Pemasukan',
    amount: 1500000,
    description: 'Uang muka pesanan 100 pcs kaos polos',
  },
  {
    id: 'tx-2',
    date: '2026-06-29',
    division: 'Konveksi',
    type: 'Pengeluaran',
    amount: 600000,
    description: 'Pembelian bahan kain cotton combed 30s',
  },
  {
    id: 'tx-3',
    date: '2026-06-29',
    division: 'Sablon',
    type: 'Pemasukan',
    amount: 800000,
    description: 'Pelunasan sablon jaket kelas XII IPA',
  },
  {
    id: 'tx-4',
    date: '2026-06-30',
    division: 'Aksesori',
    type: 'Pemasukan',
    amount: 350000,
    description: 'Penjualan gantungan kunci & stiker merchandise',
  },
  {
    id: 'tx-5',
    date: '2026-06-30',
    division: 'Sablon',
    type: 'Pengeluaran',
    amount: 200000,
    description: 'Pembelian tinta plastisol hitam & emulsi sablon',
  },
  {
    id: 'tx-6',
    date: '2026-06-30',
    division: 'Alat',
    type: 'Pemasukan',
    amount: 500000,
    description: 'Sewa alat press kaos oleh mitra',
  },
  {
    id: 'tx-7',
    date: '2026-06-30',
    division: 'Alat',
    type: 'Pengeluaran',
    amount: 150000,
    description: 'Pembelian obeng & perkakas perawatan mesin',
  },
];

export default function App() {
  // State Otentikasi
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('financial_dashboard_logged_in') === 'true';
  });
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string; picture?: string } | null>(() => {
    const saved = localStorage.getItem('financial_dashboard_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing user info', e);
      }
    }
    return null;
  });

  const [appUsers, setAppUsers] = useState<AppUser[]>([]);

  const isOwner = currentUser?.email?.toLowerCase() === 'mahyaapparel@gmail.com' || 
    appUsers.find(u => u.email.toLowerCase() === currentUser?.email?.toLowerCase())?.role === 'Owner';

  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>(() => {
    const saved = localStorage.getItem('financial_dashboard_approval_requests') || localStorage.getItem('financial_dashboard_deletion_requests');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing approval requests', e);
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('financial_dashboard_approval_requests', JSON.stringify(approvalRequests));
  }, [approvalRequests]);

  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Custom Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    isDanger = true,
    confirmText = 'Ya, Lanjutkan',
    cancelText = 'Batal'
  ) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
      confirmText,
      cancelText,
      isDanger,
    });
  };

  // State Transaksi
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('financial_dashboard_txs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing localStorage transactions, reverting to sample', e);
      }
    }
    return initialSampleTransactions;
  });

  // Sinkronisasi ke LocalStorage
  useEffect(() => {
    localStorage.setItem('financial_dashboard_txs', JSON.stringify(transactions));
  }, [transactions]);

  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(true);

  // Refs to avoid stale closures in onSnapshot
  const transactionsRef = useRef<Transaction[]>(transactions);
  const approvalRequestsRef = useRef<ApprovalRequest[]>(approvalRequests);
  const appUsersRef = useRef<AppUser[]>(appUsers);

  // Keep track of whether the initial Firestore sync/migration has run to avoid overwriting user deletes
  const hasInitializedTransactionsRef = useRef<boolean>(false);
  const hasInitializedRequestsRef = useRef<boolean>(false);

  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

  useEffect(() => {
    approvalRequestsRef.current = approvalRequests;
  }, [approvalRequests]);

  useEffect(() => {
    appUsersRef.current = appUsers;
  }, [appUsers]);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const oauthUser = {
          name: user.displayName || (user.isAnonymous ? 'Admin Mahya' : 'Pengguna Google'),
          email: user.email || (user.isAnonymous ? 'admin@mahya.com' : ''),
          picture: user.photoURL || ''
        };
        localStorage.setItem('financial_dashboard_logged_in', 'true');
        localStorage.setItem('financial_dashboard_user', JSON.stringify(oauthUser));
        setCurrentUser(oauthUser);
        setIsLoggedIn(true);

        // Sync to users collection in Firestore with retry
        if (oauthUser.email) {
          const syncUserToFirestore = async (retries = 3, delay = 1500) => {
            const userDocId = oauthUser.email.toLowerCase().replace(/\./g, '_');
            const userDocRef = doc(db, 'users', userDocId);
            
            try {
              let userSnap;
              try {
                userSnap = await getDoc(userDocRef);
              } catch (err) {
                return handleFirestoreError(err, OperationType.GET, `users/${userDocId}`);
              }
              const nowIso = new Date().toISOString();

              if (userSnap.exists()) {
                try {
                  await setDoc(userDocRef, {
                    name: oauthUser.name,
                    picture: oauthUser.picture,
                    lastLoginAt: nowIso
                  }, { merge: true });
                } catch (err) {
                  return handleFirestoreError(err, OperationType.WRITE, `users/${userDocId}`);
                }
              } else {
                const defaultRole = oauthUser.email.toLowerCase() === 'mahyaapparel@gmail.com' ? 'Owner' : 'Admin';
                try {
                  await setDoc(userDocRef, {
                    email: oauthUser.email,
                    name: oauthUser.name,
                    picture: oauthUser.picture,
                    role: defaultRole,
                    lastLoginAt: nowIso
                  });
                } catch (err) {
                  return handleFirestoreError(err, OperationType.WRITE, `users/${userDocId}`);
                }
              }
            } catch (err: any) {
              const errMsg = err?.message || String(err);
              if (errMsg.includes('offline') || errMsg.includes('Failed to get document')) {
                if (retries > 0) {
                  console.warn(`Firestore sync delayed (client is offline), retrying in ${delay}ms... (${retries} retries left)`);
                  setTimeout(() => {
                    syncUserToFirestore(retries - 1, delay * 1.5);
                  }, delay);
                } else {
                  console.warn('Could not sync user info to cloud because client remained offline. Continuing in offline mode.');
                }
              } else {
                console.error('Error syncing user info to Firestore:', err);
                throw err;
              }
            }
          };
          syncUserToFirestore();
        }
      } else {
        const localLoggedIn = localStorage.getItem('financial_dashboard_logged_in') === 'true';
        const localUserStr = localStorage.getItem('financial_dashboard_user');
        if (localLoggedIn && localUserStr) {
          try {
            const localUser = JSON.parse(localUserStr);
            if (localUser.email === 'admin@mahya.com') {
              await signInAnonymously(auth);
            }
          } catch (err) {
            console.error('Failed auto anonymous sign-in:', err);
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time synchronization with Firestore (PC, Mobile, and multi-browser sync)
  useEffect(() => {
    if (!isLoggedIn) {
      hasInitializedTransactionsRef.current = false;
      hasInitializedRequestsRef.current = false;
      return;
    }

    // 1. Listen to transactions in real-time
    const unsubscribeTxs = onSnapshot(collection(db, 'transactions'), (snapshot) => {
      setIsCloudConnected(true);
      const txList: Transaction[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        txList.push({
          id: docSnap.id,
          date: data.date,
          division: data.division,
          type: data.type,
          amount: data.amount,
          description: data.description,
          buktiTransaksi: data.buktiTransaksi
        });
      });

      // Migration: If Firestore is empty but we have local data, migrate them to cloud
      if (snapshot.empty && !hasInitializedTransactionsRef.current && transactionsRef.current.length > 0) {
        hasInitializedTransactionsRef.current = true;
        transactionsRef.current.forEach(async (tx) => {
          try {
            const cleanTx = { ...tx };
            if (cleanTx.buktiTransaksi === undefined) {
              delete cleanTx.buktiTransaksi;
            }
            await setDoc(doc(db, 'transactions', tx.id), cleanTx);
          } catch (err) {
            console.error('Gagal migrasi transaksi ke cloud:', err);
          }
        });
        return;
      }
      hasInitializedTransactionsRef.current = true;

      // Sort: date descending, then id descending to maintain stable order
      txList.sort((a, b) => {
        if (b.date !== a.date) {
          return b.date.localeCompare(a.date);
        }
        return b.id.localeCompare(a.id);
      });
      
      setTransactions(txList);
    }, (error) => {
      console.error("Gagal sinkronisasi data transaksi dari Firestore:", error);
      setIsCloudConnected(false);
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    // 2. Listen to approval requests in real-time
    const unsubscribeRequests = onSnapshot(collection(db, 'approval_requests'), (snapshot) => {
      setIsCloudConnected(true);
      const reqList: ApprovalRequest[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        reqList.push({
          id: docSnap.id,
          requestType: data.requestType,
          transactionId: data.transactionId,
          transactionDesc: data.transactionDesc,
          transactionAmount: data.transactionAmount,
          transactionDivision: data.transactionDivision,
          requestedBy: data.requestedBy,
          requestedAt: data.requestedAt,
          status: data.status,
          newData: data.newData,
        });
      });

      // Migration: If cloud is empty but we have local requests, migrate them
      if (snapshot.empty && !hasInitializedRequestsRef.current && approvalRequestsRef.current.length > 0) {
        hasInitializedRequestsRef.current = true;
        approvalRequestsRef.current.forEach(async (req) => {
          try {
            await setDoc(doc(db, 'approval_requests', req.id), req);
          } catch (err) {
            console.error('Gagal migrasi pengajuan ke cloud:', err);
          }
        });
        return;
      }
      hasInitializedRequestsRef.current = true;

      // Sort requests by id descending (newest request first)
      reqList.sort((a, b) => b.id.localeCompare(a.id));
      setApprovalRequests(reqList);
    }, (error) => {
      console.error("Gagal sinkronisasi data pengajuan dari Firestore:", error);
      setIsCloudConnected(false);
      handleFirestoreError(error, OperationType.LIST, 'approval_requests');
    });

    // 3. Listen to users in real-time
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setIsCloudConnected(true);
      const userList: AppUser[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        userList.push({
          email: data.email || '',
          name: data.name || '',
          picture: data.picture || '',
          role: data.role || 'Admin',
          lastLoginAt: data.lastLoginAt || '',
        });
      });
      // Sort users by lastLoginAt descending
      userList.sort((a, b) => b.lastLoginAt.localeCompare(a.lastLoginAt));
      setAppUsers(userList);
    }, (error) => {
      console.error("Gagal sinkronisasi data pengguna dari Firestore:", error);
      setIsCloudConnected(false);
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubscribeTxs();
      unsubscribeRequests();
      unsubscribeUsers();
    };
  }, [isLoggedIn]);

  // Google Sign-in with Firebase popup
  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const oauthUser = {
        name: user.displayName || 'Pengguna Google',
        email: user.email || '',
        picture: user.photoURL || ''
      };

      localStorage.setItem('financial_dashboard_logged_in', 'true');
      localStorage.setItem('financial_dashboard_user', JSON.stringify(oauthUser));
      setCurrentUser(oauthUser);
      setIsLoggedIn(true);
      triggerToast(`Selamat Datang, ${oauthUser.name}! Login Google Berhasil.`);
    } catch (err: any) {
      console.error('Firebase Sign-In Error:', err);
      if (err.code === 'auth/popup-blocked') {
        triggerToast('Tolong izinkan pop-up browser untuk masuk dengan Google.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        triggerToast('Login dibatalkan.');
      } else {
        triggerToast(err.message || 'Terjadi kesalahan login Google.');
      }
    }
  };

  // State Form Input
  const [inputDate, setInputDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [inputDivision, setInputDivision] = useState<Division>('Konveksi');
  const [inputType, setInputType] = useState<TransactionType>('Pemasukan');
  const [inputAmount, setInputAmount] = useState<string>('');
  const [inputDescription, setInputDescription] = useState<string>('');
  const [inputBuktiTransaksi, setInputBuktiTransaksi] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [selectedBuktiUrl, setSelectedBuktiUrl] = useState<string | null>(null);

  // State Google Sheets URL & Modal
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState<string>(() => {
    return localStorage.getItem('financial_dashboard_sheets_url') || '';
  });
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(() => {
    return localStorage.getItem('financial_dashboard_last_sync') || null;
  });

  // State UI
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reports' | 'monitoring'>('dashboard');
  const [selectedReportPeriod, setSelectedReportPeriod] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
  const [periodLimit, setPeriodLimit] = useState<number | 'all'>('all');
  const [copied, setCopied] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<string | null>(null);

  // State Kasir Kaos Polos (Inter-Divisi: Sablon -> Konveksi)
  const [isKasirModalOpen, setIsKasirModalOpen] = useState<boolean>(false);
  const [kasirDate, setKasirDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [kasirQty, setKasirQty] = useState<string>('0');
  const [kasirPrice, setKasirPrice] = useState<string>('35000');
  const [kasirDescription, setKasirDescription] = useState<string>('Kaos Polos Cotton Combed 30s');
  const [kasirBukti, setKasirBukti] = useState<string>('');
  const [kasirInvoiceNo, setKasirInvoiceNo] = useState<string>(`INV-KP-${Date.now().toString().slice(-6)}`);
  
  // State Ukuran, Tier Harga & Lengan Kaos Polos (Dewasa & Anak-Anak)
  const [kasirCategoryTab, setKasirCategoryTab] = useState<'dewasa' | 'anak'>('dewasa');
  const [kasirTierPrices, setKasirTierPrices] = useState({
    dewasaStandar: 35000,          // XS, S, M, L, XL (Pendek)
    dewasaJumbo: 40000,            // XXL, 3XL (Pendek)
    dewasaBigSize: 45000,          // Big Size: 4XL, 5XL, 6XL (Pendek)
    anak: 28000,                   // Anak-Anak (Pendek)
    lenganPanjangSurcharge: 5000,  // Tambahan Lengan Panjang per pcs
  });

  const [kasirSizes, setKasirSizes] = useState<{
    dewasa: Record<string, { pendek: number; panjang: number }>;
    anak: Record<string, { pendek: number; panjang: number }>;
  }>({
    dewasa: {
      'XS': { pendek: 0, panjang: 0 },
      'S': { pendek: 0, panjang: 0 },
      'M': { pendek: 0, panjang: 0 },
      'L': { pendek: 0, panjang: 0 },
      'XL': { pendek: 0, panjang: 0 },
      'XXL': { pendek: 0, panjang: 0 },
      '3XL': { pendek: 0, panjang: 0 },
      '4XL': { pendek: 0, panjang: 0 },
      '5XL': { pendek: 0, panjang: 0 },
      '6XL': { pendek: 0, panjang: 0 },
    },
    anak: {
      'Size 2 (XS)': { pendek: 0, panjang: 0 },
      'Size 4 (S)': { pendek: 0, panjang: 0 },
      'Size 6 (M)': { pendek: 0, panjang: 0 },
      'Size 8 (L)': { pendek: 0, panjang: 0 },
      'Size 10 (XL)': { pendek: 0, panjang: 0 },
      'Size 12 (XXL)': { pendek: 0, panjang: 0 },
    },
  });

  const [invoiceToPrint, setInvoiceToPrint] = useState<{
    invoiceNo: string;
    date: string;
    qty: number;
    price: number;
    total: number;
    description: string;
    bukti?: string;
    lineItems?: Array<{ label: string; qty: number; unitPrice: number; subtotal: number }>;
  } | null>(null);

  // Helper kalkulasi detail itemized harga & jumlah kaos
  const calculateKasirBreakdown = (
    sizes = kasirSizes,
    prices = kasirTierPrices
  ) => {
    let totalPcs = 0;
    let totalNominal = 0;
    const lineItems: Array<{ label: string; qty: number; unitPrice: number; subtotal: number }> = [];

    // 1. Dewasa
    Object.entries(sizes.dewasa).forEach(([sz, item]) => {
      const szUpper = sz.toUpperCase();
      const isBigSize = ['4XL', '5XL', '6XL', '7XL', '8XL'].includes(szUpper);
      const isJumbo = ['XXL', '3XL'].includes(szUpper);

      const basePrice = isBigSize
        ? prices.dewasaBigSize
        : isJumbo
        ? prices.dewasaJumbo
        : prices.dewasaStandar;

      if (item.pendek > 0) {
        const sub = item.pendek * basePrice;
        totalPcs += item.pendek;
        totalNominal += sub;
        lineItems.push({
          label: `Dewasa ${sz} (Lengan Pendek)`,
          qty: item.pendek,
          unitPrice: basePrice,
          subtotal: sub,
        });
      }

      if (item.panjang > 0) {
        const pPrice = basePrice + prices.lenganPanjangSurcharge;
        const sub = item.panjang * pPrice;
        totalPcs += item.panjang;
        totalNominal += sub;
        lineItems.push({
          label: `Dewasa ${sz} (Lengan Panjang)`,
          qty: item.panjang,
          unitPrice: pPrice,
          subtotal: sub,
        });
      }
    });

    // 2. Anak-Anak
    Object.entries(sizes.anak).forEach(([sz, item]) => {
      const basePrice = prices.anak;

      if (item.pendek > 0) {
        const sub = item.pendek * basePrice;
        totalPcs += item.pendek;
        totalNominal += sub;
        lineItems.push({
          label: `Anak ${sz} (Lengan Pendek)`,
          qty: item.pendek,
          unitPrice: basePrice,
          subtotal: sub,
        });
      }

      if (item.panjang > 0) {
        const pPrice = basePrice + prices.lenganPanjangSurcharge;
        const sub = item.panjang * pPrice;
        totalPcs += item.panjang;
        totalNominal += sub;
        lineItems.push({
          label: `Anak ${sz} (Lengan Panjang)`,
          qty: item.panjang,
          unitPrice: pPrice,
          subtotal: sub,
        });
      }
    });

    return { totalPcs, totalNominal, lineItems };
  };

  const handleResetKasirSizes = () => {
    const emptySizes = {
      dewasa: {
        'XS': { pendek: 0, panjang: 0 },
        'S': { pendek: 0, panjang: 0 },
        'M': { pendek: 0, panjang: 0 },
        'L': { pendek: 0, panjang: 0 },
        'XL': { pendek: 0, panjang: 0 },
        'XXL': { pendek: 0, panjang: 0 },
        '3XL': { pendek: 0, panjang: 0 },
        '4XL': { pendek: 0, panjang: 0 },
        '5XL': { pendek: 0, panjang: 0 },
        '6XL': { pendek: 0, panjang: 0 },
      },
      anak: {
        'Size 2 (XS)': { pendek: 0, panjang: 0 },
        'Size 4 (S)': { pendek: 0, panjang: 0 },
        'Size 6 (M)': { pendek: 0, panjang: 0 },
        'Size 8 (L)': { pendek: 0, panjang: 0 },
        'Size 10 (XL)': { pendek: 0, panjang: 0 },
        'Size 12 (XXL)': { pendek: 0, panjang: 0 },
      },
    };
    setKasirSizes(emptySizes);
    setKasirQty('0');
    setKasirPrice('35000');
    setKasirDescription('Kaos Polos Cotton Combed 30s');
  };

  const syncKasirStateWithSizesAndPrices = (
    updatedSizes = kasirSizes,
    updatedPrices = kasirTierPrices
  ) => {
    const breakdown = calculateKasirBreakdown(updatedSizes, updatedPrices);
    if (breakdown.totalPcs > 0) {
      setKasirQty(breakdown.totalPcs.toString());
      setKasirPrice(Math.round(breakdown.totalNominal / breakdown.totalPcs).toString());
      const descItems = breakdown.lineItems.map(i => `${i.label} x${i.qty}`).join('; ');
      setKasirDescription(`Kaos Polos Cotton Combed 30s (${descItems})`);
    }
  };

  const handleKasirTierPriceChange = (field: keyof typeof kasirTierPrices, value: number) => {
    const val = Math.max(0, isNaN(value) ? 0 : value);
    const updatedPrices = { ...kasirTierPrices, [field]: val };
    setKasirTierPrices(updatedPrices);
    syncKasirStateWithSizesAndPrices(kasirSizes, updatedPrices);
  };

  const handleKasirSizeChange = (
    cat: 'dewasa' | 'anak',
    sizeName: string,
    type: 'pendek' | 'panjang',
    val: number
  ) => {
    const nextVal = Math.max(0, isNaN(val) ? 0 : val);
    setKasirSizes(prev => {
      const updatedCat = {
        ...prev[cat],
        [sizeName]: {
          ...prev[cat][sizeName],
          [type]: nextVal,
        },
      };
      const updatedSizes = { ...prev, [cat]: updatedCat };
      syncKasirStateWithSizesAndPrices(updatedSizes, kasirTierPrices);
      return updatedSizes;
    });
  };

  // Helper Toast
  const triggerToast = (msg: string) => {
    setShowToast(msg);
    setTimeout(() => setShowToast(null), 3000);
  };

  // Handler Kasir Kaos Polos (Sablon Beli Kaos Polos ke Konveksi -> Auto Pemasukan Konveksi & Pengeluaran Sablon)
  const handleProcessKasirKaosPolos = async (e: React.FormEvent) => {
    e.preventDefault();
    const breakdown = calculateKasirBreakdown();
    const isItemized = breakdown.lineItems.length > 0;

    const qtyNum = isItemized ? breakdown.totalPcs : (parseInt(kasirQty, 10) || 0);
    const totalNominal = isItemized ? breakdown.totalNominal : (qtyNum * (parseFloat(kasirPrice) || 0));
    const priceNum = qtyNum > 0 ? Math.round(totalNominal / qtyNum) : 0;

    if (qtyNum <= 0 || priceNum <= 0 || totalNominal <= 0) {
      triggerToast('Pilih minimal 1 rincian ukuran kaos polos atau isi jumlah dan harga valid!');
      return;
    }

    const invNo = kasirInvoiceNo.trim() || `INV-KP-${Date.now().toString().slice(-6)}`;
    const detailNote = kasirDescription.trim() || 'Kaos Polos Cotton Combed 30s';
    const nowStamp = Date.now();

    // 1. Transaction Pemasukan Divisi Konveksi
    const txKonveksi: Transaction = {
      id: `tx-${nowStamp}-konveksi`,
      date: kasirDate,
      division: 'Konveksi',
      type: 'Pemasukan',
      amount: totalNominal,
      description: `[Invoice #${invNo}] Penjualan ${qtyNum} Pcs Kaos Polos ke Divisi Sablon (${detailNote})`,
    };
    if (kasirBukti) {
      txKonveksi.buktiTransaksi = kasirBukti;
    }

    // 2. Transaction Pengeluaran Divisi Sablon
    const txSablon: Transaction = {
      id: `tx-${nowStamp + 1}-sablon`,
      date: kasirDate,
      division: 'Sablon',
      type: 'Pengeluaran',
      amount: totalNominal,
      description: `[Invoice #${invNo}] Pembelian ${qtyNum} Pcs Kaos Polos dari Divisi Konveksi (${detailNote})`,
    };
    if (kasirBukti) {
      txSablon.buktiTransaksi = kasirBukti;
    }

    if (isLoggedIn) {
      try {
        await setDoc(doc(db, 'transactions', txKonveksi.id), txKonveksi);
        await setDoc(doc(db, 'transactions', txSablon.id), txSablon);
      } catch (err) {
        console.error('Gagal menyimpan transaksi kasir ke cloud:', err);
      }
    } else {
      setTransactions(prev => [txKonveksi, txSablon, ...prev]);
    }

    const invData = {
      invoiceNo: invNo,
      date: kasirDate,
      qty: qtyNum,
      price: priceNum,
      total: totalNominal,
      description: detailNote,
      bukti: kasirBukti || undefined,
      lineItems: breakdown.lineItems,
    };

    setInvoiceToPrint(invData);
    setIsKasirModalOpen(false);

    // Reset Form
    setKasirQty('0');
    setKasirPrice('35000');
    setKasirDescription('Kaos Polos Cotton Combed 30s');
    setKasirBukti('');
    handleResetKasirSizes();
    setKasirInvoiceNo(`INV-KP-${(nowStamp + 10).toString().slice(-6)}`);

    triggerToast(`🎉 [Invoice #${invNo}] Berhasil! Otomatis dicatat: Pemasukan Konveksi & Pengeluaran Sablon (${formatCurrency(totalNominal)})`);
  };

  // Handler Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput.trim() === 'admin' && passwordInput === 'password') {
      const adminUser = { name: 'Admin Mahya', email: 'admin@mahya.com' };
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.warn('Gagal login anonim Firebase, melanjutkan dengan mode lokal:', err);
      }
      localStorage.setItem('financial_dashboard_logged_in', 'true');
      localStorage.setItem('financial_dashboard_user', JSON.stringify(adminUser));
      setCurrentUser(adminUser);
      setIsLoggedIn(true);
      setLoginError('');
      triggerToast('Selamat Datang! Login berhasil.');
    } else {
      setLoginError('Username atau Password salah! (admin / password)');
    }
  };

  const handleInstantLogin = async () => {
    const adminUser = { name: 'Admin Mahya', email: 'admin@mahya.com' };
    try {
      await signInAnonymously(auth);
    } catch (err) {
      console.warn('Gagal login anonim Firebase, melanjutkan dengan mode lokal:', err);
    }
    localStorage.setItem('financial_dashboard_logged_in', 'true');
    localStorage.setItem('financial_dashboard_user', JSON.stringify(adminUser));
    setCurrentUser(adminUser);
    setIsLoggedIn(true);
    setLoginError('');
    triggerToast('Login Instan Berhasil!');
  };

  const handleLogout = () => {
    showConfirm(
      'Keluar dari Sistem',
      'Apakah Anda yakin ingin keluar dari Mahya Apparel Finance?',
      async () => {
        try {
          await signOut(auth);
        } catch (err) {
          console.error('Gagal keluar dari Firebase:', err);
        }
        localStorage.removeItem('financial_dashboard_logged_in');
        localStorage.removeItem('financial_dashboard_user');
        setIsLoggedIn(false);
        setCurrentUser(null);
        setUsernameInput('');
        setPasswordInput('');
        triggerToast('Berhasil logout dari sistem.');
      },
      true,
      'Ya, Keluar',
      'Batal'
    );
  };

  // Proses file bukti transaksi & kompresi ke Base64
  const handleFileProcess = (file: File) => {
    if (!file.type.startsWith('image/')) {
      triggerToast('Hanya dapat mengunggah file gambar (PNG/JPG/WEBP)!');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      triggerToast('Ukuran file gambar maksimal adalah 5MB!');
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.7);
          setInputBuktiTransaksi(compressed);
          triggerToast('Gambar bukti berhasil diproses & dikompresi!');
        } else {
          setInputBuktiTransaksi(event.target?.result as string);
          triggerToast('Gambar bukti berhasil dimuat!');
        }
      };
      img.onerror = () => {
        setInputBuktiTransaksi(event.target?.result as string);
        triggerToast('Gambar bukti berhasil dimuat!');
      };
    };
  };

  // Tambah / Edit Transaksi Baru
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const nominal = parseInt(inputAmount.replace(/\D/g, ''), 10);
    
    if (isNaN(nominal) || nominal <= 0) {
      triggerToast('Nominal transaksi harus lebih besar dari Rp 0!');
      return;
    }
    
    if (!inputDescription.trim()) {
      triggerToast('Keterangan / Catatan transaksi wajib diisi!');
      return;
    }

    if (editingTransactionId) {
      const originalTx = transactions.find(t => t.id === editingTransactionId);
      if (!originalTx) {
        triggerToast('Transaksi asli tidak ditemukan!');
        setEditingTransactionId(null);
        return;
      }

      const editedData: any = {
        date: inputDate,
        division: inputDivision,
        type: inputDivision === 'Alat' ? ('Pemasukan' as TransactionType) : inputType,
        amount: nominal,
        description: inputDescription.trim()
      };

      if (inputBuktiTransaksi) {
        editedData.buktiTransaksi = inputBuktiTransaksi;
      }

      if (isOwner) {
        if (isLoggedIn) {
          try {
            await setDoc(doc(db, 'transactions', editingTransactionId), {
              id: editingTransactionId,
              ...editedData
            });
            // Update request status to 'Disetujui' in Firestore if there is a matching request
            const matchingReq = approvalRequests.find(r => r.transactionId === editingTransactionId && r.status === 'Pending');
            if (matchingReq) {
              await setDoc(doc(db, 'approval_requests', matchingReq.id), { ...matchingReq, status: 'Disetujui' });
            }
          } catch (err) {
            console.error('Error updating transaction in firestore:', err);
          }
        } else {
          setTransactions(prev => prev.map(t => t.id === editingTransactionId ? { ...t, ...editedData } : t));
          setApprovalRequests(prev => prev.map(r => r.transactionId === editingTransactionId ? { ...r, status: 'Disetujui' } : r));
        }
        setEditingTransactionId(null);
        setInputAmount('');
        setInputDescription('');
        setInputBuktiTransaksi('');
        triggerToast('Berhasil mengubah transaksi!');
      } else {
        showConfirm(
          'Ajukan Perubahan Transaksi',
          `Mengubah transaksi "${originalTx.description}" senilai Rp ${originalTx.amount.toLocaleString('id-ID')} memerlukan persetujuan Owner. Ajukan perubahan ini ke Owner?`,
          async () => {
            const alreadyPending = approvalRequests.some(r => r.transactionId === editingTransactionId && r.status === 'Pending' && r.requestType === 'Edit');
            if (alreadyPending) {
              triggerToast('Perubahan transaksi ini sudah diajukan sebelumnya dan sedang menunggu persetujuan.');
              return;
            }

            const request: ApprovalRequest = {
              id: `req-${Date.now()}`,
              requestType: 'Edit',
              transactionId: editingTransactionId,
              transactionDesc: originalTx.description,
              transactionAmount: originalTx.amount,
              transactionDivision: originalTx.division,
              requestedBy: currentUser?.email || 'Admin',
              requestedAt: new Date().toLocaleString('id-ID'),
              status: 'Pending',
              newData: editedData
            };

            if (isLoggedIn) {
              try {
                await setDoc(doc(db, 'approval_requests', request.id), request);
              } catch (err) {
                console.error('Error creating approval request in firestore:', err);
              }
            } else {
              setApprovalRequests(prev => [request, ...prev]);
            }
            setEditingTransactionId(null);
            setInputAmount('');
            setInputDescription('');
            setInputBuktiTransaksi('');
            triggerToast('Pengajuan perubahan berhasil dikirim ke Owner untuk disetujui.');
          },
          false,
          'Ajukan',
          'Batal'
        );
      }
      return;
    }

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      date: inputDate,
      division: inputDivision,
      type: inputDivision === 'Alat' ? 'Pemasukan' : inputType,
      amount: nominal,
      description: inputDescription.trim(),
    };

    if (inputBuktiTransaksi) {
      newTx.buktiTransaksi = inputBuktiTransaksi;
    }

    if (isLoggedIn) {
      try {
        await setDoc(doc(db, 'transactions', newTx.id), newTx);
      } catch (err) {
        console.error('Error creating transaction in firestore:', err);
      }
    } else {
      setTransactions(prev => [newTx, ...prev]);
    }
    setInputAmount('');
    setInputDescription('');
    setInputBuktiTransaksi('');
    triggerToast(`Berhasil menyimpan transaksi ${newTx.type} ${newTx.division}!`);
  };

  // Mulai Edit Transaksi
  const handleStartEdit = (tx: Transaction) => {
    setEditingTransactionId(tx.id);
    setInputDate(tx.date);
    setInputDivision(tx.division);
    setInputType(tx.type);
    setInputAmount(tx.amount.toString());
    setInputDescription(tx.description);
    setInputBuktiTransaksi(tx.buktiTransaksi || '');
    
    // Smooth scroll ke panel input form
    const formCard = document.getElementById('transaction-form-card');
    if (formCard) {
      formCard.scrollIntoView({ behavior: 'smooth' });
    }
    triggerToast(`Mengedit transaksi "${tx.description}". Silakan sesuaikan data di form.`);
  };

  // Batalkan Edit Transaksi
  const handleCancelEdit = () => {
    setEditingTransactionId(null);
    setInputDate(new Date().toISOString().split('T')[0]);
    setInputDivision('Konveksi');
    setInputType('Pemasukan');
    setInputAmount('');
    setInputDescription('');
    setInputBuktiTransaksi('');
    triggerToast('Edit dibatalkan.');
  };

  // Hapus Transaksi
  const handleDeleteTransaction = (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    if (isOwner) {
      showConfirm(
        'Hapus Catatan Transaksi',
        'Apakah Anda yakin ingin menghapus catatan transaksi ini secara permanen?',
        async () => {
          if (isLoggedIn) {
            try {
              await deleteDoc(doc(db, 'transactions', id));
              // Also clean up any approval requests for this transaction
              const matchingReqs = approvalRequests.filter(r => r.transactionId === id);
              for (const req of matchingReqs) {
                await deleteDoc(doc(db, 'approval_requests', req.id));
              }
            } catch (err) {
              console.error('Error deleting transaction in firestore:', err);
            }
          } else {
            setTransactions(prev => prev.filter(t => t.id !== id));
            setApprovalRequests(prev => prev.filter(r => r.transactionId !== id));
          }
          triggerToast('Transaksi berhasil dihapus.');
        },
        true,
        'Hapus',
        'Batal'
      );
    } else {
      showConfirm(
        'Ajukan Penghapusan Transaksi',
        `Menghapus transaksi "${tx.description}" senilai Rp ${tx.amount.toLocaleString('id-ID')} memerlukan persetujuan Owner. Ajukan penghapusan ke Owner?`,
        async () => {
          const alreadyPending = approvalRequests.some(r => r.transactionId === id && r.status === 'Pending' && r.requestType === 'Hapus');
          if (alreadyPending) {
            triggerToast('Penghapusan transaksi ini sudah diajukan sebelumnya dan sedang menunggu persetujuan.');
            return;
          }

          const request: ApprovalRequest = {
            id: `req-${Date.now()}`,
            requestType: 'Hapus',
            transactionId: id,
            transactionDesc: tx.description,
            transactionAmount: tx.amount,
            transactionDivision: tx.division,
            requestedBy: currentUser?.email || 'Admin',
            requestedAt: new Date().toLocaleString('id-ID'),
            status: 'Pending'
          };

          if (isLoggedIn) {
            try {
              await setDoc(doc(db, 'approval_requests', request.id), request);
            } catch (err) {
              console.error('Error creating deletion request in firestore:', err);
            }
          } else {
            setApprovalRequests(prev => [request, ...prev]);
          }
          triggerToast('Pengajuan penghapusan berhasil dikirim ke Owner untuk disetujui.');
        },
        false,
        'Ajukan',
        'Batal'
      );
    }
  };

  // Setujui Pengajuan (Hapus atau Edit)
  const handleApproveRequest = (reqId: string, transactionId: string) => {
    const req = approvalRequests.find(r => r.id === reqId);
    if (!req) return;

    if (req.requestType === 'Hapus') {
      showConfirm(
        'Setujui Penghapusan',
        'Apakah Anda yakin ingin menyetujui pengajuan penghapusan transaksi ini? Transaksi akan langsung terhapus secara permanen.',
        async () => {
          if (isLoggedIn) {
            try {
              await deleteDoc(doc(db, 'transactions', transactionId));
              await setDoc(doc(db, 'approval_requests', reqId), { ...req, status: 'Disetujui' });
            } catch (err) {
              console.error('Error approving deletion in firestore:', err);
            }
          } else {
            setTransactions(prev => prev.filter(t => t.id !== transactionId));
            setApprovalRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'Disetujui' } : r));
          }
          triggerToast('Pengajuan penghapusan disetujui, transaksi telah dihapus.');
        },
        true,
        'Setujui & Hapus',
        'Batal'
      );
    } else if (req.requestType === 'Edit' && req.newData) {
      showConfirm(
        'Setujui Perubahan',
        'Apakah Anda yakin ingin menyetujui pengajuan perubahan transaksi ini? Data transaksi akan langsung diperbarui.',
        async () => {
          if (isLoggedIn) {
            try {
              await setDoc(doc(db, 'transactions', transactionId), {
                id: transactionId,
                ...req.newData!
              });
              await setDoc(doc(db, 'approval_requests', reqId), { ...req, status: 'Disetujui' });
            } catch (err) {
              console.error('Error approving edit in firestore:', err);
            }
          } else {
            setTransactions(prev => prev.map(t => t.id === transactionId ? { ...t, ...req.newData! } : t));
            setApprovalRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'Disetujui' } : r));
          }
          triggerToast('Pengajuan perubahan disetujui, transaksi telah diperbarui.');
        },
        true,
        'Setujui & Ubah',
        'Batal'
      );
    }
  };

  // Tolak Pengajuan
  const handleRejectRequest = (reqId: string) => {
    const req = approvalRequests.find(r => r.id === reqId);
    if (!req) return;

    showConfirm(
      'Tolak Pengajuan',
      'Apakah Anda yakin ingin menolak pengajuan ini?',
      async () => {
        if (isLoggedIn) {
          try {
            await setDoc(doc(db, 'approval_requests', reqId), { ...req, status: 'Ditolak' });
          } catch (err) {
            console.error('Error rejecting request in firestore:', err);
          }
        } else {
          setApprovalRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'Ditolak' } : r));
        }
        triggerToast('Pengajuan ditolak.');
      },
      false,
      'Tolak',
      'Batal'
    );
  };

  // Hapus Riwayat Pengajuan
  const handleRemoveRequestHistory = (reqId: string) => {
    showConfirm(
      'Hapus Riwayat Pengajuan',
      'Apakah Anda yakin ingin menghapus riwayat pengajuan ini?',
      async () => {
        if (isLoggedIn) {
          try {
            await deleteDoc(doc(db, 'approval_requests', reqId));
          } catch (err) {
            console.error('Error deleting request from firestore:', err);
          }
        } else {
          setApprovalRequests(prev => prev.filter(r => r.id !== reqId));
        }
        triggerToast('Riwayat pengajuan berhasil dihapus.');
      },
      false,
      'Hapus',
      'Batal'
    );
  };

  // Reset Semua Data ke Kosong
  const handleClearAll = () => {
    showConfirm(
      'Bersihkan Semua Data',
      'PENTING: Semua data transaksi akan dihapus dari cloud dan penyimpanan lokal secara permanen. Tindakan ini tidak dapat dibatalkan. Lanjutkan?',
      async () => {
        if (isLoggedIn) {
          try {
            for (const tx of transactions) {
              await deleteDoc(doc(db, 'transactions', tx.id));
            }
            for (const req of approvalRequests) {
              await deleteDoc(doc(db, 'approval_requests', req.id));
            }
          } catch (err) {
            console.error('Error clearing data in firestore:', err);
          }
        } else {
          setTransactions([]);
          setApprovalRequests([]);
        }
        triggerToast('Semua data berhasil dibersihkan.');
      },
      true,
      'Ya, Hapus Semua',
      'Batal'
    );
  };

  // Muat Ulang Data Contoh
  const handleLoadSamples = () => {
    showConfirm(
      'Muat Ulang Data Contoh',
      'Tindakan ini akan memuat kembali catatan contoh transaksi ke cloud/penyimpanan lokal. Lanjutkan?',
      async () => {
        if (isLoggedIn) {
          try {
            for (const tx of initialSampleTransactions) {
              await setDoc(doc(db, 'transactions', tx.id), tx);
            }
          } catch (err) {
            console.error('Error loading samples to firestore:', err);
          }
        } else {
          setTransactions(initialSampleTransactions);
        }
        triggerToast('Data contoh berhasil dimuat kembali!');
      },
      false,
      'Muat Contoh',
      'Batal'
    );
  };

  // Ubah Peran Pengguna (Hanya Owner)
  const handleChangeUserRole = async (email: string, newRole: 'Owner' | 'Admin') => {
    if (!isOwner) {
      triggerToast('Hanya Owner yang dapat mengubah peran pengguna.');
      return;
    }

    // Owner utama tidak boleh diturunkan perannya
    if (email.toLowerCase() === 'mahyaapparel@gmail.com' && newRole === 'Admin') {
      triggerToast('Owner utama tidak dapat diubah menjadi Admin.');
      return;
    }

    showConfirm(
      'Ubah Peran Pengguna',
      `Apakah Anda yakin ingin mengubah peran "${email}" menjadi ${newRole}?`,
      async () => {
        try {
          const userDocId = email.toLowerCase().replace(/\./g, '_');
          const userDocRef = doc(db, 'users', userDocId);
          await setDoc(userDocRef, { role: newRole }, { merge: true });
          triggerToast(`Peran ${email} berhasil diubah menjadi ${newRole}.`);
        } catch (err) {
          console.error('Error updating user role in Firestore:', err);
          triggerToast('Gagal mengubah peran pengguna.');
        }
      },
      false,
      'Ubah Peran',
      'Batal'
    );
  };

  // Helper Cepat Nominal Tambah
  const addNominalHelper = (value: number) => {
    const current = parseInt(inputAmount.replace(/\D/g, ''), 10) || 0;
    setInputAmount((current + value).toString());
  };

  // --- LOGIK PERHITUNGAN KEUANGAN ---
  const getTotalsByDivision = (div: Division) => {
    const divTxs = transactions.filter(t => t.division === div);
    const income = divTxs.filter(t => t.type === 'Pemasukan').reduce((sum, t) => sum + t.amount, 0);
    const expense = divTxs.filter(t => t.type === 'Pengeluaran').reduce((sum, t) => sum + t.amount, 0);
    const profit = income - expense;
    return { income, expense, profit };
  };

  const konveksiFin = getTotalsByDivision('Konveksi');
  const sablonFin = getTotalsByDivision('Sablon');
  const aksesoriFin = getTotalsByDivision('Aksesori');
  const alatFin = getTotalsByDivision('Alat');

  // Alat is purely transaction logs (not core sales/expenses of the operational divisions)
  const alatTransactions = transactions.filter(t => t.division === 'Alat');
  const alatCount = alatTransactions.length;
  const alatTotalValue = alatTransactions.reduce((sum, t) => sum + t.amount, 0);

  const totalIncome = konveksiFin.income + sablonFin.income + aksesoriFin.income;
  const totalExpense = konveksiFin.expense + sablonFin.expense + aksesoriFin.expense;
  const totalProfit = totalIncome - totalExpense;

  // Format Mata Uang Rupiah (Custom IDR)
  const formatCurrency = (val: number, showSymbol = true) => {
    const isNeg = val < 0;
    const absVal = Math.abs(val);
    const numStr = new Intl.NumberFormat('id-ID', {
      style: 'decimal',
    }).format(absVal);
    
    return `${isNeg ? '-' : ''}${showSymbol ? 'Rp ' : ''}${numStr}`;
  };

  // Format Rupiah Khusus untuk Kolom Tabel yang Kosong (agar bersih)
  const formatTableCell = (amount: number) => {
    if (amount === 0) return <span className="text-slate-300">-</span>;
    return <span className="font-mono text-slate-800 text-xs font-medium">{formatCurrency(amount)}</span>;
  };

  const formatTableProfitCell = (amount: number) => {
    if (amount === 0) return <span className="text-slate-300">-</span>;
    if (amount < 0) {
      return (
        <span className="font-mono text-rose-600 font-semibold text-xs">
          {formatCurrency(amount)}
        </span>
      );
    }
    return (
      <span className="font-mono text-indigo-600 font-bold text-xs">
        +{formatCurrency(amount)}
      </span>
    );
  };

  // Filter & Pencarian Transaksi
  const filteredTransactions = transactions.filter(tx => {
    return tx.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
           tx.division.toLowerCase().includes(searchQuery.toLowerCase()) ||
           tx.type.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // --- LOGIK LAPORAN BERKALA (BULANAN, 3 BULANAN, TAHUNAN) ---
  const MONTH_NAMES_ID = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  interface ReportRow {
    periodKey: string;
    periodLabel: string;
    konveksiIn: number;
    konveksiOut: number;
    konveksiProfit: number;
    sablonIn: number;
    sablonOut: number;
    sablonProfit: number;
    aksesoriIn: number;
    aksesoriOut: number;
    aksesoriProfit: number;
    alatValue: number;
    totalIn: number;
    totalOut: number;
    totalProfit: number;
  }

  const getMonthlyReports = (): ReportRow[] => {
    const groups: Record<string, Omit<ReportRow, 'periodKey' | 'periodLabel'>> = {};

    transactions.forEach(tx => {
      const parts = tx.date.split('-');
      if (parts.length < 2) return;
      const yearStr = parts[0];
      const monthStr = parts[1];
      const key = `${yearStr}-${monthStr}`;

      if (!groups[key]) {
        groups[key] = {
          konveksiIn: 0, konveksiOut: 0, konveksiProfit: 0,
          sablonIn: 0, sablonOut: 0, sablonProfit: 0,
          aksesoriIn: 0, aksesoriOut: 0, aksesoriProfit: 0,
          alatValue: 0,
          totalIn: 0, totalOut: 0, totalProfit: 0
        };
      }

      const g = groups[key];
      const amt = tx.amount;

      if (tx.division === 'Konveksi') {
        if (tx.type === 'Pemasukan') {
          g.konveksiIn += amt;
          g.konveksiProfit += amt;
          g.totalIn += amt;
          g.totalProfit += amt;
        } else {
          g.konveksiOut += amt;
          g.konveksiProfit -= amt;
          g.totalOut += amt;
          g.totalProfit -= amt;
        }
      } else if (tx.division === 'Sablon') {
        if (tx.type === 'Pemasukan') {
          g.sablonIn += amt;
          g.sablonProfit += amt;
          g.totalIn += amt;
          g.totalProfit += amt;
        } else {
          g.sablonOut += amt;
          g.sablonProfit -= amt;
          g.totalOut += amt;
          g.totalProfit -= amt;
        }
      } else if (tx.division === 'Aksesori') {
        if (tx.type === 'Pemasukan') {
          g.aksesoriIn += amt;
          g.aksesoriProfit += amt;
          g.totalIn += amt;
          g.totalProfit += amt;
        } else {
          g.aksesoriOut += amt;
          g.aksesoriProfit -= amt;
          g.totalOut += amt;
          g.totalProfit -= amt;
        }
      } else if (tx.division === 'Alat') {
        g.alatValue += amt;
      }
    });

    return Object.keys(groups)
      .sort()
      .map(key => {
        const [yearStr, monthStr] = key.split('-');
        const monthIdx = parseInt(monthStr, 10) - 1;
        const monthName = MONTH_NAMES_ID[monthIdx] || `Bulan ${monthStr}`;
        const periodLabel = `${monthName} ${yearStr}`;

        return {
          periodKey: key,
          periodLabel,
          ...groups[key]
        };
      });
  };

  const getQuarterlyReports = (): ReportRow[] => {
    const groups: Record<string, Omit<ReportRow, 'periodKey' | 'periodLabel'>> = {};

    transactions.forEach(tx => {
      const parts = tx.date.split('-');
      if (parts.length < 2) return;
      const yearStr = parts[0];
      const monthNum = parseInt(parts[1], 10);
      
      let qNum = 1;
      if (monthNum >= 4 && monthNum <= 6) {
        qNum = 2;
      } else if (monthNum >= 7 && monthNum <= 9) {
        qNum = 3;
      } else if (monthNum >= 10 && monthNum <= 12) {
        qNum = 4;
      }
      const key = `${yearStr}-Q${qNum}`;

      if (!groups[key]) {
        groups[key] = {
          konveksiIn: 0, konveksiOut: 0, konveksiProfit: 0,
          sablonIn: 0, sablonOut: 0, sablonProfit: 0,
          aksesoriIn: 0, aksesoriOut: 0, aksesoriProfit: 0,
          alatValue: 0,
          totalIn: 0, totalOut: 0, totalProfit: 0
        };
      }

      const g = groups[key];
      const amt = tx.amount;

      if (tx.division === 'Konveksi') {
        if (tx.type === 'Pemasukan') {
          g.konveksiIn += amt;
          g.konveksiProfit += amt;
          g.totalIn += amt;
          g.totalProfit += amt;
        } else {
          g.konveksiOut += amt;
          g.konveksiProfit -= amt;
          g.totalOut += amt;
          g.totalProfit -= amt;
        }
      } else if (tx.division === 'Sablon') {
        if (tx.type === 'Pemasukan') {
          g.sablonIn += amt;
          g.sablonProfit += amt;
          g.totalIn += amt;
          g.totalProfit += amt;
        } else {
          g.sablonOut += amt;
          g.sablonProfit -= amt;
          g.totalOut += amt;
          g.totalProfit -= amt;
        }
      } else if (tx.division === 'Aksesori') {
        if (tx.type === 'Pemasukan') {
          g.aksesoriIn += amt;
          g.aksesoriProfit += amt;
          g.totalIn += amt;
          g.totalProfit += amt;
        } else {
          g.aksesoriOut += amt;
          g.aksesoriProfit -= amt;
          g.totalOut += amt;
          g.totalProfit -= amt;
        }
      } else if (tx.division === 'Alat') {
        g.alatValue += amt;
      }
    });

    return Object.keys(groups)
      .sort()
      .map(key => {
        const [yearStr, qKey] = key.split('-');
        let qName = '';
        if (qKey === 'Q1') qName = 'Kuartal 1 (Jan-Mar)';
        else if (qKey === 'Q2') qName = 'Kuartal 2 (Apr-Jun)';
        else if (qKey === 'Q3') qName = 'Kuartal 3 (Jul-Sep)';
        else if (qKey === 'Q4') qName = 'Kuartal 4 (Okt-Des)';
        
        const periodLabel = `${qName} ${yearStr}`;

        return {
          periodKey: key,
          periodLabel,
          ...groups[key]
        };
      });
  };

  const getAnnualReports = (): ReportRow[] => {
    const groups: Record<string, Omit<ReportRow, 'periodKey' | 'periodLabel'>> = {};

    transactions.forEach(tx => {
      const parts = tx.date.split('-');
      if (parts.length < 1) return;
      const yearStr = parts[0];
      const key = yearStr;

      if (!groups[key]) {
        groups[key] = {
          konveksiIn: 0, konveksiOut: 0, konveksiProfit: 0,
          sablonIn: 0, sablonOut: 0, sablonProfit: 0,
          aksesoriIn: 0, aksesoriOut: 0, aksesoriProfit: 0,
          alatValue: 0,
          totalIn: 0, totalOut: 0, totalProfit: 0
        };
      }

      const g = groups[key];
      const amt = tx.amount;

      if (tx.division === 'Konveksi') {
        if (tx.type === 'Pemasukan') {
          g.konveksiIn += amt;
          g.konveksiProfit += amt;
          g.totalIn += amt;
          g.totalProfit += amt;
        } else {
          g.konveksiOut += amt;
          g.konveksiProfit -= amt;
          g.totalOut += amt;
          g.totalProfit -= amt;
        }
      } else if (tx.division === 'Sablon') {
        if (tx.type === 'Pemasukan') {
          g.sablonIn += amt;
          g.sablonProfit += amt;
          g.totalIn += amt;
          g.totalProfit += amt;
        } else {
          g.sablonOut += amt;
          g.sablonProfit -= amt;
          g.totalOut += amt;
          g.totalProfit -= amt;
        }
      } else if (tx.division === 'Aksesori') {
        if (tx.type === 'Pemasukan') {
          g.aksesoriIn += amt;
          g.aksesoriProfit += amt;
          g.totalIn += amt;
          g.totalProfit += amt;
        } else {
          g.aksesoriOut += amt;
          g.aksesoriProfit -= amt;
          g.totalOut += amt;
          g.totalProfit -= amt;
        }
      } else if (tx.division === 'Alat') {
        g.alatValue += amt;
      }
    });

    return Object.keys(groups)
      .sort()
      .map(key => {
        const periodLabel = `Tahun ${key}`;

        return {
          periodKey: key,
          periodLabel,
          ...groups[key]
        };
      });
  };

  const getActiveReportRows = (): ReportRow[] => {
    let rows: ReportRow[] = [];
    if (selectedReportPeriod === 'monthly') rows = getMonthlyReports();
    else if (selectedReportPeriod === 'quarterly') rows = getQuarterlyReports();
    else rows = getAnnualReports();

    if (typeof periodLimit === 'number' && periodLimit > 0) {
      return rows.slice(-periodLimit);
    }
    return rows;
  };

  // --- LOGIK EKSPOR EXCEL & GOOGLE SHEETS ---

  // Helper untuk membuat Worksheet Excel bertema Monitor Arus Kas dari sekelompok transaksi
  const buildTransactionWorksheet = (txList: Transaction[]) => {
    const uniqueDates = Array.from(new Set(txList.map(t => t.date as string)))
      .sort((a, b) => (b as string).localeCompare(a as string)) as string[]; // Newest first

    const aoa: any[][] = [];

    // Row 0: Category Headers
    aoa.push([
      'Tanggal',              // Col 0
      'Konveksi', '', '', '', // Col 1-4
      'Sablon', '', '', '',   // Col 5-8
      'Aksesori', '', '', '', // Col 9-12
      'Alat', ''              // Col 13-14
    ]);

    // Row 1: Sub-headers
    aoa.push([
      '',                     // Col 0 (merged with Row 0)
      'Keterangan', 'Masuk', 'Keluar', 'Laba', // Konveksi
      'Keterangan', 'Masuk', 'Keluar', 'Laba', // Sablon
      'Keterangan', 'Masuk', 'Keluar', 'Laba', // Aksesori
      'Keterangan', 'Transaksi'                // Alat
    ]);

    const merges: any[] = [];
    
    // Header merges:
    merges.push({ s: { r: 0, c: 0 }, e: { r: 1, c: 0 } });
    merges.push({ s: { r: 0, c: 1 }, e: { r: 0, c: 4 } });
    merges.push({ s: { r: 0, c: 5 }, e: { r: 0, c: 8 } });
    merges.push({ s: { r: 0, c: 9 }, e: { r: 0, c: 12 } });
    merges.push({ s: { r: 0, c: 13 }, e: { r: 0, c: 14 } });

    let currentRowIndex = 2;

    uniqueDates.forEach((date) => {
      const dateKonveksi = txList.filter(t => t.date === date && t.division === 'Konveksi');
      const dateSablon = txList.filter(t => t.date === date && t.division === 'Sablon');
      const dateAksesori = txList.filter(t => t.date === date && t.division === 'Aksesori');
      const dateAlat = txList.filter(t => t.date === date && t.division === 'Alat');

      const dateMaxRows = Math.max(
        dateKonveksi.length,
        dateSablon.length,
        dateAksesori.length,
        dateAlat.length
      );

      if (dateMaxRows === 0) return;

      if (dateMaxRows > 1) {
        merges.push({
          s: { r: currentRowIndex, c: 0 },
          e: { r: currentRowIndex + dateMaxRows - 1, c: 0 }
        });
      }

      for (let j = 0; j < dateMaxRows; j++) {
        const txK = dateKonveksi[j];
        const txS = dateSablon[j];
        const txA = dateAksesori[j];
        const txE = dateAlat[j];

        const row: any[] = [];
        row[0] = j === 0 ? date : '';

        // Konveksi
        if (txK) {
          row[1] = txK.description;
          row[2] = txK.type === 'Pemasukan' ? txK.amount : 0;
          row[3] = txK.type === 'Pengeluaran' ? txK.amount : 0;
          row[4] = txK.type === 'Pemasukan' ? txK.amount : -txK.amount;
        } else {
          row[1] = ''; row[2] = ''; row[3] = ''; row[4] = '';
        }

        // Sablon
        if (txS) {
          row[5] = txS.description;
          row[6] = txS.type === 'Pemasukan' ? txS.amount : 0;
          row[7] = txS.type === 'Pengeluaran' ? txS.amount : 0;
          row[8] = txS.type === 'Pemasukan' ? txS.amount : -txS.amount;
        } else {
          row[5] = ''; row[6] = ''; row[7] = ''; row[8] = '';
        }

        // Aksesori
        if (txA) {
          row[9] = txA.description;
          row[10] = txA.type === 'Pemasukan' ? txA.amount : 0;
          row[11] = txA.type === 'Pengeluaran' ? txA.amount : 0;
          row[12] = txA.type === 'Pemasukan' ? txA.amount : -txA.amount;
        } else {
          row[9] = ''; row[10] = ''; row[11] = ''; row[12] = '';
        }

        // Alat
        if (txE) {
          row[13] = txE.description;
          row[14] = txE.amount;
        } else {
          row[13] = ''; row[14] = '';
        }

        aoa.push(row);
      }

      currentRowIndex += dateMaxRows;
    });

    // Hitung total untuk footer
    const exportKonveksiTxs = txList.filter(t => t.division === 'Konveksi');
    const exportKonveksiIn = exportKonveksiTxs.filter(t => t.type === 'Pemasukan').reduce((sum, t) => sum + t.amount, 0);
    const exportKonveksiOut = exportKonveksiTxs.filter(t => t.type === 'Pengeluaran').reduce((sum, t) => sum + t.amount, 0);
    const exportKonveksiProfit = exportKonveksiIn - exportKonveksiOut;

    const exportSablonTxs = txList.filter(t => t.division === 'Sablon');
    const exportSablonIn = exportSablonTxs.filter(t => t.type === 'Pemasukan').reduce((sum, t) => sum + t.amount, 0);
    const exportSablonOut = exportSablonTxs.filter(t => t.type === 'Pengeluaran').reduce((sum, t) => sum + t.amount, 0);
    const exportSablonProfit = exportSablonIn - exportSablonOut;

    const exportAksesoriTxs = txList.filter(t => t.division === 'Aksesori');
    const exportAksesoriIn = exportAksesoriTxs.filter(t => t.type === 'Pemasukan').reduce((sum, t) => sum + t.amount, 0);
    const exportAksesoriOut = exportAksesoriTxs.filter(t => t.type === 'Pengeluaran').reduce((sum, t) => sum + t.amount, 0);
    const exportAksesoriProfit = exportAksesoriIn - exportAksesoriOut;

    const exportAlatTxs = txList.filter(t => t.division === 'Alat');
    const exportAlatTotalValue = exportAlatTxs.reduce((sum, t) => sum + t.amount, 0);

    const totalRow: any[] = [];
    totalRow[0] = 'TOTAL';
    totalRow[1] = '';
    totalRow[2] = exportKonveksiIn;
    totalRow[3] = exportKonveksiOut;
    totalRow[4] = exportKonveksiProfit;

    totalRow[5] = '';
    totalRow[6] = exportSablonIn;
    totalRow[7] = exportSablonOut;
    totalRow[8] = exportSablonProfit;

    totalRow[9] = '';
    totalRow[10] = exportAksesoriIn;
    totalRow[11] = exportAksesoriOut;
    totalRow[12] = exportAksesoriProfit;

    totalRow[13] = '';
    totalRow[14] = exportAlatTotalValue;

    aoa.push(totalRow);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;

    // Terapkan style cell
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:O2');
    
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef]) {
          ws[cellRef] = { t: 's', v: '' };
        }
        
        const cell = ws[cellRef];
        
        const cellStyle: any = {
          font: { name: 'Segoe UI', sz: 10, color: { rgb: '1E293B' } },
          alignment: { vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'E2E8F0' } },
            bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
            left: { style: 'thin', color: { rgb: 'E2E8F0' } },
            right: { style: 'thin', color: { rgb: 'E2E8F0' } }
          }
        };

        if (r === 0) {
          cellStyle.font = { name: 'Segoe UI', sz: 11, bold: true, color: { rgb: 'FFFFFF' } };
          cellStyle.alignment = { vertical: 'center', horizontal: 'center' };
          
          if (c === 0) {
            cellStyle.fill = { fgColor: { rgb: '1E293B' } }; // Tanggal
          } else if (c >= 1 && c <= 4) {
            cellStyle.fill = { fgColor: { rgb: '312E81' } }; // Konveksi
          } else if (c >= 5 && c <= 8) {
            cellStyle.fill = { fgColor: { rgb: '064E3B' } }; // Sablon
          } else if (c >= 9 && c <= 12) {
            cellStyle.fill = { fgColor: { rgb: '78350F' } }; // Aksesori
          } else if (c >= 13 && c <= 14) {
            cellStyle.fill = { fgColor: { rgb: '0C4A6E' } }; // Alat
          }
        }
        else if (r === 1) {
          cellStyle.font = { name: 'Segoe UI', sz: 9.5, bold: true };
          cellStyle.alignment = { vertical: 'center', horizontal: 'center' };
          
          if (c === 0) {
            cellStyle.fill = { fgColor: { rgb: '1E293B' } };
            cellStyle.font.color = { rgb: 'FFFFFF' };
          } else if (c >= 1 && c <= 4) {
            cellStyle.fill = { fgColor: { rgb: 'EEF2FF' } };
            cellStyle.font.color = { rgb: '312E81' };
          } else if (c >= 5 && c <= 8) {
            cellStyle.fill = { fgColor: { rgb: 'ECFDF5' } };
            cellStyle.font.color = { rgb: '064E3B' };
          } else if (c >= 9 && c <= 12) {
            cellStyle.fill = { fgColor: { rgb: 'FFFBEB' } };
            cellStyle.font.color = { rgb: '78350F' };
          } else if (c >= 13 && c <= 14) {
            cellStyle.fill = { fgColor: { rgb: 'F0F9FF' } };
            cellStyle.font.color = { rgb: '0C4A6E' };
          }
        }
        else if (r === range.e.r) {
          cellStyle.font = { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: 'FFFFFF' } };
          cellStyle.fill = { fgColor: { rgb: '1E293B' } };
          cellStyle.border = {
            top: { style: 'medium', color: { rgb: '0F172A' } },
            bottom: { style: 'medium', color: { rgb: '0F172A' } },
            left: { style: 'thin', color: { rgb: '475569' } },
            right: { style: 'thin', color: { rgb: '475569' } }
          };
          
          if (c === 0) {
            cellStyle.alignment = { vertical: 'center', horizontal: 'center' };
          } else if (c === 1 || c === 5 || c === 9 || c === 13) {
            cellStyle.alignment = { vertical: 'center', horizontal: 'left' };
          } else {
            cellStyle.alignment = { vertical: 'center', horizontal: 'right' };
            if (typeof cell.v === 'number') {
              cell.z = '#,##0';
            }
          }
        }
        else {
          const isOdd = (r % 2 === 1);
          cellStyle.fill = { fgColor: { rgb: isOdd ? 'F8FAFC' : 'FFFFFF' } };

          if (c === 0) {
            cellStyle.alignment = { vertical: 'center', horizontal: 'center' };
          } else if (c === 1 || c === 5 || c === 9 || c === 13) {
            cellStyle.alignment = { vertical: 'center', horizontal: 'left' };
          } else {
            cellStyle.alignment = { vertical: 'center', horizontal: 'right' };
            if (typeof cell.v === 'number') {
              cell.z = '#,##0';
              
              const isProfitCol = (c === 4 || c === 8 || c === 12);
              if (isProfitCol) {
                if (cell.v < 0) {
                  cellStyle.font.color = { rgb: 'DC2626' };
                  cellStyle.font.bold = true;
                } else if (cell.v > 0) {
                  cellStyle.font.color = { rgb: '16A34A' };
                  cellStyle.font.bold = true;
                }
              }
            }
          }
        }

        cell.s = cellStyle;
      }
    }

    const colWidths = [
      { wch: 14 },  // Tanggal
      { wch: 28 },  // Keterangan Konveksi
      { wch: 16 },  // Pemasukan Konveksi
      { wch: 16 },  // Pengeluaran Konveksi
      { wch: 16 },  // Laba Konveksi
      { wch: 28 },  // Keterangan Sablon
      { wch: 16 },  // Pemasukan Sablon
      { wch: 16 },  // Pengeluaran Sablon
      { wch: 16 },  // Laba Sablon
      { wch: 28 },  // Keterangan Aksesori
      { wch: 16 },  // Pemasukan Aksesori
      { wch: 16 },  // Pengeluaran Aksesori
      { wch: 16 },  // Laba Aksesori
      { wch: 28 },  // Keterangan Alat
      { wch: 16 }   // Transaksi Alat
    ];
    ws['!cols'] = colWidths;

    return ws;
  };

  // 1. Ekspor ke Excel asli (.xlsx) menggunakan SheetJS (dengan Sheet terpisah per Bulan)
  const exportToExcelXLSX = () => {
    if (filteredTransactions.length === 0) {
      triggerToast('Tidak ada data transaksi ditemukan untuk diekspor.');
      return;
    }

    const wb = XLSX.utils.book_new();

    // Kelompokkan transaksi berdasarkan bulan (YYYY-MM)
    const monthGroups: { [key: string]: Transaction[] } = {};
    filteredTransactions.forEach((tx) => {
      const mKey = tx.date && typeof tx.date === 'string' && tx.date.length >= 7 
        ? tx.date.substring(0, 7) 
        : 'Lainnya';
      if (!monthGroups[mKey]) {
        monthGroups[mKey] = [];
      }
      monthGroups[mKey].push(tx);
    });

    // Urutkan kunci bulan terbaru lebih dulu
    const sortedMonthKeys = Object.keys(monthGroups).sort((a, b) => b.localeCompare(a));
    const usedSheetNames = new Set<string>();

    // Buat Sheet per Bulan
    sortedMonthKeys.forEach((mKey) => {
      const monthTxs = monthGroups[mKey];
      let sheetTitle = 'Semua';
      if (mKey !== 'Lainnya') {
        const [yearStr, monthStr] = mKey.split('-');
        const monthIdx = parseInt(monthStr, 10) - 1;
        const monthName = MONTH_NAMES_ID[monthIdx] || monthStr;
        sheetTitle = `${monthName} ${yearStr}`;
      } else {
        sheetTitle = 'Lainnya';
      }

      // Pastikan nama sheet unik dan max 31 karakter
      let safeName = sheetTitle.replace(/[\/\\?\*:]/g, ' ').trim().substring(0, 31);
      let counter = 1;
      while (usedSheetNames.has(safeName)) {
        const suffix = ` (${counter})`;
        safeName = sheetTitle.substring(0, 31 - suffix.length) + suffix;
        counter++;
      }
      usedSheetNames.add(safeName);

      const ws = buildTransactionWorksheet(monthTxs);
      XLSX.utils.book_append_sheet(wb, ws, safeName);
    });

    // Tambahkan sheet gabungan "Semua Transaksi" jika terdapat lebih dari 1 bulan
    if (sortedMonthKeys.length > 1) {
      let allName = 'Semua Transaksi';
      if (usedSheetNames.has(allName)) {
        allName = 'Ringkasan Semua';
      }
      const allWs = buildTransactionWorksheet(filteredTransactions);
      XLSX.utils.book_append_sheet(wb, allWs, allName);
    }

    XLSX.writeFile(wb, `Laporan_Keuangan_Mahya_Apparel_${new Date().toISOString().split('T')[0]}.xlsx`);
    triggerToast(`Laporan Keuangan Excel (.xlsx) berhasil diunduh (${sortedMonthKeys.length} Sheet Bulanan)!`);
  };

  // Ekspor Laporan Berkala (Bulanan, 3 Bulanan, atau Tahunan) ke Excel asli (.xlsx)
  const exportPeriodicalReportXLSX = (type: 'monthly' | 'quarterly' | 'annual') => {
    let rawRows: ReportRow[] = [];
    let title = '';
    
    rawRows = getActiveReportRows();
    if (type === 'monthly') {
      title = 'Bulanan';
    } else if (type === 'quarterly') {
      title = '3 Bulanan';
    } else {
      title = 'Tahunan';
    }

    if (rawRows.length === 0) {
      triggerToast('Tidak ada data laporan untuk diekspor.');
      return;
    }

    const data = rawRows.map((row, idx) => ({
      'No': idx + 1,
      'Periode': row.periodLabel,
      'Konveksi (Masuk)': row.konveksiIn,
      'Konveksi (Keluar)': row.konveksiOut,
      'Konveksi (Laba)': row.konveksiProfit,
      'Sablon (Masuk)': row.sablonIn,
      'Sablon (Keluar)': row.sablonOut,
      'Sablon (Laba)': row.sablonProfit,
      'Aksesori (Masuk)': row.aksesoriIn,
      'Aksesori (Keluar)': row.aksesoriOut,
      'Aksesori (Laba)': row.aksesoriProfit,
      'Transaksi Alat': row.alatValue,
      'Total Masuk': row.totalIn,
      'Total Keluar': row.totalOut,
      'Total Laba': row.totalProfit
    }));

    const ws = XLSX.utils.json_to_sheet(data);

    // Set column widths
    const colWidths = [
      { wch: 6 },   // No
      { wch: 25 },  // Periode
      { wch: 18 },  // Konveksi (Masuk)
      { wch: 18 },  // Konveksi (Keluar)
      { wch: 18 },  // Konveksi (Laba)
      { wch: 18 },  // Sablon (Masuk)
      { wch: 18 },  // Sablon (Keluar)
      { wch: 18 },  // Sablon (Laba)
      { wch: 18 },  // Aksesori (Masuk)
      { wch: 18 },  // Aksesori (Keluar)
      { wch: 18 },  // Aksesori (Laba)
      { wch: 18 },  // Transaksi Alat
      { wch: 18 },  // Total Masuk
      { wch: 18 },  // Total Keluar
      { wch: 18 }   // Total Laba
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Laporan ${title}`);

    XLSX.writeFile(wb, `Laporan_${title}_Mahya_Apparel_${new Date().toISOString().split('T')[0]}.xlsx`);
    triggerToast(`Laporan ${title} Excel (.xlsx) berhasil diunduh dengan rapi!`);
  };

  // 2. Salin Data dalam format TSV (Tab Separated) untuk paste langsung ke Google Sheets
  const copyDataForGoogleSheets = () => {
    // We group by date just like the live table
    const uniqueDates = Array.from(new Set(filteredTransactions.map(t => t.date as string)))
      .sort((a, b) => (b as string).localeCompare(a as string)) as string[]; // Newest first

    if (uniqueDates.length === 0) {
      triggerToast('Tidak ada data transaksi ditemukan untuk disalin.');
      return;
    }

    const tsvLines: string[] = [];

    // Header 1: Division headings
    tsvLines.push([
      'Tanggal',
      'Konveksi', '', '', '',
      'Sablon', '', '', '',
      'Aksesori', '', '', '',
      'Alat', ''
    ].join('\t'));

    // Header 2: Sub headings
    tsvLines.push([
      '',
      'Keterangan', 'Masuk', 'Keluar', 'Laba',
      'Keterangan', 'Masuk', 'Keluar', 'Laba',
      'Keterangan', 'Masuk', 'Keluar', 'Laba',
      'Keterangan', 'Transaksi'
    ].join('\t'));

    uniqueDates.forEach((date) => {
      const dateKonveksi = filteredTransactions.filter(t => t.date === date && t.division === 'Konveksi');
      const dateSablon = filteredTransactions.filter(t => t.date === date && t.division === 'Sablon');
      const dateAksesori = filteredTransactions.filter(t => t.date === date && t.division === 'Aksesori');
      const dateAlat = filteredTransactions.filter(t => t.date === date && t.division === 'Alat');

      const dateMaxRows = Math.max(
        dateKonveksi.length,
        dateSablon.length,
        dateAksesori.length,
        dateAlat.length
      );

      for (let j = 0; j < dateMaxRows; j++) {
        const txK = dateKonveksi[j];
        const txS = dateSablon[j];
        const txA = dateAksesori[j];
        const txE = dateAlat[j];

        const row: string[] = [];
        
        // Col 0: Tanggal (only on the first row of this date group)
        row[0] = j === 0 ? date : '';

        // Konveksi
        if (txK) {
          row[1] = txK.description;
          row[2] = String(txK.type === 'Pemasukan' ? txK.amount : 0);
          row[3] = String(txK.type === 'Pengeluaran' ? txK.amount : 0);
          row[4] = String(txK.type === 'Pemasukan' ? txK.amount : -txK.amount);
        } else {
          row[1] = ''; row[2] = ''; row[3] = ''; row[4] = '';
        }

        // Sablon
        if (txS) {
          row[5] = txS.description;
          row[6] = String(txS.type === 'Pemasukan' ? txS.amount : 0);
          row[7] = String(txS.type === 'Pengeluaran' ? txS.amount : 0);
          row[8] = String(txS.type === 'Pemasukan' ? txS.amount : -txS.amount);
        } else {
          row[5] = ''; row[6] = ''; row[7] = ''; row[8] = '';
        }

        // Aksesori
        if (txA) {
          row[9] = txA.description;
          row[10] = String(txA.type === 'Pemasukan' ? txA.amount : 0);
          row[11] = String(txA.type === 'Pengeluaran' ? txA.amount : 0);
          row[12] = String(txA.type === 'Pemasukan' ? txA.amount : -txA.amount);
        } else {
          row[9] = ''; row[10] = ''; row[11] = ''; row[12] = '';
        }

        // Alat
        if (txE) {
          row[13] = txE.description;
          row[14] = String(txE.amount);
        } else {
          row[13] = ''; row[14] = '';
        }

        tsvLines.push(row.join('\t'));
      }
    });

    // Calculate totals for the footer
    const exportKonveksiTxs = filteredTransactions.filter(t => t.division === 'Konveksi');
    const exportKonveksiIn = exportKonveksiTxs.filter(t => t.type === 'Pemasukan').reduce((sum, t) => sum + t.amount, 0);
    const exportKonveksiOut = exportKonveksiTxs.filter(t => t.type === 'Pengeluaran').reduce((sum, t) => sum + t.amount, 0);
    const exportKonveksiProfit = exportKonveksiIn - exportKonveksiOut;

    const exportSablonTxs = filteredTransactions.filter(t => t.division === 'Sablon');
    const exportSablonIn = exportSablonTxs.filter(t => t.type === 'Pemasukan').reduce((sum, t) => sum + t.amount, 0);
    const exportSablonOut = exportSablonTxs.filter(t => t.type === 'Pengeluaran').reduce((sum, t) => sum + t.amount, 0);
    const exportSablonProfit = exportSablonIn - exportSablonOut;

    const exportAksesoriTxs = filteredTransactions.filter(t => t.division === 'Aksesori');
    const exportAksesoriIn = exportAksesoriTxs.filter(t => t.type === 'Pemasukan').reduce((sum, t) => sum + t.amount, 0);
    const exportAksesoriOut = exportAksesoriTxs.filter(t => t.type === 'Pengeluaran').reduce((sum, t) => sum + t.amount, 0);
    const exportAksesoriProfit = exportAksesoriIn - exportAksesoriOut;

    const exportAlatTxs = filteredTransactions.filter(t => t.division === 'Alat');
    const exportAlatTotalValue = exportAlatTxs.reduce((sum, t) => sum + t.amount, 0);

    const totalRow: string[] = [];
    totalRow[0] = 'TOTAL';
    totalRow[1] = '';
    totalRow[2] = String(exportKonveksiIn);
    totalRow[3] = String(exportKonveksiOut);
    totalRow[4] = String(exportKonveksiProfit);

    totalRow[5] = '';
    totalRow[6] = String(exportSablonIn);
    totalRow[7] = String(exportSablonOut);
    totalRow[8] = String(exportSablonProfit);

    totalRow[9] = '';
    totalRow[10] = String(exportAksesoriIn);
    totalRow[11] = String(exportAksesoriOut);
    totalRow[12] = String(exportAksesoriProfit);

    totalRow[13] = '';
    totalRow[14] = String(exportAlatTotalValue);

    tsvLines.push(totalRow.join('\t'));

    navigator.clipboard.writeText(tsvLines.join('\n'));
    triggerToast('Data disalin dengan tata letak Monitor Arus! Buka Google Sheets & tekan Ctrl+V (Cmd+V) di sel pertama.');
  };

  // 3. Simpan URL Google Sheets ke LocalStorage
  const handleSaveSheetsUrl = (url: string) => {
    setGoogleSheetsUrl(url);
    localStorage.setItem('financial_dashboard_sheets_url', url);
    triggerToast('Link Google Sheets berhasil disimpan!');
  };

  // 4. Sinkronisasi Data Online (Simulasi Interaktif Google Sheets Cloud Sync)
  const handleSyncWithGoogleSheets = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSyncedTime(nowStr);
      localStorage.setItem('financial_dashboard_last_sync', nowStr);
      triggerToast('Sinkronisasi Berhasil! Semua data terkirim ke Google Sheets cloud.');
    }, 1800);
  };

  // Source code python Streamlit
  const pythonStreamlitCode = `import streamlit as st
import pandas as pd
from datetime import datetime

# Konfigurasi halaman Streamlit
st.set_page_config(page_title="Mahya Finance", layout="wide", page_icon="💰")

# --- FITUR LOGIN ---
if "logged_in" not in st.session_state:
    st.session_state["logged_in"] = False

if not st.session_state["logged_in"]:
    st.title("🔑 Login Mahya Finance")
    st.markdown("Masukkan kredensial Anda untuk mengakses sistem keuangan.")
    
    with st.form("login_form"):
        username = st.text_input("Username", value="admin")
        password = st.text_input("Password", type="password", value="password")
        submitted = st.form_submit_button("Masuk 🚀")
        
        if submitted:
            if username == "admin" and password == "password":
                st.session_state["logged_in"] = True
                st.success("Login Berhasil!")
                st.rerun()
            else:
                st.error("Username atau password salah! (Gunakan: admin / password)")
    st.stop()

# --- HEADER SETELAH LOGIN ---
st.sidebar.markdown(f"👤 **Pengguna:** Admin")
if st.sidebar.button("Logout 🚪"):
    st.session_state["logged_in"] = False
    st.rerun()

st.title("💰 Mahya Finance")
st.markdown("Aplikasi pencatatan keuangan sederhana untuk divisi **Konveksi**, **Sablon**, **Aksesori**, dan log transaksi **Alat**.")
st.markdown("---")

# Inisialisasi session state untuk menyimpan data transaksi secara persisten dalam sesi
if "transactions" not in st.session_state:
    st.session_state["transactions"] = [
        # Data sampel awal untuk ilustrasi langsung
        {"Tanggal": "2026-06-28", "Divisi": "Konveksi", "Jenis": "Pemasukan", "Nominal": 1500000, "Keterangan": "Uang muka pesanan 100 pcs kaos polos"},
        {"Tanggal": "2026-06-29", "Divisi": "Konveksi", "Jenis": "Pengeluaran", "Nominal": 600000, "Keterangan": "Pembelian bahan kain cotton combed 30s"},
        {"Tanggal": "2026-06-29", "Divisi": "Sablon", "Jenis": "Pemasukan", "Nominal": 800000, "Keterangan": "Pelunasan sablon jaket kelas XII IPA"},
        {"Tanggal": "2026-06-30", "Divisi": "Aksesori", "Jenis": "Pemasukan", "Nominal": 350000, "Keterangan": "Penjualan gantungan kunci & stiker merchandise"},
        {"Tanggal": "2026-06-30", "Divisi": "Sablon", "Jenis": "Pengeluaran", "Nominal": 200000, "Keterangan": "Pembelian tinta plastisol hitam & emulsi sablon"},
    ]

# Membuat layout kolom: Sidebar untuk form input, Main Panel untuk ringkasan dan tabel
with st.sidebar:
    st.header("✍️ Input Transaksi Baru")
    st.info("Silakan masukkan detail transaksi baru di bawah ini:")
    
    with st.form("transaction_form", clear_on_submit=True):
        tanggal = st.date_input("Pilih Tanggal", value=datetime.today())
        divisi = st.selectbox("Pilih Divisi", ["Konveksi", "Sablon", "Aksesori", "Alat"])
        
        # Alat does not have sales or expenses, only transaction logs
        if divisi == "Alat":
            jenis = "Pemasukan" # set as Pemasukan internally
            st.info("Pencatatan Transaksi Alat (Aset & Log)")
        else:
            jenis = st.selectbox("Jenis Transaksi", ["Pemasukan", "Pengeluaran"])
            
        nominal = st.number_input("Nominal (Rp)", min_value=0, step=1000, format="%d")
        keterangan = st.text_input("Keterangan / Catatan")
        
        submitted = st.form_submit_button("Simpan Transaksi 💾")
        if submitted:
            if nominal <= 0:
                st.error("Gagal! Nominal harus lebih besar dari Rp 0.")
            elif not keterangan.strip():
                st.error("Gagal! Keterangan/Catatan wajib diisi.")
            else:
                new_tx = {
                    "Tanggal": tanggal.strftime("%Y-%m-%d"),
                    "Divisi": divisi,
                    "Jenis": jenis,
                    "Nominal": int(nominal),
                    "Keterangan": keterangan.strip()
                }
                st.session_state["transactions"].append(new_tx)
                st.success(f"Berhasil! Transaksi {divisi} sebesar Rp {int(nominal):,} disimpan.")
                st.rerun()

# --- BAGIAN PERHITUNGAN KEUANGAN (REAL-TIME METRIC) ---
def hitung_keuangan(divisi_nama):
    pemasukan = sum(tx["Nominal"] for tx in st.session_state["transactions"] if tx["Divisi"] == divisi_nama and tx["Jenis"] == "Pemasukan")
    pengeluaran = sum(tx["Nominal"] for tx in st.session_state["transactions"] if tx["Divisi"] == divisi_nama and tx["Jenis"] == "Pengeluaran")
    laba = pemasukan - pengeluaran
    return pemasukan, pengeluaran, laba

pem_konveksi, peng_konveksi, laba_konveksi = hitung_keuangan("Konveksi")
pem_sablon, peng_sablon, laba_sablon = hitung_keuangan("Sablon")
pem_aksesori, peng_aksesori, laba_aksesori = hitung_keuangan("Aksesori")

# Alat is purely logged separately without core revenue calculations
alat_transactions = [tx for tx in st.session_state["transactions"] if tx["Divisi"] == "Alat"]
alat_count = len(alat_transactions)
total_alat_value = sum(tx["Nominal"] for tx in alat_transactions)

total_pemasukan = pem_konveksi + pem_sablon + pem_aksesori
total_pengeluaran = peng_konveksi + peng_sablon + peng_aksesori
total_laba = laba_konveksi + laba_sablon + laba_aksesori

# --- TAMPILAN METRIC CARDS ---
st.subheader("📊 Ringkasan Laba Bersih per Divisi (Real-Time)")
col1, col2, col3, col4, col5 = st.columns(5)

# Format rupiah custom untuk Streamlit
def fmt_rp(val):
    return f"Rp {val:,.0f}".replace(",", ".")

with col1:
    st.metric(
        label="Laba Konveksi", 
        value=fmt_rp(laba_konveksi), 
        delta=f"Masuk: {fmt_rp(pem_konveksi)} | Keluar: {fmt_rp(peng_konveksi)}",
        delta_color="normal"
    )

with col2:
    st.metric(
        label="Laba Sablon", 
        value=fmt_rp(laba_sablon), 
        delta=f"Masuk: {fmt_rp(pem_sablon)} | Keluar: {fmt_rp(peng_sablon)}",
        delta_color="normal"
    )

with col3:
    st.metric(
        label="Laba Aksesori", 
        value=fmt_rp(laba_aksesori), 
        delta=f"Masuk: {fmt_rp(pem_aksesori)} | Keluar: {fmt_rp(peng_aksesori)}",
        delta_color="normal"
    )

with col4:
    st.metric(
        label="Transaksi Divisi Alat", 
        value=fmt_rp(total_alat_value), 
        delta=f"{alat_count} Transaksi Log",
        delta_color="off"
    )

with col5:
    st.metric(
        label="Total Laba Konsolidasi (3 Divisi)", 
        value=fmt_rp(total_laba), 
        delta=f"Total Masuk: {fmt_rp(total_pemasukan)}",
        delta_color="off"
    )

st.markdown("---")

# --- TABEL DATA TRANSAKSI PEMISAHAN KOLOM ---
st.subheader("📋 Tabel Rincian Keuangan per Divisi")
st.markdown("Semua transaksi dipisahkan ke dalam kolom masing-masing divisi secara otomatis.")

table_rows = []
for index, tx in enumerate(st.session_state["transactions"]):
    div = tx["Divisi"]
    jenis = tx["Jenis"]
    nom = tx["Nominal"]
    
    row = {
        "No": index + 1,
        "Tanggal": tx["Tanggal"],
        "Keterangan/Catatan": tx["Keterangan"],
        "Pemasukan Konveksi": 0,
        "Pengeluaran Konveksi": 0,
        "Laba Konveksi": 0,
        "Pemasukan Sablon": 0,
        "Pengeluaran Sablon": 0,
        "Laba Sablon": 0,
        "Pemasukan Aksesori": 0,
        "Pengeluaran Aksesori": 0,
        "Laba Aksesori": 0,
        "Transaksi Alat": 0,
    }
    
    if div == "Konveksi":
        if jenis == "Pemasukan":
            row["Pemasukan Konveksi"] = nom
            row["Laba Konveksi"] = nom
        else:
            row["Pengeluaran Konveksi"] = nom
            row["Laba Konveksi"] = -nom
    elif div == "Sablon":
        if jenis == "Pemasukan":
            row["Pemasukan Sablon"] = nom
            row["Laba Sablon"] = nom
        else:
            row["Pengeluaran Sablon"] = nom
            row["Laba Sablon"] = -nom
    elif div == "Aksesori":
        if jenis == "Pemasukan":
            row["Pemasukan Aksesori"] = nom
            row["Laba Aksesori"] = nom
        else:
            row["Pengeluaran Aksesori"] = nom
            row["Laba Aksesori"] = -nom
    elif div == "Alat":
        row["Transaksi Alat"] = nom
            
    table_rows.append(row)

if len(table_rows) > 0:
    df = pd.DataFrame(table_rows)
    df = df.set_index("No")
    
    # --- FITUR EXPORT / DOWNLOAD DATA ---
    st.sidebar.subheader("📥 Ekspor Data Keuangan")
    csv = df.to_csv(sep=";").encode("utf-8")
    st.sidebar.download_button(
        label="Unduh Laporan Excel (.csv) 📊",
        data=csv,
        file_name=f"Laporan_Keuangan_Divisi_{datetime.today().strftime('%Y-%m-%d')}.csv",
        mime="text/csv",
    )
    
    formatted_df = df.style.format({
        "Pemasukan Konveksi": lambda x: fmt_rp(x) if x != 0 else "-",
        "Pengeluaran Konveksi": lambda x: fmt_rp(x) if x != 0 else "-",
        "Laba Konveksi": lambda x: fmt_rp(x) if x != 0 else "-",
        "Pemasukan Sablon": lambda x: fmt_rp(x) if x != 0 else "-",
        "Pengeluaran Sablon": lambda x: fmt_rp(x) if x != 0 else "-",
        "Laba Sablon": lambda x: fmt_rp(x) if x != 0 else "-",
        "Pemasukan Aksesori": lambda x: fmt_rp(x) if x != 0 else "-",
        "Pengeluaran Aksesori": lambda x: fmt_rp(x) if x != 0 else "-",
        "Laba Aksesori": lambda x: fmt_rp(x) if x != 0 else "-",
        "Transaksi Alat": lambda x: fmt_rp(x) if x != 0 else "-",
    })
    st.dataframe(formatted_df, use_container_width=True)
else:
    st.info("Belum ada data transaksi. Masukkan transaksi baru lewat panel kiri untuk memulai!")
`;

  // Handle Salin Kode
  const handleCopyCode = () => {
    navigator.clipboard.writeText(pythonStreamlitCode);
    setCopied(true);
    triggerToast('Kode program Streamlit berhasil disalin ke clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  // RENDER LOGIN SCREEN JIKA BELUM LOGIN
  if (!isLoggedIn) {
    return (
      <div id="login-screen-container" className="min-h-screen bg-slate-100 font-sans text-slate-900 flex items-center justify-center p-4">
        
        {/* Toast Notification di Login */}
        <AnimatePresence>
          {showToast && (
            <motion.div 
              initial={{ opacity: 0, y: -50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -50, scale: 0.9 }}
              className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-lg flex items-center space-x-2 border border-slate-800 text-sm font-medium"
            >
              <Sparkles className="h-4 w-4 text-emerald-400 animate-pulse" />
              <span>{showToast}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div 
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden p-6 md:p-8 flex flex-col gap-6"
        >
          {/* Logo & Header */}
          <div className="flex flex-col items-center text-center gap-3">
            <div className="bg-indigo-600 p-3.5 rounded-2xl shadow-md text-white">
              <Lock className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-950 tracking-tight">Mahya Apparel Finance</h1>
              <p className="text-xs text-slate-500 font-medium mt-1">Multi-Division Business Core (Konveksi, Sablon, Aksesori)</p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 text-xs text-slate-800 flex flex-col gap-2.5">
            <div className="flex items-start gap-2 text-indigo-700">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="font-bold">Panduan Akses Role:</p>
            </div>
            
            <div className="space-y-2 text-[11px] leading-relaxed">
              <div className="bg-amber-50/70 border border-amber-200/40 p-2.5 rounded-xl">
                <span className="font-black text-amber-900 block mb-0.5">👑 PEMILIK (OWNER):</span>
                <p className="text-amber-800">Masuk menggunakan tombol <strong className="font-semibold">Masuk dengan Google</strong> dengan akun email <span className="font-mono bg-white border border-amber-200/80 px-1 py-0.2 rounded font-bold">mahyaapparel@gmail.com</span>.</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-[10px] text-amber-700">
                  <li>Menyetujui / Menolak pengajuan hapus data</li>
                  <li>Akses penuh manajemen & reset sistem</li>
                </ul>
              </div>

              <div className="bg-indigo-50/40 border border-indigo-200/20 p-2.5 rounded-xl">
                <span className="font-black text-indigo-900 block mb-0.5">🛠️ ADMIN MAHYA:</span>
                <p className="text-indigo-800">Gunakan Username: <strong className="font-mono bg-white border border-indigo-200/50 px-1 rounded">admin</strong> & Password: <strong className="font-mono bg-white border border-indigo-200/50 px-1 rounded">password</strong>, tombol <strong className="font-semibold">Masuk Instan</strong>, atau <strong className="font-semibold">Masuk Google</strong> dengan email lain.</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-[10px] text-indigo-700">
                  <li>Hanya diperbolehkan menambahkan data transaksi</li>
                  <li>Hapus data wajib mengajukan persetujuan Owner</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Form Login */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {loginError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold p-3 rounded-xl text-center">
                {loginError}
              </div>
            )}
            
            {/* Username */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 block">Username</label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <User className="h-4 w-4" />
                </span>
                <input 
                  type="text"
                  required
                  placeholder="Masukkan username..."
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs font-semibold focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 block">Password</label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="h-4 w-4" />
                </span>
                <input 
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Masukkan password..."
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-10 py-2.5 text-xs font-semibold focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Tombol Aksi */}
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="submit"
                className="w-full bg-slate-950 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl shadow-md text-xs tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Unlock className="h-4 w-4 text-emerald-400 animate-pulse" />
                <span>MASUK KE SISTEM</span>
              </button>

              <button
                type="button"
                onClick={handleInstantLogin}
                className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-2 px-4 rounded-xl text-xs tracking-wider transition-all border border-indigo-200/50 cursor-pointer"
              >
                ⚡ MASUK INSTAN CEPAT
              </button>

              <div className="relative flex items-center justify-center my-1.5">
                <div className="border-t border-slate-200 w-full"></div>
                <span className="bg-white px-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider absolute">atau</span>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold py-2.5 px-4 rounded-xl text-xs tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Chrome className="h-4 w-4 text-rose-500" />
                <span>MASUK DENGAN GOOGLE</span>
              </button>
            </div>
          </form>

          <p className="text-[10px] text-center text-slate-400 font-semibold uppercase tracking-wider mt-2">
            Secure Ledger Access Control v1.1
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div id="financial-dashboard-app" className="min-h-screen bg-slate-100 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 p-6 flex flex-col gap-4 relative">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-lg flex items-center space-x-2 border border-slate-800 text-sm font-medium"
          >
            <Sparkles className="h-4 w-4 text-emerald-400 animate-pulse" />
            <span>{showToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL EKSPOR GOOGLE SHEETS & EXCEL */}
      <AnimatePresence>
        {isExportModalOpen && (
          <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs z-40 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              className="max-w-lg w-full bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 flex flex-col gap-5 overflow-hidden relative"
            >
              {/* Header Modal */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Ekspor Data Keuangan</h2>
                    <p className="text-[10px] text-slate-400 font-medium">Download Excel atau Hubungkan ke Google Sheets</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsExportModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-xs bg-slate-100 p-1.5 px-2.5 rounded-lg cursor-pointer"
                >
                  Tutup
                </button>
              </div>

              {/* Konten Utama Ekspor */}
              <div className="space-y-4">
                
                {/* 1. Opsi Download Excel */}
                <div className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-2xl p-4 transition-all flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">1. Unduh Berkas Excel (.xlsx) Asli</h3>
                      <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">Mengunduh berkas Excel (.xlsx) asli secara langsung dengan sheet terpisah untuk setiap bulan, format rapi, lebar kolom otomatis, dan angka yang siap dihitung.</p>
                    </div>
                    <button
                      onClick={exportToExcelXLSX}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer transition-all"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Unduh Excel</span>
                    </button>
                  </div>
                </div>

                {/* 2. Opsi Salin Tabular untuk Google Sheets */}
                <div className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-2xl p-4 transition-all flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">2. Salin Instan ke Google Sheets</h3>
                      <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">Salin seluruh data dalam format khusus (TSV Tab-Separated). Buka spreadsheet kosong Anda di Google Sheets, lalu cukup lakukan Paste (<kbd className="bg-white px-1 py-0.5 border border-slate-200 rounded text-[9px] font-mono font-bold">Ctrl+V</kbd>).</p>
                    </div>
                    <button
                      onClick={copyDataForGoogleSheets}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer transition-all"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>Salin Tabel</span>
                    </button>
                  </div>
                </div>

                {/* 3. Opsi Integrasi Tautan Online Sheets */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3.5">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">3. Tautan Online Google Sheets Anda</h3>
                    <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">Simpan tautan spreadsheet kerja Anda di sini untuk akses instan langsung dari dashboard ledger ini.</p>
                  </div>

                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="Tempel link Google Sheet Anda di sini..."
                      value={googleSheetsUrl}
                      onChange={(e) => handleSaveSheetsUrl(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[11px] font-medium focus:outline-hidden text-slate-700"
                    />
                    {googleSheetsUrl && (
                      <a 
                        href={googleSheetsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shrink-0"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>Buka</span>
                      </a>
                    )}
                  </div>

                  {/* Cloud Sync Simulator */}
                  <div className="pt-2 border-t border-slate-150 flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-[10px] text-slate-500 font-bold">
                      {lastSyncedTime ? (
                        <span className="text-emerald-600">✓ Sinkronisasi Terakhir: {lastSyncedTime}</span>
                      ) : (
                        <span className="text-slate-400">Belum pernah disinkronkan secara online</span>
                      )}
                    </div>
                    
                    <button
                      disabled={isSyncing}
                      onClick={handleSyncWithGoogleSheets}
                      className="bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin text-indigo-600' : ''}`} />
                      <span>{isSyncing ? 'Menghubungkan...' : 'Sinkronisasi Cloud (Simulasi)'}</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Status info modal */}
              <div className="text-[10px] text-slate-400 bg-slate-50 p-2.5 rounded-xl border border-dashed border-slate-200 flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Tip Format:</strong> Microsoft Excel menggunakan separator lokal. Jika data Anda tidak langsung terbagi kolom otomatis di Excel, buka Excel, pilih menu <strong>Data → Dari Teks/CSV</strong>, lalu gunakan separator Semicolon (;).
                </span>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CUSTOM CONFIRMATION DIALOG MODAL */}
      <AnimatePresence>
        {confirmDialog.isOpen && (
          <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 flex flex-col gap-4 overflow-hidden relative"
            >
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl ${confirmDialog.isDanger ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'}`}>
                  <AlertTriangle className="h-5 w-5 animate-bounce" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">{confirmDialog.title}</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1.5">{confirmDialog.message}</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all cursor-pointer"
                >
                  {confirmDialog.cancelText || 'Batal'}
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-xs ${
                    confirmDialog.isDanger 
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-100' 
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
                  }`}
                >
                  {confirmDialog.confirmText || 'Ya, Lanjutkan'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header Bento Grid Section */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border border-slate-200 rounded-2xl p-5 shadow-xs mb-1">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2.5 rounded-xl shadow-xs text-white">
            <Calculator className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-950 tracking-tight">Mahya Apparel Finance</h1>
            <p className="text-xs text-slate-500 font-medium">Sistem Manajemen Keuangan Multi-Divisi (Konveksi, Sablon, Aksesori, Alat)</p>
          </div>
        </div>
        
        {/* Info Pengguna & Logout */}
        <div className="mt-3 md:mt-0 flex flex-col md:items-end gap-1 w-full md:w-auto">
          <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200 font-bold">
              {currentUser?.picture ? (
                <img src={currentUser.picture} referrerPolicy="no-referrer" alt={currentUser.name} className="h-5 w-5 rounded-full" />
              ) : (
                <User className="h-3.5 w-3.5 text-slate-600" />
              )}
              <span>{currentUser?.name || 'Admin Mahya'}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ml-1 font-extrabold uppercase tracking-wider ${
                isOwner 
                  ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                  : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
              }`}>
                {isOwner ? '👑 Owner' : '🛠️ Admin'}
              </span>
            </div>
            
            <button
              onClick={handleLogout}
              className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shrink-0"
              title="Logout dari Sistem"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 self-start md:self-auto mt-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 absolute"></span>
            <span className="text-[11px] text-emerald-600 font-bold tracking-wide uppercase">Sesi Aktif • Kunci Terbuka</span>
          </div>
        </div>
      </header>

      {/* Tabs Menu in Header Bento */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2 shadow-xs flex items-center justify-between gap-4">
        <div className="flex gap-1.5">
          <button
            id="tab-dashboard-btn"
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center space-x-2 cursor-pointer ${
              activeTab === 'dashboard' 
                ? 'bg-slate-950 text-white shadow-xs' 
                : 'bg-transparent text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Interactive Live Ledger</span>
          </button>

          <button
            id="tab-reports-btn"
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center space-x-2 cursor-pointer ${
              activeTab === 'reports' 
                ? 'bg-emerald-600 text-white shadow-xs' 
                : 'bg-transparent text-slate-600 hover:bg-slate-50'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Laporan Berkala</span>
          </button>

          {isOwner && (
            <button
              id="tab-monitoring-btn"
              onClick={() => setActiveTab('monitoring')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center space-x-2 cursor-pointer ${
                activeTab === 'monitoring' 
                  ? 'bg-violet-600 text-white shadow-xs' 
                  : 'bg-transparent text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Monitoring & Akses</span>
            </button>
          )}
        </div>

        {activeTab === 'dashboard' && isOwner && (
          <div className="flex items-center gap-1.5 pr-2">
            <button
              onClick={handleLoadSamples}
              title="Reset ke Data Contoh"
              className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Load Sample</span>
            </button>
            <button
              onClick={handleClearAll}
              title="Reset Semua Data"
              className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Eraser className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear Memory</span>
            </button>
          </div>
        )}
      </div>

      {activeTab === 'dashboard' && (
        <div className="flex flex-col gap-4">
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            
            {/* 1. Bento Card Laba Konveksi */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs border-l-4 border-l-indigo-600 flex flex-col justify-between min-h-[110px]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Laba Konveksi</span>
                <span className="bg-indigo-50 text-indigo-600 p-1.5 rounded-lg">
                  <Shirt className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`text-xl font-bold font-mono tracking-tight ${konveksiFin.profit >= 0 ? 'text-indigo-700' : 'text-rose-600'}`}>
                  {formatCurrency(konveksiFin.profit)}
                </span>
                <span className={`text-[10px] font-bold ${konveksiFin.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {konveksiFin.profit >= 0 ? '↑ Aktif' : '↓ Minus'}
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-500">
                <span className="text-emerald-600">Masuk: {formatCurrency(konveksiFin.income, false)}</span>
                <span className="text-rose-500">Keluar: {formatCurrency(konveksiFin.expense, false)}</span>
              </div>
            </motion.div>

            {/* 2. Bento Card Laba Sablon */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: 0.05 }}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs border-l-4 border-l-emerald-600 flex flex-col justify-between min-h-[110px]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Laba Sablon</span>
                <span className="bg-emerald-50 text-emerald-600 p-1.5 rounded-lg">
                  <Palette className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`text-xl font-bold font-mono tracking-tight ${sablonFin.profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {formatCurrency(sablonFin.profit)}
                </span>
                <span className={`text-[10px] font-bold ${sablonFin.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {sablonFin.profit >= 0 ? '↑ Aktif' : '↓ Minus'}
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-500">
                <span className="text-emerald-600">Masuk: {formatCurrency(sablonFin.income, false)}</span>
                <span className="text-rose-500">Keluar: {formatCurrency(sablonFin.expense, false)}</span>
              </div>
            </motion.div>

            {/* 3. Bento Card Laba Aksesori */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs border-l-4 border-l-amber-500 flex flex-col justify-between min-h-[110px]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Laba Aksesori</span>
                <span className="bg-amber-50 text-amber-600 p-1.5 rounded-lg">
                  <Gem className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`text-xl font-bold font-mono tracking-tight ${aksesoriFin.profit >= 0 ? 'text-amber-700' : 'text-rose-600'}`}>
                  {formatCurrency(aksesoriFin.profit)}
                </span>
                <span className={`text-[10px] font-bold ${aksesoriFin.profit >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {aksesoriFin.profit >= 0 ? '↑ Aktif' : '↓ Minus'}
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-500">
                <span className="text-emerald-600">Masuk: {formatCurrency(aksesoriFin.income, false)}</span>
                <span className="text-rose-500">Keluar: {formatCurrency(aksesoriFin.expense, false)}</span>
              </div>
            </motion.div>

            {/* 4. Bento Card Transaksi Alat */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: 0.12 }}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs border-l-4 border-l-rose-500 flex flex-col justify-between min-h-[110px]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Transaksi Divisi Alat</span>
                <span className="bg-rose-50 text-rose-600 p-1.5 rounded-lg">
                  <Wrench className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono tracking-tight text-slate-800">
                  {formatCurrency(alatTotalValue)}
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-500">
                <span className="text-slate-600">{alatCount} Transaksi Tercatat</span>
                <span className="text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">Hanya Log</span>
              </div>
            </motion.div>

            {/* 5. Bento Card Consolidated Total */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: 0.15 }}
              className="bg-slate-900 border border-slate-900 rounded-2xl p-5 shadow-xs text-white border-l-4 border-l-indigo-400 flex flex-col justify-between min-h-[110px]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Laba Konsolidasi (3 Divisi)</span>
                <span className="bg-white/10 text-white p-1.5 rounded-lg">
                  <DollarSign className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono tracking-tight text-white">
                  {formatCurrency(totalProfit)}
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-bold text-slate-400">
                <span className="text-emerald-400">Tot Masuk: {formatCurrency(totalIncome, false)}</span>
                <span className="text-rose-400">Tot Keluar: {formatCurrency(totalExpense, false)}</span>
              </div>
            </motion.div>

          </div>

          {/* Main Content Layout: Form & Ledger */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            
            {/* Input Form Bento Card */}
            <div id="transaction-form-card" className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
                  {editingTransactionId ? (
                    <Pencil className="h-4 w-4 text-indigo-600 animate-pulse" />
                  ) : (
                    <PlusCircle className="h-4 w-4 text-slate-900" />
                  )}
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    {editingTransactionId ? 'Ubah Catatan Transaksi' : 'Input Transaksi Baru'}
                  </h2>
                  {editingTransactionId && (
                    <span className="ml-auto bg-indigo-100 text-indigo-800 text-[9px] px-2 py-0.5 rounded-full font-extrabold uppercase">
                      Mode Edit
                    </span>
                  )}
                </div>

                {/* Banner Tombol Invoice / Kasir Kaos Polos (Sablon -> Konveksi Inter-Divisi) */}
                <div className="mb-4 bg-slate-900 text-white rounded-xl p-3 shadow-xs border border-slate-800 flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 bg-amber-400/20 text-amber-300 rounded-lg shrink-0">
                      <ShoppingCart className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-white">Kasir Kaos Polos</span>
                        <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[8.5px] px-1.5 py-0.2 rounded font-mono font-extrabold uppercase">Sablon ➔ Konveksi</span>
                      </div>
                      <p className="text-[9.5px] text-slate-300 truncate mt-0.5">Otomatis Masuk Pemasukan Konveksi & Pengeluaran Sablon</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setKasirInvoiceNo(`INV-KP-${Date.now().toString().slice(-6)}`);
                      setIsKasirModalOpen(true);
                    }}
                    className="px-2.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[10.5px] rounded-lg shadow-sm transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    <span>Buka Kasir</span>
                  </button>
                </div>

                <form onSubmit={handleAddTransaction} className="space-y-4">
                  
                  {/* Tanggal */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 block">Tanggal</label>
                    <input 
                      type="date"
                      required
                      value={inputDate}
                      onChange={(e) => setInputDate(e.target.value)}
                      className="w-full mt-1 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold bg-slate-50 focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                    />
                  </div>

                  {/* Divisi Bisnis */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 block">Divisi Bisnis</label>
                    <div className="grid grid-cols-4 gap-1.5 mt-1">
                      {(['Konveksi', 'Sablon', 'Aksesori', 'Alat'] as Division[]).map((div) => (
                        <button
                          key={div}
                          type="button"
                          onClick={() => setInputDivision(div)}
                          className={`py-2 px-1 text-[11px] font-bold rounded-lg border transition-all duration-150 cursor-pointer ${
                            inputDivision === div
                              ? div === 'Konveksi' 
                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold'
                                : div === 'Sablon'
                                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold'
                                  : div === 'Aksesori'
                                    ? 'bg-amber-50 border-amber-500 text-amber-700 font-bold'
                                    : 'bg-rose-50 border-rose-500 text-rose-700 font-bold'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {div}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Jenis Transaksi */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 block">Jenis Transaksi</label>
                    {inputDivision === 'Alat' ? (
                      <div className="mt-1 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-3 py-2.5 text-xs font-bold flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-rose-500" />
                        <div>
                          <p className="text-rose-900 font-extrabold text-[11px]">Pencatatan Transaksi Alat</p>
                          <p className="text-[10px] text-rose-600/85 font-medium mt-0.5">Non-kas & tidak dihitung di laba operasional</p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => setInputType('Pemasukan')}
                          className={`py-2 px-3 text-[11px] font-bold rounded-lg border flex items-center justify-center space-x-1.5 transition-all duration-150 cursor-pointer ${
                            inputType === 'Pemasukan'
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <TrendingUp className="h-3.5 w-3.5" />
                          <span>Pemasukan</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setInputType('Pengeluaran')}
                          className={`py-2 px-3 text-[11px] font-bold rounded-lg border flex items-center justify-center space-x-1.5 transition-all duration-150 cursor-pointer ${
                            inputType === 'Pengeluaran'
                              ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <TrendingDown className="h-3.5 w-3.5" />
                          <span>Pengeluaran</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Nominal IDR */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 flex justify-between">
                      <span>Nominal (IDR)</span>
                      {inputAmount && (
                        <span className="text-indigo-600 font-mono text-[10px] font-bold">
                          {formatCurrency(parseInt(inputAmount.replace(/\D/g, ''), 10) || 0)}
                        </span>
                      )}
                    </label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">Rp</span>
                      <input 
                        type="text"
                        required
                        placeholder="0"
                        value={inputAmount}
                        onChange={(e) => {
                          const cleaned = e.target.value.replace(/\D/g, '');
                          setInputAmount(cleaned);
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-mono font-semibold focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                      />
                    </div>
                    
                    {/* Quick values buttons */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {[100000, 500000, 1000000].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => addNominalHelper(val)}
                          className="bg-slate-100 text-slate-600 hover:bg-slate-200 text-[9px] font-extrabold px-1.5 py-1 rounded-md transition-all border border-slate-200 cursor-pointer"
                        >
                          +{formatCurrency(val, false)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Keterangan */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 block">Keterangan / Catatan</label>
                    <textarea 
                      required
                      placeholder="Catatan transaksi..."
                      value={inputDescription}
                      onChange={(e) => setInputDescription(e.target.value)}
                      rows={2}
                      className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-all text-slate-800 resize-none"
                    />
                  </div>

                  {/* Bukti Transaksi (File Upload) */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 flex items-center gap-1.5">
                      <Paperclip className="h-3.5 w-3.5 text-indigo-500 animate-pulse" />
                      Bukti Transaksi (Opsional)
                    </label>
                    {inputBuktiTransaksi ? (
                      <div className="relative border border-slate-200 rounded-xl p-2.5 bg-slate-50 flex items-center gap-3">
                        <img 
                          src={inputBuktiTransaksi} 
                          alt="Bukti" 
                          className="h-14 w-14 object-cover rounded-lg border border-slate-200 bg-white"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-extrabold text-slate-700 truncate">Gambar Bukti Transaksi</p>
                          <p className="text-[9.5px] font-medium text-emerald-600 flex items-center gap-1 mt-0.5">
                            <CheckCircle className="h-3.5 w-3.5" /> Berhasil dimuat
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setInputBuktiTransaksi('')}
                          className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Bukti"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div 
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const file = e.dataTransfer.files?.[0];
                          if (file) {
                            handleFileProcess(file);
                          }
                        }}
                        className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-4 bg-slate-50 hover:bg-indigo-50/10 text-center transition-all cursor-pointer relative group"
                        onClick={() => document.getElementById('bukti-file-input')?.click()}
                      >
                        <input 
                          id="bukti-file-input"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFileProcess(file);
                            }
                          }}
                        />
                        <Paperclip className="h-5 w-5 text-indigo-500 group-hover:scale-110 mx-auto mb-1.5 transition-transform" />
                        <p className="text-[10px] font-bold text-slate-600">
                          Drag & drop gambar bukti atau <span className="text-indigo-600 group-hover:underline">Pilih File</span>
                        </p>
                        <p className="text-[9px] text-slate-400 font-medium mt-0.5">PNG, JPG, WEBP (Max 5MB - otomatis kompresi)</p>
                      </div>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className={editingTransactionId ? "flex gap-2" : ""}>
                    <button
                      type="submit"
                      className={`font-bold py-2.5 px-4 rounded-xl shadow-xs text-xs tracking-wider transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer mt-1 ${
                        editingTransactionId 
                          ? 'w-2/3 bg-indigo-600 hover:bg-indigo-700 text-white' 
                          : 'w-full bg-slate-900 hover:bg-slate-800 text-white active:scale-95'
                      }`}
                    >
                      {editingTransactionId ? <Check className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
                      <span>{editingTransactionId ? 'SIMPAN UBAHAN' : 'SIMPAN TRANSAKSI'}</span>
                    </button>
                    {editingTransactionId && (
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="w-1/3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold py-2.5 px-4 rounded-xl shadow-xs text-xs tracking-wider transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                      >
                        <span>BATAL</span>
                      </button>
                    )}
                  </div>

                </form>
              </div>

              {/* Tips Section */}
              <div className="mt-5 pt-4 border-t border-slate-100 text-[10px] text-slate-500 leading-relaxed bg-slate-50/50 p-3.5 rounded-xl border border-dashed border-slate-200">
                <h4 className="font-bold text-slate-700 mb-1.5 flex items-center gap-1.5 uppercase tracking-wider text-[9px]">
                  <Info className="h-3.5 w-3.5 text-indigo-500" />
                  PANDUAN PENGISIAN KOLOM FORM:
                </h4>
                <ul className="list-disc list-inside space-y-1 text-[9.5px] text-slate-500 font-medium">
                  <li><strong className="text-slate-700">Tanggal:</strong> Pilih tanggal pencatatan keuangan yang diinginkan.</li>
                  <li><strong className="text-slate-700">Divisi Bisnis:</strong> Pilih divisi usaha (<span className="text-indigo-600 font-bold">Konveksi</span>, <span className="text-emerald-600 font-bold">Sablon</span>, <span className="text-amber-600 font-bold">Aksesori</span>, atau <span className="text-rose-600 font-bold">Alat</span>).</li>
                  <li><strong className="text-slate-700">Jenis:</strong> Tentukan apakah transaksi berupa <span className="text-indigo-600 font-bold">Pemasukan</span> (uang masuk) atau <span className="text-rose-600 font-bold">Pengeluaran</span> (uang keluar).</li>
                  <li><strong className="text-slate-700">Nominal (IDR):</strong> Masukkan angka rupiah tanpa titik/koma, atau gunakan tombol bantuan instan (<code className="bg-slate-200 px-1 py-0.5 rounded text-[9px] font-bold">+Rp 100.000</code>, dll).</li>
                  <li><strong className="text-slate-700">Keterangan:</strong> Berikan detail transaksi (contoh: <code className="bg-slate-200 px-1 py-0.5 rounded text-[9px] font-mono font-bold">"Pembayaran DP Sablon Kaos Kelas XII"</code>).</li>
                </ul>
              </div>
            </div>

            {/* Ledger Transaksi Bento Card */}
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col justify-between overflow-hidden">
              <div>
                
                {/* Header controls & Export Button */}
                <div className="p-5 border-b border-slate-100 bg-slate-50/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      Ledger Transaksi Gabungan 
                      <span className="bg-indigo-50 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                        {filteredTransactions.length} Transaksi
                      </span>
                    </h2>
                    <p className="text-[10px] text-slate-400 font-medium">Monitor arus kas per divisi secara real-time</p>
                  </div>

                  {/* Search bar & Export Trigger */}
                  <div className="flex items-center gap-2 max-w-md w-full sm:w-auto self-end sm:self-auto">
                    
                    {/* Search Input */}
                    <div className="relative flex-1 sm:w-56">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Cari deskripsi..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-8.5 pr-3 py-1.5 text-xs font-medium focus:outline-hidden focus:border-indigo-500 transition-all text-slate-800"
                      />
                    </div>

                    {/* Tombol Kasir Kaos Polos (Sablon -> Konveksi) */}
                    <button
                      onClick={() => {
                        setKasirInvoiceNo(`INV-KP-${Date.now().toString().slice(-6)}`);
                        setIsKasirModalOpen(true);
                      }}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black p-1.5 px-3 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0 transition-all border border-amber-300/60"
                      title="Kasir / Invoice Kaos Polos (Pembelian Sablon ke Konveksi)"
                    >
                      <Receipt className="h-4 w-4 text-slate-950" />
                      <span>Kasir Kaos Polos</span>
                    </button>

                    {/* Button for Periodical Reports */}
                    <button
                      onClick={() => setActiveTab('reports')}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-1.5 px-3 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0 transition-all"
                      title="Lihat Laporan Bulanan, 3 Bulanan & Tahunan"
                    >
                      <FileText className="h-4 w-4" />
                      <span>Laporan Berkala</span>
                    </button>

                    {/* Button to Open Export Modal */}
                    <button
                      onClick={() => setIsExportModalOpen(true)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-1.5 px-3 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0 transition-all"
                      title="Ekspor Laporan Ke Excel / Google Sheets"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>Ekspor Data</span>
                    </button>
                    
                  </div>
                </div>

                {/* Ledger Table Container */}
                <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-50 border-b-2 border-slate-200 text-[10px]">
                      {/* Layer 1: Division groupings */}
                      <tr>
                        <th scope="col" rowSpan={2} className="px-3 py-3 font-extrabold uppercase tracking-wider text-slate-600 border-r border-slate-200 text-center bg-slate-100 w-24">
                          Tanggal
                        </th>

                        {/* Konveksi */}
                        <th scope="col" colSpan={5} className="px-2 py-1.5 text-center font-bold uppercase tracking-wider bg-indigo-50 text-indigo-900 border-r border-slate-200 border-b border-slate-200">
                          Konveksi
                        </th>

                        {/* Sablon */}
                        <th scope="col" colSpan={5} className="px-2 py-1.5 text-center font-bold uppercase tracking-wider bg-emerald-50 text-emerald-900 border-r border-slate-200 border-b border-slate-200">
                          Sablon
                        </th>

                        {/* Aksesori */}
                        <th scope="col" colSpan={5} className="px-2 py-1.5 text-center font-bold uppercase tracking-wider bg-amber-50 text-amber-900 border-r border-slate-200 border-b border-slate-200">
                          Aksesori
                        </th>

                        {/* Alat */}
                        <th scope="col" colSpan={3} className="px-2 py-1.5 text-center font-bold uppercase tracking-wider bg-rose-50 text-rose-900 border-r border-slate-200 border-b border-slate-200">
                          Alat (Transaksi)
                        </th>
                      </tr>

                      {/* Layer 2: Sub-headers */}
                      <tr className="bg-slate-50/80 text-[9px] border-b border-slate-200">
                        <th scope="col" className="px-2 py-2 text-indigo-950 font-bold border-r border-slate-100 bg-indigo-50/30 min-w-[220px] max-w-[280px]">Keterangan</th>
                        <th scope="col" className="px-2 py-2 text-slate-500 border-r border-slate-100">Masuk</th>
                        <th scope="col" className="px-2 py-2 text-slate-500 border-r border-slate-100">Keluar</th>
                        <th scope="col" className="px-2 py-2 text-slate-900 font-extrabold bg-indigo-50/50 border-r border-slate-100">Laba</th>
                        <th scope="col" className="px-2 py-2 text-indigo-900 font-bold bg-indigo-50/40 border-r border-slate-200 text-center">Aksi</th>

                        <th scope="col" className="px-2 py-2 text-emerald-950 font-bold border-r border-slate-100 bg-emerald-50/30 min-w-[220px] max-w-[280px]">Keterangan</th>
                        <th scope="col" className="px-2 py-2 text-slate-500 border-r border-slate-100">Masuk</th>
                        <th scope="col" className="px-2 py-2 text-slate-500 border-r border-slate-100">Keluar</th>
                        <th scope="col" className="px-2 py-2 text-slate-900 font-extrabold bg-emerald-50/50 border-r border-slate-100">Laba</th>
                        <th scope="col" className="px-2 py-2 text-emerald-900 font-bold bg-emerald-50/40 border-r border-slate-200 text-center">Aksi</th>

                        <th scope="col" className="px-2 py-2 text-amber-950 font-bold border-r border-slate-100 bg-amber-50/30 min-w-[220px] max-w-[280px]">Keterangan</th>
                        <th scope="col" className="px-2 py-2 text-slate-500 border-r border-slate-100">Masuk</th>
                        <th scope="col" className="px-2 py-2 text-slate-500 border-r border-slate-100">Keluar</th>
                        <th scope="col" className="px-2 py-2 text-slate-900 font-extrabold bg-amber-50/50 border-r border-slate-100">Laba</th>
                        <th scope="col" className="px-2 py-2 text-amber-900 font-bold bg-amber-50/40 border-r border-slate-200 text-center">Aksi</th>

                        <th scope="col" className="px-2 py-2 text-rose-950 font-bold border-r border-slate-100 bg-rose-50/30 min-w-[220px] max-w-[280px]">Keterangan</th>
                        <th scope="col" className="px-2 py-2 text-slate-900 font-extrabold bg-rose-50/50 border-r border-slate-100">Transaksi</th>
                        <th scope="col" className="px-2 py-2 text-rose-900 font-bold bg-rose-50/40 border-r border-slate-200 text-center">Aksi</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 bg-white">
                      <AnimatePresence>
                        {(() => {
                          const uniqueDates = Array.from(new Set(filteredTransactions.map(t => t.date as string)))
                            .sort((a, b) => (b as string).localeCompare(a as string)); // Sort descending (newest first)

                          if (uniqueDates.length === 0) {
                            return (
                              <tr>
                                <td colSpan={19} className="px-4 py-16 text-center text-slate-400">
                                  <div className="flex flex-col items-center justify-center space-y-2">
                                    <Layers className="h-10 w-10 text-slate-300 animate-pulse" />
                                    <span className="text-xs font-bold text-slate-700">Tidak ada transaksi ditemukan</span>
                                    <p className="text-[10px] text-slate-400">Gunakan pencarian lain atau input transaksi baru.</p>
                                  </div>
                                </td>
                              </tr>
                            );
                          }

                          const rows: React.ReactNode[] = [];
                          uniqueDates.forEach((date) => {
                            const dateKonveksi = filteredTransactions.filter(t => t.date === date && t.division === 'Konveksi');
                            const dateSablon = filteredTransactions.filter(t => t.date === date && t.division === 'Sablon');
                            const dateAksesori = filteredTransactions.filter(t => t.date === date && t.division === 'Aksesori');
                            const dateAlat = filteredTransactions.filter(t => t.date === date && t.division === 'Alat');

                            const dateMaxRows = Math.max(
                              dateKonveksi.length,
                              dateSablon.length,
                              dateAksesori.length,
                              dateAlat.length
                            );

                            for (let j = 0; j < dateMaxRows; j++) {
                              const txK = dateKonveksi[j];
                              const txS = dateSablon[j];
                              const txA = dateAksesori[j];
                              const txE = dateAlat[j];

                              rows.push(
                                <motion.tr 
                                  key={`${date}-${j}`}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  className="hover:bg-slate-50/60 transition-all text-slate-700 text-xs border-b border-slate-100"
                                >
                                  {/* 1. Tanggal Column on the left */}
                                  {j === 0 ? (
                                    <td 
                                      rowSpan={dateMaxRows} 
                                      className="px-3 py-2.5 font-bold text-slate-700 border-r border-slate-200 text-center bg-slate-50/40 text-xs whitespace-nowrap align-middle"
                                    >
                                      {date}
                                    </td>
                                  ) : null}

                                  {/* Konveksi Cells */}
                                  {txK ? (
                                    <>
                                      <td className="px-2 py-2 border-r border-slate-100 text-xs text-slate-800 break-words min-w-[220px] max-w-[280px] font-medium">
                                        <div className="flex items-center justify-between gap-1.5">
                                          <span className="text-xs text-slate-800 font-semibold">{txK.description}</span>
                                          {txK.buktiTransaksi && (
                                            <button
                                              type="button"
                                              onClick={() => setSelectedBuktiUrl(txK.buktiTransaksi!)}
                                              className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 p-1 rounded-md transition-all inline-flex items-center justify-center shrink-0 cursor-pointer"
                                              title="Lihat Bukti Transaksi"
                                            >
                                              <Paperclip className="h-3.5 w-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-2 py-2 border-r border-slate-100 text-right text-xs font-mono">{formatTableCell(txK.type === 'Pemasukan' ? txK.amount : 0)}</td>
                                      <td className="px-2 py-2 border-r border-slate-100 text-right text-xs font-mono">{formatTableCell(txK.type === 'Pengeluaran' ? txK.amount : 0)}</td>
                                      <td className="px-2 py-2 bg-indigo-50/20 border-r border-slate-100 text-right font-medium text-xs font-mono">{formatTableProfitCell(txK.type === 'Pemasukan' ? txK.amount : -txK.amount)}</td>
                                      <td className="px-2 py-2 border-r border-slate-200 text-center whitespace-nowrap bg-indigo-50/10">
                                        <div className="flex items-center justify-center gap-1.5">
                                          <button
                                            onClick={() => handleStartEdit(txK)}
                                            className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-1 rounded-md transition-all inline-flex cursor-pointer"
                                            title="Edit"
                                          >
                                            <Pencil className="h-3 w-3" />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteTransaction(txK.id)}
                                            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-md transition-all inline-flex cursor-pointer"
                                            title="Hapus"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        </div>
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="px-2 py-2 border-r border-slate-100 text-slate-300 text-center font-medium min-w-[220px] max-w-[280px]">-</td>
                                      <td className="px-2 py-2 border-r border-slate-100 text-slate-300 text-center font-mono">-</td>
                                      <td className="px-2 py-2 border-r border-slate-100 text-slate-300 text-center font-mono">-</td>
                                      <td className="px-2 py-2 bg-indigo-50/20 border-r border-slate-100 text-slate-300 text-center font-mono">-</td>
                                      <td className="px-2 py-2 border-r border-slate-200 text-center whitespace-nowrap bg-indigo-50/10 text-slate-300">-</td>
                                    </>
                                  )}

                                  {/* Sablon Cells */}
                                  {txS ? (
                                    <>
                                      <td className="px-2 py-2 border-r border-slate-100 text-xs text-slate-800 break-words min-w-[220px] max-w-[280px] font-medium">
                                        <div className="flex items-center justify-between gap-1.5">
                                          <span className="text-xs text-slate-800 font-semibold">{txS.description}</span>
                                          {txS.buktiTransaksi && (
                                            <button
                                              type="button"
                                              onClick={() => setSelectedBuktiUrl(txS.buktiTransaksi!)}
                                              className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 p-1 rounded-md transition-all inline-flex items-center justify-center shrink-0 cursor-pointer"
                                              title="Lihat Bukti Transaksi"
                                            >
                                              <Paperclip className="h-3.5 w-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-2 py-2 border-r border-slate-100 text-right text-xs font-mono">{formatTableCell(txS.type === 'Pemasukan' ? txS.amount : 0)}</td>
                                      <td className="px-2 py-2 border-r border-slate-100 text-right text-xs font-mono">{formatTableCell(txS.type === 'Pengeluaran' ? txS.amount : 0)}</td>
                                      <td className="px-2 py-2 bg-emerald-50/20 border-r border-slate-100 text-right font-medium text-xs font-mono">{formatTableProfitCell(txS.type === 'Pemasukan' ? txS.amount : -txS.amount)}</td>
                                      <td className="px-2 py-2 border-r border-slate-200 text-center whitespace-nowrap bg-emerald-50/10">
                                        <div className="flex items-center justify-center gap-1.5">
                                          <button
                                            onClick={() => handleStartEdit(txS)}
                                            className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 p-1 rounded-md transition-all inline-flex cursor-pointer"
                                            title="Edit"
                                          >
                                            <Pencil className="h-3 w-3" />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteTransaction(txS.id)}
                                            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-md transition-all inline-flex cursor-pointer"
                                            title="Hapus"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        </div>
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="px-2 py-2 border-r border-slate-100 text-slate-300 text-center font-medium min-w-[220px] max-w-[280px]">-</td>
                                      <td className="px-2 py-2 border-r border-slate-100 text-slate-300 text-center font-mono">-</td>
                                      <td className="px-2 py-2 border-r border-slate-100 text-slate-300 text-center font-mono">-</td>
                                      <td className="px-2 py-2 bg-emerald-50/20 border-r border-slate-100 text-slate-300 text-center font-mono">-</td>
                                      <td className="px-2 py-2 border-r border-slate-200 text-center whitespace-nowrap bg-emerald-50/10 text-slate-300">-</td>
                                    </>
                                  )}

                                  {/* Aksesori Cells */}
                                  {txA ? (
                                    <>
                                      <td className="px-2 py-2 border-r border-slate-100 text-xs text-slate-800 break-words min-w-[220px] max-w-[280px] font-medium">
                                        <div className="flex items-center justify-between gap-1.5">
                                          <span className="text-xs text-slate-800 font-semibold">{txA.description}</span>
                                          {txA.buktiTransaksi && (
                                            <button
                                              type="button"
                                              onClick={() => setSelectedBuktiUrl(txA.buktiTransaksi!)}
                                              className="text-amber-600 hover:text-amber-800 hover:bg-amber-50 p-1 rounded-md transition-all inline-flex items-center justify-center shrink-0 cursor-pointer"
                                              title="Lihat Bukti Transaksi"
                                            >
                                              <Paperclip className="h-3.5 w-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-2 py-2 border-r border-slate-100 text-right text-xs font-mono">{formatTableCell(txA.type === 'Pemasukan' ? txA.amount : 0)}</td>
                                      <td className="px-2 py-2 border-r border-slate-100 text-right text-xs font-mono">{formatTableCell(txA.type === 'Pengeluaran' ? txA.amount : 0)}</td>
                                      <td className="px-2 py-2 bg-amber-50/20 border-r border-slate-100 text-right font-medium text-xs font-mono">{formatTableProfitCell(txA.type === 'Pemasukan' ? txA.amount : -txA.amount)}</td>
                                      <td className="px-2 py-2 border-r border-slate-200 text-center whitespace-nowrap bg-amber-50/10">
                                        <div className="flex items-center justify-center gap-1.5">
                                          <button
                                            onClick={() => handleStartEdit(txA)}
                                            className="text-slate-400 hover:text-amber-600 hover:bg-amber-50 p-1 rounded-md transition-all inline-flex cursor-pointer"
                                            title="Edit"
                                          >
                                            <Pencil className="h-3 w-3" />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteTransaction(txA.id)}
                                            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-md transition-all inline-flex cursor-pointer"
                                            title="Hapus"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        </div>
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="px-2 py-2 border-r border-slate-100 text-slate-300 text-center font-medium min-w-[220px] max-w-[280px]">-</td>
                                      <td className="px-2 py-2 border-r border-slate-100 text-slate-300 text-center font-mono">-</td>
                                      <td className="px-2 py-2 border-r border-slate-100 text-slate-300 text-center font-mono">-</td>
                                      <td className="px-2 py-2 bg-amber-50/20 border-r border-slate-100 text-slate-300 text-center font-mono">-</td>
                                      <td className="px-2 py-2 border-r border-slate-200 text-center whitespace-nowrap bg-amber-50/10 text-slate-300">-</td>
                                    </>
                                  )}

                                  {/* Alat Cells */}
                                  {txE ? (
                                    <>
                                      <td className="px-2 py-2 border-r border-slate-100 text-xs text-slate-800 break-words min-w-[220px] max-w-[280px] font-medium">
                                        <div className="flex items-center justify-between gap-1.5">
                                          <span className="text-xs text-slate-800 font-semibold">{txE.description}</span>
                                          {txE.buktiTransaksi && (
                                            <button
                                              type="button"
                                              onClick={() => setSelectedBuktiUrl(txE.buktiTransaksi!)}
                                              className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 p-1 rounded-md transition-all inline-flex items-center justify-center shrink-0 cursor-pointer"
                                              title="Lihat Bukti Transaksi"
                                            >
                                              <Paperclip className="h-3.5 w-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-2 py-2 bg-rose-50/10 border-r border-slate-100 text-right font-mono font-medium text-slate-700 text-xs">{formatTableCell(txE.amount)}</td>
                                      <td className="px-2 py-2 border-r border-slate-200 text-center whitespace-nowrap bg-rose-50/10">
                                        <div className="flex items-center justify-center gap-1.5">
                                          <button
                                            onClick={() => handleStartEdit(txE)}
                                            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-md transition-all inline-flex cursor-pointer"
                                            title="Edit"
                                          >
                                            <Pencil className="h-3 w-3" />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteTransaction(txE.id)}
                                            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-md transition-all inline-flex cursor-pointer"
                                            title="Hapus"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        </div>
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="px-2 py-2 border-r border-slate-100 text-slate-300 text-center font-medium min-w-[220px] max-w-[280px]">-</td>
                                      <td className="px-2 py-2 bg-rose-50/10 border-r border-slate-100 text-slate-300 text-center font-mono">-</td>
                                      <td className="px-2 py-2 border-r border-slate-200 text-center whitespace-nowrap bg-rose-50/10 text-slate-300">-</td>
                                    </>
                                  )}
                                </motion.tr>
                              );
                            }
                          });
                          return rows;
                        })()}
                      </AnimatePresence>
                    </tbody>

                    {/* Total Row */}
                    {transactions.length > 0 && (
                      <tfoot className="bg-slate-100 font-extrabold text-slate-800 border-t-2 border-slate-300 text-[10px]">
                        <tr>
                          {/* Tanggal column spacer */}
                          <td className="px-2 py-3 text-center border-r border-slate-200 font-black tracking-wide bg-slate-50">TOTAL:</td>

                          {/* Konveksi */}
                          <td className="bg-slate-50 border-r border-slate-100 min-w-[220px] max-w-[280px]"></td>
                          <td className="px-2 py-3 text-right bg-indigo-50/30 border-r border-slate-100 text-indigo-900 font-mono font-bold">{formatCurrency(konveksiFin.income, false)}</td>
                          <td className="px-2 py-3 text-right bg-indigo-50/30 border-r border-slate-100 text-rose-700 font-mono font-bold">{formatCurrency(konveksiFin.expense, false)}</td>
                          <td className={`px-2 py-3 text-right bg-indigo-100/60 border-r border-slate-100 font-black font-mono ${konveksiFin.profit < 0 ? 'text-rose-600' : 'text-indigo-950'}`}>{formatCurrency(konveksiFin.profit)}</td>
                          <td className="bg-slate-50 border-r border-slate-200"></td>

                          {/* Sablon */}
                          <td className="bg-slate-50 border-r border-slate-100 min-w-[220px] max-w-[280px]"></td>
                          <td className="px-2 py-3 text-right bg-emerald-50/30 border-r border-slate-100 text-emerald-900 font-mono font-bold">{formatCurrency(sablonFin.income, false)}</td>
                          <td className="px-2 py-3 text-right bg-emerald-50/30 border-r border-slate-100 text-rose-700 font-mono font-bold">{formatCurrency(sablonFin.expense, false)}</td>
                          <td className={`px-2 py-3 text-right bg-emerald-100/60 border-r border-slate-100 font-black font-mono ${sablonFin.profit < 0 ? 'text-rose-600' : 'text-emerald-950'}`}>{formatCurrency(sablonFin.profit)}</td>
                          <td className="bg-slate-50 border-r border-slate-200"></td>

                          {/* Aksesori */}
                          <td className="bg-slate-50 border-r border-slate-100 min-w-[220px] max-w-[280px]"></td>
                          <td className="px-2 py-3 text-right bg-amber-50/30 border-r border-slate-100 text-amber-900 font-mono font-bold">{formatCurrency(aksesoriFin.income, false)}</td>
                          <td className="px-2 py-3 text-right bg-amber-50/30 border-r border-slate-100 text-rose-700 font-mono font-bold">{formatCurrency(aksesoriFin.expense, false)}</td>
                          <td className={`px-2 py-3 text-right bg-amber-100/60 border-r border-slate-100 font-black font-mono ${aksesoriFin.profit < 0 ? 'text-rose-600' : 'text-amber-950'}`}>{formatCurrency(aksesoriFin.profit)}</td>
                          <td className="bg-slate-50 border-r border-slate-200"></td>

                          {/* Alat */}
                          <td className="bg-slate-50 border-r border-slate-100 min-w-[220px] max-w-[280px]"></td>
                          <td className="px-2 py-3 text-right bg-rose-100/60 border-r border-slate-100 font-black font-mono text-rose-950">{formatCurrency(alatTotalValue)}</td>
                          <td className="bg-slate-50 border-r border-slate-200"></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

              </div>

              {/* Status footer for Bento Ledger */}
              <div className="bg-slate-50 p-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-semibold px-5">
                <span>Rangkuman Finansial • 3 Divisi Utama + Log Alat</span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Up to date
                </span>
              </div>

            </div>

          </div>

          {/* Bento Card: Persetujuan Transaksi */}
          {(isOwner || approvalRequests.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs animate-fade-in"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 mb-4 border-b border-slate-100 gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      Persetujuan Aktivitas Transaksi
                      {isOwner && approvalRequests.filter(r => r.status === 'Pending').length > 0 && (
                        <span className="bg-amber-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black animate-pulse">
                          {approvalRequests.filter(r => r.status === 'Pending').length} BARU
                        </span>
                      )}
                    </h2>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {isOwner 
                        ? 'Konfirmasi atau tolak pengajuan perubahan/penghapusan transaksi yang dikirim oleh Admin' 
                        : 'Pantau status pengajuan persetujuan perubahan atau penghapusan transaksi Anda'}
                    </p>
                  </div>
                </div>
                {approvalRequests.length > 0 && (
                  <button
                    onClick={() => {
                      setApprovalRequests([]);
                      triggerToast('Semua riwayat pengajuan berhasil dibersihkan.');
                    }}
                    className="text-[10px] text-slate-400 hover:text-slate-600 font-bold hover:underline cursor-pointer"
                  >
                    Bersihkan Riwayat
                  </button>
                )}
              </div>

              {approvalRequests.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <p className="text-xs font-bold text-slate-700">Tidak ada pengajuan aktif</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {isOwner 
                      ? 'Belum ada pengajuan perubahan atau penghapusan transaksi dari Admin saat ini.' 
                      : 'Transaksi yang Anda edit atau hapus (jika butuh persetujuan) akan masuk ke daftar persetujuan Owner di sini.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="pb-2.5">Pengaju / Waktu</th>
                        <th className="pb-2.5 text-center">Jenis Aksi</th>
                        <th className="pb-2.5">Divisi</th>
                        <th className="pb-2.5">Transaksi & Keterangan</th>
                        <th className="pb-2.5 text-right font-bold">Nominal</th>
                        <th className="pb-2.5 text-center">Status</th>
                        <th className="pb-2.5 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {approvalRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3">
                            <div className="font-bold text-slate-800">{req.requestedBy}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{req.requestedAt}</div>
                          </td>
                          <td className="py-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                              req.requestType === 'Edit' 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                                : 'bg-rose-50 border-rose-200 text-rose-700'
                            }`}>
                              {req.requestType === 'Edit' ? '✏️ Ubah' : '🗑️ Hapus'}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                              req.transactionDivision === 'Konveksi' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' :
                              req.transactionDivision === 'Sablon' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                              req.transactionDivision === 'Aksesori' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                              'bg-rose-50 border-rose-200 text-rose-700'
                            }`}>
                              {req.transactionDivision}
                            </span>
                          </td>
                          <td className="py-3 max-w-xs break-words font-semibold text-slate-800">
                            {(() => {
                              const origTx = transactions.find(t => t.id === req.transactionId);
                              const hasOrigProof = origTx?.buktiTransaksi;
                              const hasNewProof = req.newData?.buktiTransaksi;

                              return (
                                <div>
                                  {req.requestType === 'Edit' && req.newData ? (
                                    <div>
                                      <span className="line-through text-slate-400 text-[11px] block">{req.transactionDesc}</span>
                                      <span className="text-indigo-600 text-xs font-bold mt-0.5 flex items-center gap-1">
                                        <span className="text-[9px] bg-indigo-100 text-indigo-800 font-black px-1 rounded">Baru:</span>
                                        {req.newData.description}
                                      </span>
                                    </div>
                                  ) : (
                                    <span>{req.transactionDesc}</span>
                                  )}

                                  {/* Tampilkan link bukti transaksi jika ada */}
                                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {hasOrigProof && (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedBuktiUrl(origTx.buktiTransaksi!)}
                                        className="text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all inline-flex"
                                        title="Lihat bukti transaksi asli"
                                      >
                                        <Paperclip className="h-3 w-3 text-slate-400" />
                                        <span>Bukti {req.requestType === 'Edit' ? 'Lama' : 'Asli'}</span>
                                      </button>
                                    )}
                                    {hasNewProof && (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedBuktiUrl(req.newData!.buktiTransaksi!)}
                                        className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all inline-flex"
                                        title="Lihat bukti transaksi baru"
                                      >
                                        <Paperclip className="h-3 w-3 text-indigo-500" />
                                        <span>Bukti Baru</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="py-3 text-right font-black font-mono text-slate-900">
                            {req.requestType === 'Edit' && req.newData ? (
                              <div>
                                <span className="line-through text-slate-400 text-[10px] block">Rp {req.transactionAmount.toLocaleString('id-ID')}</span>
                                <span className="text-indigo-600 text-xs font-bold">
                                  Rp {req.newData.amount.toLocaleString('id-ID')}
                                </span>
                              </div>
                            ) : (
                              `Rp ${req.transactionAmount.toLocaleString('id-ID')}`
                            )}
                          </td>
                          <td className="py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              req.status === 'Pending' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                              req.status === 'Disetujui' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                              'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}>
                              {req.status === 'Pending' ? '⏱️ Pending' :
                               req.status === 'Disetujui' ? '✅ Disetujui' : '❌ Ditolak'}
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {req.status === 'Pending' && isOwner ? (
                                <>
                                  <button
                                    onClick={() => handleApproveRequest(req.id, req.transactionId)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-xs"
                                  >
                                    Setujui
                                  </button>
                                  <button
                                    onClick={() => handleRejectRequest(req.id)}
                                    className="bg-rose-500 hover:bg-rose-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-xs"
                                  >
                                    Tolak
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleRemoveRequestHistory(req.id)}
                                  className="text-[10px] text-slate-400 hover:text-rose-600 font-bold hover:underline cursor-pointer"
                                >
                                  Hapus Riwayat
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

        </div>
      )}

      {/* RENDER LAPORAN BERKALA TAB */}
      {activeTab === 'reports' && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col gap-6"
        >
          {/* Header & Filter Controls */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-5 border-b border-slate-100 gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Laporan Keuangan Berkala (Mahya Apparel Finance)</h2>
                <p className="text-[11px] text-slate-500 font-medium">Laporan konsolidasian periodik: bulanan, 3 bulanan, dan tahunan</p>
              </div>
            </div>

            {/* Selector Period & Excel Export */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="bg-slate-100 p-1 rounded-xl border border-slate-200/60 flex">
                <button
                  type="button"
                  onClick={() => setSelectedReportPeriod('monthly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedReportPeriod === 'monthly'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Bulanan
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReportPeriod('quarterly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedReportPeriod === 'quarterly'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  3 Bulanan
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReportPeriod('annual')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedReportPeriod === 'annual'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tahunan
                </button>
              </div>

              {/* Batasi Jumlah Periode Input */}
              <div className="bg-slate-100 p-1.5 rounded-xl border border-slate-200/60 flex items-center gap-1.5 px-3">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Batasi:</span>
                <input
                  type="number"
                  min="1"
                  placeholder="Semua"
                  value={periodLimit === 'all' ? '' : periodLimit}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setPeriodLimit('all');
                    } else {
                      const num = parseInt(val, 10);
                      setPeriodLimit(isNaN(num) || num <= 0 ? 'all' : num);
                    }
                  }}
                  className="w-14 px-1.5 py-0.5 rounded bg-white text-slate-900 font-black text-xs border border-slate-300 focus:outline-hidden text-center"
                />
                <span className="text-[10px] text-slate-500 font-bold">Data</span>
                {periodLimit !== 'all' && (
                  <button
                    onClick={() => setPeriodLimit('all')}
                    className="text-[10px] text-emerald-600 hover:text-emerald-800 font-extrabold hover:underline cursor-pointer"
                  >
                    Semua
                  </button>
                )}
              </div>

              <button
                onClick={() => exportPeriodicalReportXLSX(selectedReportPeriod)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Unduh Excel</span>
              </button>
            </div>
          </div>

          {/* Quick Period Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Jumlah Periode</span>
              <span className="text-xl font-extrabold text-slate-900 font-mono mt-1 block">
                {getActiveReportRows().length} {selectedReportPeriod === 'monthly' ? 'Bulan' : selectedReportPeriod === 'quarterly' ? 'Kuartal' : 'Tahun'}
              </span>
              <span className="text-[10px] text-slate-400 font-medium mt-1">Terhitung dari total data transaksi</span>
            </div>

            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Total Pendapatan</span>
              <span className="text-xl font-extrabold text-indigo-900 font-mono mt-1 block">
                {formatCurrency(getActiveReportRows().reduce((sum, r) => sum + r.totalIn, 0))}
              </span>
              <span className="text-[10px] text-indigo-500 font-medium mt-1">Akumulasi seluruh divisi operasional</span>
            </div>

            <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-4 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Total Pengeluaran</span>
              <span className="text-xl font-extrabold text-rose-900 font-mono mt-1 block">
                {formatCurrency(getActiveReportRows().reduce((sum, r) => sum + r.totalOut, 0))}
              </span>
              <span className="text-[10px] text-rose-500 font-medium mt-1">Beban operasional seluruh divisi</span>
            </div>

            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Akumulasi Laba</span>
              <span className="text-xl font-extrabold text-emerald-900 font-mono mt-1 block">
                {formatCurrency(getActiveReportRows().reduce((sum, r) => sum + r.totalProfit, 0))}
              </span>
              <span className="text-[10px] text-emerald-500 font-bold mt-1">
                Margin Laba: {getActiveReportRows().reduce((sum, r) => sum + r.totalIn, 0) > 0 ? ((getActiveReportRows().reduce((sum, r) => sum + r.totalProfit, 0) / getActiveReportRows().reduce((sum, r) => sum + r.totalIn, 0)) * 100).toFixed(1) : '0'}%
              </span>
            </div>
          </div>

          {/* Table Container */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-50 border-b-2 border-slate-200 text-[10px]">
                  {/* Row 1: Main Groupings */}
                  <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                    <th rowSpan={2} className="px-3 py-3 text-center border-r border-slate-200 min-w-[50px]">NO</th>
                    <th rowSpan={2} className="px-4 py-3 text-left border-r border-slate-200 min-w-[150px]">PERIODE</th>
                    <th colSpan={3} className="px-3 py-2 text-center border-r border-slate-200 bg-indigo-50/50 text-indigo-950">DIVISI KONVEKSI</th>
                    <th colSpan={3} className="px-3 py-2 text-center border-r border-slate-200 bg-emerald-50/50 text-emerald-950">DIVISI SABLON</th>
                    <th colSpan={3} className="px-3 py-2 text-center border-r border-slate-200 bg-amber-50/50 text-amber-950">DIVISI AKSESORI</th>
                    <th rowSpan={2} className="px-3 py-3 text-center border-r border-slate-200 bg-rose-50 text-rose-950 min-w-[120px]">ALAT (NON-KAS)</th>
                    <th colSpan={3} className="px-3 py-2 text-center bg-slate-900 text-white">KONSOLIDASI TOTAL</th>
                  </tr>
                  {/* Row 2: Sub-headers */}
                  <tr className="bg-slate-50 text-[9px] text-slate-500 font-extrabold border-b border-slate-200">
                    {/* Konveksi */}
                    <th className="px-2 py-2 text-right border-r border-slate-100 bg-indigo-50/30">Pemasukan</th>
                    <th className="px-2 py-2 text-right border-r border-slate-100 bg-indigo-50/30">Pengeluaran</th>
                    <th className="px-2 py-2 text-right border-r border-slate-200 bg-indigo-50/30">Laba/Rugi</th>
                    {/* Sablon */}
                    <th className="px-2 py-2 text-right border-r border-slate-100 bg-emerald-50/30">Pemasukan</th>
                    <th className="px-2 py-2 text-right border-r border-slate-100 bg-emerald-50/30">Pengeluaran</th>
                    <th className="px-2 py-2 text-right border-r border-slate-200 bg-emerald-50/30">Laba/Rugi</th>
                    {/* Aksesori */}
                    <th className="px-2 py-2 text-right border-r border-slate-100 bg-amber-50/30">Pemasukan</th>
                    <th className="px-2 py-2 text-right border-r border-slate-100 bg-amber-50/30">Pengeluaran</th>
                    <th className="px-2 py-2 text-right border-r border-slate-200 bg-amber-50/30">Laba/Rugi</th>
                    {/* Total */}
                    <th className="px-2 py-2 text-right border-r border-slate-800 bg-slate-800 text-slate-300">Masuk</th>
                    <th className="px-2 py-2 text-right border-r border-slate-800 bg-slate-800 text-slate-300">Keluar</th>
                    <th className="px-2 py-2 text-right bg-slate-900 text-emerald-400">Total Laba</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-slate-700 text-[11px] font-medium">
                  {getActiveReportRows().length === 0 ? (
                    <tr>
                      <td colSpan={15} className="px-4 py-8 text-center text-slate-400 bg-slate-50 font-medium">
                        Belum ada transaksi tercatat untuk memetakan laporan berkala.
                      </td>
                    </tr>
                  ) : (
                    getActiveReportRows().map((row, idx) => (
                      <tr key={row.periodKey} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-3 py-2.5 text-center font-mono text-slate-400 font-bold border-r border-slate-200 bg-slate-50/30">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-bold text-slate-800 border-r border-slate-200">{row.periodLabel}</td>
                        
                        {/* Konveksi */}
                        <td className="px-2 py-2.5 text-right border-r border-slate-100 bg-indigo-50/10 font-mono text-slate-600">{formatCurrency(row.konveksiIn, false)}</td>
                        <td className="px-2 py-2.5 text-right border-r border-slate-100 bg-indigo-50/10 font-mono text-rose-600">{formatCurrency(row.konveksiOut, false)}</td>
                        <td className="px-2 py-2.5 text-right border-r border-slate-200 bg-indigo-100/10 font-mono">{formatTableProfitCell(row.konveksiProfit)}</td>

                        {/* Sablon */}
                        <td className="px-2 py-2.5 text-right border-r border-slate-100 bg-emerald-50/10 font-mono text-slate-600">{formatCurrency(row.sablonIn, false)}</td>
                        <td className="px-2 py-2.5 text-right border-r border-slate-100 bg-emerald-50/10 font-mono text-rose-600">{formatCurrency(row.sablonOut, false)}</td>
                        <td className="px-2 py-2.5 text-right border-r border-slate-200 bg-emerald-100/10 font-mono">{formatTableProfitCell(row.sablonProfit)}</td>

                        {/* Aksesori */}
                        <td className="px-2 py-2.5 text-right border-r border-slate-100 bg-amber-50/10 font-mono text-slate-600">{formatCurrency(row.aksesoriIn, false)}</td>
                        <td className="px-2 py-2.5 text-right border-r border-slate-100 bg-amber-50/10 font-mono text-rose-600">{formatCurrency(row.aksesoriOut, false)}</td>
                        <td className="px-2 py-2.5 text-right border-r border-slate-200 bg-amber-100/10 font-mono">{formatTableProfitCell(row.aksesoriProfit)}</td>

                        {/* Alat */}
                        <td className="px-2 py-2.5 text-right border-r border-slate-200 bg-rose-50/10 font-mono text-rose-950 font-semibold">{formatCurrency(row.alatValue)}</td>

                        {/* Total Konsolidasian */}
                        <td className="px-2 py-2.5 text-right border-r border-slate-700 bg-slate-100/50 font-mono text-slate-900 font-bold">{formatCurrency(row.totalIn, false)}</td>
                        <td className="px-2 py-2.5 text-right border-r border-slate-700 bg-slate-100/50 font-mono text-rose-600 font-bold">{formatCurrency(row.totalOut, false)}</td>
                        <td className="px-2 py-2.5 text-right bg-slate-200/40 font-mono">{formatTableProfitCell(row.totalProfit)}</td>
                      </tr>
                    ))
                  )}
                </tbody>

                {/* Table Footer Totals */}
                {getActiveReportRows().length > 0 && (
                  <tfoot className="bg-slate-100 font-extrabold text-slate-800 border-t-2 border-slate-300 text-[10px]">
                    <tr>
                      <td className="px-3 py-3 text-center border-r border-slate-200 font-black tracking-wide bg-slate-50">TOTAL:</td>
                      <td className="px-4 py-3 border-r border-slate-200 bg-slate-50">RANGKUMAN GABUNGAN</td>

                      {/* Konveksi */}
                      <td className="px-2 py-3 text-right bg-indigo-50/30 border-r border-slate-100 text-indigo-900 font-mono font-bold">{formatCurrency(getActiveReportRows().reduce((sum, r) => sum + r.konveksiIn, 0), false)}</td>
                      <td className="px-2 py-3 text-right bg-indigo-50/30 border-r border-slate-100 text-rose-700 font-mono font-bold">{formatCurrency(getActiveReportRows().reduce((sum, r) => sum + r.konveksiOut, 0), false)}</td>
                      <td className={`px-2 py-3 text-right bg-indigo-100/60 border-r border-slate-200 font-black font-mono ${getActiveReportRows().reduce((sum, r) => sum + r.konveksiProfit, 0) < 0 ? 'text-rose-600' : 'text-indigo-950'}`}>{formatCurrency(getActiveReportRows().reduce((sum, r) => sum + r.konveksiProfit, 0))}</td>

                      {/* Sablon */}
                      <td className="px-2 py-3 text-right bg-emerald-50/30 border-r border-slate-100 text-emerald-900 font-mono font-bold">{formatCurrency(getActiveReportRows().reduce((sum, r) => sum + r.sablonIn, 0), false)}</td>
                      <td className="px-2 py-3 text-right bg-emerald-50/30 border-r border-slate-100 text-rose-700 font-mono font-bold">{formatCurrency(getActiveReportRows().reduce((sum, r) => sum + r.sablonOut, 0), false)}</td>
                      <td className={`px-2 py-3 text-right bg-emerald-100/60 border-r border-slate-200 font-black font-mono ${getActiveReportRows().reduce((sum, r) => sum + r.sablonProfit, 0) < 0 ? 'text-rose-600' : 'text-emerald-950'}`}>{formatCurrency(getActiveReportRows().reduce((sum, r) => sum + r.sablonProfit, 0))}</td>

                      {/* Aksesori */}
                      <td className="px-2 py-3 text-right bg-amber-50/30 border-r border-slate-100 text-amber-900 font-mono font-bold">{formatCurrency(getActiveReportRows().reduce((sum, r) => sum + r.aksesoriIn, 0), false)}</td>
                      <td className="px-2 py-3 text-right bg-amber-50/30 border-r border-slate-100 text-rose-700 font-mono font-bold">{formatCurrency(getActiveReportRows().reduce((sum, r) => sum + r.aksesoriOut, 0), false)}</td>
                      <td className={`px-2 py-3 text-right bg-amber-100/60 border-r border-slate-200 font-black font-mono ${getActiveReportRows().reduce((sum, r) => sum + r.aksesoriProfit, 0) < 0 ? 'text-rose-600' : 'text-amber-950'}`}>{formatCurrency(getActiveReportRows().reduce((sum, r) => sum + r.aksesoriProfit, 0))}</td>

                      {/* Alat */}
                      <td className="px-2 py-3 text-right bg-rose-100/60 border-r border-slate-200 font-black font-mono text-rose-950">{formatCurrency(getActiveReportRows().reduce((sum, r) => sum + r.alatValue, 0))}</td>

                      {/* Total Konsolidasian */}
                      <td className="px-2 py-3 text-right bg-slate-800 text-slate-100 border-r border-slate-700 font-mono font-bold">{formatCurrency(getActiveReportRows().reduce((sum, r) => sum + r.totalIn, 0), false)}</td>
                      <td className="px-2 py-3 text-right bg-slate-800 text-rose-400 border-r border-slate-700 font-mono font-bold">{formatCurrency(getActiveReportRows().reduce((sum, r) => sum + r.totalOut, 0), false)}</td>
                      <td className={`px-2 py-3 text-right bg-slate-900 font-black font-mono ${getActiveReportRows().reduce((sum, r) => sum + r.totalProfit, 0) < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{formatCurrency(getActiveReportRows().reduce((sum, r) => sum + r.totalProfit, 0))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* RENDER MONITORING TAB (HANYA OWNER YANG BISA LIHAT) */}
      {activeTab === 'monitoring' && isOwner && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col gap-6"
        >
          {/* Header & Title */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-5 border-b border-slate-100 gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shadow-xs">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Monitoring & Hak Akses Pengguna</h2>
                <p className="text-[11px] text-slate-500 font-medium">Pantau sesi masuk pengguna dan atur tingkat jabatan akses (Owner / Admin) secara real-time</p>
              </div>
            </div>
            
            <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-2 text-violet-700 text-xs font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-violet-600" />
              <span>Akses Super-Owner Aktif</span>
            </div>
          </div>

          {/* Users Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 font-extrabold tracking-wider">
                    <th className="px-4 py-3 text-center w-12">NO</th>
                    <th className="px-4 py-3">PENGGUNA</th>
                    <th className="px-4 py-3">EMAIL</th>
                    <th className="px-4 py-3">TERAKHIR MASUK</th>
                    <th className="px-4 py-3 text-center">JABATAN</th>
                    <th className="px-4 py-3 text-right pr-6 w-56">AKSI PENGATURAN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {appUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400 bg-slate-50 font-medium">
                        Belum ada data login pengguna yang tercatat di Cloud.
                      </td>
                    </tr>
                  ) : (
                    appUsers.map((user, idx) => {
                      const isMainOwner = user.email.toLowerCase() === 'mahyaapparel@gmail.com';
                      const isCurrentUserSelf = user.email.toLowerCase() === currentUser?.email?.toLowerCase();
                      
                      return (
                        <tr key={user.email} className="hover:bg-slate-50/70 transition-colors">
                          {/* No */}
                          <td className="px-4 py-3.5 text-center font-mono text-slate-400 font-bold border-r border-slate-100 bg-slate-50/20">
                            {idx + 1}
                          </td>
                          
                          {/* User profile */}
                          <td className="px-4 py-3.5 border-r border-slate-100">
                            <div className="flex items-center gap-3">
                              {user.picture ? (
                                <img 
                                  src={user.picture} 
                                  alt={user.name} 
                                  referrerPolicy="no-referrer"
                                  className="h-8 w-8 rounded-full border border-slate-200 object-cover"
                                />
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold border border-slate-200">
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                  <span>{user.name}</span>
                                  {isCurrentUserSelf && (
                                    <span className="bg-slate-100 text-slate-600 text-[9px] px-1.5 py-0.5 rounded-full font-extrabold uppercase">
                                      Anda
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Email */}
                          <td className="px-4 py-3.5 border-r border-slate-100 font-mono text-[11px] text-slate-500">
                            {user.email}
                          </td>

                          {/* Last Login */}
                          <td className="px-4 py-3.5 border-r border-slate-100 text-slate-500 font-mono text-[11px]">
                            {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('id-ID') : '-'}
                          </td>

                          {/* Role Badge */}
                          <td className="px-4 py-3.5 border-r border-slate-100 text-center">
                            {user.role === 'Owner' ? (
                              <span className="inline-flex items-center gap-1 bg-violet-50 text-violet-700 text-[10px] font-bold px-2 py-1 rounded-lg border border-violet-100">
                                <Shield className="h-3 w-3 text-violet-600" />
                                Owner
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-200">
                                <User className="h-3 w-3 text-slate-500" />
                                Admin
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3.5 text-right pr-6">
                            {isMainOwner ? (
                              <span className="text-[10px] text-slate-400 font-semibold italic">
                                Owner Utama (Permanen)
                              </span>
                            ) : (
                              <div className="flex justify-end gap-1.5">
                                {user.role === 'Admin' ? (
                                  <button
                                    onClick={() => handleChangeUserRole(user.email, 'Owner')}
                                    className="px-2.5 py-1.5 bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-600 text-[10px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                  >
                                    <Shield className="h-3 w-3" />
                                    Jadikan Owner
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleChangeUserRole(user.email, 'Admin')}
                                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-[10px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                  >
                                    <User className="h-3 w-3" />
                                    Jadikan Admin
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* Footer Bento */}
      <footer className="flex flex-col sm:flex-row justify-between items-center bg-white border border-slate-200 rounded-2xl px-5 py-3 shadow-xs text-[10px] text-slate-400 font-semibold mt-1">
        <p>© 2026 Mahya Apparel Finance • Multi-Division Finance Core • Bento Grid Theme</p>
        <p className="flex items-center gap-1 mt-1 sm:mt-0">
          <span className={`w-2.5 h-2.5 rounded-full border border-white ${isCloudConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
          <span>{isCloudConnected ? 'Cloud Terhubung (Real-time)' : 'Koneksi Cloud Terputus (Mode Lokal)'}</span>
        </p>
      </footer>

      {/* Lightbox Modal Bukti Transaksi */}
      <AnimatePresence>
        {selectedBuktiUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedBuktiUrl(null)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Paperclip className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    BUKTI TRANSAKSI MAHYA
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBuktiUrl(null)}
                  className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-lg transition-colors cursor-pointer text-xs font-bold"
                >
                  TUTUP
                </button>
              </div>

              {/* Image Preview Container */}
              <div className="p-5 flex justify-center bg-slate-950 border-b border-slate-100 max-h-[400px] overflow-auto">
                <img
                  src={selectedBuktiUrl}
                  alt="Bukti Transaksi"
                  className="max-w-full max-h-[350px] object-contain rounded-lg shadow-md"
                />
              </div>

              {/* Controls */}
              <div className="px-5 py-3.5 bg-slate-50 flex justify-between items-center gap-4">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  MAHYA APPAREL FINANCE
                </p>
                <div className="flex gap-2">
                  <a
                    href={selectedBuktiUrl}
                    download="bukti-transaksi-mahya.jpg"
                    className="bg-slate-950 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Unduh Bukti
                  </a>
                  <button
                    type="button"
                    onClick={() => setSelectedBuktiUrl(null)}
                    className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL KASIR / INVOICE KAOS POLOS (INTER-DIVISI) */}
      <AnimatePresence>
        {isKasirModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="max-w-xl w-full bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col my-auto relative"
            >
              {/* Header Modal */}
              <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-400/20 text-amber-300 rounded-xl border border-amber-400/30">
                    <ShoppingCart className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">Kasir / Invoice Kaos Polos</h2>
                      <span className="bg-amber-400 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full font-mono">
                        INTER-DIVISI
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">Pembelian Kaos Polos oleh Divisi Sablon dari Divisi Konveksi</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsKasirModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Banner Info Alur Otomatis */}
              <div className="bg-indigo-50 border-b border-indigo-100 p-4">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 gap-2 bg-white p-3 rounded-2xl border border-indigo-100 shadow-2xs">
                  <div className="flex items-center gap-2 text-rose-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                    <span>Divisi Sablon</span>
                    <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-mono font-extrabold">Pengeluaran 🔴</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
                  <div className="flex items-center gap-2 text-emerald-700">
                    <span>Divisi Konveksi</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-extrabold">Pemasukan 🟢</span>
                  </div>
                </div>
                <p className="text-[10px] text-indigo-900/70 font-medium text-center mt-2">
                  ✨ Transaksi ini akan mencatat <strong>Pemasukan Konveksi</strong> &amp; <strong>Pengeluaran Sablon</strong> secara otomatis.
                </p>
              </div>

              {/* Form Input Kasir */}
              <form onSubmit={handleProcessKasirKaosPolos} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* No Invoice */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block ml-1 mb-1">
                      No. Invoice / Referensi
                    </label>
                    <input
                      type="text"
                      required
                      value={kasirInvoiceNo}
                      onChange={(e) => setKasirInvoiceNo(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                    />
                  </div>

                  {/* Tanggal */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block ml-1 mb-1">
                      Tanggal Transaksi
                    </label>
                    <input
                      type="date"
                      required
                      value={kasirDate}
                      onChange={(e) => setKasirDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                    />
                  </div>
                </div>

                {/* Rincian Ukuran & Lengan (Dewasa & Anak-Anak) */}
                <div className="border border-slate-200 rounded-2xl bg-slate-50/70 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wide">Rincian Ukuran &amp; Lengan</span>
                      <span className="text-[9.5px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.2 rounded font-mono">
                        Pendek &amp; Panjang
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetKasirSizes}
                      className="text-[9.5px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded-md transition-all cursor-pointer"
                    >
                      Reset Inputs
                    </button>
                  </div>

                  {/* Category Tabs: Dewasa vs Anak-Anak */}
                  <div className="flex bg-slate-200 p-1 rounded-xl gap-1">
                    <button
                      type="button"
                      onClick={() => setKasirCategoryTab('dewasa')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        kasirCategoryTab === 'dewasa'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>👕 Dewasa</span>
                      <span className="text-[9px] font-mono bg-white/20 px-1.5 py-0.2 rounded-full font-extrabold">
                        {Object.values(kasirSizes.dewasa).reduce((sum, item) => sum + (item.pendek || 0) + (item.panjang || 0), 0)} pcs
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setKasirCategoryTab('anak')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        kasirCategoryTab === 'anak'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>👶 Anak-Anak</span>
                      <span className="text-[9px] font-mono bg-white/20 px-1.5 py-0.2 rounded-full font-extrabold">
                        {Object.values(kasirSizes.anak).reduce((sum, item) => sum + (item.pendek || 0) + (item.panjang || 0), 0)} pcs
                      </span>
                    </button>
                  </div>

                  {/* Grid Size Inputs */}
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {kasirCategoryTab === 'dewasa' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Object.keys(kasirSizes.dewasa).map((size) => {
                          const item = kasirSizes.dewasa[size];
                          const subtotal = (item.pendek || 0) + (item.panjang || 0);
                          return (
                            <div key={size} className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs flex flex-col gap-1.5">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                                <span className="text-xs font-black text-slate-800 font-mono">Ukuran {size}</span>
                                {subtotal > 0 && (
                                  <span className="text-[9px] font-mono font-black bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded">
                                    Subtotal: {subtotal} pcs
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {/* Lengan Pendek */}
                                <div>
                                  <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Lengan Pendek</label>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleKasirSizeChange('dewasa', size, 'pendek', (item.pendek || 0) - 1)}
                                      className="w-5 h-5 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold cursor-pointer shrink-0"
                                    >-</button>
                                    <input
                                      type="number"
                                      min="0"
                                      value={item.pendek || ''}
                                      onChange={(e) => handleKasirSizeChange('dewasa', size, 'pendek', parseInt(e.target.value, 10))}
                                      placeholder="0"
                                      className="w-full text-center bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-xs font-bold font-mono focus:outline-hidden focus:bg-white focus:border-indigo-500"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleKasirSizeChange('dewasa', size, 'pendek', (item.pendek || 0) + 1)}
                                      className="w-5 h-5 flex items-center justify-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-bold cursor-pointer shrink-0"
                                    >+</button>
                                  </div>
                                </div>

                                {/* Lengan Panjang */}
                                <div>
                                  <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Lengan Panjang</label>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleKasirSizeChange('dewasa', size, 'panjang', (item.panjang || 0) - 1)}
                                      className="w-5 h-5 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold cursor-pointer shrink-0"
                                    >-</button>
                                    <input
                                      type="number"
                                      min="0"
                                      value={item.panjang || ''}
                                      onChange={(e) => handleKasirSizeChange('dewasa', size, 'panjang', parseInt(e.target.value, 10))}
                                      placeholder="0"
                                      className="w-full text-center bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-xs font-bold font-mono focus:outline-hidden focus:bg-white focus:border-indigo-500"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleKasirSizeChange('dewasa', size, 'panjang', (item.panjang || 0) + 1)}
                                      className="w-5 h-5 flex items-center justify-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-bold cursor-pointer shrink-0"
                                    >+</button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Object.keys(kasirSizes.anak).map((size) => {
                          const item = kasirSizes.anak[size];
                          const subtotal = (item.pendek || 0) + (item.panjang || 0);
                          return (
                            <div key={size} className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs flex flex-col gap-1.5">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                                <span className="text-xs font-black text-slate-800 font-mono">Ukuran {size}</span>
                                {subtotal > 0 && (
                                  <span className="text-[9px] font-mono font-black bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded">
                                    Subtotal: {subtotal} pcs
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {/* Lengan Pendek */}
                                <div>
                                  <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Lengan Pendek</label>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleKasirSizeChange('anak', size, 'pendek', (item.pendek || 0) - 1)}
                                      className="w-5 h-5 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold cursor-pointer shrink-0"
                                    >-</button>
                                    <input
                                      type="number"
                                      min="0"
                                      value={item.pendek || ''}
                                      onChange={(e) => handleKasirSizeChange('anak', size, 'pendek', parseInt(e.target.value, 10))}
                                      placeholder="0"
                                      className="w-full text-center bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-xs font-bold font-mono focus:outline-hidden focus:bg-white focus:border-indigo-500"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleKasirSizeChange('anak', size, 'pendek', (item.pendek || 0) + 1)}
                                      className="w-5 h-5 flex items-center justify-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-bold cursor-pointer shrink-0"
                                    >+</button>
                                  </div>
                                </div>

                                {/* Lengan Panjang */}
                                <div>
                                  <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Lengan Panjang</label>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleKasirSizeChange('anak', size, 'panjang', (item.panjang || 0) - 1)}
                                      className="w-5 h-5 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold cursor-pointer shrink-0"
                                    >-</button>
                                    <input
                                      type="number"
                                      min="0"
                                      value={item.panjang || ''}
                                      onChange={(e) => handleKasirSizeChange('anak', size, 'panjang', parseInt(e.target.value, 10))}
                                      placeholder="0"
                                      className="w-full text-center bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-xs font-bold font-mono focus:outline-hidden focus:bg-white focus:border-indigo-500"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleKasirSizeChange('anak', size, 'panjang', (item.panjang || 0) + 1)}
                                      className="w-5 h-5 flex items-center justify-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-bold cursor-pointer shrink-0"
                                    >+</button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Pengaturan Harga per Kategori & Lengan */}
                <div className="border border-indigo-100 rounded-2xl bg-indigo-50/50 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-950 uppercase tracking-wide flex items-center gap-1.5">
                      ⚙️ Pengaturan Daftar Harga Kaos Polos
                    </span>
                    <span className="text-[9px] font-mono font-bold bg-indigo-200/80 text-indigo-900 px-2 py-0.5 rounded-full">
                      Otomatis Dihitung
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    {/* Dewasa Standar */}
                    <div className="bg-white p-2 rounded-xl border border-indigo-100 shadow-2xs">
                      <label className="text-[9px] font-bold text-slate-600 block mb-1">Dewasa XS-XL (Pdk)</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">Rp</span>
                        <input
                          type="number"
                          min="0"
                          step="500"
                          value={kasirTierPrices.dewasaStandar || ''}
                          onChange={(e) => handleKasirTierPriceChange('dewasaStandar', parseInt(e.target.value, 10))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-1.5 py-1 text-xs font-mono font-bold focus:outline-hidden focus:bg-white focus:border-indigo-500 text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Dewasa Jumbo (XXL - 3XL) */}
                    <div className="bg-white p-2 rounded-xl border border-indigo-100 shadow-2xs">
                      <label className="text-[9px] font-bold text-amber-700 block mb-1">Jumbo XXL-3XL (Pdk)</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">Rp</span>
                        <input
                          type="number"
                          min="0"
                          step="500"
                          value={kasirTierPrices.dewasaJumbo || ''}
                          onChange={(e) => handleKasirTierPriceChange('dewasaJumbo', parseInt(e.target.value, 10))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-1.5 py-1 text-xs font-mono font-bold focus:outline-hidden focus:bg-white focus:border-indigo-500 text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Big Size 4XL - 6XL */}
                    <div className="bg-white p-2 rounded-xl border border-purple-100 shadow-2xs">
                      <label className="text-[9px] font-bold text-purple-700 block mb-1">Big Size 4XL+ (Pdk)</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">Rp</span>
                        <input
                          type="number"
                          min="0"
                          step="500"
                          value={kasirTierPrices.dewasaBigSize || ''}
                          onChange={(e) => handleKasirTierPriceChange('dewasaBigSize', parseInt(e.target.value, 10))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-1.5 py-1 text-xs font-mono font-bold focus:outline-hidden focus:bg-white focus:border-indigo-500 text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Anak-Anak */}
                    <div className="bg-white p-2 rounded-xl border border-indigo-100 shadow-2xs">
                      <label className="text-[9px] font-bold text-emerald-700 block mb-1">Anak-Anak (Pdk)</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">Rp</span>
                        <input
                          type="number"
                          min="0"
                          step="500"
                          value={kasirTierPrices.anak || ''}
                          onChange={(e) => handleKasirTierPriceChange('anak', parseInt(e.target.value, 10))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-1.5 py-1 text-xs font-mono font-bold focus:outline-hidden focus:bg-white focus:border-indigo-500 text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Biaya Tambahan Lengan Panjang */}
                    <div className="bg-white p-2 rounded-xl border border-indigo-100 shadow-2xs">
                      <label className="text-[9px] font-bold text-indigo-700 block mb-1">+ Lengan Panjang</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">Rp</span>
                        <input
                          type="number"
                          min="0"
                          step="500"
                          value={kasirTierPrices.lenganPanjangSurcharge || ''}
                          onChange={(e) => handleKasirTierPriceChange('lenganPanjangSurcharge', parseInt(e.target.value, 10))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-1.5 py-1 text-xs font-mono font-bold focus:outline-hidden focus:bg-white focus:border-indigo-500 text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ringkasan Total & Live Calculation */}
                {(() => {
                  const bd = calculateKasirBreakdown();
                  const totalPcs = bd.lineItems.length > 0 ? bd.totalPcs : (parseInt(kasirQty, 10) || 0);
                  const totalNominal = bd.lineItems.length > 0 ? bd.totalNominal : (totalPcs * (parseFloat(kasirPrice) || 0));
                  return (
                    <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                            Total Nilai Invoice Inter-Divisi
                          </span>
                          <p className="text-[11px] text-slate-400 font-medium mt-0.5 font-mono">
                            {totalPcs} Pcs Kaos Total
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xl sm:text-2xl font-black font-mono text-amber-300">
                            {formatCurrency(totalNominal)}
                          </span>
                        </div>
                      </div>

                      {bd.lineItems.length > 0 && (
                        <div className="pt-2 border-t border-slate-800/80 text-[10px] space-y-1 max-h-28 overflow-y-auto pr-1">
                          {bd.lineItems.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-slate-300 font-mono">
                              <span className="truncate pr-2">• {item.label} ({item.qty} pcs × {formatCurrency(item.unitPrice, false)})</span>
                              <span className="font-bold text-amber-300/90 shrink-0">{formatCurrency(item.subtotal)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Rincian Keterangan */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block ml-1 mb-1">
                    Detail / Rincian Kaos Polos
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Contoh: Kaos Polos Cotton Combed 30s Hitam (S:5, M:10, L:10, XL:5)"
                    value={kasirDescription}
                    onChange={(e) => setKasirDescription(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-all text-slate-800 resize-none"
                  />
                </div>

                {/* Bukti Transaksi / Resi (Upload) */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block ml-1 mb-1">
                    Upload Bukti / Nota Pembelian (Opsional)
                  </label>
                  {kasirBukti ? (
                    <div className="relative border border-slate-200 rounded-xl p-2 bg-slate-50 flex items-center gap-3">
                      <img src={kasirBukti} alt="Bukti" className="h-12 w-12 object-cover rounded-lg border border-slate-200 bg-white" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-extrabold text-slate-700 truncate">Bukti Nota Terlampir</p>
                        <p className="text-[9.5px] text-emerald-600 font-bold flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Berhasil dimuat</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setKasirBukti('')}
                        className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-rose-600 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => setKasirBukti(ev.target?.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-3 bg-slate-50 hover:bg-indigo-50/20 text-center transition-all cursor-pointer"
                      onClick={() => document.getElementById('kasir-bukti-input')?.click()}
                    >
                      <input
                        id="kasir-bukti-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => setKasirBukti(ev.target?.result as string);
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <Paperclip className="h-4 w-4 text-slate-400 mx-auto mb-1" />
                      <p className="text-[10px] font-bold text-slate-600">Klik / Seret Gambar Nota Kasir</p>
                    </div>
                  )}
                </div>

                {/* Submit Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsKasirModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-md flex items-center gap-1.5"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>Proses &amp; Catat Transaksi Dual</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL PRINT PREVIEW NOTA / INVOICE KAOS POLOS */}
      <AnimatePresence>
        {invoiceToPrint && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 relative overflow-hidden my-auto"
            >
              {/* Header Invoice */}
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-slate-900 text-white rounded-lg">
                      <Receipt className="h-4 w-4" />
                    </div>
                    <span className="text-base font-black tracking-tight text-slate-900">MAHYA APPAREL</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                    Nota Pembelian Kaos Polos Inter-Divisi
                  </p>
                </div>
                <div className="text-right">
                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[9px] font-black px-2 py-0.5 rounded font-mono block">
                    LUNAS
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-500 mt-1 block">
                    #{invoiceToPrint.invoiceNo}
                  </span>
                </div>
              </div>

              {/* Detail Pihak Transaksi */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200 mb-4 font-medium">
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Penjual (Pemasukan 🟢)</span>
                  <strong className="text-indigo-900 font-bold">Divisi Konveksi</strong>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Pembeli (Pengeluaran 🔴)</span>
                  <strong className="text-rose-900 font-bold">Divisi Sablon</strong>
                </div>
                <div className="col-span-2 pt-1.5 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between">
                  <span>Tanggal: <strong>{invoiceToPrint.date}</strong></span>
                  <span>Otomatis Masuk Ledger</span>
                </div>
              </div>

              {/* Tabel Item Rincian */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden mb-4">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900 text-white text-[10px] uppercase font-bold">
                    <tr>
                      <th className="p-2.5 pl-3">Item / Rincian</th>
                      <th className="p-2.5 text-center">Qty</th>
                      <th className="p-2.5 text-right pr-3">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {invoiceToPrint.lineItems && invoiceToPrint.lineItems.length > 0 ? (
                      invoiceToPrint.lineItems.map((item, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5 pl-3">
                            <div className="font-bold text-slate-800 text-xs">{item.label}</div>
                            <div className="text-[9.5px] text-slate-400 font-mono">@ {formatCurrency(item.unitPrice)} / Pcs</div>
                          </td>
                          <td className="p-2.5 text-center font-bold text-slate-700 font-mono text-xs">
                            {item.qty} Pcs
                          </td>
                          <td className="p-2.5 text-right pr-3 font-bold font-mono text-slate-900 text-xs">
                            {formatCurrency(item.subtotal)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="p-2.5 pl-3">
                          <div className="font-bold text-slate-800">Kaos Polos</div>
                          <div className="text-[10px] text-slate-500 leading-tight">{invoiceToPrint.description}</div>
                          <div className="text-[9.5px] text-slate-400 font-mono mt-0.5">@ {formatCurrency(invoiceToPrint.price)} / Pcs</div>
                        </td>
                        <td className="p-2.5 text-center font-bold text-slate-700 font-mono">
                          {invoiceToPrint.qty} Pcs
                        </td>
                        <td className="p-2.5 text-right pr-3 font-bold font-mono text-slate-900">
                          {formatCurrency(invoiceToPrint.total)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Grand Total Display */}
              <div className="bg-slate-900 text-white rounded-2xl p-3.5 mb-5 flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">TOTAL NOTA</span>
                <span className="text-xl font-mono font-black text-amber-400">{formatCurrency(invoiceToPrint.total)}</span>
              </div>

              {/* Actions Button */}
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                >
                  <Printer className="h-4 w-4 text-amber-300" />
                  <span>Cetak / Simpan PDF</span>
                </button>
                <button
                  onClick={() => setInvoiceToPrint(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
