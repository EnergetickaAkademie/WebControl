import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';

@Injectable()
export class CredsInterceptor implements HttpInterceptor {

  constructor(private router: Router) {}

  intercept(req: HttpRequest<any>, next: HttpHandler) {
    let cloned = req;
    
    // Add JWT token to Authorization header if available
    const token = localStorage.getItem('auth-token');
    if (token) {
      cloned = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }
    
    return next.handle(cloned).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401) {
          // Clear token and redirect to login on 401
          localStorage.removeItem('auth-token');
          localStorage.removeItem('user-info');
          this.router.navigate(['/login']);
        }
        return throwError(() => err);
      })
    );
  }
}
