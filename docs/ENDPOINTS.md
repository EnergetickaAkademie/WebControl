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

