import { Routes } from '@angular/router';
import { LoginComponent, DashboardComponent } from './components';
import { ScenarioSelectionComponent } from './components/scenario-selection/scenario-selection';
import { AuthGuard } from './guards';

export const routes: Routes = [
  { path: '', redirectTo: '/setup', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'setup', component: ScenarioSelectionComponent, canActivate: [AuthGuard] },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: '/setup' }
];
