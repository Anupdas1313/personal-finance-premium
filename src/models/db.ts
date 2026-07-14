import Dexie, { Table } from 'dexie';

export interface Account {
  id?: number;
  bankName: string;
  accountLast4: string;
  startingBalance: number;
  startingBalanceDate?: Date;
  type?: 'BANK' | 'CASH' | 'CREDIT_CARD';
  creditLimit?: number;
  statementDate?: number;
  dueDate?: number;
  sortOrder?: number;
}

export interface Category {
  id?: number;
  name: string;
  sortOrder?: number;
}

export interface Tag {
  id?: number;
  name: string;
  sortOrder?: number;
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
  linkedBudgetId?: number;
}

export interface Budget {
  id?: number;
  category: string;
  amount: number;
  month: string; // 'YYYY-MM'
  type?: 'ENVELOPE' | 'CUSTOM';
}

export interface MonthlyBudget {
  id?: number;
  month: string; // 'YYYY-MM'
  totalAmount: number;
  linkedAccountIds?: number[];
  linkedTags?: string[];
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

export interface WishlistItem {
  id?: number;
  name: string;
  price: number;
  link?: string;
  priority: number;
  status: 'ACTIVE' | 'BOUGHT' | 'ELIMINATED';
  dateAdded: Date;
  dateResolved?: Date;
}

export interface InventoryItem {
  id?: number;
  name: string;
  sku: string;
  stockQuantity: number;
  costPrice: number;
  sellingPrice: number;
  lastUpdated: Date;
}

export interface Sale {
  id?: number;
  customerId: number;
  date: Date;
  totalAmount: number;
  status: 'PENDING' | 'PAID';
  paymentMethod?: 'Cash' | 'Bank' | 'UPI' | 'Other';
  note?: string;
}

export interface SaleItem {
  id?: number;
  saleId: number;
  skuId: number;
  quantity: number;
  unitPrice: number;
  total: number;
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
  wishlist!: Table<WishlistItem, number>;
  monthlyBudgets!: Table<MonthlyBudget, number>;
  inventory!: Table<InventoryItem, number>;
  sales!: Table<Sale, number>;
  saleItems!: Table<SaleItem, number>;

  constructor(dbName: string = 'FinanceDatabase_Local_PERSONAL') {
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
    this.version(15).stores({
      accounts: '++id, bankName, accountLast4',
      transactions: '++id, accountId, type, dateTime, category, linkedBudgetId',
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

    this.version(16).stores({
      accounts: '++id, bankName, accountLast4',
      transactions: '++id, accountId, type, dateTime, category, linkedBudgetId',
      monthlyClosings: '++id, &month',
      budgets: '++id, category, month, [category+month]',
      parties: '++id, name, type',
      ledgerTransactions: '++id, partyId, type, dateTime',
      accountClosings: '++id, accountId, closingDate',
      categories: '++id, &name',
      tags: '++id, &name',
      recurringTemplates: '++id, nextRunDate, isActive',
      userSettings: '++id, &key',
      wishlist: '++id, name, price, status, dateAdded'
    });

    this.version(17).stores({
      accounts: '++id, bankName, accountLast4',
      transactions: '++id, accountId, type, dateTime, category, linkedBudgetId',
      monthlyClosings: '++id, &month',
      budgets: '++id, category, month, [category+month]',
      parties: '++id, name, type',
      ledgerTransactions: '++id, partyId, type, dateTime',
      accountClosings: '++id, accountId, closingDate',
      categories: '++id, &name',
      tags: '++id, &name',
      recurringTemplates: '++id, nextRunDate, isActive',
      userSettings: '++id, &key',
      wishlist: '++id, name, price, status, dateAdded',
      monthlyBudgets: '++id, &month'
    });

    this.version(18).stores({
      accounts: '++id, bankName, accountLast4',
      transactions: '++id, accountId, type, dateTime, category, linkedBudgetId',
      monthlyClosings: '++id, &month',
      budgets: '++id, category, month, [category+month]',
      parties: '++id, name, type',
      ledgerTransactions: '++id, partyId, type, dateTime',
      accountClosings: '++id, accountId, closingDate',
      categories: '++id, &name',
      tags: '++id, &name',
      recurringTemplates: '++id, nextRunDate, isActive',
      userSettings: '++id, &key',
      wishlist: '++id, name, price, status, dateAdded',
      monthlyBudgets: '++id, &month',
      inventory: '++id, sku',
      sales: '++id, customerId, status, date',
      saleItems: '++id, saleId, skuId'
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
let activeDB: FinanceDatabase = new FinanceDatabase('FinanceDatabase_Local_PERSONAL');
let currentDBName: string = 'FinanceDatabase_Local_PERSONAL';

export const initializeDB = (uid: string | null, mode: 'PERSONAL' | 'BUSINESS' = 'PERSONAL') => {
  const dbName = uid ? `FinanceDB_${uid}_${mode}` : `FinanceDatabase_Local_${mode}`;

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

