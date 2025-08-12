# WebControl API Endpoints

This document describes the HTTP endpoints exposed by the CoreAPI service and how they are used by the Angular frontend and the ESP32 master board.

## Frontend JSON Endpoints

These endpoints return JSON and are consumed by the Angular application (`frontend`).  All requests include a JWT in the `Authorization` header after login.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/coreapi/login` | Authenticate lecturers or boards and obtain a JWT token. |
| `GET` | `/coreapi/dashboard` | Retrieve profile information for the logged-in user. |
| `GET` | `/coreapi/scenarios` | List available game scenarios. |
| `POST` | `/coreapi/start_game` | Start a game with a selected scenario. |
| `POST` | `/coreapi/next_round` | Advance the game to the next round and return round details. |
| `GET` | `/coreapi/get_statistics` | Retrieve production/consumption statistics for all boards. |
| `GET` | `/coreapi/pollforusers` | Poll board status and current game information. |
| `POST` | `/coreapi/end_game` | Terminate the current game and reset state. |
| `GET` | `/coreapi/get_pdf` | Return a URL for the scenario presentation PDF. |
| `GET` | `/coreapi/download_pdf/<filename>` | Download a presentation PDF (used by iframe in the frontend). |
| `GET` | `/coreapi/building_table` | Retrieve the current power-consumption table for buildings. |
| `GET` | `/coreapi/game/status` | Lightweight game status endpoint for unauthenticated requests. |
| `GET` | `/coreapi/health` | Health check used by Docker and load balancers. |

## JSON Response Formats

### `/coreapi/pollforusers` Response Format

The `pollforusers` endpoint returns detailed information about boards and the current game round:

```json
{
  "boards": [
    {
      "board_id": "1",
      "production": 1500,
      "consumption": 1200,
      "last_updated": 1692547200.123,
      "connected_consumption": [1, 2, 3],
      "connected_production": [4, 5],
      "production_history": [1400, 1450, 1500],
      "consumption_history": [1150, 1180, 1200],
      "round_history": [1, 2, 3],
      "current_round_index": 3,
      "power_generation_by_type": {
        "COAL": 800.0,
        "NUCLEAR": 700.0
      }
    }
  ],
  "game_status": {
    "current_round": 3,
    "total_rounds": 15,
    "round_type": 1,
    "game_active": true
  },
  "lecturer_info": {
    "user_id": "lecturer1",
    "username": "Dr. Smith"
  },
  "round_details": {
    "round_type": 1,
    "round_type_name": "Day",
    "comment": "Solar and wind are available",
    "info_file": "/info/renewable.md",
    "weather": [
      {
        "type": 1,
        "name": "Sunny"
      },
      {
        "type": 6,
        "name": "Windy"
      }
    ],
    "production_coefficients": {
      "Source.PHOTOVOLTAIC": 1.0,
      "Source.WIND": 1.0,
      "Source.COAL": 1.0,
      "Source.NUCLEAR": 1.0
    },
    "building_consumptions": {
      "CITY_CENTER_A": 575,
      "CITY_CENTER_B": 600,
      "FACTORY": 400
    }
  }
}
```

**Round Details Variations:**

For **Slide rounds** (`round_type: 3`):
```json
"round_details": {
  "round_type": 3,
  "round_type_name": "Slide",
  "comment": "Introduction to renewable energy",
  "slide": "slides/intro.md"
}
```

For **SlideRange rounds** (`round_type: 4`):
```json
"round_details": {
  "round_type": 4,
  "round_type_name": "Slide Range",
  "comment": "Multi-slide presentation",
  "slides": ["slides/intro1.md", "slides/intro2.md", "slides/intro3.md"]
}
```

### Round Types
- `1` = DAY
- `2` = NIGHT  
- `3` = SLIDE
- `4` = SLIDE_RANGE

### Weather Types
- `1` = SUNNY
- `2` = RAINY
- `3` = CLOUDY
- `4` = SNOWY
- `5` = FOGGY
- `6` = WINDY
- `7` = CALM
- `8` = BREEZY
- `9` = PARTLY_CLOUDY

### `/coreapi/get_statistics` Response Format

Returns comprehensive statistics for all boards:

```json
{
  "success": true,
  "statistics": [
    {
      "board_id": "1",
      "current_production": 1500,
      "current_consumption": 1200,
      "production_history": [1400, 1450, 1500],
      "consumption_history": [1150, 1180, 1200],
      "connected_production": [4, 5],
      "connected_consumption": [1, 2, 3],
      "last_updated": 1692547200.123
    }
  ],
  "game_status": {
    "current_round": 3,
    "total_rounds": 15,
    "game_active": true,
    "scenario": "Script"
  }
}
```

### `/coreapi/next_round` Response Format

Response when advancing to a gameplay round:

```json
{
  "status": "success",
  "round": 5,
  "advanced_by": "Dr. Smith",
  "round_type": 1,
  "game_data": {
    "production_coefficients": {
      "Source.COAL": 1.0,
      "Source.NUCLEAR": 1.0,
      "Source.PHOTOVOLTAIC": 0.5
    },
    "consumption_modifiers": {
      "CITY_CENTER_A": 575,
      "FACTORY": 400
    }
  }
}
```

Response when game is finished:

```json
{
  "status": "game_finished",
  "message": "All rounds completed",
  "finished_by": "Dr. Smith"
}
```

## Binary Board Endpoints

ESP32 boards communicate with the server through compact binary endpoints for efficiency.  Requests use the `Authorization: Bearer <token>` header.  Power values are transmitted in milliwatts using big-endian signed integers.

| Method | Path | Purpose | Payload Format |
|--------|------|---------|----------------|
| `POST` | `/coreapi/register` | Register the board using the ID encoded in its JWT token. | Empty request body; response: `success(1) + len(1) + message` |
| `GET` | `/coreapi/poll_binary` | Poll current production and consumption coefficients. | Response: `prod_count(1) + [source_id(1) + coeff(4)]* + cons_count(1) + [building_id(1) + consumption(4)]*` |
| `GET` | `/coreapi/prod_vals` | Get min/max production ranges for each power plant type. | Response: `count(1) + [source_id(1) + min(4) + max(4)]*` |
| `GET` | `/coreapi/cons_vals` | Get base consumption values for buildings. | Response: `count(1) + [building_id(1) + consumption(4)]*` |
| `POST` | `/coreapi/post_vals` | Submit current production and consumption readings. | Request: `production(4) + consumption(4)` |
| `POST` | `/coreapi/prod_connected` | Report IDs of connected power plants and their target set power. | Request: `count(1) + [plant_id(4) + set_power(4)]*` |
| `POST` | `/coreapi/cons_connected` | Report IDs of connected consumers. | Request: `count(1) + [consumer_id(4)]*` |

The binary format is defined in `CoreAPI/src/binary_protocol.py` and documented in more detail in `ESP32_BINARY_PROTOCOL.md`.

## Typical Workflow

### Lecturer (Frontend)
1. `POST /coreapi/login` – user logs in and receives a JWT.
2. `GET /coreapi/scenarios` – fetch available scenarios and choose one.
3. `POST /coreapi/start_game` – start the game with the selected scenario.
4. `POST /coreapi/next_round` – advance rounds; repeated as the game progresses.
5. `GET /coreapi/get_statistics` or `GET /coreapi/pollforusers` – monitor board activity.
6. `POST /coreapi/end_game` – finish the game.

### ESP32 Master Board
1. `POST /coreapi/login` – authenticate using board credentials.
2. `POST /coreapi/register` – register itself with the server.
3. `POST /coreapi/prod_connected` & `POST /coreapi/cons_connected` – report connected generators and consumers.
4. Loop:
   - `GET /coreapi/poll_binary` – fetch coefficients influencing production and consumption.
   - `POST /coreapi/post_vals` – send current power generation and consumption.
   - Optionally `GET /coreapi/prod_vals` and `GET /coreapi/cons_vals` for detailed ranges.

The master-board firmware uses the [`ESPGameAPI`](https://github.com/EnergetickaAkademie/ESP-API) library, which provides helper methods such as `pollCoefficients`, `getProductionRanges`, `submitPowerData`, and others to interact with these endpoints.

