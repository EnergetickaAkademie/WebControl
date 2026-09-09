import { StatisticsResponse } from '../../models/game-statistics';

const history = (production: number[], consumption: number[]) => ({
  production_history: production,
  consumption_history: consumption,
  round_history: production.map((_, index) => index + 1)
});

export const STATISTICS_PREVIEW_RESPONSE: StatisticsResponse = {
  success: true,
  game_statistics: {
    boards: [
      {
        board_id: 'board1',
        display_name: 'Tým #1',
        ...history([120, 135, 150, 145, 165, 175], [110, 125, 140, 155, 150, 165]),
        total_energy_produced: 890,
        total_energy_consumed: 845,
        energy_balance: 45,
        average_production: 148,
        average_consumption: 141,
        powerplant_history: [
          { power_generation_by_type: { SOLAR: 55, WIND: 40, GAS: 25 } }
        ],
        connected_buildings: [{ type: 'hospital' }, { type: 'factory' }],
        average_production_by_type: { SOLAR: 62, WIND: 42, GAS: 27 }
      },
      {
        board_id: 'board2',
        display_name: 'Tým #2',
        ...history([105, 115, 128, 120, 135, 142], [115, 120, 130, 138, 145, 150]),
        total_energy_produced: 745,
        total_energy_consumed: 798,
        energy_balance: -53,
        average_production: 124,
        average_consumption: 133,
        powerplant_history: [
          { power_generation_by_type: { SOLAR: 48, WIND: 52, HYDRO: 24 } }
        ],
        connected_buildings: [{ type: 'school' }, { type: 'homes' }],
        average_production_by_type: { SOLAR: 48, WIND: 52, HYDRO: 24 }
      },
      {
        board_id: 'board3',
        display_name: 'Tým #3',
        ...history([150, 145, 160, 172, 168, 180], [145, 150, 155, 160, 175, 185]),
        total_energy_produced: 975,
        total_energy_consumed: 970,
        energy_balance: 5,
        average_production: 163,
        average_consumption: 162,
        powerplant_history: [
          { power_generation_by_type: { NUCLEAR: 100, WIND: 35, SOLAR: 28 } }
        ],
        connected_buildings: [{ type: 'factory' }, { type: 'transport' }, { type: 'homes' }],
        average_production_by_type: { NUCLEAR: 100, WIND: 35, SOLAR: 28 }
      },
      {
        board_id: 'board4',
        display_name: 'Tým #4',
        ...history([95, 100, 110, 105, 118, 125], [100, 108, 115, 120, 125, 132]),
        total_energy_produced: 653,
        total_energy_consumed: 700,
        energy_balance: -47,
        average_production: 109,
        average_consumption: 117,
        powerplant_history: [
          { power_generation_by_type: { GAS: 62, HYDRO: 30, SOLAR: 17 } }
        ],
        connected_buildings: [{ type: 'homes' }],
        average_production_by_type: { GAS: 62, HYDRO: 30, SOLAR: 17 }
      },
      {
        board_id: 'board5',
        display_name: 'Tým #5',
        ...history([130, 138, 142, 150, 155, 162], [125, 132, 145, 148, 158, 165]),
        total_energy_produced: 877,
        total_energy_consumed: 873,
        energy_balance: 4,
        average_production: 146,
        average_consumption: 146,
        powerplant_history: [
          { power_generation_by_type: { WIND: 58, HYDRO: 45, SOLAR: 43 } }
        ],
        connected_buildings: [{ type: 'school' }, { type: 'hospital' }],
        average_production_by_type: { WIND: 58, HYDRO: 45, SOLAR: 43 }
      }
    ],
    team_performance: {
      board1: {
        team_name: 'Tým #1', team_number: '1',
        ecology: 82, finances: 91, stability: 88, development: 76, popularity: 84
      },
      board2: {
        team_name: 'Tým #2', team_number: '2',
        ecology: 96, finances: 73, stability: 68, development: 89, popularity: 81
      },
      board3: {
        team_name: 'Tým #3', team_number: '3',
        ecology: 61, finances: 86, stability: 94, development: 93, popularity: 83
      },
      board4: {
        team_name: 'Tým #4', team_number: '4',
        ecology: 74, finances: 62, stability: 71, development: 58, popularity: 66
      },
      board5: {
        team_name: 'Tým #5', team_number: '5',
        ecology: 89, finances: 78, stability: 85, development: 81, popularity: 79
      }
    },
    game_summary: {
      total_rounds: 6,
      scenario_name: 'Náhledová hra'
    }
  }
};
