export interface ParsedSMS {
  amount: number | null;
  type: 'DEBIT' | 'CREDIT' | null;
  accountLast4: string | null;
  balance: number | null;
  date: Date | null;
}

export function parseBankSMS(sms: string): ParsedSMS {
  const amountRegex = /(?:₹|Rs\.?|INR)\s?(\d+(?:,\d+)*(?:\.\d+)?)/i;
  const accountRegex = /(?:A\/c|Acct|Account)\s?X*(\d{3,4})/i;
  const balanceRegex = /(?:Bal(?:ance)?|Avl Bal|Available Balance)\s?(?:₹|Rs\.?|INR)?\s?(\d+(?:,\d+)*(?:\.\d+)?)/i;
  
  const debitKeywords = ['debited', 'spent', 'withdrawn', 'sent'];
  const creditKeywords = ['credited', 'received', 'deposited', 'refunded'];

  const lowerSms = sms.toLowerCase();
  
  let type: 'DEBIT' | 'CREDIT' | null = null;
  if (debitKeywords.some(kw => lowerSms.includes(kw))) {
    type = 'DEBIT';
  } else if (creditKeywords.some(kw => lowerSms.includes(kw))) {
    type = 'CREDIT';
  }

  const amountMatch = sms.match(amountRegex);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null;

  const accountMatch = sms.match(accountRegex);
  const accountLast4 = accountMatch ? accountMatch[1] : null;

  const balanceMatch = sms.match(balanceRegex);
  // If the first amount match is the same as the balance match, try to find another amount
  // This is a simple heuristic, real parsers might need more complex logic
  let balance = balanceMatch ? parseFloat(balanceMatch[1].replace(/,/g, '')) : null;
  
  if (balance === amount && balanceMatch && amountMatch && balanceMatch.index === amountMatch.index) {
      // The balance regex matched the transaction amount. Let's try to find another match for balance.
      const remainingSms = sms.substring((balanceMatch.index || 0) + balanceMatch[0].length);
      const secondBalanceMatch = remainingSms.match(balanceRegex);
      if (secondBalanceMatch) {
          balance = parseFloat(secondBalanceMatch[1].replace(/,/g, ''));
      } else {
          balance = null;
      }
  }

  const date = new Date();

  return { amount, type, accountLast4, balance, date };
}
