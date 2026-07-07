export type Division = 'Konveksi' | 'Sablon' | 'Aksesori' | 'Alat';
export type TransactionType = 'Pemasukan' | 'Pengeluaran';

export interface Transaction {
  id: string;
  date: string;
  division: Division;
  type: TransactionType;
  amount: number;
  description: string;
  buktiTransaksi?: string; // Base64 string for transaction proof / receipt image
}

export interface DivisionFinancials {
  income: number;
  expense: number;
  profit: number;
}

export interface ApprovalRequest {
  id: string;
  requestType: 'Hapus' | 'Edit';
  transactionId: string;
  transactionDesc: string;
  transactionAmount: number;
  transactionDivision: Division;
  requestedBy: string;
  requestedAt: string;
  status: 'Pending' | 'Disetujui' | 'Ditolak';
  newData?: {
    date: string;
    division: Division;
    type: TransactionType;
    amount: number;
    description: string;
    buktiTransaksi?: string;
  };
}

export interface AppUser {
  email: string;
  name: string;
  picture?: string;
  role: 'Owner' | 'Admin';
  lastLoginAt: string;
}


