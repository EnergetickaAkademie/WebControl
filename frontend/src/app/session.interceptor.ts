import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpResponse,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class SessionInterceptor implements HttpInterceptor {
  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    let modifiedReq = req;

    const accessToken = localStorage.getItem('st-access-token');
    if (accessToken) {
      modifiedReq = modifiedReq.clone({
        setHeaders: {
          'st-access-token': accessToken,
        },
      });
    }

    const frontToken = localStorage.getItem('front-token');
    if (frontToken) {
      modifiedReq = modifiedReq.clone({
        setHeaders: {
          'front-token': frontToken,
        },
      });
    }

    return next.handle(modifiedReq).pipe(
      tap((event) => {
        if (event instanceof HttpResponse) {
          const newAccessToken = event.headers.get('st-access-token');
          if (newAccessToken) {
            localStorage.setItem('st-access-token', newAccessToken);
          }
          const newFrontToken = event.headers.get('front-token');
          if (newFrontToken) {
            localStorage.setItem('front-token', newFrontToken);
          }
        }
      })
    );
  }

  static isAuthenticated(): boolean {
    return !!localStorage.getItem('st-access-token');
  }

  static clearTokens(): void {
    localStorage.removeItem('st-access-token');
    localStorage.removeItem('st-refresh-token');
    localStorage.removeItem('front-token');
  }
}
