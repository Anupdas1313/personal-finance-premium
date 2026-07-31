import { format, subDays, startOfMonth } from 'date-fns';
import { FinanceDatabase } from '../models/db';

export async function seedDemoData(db: FinanceDatabase) {
  // Clear any existing demo data to ensure a fresh demo state
  await db.accounts.clear();
  await db.transactions.clear();
  await db.budgets.clear();
  await db.monthlyBudgets.clear();
  await db.categories.clear();
  await db.tags.clear();
  await db.upiApps.clear();

  // 1. Setup default categories
  const categories = [
    { name: 'Food & Dining', sortOrder: 0 },
    { name: 'Shopping', sortOrder: 1 },
    { name: 'Transportation', sortOrder: 2 },
    { name: 'Bills & Utilities', sortOrder: 3 },
    { name: 'Entertainment', sortOrder: 4 },
    { name: 'Income', sortOrder: 5 },
    { name: 'Other', sortOrder: 6 }
  ];
  await db.categories.bulkAdd(categories);

  // 2. Setup default tags
  const tags = [
    { name: 'Needs', sortOrder: 0 },
    { name: 'Wants', sortOrder: 1 },
    { name: 'Investments', sortOrder: 2 }
  ];
  await db.tags.bulkAdd(tags);

  // 3. Setup default accounts
  const hdfcId = await db.accounts.add({
    bankName: 'HDFC Bank Savings',
    accountLast4: '4821',
    startingBalance: 45000,
    startingBalanceDate: startOfMonth(new Date()),
    type: 'BANK'
  });

  const sbiCardId = await db.accounts.add({
    bankName: 'SBI Card Elite',
    accountLast4: '9840',
    startingBalance: -12500, // outstanding balance represented as negative
    startingBalanceDate: startOfMonth(new Date()),
    type: 'CREDIT_CARD',
    creditLimit: 150000,
    statementDate: 15,
    dueDate: 5
  });

  const cashId = await db.accounts.add({
    bankName: 'Cash Wallet',
    accountLast4: '',
    startingBalance: 2400,
    startingBalanceDate: startOfMonth(new Date()),
    type: 'CASH'
  });

  // 4. Setup budget pool & envelopes for the current month
  const currentMonthStr = format(new Date(), 'yyyy-MM');
  
  await db.monthlyBudgets.add({
    month: currentMonthStr,
    totalAmount: 40000,
    linkedAccountIds: [hdfcId, sbiCardId, cashId],
    linkedTags: ['Needs', 'Wants']
  });

  const envBudgets = [
    { month: currentMonthStr, category: 'Food & Dining', amount: 12000, type: 'ENVELOPE' },
    { month: currentMonthStr, category: 'Shopping', amount: 8000, type: 'ENVELOPE' },
    { month: currentMonthStr, category: 'Transportation', amount: 5000, type: 'ENVELOPE' },
    { month: currentMonthStr, category: 'Bills & Utilities', amount: 10000, type: 'ENVELOPE' }
  ];
  await db.budgets.bulkAdd(envBudgets as any);

  // 5. Generate realistic transactions distributed over the past few days
  const today = new Date();
  
  const txs = [
    // Salary Credit (HDFC)
    {
      accountId: hdfcId,
      type: 'CREDIT',
      dateTime: subDays(today, 12).toISOString(),
      category: 'Income',
      amount: 65000,
      note: 'Monthly salary credit',
      party: 'Acme Corp Pvt Ltd',
      paymentMethod: 'Bank Transfer'
    },
    // Rent debit (HDFC)
    {
      accountId: hdfcId,
      type: 'DEBIT',
      dateTime: subDays(today, 10).toISOString(),
      category: 'Bills & Utilities',
      amount: 18000,
      note: 'House rent',
      party: 'Landlord House Rent',
      paymentMethod: 'Bank Transfer',
      expenseType: 'Needs'
    },
    // Electricity bill (SBI Card)
    {
      accountId: sbiCardId,
      type: 'DEBIT',
      dateTime: subDays(today, 8).toISOString(),
      category: 'Bills & Utilities',
      amount: 3200,
      note: 'Monthly electricity bill',
      party: 'State Electricity Board',
      paymentMethod: 'Credit Card',
      expenseType: 'Needs'
    },
    // Dining at restaurant (SBI Card)
    {
      accountId: sbiCardId,
      type: 'DEBIT',
      dateTime: subDays(today, 6).toISOString(),
      category: 'Food & Dining',
      amount: 2450,
      note: 'Weekend dinner with family',
      party: 'The Spice Grill',
      paymentMethod: 'Credit Card',
      expenseType: 'Wants'
    },
    // Coffee run (Cash)
    {
      accountId: cashId,
      type: 'DEBIT',
      dateTime: subDays(today, 5).toISOString(),
      category: 'Food & Dining',
      amount: 380,
      note: 'Iced Latte',
      party: 'Starbucks Coffee',
      paymentMethod: 'Cash',
      expenseType: 'Wants'
    },
    // Supermarket groceries (HDFC with UPI)
    {
      accountId: hdfcId,
      type: 'DEBIT',
      dateTime: subDays(today, 4).toISOString(),
      category: 'Food & Dining',
      amount: 1890,
      note: 'Weekly essentials and groceries',
      party: 'DMart Supermarket',
      paymentMethod: 'PhonePe',
      expenseType: 'Needs'
    },
    // Fuel refills (SBI Card)
    {
      accountId: sbiCardId,
      type: 'DEBIT',
      dateTime: subDays(today, 3).toISOString(),
      category: 'Transportation',
      amount: 1500,
      note: 'Petrol refill',
      party: 'Indian Oil Fuel Pump',
      paymentMethod: 'Credit Card',
      expenseType: 'Needs'
    },
    // Online Shopping delivery (SBI Card)
    {
      accountId: sbiCardId,
      type: 'DEBIT',
      dateTime: subDays(today, 2).toISOString(),
      category: 'Shopping',
      amount: 4200,
      note: 'Noise-canceling earphones',
      party: 'Amazon Pay',
      paymentMethod: 'Amazon Pay',
      expenseType: 'Wants'
    },
    // Casual street food (Cash)
    {
      accountId: cashId,
      type: 'DEBIT',
      dateTime: subDays(today, 1).toISOString(),
      category: 'Food & Dining',
      amount: 250,
      note: 'Evening snacks',
      party: 'Chaats & More',
      paymentMethod: 'Cash',
      expenseType: 'Wants'
    },
    // Transfer from Bank to Cash (ATM Withdrawal)
    {
      accountId: hdfcId,
      type: 'TRANSFER',
      dateTime: subDays(today, 5).toISOString(),
      category: 'Transfer',
      amount: 2000,
      note: 'ATM cash withdrawal',
      party: 'ATM Cash Withdrawal',
      paymentMethod: 'Cash',
      toAccountId: cashId
    }
  ];

  await db.transactions.bulkAdd(txs as any);
}
