import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, GameStatusService } from '../../services';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { interval, Subscription } from 'rxjs';
import { SlidePresentationComponent } from '../slide-presentation/slide-presentation';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
// Enum matching the Python RoundType enum
enum RoundType {
  DAY = 1,
  NIGHT = 2,
  SLIDE = 3,
  SLIDE_RANGE = 4
}

interface GameRound {
  round: number;
  round_type: number; // Changed to number to match the backend
  slide_range?: { start: number; end: number };
  game_data?: {
    production_coefficients: any;
    consumption_modifiers: any;
  };
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule, SlidePresentationComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  userInfo: any = null;
  gameStatus: any = null;
  scenarios: any[] = [];
  connectedBoards: any[] = [];
  selectedScenario: string | null = '';
  isLoading = true;
  isGameLoading = false;
  
  // Game state
  currentView: 'setup' | 'presentation' | 'game' = 'setup';
  currentRound: GameRound | null = null;
  currentRoundDetails: any = null; // Store detailed round information
  
  // Translations
  translations: any = {
    weather: {},
    round_types: {}
  };
  
  private gameStatusSubscription?: Subscription;
  private pollSubscription?: Subscription;

  constructor(
    private authService: AuthService,
    private gameStatusService: GameStatusService,
    private router: Router,
    private s: DomSanitizer
  ) {}

  ngOnInit() {
    this.loadProfile();
    this.loadTranslations();
    this.checkReloadRecovery();
    this.startPolling();
  }

  ngOnDestroy() {
    this.stopAllPolling();
  }

  loadProfile() {
    this.authService.profile().subscribe({
      next: (response: any) => {
        this.userInfo = response.user;
        this.isLoading = false;
        // Load scenarios after profile is loaded
        this.loadScenarios();
      },
      error: (error: any) => {
        console.error('Failed to load profile', error);
        this.isLoading = false;
      }
    });
  }

  checkReloadRecovery() {
    // Only perform reload recovery for lecturers
    const userInfo = this.authService.getUserInfo();
    if (userInfo && userInfo.user_type === 'lecturer') {
      this.gameStatusService.checkReloadRecovery().subscribe({
        next: (recovery) => {
          if (recovery.shouldRedirect && recovery.gameState) {
            console.log('Reload recovery - setting view to:', recovery.view);
            console.log('Game state:', recovery.gameState);
            
            // Restore game state
            this.gameStatus = recovery.gameState.gameStatus;
            this.currentRound = recovery.gameState.currentRound;
            this.currentRoundDetails = recovery.gameState.roundDetails;
            this.connectedBoards = recovery.gameState.boards || [];
            
            // Set the appropriate view
            this.currentView = recovery.view;
            
            console.log('Reload recovery complete - current view:', this.currentView);
          }
        },
        error: (error) => {
          console.error('Failed to check reload recovery:', error);
        }
      });
    }
  }

  loadScenarios() {
    if (this.userInfo?.user_type === 'lecturer') {
      this.authService.getScenarios().subscribe({
        next: (response: any) => {
          console.log('Scenarios response:', response); // Debug log
          this.scenarios = response.scenarios?.map((scenario: string) => ({
            id: scenario,
            name: scenario.charAt(0).toUpperCase() + scenario.slice(1)
          })) || [];
          // Don't auto-select any scenario - let lecturer choose
          this.selectedScenario = '';
          console.log('Processed scenarios:', this.scenarios); // Debug log
        },
        error: (error: any) => {
          console.error('Failed to load scenarios', error);
        }
      });
    }
  }

  startPolling() {
    // Poll for game status and connected boards
    this.loadGameStatus();
    this.pollSubscription = interval(500).subscribe(() => {
      this.loadGameStatus();
      if (this.currentView === 'game') {
        this.loadConnectedBoards();
      }
    });
  }

  stopAllPolling() {
    if (this.gameStatusSubscription) {
      this.gameStatusSubscription.unsubscribe();
    }
    if (this.pollSubscription) {
      this.pollSubscription.unsubscribe();
    }
  }

