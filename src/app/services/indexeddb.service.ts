import { Injectable } from '@angular/core';

export interface UserProfile {
  id: number;
  name: string;
  age: number;
  weight: number;
  activityLevel: 'low' | 'moderate' | 'high';
  dailyWaterGoal: number;
  reminderInterval: number; // in minutes
  createdAt: Date;
  updatedAt: Date;
}

export interface WaterIntake {
  id: number;
  amount: number; // in ml
  timestamp: Date;
  userId: number;
}

export interface HydrationReminder {
  id: number;
  userId: number;
  isEnabled: boolean;
  intervalType: 'half-hour' | 'hourly' | 'four-hour'; // New configurable intervals
  startHour: number; // Start of notification window (0-23, default 8)
  endHour: number; // End of notification window (0-23, default 18)
  lastReminder: Date;
  nextReminder: Date;
  lastIntakeAmount: number; // Track last intake to calculate smart reminders
  lastIntakeTime: Date; // When the last intake was logged
}

@Injectable({
  providedIn: 'root'
})
export class IndexedDBService {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'HealthyMeDB';
  private readonly dbVersion = 2;

  constructor() {
    this.initDatabase();
  }

  private async initDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // User profiles store
        if (!db.objectStoreNames.contains('userProfiles')) {
          const userStore = db.createObjectStore('userProfiles', { keyPath: 'id', autoIncrement: true });
          userStore.createIndex('name', 'name', { unique: false });
        }

        // Water intake records store
        if (!db.objectStoreNames.contains('waterIntakes')) {
          const intakeStore = db.createObjectStore('waterIntakes', { keyPath: 'id', autoIncrement: true });
          intakeStore.createIndex('userId', 'userId', { unique: false });
          intakeStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Hydration reminders store
        if (!db.objectStoreNames.contains('hydrationReminders')) {
          const reminderStore = db.createObjectStore('hydrationReminders', { keyPath: 'id', autoIncrement: true });
          reminderStore.createIndex('userId', 'userId', { unique: false });
        }
      };
    });
  }

  // User Profile methods
  async saveUserProfile(profile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    if (!this.db) await this.initDatabase();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userProfiles'], 'readwrite');
      const store = transaction.objectStore('userProfiles');
      
      const profileWithTimestamps: Omit<UserProfile, 'id'> = {
        ...profile,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const request = store.add(profileWithTimestamps);
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  async updateUserProfile(id: number, profile: Partial<UserProfile>): Promise<void> {
    if (!this.db) await this.initDatabase();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userProfiles'], 'readwrite');
      const store = transaction.objectStore('userProfiles');
      
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const existingProfile = getRequest.result;
        if (existingProfile) {
          const updatedProfile = {
            ...existingProfile,
            ...profile,
            updatedAt: new Date()
          };
          
          const updateRequest = store.put(updatedProfile);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error('Profile not found'));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async getUserProfile(id: number): Promise<UserProfile | null> {
    if (!this.db) await this.initDatabase();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userProfiles'], 'readonly');
      const store = transaction.objectStore('userProfiles');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllUserProfiles(): Promise<UserProfile[]> {
    if (!this.db) await this.initDatabase();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userProfiles'], 'readonly');
      const store = transaction.objectStore('userProfiles');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Water Intake methods
  async addWaterIntake(intake: Omit<WaterIntake, 'id'>): Promise<number> {
    if (!this.db) await this.initDatabase();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['waterIntakes'], 'readwrite');
      const store = transaction.objectStore('waterIntakes');
      const request = store.add(intake);

      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  async getWaterIntakesByUser(userId: number, startDate?: Date, endDate?: Date): Promise<WaterIntake[]> {
    if (!this.db) await this.initDatabase();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['waterIntakes'], 'readonly');
      const store = transaction.objectStore('waterIntakes');
      const index = store.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = () => {
        let results = request.result;
        
        if (startDate || endDate) {
          results = results.filter(intake => {
            const intakeDate = new Date(intake.timestamp);
            if (startDate && intakeDate < startDate) return false;
            if (endDate && intakeDate > endDate) return false;
            return true;
          });
        }
        
        resolve(results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getTodayWaterIntake(userId: number): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const intakes = await this.getWaterIntakesByUser(userId, today, tomorrow);
    return intakes.reduce((total, intake) => total + intake.amount, 0);
  }

  async deleteWaterIntake(id: number): Promise<void> {
    if (!this.db) await this.initDatabase();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['waterIntakes'], 'readwrite');
      const store = transaction.objectStore('waterIntakes');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Hydration Reminder methods
  async saveHydrationReminder(reminder: Omit<HydrationReminder, 'id'>): Promise<number> {
    if (!this.db) await this.initDatabase();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['hydrationReminders'], 'readwrite');
      const store = transaction.objectStore('hydrationReminders');
      const request = store.add(reminder);

      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  async updateHydrationReminder(id: number, reminder: Partial<HydrationReminder>): Promise<void> {
    if (!this.db) await this.initDatabase();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['hydrationReminders'], 'readwrite');
      const store = transaction.objectStore('hydrationReminders');
      
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const existingReminder = getRequest.result;
        if (existingReminder) {
          const updatedReminder = { ...existingReminder, ...reminder };
          const updateRequest = store.put(updatedReminder);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error('Reminder not found'));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async getHydrationReminderByUser(userId: number): Promise<HydrationReminder | null> {
    if (!this.db) await this.initDatabase();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['hydrationReminders'], 'readonly');
      const store = transaction.objectStore('hydrationReminders');
      const index = store.index('userId');
      const request = index.get(userId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }
}