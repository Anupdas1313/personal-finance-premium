import { db } from '../models/db';
import { useLiveQuery } from 'dexie-react-hooks';

export function useCurrency() {
  const currencySetting = useLiveQuery(
    () => db.userSettings.where('key').equals('currency').first()
  );

  return currencySetting?.value || '$';
}