  loadGameStatus() {
    // Use enhanced polling for lecturers to get round details
    if (this.userInfo?.user_type === 'lecturer') {
      this.gameStatusService.pollForUsers().subscribe({
        next: (response: any) => {
          this.gameStatus = response.game_status;
          this.connectedBoards = response.boards || [];
          this.currentRoundDetails = response.round_details;
          
          // Update current round with detailed information if available
          if (response.round_details && this.gameStatus.game_active) {
            this.currentRound = {
              round: this.gameStatus.current_round,
              round_type: response.round_details.round_type,
              game_data: {
                production_coefficients: response.round_details.production_coefficients || {},
                consumption_modifiers: response.round_details.building_consumptions || {}
              }
            };
          }
        },
        error: (error: any) => {
          console.error('Failed to load enhanced game status', error);
          // Fallback to basic statistics
          this.loadBasicGameStatus();
        }
      });
    } else {
      this.loadBasicGameStatus();
    }
  }

  loadBasicGameStatus() {
    this.authService.getGameStatistics().subscribe({
      next: (response: any) => {
        this.gameStatus = response.game_status;
        this.connectedBoards = response.statistics || [];
      },
      error: (error: any) => {
        console.error('Failed to load game status', error);
      }
    });
  }

  loadConnectedBoards() {
    // This method is now redundant since we get boards from game statistics
    // But keeping it for compatibility
    this.loadGameStatus();
  }

  startGame() {
    if (!this.selectedScenario || this.selectedScenario === '') {
      console.error('No scenario selected');
      return;
    }
    
    this.isGameLoading = true;
    console.log('Starting game with scenario:', this.selectedScenario);
    this.authService.startGameWithScenario(this.selectedScenario).subscribe({
      next: (response: any) => {
        console.log('Game started:', response);
        this.loadConnectedBoards();
        // Immediately call next round to get the first round information
        // Don't set isGameLoading = false here, let nextRound handle it
        this.callNextRoundFromStart();
      },
      error: (error: any) => {
        console.error('Failed to start game:', error);
        this.isGameLoading = false;
      }
    });
  }

  callNextRoundFromStart() {
    // Special version of nextRound called from startGame - don't reset loading state
    console.log('Calling next round from start...');
    this.authService.nextRound().subscribe({
      next: (response: any) => {
        console.log('Advanced to next round:', response);
        this.currentRound = response;
        
        if (response.status === 'game_finished') {
          console.log('Game finished, switching to setup view');
          this.currentView = 'setup';
          this.currentRound = null;
        } else if (response.round_type === RoundType.SLIDE || response.round_type === RoundType.SLIDE_RANGE) {
          console.log('Slides round, switching to presentation view');
          this.currentView = 'presentation';
        } else if (response.round_type === RoundType.DAY || response.round_type === RoundType.NIGHT) {
          console.log('Game round, switching to game view');
          this.currentView = 'game';
        }
        
        this.isGameLoading = false;
      },
      error: (error: any) => {
        console.error('Failed to advance round:', error);
        this.isGameLoading = false;
      }
    });
  }

  nextRound() {
    this.isGameLoading = true;
    console.log('Calling next round...');
    this.authService.nextRound().subscribe({
      next: (response: any) => {
        console.log('Advanced to next round:', response);
        this.currentRound = response;
        
        if (response.status === 'game_finished') {
          console.log('Game finished, switching to setup view');
          this.currentView = 'setup';
          this.currentRound = null;
        } else if (response.round_type === RoundType.SLIDE || response.round_type === RoundType.SLIDE_RANGE) {
          console.log('Slides round, switching to presentation view');
          this.currentView = 'presentation';
        } else if (response.round_type === RoundType.DAY || response.round_type === RoundType.NIGHT) {
          console.log('Game round, switching to game view');
          this.currentView = 'game';
        }
        
        this.isGameLoading = false;
      },
      error: (error: any) => {
        console.error('Failed to advance round:', error);
        this.isGameLoading = false;
      }
    });
  }

  endGame() {
    this.isGameLoading = true;
    this.authService.endGame().subscribe({
      next: (response: any) => {
        console.log('Game ended:', response);
        this.currentView = 'setup';
        this.currentRound = null;
        this.isGameLoading = false;
      },
      error: (error: any) => {
        console.error('Failed to end game:', error);
        this.isGameLoading = false;
      }
    });
  }

  logout() {
    this.authService.signout().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }

