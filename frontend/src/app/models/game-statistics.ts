export interface TeamPerformance {
  team_name: string;
  team_number: string;
  ecology: number;
  finances: number;
  stability: number;
  development: number;
  popularity: number;
}

export interface BoardStatistics {
  board_id: string;
  display_name: string;
  total_energy_produced: number;
  total_energy_consumed: number;
  energy_balance: number;
  average_production: number;
  average_consumption: number;
  production_history: number[];
  consumption_history: number[];
  round_history: number[];
  powerplant_history: Record<string, unknown>[];
  connected_buildings: Record<string, unknown>[];
  average_production_by_type: Record<string, number>;
}

export interface GameSummary {
  total_rounds: number;
  scenario_name: string;
}

export interface GameStatistics {
  boards: BoardStatistics[];
  team_performance: Record<string, TeamPerformance>;
  game_summary: GameSummary;
}

export interface StatisticsResponse {
  success: boolean;
  game_statistics: GameStatistics;
}
