import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, GameStatusService } from '../../services';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { interval, Subscription } from 'rxjs';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

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
  imports: [CommonModule, FormsModule],
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
  pdfUrl: string | null = null;
  sanitizedPdfUrl: SafeResourceUrl | null = null;
  
  private gameStatusSubscription?: Subscription;
  private pollSubscription?: Subscription;

  constructor(
    private authService: AuthService,
    private gameStatusService: GameStatusService,
    private router: Router,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.loadProfile();
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
            
            // If we're in a presentation or game state, load the PDF
            if (recovery.view === 'presentation' || recovery.view === 'game') {
              this.loadPDF();
            }
            
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
        this.loadPDF();
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

  loadPDF() {
    console.log('Loading PDF...');
    this.authService.getPDF().subscribe({
      next: (response: any) => {
        console.log('PDF response:', response);
        if (response.success && response.url) {
          // Make the URL absolute for the iframe
          this.pdfUrl = `http://localhost${response.url}`;
          // Sanitize the URL for Angular security
          this.sanitizedPdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfUrl);
          console.log('PDF URL set to:', this.pdfUrl);
        } else {
          console.error('Invalid PDF response:', response);
        }
      },
      error: (error: any) => {
        console.error('Failed to load PDF:', error);
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
        this.pdfUrl = null;
        this.sanitizedPdfUrl = null;
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
}
