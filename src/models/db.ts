import Dexie, { Table } from 'dexie';

export interface Account {
  id?: number;
  bankName: string;
  accountLast4: string;
  startingBalance: number;
  startingBalanceDate?: Date;
  type?: 'BANK' | 'CASH' | 'CREDIT_CARD';
}

export interface Category {
  id?: number;
  name: string;
}

export interface Tag {
  id?: number;
  name: string;
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
  linkedTransactionId?: number;
}

export interface Budget {
  id?: number;
  category: string;
  amount: number;
  month: string; // 'YYYY-MM'
}

export interface RecurringTemplate {
  id?: number;
  amount: number;
  type: 'DEBIT' | 'CREDIT' | 'TRANSFER';
  accountId: number;
  toAccountId?: number;
  category: string;
  note: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  nextRunDate: Date;
  isActive: boolean;
  paymentMethod?: 'Bank' | 'UPI' | 'Credit Card' | 'Cash' | 'Bank Transfer';
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

export interface UserSetting {
  id?: number;
  key: string;
  value: any;
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
}

export class FinanceDatabase extends Dexie {
  accounts!: Table<Account, number>;
  transactions!: Table<Transaction, number>;
  monthlyClosings!: Table<MonthlyClose, number>;
  budgets!: Table<Budget, number>;
  parties!: Table<Party, number>;
  ledgerTransactions!: Table<LedgerTransaction, number>;
  accountClosings!: Table<AccountClosing, number>;
  categories!: Table<Category, number>;
  tags!: Table<Tag, number>;
  recurringTemplates!: Table<RecurringTemplate, number>;
  userSettings!: Table<UserSetting, number>;

  constructor(dbName: string = 'FinanceDatabase_Local') {
    super(dbName);
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
    this.version(9).stores({
      accounts: '++id, bankName, accountLast4',
      transactions: '++id, accountId, type, dateTime, category'
    });
    this.version(10).stores({
      categories: '++id, &name',
      tags: '++id, &name'
    });
    this.version(11).stores({
      recurringTemplates: '++id, nextRunDate, isActive'
    });
    this.version(13).stores({
      accounts: '++id, bankName, accountLast4',
      transactions: '++id, accountId, type, dateTime, category',
      monthlyClosings: '++id, &month',
      budgets: '++id, category, month, [category+month]',
      parties: '++id, name, type',
      ledgerTransactions: '++id, partyId, type, dateTime',
      accountClosings: '++id, accountId, closingDate',
      categories: '++id, &name',
      tags: '++id, &name',
      recurringTemplates: '++id, nextRunDate, isActive'
    });
    this.version(14).stores({
      accounts: '++id, bankName, accountLast4',
      transactions: '++id, accountId, type, dateTime, category',
      monthlyClosings: '++id, &month',
      budgets: '++id, category, month, [category+month]',
      parties: '++id, name, type',
      ledgerTransactions: '++id, partyId, type, dateTime',
      accountClosings: '++id, accountId, closingDate',
      categories: '++id, &name',
      tags: '++id, &name',
      recurringTemplates: '++id, nextRunDate, isActive',
      userSettings: '++id, &key'
    });

    // Auto-generate globally unique numeric IDs for all tables to prevent sync collisions
    this.tables.forEach(table => {
      table.hook('creating', function (primKey, obj) {
        if (typeof primKey !== 'number' || primKey < 1000000000000) {
          const newId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
          obj.id = newId;
          return newId;
        }
      });
    });
  }
}

// Global db instance management
let activeDB: FinanceDatabase = new FinanceDatabase('FinanceDatabase_Local');
let currentDBName: string = 'FinanceDatabase_Local';

export const initializeDB = (uid: string | null) => {
  const dbName = uid ? `FinanceDB_${uid}` : 'FinanceDatabase_Local';

  // If already using the correct DB, skip re-init
  if (dbName === currentDBName && activeDB.isOpen()) {
    return activeDB;
  }

  // Close previous DB before switching
  if (activeDB.isOpen()) {
    activeDB.close();
  }

  activeDB = new FinanceDatabase(dbName);
  currentDBName = dbName;
  activeDB.open();
  return activeDB;
};

// Proxy to allow existing code to use 'db' export without changes
export const db = new Proxy({} as FinanceDatabase, {
  get(_, prop) {
    const target = activeDB as any;
    const value = target[prop];
    if (typeof value === 'function') {
      return value.bind(target);
    }
    return value;
  }
});

