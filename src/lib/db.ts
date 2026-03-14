import Dexie, { Table } from 'dexie';

export interface Account {
  id?: number;
  bankName: string;
  accountLast4: string;
  startingBalance: number;
}

export interface Transaction {
  id?: number;
  accountId: number;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
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

export class FinanceDatabase extends Dexie {
  accounts!: Table<Account, number>;
  transactions!: Table<Transaction, number>;
  monthlyClosings!: Table<MonthlyClose, number>;
  budgets!: Table<Budget, number>;

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
  }
}

export const db = new FinanceDatabase();
