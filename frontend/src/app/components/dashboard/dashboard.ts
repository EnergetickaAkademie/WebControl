import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
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

  // Helper method to get team number from board_id
  getTeamNumber(board: any): number {
    if (!board?.board_id) return 0;
    const match = board.board_id.toString().match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
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
    // Sort boards by board_id to ensure consistent ordering
    const sortedBoards = this.connectedBoards.slice().sort((a, b) => {
      // Extract numeric part of board_id for proper sorting (e.g., board1, board2, board10)
      const getNumericId = (board: any) => {
        const match = board.board_id?.toString().match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      };
      return getNumericId(a) - getNumericId(b);
    });
    
    // Pad to even number of teams if needed (minimum 6 teams)
    const paddedBoards = this.padToEvenTeams(sortedBoards);
    
    // Fill left column first: take first 3 teams (Team 1, Team 2, Team 3)
    const maxLeftColumn = 3;
    return paddedBoards.slice(0, maxLeftColumn);
  }

  getRightBoards(): any[] {
    // Sort boards by board_id to ensure consistent ordering
    const sortedBoards = this.connectedBoards.slice().sort((a, b) => {
      // Extract numeric part of board_id for proper sorting (e.g., board1, board2, board10)
      const getNumericId = (board: any) => {
        const match = board.board_id?.toString().match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      };
      return getNumericId(a) - getNumericId(b);
    });
    
    // Pad to even number of teams if needed (minimum 6 teams)
    const paddedBoards = this.padToEvenTeams(sortedBoards);
    
    // Right column gets the remaining teams (Team 4, Team 5, Team 6...)
    const maxLeftColumn = 3;
    return paddedBoards.slice(maxLeftColumn);
  }

  // Helper method to pad teams to even number (minimum 6)
  private padToEvenTeams(boards: any[]): any[] {
    const minTeams = 6;
    const targetCount = Math.max(minTeams, boards.length % 2 === 0 ? boards.length : boards.length + 1);
    
    const paddedBoards = [...boards];
    
    // Add inactive placeholder teams if needed
    for (let i = boards.length + 1; i <= targetCount; i++) {
      paddedBoards.push({
        board_id: `board${i}`,
        last_updated: null,
        production: 0,
        consumption: 0,
        is_placeholder: true
      });
    }
    
    return paddedBoards;
  }

  // Grid balance status indicator for teams
  getGridStatusIcon(board: any): SafeHtml {
    if (!board || board.is_placeholder) {
      return this.s.bypassSecurityTrustHtml('<img src="/icons/DASH_status_grey.svg" alt="Inactive" style="width: 32px; height: 32px;">');
    }
    
    const production = board.production || 0;
    const consumption = board.consumption || 0;
    const balance = production - consumption;
    
    let iconPath: string;
    if (Math.abs(balance) <= 1) { // Within 1 MW tolerance - green (balanced)
      iconPath = '/icons/DASH_status_green.svg';
    } else if (Math.abs(balance) <= 5) { // Within 5 MW tolerance - orange (warning) 
      iconPath = '/icons/DASH_status_orange.svg';
    } else { // Over 5 MW imbalance - red (critical)
      iconPath = '/icons/DASH_status_red.svg';
    }
    
    return this.s.bypassSecurityTrustHtml(`<img src="${iconPath}" alt="Grid status" style="width: 32px; height: 32px;">`);
  }

  // Weather and round info getters
  get roundIcon(): SafeHtml {
    // If we don't have round details, try to use the current round data
    const roundType = this.currentRoundDetails?.round_type || this.currentRound?.round_type;
    if (!roundType) {
      return '';
    }

    const weather = this.currentRoundDetails?.weather || [];
    const isCloudy = weather && weather.some && weather.some((w: any) => w.name && w.name.toLowerCase().includes('cloud'));
    
    let iconPath: string = "";
    if (roundType === 1) { // DAY
      if (isCloudy) {
        iconPath = "/icons/DASH_cloud.svg";
      } else {
        iconPath = "/icons/DASH_sunny.svg";
      }
    } else if (roundType === 2) { // NIGHT
      iconPath = "/icons/DASH_moon.svg";
    }
    
    return iconPath ? this.s.bypassSecurityTrustHtml(`<img src="${iconPath}" alt="Weather icon" style="width: 400px; height: 400px;">`) : '';
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

  // Keyboard event handlers
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    // Handle keyboard events in game and presentation views
    if (this.currentView === 'game' || this.currentView === 'presentation') {
      switch (event.key.toLowerCase()) {
        case 'q':
          event.preventDefault();
          this.confirmEndGame();
          break;
        case 'l':
          event.preventDefault();
          this.confirmLogout();
          break;
        case 'arrowright':
          // Only handle right arrow in game view, not in presentation view
          // Presentation view should handle its own slide navigation
          if (this.currentView === 'game') {
            event.preventDefault();
            if (!this.isGameLoading) {
              this.nextRound();
            }
          }
          break;
      }
    }
  }

  confirmEndGame() {
    if (confirm('Are you sure you want to end the game? This action cannot be undone.')) {
      this.endGame();
    }
  }

  confirmLogout() {
    if (confirm('Are you sure you want to logout?')) {
      this.logout();
    }
  }
}
