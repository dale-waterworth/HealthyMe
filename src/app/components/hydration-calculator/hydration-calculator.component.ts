import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HydrationCalculatorService, HydrationFactors, HydrationResult } from '../../services/hydration-calculator.service';
import { IndexedDBService, UserProfile } from '../../services/indexeddb.service';

@Component({
  selector: 'app-hydration-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './hydration-calculator.component.html',
  styleUrls: ['./hydration-calculator.component.css']
})
export class HydrationCalculatorComponent implements OnInit {
  factors: HydrationFactors = {
    age: 30,
    weight: 70,
    activityLevel: 'moderate',
    climate: 'normal'
  };

  result: HydrationResult | null = null;
  nhsValidation: any = null;
  tips: string[] = [];
  showResults = false;
  isLoading = false;

  constructor(
    private hydrationService: HydrationCalculatorService,
    private dbService: IndexedDBService
  ) {}

  ngOnInit() {
    this.loadExistingProfile();
  }

  async loadExistingProfile() {
    try {
      const profiles = await this.dbService.getAllUserProfiles();
      if (profiles.length > 0) {
        const profile = profiles[0]; // Load first profile
        this.factors = {
          age: profile.age,
          weight: profile.weight,
          activityLevel: profile.activityLevel,
          climate: 'normal'
        };
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }

  calculateHydration() {
    this.isLoading = true;
    
    // Simulate slight delay for better UX
    setTimeout(() => {
      this.result = this.hydrationService.calculateDailyWaterNeed(this.factors);
      this.nhsValidation = this.hydrationService.validateAgainstNHSGuidelines(this.result.dailyWaterGoal);
      this.tips = this.hydrationService.getPersonalizedTips(this.factors);
      this.showResults = true;
      this.isLoading = false;
    }, 500);
  }

  async saveProfile() {
    if (!this.result) return;

    try {
      const profiles = await this.dbService.getAllUserProfiles();
      
      if (profiles.length > 0) {
        // Update existing profile
        await this.dbService.updateUserProfile(profiles[0].id, {
          age: this.factors.age,
          weight: this.factors.weight,
          activityLevel: this.factors.activityLevel,
          dailyWaterGoal: this.result.dailyWaterGoal,
          reminderInterval: this.result.recommendedInterval
        });
      } else {
        // Create new profile
        await this.dbService.saveUserProfile({
          name: 'Default User',
          age: this.factors.age,
          weight: this.factors.weight,
          activityLevel: this.factors.activityLevel,
          dailyWaterGoal: this.result.dailyWaterGoal,
          reminderInterval: this.result.recommendedInterval
        });
      }
      
      alert('Profile saved successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Error saving profile. Please try again.');
    }
  }

  resetCalculator() {
    this.factors = {
      age: 30,
      weight: 70,
      activityLevel: 'moderate',
      climate: 'normal'
    };
    this.result = null;
    this.nhsValidation = null;
    this.tips = [];
    this.showResults = false;
  }

  getActivityLevelDescription(level: string): string {
    switch (level) {
      case 'low': return 'Sedentary lifestyle, minimal exercise';
      case 'moderate': return 'Regular light exercise, 2-3 times per week';
      case 'high': return 'Intense exercise, daily training, or physical job';
      default: return '';
    }
  }

  getClimateDescription(climate: string): string {
    switch (climate) {
      case 'normal': return 'Comfortable indoor/outdoor conditions';
      case 'hot': return 'Hot weather conditions (>25°C/77°F)';
      case 'humid': return 'High humidity environments';
      default: return '';
    }
  }
}