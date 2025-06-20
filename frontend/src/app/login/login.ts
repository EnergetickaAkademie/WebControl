import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
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
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  onSubmit() {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      
      const { email, password } = this.loginForm.value;
      
      this.authService.signin(email, password).subscribe({
        next: (response) => {
          this.isLoading = false;
          console.log('Login successful', response);
          
          // Check if login was actually successful
          if (response.status === 'OK') {
            console.log('Authentication successful, navigating to dashboard...');
            this.router.navigate(['/dashboard']).then(
              (success) => console.log('Navigation result:', success),
              (error) => console.error('Navigation error:', error)
            );
          } else if (response.status === 'WRONG_CREDENTIALS_ERROR') {
            console.error('Login failed: Wrong credentials');
            this.errorMessage = 'Invalid email or password';
          } else {
            console.error('Login failed with status:', response.status);
            this.errorMessage = 'Login failed: ' + response.status;
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
