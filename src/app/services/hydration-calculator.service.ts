import { Injectable } from '@angular/core';

export interface HydrationFactors {
  age: number;
  weight: number; // in kg
  activityLevel: 'low' | 'moderate' | 'high';
  climate?: 'normal' | 'hot' | 'humid';
  healthConditions?: string[];
}

export interface HydrationResult {
  dailyWaterGoal: number; // in ml
  baseRequirement: number; // in ml
  activityBonus: number; // in ml
  ageAdjustment: number; // in ml
  climateAdjustment: number; // in ml
  recommendedGlasses: number; // 250ml glasses
  recommendedInterval: number; // minutes between drinks
}

@Injectable({
  providedIn: 'root'
})
export class HydrationCalculatorService {

  constructor() { }

  calculateDailyWaterNeed(factors: HydrationFactors): HydrationResult {
    // Base calculation: 35ml per kg of body weight (WHO recommendation)
    const baseRequirement = factors.weight * 35;

    // Age adjustments
    let ageAdjustment = 0;
    if (factors.age >= 65) {
      // Older adults need more due to decreased kidney function and thirst sensation
      ageAdjustment = baseRequirement * 0.1; // 10% increase
    } else if (factors.age < 18) {
      // Children and teenagers have higher metabolic rates
      ageAdjustment = baseRequirement * 0.15; // 15% increase
    }

    // Activity level adjustments
    let activityBonus = 0;
    switch (factors.activityLevel) {
      case 'low':
        activityBonus = 0;
        break;
      case 'moderate':
        activityBonus = 500; // Additional 500ml for moderate activity
        break;
      case 'high':
        activityBonus = 1000; // Additional 1000ml for high activity
        break;
    }

    // Climate adjustments
    let climateAdjustment = 0;
    if (factors.climate) {
      switch (factors.climate) {
        case 'hot':
          climateAdjustment = 500; // Additional 500ml for hot weather
          break;
        case 'humid':
          climateAdjustment = 300; // Additional 300ml for humid conditions
          break;
        case 'normal':
        default:
          climateAdjustment = 0;
          break;
      }
    }

    // Calculate total daily water goal
    const dailyWaterGoal = Math.round(baseRequirement + ageAdjustment + activityBonus + climateAdjustment);

    // Convert to 250ml glasses (standard glass size)
    const recommendedGlasses = Math.ceil(dailyWaterGoal / 250);

    // Calculate recommended interval (assuming 16 waking hours)
    const wakingHours = 16;
    const totalIntakes = Math.max(6, Math.ceil(dailyWaterGoal / 200)); // At least 6 intakes, or 200ml per intake
    const recommendedInterval = Math.round((wakingHours * 60) / totalIntakes);

    return {
      dailyWaterGoal,
      baseRequirement: Math.round(baseRequirement),
      activityBonus,
      ageAdjustment: Math.round(ageAdjustment),
      climateAdjustment,
      recommendedGlasses,
      recommendedInterval
    };
  }

  // NHS guidelines validation
  validateAgainstNHSGuidelines(calculatedAmount: number): {
    isWithinRange: boolean;
    nhsMinimum: number;
    nhsMaximum: number;
    recommendation: string;
  } {
    const nhsMinimum = 1500; // 1.5 litres
    const nhsMaximum = 2500; // 2.5 litres

    const isWithinRange = calculatedAmount >= nhsMinimum && calculatedAmount <= nhsMaximum;

    let recommendation = '';
    if (calculatedAmount < nhsMinimum) {
      recommendation = 'Your calculated amount is below NHS recommendations. Consider increasing to at least 1.5 litres daily.';
    } else if (calculatedAmount > nhsMaximum) {
      recommendation = 'Your calculated amount is above typical NHS recommendations. This may be appropriate for your activity level, but consider consulting a healthcare provider.';
    } else {
      recommendation = 'Your calculated amount aligns well with NHS guidelines of 1.5-2.5 litres daily.';
    }

    return {
      isWithinRange,
      nhsMinimum,
      nhsMaximum,
      recommendation
    };
  }

  // Get hydration tips based on factors
  getPersonalizedTips(factors: HydrationFactors): string[] {
    const tips: string[] = [];

    // Age-specific tips
    if (factors.age >= 65) {
      tips.push('Set regular reminders as thirst sensation decreases with age');
      tips.push('Keep water easily accessible to prevent falls when getting drinks');
    } else if (factors.age < 18) {
      tips.push('Encourage regular water breaks during school and activities');
      tips.push('Monitor urine color as a hydration indicator');
    }

    // Activity-specific tips
    switch (factors.activityLevel) {
      case 'high':
        tips.push('Drink water before, during, and after exercise');
        tips.push('Consider electrolyte replacement for intense activities over 1 hour');
        break;
      case 'moderate':
        tips.push('Increase intake on days with more physical activity');
        break;
      case 'low':
        tips.push('Use regular meal times as reminders to drink water');
        break;
    }

    // Climate-specific tips
    if (factors.climate === 'hot') {
      tips.push('Increase intake during hot weather to prevent heat exhaustion');
      tips.push('Drink cool (not ice-cold) water for better absorption');
    } else if (factors.climate === 'humid') {
      tips.push('Humid conditions increase fluid loss through perspiration');
    }

    // General NHS-based tips
    tips.push('Use a straw or sports bottle cap to make drinking easier');
    tips.push('Include other fluids like tea, coffee, and milk in your daily intake');
    tips.push('Eat water-rich foods like fruits, vegetables, and soups');

    return tips;
  }

  // Check for dehydration signs
  getDehydrationWarnings(): string[] {
    return [
      'Dark yellow urine may indicate dehydration',
      'Feeling thirsty is already a sign you need fluids',
      'Watch for dizziness or feeling faint',
      'Headaches can be an early sign of dehydration',
      'Fatigue may indicate insufficient fluid intake'
    ];
  }
}