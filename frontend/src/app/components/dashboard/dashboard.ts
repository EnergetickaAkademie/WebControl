import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService, GameStatusService } from '../../services';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { interval, Subscription } from 'rxjs';
import { SlidePresentationComponent } from '../slide-presentation/slide-presentation';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// Debug utility - checks for debug flag in localStorage or URL params
const DEBUG = localStorage.getItem('DEBUG') === 'true' || new URLSearchParams(window.location.search).get('debug') === 'true';

function debugLog(message: string, ...args: any[]) {
  if (DEBUG) {
    console.log(`DEBUG: ${message}`, ...args);
  }
}

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
  display_data?: any; // Include display_data for weather effects
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
  connectedBoards: any[] = [];
  boardNames: {[key: string]: string} = {}; // Mapping of board_id to display_name
  isLoading = true;
  isGameLoading = false;
  
  // Game state
  currentView: 'presentation' | 'game' = 'game';
  currentRound: GameRound | null = null;
  currentRoundDetails: any = null; // Store detailed round information
  // Track finished state to avoid premature redirect from final slide range
  gameFinished: boolean = false;
  // Removed auto-redirect; overlay stays until user chooses.
  
  // Fullscreen state management
  isFullscreen = false;
  
  // Loading states to prevent flickering
  private isLoadingRound = false;
  private roundTransitionTimeout: any = null;
  
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
    private route: ActivatedRoute,
    private s: DomSanitizer
  ) {}

  ngOnInit() {
    this.loadProfile();
    this.loadTranslations();
    this.checkReloadRecovery();
    
    // Start polling for game status
    this.startPolling();
    
    // Auto-enter fullscreen when dashboard loads
    setTimeout(() => {
      if (!this.isFullscreen) {
        this.enterFullscreen();
      }
    }, 500);
  }

  ngOnDestroy() {
    this.stopAllPolling();
    
    // Clear any pending timeout
    if (this.roundTransitionTimeout) {
      clearTimeout(this.roundTransitionTimeout);
      this.roundTransitionTimeout = null;
    }
  }

  loadProfile() {
    this.authService.profile().subscribe({
      next: (response: any) => {
  // Backend returns { user: {...} }
  this.userInfo = response.user || response.user_info || null;
        this.isLoading = false;
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
  next: (recovery: any) => {
          if (recovery.shouldRedirect && recovery.gameState) {
            console.log('Reload recovery - setting view to:', recovery.view);
            console.log('Game state:', recovery.gameState);
            
            // Restore game state
            this.gameStatus = recovery.gameState.gameStatus;
            this.currentRound = recovery.gameState.currentRound;
            this.currentRoundDetails = recovery.gameState.roundDetails;
            this.connectedBoards = recovery.gameState.boards || [];
            
            // Set the appropriate view - only handle presentation and game views
            if (recovery.view === 'setup') {
              // If recovery view is setup, redirect to setup page
              this.router.navigate(['/setup']);
              return;
            } else {
              this.currentView = recovery.view;
            }
            
            // Auto-enter fullscreen after recovery since we're in dashboard
            setTimeout(() => {
              if (!this.isFullscreen) {
                this.enterFullscreen();
              }
            }, 100);
            
            console.log('Reload recovery complete - current view:', this.currentView);
          }
        },
  error: (error: any) => {
          console.error('Failed to check reload recovery:', error);
        }
      });
    }
  }

  startPolling() {
    // Initialize polling for game status updates
    // Stop any existing polling first
    this.stopAllPolling();
    
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
          this.boardNames = response.board_names || {}; // Store board names mapping
          this.currentRoundDetails = response.round_details;
          
          // If game inactive: only redirect when there is clearly no finished round context
          if (!this.gameStatus?.game_active) {
            // Don't redirect if the game end dialog is currently shown
            if (!this.gameFinished) {
              // If there are no round details at all (e.g. user refreshed after game ended), then redirect
              if (!this.currentRoundDetails || Object.keys(this.currentRoundDetails).length === 0) {
                this.router.navigate(['/setup']);
              }
            }
            // Do not return early; we still want to preserve last known round details for overlay
          }
          
          // Update current round with detailed information if available
          if (response.round_details && this.gameStatus.game_active) {
            this.currentRound = {
              round: this.gameStatus.current_round,
              round_type: response.round_details.round_type,
              game_data: {
                production_coefficients: response.round_details.production_coefficients || {},
                consumption_modifiers: response.round_details.building_consumptions || {}
              },
              display_data: response.round_details.display_data // Include display_data for effects
            };

            // Dynamically switch view based on round type during polling
            const rt = response.round_details.round_type;
            if (rt === RoundType.SLIDE || rt === RoundType.SLIDE_RANGE) {
              if (this.currentView !== 'presentation') {
                console.log('Polling detected slide round -> switching to presentation view');
                this.currentView = 'presentation';
                // Ensure fullscreen is maintained (dashboard should always be fullscreen)
                if (!this.isFullscreen) {
                  setTimeout(() => this.enterFullscreen(), 0);
                }
              }
            } else if (rt === RoundType.DAY || rt === RoundType.NIGHT) {
              if (this.currentView !== 'game') {
                console.log('Polling detected day/night round -> switching to game view');
                this.currentView = 'game';
                // Ensure fullscreen is maintained (dashboard should always be fullscreen)
                if (!this.isFullscreen) {
                  setTimeout(() => this.enterFullscreen(), 0);
                }
              }
            }
          }
          // Extra safety: if game active but we somehow lack round details, keep user in game view
          if (!this.currentRoundDetails && this.gameStatus?.game_active && this.currentView === 'presentation') {
            console.warn('Missing round details while in presentation view, reverting to game view');
            this.currentView = 'game';
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

  callNextRoundFromStart() {
    // Special version of nextRound called from startGame - don't reset loading state
    this.isLoadingRound = true;
    
    // Clear any existing timeout
    if (this.roundTransitionTimeout) {
      clearTimeout(this.roundTransitionTimeout);
    }
    
    console.log('Calling next round from start...');
    this.authService.nextRound().subscribe({
      next: (response: any) => {
        console.log('Advanced to next round:', response);
        debugLog('Full nextRound response from start:', JSON.stringify(response));
        this.currentRound = response;
        
        // Set round details from the response - important for slide data
        this.currentRoundDetails = {
          round_type: response.round_type,
          slide: response.slide, // for single slides
          slides: response.slides, // for slide ranges
          slide_range: response.slide_range, // for slide range metadata
          comment: response.comment,
          buildings_comment: response.buildings_comment, // buildings comment from scenario
          outages: response.outages || [], // outages list
          cumulative_registered_sources: response.cumulative_registered_sources || [], // cumulative registered/allowed sources
          weather: response.weather,
          production_coefficients: response.game_data?.production_coefficients,
          consumption_modifiers: response.game_data?.consumption_modifiers,
          display_data: response.display_data
        };
        
        if (response.status === 'game_finished') {
          // Immediately show end-of-scenario overlay (previously waited for manual advance)
          console.log('Game finished status received – displaying end-of-scenario overlay');
          this.handleScenarioFinished();
          return;
        } else if (response.round_type === RoundType.SLIDE || response.round_type === RoundType.SLIDE_RANGE) {
          console.log('Slides round, switching to presentation view');
          this.currentView = 'presentation';
          // Ensure fullscreen is maintained (dashboard should always be fullscreen)
          if (!this.isFullscreen) {
            setTimeout(() => this.enterFullscreen(), 100);
          }
        } else if (response.round_type === RoundType.DAY || response.round_type === RoundType.NIGHT) {
          console.log('Game round, switching to game view');
          this.currentView = 'game';
          // Ensure fullscreen is maintained (dashboard should always be fullscreen)
          if (!this.isFullscreen) {
            setTimeout(() => this.enterFullscreen(), 100);
          }
        }
        
        // Add a small delay to ensure display data is stable before showing effects
        this.roundTransitionTimeout = setTimeout(() => {
          this.isLoadingRound = false;
        }, 300);
        
        this.isGameLoading = false;
      },
      error: (error: any) => {
        console.error('Failed to advance round from start:', error);
        // Check if error indicates game/scenario has finished
        if (error.status === 400 && error.error && 
            (error.error.message || '').toLowerCase().includes('finished')) {
          console.log('Game finished detected from callNextRoundFromStart error - showing dialog');
          this.handleScenarioFinished();
        }
        this.isLoadingRound = false;
        this.isGameLoading = false;
      }
    });
  }

  nextRound() {
    this.isGameLoading = true;
    this.isLoadingRound = true;
    
    // Clear any existing timeout
    if (this.roundTransitionTimeout) {
      clearTimeout(this.roundTransitionTimeout);
    }
    
    console.log('Calling next round...');
    this.authService.nextRound().subscribe({
      next: (response: any) => {
        console.log('Advanced to next round:', response);
        debugLog('Full nextRound response:', JSON.stringify(response));
        this.currentRound = response;
        
        // Set round details from the response - important for slide data
        this.currentRoundDetails = {
          round_type: response.round_type,
          slide: response.slide, // for single slides
          slides: response.slides, // for slide ranges
          slide_range: response.slide_range, // for slide range metadata
          comment: response.comment,
          buildings_comment: response.buildings_comment, // buildings comment from scenario
          outages: response.outages || [], // outages list
          cumulative_registered_sources: response.cumulative_registered_sources || [], // cumulative registered/allowed sources
          weather: response.weather,
          production_coefficients: response.game_data?.production_coefficients,
          consumption_modifiers: response.game_data?.consumption_modifiers,
          display_data: response.display_data
        };
        
        if (response.status === 'game_finished') {
          // Immediately show end-of-scenario overlay (previously waited for manual advance)
          console.log('Game finished status received – displaying end-of-scenario overlay');
          this.handleScenarioFinished();
          return;
        } else if (response.round_type === RoundType.SLIDE || response.round_type === RoundType.SLIDE_RANGE) {
          console.log('Slides round, switching to presentation view');
          this.currentView = 'presentation';
          // Ensure fullscreen is maintained (dashboard should always be fullscreen)
          if (!this.isFullscreen) {
            setTimeout(() => this.enterFullscreen(), 100);
          }
        } else if (response.round_type === RoundType.DAY || response.round_type === RoundType.NIGHT) {
          console.log('Game round, switching to game view');
          this.currentView = 'game';
          // Ensure fullscreen is maintained (dashboard should always be fullscreen)
          if (!this.isFullscreen) {
            setTimeout(() => this.enterFullscreen(), 100);
          }
        }
        
        // Add a small delay to ensure display data is stable before showing effects
        this.roundTransitionTimeout = setTimeout(() => {
          this.isLoadingRound = false;
        }, 300);
        
        this.isGameLoading = false;
      },
      error: (error: any) => {
        console.error('Failed to advance round:', error);
        // Check if error indicates game/scenario has finished
        if (error.status === 400 && error.error && 
            (error.error.message || '').toLowerCase().includes('finished')) {
          console.log('Game finished detected from nextRound error - showing dialog');
          this.handleScenarioFinished();
        }
        this.isLoadingRound = false;
        this.isGameLoading = false;
      }
    });
  }

  endGame() {
    this.isGameLoading = true;
    this.authService.endGame().subscribe({
      next: (response: any) => {
        console.log('Game ended:', response);
        this.router.navigate(['/setup']);
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
    return !board || !board.connected;
  }

  // Helper method to get team display name
  getTeamDisplayName(board: any): string {
    // Debug logging to see what data we're getting
    debugLog('getTeamDisplayName called with board:', board);
    debugLog('board.display_name =', board?.display_name);
    debugLog('board.board_id =', board?.board_id);
    debugLog('boardNames mapping =', this.boardNames);
    
    // First try the board_names mapping from API response
    if (board?.board_id && this.boardNames[board.board_id]) {
      debugLog('Using boardNames mapping:', this.boardNames[board.board_id]);
      return this.boardNames[board.board_id];
    }
    
    // Use display_name from backend if available, otherwise fall back to generated name
    if (board?.display_name) {
      debugLog('Using backend display_name:', board.display_name);
      return board.display_name;
    }
    // Fallback for backwards compatibility
    if (!board?.board_id) {
      debugLog('No board_id, returning Tým 0');
      return 'Tým 0';
    }
    const match = board.board_id.toString().match(/\d+/);
    const teamNumber = match ? parseInt(match[0], 10) : 0;
    const fallbackName = `Tým ${teamNumber}`;
    debugLog('Using fallback name:', fallbackName);
    return fallbackName;
  }

  // Helper method to get team number from board_id (kept for backwards compatibility)
  getTeamNumber(board: any): number {
    if (!board?.board_id) return 0;
    const match = board.board_id.toString().match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  // Helper method to get all boards in one array for single column display
  getAllBoards(): any[] {
    // Sort boards by board_id to ensure consistent ordering
    const sortedBoards = this.connectedBoards.slice().sort((a, b) => {
      const getNumericId = (board: any) => {
        const match = board.board_id?.toString().match(/\d+/g);
        return match ? parseInt(match[match.length - 1], 10) : 0;
      };
      return getNumericId(a) - getNumericId(b);
    });
    return sortedBoards;
  }

  // Helper method to get team background color based on status
  getTeamBackgroundColor(board: any): string {
    if (!board || !board.connected) {
      return '#b5b5b5'; // Grey for not connected
    }

    const production = board.production || 0;
    const consumption = board.consumption || 0;
    const balance = production - consumption;
    
    if (Math.abs(balance) <= 1) {
      return '#8cc63f'; // Green for balanced
    } else if (Math.abs(balance) <= 5) {
      return '#fbb03b'; // Yellow for not perfectly balanced
    } else {
      return '#ff3131'; // Red for blackout
    }
  }

  // Helper method to check if a power plant is allowed
  isPowerPlantAllowed(plantIndex: number): boolean {
    // plantIndex: 0=coal(thermal), 1=gas, 2=nuclear, 3=hydro_storage, 4=hydro, 5=wind, 6=photovoltaic(solar)
    if (!this.currentRoundDetails?.cumulative_registered_sources) {
      return false; // Default to disabled if no data
    }
    
    const cumulativeSources = this.currentRoundDetails.cumulative_registered_sources;
    // Map icons to backend Source enum names (as they are sent via str())
    // Backend converts enum names to Title Case with spaces: COAL -> "Coal", HYDRO_STORAGE -> "Hydro Storage"
    const plantKeys = ['Coal', 'Gas', 'Nuclear', 'Hydro Storage', 'Hydro', 'Wind', 'Photovoltaic'];
    const key = plantKeys[plantIndex];
    
    // Check if the source is in the cumulative registered sources list
    return cumulativeSources.includes(key);
  }

  // Helper method to get scenario comment
  get scenarioComment(): string {
    return this.currentRoundDetails?.comment || '';
  }

  // Helper method to get buildings comment
  get buildingsComment(): string {
    return this.currentRoundDetails?.buildings_comment || '';
  }

  // Helper method to get outages
  get currentOutages(): string[] {
    return this.currentRoundDetails?.outages || [];
  }

  // Helper method to check if a source has an outage (only show if source is registered)
  hasOutage(sourceName: string): boolean {
    const outages = this.currentOutages;
    const cumulativeSources = this.currentRoundDetails?.cumulative_registered_sources || [];
    
    // Only show outage if the source is both in outages list AND in cumulative registered sources
    return outages.includes(sourceName) && cumulativeSources.includes(sourceName);
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
      // Extract numeric part of board_id for proper sorting (e.g., w1b1, w1b2, w1b10)
      const getNumericId = (board: any) => {
        const match = board.board_id?.toString().match(/\d+/g);
        return match ? parseInt(match[match.length - 1], 10) : 0;
      };
      return getNumericId(a) - getNumericId(b);
    });
    
    // Pad to minimum number of teams if needed (5 teams)
    const paddedBoards = this.padToEvenTeams(sortedBoards);
    
    // Fill left column first: take first 3 teams (Team 1, Team 2, Team 3)
    const maxLeftColumn = 3;
    return paddedBoards.slice(0, maxLeftColumn);
  }

  getRightBoards(): any[] {
    // Sort boards by board_id to ensure consistent ordering
    const sortedBoards = this.connectedBoards.slice().sort((a, b) => {
      // Extract numeric part of board_id for proper sorting (e.g., w1b1, w1b2, w1b10)
      const getNumericId = (board: any) => {
        const match = board.board_id?.toString().match(/\d+/g);
        return match ? parseInt(match[match.length - 1], 10) : 0;
      };
      return getNumericId(a) - getNumericId(b);
    });
    
    // Pad to minimum number of teams if needed (5 teams)
    const paddedBoards = this.padToEvenTeams(sortedBoards);
    
    // Right column gets the remaining teams (Team 4, Team 5)
    const maxLeftColumn = 3;
    return paddedBoards.slice(maxLeftColumn);
  }

  // Helper method to pad teams to minimum number (5 teams)
  private padToEvenTeams(boards: any[]): any[] {
    // Since backend now provides all configured boards, just return them sorted
    return boards.sort((a, b) => {
      const getNumericId = (board: any) => {
        const match = board.board_id?.toString().match(/\d+/g);
        return match ? parseInt(match[match.length - 1], 10) : Number.MAX_SAFE_INTEGER;
      };
      return getNumericId(a) - getNumericId(b);
    });
  }

  // Grid balance status indicator for teams
  getGridStatusIcon(board: any): string {
    if (!board || !board.connected) {
        return '/icons/DASH_status_grey.svg';
    }

    const production = board.production || 0;
    const consumption = board.consumption || 0;
    const balance = production - consumption;
    
    if (Math.abs(balance) <= 1) {
        return '/icons/DASH_status_green.svg';
    } else if (Math.abs(balance) <= 5) {
        return '/icons/DASH_status_orange.svg';
    } else {
        return '/icons/DASH_status_red.svg';
    }
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
    // 1. First check if we have display_data from polling (currentRoundDetails)
    if (this.currentRoundDetails?.display_data) {
        return this.currentRoundDetails.display_data;
    }

    // 2. Check if we have display_data from the current round response
    const displayData = (this.currentRound as any)?.display_data;
    if (displayData) {
        return displayData;
    }

    // 3. Fallback to the old system only if display_data is not available
    if (!this.translations || !this.translations.weather) {
        return null;
    }
    
    if (!this.currentRoundDetails?.weather || 
        this.currentRoundDetails.weather.length === 0 ||
        !this.currentRoundDetails.weather[0]?.name) {
        return null;
    }
    
    const weather = this.currentRoundDetails.weather[0];
    const weatherTranslation = this.translations.weather?.[weather.name.toUpperCase()] || null;
    
    return weatherTranslation;
}

  /**
   * Apply fallback logic for temperature and wind_speed.
   * If temperature or wind_speed is null/undefined, iterate through all weather conditions to find a real value.
   */
  private applyWeatherFallbacks(displayData: any): any {
    if (!displayData) return null;
    
    // Create a copy to avoid modifying the original
    const data = { ...displayData };
    
    // Define the order of weather conditions to check for fallbacks
    const weatherFallbackOrder = [
      'SUNNY', 'PARTLY_CLOUDY', 'CLOUDY', 'WINDY', 'BREEZY', 'CALM',
      'RAINY', 'SNOWY', 'FOGGY', 'DAY', 'NIGHT'
    ];
    
    // Apply temperature fallback if needed
    if (data.temperature === null || data.temperature === undefined || data.temperature === '') {
      for (const weatherKey of weatherFallbackOrder) {
        const fallbackWeather = this.translations?.weather?.[weatherKey] || this.translations?.round_types?.[weatherKey];
        if (fallbackWeather?.temperature && fallbackWeather.temperature !== null && fallbackWeather.temperature !== '') {
          data.temperature = fallbackWeather.temperature;
          debugLog(`Temperature fallback: using ${fallbackWeather.temperature} from ${weatherKey}`);
          break;
        }
      }
      
      // Final fallback if no temperature found
      if (!data.temperature) {
        data.temperature = '18°';
        debugLog('Temperature fallback: using default 18°');
      }
    }
    
    // Apply wind_speed fallback if needed
    if (data.wind_speed === null || data.wind_speed === undefined || data.wind_speed === '') {
      for (const weatherKey of weatherFallbackOrder) {
        const fallbackWeather = this.translations?.weather?.[weatherKey] || this.translations?.round_types?.[weatherKey];
        if (fallbackWeather?.wind_speed && fallbackWeather.wind_speed !== null && fallbackWeather.wind_speed !== '') {
          data.wind_speed = fallbackWeather.wind_speed;
          debugLog(`Wind speed fallback: using ${fallbackWeather.wind_speed} from ${weatherKey}`);
          break;
        }
      }
      
      // Final fallback if no wind speed found
      if (!data.wind_speed) {
        data.wind_speed = '3 m/s';
        debugLog('Wind speed fallback: using default 3 m/s');
      }
    }
    
    return data;
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
    // Don't show effects during round transitions to prevent flickering
    if (this.isLoadingRound || this.isGameLoading) {
      return [];
    }

    // Ensure we have stable data before showing effects
    if (!this.currentRound || !this.translations || !this.translations.weather) {
      return [];
    }

    // Always prefer display data from current round details (where backend sends it)
    const displayData = this.currentRoundDetails?.display_data || (this.currentRound as any)?.display_data;
    if (displayData !== undefined) {
      // Return the filtered effects from backend (already priority-filtered)
      return displayData.effects || [];
    }
    
    // Only fallback to old weather system if no display_data exists at all
    // and we have stable weather data
    if (!this.currentRoundDetails?.weather || this.currentRoundDetails.weather.length === 0) {
      return [];
    }
    
    let effects: any[] = [];
    
    // Collect effects from all weather conditions (now each weather condition is pre-filtered)
    this.currentRoundDetails.weather.forEach((weather: any) => {
      if (weather && weather.name) {
        const weatherTranslation = this.translations.weather?.[weather.name.toUpperCase()];
        if (weatherTranslation?.effects) {
          effects = effects.concat(weatherTranslation.effects);
        }
      }
    });
    
    // Apply priority filtering on frontend as backup (in case backend filtering failed)
    return this.filterEffectsByPriority(effects);
  }

  // Helper method to filter effects by priority (frontend backup)
  private filterEffectsByPriority(effects: any[]): any[] {
    if (!effects || effects.length === 0) return [];
    
    // Group effects by type (power plant type)
    const effectsByType = new Map<number, any[]>();
    const otherEffects: any[] = [];
    
    effects.forEach(effect => {
      if (effect.type !== undefined && effect.priority !== undefined) {
        if (!effectsByType.has(effect.type)) {
          effectsByType.set(effect.type, []);
        }
        effectsByType.get(effect.type)!.push(effect);
      } else {
        otherEffects.push(effect);
      }
    });
    
    // Keep only highest priority effect for each type
    const filteredEffects: any[] = [...otherEffects];
    effectsByType.forEach((typeEffects) => {
      // Sort by priority (higher number = higher priority)
      typeEffects.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      // Take the first (highest priority) effect
      filteredEffects.push(typeEffects[0]);
    });
    
    return filteredEffects;
  }

  // Helper method to remove duplicate effects based on text content
  private removeDuplicateEffects(effects: any[]): any[] {
    if (!effects || effects.length === 0) return [];
    
    const seen = new Set<string>();
    return effects.filter(effect => {
      const key = effect.text || effect.name || JSON.stringify(effect);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
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
    // This now correctly returns the random temperature from the backend's display_data
    // without any incorrect frontend fallbacks.
    return weatherInfo?.temperature || '';
  }

  get weatherTypeName(): string {
    const weatherInfo = this.weatherInfo;
    if (weatherInfo?.name) {
      return weatherInfo.name;
    }
    
    // Fallback to round type default weather
    const roundType = this.currentRoundDetails?.round_type || this.currentRound?.round_type;
    if (roundType === 1) { // DAY
      return this.translations.round_types?.DAY?.default_weather || 'Den';
    } else if (roundType === 2) { // NIGHT
      return this.translations.round_types?.NIGHT?.default_weather || 'Noc';
    }
    return '';
  }

  get windInfo(): boolean {
    const weatherInfo = this.weatherInfo;
    if (weatherInfo?.show_wind === true) {
      return true;
    }
    
    // Fallback: show wind for both day and night rounds (for testing purposes)
    const roundType = this.currentRoundDetails?.round_type || this.currentRound?.round_type;
    if (roundType === 1 || roundType === 2) { // DAY or NIGHT - show wind by default
      return true;
    }
    
    return false;
  }

  get windIcon(): SafeHtml {
    // Wind icon as specified
    // return this.s.bypassSecurityTrustHtml(`
    //   <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.88 74.78" style="fill: #333; width: 48px; height: 48px;">
    //     <g>
    //       <path d="M28.69,53.38c-1.61,0-2.91-1.3-2.91-2.91c0-1.61,1.3-2.91,2.91-2.91h51.37c0.21,0,0.42,0.02,0.62,0.07 c1.84,0.28,3.56,0.8,5.1,1.63c1.7,0.92,3.15,2.19,4.27,3.89c3.85,5.83,3.28,11.24,0.56,15.24c-1.77,2.61-4.47,4.55-7.45,5.57 c-3,1.03-6.32,1.13-9.32,0.03c-4.54-1.66-8.22-5.89-8.76-13.55c-0.11-1.6,1.1-2.98,2.7-3.09c1.6-0.11,2.98,1.1,3.09,2.7 c0.35,4.94,2.41,7.56,4.94,8.48c1.71,0.62,3.67,0.54,5.48-0.08c1.84-0.63,3.48-1.79,4.52-3.32c1.49-2.19,1.71-5.28-0.61-8.79 c-0.57-0.86-1.31-1.51-2.18-1.98c-0.91-0.49-1.97-0.81-3.13-0.99H28.69L28.69,53.38z M15.41,27.21c-1.61,0-2.91-1.3-2.91-2.91 c0-1.61,1.3-2.91,2.91-2.91h51.21c1.17-0.18,2.23-0.5,3.14-0.99c0.87-0.47,1.61-1.12,2.18-1.98c2.32-3.51,2.09-6.6,0.61-8.79 c-1.04-1.53-2.68-2.69-4.52-3.32c-1.81-0.62-3.78-0.7-5.48-0.08c-2.52,0.92-4.59,3.54-4.94,8.48c-0.11,1.6-1.49,2.81-3.09,2.7 c-1.6-0.11-2.81-1.49-2.7-3.09c0.54-7.66,4.22-11.89,8.76-13.55c3-1.09,6.32-0.99,9.32,0.03c2.98,1.02,5.68,2.97,7.45,5.57 c2.72,4,3.29,9.41-0.56,15.24c-1.12,1.7-2.57,2.97-4.27,3.89c-1.54,0.83-3.26,1.35-5.1,1.63c-0.2,0.04-0.41,0.07-0.62,0.07H15.41 L15.41,27.21z M2.91,40.3C1.3,40.3,0,38.99,0,37.39c0-1.61,1.3-2.91,2.91-2.91h107.07c1.17-0.18,2.23-0.5,3.13-0.99 c0.87-0.47,1.61-1.12,2.18-1.98c2.32-3.51,2.09-6.6,0.61-8.79c-1.04-1.53-2.68-2.69-4.52-3.32c-1.81-0.62-3.78-0.7-5.48-0.08 c-2.52,0.92-4.59,3.54-4.94,8.48c-0.11,1.6-1.49,2.81-3.09,2.7c-1.6-0.11-2.81-1.49-2.7-3.09c0.54-7.66,4.22-11.89,8.76-13.55 c3-1.09,6.32-0.99,9.32,0.03c2.98,1.02,5.68,2.97,7.45,5.57c2.72,4,3.29,9.41-0.56,15.24c-1.12,1.7-2.57,2.97-4.27,3.89 c-1.54,0.83-3.26,1.35-5.1,1.63c-0.2,0.04-0.41,0.07-0.62,0.07H2.91L2.91,40.3z"/>
    //     </g>
    //   </svg>
    // `);

    return this.s.bypassSecurityTrustHtml(`
    <img src="/icons/09_WINDY.svg" alt="Wind icon" style="width: 48px; height: 48px;">
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
    const wasFullscreen = this.isFullscreen;
    this.isFullscreen = !!(document.fullscreenElement || 
                          (document as any).webkitFullscreenElement || 
                          (document as any).msFullscreenElement);
    
    // If user exited fullscreen (e.g., via browser controls), re-enter automatically
    // Dashboard should always stay in fullscreen mode
    if (wasFullscreen && !this.isFullscreen) {
      console.log('Fullscreen was exited, re-entering automatically...');
      setTimeout(() => {
        if (!this.isFullscreen) {
          this.enterFullscreen();
        }
      }, 100);
    }
  }

  private lastNextRoundPress: number = 0;
  private nextRoundPressTimeout: any = null;
  private nextRoundRequiresDoublePress: boolean = true; // Enable/disable feature

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    // Handle different keyboard events based on current view
    if (this.currentView === 'game' || this.currentView === 'presentation') {
      // Game and presentation view controls
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
          // Dashboard should always stay in fullscreen - re-enter if user tries to exit
          event.preventDefault();
          if (!this.isFullscreen) {
            this.enterFullscreen();
          }
          break;
        case 'arrowright':
        case 'pagedown':
          // Only handle right arrow/page down in game view, not in presentation view
          // Presentation view should handle its own slide navigation
          if (this.currentView === 'game') {
            event.preventDefault();
            this.handleNextRoundAttempt();
          }
          break;
        case 'd': // Press 'D' to toggle double-press requirement (for debugging)
          if (event.ctrlKey) { // Only toggle when Ctrl is held to prevent accidental toggling
            event.preventDefault();
            this.toggleDoublePressRequirement();
          }
          break;
      }
    }
  }

  handleNextRoundAttempt() {
    if (this.isGameLoading) {
      return;
    }
    
    const now = Date.now();
    
    // If double-press is disabled, proceed immediately
    if (!this.nextRoundRequiresDoublePress) {
      this.executeNextRound();
      return;
    }
    
    // Check if this is the second press within the time window
    if (now - this.lastNextRoundPress < 1000) { // 1 second window
      // Clear any pending timeout
      if (this.nextRoundPressTimeout) {
        clearTimeout(this.nextRoundPressTimeout);
        this.nextRoundPressTimeout = null;
      }
      
      // This is a valid double-press, execute the next round
      this.lastNextRoundPress = 0;
      console.log('Double-press confirmed, advancing to next round');
      this.executeNextRound();
    } else {
      // First press - set the timestamp
      this.lastNextRoundPress = now;
      console.log('First press detected, press again within 1 second to advance');
      
      // Set a timeout to reset if the second press doesn't come
      this.nextRoundPressTimeout = setTimeout(() => {
        this.lastNextRoundPress = 0;
        this.nextRoundPressTimeout = null;
        console.log('Double-press timeout expired, press again to advance');
      }, 1000);
    }
  }

  executeNextRound() {
    // Always call nextRound() and let the backend decide if game is finished
    // The backend will return either the next round data or game_finished status
    console.log('Executing next round request...');
    this.nextRound();
  }

  // Method to toggle double-press requirement
  toggleDoublePressRequirement() {
    this.nextRoundRequiresDoublePress = !this.nextRoundRequiresDoublePress;
    console.log(`Double-press requirement: ${this.nextRoundRequiresDoublePress ? 'ENABLED' : 'DISABLED'}`);
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

  onContinueFromStatistics() {
    // Navigate to setup page when user clicks continue from statistics
    this.router.navigate(['/setup']);
  }

  navigateToStatistics() {
    this.router.navigate(['/statistics']);
  }

  // Handler for statistics request coming from slide presentation component
  onViewStatisticsRequest() {
    this.navigateToStatistics();
  }

  // Called when slide presentation reports scenario finished
  scenarioFinishedHandler() {
    console.log('scenarioFinishedHandler called - setting gameFinished to true');
    this.gameFinished = true;
    
    // Stop polling when game finishes to avoid interference with end dialog
    this.stopAllPolling();
    console.log('Scenario finished - showing end dialog overlay and stopping polling');
  }


  private handleScenarioFinished() {
    if (this.gameFinished) return; // Already handled
    console.log('Scenario finished – displaying overlay and stopping polling');
    this.gameFinished = true;
    
    // Stop polling when game finishes to avoid interference with end dialog
    this.stopAllPolling();
    console.log('Polling stopped - end dialog will remain until user chooses action');
  }
}
