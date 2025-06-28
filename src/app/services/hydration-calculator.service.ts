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
  additionalForClimate?: number; // additional ml suggested for hot/humid weather
  additionalForExercise?: number; // additional ml suggested for high activity days
}

@Injectable({
  providedIn: 'root'
})
export class HydrationCalculatorService {

  constructor() { }

  calculateDailyWaterNeed(factors: HydrationFactors): HydrationResult {
    // Base calculation: More conservative approach based on NHS guidelines
    // Start with 30ml per kg instead of 35ml to prevent over-recommendation
    const baseRequirement = factors.weight * 30;

    // Age adjustments - reduced percentages
    let ageAdjustment = 0;
    if (factors.age >= 65) {
      // Older adults need slightly more due to decreased kidney function
      ageAdjustment = baseRequirement * 0.05; // 5% increase (reduced from 10%)
    } else if (factors.age < 18) {
      // Children and teenagers have higher metabolic rates
      ageAdjustment = baseRequirement * 0.1; // 10% increase (reduced from 15%)
    }

    // Activity level adjustments - reduced amounts
    let activityBonus = 0;
    switch (factors.activityLevel) {
      case 'low':
        activityBonus = 0;
        break;
      case 'moderate':
        activityBonus = 300; // Reduced from 500ml
        break;
      case 'high':
        activityBonus = 500; // Reduced from 1000ml
        break;
    }

    // Climate adjustments - these will be suggested as additional, not added to base
    let climateAdjustment = 0;
    if (factors.climate) {
      switch (factors.climate) {
        case 'hot':
          climateAdjustment = 300; // Reduced from 500ml
          break;
        case 'humid':
          climateAdjustment = 200; // Reduced from 300ml
          break;
        case 'normal':
        default:
          climateAdjustment = 0;
          break;
      }
    }

    // Calculate base daily water goal (without climate adjustments)
    const baseDailyGoal = Math.round(baseRequirement + ageAdjustment + activityBonus);
    
    // Apply maximum limit of 3000ml (3 litres) for the base recommendation
    const maxBaseRecommendation = 3000;
    const dailyWaterGoal = Math.min(baseDailyGoal, maxBaseRecommendation);

    // Convert to 250ml glasses (standard glass size)
    const recommendedGlasses = Math.ceil(dailyWaterGoal / 250);

    // Calculate recommended interval (assuming 16 waking hours)
    const wakingHours = 16;
    const totalIntakes = Math.max(6, Math.ceil(dailyWaterGoal / 200)); // At least 6 intakes, or 200ml per intake
    const recommendedInterval = Math.round((wakingHours * 60) / totalIntakes);

    // Calculate additional recommendations for climate and exercise
    const additionalForClimate = factors.climate && factors.climate !== 'normal' ? climateAdjustment : undefined;
    const additionalForExercise = factors.activityLevel === 'high' ? 300 : undefined; // Extra for intense exercise days

    return {
      dailyWaterGoal,
      baseRequirement: Math.round(baseRequirement),
      activityBonus,
      ageAdjustment: Math.round(ageAdjustment),
      climateAdjustment,
      recommendedGlasses,
      recommendedInterval,
      additionalForClimate,
      additionalForExercise
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
        tips.push('Drink an extra 300-500ml before, during, and after intense exercise');
        tips.push('Consider electrolyte replacement for activities over 1 hour');
        tips.push('Monitor your sweat rate to adjust intake on heavy exercise days');
        break;
      case 'moderate':
        tips.push('Add an extra 200-300ml on days with more physical activity');
        tips.push('Drink water 30 minutes before moderate exercise');
        break;
      case 'low':
        tips.push('Use regular meal times as reminders to drink water');
        break;
    }

    // Climate-specific tips
    if (factors.climate === 'hot') {
      tips.push('Add an extra 300ml during hot weather to prevent heat exhaustion');
      tips.push('Drink cool (not ice-cold) water for better absorption');
      tips.push('Start hydrating early in hot days, before you feel thirsty');
    } else if (factors.climate === 'humid') {
      tips.push('Add an extra 200ml on humid days due to increased perspiration');
      tips.push('Pay attention to your body\'s cooling needs in humid conditions');
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