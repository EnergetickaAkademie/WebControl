# Lecturer Debugging Endpoints

This document describes the special endpoints available for lecturers to debug and simulate board interactions. These endpoints require lecturer authentication and allow "spoofing" board data without needing actual hardware.

## Overview

The lecturer debugging endpoints provide:
1. **Complete simulation data dump** - Get all data from all groups and boards in one JSON response
2. **Board data spoofing** - Submit data for specific boards as a lecturer (for debugging without hardware)
3. **Individual board monitoring** - Monitor specific boards with lecturer privileges
4. **Board simulation** - Simulate board polling and registration for testing

## Authentication

All endpoints require **lecturer authentication**. You must include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Get Complete Simulation Dump

**Endpoint:** `GET /lecturer/simulation_dump`

**Authentication:** Lecturer required

**Description:** Returns a complete JSON dump of all simulation data across all groups and boards.

**Response Example:**
```json
{
  "timestamp": 1692123456.789,
  "groups": {
    "group1": {
      "group_id": "group1",
      "game_status": {
        "active": true,
        "current_round": 3,
        "total_rounds": 10,
        "round_type": "DAY",
        "scenario": "DemoScript",
        "game_finished": false
      },
      "boards": {
        "1": {
          "board_id": "1",
          "current_production": 150,
          "current_consumption": 120,
          "last_updated": 1692123450.123,
          "connected_production": [50, 60, 40],
          "connected_consumption": [30, 40, 50],
          "production_history": [140, 145, 150],
          "consumption_history": [115, 118, 120],
          "history_length": {
            "production": 25,
            "consumption": 25
          }
        }
      },
      "production_coefficients": {
        "SOLAR": 0.8,
        "WIND": 1.2,
        "COAL": 1.0
      },
      "consumption_modifiers": {
        "HOUSE": 1.1,
        "FACTORY": 0.9
      }
    }
  },
  "summary": {
    "total_groups": 1,
    "total_boards": 3,
    "active_games": 1
  }
}
```

### 2. Spoof Board Data

**Endpoint:** `POST /lecturer/submit_board_data`

**Authentication:** Lecturer required

**Description:** Submit data for a specific board as a lecturer (spoofing for debugging without hardware).

**Request Body:**
```json
{
  "group_id": "group1",
  "board_id": "1",
  "production": 100,
  "consumption": 80,
  "connected_production": [10, 20, 30],
  "connected_consumption": [15, 25]
}
```

**Required Fields:**
- `board_id` (string) - ID of the board to spoof
- `production` (integer) - Current production value
- `consumption` (integer) - Current consumption value

