import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/water-tracker/water-tracker.component').then(m => m.WaterTrackerComponent)
  },
  {
    path: 'calculator',
    loadComponent: () => import('./components/hydration-calculator/hydration-calculator.component').then(m => m.HydrationCalculatorComponent)
  },
  {
    path: 'tracker',
    loadComponent: () => import('./components/water-tracker/water-tracker.component').then(m => m.WaterTrackerComponent)
  }
];
