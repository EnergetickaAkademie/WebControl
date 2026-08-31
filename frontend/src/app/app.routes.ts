import { Routes } from '@angular/router';
import { LoginComponent, DashboardComponent, FirmwareComponent } from './components';
import { ScenarioSelectionComponent } from './components/scenario-selection/scenario-selection';
import { StatisticsComponent } from './components/statistics/statistics.component';
import { AuthGuard } from './guards';

export const routes: Routes = [
  // Use relative redirect targets (no leading slash) to prevent double navigation cycles
  { path: '', redirectTo: 'setup', pathMatch: 'full' },
  { path: 'login', component: LoginComponent, title: 'Energetická akademie - Přihlášení' },
  { path: 'setup', component: ScenarioSelectionComponent, title: 'Energetická akademie - Nastavení', canActivate: [AuthGuard] },
  { path: 'dashboard', component: DashboardComponent, title: 'Energetická akademie - Dashboard', canActivate: [AuthGuard] },
  { path: 'statistics', component: StatisticsComponent, title: 'Energetická akademie - Statistiky', canActivate: [AuthGuard] },
  { path: 'firmware', component: FirmwareComponent, title: 'Energetická akademie - Aktualizace firmware', canActivate: [AuthGuard] },
  { path: '**', redirectTo: 'setup' }
];