**Optional Fields:**
- `group_id` (string) - Group ID (defaults to lecturer's group)
- `connected_production` (array of integers) - Connected production devices
- `connected_consumption` (array of integers) - Connected consumption devices

**Response Example:**
```json
{
  "success": true,
  "message": "Data spoofed for board 1 in group group1",
  "spoofed_by": "lecturer_username",
  "data": {
    "group_id": "group1",
    "board_id": "1",
    "production": 100,
    "consumption": 80,
    "timestamp": 1692123456.789
  }
}
```

### 3. Get Board Status

**Endpoint:** `GET /lecturer/board_status/<group_id>/<board_id>`

**Authentication:** Lecturer required

**Description:** Get the current status of a specific board.

**URL Parameters:**
- `group_id` - The group ID (e.g., "group1")
- `board_id` - The board ID (e.g., "1")

**Example:** `GET /lecturer/board_status/group1/1`

**Response Example:**
```json
{
  "success": true,
  "group_id": "group1",
  "board_id": "1",
  "board_data": {
    "production": 150,
    "consumption": 120,
    "last_updated": 1692123456.789,
    "connected_production": [50, 60, 40],
    "connected_consumption": [30, 40, 50],
    "production_history": [140, 145, 150, 148, 150],
    "consumption_history": [115, 118, 120, 119, 120]
  },
  "game_status": {
    "active": true,
    "current_round": 3,
    "total_rounds": 10,
    "round_type": "DAY"
  }
}
```

**Error Response (Board Not Found):**
```json
{
  "error": "Board not found",
  "group_id": "group1",
  "board_id": "999"
}
```

### 4. Simulate Board Poll

**Endpoint:** `GET /lecturer/simulate_board_poll/<group_id>/<board_id>`

**Authentication:** Lecturer required

**Description:** Simulate what a board would receive when polling for game data. Returns the same information as the binary `/poll_binary` endpoint but in JSON format for easier debugging.

**URL Parameters:**
- `group_id` - The group ID (e.g., "group1")
- `board_id` - The board ID (e.g., "1")

**Example:** `GET /lecturer/simulate_board_poll/group1/1`

**Response Example:**
```json
{
  "success": true,
  "group_id": "group1",
  "board_id": "1",
  "simulated_by": "lecturer_username",
  "game_data": {
    "production_coefficients": {
      "SOLAR": 0.8,
      "WIND": 1.2,
      "COAL": 1.0
    },
    "consumption_coefficients": {
      "HOUSE": 1.1,
      "FACTORY": 0.9
    }
  },
  "game_status": {
    "active": true,
    "current_round": 3,
    "total_rounds": 10,
    "round_type": "DAY"
  }
}
```

### 5. Simulate Board Registration

**Endpoint:** `POST /lecturer/simulate_board_register/<group_id>/<board_id>`

**Authentication:** Lecturer required

**Description:** Simulate board registration as if a board connected via the binary protocol. Useful for testing without physical hardware.

**URL Parameters:**
- `group_id` - The group ID (e.g., "group1")
- `board_id` - The board ID (e.g., "1")

**Example:** `POST /lecturer/simulate_board_register/group1/1`

**Response Example:**
```json
{
  "success": true,
  "message": "Board 1 registered successfully in group group1",
  "simulated_by": "lecturer_username",
  "group_id": "group1",
  "board_id": "1"
}
```

## Use Cases

### 1. Hardware-Free Development
Test the entire system without physical ESP32 boards:

```bash
# Login as lecturer
curl -X POST http://localhost:5000/login \
  -H "Content-Type: application/json" \
  -d '{"username": "lecturer1", "password": "password"}'

# Extract token from response and use it
export TOKEN="your-jwt-token"

# Simulate board registration
curl -X POST http://localhost:5000/lecturer/simulate_board_register/group1/1 \
  -H "Authorization: Bearer $TOKEN"

# Submit spoofed data
curl -X POST http://localhost:5000/lecturer/submit_board_data \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "board_id": "1",
    "production": 150,
    "consumption": 120
  }'
```

### 2. Debugging Game Logic
Test how boards receive different game data:

```bash
# Check what data a board would receive
curl http://localhost:5000/lecturer/simulate_board_poll/group1/1 \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Integration Testing
Create automated tests that simulate multiple boards:

```python
import requests

# Login as lecturer
login_response = requests.post('http://localhost:5000/login', json={
    'username': 'lecturer1',
    'password': 'password'
})
token = login_response.json()['token']
headers = {'Authorization': f'Bearer {token}'}

# Simulate multiple boards
for board_id in range(1, 6):
    # Register board
    requests.post(
        f'http://localhost:5000/lecturer/simulate_board_register/group1/{board_id}',
        headers=headers
    )
    
    # Submit data
    requests.post(
        'http://localhost:5000/lecturer/submit_board_data',
        headers=headers,
        json={
            'board_id': str(board_id),
            'production': 100 + board_id * 10,
            'consumption': 80 + board_id * 5
        }
    )
```

## Integration Examples

### Python Integration
```python
import requests
import json

# Login as lecturer
login_response = requests.post('http://localhost:5000/login', json={
    'username': 'lecturer1',
    'password': 'password'
})
token = login_response.json()['token']
headers = {'Authorization': f'Bearer {token}'}

# Get all simulation data
response = requests.get('http://localhost:5000/lecturer/simulation_dump', headers=headers)
simulation_data = response.json()

# Spoof data for a board
data = {
    'board_id': '1',
    'production': 150,
    'consumption': 120
}
response = requests.post(
    'http://localhost:5000/lecturer/submit_board_data',
    headers=headers,
    json=data
)
```

### JavaScript Integration
```javascript
// Login first
const loginResponse = await fetch('/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'lecturer1',
    password: 'password'
  })
});
const { token } = await loginResponse.json();

// Get all simulation data
const response = await fetch('/lecturer/simulation_dump', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const data = await response.json();

// Spoof board data
await fetch('/lecturer/submit_board_data', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    board_id: '1',
    production: 150,
    consumption: 120
  })
});
```

## Security Notes

- All endpoints require **lecturer authentication** via JWT tokens
- Lecturers can spoof data for boards in any group (useful for cross-group testing)
- If no group_id is specified in spoofing requests, the lecturer's own group is used
- All spoofing actions are logged with the lecturer's username for auditing

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (invalid or missing lecturer token)
- `404` - Not Found (board doesn't exist for status endpoints)
- `500` - Internal Server Error

Error responses include a descriptive error message in the JSON response.
