import Dexie, { Table } from 'dexie';

export interface Account {
  id?: number;
  bankName: string;
  accountLast4: string;
  startingBalance: number;
  startingBalanceDate?: Date;
  type?: 'BANK' | 'CASH' | 'CREDIT_CARD';
}

export interface Transaction {
  id?: number;
  accountId: number;
  amount: number;
  type: 'DEBIT' | 'CREDIT' | 'TRANSFER';
  dateTime: Date;
  note: string;
  category: string;
  balanceAfterTransaction?: number;
  paymentMethod?: 'Bank' | 'UPI' | 'Credit Card' | 'Cash' | 'Bank Transfer';
  upiApp?: string;
  party?: string;
  isPersonalExpense?: boolean;
  expenseType?: string;
}

export interface Budget {
  id?: number;
  category: string;
  amount: number;
  month: string; // 'YYYY-MM'
}

export interface MonthlyClose {
  id?: number;
  month: string; // 'YYYY-MM'
  closedAt: Date;
  accountBalances: Record<number, number>;
  totalIncome: number;
  totalExpense: number;
  closingBalance: number;
}

export interface Party {
  id?: number;
  name: string;
  phoneNumber?: string;
  type: 'CUSTOMER' | 'SUPPLIER' | 'FRIEND';
  createdAt: Date;
  updatedAt: Date;
}

export interface LedgerTransaction {
  id?: number;
  partyId: number;
  amount: number;
  type: 'CASH_IN' | 'CASH_OUT';
  dateTime: Date;
  remarks?: string;
  attachmentUrl?: string;
}

export interface AccountClosing {
  id?: number;
  accountId: number;
  closingDate: Date;
  closingBalance: number;
  periodName: string; 
  openingBalance: number;
  totalInflow: number;
  totalOutflow: number;
  chapterNote?: string;
}

export class FinanceDatabase extends Dexie {
  accounts!: Table<Account, number>;
  transactions!: Table<Transaction, number>;
  monthlyClosings!: Table<MonthlyClose, number>;
  budgets!: Table<Budget, number>;
  parties!: Table<Party, number>;
  ledgerTransactions!: Table<LedgerTransaction, number>;
  accountClosings!: Table<AccountClosing, number>;

  constructor() {
    super('FinanceDatabase');
    this.version(1).stores({
      accounts: '++id, bankName, accountLast4',
      transactions: '++id, accountId, type, dateTime, category'
    });
    this.version(2).stores({
      monthlyClosings: '++id, &month'
    });
    this.version(3).stores({
      budgets: '++id, category, month, [category+month]'
    });
    this.version(4).stores({
      trips: '++id, name, status',
      tripMembers: '++id, tripId',
      tripTransactions: '++id, tripId, paidByMemberId',
      tripSplits: '++id, tripTransactionId, memberId'
    });
    this.version(5).stores({
      trips: '++id, name, status',
      tripMembers: '++id, tripId',
      tripTransactions: '++id, tripId, paidByMemberId',
      tripSplits: '++id, tripTransactionId, memberId'
    });
    this.version(6).stores({
      trips: null,
      tripMembers: null,
      tripTransactions: null,
      tripSplits: null
    });
    this.version(7).stores({
      parties: '++id, name, type',
      ledgerTransactions: '++id, partyId, type, dateTime'
    });
    this.version(8).stores({
      accountClosings: '++id, accountId, closingDate'
    });
  }
}



export const db = new FinanceDatabase();
