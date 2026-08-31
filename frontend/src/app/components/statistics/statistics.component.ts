import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { AuthService } from '../../services/auth.service';
import { BoardStatistics, GameStatistics, StatisticsResponse, TeamPerformance } from '../../models/game-statistics';

Chart.register(...registerables);

interface TeamEntry {
  boardId: string;
  performance: TeamPerformance;
  board?: BoardStatistics;
}

type ScoreKey = 'ecology' | 'finances' | 'stability' | 'development';

@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.css']
})
export class StatisticsComponent implements OnInit, OnDestroy {
  gameStatistics: GameStatistics | null = null;
  loading = true;
  error: string | null = null;

  private combinedChart: Chart | null = null;
  private statsSub: Subscription | null = null;
  private chartInitTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly scoreMetrics: Array<{ key: ScoreKey; label: string; color: string }> = [
    { key: 'ecology', label: 'Ekologie', color: '#159447' },
    { key: 'finances', label: 'Finance', color: '#d97706' },
    { key: 'stability', label: 'Stabilita', color: '#2563a6' },
    { key: 'development', label: 'Rozvoj města', color: '#7c3aed' }
  ];

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadStatistics();
  }

  ngOnDestroy(): void {
    this.destroyChart();
    if (this.statsSub) {
      this.statsSub.unsubscribe();
      this.statsSub = null;
    }
    if (this.chartInitTimeout) {
      clearTimeout(this.chartInitTimeout);
      this.chartInitTimeout = null;
    }
  }

  loadStatistics(): void {
    this.loading = true;
    this.error = null;
    if (this.chartInitTimeout) {
      clearTimeout(this.chartInitTimeout);
      this.chartInitTimeout = null;
    }
    this.destroyChart();

    if (this.statsSub) {
      this.statsSub.unsubscribe();
      this.statsSub = null;
    }

    this.statsSub = this.authService.getComprehensiveGameStatistics().subscribe({
      next: (response: StatisticsResponse) => {
        this.gameStatistics = response.game_statistics;
        this.loading = false;
        this.chartInitTimeout = setTimeout(() => {
          this.initializeChart();
          this.chartInitTimeout = null;
        }, 0);
      },
      error: () => {
        this.error = 'Statistiky se nepodařilo načíst.';
        this.loading = false;
      }
    });
  }

  get teamEntries(): TeamEntry[] {
    const statistics = this.gameStatistics;
    if (!statistics) return [];

    const boards = new Map(statistics.boards.map(board => [board.board_id, board]));
    return Object.entries(statistics.team_performance).map(([boardId, performance]) => ({
      boardId,
      performance,
      board: boards.get(boardId)
    }));
  }

  get sortedTeams(): TeamEntry[] {
    return [...this.teamEntries].sort((a, b) => {
      const scoreDifference = b.performance.popularity - a.performance.popularity;
      return scoreDifference || a.performance.team_name.localeCompare(b.performance.team_name, 'cs');
    });
  }

  get hasTeams(): boolean {
    return this.teamEntries.length > 0;
  }

  get winnerLabel(): string {
    const teams = this.sortedTeams;
    if (!teams.length) return 'Není k dispozici';
    const highest = teams[0].performance.popularity;
    const winners = teams
      .filter(team => team.performance.popularity === highest)
      .map(team => team.performance.team_name);
    return winners.length > 1 ? 'Remíza' : winners[0];
  }

  get highestPopularity(): number {
    return this.sortedTeams[0]?.performance.popularity ?? 0;
  }

  get scenarioName(): string {
    return this.gameStatistics?.game_summary.scenario_name || 'Dokončená hra';
  }

  get playedRounds(): number {
    return this.gameStatistics?.game_summary.total_rounds ?? 0;
  }

  getBoard(team: TeamEntry): BoardStatistics | undefined {
    return team.board;
  }

  getRank(team: TeamEntry): number {
    const score = team.performance.popularity;
    return 1 + this.sortedTeams.filter(entry => entry.performance.popularity > score).length;
  }

  getMetricValue(team: TeamEntry, key: ScoreKey): number {
    return team.performance[key];
  }

  formatScore(value: number): string {
    return `${value.toFixed(1)} %`;
  }

  formatEnergy(value: number | undefined): string {
    return `${(value ?? 0).toFixed(0)} MW`;
  }

  getBalanceClass(value: number | undefined): string {
    if ((value ?? 0) > 0) return 'positive';
    if ((value ?? 0) < 0) return 'negative';
    return 'neutral';
  }

  goBackToSetup(): void {
    this.router.navigate(['/setup']);
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    switch (event.key.toLowerCase()) {
      case 'q':
      case 'escape':
        this.goBackToSetup();
        break;
      case 'r':
        this.loadStatistics();
        break;
    }
  }

  private initializeChart(): void {
    const canvas = document.getElementById('teamComparisonChart') as HTMLCanvasElement | null;
    if (!canvas || !this.gameStatistics || !this.hasTeams) return;

    this.destroyChart();
    const teams = this.sortedTeams;
    const configuration: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: teams.map(team => team.performance.team_name),
        datasets: this.scoreMetrics.map(metric => ({
          label: metric.label,
          data: teams.map(team => this.getMetricValue(team, metric.key)),
          backgroundColor: metric.color,
          borderColor: metric.color,
          borderWidth: 1,
          borderRadius: 4,
          maxBarThickness: 26
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              color: '#718096',
              callback: value => `${value} %`
            },
            grid: { color: '#edf0f4' }
          },
          x: {
            ticks: { color: '#52708d' },
            grid: { display: false }
          }
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#52708d',
              usePointStyle: true,
              padding: 18
            }
          },
          tooltip: {
            callbacks: {
              label: context => `${context.dataset.label}: ${Number(context.parsed.y).toFixed(1)} %`
            }
          }
        }
      }
    };

    this.combinedChart = new Chart(canvas, configuration);
  }

  private destroyChart(): void {
    if (this.combinedChart) {
      this.combinedChart.destroy();
      this.combinedChart = null;
    }
  }
}
