import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = '/api'; // Relative URL for production proxy
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(private http: HttpClient) {
    // Check initial authentication status
    this.checkAuthStatus();
  }

  private getHeaders(): HttpHeaders {
    let headers = new HttpHeaders();
    
    const accessToken = localStorage.getItem('st-access-token');
    if (accessToken) {
      headers = headers.set('Authorization', `Bearer ${accessToken}`);
    }

    const refreshToken = localStorage.getItem('st-refresh-token');
    if (refreshToken) {
      headers = headers.set('st-refresh-token', refreshToken);
    }

    return headers;
  }

  private saveTokens(response: any): void {
    // Extract tokens from response headers or body
    if (response.accessToken) {
      localStorage.setItem('st-access-token', response.accessToken);
    }
    if (response.refreshToken) {
      localStorage.setItem('st-refresh-token', response.refreshToken);
    }
    if (response.user) {
      localStorage.setItem('user-info', JSON.stringify(response.user));
    }
  }

  signin(email: string, password: string): Observable<any> {
    return this.http.post(
      `${this.api}/public/signin`,
      {
        formFields: [
          {
            id: "email",
            value: email
          },
          {
            id: "password", 
            value: password
          }
        ]
      }
    ).pipe(
      tap((response: any) => {
        console.log('Login response:', response);
        if (response.status === 'OK') {
          this.saveTokens(response);
          this.isAuthenticatedSubject.next(true);
        }
      })
    );
  }

  signout(): Observable<any> {
    return this.http.post(
      `${this.api}/public/signout`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      tap(() => {
        this.clearTokens();
        this.isAuthenticatedSubject.next(false);
      })
    );
  }

  // Get user session info
  profile(): Observable<any> {
    return this.http.get(`${this.api}/dashboard`, { headers: this.getHeaders() });
  }

  // Check if user is logged in by trying to get profile
  isLoggedIn(): Observable<any> {
    return this.profile().pipe(
      tap(() => {
        this.isAuthenticatedSubject.next(true);
      })
    );
  }

  private checkAuthStatus(): void {
    // Only check if we have tokens stored
    const accessToken = localStorage.getItem('st-access-token');
    if (accessToken) {
      this.profile().subscribe({
        next: () => this.isAuthenticatedSubject.next(true),
        error: () => {
          this.clearTokens();
          this.isAuthenticatedSubject.next(false);
        }
      });
    } else {
      this.isAuthenticatedSubject.next(false);
    }
  }

  private clearTokens(): void {
    localStorage.removeItem('st-access-token');
    localStorage.removeItem('st-refresh-token');
    localStorage.removeItem('user-info');
  }

  getUserInfo(): any {
    const userInfo = localStorage.getItem('user-info');
    return userInfo ? JSON.parse(userInfo) : null;
  }
}
