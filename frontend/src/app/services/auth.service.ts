import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = '/coreapi'; // Use CoreAPI for authentication
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(private http: HttpClient) {
    // Check initial authentication status
    this.checkAuthStatus();
  }

  private getHeaders(): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    
    const token = localStorage.getItem('auth-token');
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  private saveTokens(response: any): void {
    // Save JWT token and user info from CoreAPI response
    if (response.token) {
      localStorage.setItem('auth-token', response.token);
    }
    
    // Create user object from response
    const user = {
      username: response.username,
      name: response.name,
      user_type: response.user_type,
      metadata: response.metadata,
      group_id: response.group_id || 'group1' // Include group_id
    };
    
    localStorage.setItem('user-info', JSON.stringify(user));
  }

  signin(username: string, password: string): Observable<any> {
    return this.http.post(
      `${this.api}/login`,
      {
        username: username,
        password: password
      },
      { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }
    ).pipe(
      tap((response: any) => {
        console.log('Login response:', response);
        if (response.token) {
          this.saveTokens(response);
          this.isAuthenticatedSubject.next(true);
        }
      })
    );
  }

  signout(): Observable<any> {
    // Since we're using stateless JWT tokens, we just clear local storage
    this.clearTokens();
    this.isAuthenticatedSubject.next(false);
    
    // Return a simple observable that completes immediately
    return new Observable(observer => {
      observer.next({ success: true });
      observer.complete();
    });
  }

  // Get user session info from a protected CoreAPI endpoint
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
    // Only check if we have a token stored
    const token = localStorage.getItem('auth-token');
    if (token) {
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
    localStorage.removeItem('auth-token');
    localStorage.removeItem('user-info');
  }

  getUserInfo(): any {
    const userInfo = localStorage.getItem('user-info');
    return userInfo ? JSON.parse(userInfo) : null;
  }

  // Game-related methods - Updated for new lecturer API
  getScenarios(): Observable<any> {
    return this.http.get(`${this.api}/scenarios`, { headers: this.getHeaders() });
  }

  startGameWithScenario(scenarioId: string): Observable<any> {
    return this.http.post(`${this.api}/start_game`, 
      { scenario_id: scenarioId }, 
      { headers: this.getHeaders() }
    );
  }

  getGameStatistics(): Observable<any> {
    return this.http.get(`${this.api}/get_statistics`, { headers: this.getHeaders() });
  }

  getComprehensiveGameStatistics(): Observable<any> {
    return this.http.get(`${this.api}/game_statistics`, { headers: this.getHeaders() });
  }

  pollForUsers(): Observable<any> {
    return this.http.get(`${this.api}/pollforusers`, { headers: this.getHeaders() });
  }

  nextRound(): Observable<any> {
    return this.http.post(`${this.api}/next_round`, {}, { headers: this.getHeaders() });
  }

  endGame(): Observable<any> {
    return this.http.post(`${this.api}/end_game`, {}, { headers: this.getHeaders() });
  }

  // Get slide image URL by filename
  getSlideFileUrl(filename: string): string {
    return `${this.api}/slide_file/${filename}`;
  }

  // Get user profile
  getProfile(): Observable<any> {
    return this.http.get(`${this.api}/dashboard`, { headers: this.getHeaders() });
  }

  // Logout method
  logout(): void {
    this.clearTokens();
    this.isAuthenticatedSubject.next(false);
  }

  // Legacy methods for backwards compatibility
  getGameStatus(): Observable<any> {
    return this.getGameStatistics();
  }

  startGame(): Observable<any> {
    // For backwards compatibility, start with demo scenario
    return this.startGameWithScenario('demo');
  }

  // Building table management methods
  getBuildingTable(): Observable<any> {
    return this.http.get(`${this.api}/building_table`, { headers: this.getHeaders() });
  }

  updateBuildingTable(table: any): Observable<any> {
    return this.http.post(`${this.api}/building_table`, { table }, { headers: this.getHeaders() });
  }

  // Get translations for the dashboard
  getTranslations(): Observable<any> {
    return this.http.get(`${this.api}/translations`, { headers: this.getHeaders() });
  }
}
