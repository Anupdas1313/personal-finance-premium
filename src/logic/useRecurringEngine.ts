import { useEffect } from 'react';
import { db } from '../models/db';
import { addDays, addMonths, addWeeks, addYears, isBefore, isEqual, startOfDay } from 'date-fns';

export function useRecurringEngine(uid?: string | null) {
  useEffect(() => {
    // Only run if the user is authenticated (uid exists)
    if (!uid) return;

    const processRecurring = async () => {
      try {
        const templates = await db.recurringTemplates.where('isActive').equals('true').toArray();
        const activeTemplates = templates.filter(t => t.isActive); // Dexie sometimes returns booleans as true/false or 1/0, fallback filter
        const today = startOfDay(new Date());

        for (const template of activeTemplates) {
          let runDate = startOfDay(new Date(template.nextRunDate));
          let executed = false;

          // While the nextRunDate is today or in the past, process it
          while (isBefore(runDate, today) || isEqual(runDate, today)) {
            // 1. Insert Transaction
            await db.transactions.add({
              accountId: template.accountId,
              amount: template.amount,
              type: template.type,
              dateTime: new Date(runDate.setHours(10, 0, 0, 0)), // default to 10 AM
              category: template.category,
              note: `[Auto-Logged] ${template.note}`,
              paymentMethod: template.paymentMethod || 'Bank',
              toAccountId: template.toAccountId,
            });

            // 2. Advance nextRunDate
            if (template.frequency === 'DAILY') runDate = addDays(runDate, 1);
            else if (template.frequency === 'WEEKLY') runDate = addWeeks(runDate, 1);
            else if (template.frequency === 'MONTHLY') runDate = addMonths(runDate, 1);
            else if (template.frequency === 'YEARLY') runDate = addYears(runDate, 1);
            
            executed = true;
          }

          if (executed) {
            // 3. Update template in DB
            await db.recurringTemplates.update(template.id!, { nextRunDate: runDate });
          }
        }
      } catch (err) {
        console.error('Error processing recurring transactions:', err);
      }
    };

    // Run immediately on mount
    processRecurring();
    
    // Check periodically every 12 hours if the app stays open
    const interval = setInterval(processRecurring, 12 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [uid]);
}
