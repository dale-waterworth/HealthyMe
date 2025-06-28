import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IndexedDBService, UserProfile, HydrationReminder } from '../../services/indexeddb.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {
  currentUser: UserProfile | null = null;
  reminderSettings: HydrationReminder | null = null;
  
  // Form data
  reminderEnabled = false;
  intervalType: 'half-hour' | 'hourly' | 'four-hour' = 'hourly';
  startHour = 8;
  endHour = 18;
  
  intervalOptions = [
    { value: 'half-hour', label: 'Every 30 minutes', description: 'Frequent reminders throughout the day' },
    { value: 'hourly', label: 'Every hour', description: 'Regular hourly reminders' },
    { value: 'four-hour', label: 'Every 4 hours', description: 'Less frequent, spaced out reminders' }
  ];

  hourOptions = Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: `${i.toString().padStart(2, '0')}:00`
  }));

  constructor(
    private dbService: IndexedDBService,
    private notificationService: NotificationService
  ) {}

  async ngOnInit() {
    await this.loadUserProfile();
    await this.loadReminderSettings();
  }

  async loadUserProfile() {
    try {
      const profiles = await this.dbService.getAllUserProfiles();
      if (profiles.length > 0) {
        this.currentUser = profiles[0];
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  }

  async loadReminderSettings() {
    if (!this.currentUser) return;

    try {
      this.reminderSettings = await this.dbService.getHydrationReminderByUser(this.currentUser.id);
      
      if (this.reminderSettings) {
        this.reminderEnabled = this.reminderSettings.isEnabled;
        this.intervalType = this.reminderSettings.intervalType;
        this.startHour = this.reminderSettings.startHour;
        this.endHour = this.reminderSettings.endHour;
      }
    } catch (error) {
      console.error('Error loading reminder settings:', error);
    }
  }

  async saveReminderSettings() {
    if (!this.currentUser) {
      alert('Please set up your profile first by visiting the Calculator page.');
      return;
    }

    try {
      const now = new Date();
      const nextReminder = this.calculateNextReminderTime(now);

      const reminderData = {
        userId: this.currentUser.id,
        isEnabled: this.reminderEnabled,
        intervalType: this.intervalType,
        startHour: this.startHour,
        endHour: this.endHour,
        lastReminder: now,
        nextReminder,
        lastIntakeAmount: 0,
        lastIntakeTime: now
      };

      if (this.reminderSettings) {
        // Update existing reminder
        await this.dbService.updateHydrationReminder(this.reminderSettings.id, reminderData);
      } else {
        // Create new reminder
        await this.dbService.saveHydrationReminder(reminderData);
      }

      // Apply the new reminder schedule
      if (this.reminderEnabled) {
        await this.startSmartReminders();
      } else {
        await this.notificationService.disableReminders(this.currentUser.id);
      }

      alert('Reminder settings saved successfully!');
      await this.loadReminderSettings(); // Reload to get updated data
    } catch (error) {
      console.error('Error saving reminder settings:', error);
      alert('Error saving settings. Please try again.');
    }
  }

  private calculateNextReminderTime(from: Date): Date {
    const next = new Date(from);
    
    switch (this.intervalType) {
      case 'half-hour':
        next.setMinutes(next.getMinutes() + 30);
        break;
      case 'hourly':
        next.setHours(next.getHours() + 1);
        break;
      case 'four-hour':
        next.setHours(next.getHours() + 4);
        break;
    }

    // Ensure next reminder is within notification hours
    if (next.getHours() < this.startHour) {
      next.setHours(this.startHour, 0, 0, 0);
    } else if (next.getHours() >= this.endHour) {
      // Move to next day at start hour
      next.setDate(next.getDate() + 1);
      next.setHours(this.startHour, 0, 0, 0);
    }

    return next;
  }

  private async startSmartReminders() {
    if (!this.currentUser) return;

    // Request notification permission
    const hasPermission = await this.notificationService.requestNotificationPermission();
    if (!hasPermission) {
      alert('Notification permission is required for reminders to work.');
      return;
    }

    // Start the smart reminder system
    await this.scheduleNextReminder();
  }

  private async scheduleNextReminder() {
    if (!this.currentUser || !this.reminderSettings) return;

    const now = new Date();
    const currentHour = now.getHours();

    // Check if we're within notification hours
    if (currentHour < this.startHour || currentHour >= this.endHour) {
      // Schedule for next notification window
      const nextStart = new Date();
      if (currentHour >= this.endHour) {
        nextStart.setDate(nextStart.getDate() + 1);
      }
      nextStart.setHours(this.startHour, 0, 0, 0);
      
      const timeUntilNext = nextStart.getTime() - now.getTime();
      setTimeout(() => this.scheduleNextReminder(), timeUntilNext);
      return;
    }

    // Calculate interval in milliseconds
    let intervalMs: number;
    switch (this.intervalType) {
      case 'half-hour':
        intervalMs = 30 * 60 * 1000;
        break;
      case 'hourly':
        intervalMs = 60 * 60 * 1000;
        break;
      case 'four-hour':
        intervalMs = 4 * 60 * 60 * 1000;
        break;
    }

    // Set up the reminder
    setTimeout(async () => {
      await this.checkAndSendReminder();
      await this.scheduleNextReminder(); // Schedule the next one
    }, intervalMs);
  }

  private async checkAndSendReminder() {
    if (!this.currentUser || !this.reminderEnabled) return;

    const now = new Date();
    const currentHour = now.getHours();

    // Check if we're within notification hours
    if (currentHour < this.startHour || currentHour >= this.endHour) {
      return;
    }

    // Check recent intake to implement smart reminders
    const shouldSendReminder = await this.shouldSendReminderBasedOnIntake();
    
    if (shouldSendReminder) {
      this.notificationService.showNotification(
        'Hydration Reminder',
        this.getSmartReminderMessage(),
        {
          icon: '/icons/icon-192x192.png',
          tag: `hydration-reminder-${Date.now()}`,
          requireInteraction: false,
          silent: false
        }
      );

      // Update last reminder time
      if (this.reminderSettings) {
        await this.dbService.updateHydrationReminder(this.reminderSettings.id, {
          lastReminder: now
        });
      }
    }
  }

  private async shouldSendReminderBasedOnIntake(): Promise<boolean> {
    if (!this.currentUser) return false;

    // Get recent intakes (last 6 hours)
    const sixHoursAgo = new Date();
    sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);
    
    const recentIntakes = await this.dbService.getWaterIntakesByUser(this.currentUser.id, sixHoursAgo);
    
    if (recentIntakes.length === 0) {
      return true; // No recent intake, send reminder
    }

    // Calculate expected intake based on interval
    const dailyGoal = this.currentUser.dailyWaterGoal;
    const hoursPerDay = this.endHour - this.startHour;
    let expectedIntakePerInterval: number;

    switch (this.intervalType) {
      case 'half-hour':
        expectedIntakePerInterval = dailyGoal / (hoursPerDay * 2);
        break;
      case 'hourly':
        expectedIntakePerInterval = dailyGoal / hoursPerDay;
        break;
      case 'four-hour':
        expectedIntakePerInterval = dailyGoal / (hoursPerDay / 4);
        break;
    }

    // Check if user has consumed enough in the recent period
    const lastIntake = recentIntakes[0];
    const timeSinceLastIntake = Date.now() - new Date(lastIntake.timestamp).getTime();
    
    let intervalMs: number;
    switch (this.intervalType) {
      case 'half-hour':
        intervalMs = 30 * 60 * 1000;
        break;
      case 'hourly':
        intervalMs = 60 * 60 * 1000;
        break;
      case 'four-hour':
        intervalMs = 4 * 60 * 60 * 1000;
        break;
    }

    // If user drank more than expected, delay reminder
    if (lastIntake.amount >= expectedIntakePerInterval * 2 && timeSinceLastIntake < intervalMs) {
      return false; // Skip this reminder
    }

    return true;
  }

  private getSmartReminderMessage(): string {
    const messages = [
      'Time to hydrate! 💧',
      'Don\'t forget to drink water! 🥤',
      'Stay hydrated - your body will thank you! 💙',
      'Water break time! 🌊',
      'Keep up your hydration goals! 💪',
      'Remember to drink water regularly! ⏰'
    ];

    return messages[Math.floor(Math.random() * messages.length)];
  }

  getIntervalDescription(): string {
    const option = this.intervalOptions.find(opt => opt.value === this.intervalType);
    return option ? option.description : '';
  }

  getNotificationTimeRange(): string {
    const start = this.hourOptions.find(h => h.value === this.startHour)?.label || '08:00';
    const end = this.hourOptions.find(h => h.value === this.endHour)?.label || '18:00';
    return `${start} - ${end}`;
  }

  getCurrentIntervalLabel(): string {
    const option = this.intervalOptions.find(o => o.value === this.intervalType);
    return option?.label || '';
  }

  async testNotification() {
    await this.notificationService.testNotification();
  }
}