# WebControl Project Summary

## Overview
WebControl is an educational energy‑management game system composed of:
- CoreAPI (Flask) for game logic, state, and device/lecturer APIs.
- Angular frontend for lecturers to start/control rounds and view statistics.
- ESP32 boards (or simulators) that send power data and receive coefficients via a compact binary protocol.
- Nginx as a reverse proxy in Docker Compose.

## Major Components
- Core API service: [CoreAPI/src/main.py](CoreAPI/src/main.py)
- Game state models: [CoreAPI/src/state.py](CoreAPI/src/state.py)
- Scoring logic: [CoreAPI/src/scoring.py](CoreAPI/src/scoring.py)
- Binary protocol definitions: [CoreAPI/src/binary_protocol.py](CoreAPI/src/binary_protocol.py)
- User/board configuration: [config/users.toml](config/users.toml) and loader [CoreAPI/src/user_config.py](CoreAPI/src/user_config.py)
- Frontend app: [frontend/src](frontend/src)

## Authentication and Identity
- All users (lecturers and boards) authenticate via JWT from `POST /coreapi/login`.
- Credentials and group membership come from [config/users.toml](config/users.toml) and are loaded by [CoreAPI/src/user_config.py](CoreAPI/src/user_config.py).
- Board identity is derived from the JWT `username` (e.g., board1, board2). The server never trusts a board ID sent in a payload for binary endpoints.

## Communication Protocols
### JSON (Lecturer + Frontend)
The Angular frontend uses JSON endpoints documented in [docs/ENDPOINTS.md](docs/ENDPOINTS.md). Main lecturer workflow:
1. Login → get JWT.
2. Fetch scenarios (`GET /coreapi/scenarios`).
3. Start a scenario (`POST /coreapi/start_game`).
4. Advance rounds (`POST /coreapi/next_round`).
5. Poll stats (`GET /coreapi/pollforusers` or `GET /coreapi/get_statistics`).
6. End the game (`POST /coreapi/end_game`).

### Binary (ESP32 Boards)
Binary endpoints use `Content-Type: application/octet-stream` and big‑endian 32‑bit integers. The implementation converts between watts and milliwatts by multiplying/dividing by 1000. Packing/unpacking is implemented in [CoreAPI/src/binary_protocol.py](CoreAPI/src/binary_protocol.py).

#### ESP32 Binary Payload Formats
All multi‑byte integers are big‑endian. Power values are signed 32‑bit integers in milliwatts (value * 1000). Board identity is derived from the JWT username.

- `POST /coreapi/register`
  - Request body: empty
  - Response: `success(1) + message_length(1) + message(N)`

- `POST /coreapi/post_vals`
  - Request body: `production(4) + consumption(4) + buildings_count(1) + [uid_len(1) + uid + building_type(1)] * buildings_count`
  - Server expects this format in [CoreAPI/src/main.py](CoreAPI/src/main.py).

- `GET /coreapi/poll_binary`
  - Response body:
    - `prod_count(1) + [source_id(1) + coeff(4)] * prod_count`
    - `cons_count(1) + [building_id(1) + consumption(4)] * cons_count`
    - `buildings_count(1) + [uid_len(1) + uid + building_type(1)] * buildings_count`

- `POST /coreapi/prod_connected`
  - Request body: `count(1) + [plant_id(4) + set_power(4)] * count`

- `POST /coreapi/cons_connected`
  - Request body: `count(1) + [consumer_id(4)] * count`

- `GET /coreapi/prod_vals`
  - Response body: `count(1) + [source_id(1) + min(4) + max(4)] * count`

- `GET /coreapi/cons_vals`
  - Response body: `count(1) + [building_id(1) + consumption(4)] * count`

Concrete packing/parsing is implemented in [CoreAPI/src/binary_protocol.py](CoreAPI/src/binary_protocol.py) and mirrored by the simulator in [scripts/esp32_board_simulation.py](scripts/esp32_board_simulation.py).

