import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpResponse,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

@Injectable()
export class SessionInterceptor implements HttpInterceptor {
  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    let modifiedReq = req;

    // Add access token to headers if available
    const accessToken = localStorage.getItem('st-access-token');
    if (accessToken) {
      modifiedReq = modifiedReq.clone({
        setHeaders: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
    }

    // Add refresh token to headers if available
    const refreshToken = localStorage.getItem('st-refresh-token');
    if (refreshToken) {
      modifiedReq = modifiedReq.clone({
        setHeaders: {
          'st-refresh-token': refreshToken,
        },
      });
    }

    return next.handle(modifiedReq).pipe(
      tap((event) => {
        if (event instanceof HttpResponse) {
          // Save new tokens from response headers
          const newAccessToken = event.headers.get('st-access-token');
          if (newAccessToken) {
            localStorage.setItem('st-access-token', newAccessToken);
          }
          
          const newRefreshToken = event.headers.get('st-refresh-token');
          if (newRefreshToken) {
            localStorage.setItem('st-refresh-token', newRefreshToken);
          }

          // Handle tokens from response body (for login response)
          if (event.body && event.body.accessToken) {
            localStorage.setItem('st-access-token', event.body.accessToken);
          }
          if (event.body && event.body.refreshToken) {
            localStorage.setItem('st-refresh-token', event.body.refreshToken);
          }
        }
      }),
      catchError((error: HttpErrorResponse) => {
        // If we get a 401, clear tokens
        if (error.status === 401) {
          this.clearTokens();
        }
        return throwError(() => error);
      })
    );
  }

  static isAuthenticated(): boolean {
    return !!localStorage.getItem('st-access-token');
  }

  static clearTokens(): void {
    localStorage.removeItem('st-access-token');
    localStorage.removeItem('st-refresh-token');
    localStorage.removeItem('user-info');
  }

  private clearTokens(): void {
    SessionInterceptor.clearTokens();
  }
}