  // Helper method for template to iterate over object keys
  objectKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : [];
  }

  // Helper method to get round type name
  getRoundTypeName(roundType: number): string {
    switch (roundType) {
      case RoundType.DAY:
        return 'DAY';
      case RoundType.NIGHT:
        return 'NIGHT';
      case RoundType.SLIDE:
      case RoundType.SLIDE_RANGE:
        return 'SLIDES';
      default:
        return 'UNKNOWN';
    }
  }

  // Load translations from backend
  loadTranslations() {
    this.authService.getTranslations().subscribe({
      next: (response: any) => {
        this.translations = response;
      },
      error: (error: any) => {
        console.error('Failed to load translations', error);
        // Use default empty translations if loading fails
        this.translations = { weather: {}, round_types: {} };
      }
    });
  }

  // Board distribution methods
  getLeftBoards(): any[] {
    const maxPerSide = 3;
    const half = Math.ceil(this.connectedBoards.length / 2);
    return this.connectedBoards.slice(0, Math.min(half, maxPerSide));
  }

  getRightBoards(): any[] {
    const maxPerSide = 3;
    const half = Math.ceil(this.connectedBoards.length / 2);
    const startIndex = Math.min(half, maxPerSide);
    return this.connectedBoards.slice(startIndex, startIndex + maxPerSide);
  }

  // Weather and round info getters
  get roundIcon(): SafeHtml {
    // Debug log to see what we have
    console.log('roundIcon getter called:', {
      currentRoundDetails: this.currentRoundDetails,
      round_type: this.currentRoundDetails?.round_type,
      weather: this.currentRoundDetails?.weather
    });
    
    // If we don't have round details, try to use the current round data
    const roundType = this.currentRoundDetails?.round_type || this.currentRound?.round_type;
    if (!roundType) {
      console.log('No round type available, returning empty');
      return '';
    }
    
    const weather = this.currentRoundDetails?.weather || [];
    const isCloudy = weather && weather.some && weather.some((w: any) => w.name && w.name.toLowerCase().includes('cloud'));
    
    console.log('Round type:', roundType, 'Is cloudy:', isCloudy);
    let return_string: string = "";
    if (roundType === 1) { // DAY
      if (isCloudy) {
        // Cloudy day icon
        return_string =  `<svg width="128" height="128" viewBox="0 0 122.88 83.78" style="fill: #FFA500;"><path d="M101.8,57.81c-0.99-0.97-1-2.56-0.03-3.55c0.97-0.99,2.56-1,3.55-0.03l6.91,6.82c0.99,0.97,1,2.56,0.03,3.55 c-0.97,0.99-2.56,1-3.55,0.03L101.8,57.81L101.8,57.81z M66.03,46.16c-0.58,0.28-1.15,0.59-1.73,0.93 c-1.72,1.01-3.42,2.24-5.15,3.66l-3.7-4.24c1.28-1.19,2.66-2.27,4.13-3.22c1.17-0.76,2.39-1.44,3.65-2.02 c0.5-0.25,1.02-0.49,1.53-0.71c-2.44-4.32-5.95-7.42-9.93-9.33c-3.98-1.91-8.43-2.64-12.76-2.22c-4.31,0.42-8.49,1.98-11.95,4.66 c-4,3.1-7.04,7.73-8.2,13.87l-0.36,1.92l-1.91,0.34c-1.87,0.33-3.55,0.78-5.02,1.35c-1.42,0.55-2.69,1.23-3.8,2.03 c-0.89,0.64-1.65,1.36-2.3,2.14c-2.01,2.41-2.95,5.43-2.92,8.49c0.02,3.1,1.03,6.24,2.9,8.82c0.69,0.96,1.5,1.83,2.42,2.6l0,0.01 c0.92,0.77,1.97,1.4,3.16,1.89c1.17,0.48,2.46,0.83,3.9,1.03h55.48c2.7-0.65,5.09-1.53,7.11-2.66c2.01-1.13,3.65-2.5,4.89-4.14 c1.91-2.54,2.85-6.15,2.89-9.84c0.04-3.88-0.9-7.77-2.74-10.6c-0.53-0.81-1.11-1.55-1.72-2.21c-2.76-2.97-6.27-4.27-9.9-4.3 C71.35,44.38,68.62,45.02,66.03,46.16L66.03,46.16z M70.35,39.07c1.22-0.19,2.45-0.29,3.66-0.28c5.14,0.03,10.09,1.87,14,6.08 c0.82,0.88,1.59,1.87,2.31,2.98c0.31,0.48,0.61,0.98,0.88,1.51c0.36-0.66,0.68-1.34,0.94-2.06c0.61-1.64,0.94-3.43,0.94-5.3 c0-4.2-1.7-8.01-4.46-10.76c-2.75-2.75-6.56-4.46-10.76-4.46c-2.66,0-5.15,0.67-7.3,1.85c-1.8,0.99-3.39,2.33-4.66,3.95 C67.61,34.45,69.12,36.62,70.35,39.07L70.35,39.07z M93.44,55.83c0.37,1.87,0.55,3.8,0.53,5.72c-0.05,4.82-1.36,9.63-4.01,13.16 c-1.73,2.31-3.96,4.18-6.63,5.68c-2.57,1.44-5.57,2.53-8.93,3.31l-0.63,0.08H17.88l-0.35-0.03c-2.04-0.26-3.9-0.74-5.57-1.43 c-1.72-0.71-3.26-1.64-4.62-2.78H7.32c-1.28-1.07-2.41-2.29-3.36-3.61C1.41,72.41,0.03,68.11,0,63.83 c-0.03-4.33,1.32-8.64,4.22-12.12c0.94-1.13,2.05-2.17,3.32-3.09c1.48-1.07,3.17-1.98,5.07-2.72c1.32-0.51,2.72-0.94,4.21-1.28 c1.68-6.68,5.27-11.83,9.88-15.41c4.31-3.34,9.51-5.29,14.85-5.81c5.32-0.51,10.8,0.39,15.71,2.75c1.55,0.74,3.04,1.63,4.45,2.66 c1.7-2.07,3.79-3.82,6.17-5.12c2.98-1.63,6.38-2.55,9.99-2.55c5.76,0,10.97,2.33,14.75,6.11c3.77,3.77,6.11,8.99,6.11,14.75 c0,2.54-0.46,4.97-1.29,7.23c-0.87,2.34-2.14,4.49-3.74,6.34C93.61,55.67,93.53,55.75,93.44,55.83L93.44,55.83z M51.38,14.53 c-0.99-0.97-1-2.56-0.03-3.55c0.97-0.99,2.56-1,3.55-0.03l6.91,6.82c0.99,0.97,1,2.56,0.03,3.55c-0.97,0.99-2.56,1-3.55,0.03 L51.38,14.53L51.38,14.53z M78.54,2.52c-0.01-1.38,1.11-2.51,2.5-2.52c1.38-0.01,2.51,1.11,2.52,2.5l0.06,9.71 c0.01,1.38-1.11,2.51-2.5,2.52c-1.38,0.01-2.51-1.11-2.52-2.5L78.54,2.52L78.54,2.52z M106.52,12.04c0.99-0.97,2.58-0.96,3.55,0.03 c0.97,0.99,0.96,2.58-0.03,3.55l-6.91,6.82c-0.99,0.97-2.58,0.96-3.55-0.03c-0.97-0.99-0.96-2.58,0.03-3.55L106.52,12.04 L106.52,12.04z M120.36,38.66c1.38-0.01,2.51,1.11,2.52,2.5c0.01,1.38-1.11,2.51-2.5,2.52l-9.71,0.06 c-1.38,0.01-2.51-1.11-2.52-2.5c-0.01-1.38,1.11-2.51,2.5-2.52L120.36,38.66L120.36,38.66z"/></svg>`;
      } else {
        // Sunny day icon
        return_string = `<svg width="128" height="128" viewBox="0 0 122.88 122.67" style="fill: #FFD700;"><path d="M122.88,62.58l-12.91,8.71l7.94,13.67l-15.03,3.23l2.72,15.92l-15.29-2.25l-2.76,15.58l-14.18-8.11 l-7.94,13.33l-10.32-11.93l-12.23,9.55l-4.97-15.16l-15.54,4.59l1.23-15.54L7.69,92.43l6.75-13.93L0,71.03l11.29-10.95L0.38,48.66 l14.65-6.5L9.42,27.51l15.58-0.76l0-15.8l14.78,5.22l5.99-14.82l11.93,9.98L68.15,0l7.6,13.33l14.18-6.5l2.12,15.07l15.8-1.15 l-3.86,15.46l15.41,4.2l-9.21,12.95L122.88,62.58L122.88,62.58z M104.96,61.1c0-12.14-4.29-22.46-12.87-31 c-8.58-8.54-18.94-12.82-31.04-12.82c-12.1,0-22.42,4.29-30.96,12.82c-8.54,8.53-12.82,18.85-12.82,31 c0,12.1,4.29,22.46,12.82,31.08c8.53,8.62,18.85,12.95,30.96,12.95c12.1,0,22.46-4.33,31.04-12.95 C100.67,83.56,104.96,73.2,104.96,61.1L104.96,61.1L104.96,61.1z"/></svg>`;
      }
    } else if (roundType === 2) { // NIGHT
      if (isCloudy) {
        // Cloudy night icon
        return_string = `<svg width="128" height="128" viewBox="0 0 122.88 93.95" style="fill: #4169E1;"><path d="M70.71,53.66c-0.62,0.3-1.23,0.63-1.85,0.99c-1.85,1.08-3.66,2.4-5.52,3.92l-3.96-4.54c1.37-1.27,2.85-2.43,4.42-3.45 c1.26-0.82,2.57-1.55,3.91-2.17c0.54-0.27,1.08-0.52,1.63-0.76c-2.61-4.63-6.37-7.95-10.63-9.99c-4.26-2.04-9.03-2.83-13.67-2.38 c-4.61,0.45-9.09,2.12-12.79,4.99c-4.28,3.32-7.54,8.28-8.78,14.86l-0.39,2.06l-2.05,0.36c-2.01,0.35-3.8,0.83-5.37,1.45 c-1.52,0.59-2.88,1.32-4.07,2.18c-0.95,0.69-1.77,1.46-2.47,2.29c-2.16,2.58-3.15,5.82-3.13,9.09c0.02,3.32,1.11,6.68,3.11,9.45 c0.74,1.02,1.61,1.96,2.59,2.78c1,0.83,2.12,1.51,3.38,2.03c1.25,0.52,2.64,0.89,4.17,1.10h59.41c2.89-0.7,5.45-1.64,7.61-2.85 c2.15-1.21,3.91-2.67,5.23-4.43c2.05-2.72,3.05-6.58,3.10-10.54c0.05-4.15-0.96-8.32-2.94-11.35c-0.57-0.87-1.18-1.66-1.84-2.37 c-2.96-3.18-6.71-4.57-10.6-4.6C76.4,51.75,73.49,52.43,70.71,53.66L70.71,53.66z M62.46,32.1c0,0.23-0.03,0.45-0.1,0.66 c5.31,2.8,9.92,7.22,12.98,13.3c1.31-0.2,2.62-0.31,3.92-0.3c5.5,0.04,10.81,2.01,14.99,6.51c0.88,0.94,1.71,2.01,2.48,3.19 c0.81,1.25,1.5,2.62,2.06,4.08c4.43-1.26,8.42-3.56,11.69-6.62c2.19-2.05,4.06-4.45,5.52-7.1c-0.78,0.35-1.58,0.67-2.4,0.95 c-2.96,1.02-6.14,1.57-9.44,1.57c-8.03,0-15.3-3.26-20.57-8.52c-5.26-5.26-8.52-12.54-8.52-20.57c0-3.43,0.6-6.72,1.69-9.78 c0.33-0.93,0.71-1.83,1.13-2.72c-3.69,1.91-6.9,4.6-9.44,7.86C64.69,19.44,62.46,25.51,62.46,32.1L62.46,32.1z M57.96,30.86 c0.26-7.16,2.8-13.73,6.92-19.03C69.32,6.12,75.61,1.9,82.85,0.07c1.21-0.30,2.44,0.43,2.74,1.64c0.19,0.77-0.04,1.55-0.54,2.09 c-1.72,2.12-3.09,4.54-4.04,7.19c-0.92,2.58-1.42,5.36-1.42,8.26c0,6.78,2.75,12.92,7.19,17.37c4.44,4.44,10.59,7.19,17.37,7.19 c2.8,0,5.48-0.47,7.98-1.32c2.61-0.89,5-2.2,7.11-3.85c0.98-0.77,2.4-0.59,3.16,0.39c0.46,0.59,0.58,1.33,0.39,2l0,0 c-1.65,5.89-4.89,11.12-9.23,15.18c-3.78,3.54-8.4,6.21-13.53,7.67c0.41,2.04,0.61,4.16,0.59,6.26c-0.06,5.17-1.45,10.31-4.3,14.1 c-1.86,2.47-4.24,4.48-7.1,6.08c-2.75,1.54-5.96,2.71-9.57,3.55L79,93.95H19.15l-0.38-0.04c-2.19-0.28-4.17-0.79-5.97-1.54 c-1.86-0.77-3.51-1.76-4.96-2.97c-1.37-1.15-2.58-2.45-3.6-3.87C1.51,81.77,0.03,77.16,0,72.58c-0.03-4.63,1.41-9.25,4.52-12.98 c1.01-1.21,2.19-2.32,3.55-3.31c1.58-1.15,3.39-2.12,5.43-2.91c1.41-0.55,2.91-1.01,4.51-1.37c1.8-7.15,5.65-12.67,10.58-16.5 c4.62-3.58,10.18-5.66,15.9-6.22C49,28.86,53.62,29.38,57.96,30.86L57.96,30.86z"/></svg>`;
      } else {
        // Clear night icon
        return_string = `<svg width="128" height="128" viewBox="0 0 122.88 122.89" style="fill: #191970;"><path d="M49.06,1.27c2.17-0.45,4.34-0.77,6.48-0.98c2.2-0.21,4.38-0.31,6.53-0.29c1.21,0.01,2.18,1,2.17,2.21 c-0.01,0.93-0.6,1.72-1.42,2.03c-9.15,3.6-16.47,10.31-20.96,18.62c-4.42,8.17-6.1,17.88-4.09,27.68l0.01,0.07 c2.29,11.06,8.83,20.15,17.58,25.91c8.74,5.76,19.67,8.18,30.73,5.92l0.07-0.01c7.96-1.65,14.89-5.49,20.3-10.78 c5.6-5.47,9.56-12.48,11.33-20.16c0.27-1.18,1.45-1.91,2.62-1.64c0.89,0.21,1.53,0.93,1.67,1.78c2.64,16.2-1.35,32.07-10.06,44.71 c-8.67,12.58-22.03,21.97-38.18,25.29c-16.62,3.42-33.05-0.22-46.18-8.86C14.52,104.1,4.69,90.45,1.27,73.83 C-2.07,57.6,1.32,41.55,9.53,28.58C17.78,15.57,30.88,5.64,46.91,1.75c0.31-0.08,0.67-0.16,1.06-0.25l0.01,0l0,0L49.06,1.27 L49.06,1.27z M51.86,5.2c-0.64,0.11-1.28,0.23-1.91,0.36l-1.01,0.22l0,0c-0.29,0.07-0.63,0.14-1,0.23 c-14.88,3.61-27.05,12.83-34.7,24.92C5.61,42.98,2.46,57.88,5.56,72.94c3.18,15.43,12.31,28.11,24.51,36.15 c12.19,8.03,27.45,11.41,42.88,8.23c15-3.09,27.41-11.81,35.46-23.49c6.27-9.09,9.9-19.98,10.09-31.41 c-2.27,4.58-5.3,8.76-8.96,12.34c-6,5.86-13.69,10.13-22.51,11.95l-0.01,0c-12.26,2.52-24.38-0.16-34.07-6.54 c-9.68-6.38-16.93-16.45-19.45-28.7l0-0.01C31.25,40.58,33.1,29.82,38,20.77C41.32,14.63,46.05,9.27,51.86,5.2L51.86,5.2z"/></svg>`;
      }
    }
    return this.s.bypassSecurityTrustHtml(return_string);
  }

  get roundName(): string {
    if (!this.currentRoundDetails?.round_type) return '';
    
    const roundType = this.currentRoundDetails.round_type;
    if (roundType === 1) { // DAY
      return this.translations.round_types?.DAY?.name || 'Den';
    } else if (roundType === 2) { // NIGHT
      return this.translations.round_types?.NIGHT?.name || 'Noc';
    }
    return '';
  }

  get weatherInfo(): any {
    if (!this.currentRoundDetails?.weather || this.currentRoundDetails.weather.length === 0) {
      return null;
    }
    
    // Get the first weather condition
    const weather = this.currentRoundDetails.weather[0];
    return this.translations.weather?.[weather.name] || null;
  }

  get temperature(): string {
    const weatherInfo = this.weatherInfo;
    return weatherInfo?.temperature || '';
  }

  get weatherName(): string {
    const weatherInfo = this.weatherInfo;
    return weatherInfo?.name || '';
  }

  get specialEffects(): any[] {
    if (!this.currentRoundDetails?.weather) return [];
    
    let effects: any[] = [];
    
    // Collect effects from all weather conditions
    this.currentRoundDetails.weather.forEach((weather: any) => {
      const weatherTranslation = this.translations.weather?.[weather.name];
      if (weatherTranslation?.effects) {
        effects = effects.concat(weatherTranslation.effects);
      }
    });
    
    return effects;
  }
}
