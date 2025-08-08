# Energy Game Dashboard - Updated Features

This document describes the new features added to the Energy Game Dashboard system.

## New Features

### 1. Enhanced Lecturer Dashboard

The lecturer dashboard now includes:

- **Real-time Game Status**: Displays current round, game state, and total registered boards
- **Board Monitoring**: Shows detailed information about all registered boards including:
  - Power generation (kW)
  - Power consumption (kW)
  - Net power balance
  - Total accumulated score
  - Board type and name
- **Game Control**: Buttons to start the game and advance to the next round
- **Auto-refresh**: Dashboard polls the API every 3 seconds for live updates

### 2. Board User Access Control

- Board users can no longer access the lecturer dashboard
- Board users are redirected with an appropriate error message when attempting to login to the frontend
- Only users with `user_type: "lecturer"` can access the dashboard

### 3. Automated Board Simulation

Two test scripts are available to simulate board behavior:

#### ESP32 Board Simulation Script (`esp32_board_simulation.py`)

Creates multiple simulated boards with realistic power patterns using the binary protocol:

- **Solar Farms**: Generate power during daylight hours (6 AM - 6 PM) with peak at noon
- **Wind Turbines**: Variable generation with some daily patterns
- **Hydro Plants**: Consistent generation with minor variations
- **Factories**: High consumption during business hours (8 AM - 5 PM)
- **Residential**: Peak consumption in evenings (5 PM - 10 PM) and mornings (6 AM - 9 AM)
- **Generic Stations**: Basic generation and consumption patterns

#### Single Board Demo Script (`demo_single_board.py`)

A simpler script for testing basic functionality:
- Tests single board registration and data submission
- Demonstrates realistic power patterns
- Validates API endpoints with one board

## Usage Instructions

### Starting the System

1. **Production Mode (Recommended):**
   ```bash
   docker-compose up --build -d
   ```

2. **Development Mode:**
   ```bash
   docker-compose up --build
   ```

### Running Board Simulation

1. **Multiple Boards (Binary Protocol):**
   ```bash
   python3 esp32_board_simulation.py
   ```

2. **Single Board Demo:**
   ```bash
   python3 demo_single_board.py
   ```

### Accessing the Dashboard

1. Visit: http://localhost
2. Use lecturer credentials from the demo users section
3. Monitor real-time board data and control game rounds

### Testing Different Scenarios

The simulation scripts allow you to test various scenarios:
- Solar generation patterns throughout the day
- Wind turbine variability
- Industrial vs residential consumption patterns
- Game round progression and scoring

## Technical Details

### Dashboard Features
- **Real-time Updates**: Dashboard automatically refreshes every 3 seconds
- **Board Status**: Shows comprehensive board information including power balance
- **Game Control**: Easy-to-use buttons for game management
- **Responsive Design**: Works on desktop and mobile devices

### Security Features
- **Role-based Access**: Only lecturers can access the dashboard
- **Board Isolation**: Board users cannot access lecturer features
- **Authentication**: JWT-based authentication for secure access

### Data Formats
- **Power Values**: Displayed in kilowatts (kW) with 2 decimal precision
- **Score System**: Accumulated points based on power balance
- **Round Management**: Support for different round types (day/night)

## Future Enhancements

Potential areas for improvement:
- Historical data visualization
- Advanced board analytics
- Custom scoring algorithms
- Export functionality for game results
- Multi-game session management
   ```bash
   python3 test_quick_board.py
   ```

2. **Full simulation** (creates 8 boards with realistic patterns):
   ```bash
   python3 test_board_simulation.py
   ```

### Using the Dashboard

1. **Start the Game**:
   - Click "Start Game" button in the Game Control section
   - This initializes round 1 and allows boards to begin reporting data

2. **Monitor Boards**:
   - The Board Status section shows all registered boards
   - Data updates automatically every 3 seconds
   - Color-coded values show positive (green) and negative (red) power flows

3. **Advance Rounds**:
   - Click "Next Round" to move to the next round
   - This calculates scores for the current round and increments the round counter

## API Endpoints Used

### Frontend Polling
- `GET /coreapi/game/status` - Gets game status and board details

### Game Control
- `POST /coreapi/game/start` - Starts the game
- `POST /coreapi/game/next_round` - Advances to the next round

### Board Simulation
- `POST /coreapi/login` - Board authentication
- `POST /coreapi/register` - Board registration
- `POST /coreapi/power_generation` - Submit power generation data
- `POST /coreapi/power_consumption` - Submit power consumption data
- `GET /coreapi/poll/{board_id}` - Get board status

## Authentication

### Lecturer Access
- User type must be `"lecturer"`
- Can access dashboard and game controls
- Can view all board data

### Board Access
- User type must be `"board"`
- Cannot access the frontend dashboard
- Can only submit data via API

## Security Features

- Board users are prevented from accessing the lecturer interface
- JWT token authentication for all API calls
- User type validation in both frontend and backend

## Troubleshooting

### Board Simulation Issues
1. Ensure the CoreAPI service is running on `http://localhost/coreapi`
2. Check that board user accounts exist in the authentication system
3. Verify that the game has been started via the dashboard

### Dashboard Issues
1. Check browser console for JavaScript errors
2. Verify lecturer credentials and user type
3. Ensure CoreAPI service is accessible

### Common Error Messages
- "Board users cannot access the lecturer dashboard" - Normal behavior for board users
- "Failed to load game status" - Check CoreAPI connectivity
- "Registration failed" - Board may already be registered or authentication failed

## Development Notes

### Frontend Changes
- Added game status polling with RxJS intervals
- Enhanced dashboard UI with real-time board monitoring
- Implemented user type validation in auth guard
- Added game control buttons for lecturers

### Backend Integration
- Uses existing `/game/status` endpoint with lecturer authentication
- Leverages existing game control endpoints
- Maintains backward compatibility with existing API

### Testing
- Comprehensive board simulation with realistic power patterns
- Quick test script for validation
- Automated test scenarios for different board types
