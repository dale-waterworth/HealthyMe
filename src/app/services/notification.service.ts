import { Injectable } from '@angular/core';
import { IndexedDBService, HydrationReminder } from './indexeddb.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationPermission: NotificationPermission = 'default';
  private reminderInterval: number | null = null;

  constructor(private dbService: IndexedDBService) {
    this.checkNotificationPermission();
  }

  private checkNotificationPermission(): void {
    if ('Notification' in window) {
      this.notificationPermission = Notification.permission;
    }
  }

  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    if (this.notificationPermission === 'granted') {
      return true;
    }

    if (this.notificationPermission === 'denied') {
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.notificationPermission = permission;
      return permission === 'granted';
    } catch (error) {
      return false;
    }
  }

  async scheduleHydrationReminders(userId: number, intervalMinutes: number): Promise<boolean> {
    const hasPermission = await this.requestNotificationPermission();

    if (!hasPermission) {
      return false;
    }

    // Clear existing reminders
    this.clearReminders();

    // Save reminder settings to database
    try {
      const existingReminder = await this.dbService.getHydrationReminderByUser(userId);
      const now = new Date();
      const nextReminder = new Date(now.getTime() + intervalMinutes * 60000);

      if (existingReminder) {
        await this.dbService.updateHydrationReminder(existingReminder.id, {
          isEnabled: true,
          intervalMinutes,
          lastReminder: now,
          nextReminder
        });
      } else {
        await this.dbService.saveHydrationReminder({
          userId,
          isEnabled: true,
          intervalMinutes,
          lastReminder: now,
          nextReminder
        });
      }

      // Start the reminder interval
      this.startReminderInterval(intervalMinutes);

      // Show confirmation notification
      this.showNotification(
        'Hydration Reminders Set!',
        `You'll receive reminders every ${intervalMinutes} minutes to drink water.`,
        { icon: '/icons/icon-192x192.png' }
      );

      return true;
    } catch (error) {
      return false;
    }
  }

  private startReminderInterval(intervalMinutes: number): void {
    this.reminderInterval = window.setInterval(() => {
      this.showHydrationReminder();
    }, intervalMinutes * 60000);
  }

  private showHydrationReminder(): void {
    const messages = [
      'Time to hydrate! 💧',
      'Don\'t forget to drink water! 🥤',
      'Stay hydrated - your body will thank you! 💙',
      'Water break time! 🌊',
      'Keep up your hydration goals! 💪',
      'Remember to drink water regularly! ⏰'
    ];

    const randomMessage = messages[Math.floor(Math.random() * messages.length)];

    this.showNotification(
      'Hydration Reminder',
      randomMessage,
      {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: `hydration-reminder-${Date.now()}`,
        requireInteraction: false,
        silent: false
      }
    );
  }

  showNotification(title: string, body: string, options: NotificationOptions = {}): void {
    // Always check the current permission state
    const currentPermission = Notification.permission;
    this.notificationPermission = currentPermission;

    if (currentPermission !== 'granted') {
      return;
    }

    const defaultOptions: NotificationOptions = {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: 'healthyme-notification'
    };

    try {
      const notification = new Notification(title, { ...defaultOptions, ...options });

      // Auto-close notification after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      // Handle notification click
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (error: any) {
      // Silently fail if notifications don't work
    }
  }

  async disableReminders(userId: number): Promise<void> {
    this.clearReminders();

    try {
      const existingReminder = await this.dbService.getHydrationReminderByUser(userId);
      if (existingReminder) {
        await this.dbService.updateHydrationReminder(existingReminder.id, {
          isEnabled: false
        });
      }
    } catch (error) {
      // Silently handle error
    }
  }

  private clearReminders(): void {
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
      this.reminderInterval = null;
    }
  }

  async restoreRemindersOnLoad(userId: number): Promise<void> {
    try {
      const reminder = await this.dbService.getHydrationReminderByUser(userId);
      if (reminder && reminder.isEnabled) {
        const hasPermission = await this.requestNotificationPermission();
        if (hasPermission) {
          this.startReminderInterval(reminder.intervalMinutes);
        }
      }
    } catch (error) {
      // Silently handle error
    }
  }

  isNotificationSupported(): boolean {
    return 'Notification' in window;
  }

  getNotificationPermission(): NotificationPermission {
    return this.notificationPermission;
  }

  // Manual water intake logging notification
  showWaterLoggedNotification(amount: number, totalToday: number, dailyGoal: number): void {
    const percentage = Math.round((totalToday / dailyGoal) * 100);
    const remaining = Math.max(0, dailyGoal - totalToday);

    let message = `Added ${amount}ml! Today: ${totalToday}ml (${percentage}% of goal)`;
    if (remaining > 0) {
      message += `. ${remaining}ml remaining.`;
    } else {
      message = `🎉 Goal achieved! Added ${amount}ml. Today: ${totalToday}ml (${percentage}% of goal)`;
    }

    this.showNotification(
      'Water Intake Logged',
      message,
      {
        icon: '/icons/icon-192x192.png',
        tag: 'water-logged'
      }
    );
  }

  // Achievement notifications
  showAchievementNotification(achievement: string): void {
    this.showNotification(
      '🏆 Achievement Unlocked!',
      achievement,
      {
        icon: '/icons/icon-192x192.png',
        tag: 'achievement',
        requireInteraction: true
      }
    );
  }

  // Test method for debugging
  async testNotification(): Promise<void> {
    const hasPermission = await this.requestNotificationPermission();
    if (hasPermission) {
      this.showNotification('Test Notification', 'This is a test notification to verify functionality');
    }
  }
}
