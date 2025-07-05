import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean> {
    console.log('AuthGuard: Checking authentication...');
    return this.authService.isLoggedIn().pipe(
      map((profile: any) => {
        console.log('AuthGuard: User is authenticated', profile);
        
        // Check if user is a lecturer (only lecturers can access dashboard)
        const userInfo = this.authService.getUserInfo();
        if (userInfo && userInfo.user_type === 'board') {
          console.log('AuthGuard: Board user attempted to access dashboard');
          this.router.navigate(['/login']);
          return false;
        }
        
        return true; // User is logged in and is a lecturer
      }),
      catchError((error: any) => {
        console.log('AuthGuard: User is not authenticated', error);
        // User is not logged in, redirect to login
        this.router.navigate(['/login']);
        return of(false);
      })
    );
  }
}
