import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { interval, Subscription } from 'rxjs';

// Debug utility - checks for debug flag in localStorage or URL params
const DEBUG = localStorage.getItem('DEBUG') === 'true' || new URLSearchParams(window.location.search).get('debug') === 'true';

function debugLog(message: string, ...args: any[]) {
  if (DEBUG) {
    console.log(`DEBUG: ${message}`, ...args);
  }
}

@Component({
  selector: 'app-scenario-selection',
  templateUrl: './scenario-selection.html',
  styleUrls: ['./scenario-selection.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class ScenarioSelectionComponent implements OnInit, OnDestroy {
  scenarios: any[] = [];
  selectedScenario: string | null = '';
  isGameLoading: boolean = false;
  connectedBoards: any[] = [];
  boardNames: {[key: string]: string} = {}; // Mapping of board_id to display_name
  gameStatus: any = null;
  userInfo: any = null;
  isLoading = true;
  isLoadingStatistics = false;

  private pollSubscription?: Subscription;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadProfile();
    this.startPolling();
    
    // Ensure we exit fullscreen when entering scenario selection
    this.ensureExitFullscreen();
  }

  private ensureExitFullscreen() {
    // Check if we're actually in fullscreen before trying to exit
    const isActuallyFullscreen = !!(document.fullscreenElement || 
                                   (document as any).webkitFullscreenElement || 
                                   (document as any).msFullscreenElement);
    
    if (isActuallyFullscreen) {
      try {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch((error) => {
            console.warn('Failed to exit fullscreen:', error);
          });
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) {
          (document as any).msExitFullscreen();
        }
      } catch (error) {
        console.warn('Error exiting fullscreen:', error);
      }
    }
  }

  ngOnDestroy() {
    if (this.pollSubscription) {
      this.pollSubscription.unsubscribe();
    }
  }

  loadProfile() {
    console.log('Loading profile...');
    this.authService.profile().subscribe({
      next: (response: any) => {
        console.log('Profile loaded successfully:', response);
        this.userInfo = response.user; // Fixed: should be response.user, not response.user_info
        this.isLoading = false;
        this.loadScenarios();
      },
      error: (error: any) => {
        console.error('Error loading profile:', error);
        this.isLoading = false; // Set loading to false even on error
        this.router.navigate(['/login']);
      }
    });
  }

  loadScenarios() {
    if (this.userInfo?.user_type !== 'lecturer') {
      console.warn('User is not lecturer, skipping scenarios load');
      return;
    }

    this.authService.getScenarios().subscribe({
      next: (response: any) => {
        console.log('Raw scenarios response:', response);
        const rawList: any[] = Array.isArray(response)
          ? response
          : (Array.isArray(response?.scenarios) ? response.scenarios : []);
        this.scenarios = rawList.map((s: any, idx: number) => {
          if (typeof s === 'string') {
            return { id: s, name: s };
          }
            const id = s.id ?? s.name ?? `scenario_${idx}`;
            const name = s.name ?? s.id ?? `Scenario ${idx + 1}`;
            return { id, name };
        });
        console.log('Scenarios:', this.scenarios);
      },
      error: (error: any) => {
        console.error('Error loading scenarios:', error);
        this.scenarios = [];
      }
    });
  }

  trackByScenario(index: number, item: any) {
    return item?.id || index;
  }

  startPolling() {
    this.loadGameStatus();
    this.pollSubscription = interval(500).subscribe(() => {
      this.loadGameStatus();
    });
  }

  loadGameStatus() {
    this.authService.pollForUsers().subscribe({
      next: (response: any) => {
        this.gameStatus = response.game_status || null;
        this.connectedBoards = response.boards || [];
        this.boardNames = response.board_names || {}; // Store board names mapping
        
        // If game is active, redirect to dashboard
        if (this.gameStatus?.game_active) {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (error: any) => {
        console.error('Error loading game status:', error);
      }
    });
  }

  onScenarioChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.selectedScenario = target.value;
  }

  onStartGame() {
    if (!this.selectedScenario || this.selectedScenario === '') {
      alert('Prosím vyberte scénář před spuštěním hry.');
      return;
    }
    
    this.isGameLoading = true;
    console.log('Starting game with scenario:', this.selectedScenario);
    this.authService.startGameWithScenario(this.selectedScenario).subscribe({
      next: (response: any) => {
        console.log('Game started successfully:', response);
        // Call next round to begin the game
        this.callNextRoundFromStart();
      },
      error: (error: any) => {
        console.error('Error starting game:', error);
        this.isGameLoading = false;
        alert('Nepodařilo se spustit hru. Zkuste to prosím znovu.');
      }
    });
  }

  callNextRoundFromStart() {
    console.log('Calling next round from start...');
    this.authService.nextRound().subscribe({
      next: (response: any) => {
        console.log('Next round response:', response);
        this.isGameLoading = false;
        // Navigate to dashboard where the game will be displayed
        this.router.navigate(['/dashboard']);
      },
      error: (error: any) => {
        console.error('Error calling next round:', error);
        this.isGameLoading = false;
        alert('Hra byla spuštěna, ale nepodařilo se načíst první kolo.');
      }
    });
  }

  logout() {
    this.authService.signout().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }

  getTeamDisplayName(board: any): string {
    debugLog('Setup getTeamDisplayName called with board:', board);
    debugLog('Setup board.display_name =', board?.display_name);
    debugLog('Setup board.board_id =', board?.board_id);
    debugLog('Setup boardNames mapping =', this.boardNames);
    
    // First try the board_names mapping from API response
    if (board?.board_id && this.boardNames[board.board_id]) {
      debugLog('Setup using boardNames mapping:', this.boardNames[board.board_id]);
      return this.boardNames[board.board_id];
    }
    
    // Use display_name from backend if available
    if (board?.display_name) {
      debugLog('Setup using backend display_name:', board.display_name);
      return board.display_name;
    }
    
    // Fallback for backwards compatibility
    if (!board?.board_id) {
      debugLog('Setup no board_id, returning Team 0');
      return 'Team 0';
    }
    const match = board.board_id.toString().match(/\d+/);
    const teamNumber = match ? parseInt(match[0], 10) : 0;
    const fallbackName = `Team ${teamNumber}`;
    debugLog('Setup using fallback name:', fallbackName);
    return fallbackName;
  }

  isBoardPlaceholder(board: any): boolean {
    return board?.is_placeholder === true;
  }

  getGridStatusIcon(board: any): string {
    if (this.isBoardPlaceholder(board)) {
      return '<div style="width: 16px; height: 16px; background-color: #ccc; border-radius: 50%;"></div>';
    }
    
    if (!board?.last_updated) {
      return '<div style="width: 16px; height: 16px; background-color: #ff4444; border-radius: 50%;"></div>';
    }
    
    const lastUpdate = new Date(board.last_updated);
    const now = new Date();
    const timeDiff = now.getTime() - lastUpdate.getTime();
    const secondsSinceUpdate = Math.floor(timeDiff / 1000);
    
    if (secondsSinceUpdate < 10) {
      return '<div style="width: 16px; height: 16px; background-color: #44ff44; border-radius: 50%;"></div>';
    } else if (secondsSinceUpdate < 30) {
      return '<div style="width: 16px; height: 16px; background-color: #ffaa00; border-radius: 50%;"></div>';
    } else {
      return '<div style="width: 16px; height: 16px; background-color: #ff4444; border-radius: 50%;"></div>';
    }
  }

  getLeftBoards(): any[] {
    const sortedBoards = this.connectedBoards.slice().sort((a, b) => {
      const getNumericId = (board: any) => {
        const match = board.board_id?.toString().match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      };
      return getNumericId(a) - getNumericId(b);
    });
    
    const paddedBoards = this.padToMinimumTeams(sortedBoards);
    const maxLeftColumn = 3;
    return paddedBoards.slice(0, maxLeftColumn);
  }

  getRightBoards(): any[] {
    const sortedBoards = this.connectedBoards.slice().sort((a, b) => {
      const getNumericId = (board: any) => {
        const match = board.board_id?.toString().match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      };
      return getNumericId(a) - getNumericId(b);
    });
    
    const paddedBoards = this.padToMinimumTeams(sortedBoards);
    const maxLeftColumn = 3;
    return paddedBoards.slice(maxLeftColumn);
  }

  private padToMinimumTeams(boards: any[]): any[] {
    const minTeams = 5;
    // Extract existing team numbers (digits in board_id)
    const existingNumbers = new Set<number>();
    boards.forEach(b => {
      const match = b.board_id?.toString().match(/\d+/);
      if (match) {
        const n = parseInt(match[0], 10);
        if (!isNaN(n)) existingNumbers.add(n);
      }
    });

    const paddedBoards = [...boards];

    // Add placeholders only for missing team numbers up to minTeams
    for (let team = 1; team <= minTeams; team++) {
      if (!existingNumbers.has(team)) {
        paddedBoards.push({
          board_id: `board${team}`,
          last_updated: null,
          production: 0,
            consumption: 0,
          is_placeholder: true
        });
      }
    }

    // Sort resulting list by numeric team id
    paddedBoards.sort((a, b) => {
      const getNumericId = (board: any) => {
        const match = board.board_id?.toString().match(/\d+/);
        return match ? parseInt(match[0], 10) : Number.MAX_SAFE_INTEGER; // place non-numeric at end
      };
      return getNumericId(a) - getNumericId(b);
    });

    return paddedBoards;
  }

  trackScenario(index: number, item: any) {
    return item?.id || index;
  }

  isGameFinished(): boolean {
    // Game is finished when it's not active and we have round information suggesting completion
    return this.gameStatus && 
           !this.gameStatus.game_active && 
           this.gameStatus.current_round > 0 && 
           this.gameStatus.current_round >= this.gameStatus.total_rounds;
  }

  showGameStatistics() {
    if (!this.isGameFinished()) {
      alert('Statistiky jsou dostupné pouze po dokončení hry.');
      return;
    }

    this.isLoadingStatistics = true;
    
    // Navigate directly to the statistics page
    // The statistics component will load the data itself
    this.router.navigate(['/statistics']);
  }
}
