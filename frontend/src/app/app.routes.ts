import { Routes } from '@angular/router';
import { LoginComponent, DashboardComponent } from './components';
import { AuthGuard } from './guards';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: '/dashboard' }
];
