import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services';
import { CommonModule } from '@angular/common';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  userInfo: any = null;
  gameStatus: any = null;
  isLoading = true;
  isGameLoading = false;
  private gameStatusSubscription?: Subscription;
  private pollSubscription?: Subscription;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadProfile();
    this.startGameStatusPolling();
  }

  ngOnDestroy() {
    if (this.gameStatusSubscription) {
      this.gameStatusSubscription.unsubscribe();
    }
    if (this.pollSubscription) {
      this.pollSubscription.unsubscribe();
    }
  }

  startGameStatusPolling() {
    // Initial load
    this.loadGameStatus();
    
    // Poll every 3 seconds
    this.pollSubscription = interval(3000).subscribe(() => {
      this.loadGameStatus();
    });
  }

  loadGameStatus() {
    this.gameStatusSubscription = this.authService.getGameStatus().subscribe({
      next: (status: any) => {
        this.gameStatus = status;
      },
      error: (error: any) => {
        console.error('Failed to load game status', error);
      }
    });
  }

  loadProfile() {
    this.authService.profile().subscribe({
      next: (profile: any) => {
        this.userInfo = profile;
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Failed to load profile', error);
        this.isLoading = false;
        if (error.status === 401) {
          this.router.navigate(['/login']);
        }
      }
    });
  }

  nextRound() {
    if (this.isGameLoading) return;
    
    this.isGameLoading = true;
    this.authService.nextRound().subscribe({
      next: (response: any) => {
        console.log('Next round successful', response);
        this.isGameLoading = false;
        // Immediately refresh game status
        this.loadGameStatus();
      },
      error: (error: any) => {
        console.error('Failed to advance to next round', error);
        this.isGameLoading = false;
      }
    });
  }

  startGame() {
    if (this.isGameLoading) return;
    
    this.isGameLoading = true;
    this.authService.startGame().subscribe({
      next: (response: any) => {
        console.log('Game started successfully', response);
        this.isGameLoading = false;
        // Immediately refresh game status
        this.loadGameStatus();
      },
      error: (error: any) => {
        console.error('Failed to start game', error);
        this.isGameLoading = false;
      }
    });
  }

  logout() {
    this.authService.signout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: (error: any) => {
        console.error('Logout failed', error);
        // Navigate to login anyway
        this.router.navigate(['/login']);
      }
    });
  }
}
