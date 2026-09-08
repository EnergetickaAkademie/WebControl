import { isDevMode, inject } from '@angular/core';
import { Routes, Router } from '@angular/router';
import { LoginComponent, DashboardComponent, FirmwareComponent } from './components';
import { ScenarioSelectionComponent } from './components/scenario-selection/scenario-selection';
import { StatisticsComponent } from './components/statistics/statistics.component';
import { AuthGuard } from './guards';

const developmentOnlyGuard = () => {
  if (isDevMode()) return true;
  return inject(Router).createUrlTree(['/setup']);
};

export const routes: Routes = [
  // Use relative redirect targets (no leading slash) to prevent double navigation cycles
  { path: '', redirectTo: 'setup', pathMatch: 'full' },
  { path: 'login', component: LoginComponent, title: 'Energetická akademie - Přihlášení' },
  { path: 'setup', component: ScenarioSelectionComponent, title: 'Energetická akademie - Nastavení', canActivate: [AuthGuard] },
  { path: 'dashboard', component: DashboardComponent, title: 'Energetická akademie - Dashboard', canActivate: [AuthGuard] },
  { path: 'statistics', component: StatisticsComponent, title: 'Energetická akademie - Statistiky', canActivate: [AuthGuard] },
  { path: 'statistics-preview', component: StatisticsComponent, title: 'Energetická akademie - Náhled statistik', data: { preview: true }, canActivate: [developmentOnlyGuard] },
  { path: 'firmware', component: FirmwareComponent, title: 'Energetická akademie - Aktualizace firmware', canActivate: [AuthGuard] },
  { path: '**', redirectTo: 'setup' }
];
