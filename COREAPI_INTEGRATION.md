# CoreAPI Integration with Simple Authentication

This document describes the integration of CoreAPI with the simple JWT authentication system and Docker Compose setup.

## Overview

The CoreAPI is integrated into the Docker Compose setup and accessible at `/coreapi/` with JWT authentication for user-facing endpoints.

## Architecture

```
Client/Frontend → Nginx → CoreAPI (Docker)
                      ↓
                JWT Authentication
```

## Endpoints

### Public Endpoints (No Authentication Required)

These endpoints are primarily for board/device connections:

- `GET /coreapi/health` - Health check
- `POST /coreapi/register` - Register a new board/device
- `POST /coreapi/power_generation` - Update power generation data
- `POST /coreapi/power_consumption` - Update power consumption data
- `GET /coreapi/poll/<board_id>` - Get status for specific board (binary format available)
- `POST /coreapi/submit_binary` - Submit binary data from ESP32 devices

### Optional Authentication Endpoints

These provide additional data for authenticated users:

- `GET /coreapi/game/status` - Game status (more details if authenticated)
- `GET /coreapi/poll/<board_id>` - Board status (same data regardless of auth)

### Protected Endpoints (Authentication Required)

These endpoints require valid JWT token:

- `GET /coreapi/pollforusers` - **NEW**: Get status of all boards in user-friendly format
- `POST /coreapi/game/start` - Start the game
- `POST /coreapi/game/next_round` - Advance to next round

## Key Features

### 1. `/pollforusers` Endpoint

**Purpose**: Provides frontend applications with a comprehensive view of all registered boards and game state.

**Authentication**: Required (JWT)

**Response Format**:
```json
{
  "boards": [
    {
      "board_id": 1,
      "board_name": "Solar Panel A",
      "board_type": "solar",
      "r": 3,           // current round
      "s": 25,          // total score
      "g": 15.5,        // current generation (W)
      "c": 12.3,        // current consumption (W)
      "rt": "day"       // round type
    }
  ],
  "game_status": {
    "current_round": 3,
    "total_rounds": 10,
    "round_type": "day",
    "game_active": true
  },
  "user_id": "user123"
}
```

### 2. Enhanced Authentication

- **Board Endpoints**: No authentication (allows direct ESP32/board access)
- **User Endpoints**: JWT token validation
- **Game Control**: Restricted to authenticated users only

### 3. CORS Configuration

Properly configured for frontend integration with JWT headers.

## Docker Setup

### Services Configuration

```yaml
coreapi:
  build: ./CoreAPI
  environment:
    - JWT_SECRET=your-secret-key-change-in-production
  networks:
    - app-network
  restart: unless-stopped
```

### Network Configuration

- **Internal network**: `app-network`
- **External access**: Through Nginx reverse proxy
- **Port binding**: None (internal only)

## Usage Examples

### Testing with Python Scripts

1. **Multiple Board Simulation:**
   ```bash
   python3 esp32_board_simulation.py
   ```

2. **Single Board Demo:**
   ```bash
   python3 demo_single_board.py
   ```

### Manual API Testing

```bash
# Register a board
curl -X POST http://localhost/coreapi/register \
  -H "Content-Type: application/json" \
  -d '{"board_id": 1, "board_name": "Test Board", "board_type": "solar"}'

# Submit power data
curl -X POST http://localhost/coreapi/power_generation \
  -H "Content-Type: application/json" \
  -d '{"board_id": 1, "generation": 100.5}'
```

## Security Notes

- Board endpoints are public for ESP32 device access
- User endpoints require JWT authentication
- Game control is restricted to authenticated users
- CORS is properly configured for frontend integration
    - app-network
  restart: unless-stopped
```

### Nginx Routing

```nginx
location /coreapi/ {
    proxy_pass http://coreapi:5000/;
    # ... CORS and header configuration
}
```

## Usage Examples

### Frontend Integration

```typescript
// In your Angular service
async getAllBoardsStatus(): Promise<any> {
  const response = await fetch('/coreapi/pollforusers', {
    headers: {
      'st-access-token': this.getAccessToken()
    }
  });
  return response.json();
}
```

### Board/ESP32 Integration

```cpp
// ESP32 code example
void registerBoard() {
  HTTPClient http;
  http.begin("http://yourserver/coreapi/register");
  http.addHeader("Content-Type", "application/json");
  
  String payload = "{\"board_id\": 1, \"board_name\": \"ESP32 Solar\", \"board_type\": \"solar\"}";
  int responseCode = http.POST(payload);
  
  http.end();
}
```

## Deployment

1. Build and start all services:
```bash
docker-compose up --build
```

2. The CoreAPI will be available at:
   - Direct access: `http://localhost/coreapi/`
   - Health check: `http://localhost/coreapi/health`

## Testing

Use the provided test script:
```bash
python3 test_coreapi.py
```

This script tests both authenticated and non-authenticated endpoints.

## Security Considerations

1. **Board Registration**: Open to allow direct device access
2. **Game Control**: Protected by SuperTokens authentication
3. **User Data**: `/pollforusers` requires authentication
4. **CORS**: Configured for localhost (update for production)

## Development Notes

- CoreAPI runs on port 5000 internally
- Flask debug mode disabled in production
- Session verification done via SuperTokens Core API
- Error handling returns appropriate HTTP status codes

## Future Enhancements

1. **Rate Limiting**: Add rate limiting for board endpoints
2. **Device Authentication**: Optional device-specific tokens
3. **Real-time Updates**: WebSocket support for live data
4. **Data Persistence**: Database integration for historical data