Key endpoints (board authenticated with JWT):
- `POST /coreapi/register` → register board (empty body; response is binary success flag + message).
- `GET /coreapi/poll_binary` → receive current production coefficients and building consumptions. If no active game, server returns an empty body to signal pause/end.
- `POST /coreapi/post_vals` → send production/consumption plus connected building data (binary packed; server updates in‑memory board state).
- `POST /coreapi/prod_connected` → send connected power‑plant IDs and set power.
- `POST /coreapi/cons_connected` → send connected consumer IDs.
- `GET /coreapi/prod_vals` and `GET /coreapi/cons_vals` → get current ranges and base consumptions.

Typical board loop:
1. Login → get JWT.
2. Register board.
3. Report connected plants/consumers.
4. Loop: poll coefficients → submit power data → sleep 3–5 seconds.

## Game Progression and Rules
- Scenario scripts live in [CoreAPI/src/scenarios](CoreAPI/src/scenarios) and are exposed by [CoreAPI/src/state.py](CoreAPI/src/state.py).
- A game is started by a lecturer selecting a scenario. The server creates a fresh script instance and resets per‑board round history.
- Each call to `POST /coreapi/next_round` advances one step. The server:
  - Saves current per‑board values to history (only for day/night rounds).
  - Returns round data (coefficients, building consumptions, weather display data, slides for slide rounds, etc.).
- If the script finishes, the server finalizes the last round, computes statistics and scores, marks the game as ended, and clears the active script for the group.

Round types include DAY, NIGHT, SLIDE, and SLIDE_RANGE. Weather and production coefficients are produced by scenario scripts and shaped for the frontend in [CoreAPI/src/main.py](CoreAPI/src/main.py).

## State and Data Storage
### In‑Memory Game State
Runtime data is stored in memory (no database by default):
- Group‑scoped `GameState` objects are held by `GroupGameManager` in [CoreAPI/src/main.py](CoreAPI/src/main.py).
- Each `GameState` holds `BoardState` objects in [CoreAPI/src/state.py](CoreAPI/src/state.py).
- Board state includes:
  - Current production/consumption
  - Connected plants/consumers and connected buildings
  - Round histories (production/consumption and power‑plant breakdown per round)
  - Last‑seen timestamps for connectivity

History is kept per‑board in memory and used for end‑game statistics. When a game ends, boards can be pruned if disconnected for too long.

### Configuration Files
- Users and boards are defined in [config/users.toml](config/users.toml).
- Display names for boards are also read from this file when present.

### Slides and Presentations
- Scenario slides and static assets are served from the presentations directory referenced in [CoreAPI/src/main.py](CoreAPI/src/main.py).

## Scoring and Statistics
- End‑game statistics are computed in [CoreAPI/src/main.py](CoreAPI/src/main.py) using scoring utilities in [CoreAPI/src/scoring.py](CoreAPI/src/scoring.py).
- Scores are based on production vs consumption (balance), costs, CO2, and popularity, derived from round histories.
- `GET /coreapi/get_statistics` returns per‑board stats and game status during a game.

## Simulation and Diagnostics
- Board simulation script: [scripts/esp32_board_simulation.py](scripts/esp32_board_simulation.py)
- TUI simulator: [tui/core/board_simulator.py](tui/core/board_simulator.py)
- Lecturer simulation dump endpoint: `GET /coreapi/lecturer/simulation_dump` in [CoreAPI/src/main.py](CoreAPI/src/main.py)

## Deployment Topology
- Nginx proxies requests to CoreAPI (see [nginx.conf](nginx.conf) and [docker-compose.yml](docker-compose.yml)).
- CoreAPI runs in Docker, serving `/coreapi/*` endpoints.
- Frontend is an Angular app (see [frontend/README.md](frontend/README.md)).

## Key Takeaways
- Communication uses HTTP with JWT; JSON for lecturers, binary for ESP32 boards.
- Game progression is script‑driven and advanced explicitly by lecturers.
- Runtime state is in memory; only user/board config is persisted in TOML.
- Statistics and scores are computed from in‑memory round histories at game end.