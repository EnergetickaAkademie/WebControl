import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = '/api'; // Relative URL for production proxy

  constructor(private http: HttpClient) {}

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
      },
      { withCredentials: true } // Use cookies instead of manual header management
    );
  }

  signout(): Observable<any> {
    return this.http.post(
      `${this.api}/public/signout`,
      {},
      { withCredentials: true }
    );
  }

  // Get user session info
  profile(): Observable<any> {
    return this.http.get(`${this.api}/dashboard`, { withCredentials: true });
  }

  // Check if user is logged in by trying to get profile
  isLoggedIn(): Observable<any> {
    return this.profile();
  }
}
