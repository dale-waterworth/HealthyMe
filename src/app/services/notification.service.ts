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

  // Note: Smart reminder scheduling is now handled by the settings component
  // This method is kept for backwards compatibility but is deprecated
  async scheduleHydrationReminders(userId: number, intervalMinutes: number): Promise<boolean> {
    const hasPermission = await this.requestNotificationPermission();
    return hasPermission;
  }

  private startReminderInterval(intervalMinutes: number): void {
    // This method is no longer used - smart reminders are handled by settings component
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
        icon: '/assets/icon-192x192.png',
        badge: '/assets/icon-72x72.png',
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
      icon: '/assets/icon-192x192.png',
      badge: '/assets/icon-72x72.png',
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
    // Smart reminders are now handled by the settings component
    // This method is kept for backwards compatibility but does nothing
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
        icon: '/assets/icon-192x192.png',
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
        icon: '/assets/icon-192x192.png',
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
