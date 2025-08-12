import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface GameStatus {
  current_round: number;
  total_rounds: number;
  round_type: number | null;
  game_active: boolean;
  boards: number;
}

export interface RoundDetails {
  round_type: number;
  round_type_name: string;
  comment?: string;
  info_file?: string;
  weather?: Array<{ type: number; name: string }>;
  production_coefficients?: { [key: string]: number };
  building_consumptions?: { [key: string]: number };
  slide?: string;
  slides?: string[];
}

export interface PollResponse {
  boards: any[];
  game_status: GameStatus;
  lecturer_info: any;
  round_details?: RoundDetails;
}

@Injectable({ providedIn: 'root' })
export class GameStatusService {
  private api = '/coreapi';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    
    const token = localStorage.getItem('auth-token');
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  /**
   * Get current game status (lightweight endpoint)
   */
  getGameStatus(): Observable<GameStatus> {
    return this.http.get<GameStatus>(`${this.api}/game/status`, { headers: this.getHeaders() });
  }

  /**
   * Get full poll response with round details (for authenticated users)
   */
  pollForUsers(): Observable<PollResponse> {
    return this.http.get<PollResponse>(`${this.api}/pollforusers`, { headers: this.getHeaders() });
  }

  /**
   * Determine the appropriate view based on game status and round details
   */
  determineViewFromGameState(gameStatus: GameStatus, roundDetails?: RoundDetails): 'setup' | 'presentation' | 'game' {
    if (!gameStatus.game_active || gameStatus.current_round === 0) {
      return 'setup';
    }

    if (roundDetails) {
      const roundType = roundDetails.round_type;
      // Round types: 1=DAY, 2=NIGHT, 3=SLIDE, 4=SLIDE_RANGE
      if (roundType === 3 || roundType === 4) { // SLIDE or SLIDE_RANGE
        return 'presentation';
      } else if (roundType === 1 || roundType === 2) { // DAY or NIGHT
        return 'game';
      }
    }

    // Fallback: if game is active but we don't have round details, assume it's a game round
    return gameStatus.game_active ? 'game' : 'setup';
  }

  /**
   * Check if user should be redirected to a specific state on reload
   */
  checkReloadRecovery(): Observable<{ shouldRedirect: boolean; view: 'setup' | 'presentation' | 'game'; gameState?: any }> {
    return new Observable(observer => {
      // First try to get authenticated status with full round details
      this.pollForUsers().subscribe({
        next: (pollResponse) => {
          const view = this.determineViewFromGameState(pollResponse.game_status, pollResponse.round_details);
          observer.next({
            shouldRedirect: true,
            view: view,
            gameState: {
              gameStatus: pollResponse.game_status,
              roundDetails: pollResponse.round_details,
              boards: pollResponse.boards,
              currentRound: pollResponse.round_details ? {
                round: pollResponse.game_status.current_round,
                round_type: pollResponse.round_details.round_type,
                game_data: {
                  production_coefficients: pollResponse.round_details.production_coefficients || {},
                  consumption_modifiers: pollResponse.round_details.building_consumptions || {}
                }
              } : null
            }
          });
          observer.complete();
        },
        error: () => {
          // If authenticated call fails, try unauthenticated status
          this.getGameStatus().subscribe({
            next: (gameStatus) => {
              const view = this.determineViewFromGameState(gameStatus);
              observer.next({
                shouldRedirect: true,
                view: view,
                gameState: { gameStatus }
              });
              observer.complete();
            },
            error: () => {
              // If both fail, no redirect needed
              observer.next({ shouldRedirect: false, view: 'setup' });
              observer.complete();
            }
          });
        }
      });
    });
  }
}
