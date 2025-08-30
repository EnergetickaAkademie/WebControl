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
  
  // Fullscreen state management
  isFullscreen = false;
  
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
          // Auto-enter fullscreen for slide rounds
          if (!this.isFullscreen) {
            setTimeout(() => this.enterFullscreen(), 100);
          }
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
          // Auto-enter fullscreen for slide rounds
          if (!this.isFullscreen) {
            setTimeout(() => this.enterFullscreen(), 100);
          }
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

  // Helper method to determine if a board should be shown as placeholder
  isBoardPlaceholder(board: any): boolean {
    return !board || board.is_placeholder || board.connected === false;
  }

  // Helper method to get team display name
  getTeamDisplayName(board: any): string {
    // Use display_name from backend if available, otherwise fall back to generated name
    if (board?.display_name) {
      return board.display_name;
    }
    // Fallback for backwards compatibility
    if (!board?.board_id) return 'Team 0';
    const match = board.board_id.toString().match(/\d+/);
    const teamNumber = match ? parseInt(match[0], 10) : 0;
    return `Team ${teamNumber}`;
  }

  // Helper method to get team number from board_id (kept for backwards compatibility)
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
    if (!board || board.is_placeholder || board.connected === false) {
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
    
    // If we have display data from the current round, use it
    if ((this.currentRound as any)?.display_data?.name) {
      return (this.currentRound as any).display_data.name;
    }
    
    // Fallback to translations
    const roundType = this.currentRoundDetails.round_type;
    if (roundType === 1) { // DAY
      return this.translations.round_types?.DAY?.name || 'Den';
    } else if (roundType === 2) { // NIGHT
      return this.translations.round_types?.NIGHT?.name || 'Noc';
    }
    return '';
  }

  get weatherInfo(): any {
    // First check if we have display data from current round
    if ((this.currentRound as any)?.display_data) {
      console.log('Using display data from current round:', (this.currentRound as any).display_data);
      return (this.currentRound as any).display_data;
    }
    
    // Fallback to the old weather system
    if (!this.currentRoundDetails?.weather || this.currentRoundDetails.weather.length === 0) {
      console.log('No weather data available in currentRoundDetails');
      return null;
    }
    
    // Get the first weather condition
    const weather = this.currentRoundDetails.weather[0];
    console.log('Weather condition:', weather);
    const weatherTranslation = this.translations.weather?.[weather.name.toUpperCase()] || null;
    console.log('Weather translation:', weatherTranslation);
    return weatherTranslation;
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
    // First check if we have display data from current round with effects
    const displayData = (this.currentRound as any)?.display_data;
    if (displayData?.effects && displayData.effects.length > 0) {
      return displayData.effects;
    }
    
    // Fallback to old weather system
    if (!this.currentRoundDetails?.weather) return [];
    
    let effects: any[] = [];
    
    // Collect effects from all weather conditions
    this.currentRoundDetails.weather.forEach((weather: any) => {
      const weatherTranslation = this.translations.weather?.[weather.name.toUpperCase()];
      if (weatherTranslation?.effects) {
        effects = effects.concat(weatherTranslation.effects);
      }
    });
    
    return effects;
  }

    // New Weather Box Getters
  get weatherBoxBackground(): string {
    const weatherInfo = this.weatherInfo;
    if (weatherInfo?.background_image) {
      return weatherInfo.background_image;
    }
    
    // Fallback to round type background
    const roundType = this.currentRoundDetails?.round_type || this.currentRound?.round_type;
    if (roundType === 1) { // DAY
      return this.translations.round_types?.DAY?.background_image || '';
    } else if (roundType === 2) { // NIGHT
      return this.translations.round_types?.NIGHT?.background_image || '';
    }
    return '';
  }

  get weatherMainIcon(): SafeHtml {
    const weatherInfo = this.weatherInfo;
    if (weatherInfo?.icon_url) {
      return this.s.bypassSecurityTrustHtml(`<img src="${weatherInfo.icon_url}" alt="Weather icon" style="width: 100%; height: 100%; object-fit: contain;">`);
    }
    
    // Fallback to round type icon
    const roundType = this.currentRoundDetails?.round_type || this.currentRound?.round_type;
    if (roundType === 1) { // DAY
      const iconUrl = this.translations.round_types?.DAY?.icon_url;
      if (iconUrl) {
        return this.s.bypassSecurityTrustHtml(`<img src="${iconUrl}" alt="Day icon" style="width: 100%; height: 100%; object-fit: contain;">`);
      }
    } else if (roundType === 2) { // NIGHT
      const iconUrl = this.translations.round_types?.NIGHT?.icon_url;
      if (iconUrl) {
        return this.s.bypassSecurityTrustHtml(`<img src="${iconUrl}" alt="Night icon" style="width: 100%; height: 100%; object-fit: contain;">`);
      }
    }
    return '';
  }

  get weatherTemperature(): string {
    const weatherInfo = this.weatherInfo;
    if (weatherInfo?.temperature) {
      return weatherInfo.temperature;
    }
    
    // Fallback to round type default temperature
    const roundType = this.currentRoundDetails?.round_type || this.currentRound?.round_type;
    if (roundType === 1) { // DAY
      return this.translations.round_types?.DAY?.default_temperature || '25°';
    } else if (roundType === 2) { // NIGHT
      return this.translations.round_types?.NIGHT?.default_temperature || '10°';
    }
    return '';
  }

  get weatherTypeName(): string {
    const weatherInfo = this.weatherInfo;
    if (weatherInfo?.name) {
      return weatherInfo.name;
    }
    
    // Fallback to round type default weather
    const roundType = this.currentRoundDetails?.round_type || this.currentRound?.round_type;
    if (roundType === 1) { // DAY
      return this.translations.round_types?.DAY?.default_weather || 'skoro jasno';
    } else if (roundType === 2) { // NIGHT
      return this.translations.round_types?.NIGHT?.default_weather || 'jasná noc';
    }
    return '';
  }

  get windInfo(): boolean {
    const weatherInfo = this.weatherInfo;
    if (weatherInfo?.show_wind === true) {
      return true;
    }
    
    // Fallback: show wind for day rounds (for testing purposes)
    const roundType = this.currentRoundDetails?.round_type || this.currentRound?.round_type;
    if (roundType === 1) { // DAY - show wind by default for testing
      return true;
    }
    
    return false;
  }

  get windIcon(): SafeHtml {
    // Wind icon as specified
    return this.s.bypassSecurityTrustHtml(`
      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.88 74.78" style="fill: #333; width: 48px; height: 48px;">
        <g>
          <path d="M28.69,53.38c-1.61,0-2.91-1.3-2.91-2.91c0-1.61,1.3-2.91,2.91-2.91h51.37c0.21,0,0.42,0.02,0.62,0.07 c1.84,0.28,3.56,0.8,5.1,1.63c1.7,0.92,3.15,2.19,4.27,3.89c3.85,5.83,3.28,11.24,0.56,15.24c-1.77,2.61-4.47,4.55-7.45,5.57 c-3,1.03-6.32,1.13-9.32,0.03c-4.54-1.66-8.22-5.89-8.76-13.55c-0.11-1.6,1.1-2.98,2.7-3.09c1.6-0.11,2.98,1.1,3.09,2.7 c0.35,4.94,2.41,7.56,4.94,8.48c1.71,0.62,3.67,0.54,5.48-0.08c1.84-0.63,3.48-1.79,4.52-3.32c1.49-2.19,1.71-5.28-0.61-8.79 c-0.57-0.86-1.31-1.51-2.18-1.98c-0.91-0.49-1.97-0.81-3.13-0.99H28.69L28.69,53.38z M15.41,27.21c-1.61,0-2.91-1.3-2.91-2.91 c0-1.61,1.3-2.91,2.91-2.91h51.21c1.17-0.18,2.23-0.5,3.14-0.99c0.87-0.47,1.61-1.12,2.18-1.98c2.32-3.51,2.09-6.6,0.61-8.79 c-1.04-1.53-2.68-2.69-4.52-3.32c-1.81-0.62-3.78-0.7-5.48-0.08c-2.52,0.92-4.59,3.54-4.94,8.48c-0.11,1.6-1.49,2.81-3.09,2.7 c-1.6-0.11-2.81-1.49-2.7-3.09c0.54-7.66,4.22-11.89,8.76-13.55c3-1.09,6.32-0.99,9.32,0.03c2.98,1.02,5.68,2.97,7.45,5.57 c2.72,4,3.29,9.41-0.56,15.24c-1.12,1.7-2.57,2.97-4.27,3.89c-1.54,0.83-3.26,1.35-5.1,1.63c-0.2,0.04-0.41,0.07-0.62,0.07H15.41 L15.41,27.21z M2.91,40.3C1.3,40.3,0,38.99,0,37.39c0-1.61,1.3-2.91,2.91-2.91h107.07c1.17-0.18,2.23-0.5,3.13-0.99 c0.87-0.47,1.61-1.12,2.18-1.98c2.32-3.51,2.09-6.6,0.61-8.79c-1.04-1.53-2.68-2.69-4.52-3.32c-1.81-0.62-3.78-0.7-5.48-0.08 c-2.52,0.92-4.59,3.54-4.94,8.48c-0.11,1.6-1.49,2.81-3.09,2.7c-1.6-0.11-2.81-1.49-2.7-3.09c0.54-7.66,4.22-11.89,8.76-13.55 c3-1.09,6.32-0.99,9.32,0.03c2.98,1.02,5.68,2.97,7.45,5.57c2.72,4,3.29,9.41-0.56,15.24c-1.12,1.7-2.57,2.97-4.27,3.89 c-1.54,0.83-3.26,1.35-5.1,1.63c-0.2,0.04-0.41,0.07-0.62,0.07H2.91L2.91,40.3z"/>
        </g>
      </svg>
    `);
  }

  get windSpeed(): string {
    const weatherInfo = this.weatherInfo;
    if (weatherInfo?.wind_speed) {
      return weatherInfo.wind_speed;
    }
    
    // Fallback default wind speed
    return '5 m/s';
  }

  // Fullscreen management methods
  toggleFullscreen() {
    if (this.isFullscreen) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen();
    }
  }

  enterFullscreen() {
    // Check if we're already in fullscreen
    const isActuallyFullscreen = !!(document.fullscreenElement || 
                                   (document as any).webkitFullscreenElement || 
                                   (document as any).msFullscreenElement);
    
    if (isActuallyFullscreen) {
      this.isFullscreen = true;
      return;
    }
    
    const element = document.documentElement;
    
    try {
      if (element.requestFullscreen) {
        element.requestFullscreen().then(() => {
          this.isFullscreen = true;
        }).catch((error) => {
          console.warn('Failed to enter fullscreen:', error);
        });
      } else if ((element as any).webkitRequestFullscreen) {
        (element as any).webkitRequestFullscreen();
        this.isFullscreen = true;
      } else if ((element as any).msRequestFullscreen) {
        (element as any).msRequestFullscreen();
        this.isFullscreen = true;
      }
    } catch (error) {
      console.warn('Error entering fullscreen:', error);
    }
  }

  exitFullscreen() {
    // Check if we're actually in fullscreen before trying to exit
    const isActuallyFullscreen = !!(document.fullscreenElement || 
                                   (document as any).webkitFullscreenElement || 
                                   (document as any).msFullscreenElement);
    
    if (!isActuallyFullscreen) {
      // Update our state to match reality
      this.isFullscreen = false;
      return;
    }
    
    try {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((error) => {
          console.warn('Failed to exit fullscreen:', error);
          this.isFullscreen = false;
        });
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    } catch (error) {
      console.warn('Error exiting fullscreen:', error);
      this.isFullscreen = false;
    }
  }

  // Listen for fullscreen changes
  @HostListener('document:fullscreenchange', [])
  @HostListener('document:webkitfullscreenchange', [])
  @HostListener('document:msfullscreenchange', [])
  onFullscreenChange() {
    this.isFullscreen = !!(document.fullscreenElement || 
                          (document as any).webkitFullscreenElement || 
                          (document as any).msFullscreenElement);
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
        case 'f':
          event.preventDefault();
          this.toggleFullscreen();
          break;
        case 'escape':
          if (this.isFullscreen) {
            event.preventDefault();
            this.exitFullscreen();
          }
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
