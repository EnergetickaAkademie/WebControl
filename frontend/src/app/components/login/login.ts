import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage = '';
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  onSubmit() {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      
      const { username, password } = this.loginForm.value;
      
      this.authService.signin(username, password).subscribe({
        next: (response) => {
          this.isLoading = false;
          console.log('Login successful', response);
          
          // Check if login was actually successful
          if (response.token) {
            console.log('Authentication successful, navigating to dashboard...');
            // Give a small delay to ensure the token is saved
            setTimeout(() => {
              this.router.navigate(['/dashboard']).then(
                (success) => console.log('Navigation result:', success),
                (error) => console.error('Navigation error:', error)
              );
            }, 100);
          } else {
            console.error('Login failed: No token received');
            this.errorMessage = 'Login failed: No authentication token received';
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Login failed', error);
          if (error.status === 403) {
            this.errorMessage = 'Invalid email or password';
          } else {
            this.errorMessage = 'Login failed. Please try again.';
          }
        }
      });
    }
  }
}
