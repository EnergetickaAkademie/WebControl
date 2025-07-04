# WebControl - Energy Management System

A comprehensive energy management system with secure lecturer authentication and IoT board integration.

## Features

- **🔒 Secure Authentication**: Uses SuperTokens with persistent PostgreSQL storage
- **🌟 CoreAPI Integration**: Manages IoT boards and energy data
- **� Real-time Monitoring**: Track power generation and consumption
- **🎮 Game Management**: Control rounds and scoring for educational purposes
- **📱 Mobile Friendly**: Responsive design for all devices

## System Components

- **Frontend**: Angular 17 application
- **Backend API**: Express.js with SuperTokens authentication  
- **CoreAPI**: Flask-based API for IoT board management
- **Database**: PostgreSQL for persistent data storage
- **Reverse Proxy**: Nginx for routing and CORS handling

## Demo Users

After running setup, these accounts will be available:

### Lecturer Accounts (Game Control)
- **john.smith@university.edu** / SecurePassword123! (Electrical Engineering)
- **maria.garcia@university.edu** / SecurePassword456! (Renewable Energy)
- **david.johnson@university.edu** / SecurePassword789! (Computer Science)
- **admin@university.edu** / AdminPassword123! (IT Administration)

### Board Accounts (IoT Devices)
- **board1@iot.local** / BoardSecure001! (Solar Panel Board)
- **board2@iot.local** / BoardSecure002! (Wind Turbine Board)
- **board3@iot.local** / BoardSecure003! (Battery Storage Board)
- **board4@iot.local** / BoardSecure004! (Load Monitor Board)

## Quick Start

### Production Mode (Recommended)

1. **Start all services:**
   ```bash
   docker-compose up --build -d
   ```

2. **Setup users (run once):**
   ```bash
   ./setup-production-users.sh
   ```

3. **Visit:** http://localhost

### Development Mode

1. **Start infrastructure:**
   ```bash
   docker-compose up postgres core -d
   ```

2. **Start Backend:**
   ```bash
   cd backend
   npm install
   npm run setup-users  # Setup users first
   npm run dev
   ```

3. **Start CoreAPI:**
   ```bash
   cd CoreAPI
   pip install -r requirements.txt
   python src/main.py
   ```

4. **Start Frontend:**
   ```bash
   cd frontend
   npm install
   ng serve --port 4200
   ```

## User Setup

### First Time Setup
After starting the system, you need to create the predefined user accounts:

**Production:**
```bash
./setup-production-users.sh
```

**Development:**
```bash
cd backend
npm run setup-users
```

### Persistence
- ✅ **User data is now persistent** (stored in PostgreSQL)
- ✅ **Survives container restarts**
- ✅ **Data stored in named Docker volume**

## API Endpoints

### Authentication API (`/api/`)
- `POST /api/signin` - Login with email/password
- `POST /api/signout` - Logout and clear session
- `GET /api/dashboard` - Protected dashboard endpoint (shows user role)

### CoreAPI (`/coreapi/`) - Role-Based Access

#### Lecturer-Only Endpoints (Game Control)
- `GET /coreapi/pollforusers` - Get all boards status (lecturer auth required)
- `POST /coreapi/game/start` - Start game (lecturer auth required)
- `POST /coreapi/game/next_round` - Advance game round (lecturer auth required)

#### Board-Only Endpoints (IoT Operations)
- `POST /coreapi/register` - Register new IoT board (board auth required)
- `POST /coreapi/power_generation` - Update power generation (board auth required)
- `POST /coreapi/power_consumption` - Update power consumption (board auth required)
- `GET /coreapi/poll/<board_id>` - Get specific board status (board auth required)
- `GET /coreapi/poll_binary/<board_id>` - Get binary board status (board auth required)
- `POST /coreapi/submit_binary` - Submit binary data (board auth required)

#### Public Endpoints
- `GET /coreapi/health` - Health check
- `GET /coreapi/game/status` - Get game status (enhanced info for authenticated users)

## Security Features

| Feature | Description |
|---------|-------------|
| **Role-Based Access** | Lecturers control games, boards manage IoT operations |
| **HttpOnly Cookies** | Tokens are not accessible to JavaScript, preventing XSS attacks |
| **Session Management** | Persistent sessions with configurable expiry |
| **CORS Protection** | Configured to only allow requests from the frontend domain |
| **Anti-CSRF** | SuperTokens handles CSRF protection automatically |
| **Predefined Users** | No user registration - only authorized accounts |
| **Endpoint Separation** | Different user types cannot access each other's endpoints |

## Architecture

- **Frontend**: Angular 17 with reactive forms
- **Backend**: Express.js with SuperTokens authentication
- **CoreAPI**: Flask API for IoT board management
- **Database**: PostgreSQL for persistent storage
- **Authentication**: SuperTokens with EmailPassword recipe
- **Reverse Proxy**: Nginx for routing and CORS

## Perfect for Educational Environments

This system is designed for educational energy management scenarios:

1. **IoT Board Integration**: ESP32 boards can register and send power data
2. **Game Mechanics**: Round-based scoring system for educational purposes
3. **User Management**: Lecturers can control game flow and monitor all boards
4. **Real-time Data**: Live power generation and consumption tracking

## File Structure

```
├── docker-compose.yml          # Docker orchestration with PostgreSQL
├── nginx.conf                  # Reverse proxy configuration
├── supertokens-config.yaml     # SuperTokens configuration
├── setup-production-users.sh   # User setup script
├── test_coreapi.py            # API testing script
├── backend/
│   ├── Dockerfile
│   ├── index.ts               # Main server file
│   ├── setup-users.ts         # User creation script
│   └── package.json
├── frontend/
│   ├── Dockerfile
│   ├── src/app/
│   │   ├── auth.service.ts    # Authentication service
│   │   ├── auth.guard.ts      # Route protection
│   │   ├── creds.interceptor.ts # HTTP interceptor
│   │   ├── login/             # Login component
│   │   └── dashboard/         # Protected dashboard
│   └── package.json
└── CoreAPI/
    ├── Dockerfile
    ├── src/
    │   ├── main.py           # Flask application
    │   ├── state.py          # Game state management
    │   └── auth.py           # SuperTokens integration
    └── requirements.txt
```

## Testing

Test the CoreAPI integration:
```bash
python3 test_coreapi.py
```

## Troubleshooting

### Users Not Persisting
If users don't persist after container restart:
1. Ensure PostgreSQL volume is properly mounted
2. Check database connection in logs: `docker-compose logs core`
3. Re-run user setup: `./setup-production-users.sh`

### CoreAPI Authentication Issues
1. Verify SuperTokens Core is running: `curl http://localhost/coreapi/health`
2. Check nginx routing: `docker-compose logs nginx`
3. Test with authentication headers

## Support

This application integrates SuperTokens authentication with a Flask-based IoT management system for educational energy monitoring scenarios.
