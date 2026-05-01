import React, { createContext, useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { db } from '../models/db';

export type ReminderFrequency = 'daily' | 'twice_daily' | 'hourly' | 'test';
export type ReminderPosition = 'top' | 'center' | 'bottom';

interface ReminderSettings {
  enabled: boolean;
  frequency: ReminderFrequency;
  time: string; // HH:mm format
  position: ReminderPosition;
  lastTriggered: string | null;
}

interface ReminderContextType {
  settings: ReminderSettings;
  updateSettings: (newSettings: Partial<ReminderSettings>) => void;
  showBanner: boolean;
  setShowBanner: (show: boolean) => void;
}

const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: false,
  frequency: 'daily',
  time: '20:00',
  position: 'top',
  lastTriggered: null,
};

const ReminderContext = createContext<ReminderContextType | undefined>(undefined);

// Define action type for direct input in notifications
const ACTION_TYPE_ID = 'EXPENSE_DIRECT_ENTRY';

export const ReminderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<ReminderSettings>(() => {
    const saved = localStorage.getItem('expense_reminders');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    localStorage.setItem('expense_reminders', JSON.stringify(settings));
    if (Capacitor.isNativePlatform() && settings.enabled) {
      scheduleNativeReminders();
    }
  }, [settings]);

  // Initial setup for Native listeners
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      setupNativeNotifications();
    }
  }, []);

  const setupNativeNotifications = async () => {
    try {
      await LocalNotifications.requestPermissions();
      
      // Register the category for direct reply
      await LocalNotifications.registerActionTypes({
        types: [
          {
            id: ACTION_TYPE_ID,
            actions: [
              {
                id: 'add',
                title: 'Quick Add',
                input: true, // This enables the text input in the notification!
                inputPlaceholder: 'Amount Note (e.g. 50 Lunch)'
              },
              {
                id: 'dismiss',
                title: 'Dismiss',
                destructive: true
              }
            ]
          }
        ]
      });

      // Listen for the "Quick Add" action
      LocalNotifications.addListener('localNotificationActionPerformed', async (action) => {
        if (action.actionId === 'add' && action.inputValue) {
          await handleBackgroundEntry(action.inputValue);
        }
      });
    } catch (e) {
      console.error('Native notification setup failed:', e);
    }
  };

  const handleBackgroundEntry = async (text: string) => {
    // Simple parser: "50 Lunch" or "50 for coffee"
    const match = text.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
    if (!match) return;

    const amount = parseFloat(match[1]);
    const note = match[2].trim() || 'Quick Entry';

    const accounts = await db.accounts.toArray();
    const defaultAcc = accounts[0];
    if (!defaultAcc) return;

    await db.transactions.add({
      accountId: defaultAcc.id!,
      amount,
      type: 'DEBIT',
      dateTime: new Date(),
      note,
      category: 'Miscellaneous',
      paymentMethod: defaultAcc.type === 'CASH' ? 'Cash' : 'UPI',
      isPersonalExpense: true,
      expenseType: 'Personal'
    });
  };

  const scheduleNativeReminders = async () => {
    await LocalNotifications.cancel({ notifications: [{ id: 1 }] });
    
    const [hour, minute] = settings.time.split(':').map(Number);
    const schedule: any = {
      at: new Date(new Date().setHours(hour, minute, 0, 0)),
      repeats: true,
    };

    if (settings.frequency === 'hourly') {
      schedule.every = 'hour';
    } else if (settings.frequency === 'twice_daily') {
      // For twice daily we would ideally schedule two, but Capacitor simple repeats is daily
      // Keeping it simple for now
      schedule.every = 'day';
    } else {
      schedule.every = 'day';
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          title: 'Daily Expense Reminder',
          body: 'Tap to log your expenses or reply directly!',
          id: 1,
          schedule,
          actionTypeId: ACTION_TYPE_ID,
          smallIcon: 'ic_stat_name', // Needs to be in android res
          channelId: 'reminders'
        }
      ]
    });
  };

  const updateSettings = (newSettings: Partial<ReminderSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  useEffect(() => {
    if (!settings.enabled || Capacitor.isNativePlatform()) return;

    // Web-only logic
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const checkReminder = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const todayStr = now.toISOString().split('T')[0];

      let shouldTrigger = false;

      if (settings.frequency === 'test') {
        const lastMin = settings.lastTriggered;
        const currentMinStr = `${todayStr}-${currentHour}-${currentMinute}`;
        if (lastMin !== currentMinStr) {
          shouldTrigger = true;
          updateSettings({ lastTriggered: currentMinStr });
        }
      } else if (settings.frequency === 'hourly') {
        const lastHourStr = `${todayStr}-${currentHour}`;
        if (settings.lastTriggered !== lastHourStr) {
          shouldTrigger = true;
          updateSettings({ lastTriggered: lastHourStr });
        }
      } else {
        const [targetHour, targetMin] = settings.time.split(':').map(Number);
        const targetHour2 = (targetHour + 12) % 24;

        const isTimeMatch = (currentHour === targetHour && currentMinute === targetMin) ||
          (settings.frequency === 'twice_daily' && currentHour === targetHour2 && currentMinute === targetMin);

        if (isTimeMatch && settings.lastTriggered !== `${todayStr}-${currentHour}`) {
          shouldTrigger = true;
          updateSettings({ lastTriggered: `${todayStr}-${currentHour}` });
        }
      }

      if (shouldTrigger) {
        setShowBanner(true);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Expense Tracker', {
            body: 'Time to update your daily transactions!',
          });
        }
      }
    };

    const interval = setInterval(checkReminder, 30000);
    checkReminder();
    return () => clearInterval(interval);
  }, [settings.enabled, settings.frequency, settings.time, settings.lastTriggered]);

  return (
    <ReminderContext.Provider value={{ settings, updateSettings, showBanner, setShowBanner }}>
      {children}
    </ReminderContext.Provider>
  );
};

export const useReminders = () => {
  const context = useContext(ReminderContext);
  if (!context) throw new Error('useReminders must be used within ReminderProvider');
  return context;
};
