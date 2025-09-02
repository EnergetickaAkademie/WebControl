import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartData, ChartEvent, ChartType, registerables } from 'chart.js';

// Register Chart.js components
Chart.register(...registerables);
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

interface TeamPerformance {
  team_name: string;
  team_number: string;
  ecology: number;
  elmix: number;
  finances: number;
  popularity: number;
}

interface BoardStatistics {
  board_id: string;
  display_name: string;
  production: number;
  consumption: number;
  total_energy_produced: number;
  total_energy_consumed: number;
  energy_balance: number;
  average_production: number;
  average_consumption: number;
  production_history: number[];
  consumption_history: number[];
  round_history: number[];
  powerplant_history: any[];
  connected_buildings: any[];
  average_production_by_type: { [key: string]: number };
}

interface GameStatistics {
  boards: BoardStatistics[];
  team_performance: { [board_id: string]: TeamPerformance };
  game_summary: {
    total_rounds: number;
    game_duration_minutes: number;
    scenario_name: string;
  };
}

@Component({
  selector: 'app-game-statistics',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './game-statistics.html',
  styleUrls: ['./game-statistics.css']
})
export class GameStatisticsComponent implements OnInit, OnDestroy {
    @Input() gameStatistics: any = null;
  @Output() continue = new EventEmitter<void>();
  @Output() backToDashboard = new EventEmitter<void>();

  isLoading: boolean = false;
  error: string | null = null;

