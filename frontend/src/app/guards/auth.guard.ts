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
      map((profile) => {
        console.log('AuthGuard: User is authenticated', profile);
        return true; // User is logged in
      }),
      catchError((error) => {
        console.log('AuthGuard: User is not authenticated', error);
        // User is not logged in, redirect to login
        this.router.navigate(['/login']);
        return of(false);
      })
    );
  }
}
