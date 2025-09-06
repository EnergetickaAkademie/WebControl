import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { CommonModule } from '@angular/common';

Chart.register(...registerables, ChartDataLabels);

@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.css']
})
export class StatisticsComponent implements OnInit, OnDestroy {
  gameStatistics: any = null;
  loading = true;
  error: string | null = null;
  // Keep a direct reference to the created chart to ensure proper cleanup.
  private combinedChart: Chart | null = null;
  private statsSub: Subscription | null = null;
  private chartInitTimeout: any = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadStatistics();
  }

  ngOnDestroy() {
    // Properly destroy the chart instance to avoid memory leaks
    if (this.combinedChart) {
      try { this.combinedChart.destroy(); } catch (e) { console.warn('Chart destroy error', e); }
      this.combinedChart = null;
    }
    if (this.statsSub) {
      this.statsSub.unsubscribe();
      this.statsSub = null;
    }
    if (this.chartInitTimeout) {
      clearTimeout(this.chartInitTimeout);
      this.chartInitTimeout = null;
    }
  }

  loadStatistics() {
    this.loading = true;
    this.error = null;
    
    // Cancel any in-flight request before starting a new one (e.g., user presses 'r')
    if (this.statsSub) {
      this.statsSub.unsubscribe();
      this.statsSub = null;
    }

    this.statsSub = this.authService.getComprehensiveGameStatistics().subscribe({
      next: (response: any) => {
        console.log('Statistics loaded:', response);
        // Store the original response structure
        this.gameStatistics = response;
        this.loading = false;
        
        // Initialize charts after data is loaded
        if (this.chartInitTimeout) {
          clearTimeout(this.chartInitTimeout);
        }
        this.chartInitTimeout = setTimeout(() => {
          this.initializeCharts();
          this.chartInitTimeout = null;
        }, 100);
      },
      error: (error: any) => {
        console.error('Error loading statistics:', error);
        this.error = 'Failed to load game statistics';
        this.loading = false;
        
        // If it's a network error, try once more after a short delay
        if (error.status === 0) {
          console.log('Network error detected, retrying in 2 seconds...');
          setTimeout(() => {
            this.loadStatistics();
          }, 2000);
        }
      }
    });
  }

  initializeCharts() {
    console.log('initializeCharts called');
    console.log('Chart.js available:', typeof Chart);
    console.log('gameStatistics:', this.gameStatistics);
    
    if (!this.gameStatistics?.game_statistics?.team_performance) {
      console.log('No team performance data found');
      return;
    }

    console.log('Creating combined team chart...');
    this.createCombinedTeamChart();
  }

  createCombinedTeamChart() {
    const ctx = document.getElementById('combinedTeamChart') as HTMLCanvasElement;
    if (!ctx) {
      console.warn('Canvas element combinedTeamChart not found');
      return;
    }

    // Destroy existing chart instance we track (Chart.getChart with string id would not work as expected in v4)
    if (this.combinedChart) {
      try { this.combinedChart.destroy(); } catch (e) { console.warn('Chart destroy error', e); }
      this.combinedChart = null;
    }

    const teams = this.gameStatistics.game_statistics.team_performance;
    const teamKeys = Object.keys(teams);
    const teamLabels = teamKeys.map((key, index) => `Tým ${index + 1}`);

    // Metrics data
    const factors = [
      { key: 'ecology', label: 'Ekologie', color: '#2ca02c' },
      { key: 'finances', label: 'Finance', color: '#ff7f0e' },
      { key: 'elmix', label: 'Stabilita', color: '#d62728' },
      { key: 'popularity', label: 'Popularita', color: '#1f77b4' }
    ];

    // Create datasets for each factor
    const datasets = factors.map(factor => ({
      label: factor.label,
      data: teamKeys.map(teamKey => teams[teamKey][factor.key] || 0),
      backgroundColor: factor.color,
      borderColor: factor.color,
      borderWidth: 2
    }));

  this.combinedChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: teamLabels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: function(value: any) {
                return value + '%';
              }
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          },
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          }
        },
        plugins: {
          legend: {
            position: 'right' as any,
            labels: {
              color: '#ffffff',
              font: {
                size: 18,
                weight: 'bold' as any
              },
              padding: 25,
              usePointStyle: true,
              pointStyle: 'rect',
              boxWidth: 20,
              boxHeight: 20
            }
          },
          tooltip: {
            callbacks: {
              label: function(context: any) {
                return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`;
              }
            }
          },
          datalabels: {
            anchor: 'center' as any,
            align: 'center' as any,
            color: '#ffffff',
            font: {
              weight: 'bold' as any,
              size: 12
            },
            formatter: function(value: number) {
              return value.toFixed(1) + '%';
            }
          }
        }
      }
    });
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    switch (event.key.toLowerCase()) {
      case 'q':
      case 'escape':
        this.goBackToRoot();
        break;
      case 'r':
        this.loadStatistics();
        break;
    }
  }

  goBackToRoot() {
  // Navigate directly to setup to avoid extra redirect churn which can retain component refs temporarily
  this.router.navigate(['/setup']);
  }

  getTeamNames(): string[] {
    if (!this.gameStatistics?.game_statistics?.team_performance) return [];
    return Object.keys(this.gameStatistics.game_statistics.team_performance).map(key => 
      this.gameStatistics.game_statistics.team_performance[key].team_name || key
    );
  }

  getBestRoundScore(team: any): string {
    if (!team) return 'N/A';
    const metrics = [team.ecology || 0, team.finances || 0, team.popularity || 0];
    return Math.max(...metrics).toFixed(1);
  }

  getWinner(): string {
    const teams = this.gameStatistics?.game_statistics?.team_performance;
    if (!teams) return 'N/A';
    
    let winner = '';
    let highestScore = -1;
    
    for (const [key, teamData] of Object.entries(teams)) {
      const team = teamData as any;
      const score = ((team.ecology || 0) + (team.finances || 0) + (team.popularity || 0)) / 3;
      if (score > highestScore) {
        highestScore = score;
        winner = team.team_name || key;
      }
    }
    
    return winner || 'N/A';
  }

  getAverageScore(): string {
    const teams = this.gameStatistics?.game_statistics?.team_performance;
    if (!teams) return 'N/A';
    
    const teamKeys = Object.keys(teams);
    if (teamKeys.length === 0) return 'N/A';
    
    const totalScore = teamKeys.reduce((sum, key) => {
      const team = teams[key];
      const score = ((team.ecology || 0) + (team.finances || 0) + (team.popularity || 0)) / 3;
      return sum + score;
    }, 0);
    
    return (totalScore / teamKeys.length).toFixed(1);
  }

  getTeamKeys(): string[] {
    return this.gameStatistics?.game_statistics?.team_performance ? Object.keys(this.gameStatistics.game_statistics.team_performance) : [];
  }

  getTeamAverageScore(team: any): string {
    if (!team) return 'N/A';
    const score = ((team.ecology || 0) + (team.finances || 0) + (team.popularity || 0)) / 3;
    return score.toFixed(1);
  }
}