  // Chart data and configuration
  public radarChartType: ChartType = 'radar';
  public radarChartLabels: string[] = ['Ekologie', 'Finance', 'El. Mix', 'Popularita'];
  public radarChartData: ChartData<'radar'> = { labels: [], datasets: [] };
  public radarChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    scales: {
      r: {
        beginAtZero: true,
        max: 100
      }
    }
  };

  public barChartType: ChartType = 'bar';
  public barChartLabels: string[] = [];
  public barChartData: ChartData<'bar'> = { labels: [], datasets: [] };
  public barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };

  public lineChartType: ChartType = 'line';
  public lineChartLabels: string[] = [];
  public lineChartData: ChartData<'line'> = { labels: [], datasets: [] };
  public lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    scales: {
      y: {
        beginAtZero: true,
        max: 100
      }
    }
  };

  public doughnutChartType: ChartType = 'doughnut';
  public doughnutChartLabels: string[] = [];
  public doughnutChartData: ChartData<'doughnut'> = { labels: [], datasets: [] };
  public doughnutChartOptions: ChartConfiguration['options'] = {
    responsive: true
  };

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    if (this.gameStatistics) {
      this.initializeCharts();
    }
  }

  ngOnDestroy() {
    // Clean up any subscriptions if needed
  }

  initializeCharts() {
    if (!this.gameStatistics) return;

    const teams = this.getTeamsArray();
    const activeTeams = teams.filter((team: any) => team.board.total_energy_produced > 0);

    // Radar Chart Data
    this.radarChartData = {
      labels: this.radarChartLabels,
      datasets: activeTeams.map((team: any, index: number) => ({
        label: team.board.display_name,
        data: [
          team.performance.ecology,
          team.performance.finances,
          team.performance.elmix,
          team.performance.popularity
        ],
        backgroundColor: `rgba(${54 + index * 50}, ${162 + index * 30}, ${235 + index * 20}, 0.2)`,
        borderColor: `rgba(${54 + index * 50}, ${162 + index * 30}, ${235 + index * 20}, 1)`,
        pointBackgroundColor: `rgba(${54 + index * 50}, ${162 + index * 30}, ${235 + index * 20}, 1)`,
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: `rgba(${54 + index * 50}, ${162 + index * 30}, ${235 + index * 20}, 1)`
      }))
    };

    // Bar Chart Data - Energy Balance
    this.barChartLabels = activeTeams.map((team: any) => team.board.display_name);
    this.barChartData = {
      labels: this.barChartLabels,
      datasets: [
        {
          label: 'Produkce (MW)',
          data: activeTeams.map((team: any) => team.board.total_energy_produced),
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        },
        {
          label: 'Spotřeba (MW)',
          data: activeTeams.map((team: any) => team.board.total_energy_consumed),
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1
        }
      ]
    };

    // Line Chart Data - Performance Metrics
    this.lineChartLabels = activeTeams.map((team: any) => team.board.display_name);
    this.lineChartData = {
      labels: this.lineChartLabels,
      datasets: [
        {
          label: 'Ekologie',
          data: activeTeams.map((team: any) => team.performance.ecology),
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          fill: false
        },
        {
          label: 'Finance',
          data: activeTeams.map((team: any) => team.performance.finances),
          borderColor: 'rgba(255, 206, 86, 1)',
          backgroundColor: 'rgba(255, 206, 86, 0.2)',
          fill: false
        },
        {
          label: 'El. Mix',
          data: activeTeams.map((team: any) => team.performance.elmix),
          borderColor: 'rgba(153, 102, 255, 1)',
          backgroundColor: 'rgba(153, 102, 255, 0.2)',
          fill: false
        },
        {
          label: 'Popularita',
          data: activeTeams.map((team: any) => team.performance.popularity),
          borderColor: 'rgba(255, 159, 64, 1)',
          backgroundColor: 'rgba(255, 159, 64, 0.2)',
          fill: false
        }
      ]
    };

    // Doughnut Chart Data - Overall Score Distribution
    this.doughnutChartLabels = activeTeams.map((team: any) => team.board.display_name);
    const overallScores = activeTeams.map((team: any) => 
      (team.performance.ecology + team.performance.finances + team.performance.elmix + team.performance.popularity) / 4
    );
    this.doughnutChartData = {
      labels: this.doughnutChartLabels,
      datasets: [{
        data: overallScores,
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 205, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)',
          'rgba(255, 159, 64, 0.8)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 205, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)'
        ],
        borderWidth: 2
      }]
    };
  }

  goBackToDashboard() {
    this.backToDashboard.emit();
  }

  loadGameStatistics() {
    this.isLoading = true;
    this.error = null;

    this.authService.getComprehensiveGameStatistics().subscribe({
      next: (response: any) => {
        if (response.success && response.statistics) {
          this.gameStatistics = response.statistics;
        } else {
          this.error = 'Failed to load game statistics';
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading game statistics:', error);
        this.error = 'Failed to load game statistics';
        this.isLoading = false;
      }
    });
  }

  getTeamsArray(): { board: BoardStatistics, performance: TeamPerformance }[] {
    if (!this.gameStatistics) return [];
    
    return this.gameStatistics.boards.map((board: any) => ({
      board,
      performance: this.gameStatistics!.team_performance[board.board_id] || {
        team_name: board.display_name,
        team_number: board.board_id.replace('board', ''),
        ecology: 0,
        elmix: 0,
        finances: 0,
        popularity: 0
      }
    })).sort((a: any, b: any) => {
      // Sort by team number
      const numA = parseInt(a.performance.team_number) || 0;
      const numB = parseInt(b.performance.team_number) || 0;
      return numA - numB;
    });
  }

  getMaxValue(metric: keyof TeamPerformance): number {
    if (!this.gameStatistics) return 100;
    
    const teams = this.getTeamsArray();
    if (teams.length === 0) return 100;
    
    const values = teams.map(team => team.performance[metric] as number);
    return Math.max(...values, 100);
  }

  getBarWidth(value: number, metric: keyof TeamPerformance): number {
    const maxValue = this.getMaxValue(metric);
    return Math.min(100, (value / maxValue) * 100);
  }

  getMetricColor(metric: keyof TeamPerformance): string {
    switch (metric) {
      case 'ecology': return '#4CAF50'; // Green
      case 'elmix': return '#2196F3';   // Blue
      case 'finances': return '#FF9800'; // Orange
      case 'popularity': return '#9C27B0'; // Purple
      default: return '#757575'; // Grey
    }
  }

  getMetricLabel(metric: keyof TeamPerformance): string {
    switch (metric) {
      case 'ecology': return 'Ekologie';
      case 'elmix': return 'ElMix';
      case 'finances': return 'Finance';
      case 'popularity': return 'Popularita';
      default: return metric;
    }
  }

  getTotalEnergyProduced(): number {
    if (!this.gameStatistics) return 0;
    return this.gameStatistics.boards.reduce((sum: number, board: any) => sum + board.total_energy_produced, 0);
  }

  getTotalEnergyConsumed(): number {
    if (!this.gameStatistics) return 0;
    return this.gameStatistics.boards.reduce((sum: number, board: any) => sum + board.total_energy_consumed, 0);
  }

  getTotalEnergyBalance(): number {
    return this.getTotalEnergyProduced() - this.getTotalEnergyConsumed();
  }

  getConnectedBuildingsCount(): number {
    if (!this.gameStatistics) return 0;
    return this.gameStatistics.boards.reduce((sum: number, board: any) => sum + board.connected_buildings.length, 0);
  }

  getTotalRoundsPlayed(): number {
    if (!this.gameStatistics) return 0;
    const maxRounds = Math.max(...this.gameStatistics.boards.map((board: any) => board.round_history.length));
    return maxRounds || 0;
  }

  onContinue() {
    this.continue.emit();
  }

  downloadStatistics() {
    if (!this.gameStatistics) return;

    const dataStr = JSON.stringify(this.gameStatistics, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `game_statistics_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  objectKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : [];
  }

  trackByTeam(index: number, item: any): string {
    return item.board.board_id;
  }

  getProductionTypesArray(avgProductionByType: { [key: string]: number }): { name: string; value: number }[] {
    if (!avgProductionByType) return [];
    
    return Object.entries(avgProductionByType)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }

  getTeamsSortedBy(metric: 'ecology' | 'elmix' | 'finances' | 'popularity'): { board: BoardStatistics, performance: TeamPerformance }[] {
    const teams = this.getTeamsArray();
    return teams.sort((a, b) => {
      const aValue = a.performance[metric] || 0;
      const bValue = b.performance[metric] || 0;
      return bValue - aValue; // Descending order
    });
  }
}
