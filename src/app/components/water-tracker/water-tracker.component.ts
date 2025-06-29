import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { IndexedDBService, UserProfile, WaterIntake, HydrationReminder } from '../../services/indexeddb.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-water-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './water-tracker.component.html',
  styleUrls: ['./water-tracker.component.css']
})
export class WaterTrackerComponent implements OnInit {
  currentUser: UserProfile | null = null;
  todayIntake = 0;
  dailyGoal = 2000;
  quickAmounts = [
    { label: '1 swig', amount: 50 },
    { label: '2 swigs', amount: 100 },
    { label: '1 glass', amount: 250 },
    { label: '1 pint', amount: 568 }
  ];
  customAmount = 250;
  recentIntakes: WaterIntake[] = [];
  progressPercentage = 0;
  remainingAmount = 0;
  reminderSettings: HydrationReminder | null = null;

  constructor(
    private dbService: IndexedDBService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadUserProfile();
    await this.loadTodayIntake();
    await this.loadRecentIntakes();
    await this.loadReminderSettings();
    this.calculateProgress();
  }

  async loadUserProfile() {
    try {
      // Add a small delay to ensure IndexedDB is fully initialized
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const profiles = await this.dbService.getAllUserProfiles();
      if (profiles.length > 0) {
        this.currentUser = profiles[0];
        this.dailyGoal = this.currentUser.dailyWaterGoal;
      }
      // If no profile exists, currentUser remains null and the template will show the warning
    } catch (error) {
      console.error('Error loading user profile:', error);
      // On error, currentUser remains null and the template will show the warning
    }
  }

  async loadTodayIntake() {
    if (!this.currentUser) return;

    try {
      this.todayIntake = await this.dbService.getTodayWaterIntake(this.currentUser.id);
    } catch (error) {
      console.error('Error loading today\'s intake:', error);
    }
  }

  async loadRecentIntakes() {
    if (!this.currentUser) return;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      this.recentIntakes = await this.dbService.getWaterIntakesByUser(this.currentUser.id, today);
      this.recentIntakes = this.recentIntakes.slice(0, 10); // Show last 10 entries
    } catch (error) {
      console.error('Error loading recent intakes:', error);
    }
  }

  calculateProgress() {
    this.progressPercentage = Math.min(100, Math.round((this.todayIntake / this.dailyGoal) * 100));
    this.remainingAmount = Math.max(0, this.dailyGoal - this.todayIntake);
  }

  async logWaterIntake(amount: number) {
    if (!this.currentUser || amount <= 0) return;

    try {
      await this.dbService.addWaterIntake({
        amount,
        timestamp: new Date(),
        userId: this.currentUser.id
      });

      // Update local data
      this.todayIntake += amount;
      await this.loadRecentIntakes();
      this.calculateProgress();

      // Show notification
      this.notificationService.showWaterLoggedNotification(amount, this.todayIntake, this.dailyGoal);

      // Check for achievements
      this.checkAchievements();

    } catch (error) {
      console.error('Error logging water intake:', error);
      alert('Error logging water intake. Please try again.');
    }
  }

  async deleteIntake(intake: WaterIntake) {
    if (!this.currentUser) return;

    // Show confirmation dialog
    const confirmed = confirm(`Delete ${intake.amount}ml entry from ${this.formatTime(intake.timestamp)}?`);
    if (!confirmed) return;

    try {
      await this.dbService.deleteWaterIntake(intake.id);

      // Update local data
      this.todayIntake -= intake.amount;
      await this.loadRecentIntakes();
      this.calculateProgress();

      // Show success notification
      this.notificationService.showNotification(
        'Entry Deleted',
        `Removed ${intake.amount}ml from your daily intake.`,
        { icon: '/icons/icon-192x192.png', tag: 'water-deleted' }
      );

    } catch (error) {
      console.error('Error deleting water intake:', error);
      alert('Error deleting entry. Please try again.');
    }
  }


  checkAchievements() {
    if (this.progressPercentage >= 100 && this.progressPercentage < 105) {
      this.notificationService.showAchievementNotification('Daily hydration goal achieved! 🎯');
    } else if (this.progressPercentage >= 50 && this.progressPercentage < 55) {
      this.notificationService.showAchievementNotification('Halfway to your daily goal! 💪');
    }
  }

  getProgressBarClass(): string {
    if (this.progressPercentage >= 100) return 'progress-complete';
    if (this.progressPercentage >= 75) return 'progress-high';
    if (this.progressPercentage >= 50) return 'progress-medium';
    return 'progress-low';
  }

  getWaterLevelHeight(): number {
    return Math.min(100, this.progressPercentage);
  }

  formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getMotivationalMessage(): string {
    if (this.progressPercentage >= 100) {
      return '🎉 Amazing! You\'ve reached your daily goal!';
    } else if (this.progressPercentage >= 75) {
      return '💪 You\'re almost there! Keep it up!';
    } else if (this.progressPercentage >= 50) {
      return '👍 Great progress! Halfway to your goal!';
    } else if (this.progressPercentage >= 25) {
      return '🌱 Good start! Keep drinking water regularly.';
    } else {
      return '💧 Stay hydrated! Start logging your water intake.';
    }
  }

  isNotificationSupported(): boolean {
    return this.notificationService.isNotificationSupported();
  }

}
