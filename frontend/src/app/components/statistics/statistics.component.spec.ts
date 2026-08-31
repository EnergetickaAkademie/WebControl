import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { StatisticsComponent } from './statistics.component';

describe('StatisticsComponent', () => {
  let fixture: ComponentFixture<StatisticsComponent>;
  let component: StatisticsComponent;

  const response = {
    success: true,
    game_statistics: {
      boards: [
        {
          board_id: 'board1',
          display_name: 'Modrý tým',
          total_energy_produced: 100,
          total_energy_consumed: 100,
          energy_balance: 0,
          average_production: 100,
          average_consumption: 100,
          production_history: [100],
          consumption_history: [100],
          round_history: [1],
          powerplant_history: [],
          connected_buildings: [],
          average_production_by_type: {}
        },
        {
          board_id: 'board2',
          display_name: 'Zelený tým',
          total_energy_produced: 80,
          total_energy_consumed: 100,
          energy_balance: -20,
          average_production: 80,
          average_consumption: 100,
          production_history: [80],
          consumption_history: [100],
          round_history: [1],
          powerplant_history: [],
          connected_buildings: [],
          average_production_by_type: {}
        }
      ],
      team_performance: {
        board1: {
          team_name: 'Modrý tým', team_number: '1',
          ecology: 100, finances: 80, stability: 100, development: 100, popularity: 96
        },
        board2: {
          team_name: 'Zelený tým', team_number: '2',
          ecology: 60, finances: 70, stability: 0, development: 80, popularity: 58
        }
      },
      game_summary: { total_rounds: 1, scenario_name: 'test' }
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatisticsComponent],
      providers: [
        { provide: AuthService, useValue: { getComprehensiveGameStatistics: () => of(response) } },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StatisticsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('maps and sorts teams by popularity', () => {
    expect(component.sortedTeams.map(team => team.boardId)).toEqual(['board1', 'board2']);
    expect(component.highestPopularity).toBe(96);
    expect(component.winnerLabel).toBe('Modrý tým');
  });

  it('exposes all four component factors for a team card', () => {
    const team = component.sortedTeams[0];
    expect(component.getMetricValue(team, 'ecology')).toBe(100);
    expect(component.getMetricValue(team, 'finances')).toBe(80);
    expect(component.getMetricValue(team, 'stability')).toBe(100);
    expect(component.getMetricValue(team, 'development')).toBe(100);
    expect(component.getBoard(team)?.energy_balance).toBe(0);
  });

  it('shows an explicit empty state when no teams are scored', () => {
    component.gameStatistics = {
      ...response.game_statistics,
      team_performance: {}
    };
    expect(component.hasTeams).toBeFalse();
    expect(component.winnerLabel).toBe('Není k dispozici');
  });

  it('does not choose a single winner for a tie', () => {
    component.gameStatistics!.team_performance['board2'].popularity = 96;
    expect(component.winnerLabel).toBe('Remíza');
    expect(component.getRank(component.sortedTeams[0])).toBe(1);
    expect(component.getRank(component.sortedTeams[1])).toBe(1);
  });
});
