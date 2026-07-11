import { db } from '../models/db';
import { useLiveQuery } from 'dexie-react-hooks';

export function useCurrency() {
  const currencySetting = useLiveQuery(
    () => db.userSettings.where('key').equals('currency').first()
  );

  return currencySetting?.value || '$';
}

export function useCurrencyFormatter() {
  const currency = useCurrency();
  const hideDecimalsSetting = useLiveQuery(
    () => db.userSettings.where('key').equals('hide_decimals').first()
  );
  const hideDecimals = hideDecimalsSetting?.value === true;

  const formatAmount = (amount: number | string | undefined | null) => {
    let num = 0;
    if (typeof amount === 'string') {
      num = parseFloat(amount);
    } else if (typeof amount === 'number') {
      num = amount;
    }
    if (isNaN(num) || num === undefined || num === null) num = 0;
    
    return `${currency}${num.toLocaleString('en-IN', {
      minimumFractionDigits: hideDecimals ? 0 : 2,
      maximumFractionDigits: hideDecimals ? 0 : 2
    })}`;
  };

  return { currency, hideDecimals, formatAmount };
}
