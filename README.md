# WebControl - Energy Management System

A comprehensive energy management system with secure lecturer authentication and IoT board integration.

## Features

- **🔒 Simple Authentication**: JWT-based authentication for user management
- **🌟 CoreAPI Integration**: Manages IoT boards and energy data
- **⚡ Real-time Monitoring**: Track power generation and consumption
- **🎮 Game Management**: Control rounds and scoring for educational purposes
- **📱 Mobile Friendly**: Responsive design for all devices

## System Components

- **Frontend**: Angular 17 application
- **CoreAPI**: Flask-based API for IoT board management with simple authentication
- **Reverse Proxy**: Nginx for routing and CORS handling

## Demo Users

The system includes predefined user accounts for testing:

### Lecturer Accounts (Game Control)
- **lecturer1** / lecturer123 (Dr. John Smith, Computer Science)
- **lecturer2** / lecturer456 (Prof. Maria Garcia, Physics)

### Board Accounts (IoT Devices)
- **board1** / board123 (Solar Panel Board #1)
- **board2** / board456 (Wind Turbine Board #2)
- **board3** / board789 (Battery Storage Board #3)

## Quick Start

### Production Mode (Recommended)

1. **Start all services:**
   ```bash
   docker-compose up --build -d
   ```

2. **Visit:** http://localhost (users are created automatically on first start)

### Development Mode

1. **Start services:**
   ```bash
   docker-compose up --build
   ```

2. **Test with simulation:**
   ```bash
   python3 esp32_board_simulation.py
   ```

### Debug Mode

For debugging with detailed logs and hot reloading:

1. **Start services in debug mode:**
   ```bash
   docker-compose -f docker-compose.debug.yml up --build
   ```

2. **Debug mode features:**
   - Frontend hot reloading enabled
   - Detailed logging in CoreAPI (DEBUG=true)
   - Source maps for easier debugging
   - Development server ports exposed

3. **Toggle debug logging in production:**
   ```bash
   # Edit docker-compose.yml and change:
   # - DEBUG=false  # Set to 'true' for verbose logging
   # to:
   # - DEBUG=true   # Enable verbose logging
   
   # Then restart:
   docker-compose down && docker-compose up --build -d
   ```

4. **Debug mode logging includes:**
   - Game statistics and round details
   - Authentication attempts (including passwords)
   - Binary protocol data exchanges
   - Detailed error traces

## 🔧 Development - Important Cache Management

**⚠️ CRITICAL: After making changes to CoreAPI, you MUST clear Docker cache to see updates!**

### Force CoreAPI Updates After Changes

1. **Stop all services:**
   ```bash
   docker-compose down
   ```

2. **Remove CoreAPI image and cache:**
   ```bash
   docker rmi webcontrol-coreapi-1 || true
   docker builder prune -f
   ```

3. **Rebuild and start with fresh cache:**
   ```bash
   docker-compose up --build --force-recreate
   ```

### Alternative: Complete Cache Reset

If you're still seeing old code after changes:

```bash
# Nuclear option - removes ALL Docker cache
docker-compose down
docker system prune -a -f
docker-compose up --build
```

### Quick Development Workflow

```bash
# After making changes to CoreAPI code:
docker-compose down
docker rmi webcontrol-coreapi-1
docker-compose up --build
```

## Testing

The project includes a Python script for testing:

- **`esp32_board_simulation.py`** - Simulates multiple ESP32 boards using the binary protocol

### Running Tests

```bash
# Test with board simulation
python3 esp32_board_simulation.py

# Test CoreAPI health
curl http://localhost/coreapi/health

# Test with authentication
curl -X POST http://localhost/coreapi/login \
  -H "Content-Type: application/json" \
  -d '{"username": "lecturer1", "password": "lecturer123"}'
```

## Project Structure

```
WebControl/
├── CoreAPI/              # Flask-based API backend
├── frontend/             # Angular frontend application
├── docker-compose.yml    # Docker setup for production
├── docker-compose.debug.yml  # Docker setup for debug mode
├── nginx.conf           # Nginx configuration
└── esp32_board_simulation.py  # Multi-board simulation
```

## API Endpoints

See `COREAPI_INTEGRATION.md` for detailed API documentation.

## Binary Protocol

ESP32 devices can use an optimized binary protocol. See `ESP32_BINARY_PROTOCOL.md` for details.

## Development

The system is designed for educational energy management games where:
- Lecturers can control game rounds and monitor all boards
- IoT boards (ESP32) can register and submit power data
- Real-time dashboard shows power generation/consumption

## Security

- Simple JWT-based authentication
- CORS properly configured for frontend integration
- Board endpoints are public for ESP32 device access
- User endpoints require authentication
## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions, please use the GitHub issue tracker.
│   │   └── dashboard/         # Protected dashboard
│   └── package.json
└── CoreAPI/
    ├── Dockerfile
    ├── src/
    │   ├── main.py           # Flask application
    │   ├── state.py          # Game state management
    │   └── simple_auth.py    # Simple JWT authentication
    └── requirements.txt
```

## Troubleshooting

### Users Not Created
If users are not created automatically:
1. Check CoreAPI logs: `docker-compose logs coreapi`
2. Ensure the database file is writable
3. Restart the CoreAPI service: `docker-compose restart coreapi`

### CoreAPI Authentication Issues
1. Verify CoreAPI is running: `curl http://localhost/coreapi/health`
2. Check nginx routing: `docker-compose logs nginx`
3. Test with proper authentication headers

### CoreAPI Code Changes Not Reflected
**This is the most common issue!**

1. **Stop services:**
   ```bash
   docker-compose down
   ```

2. **Remove CoreAPI image:**
   ```bash
   docker rmi webcontrol-coreapi-1
   ```

3. **Rebuild:**
   ```bash
   docker-compose up --build
   ```

### Frontend Changes Not Reflected
1. **For debug mode:** Changes should auto-reload
2. **For production mode:** Rebuild frontend container:
   ```bash
   docker-compose down
   docker rmi webcontrol-nginx-1
   docker-compose up --build
   ```

### View Container Logs
```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs coreapi
docker-compose logs nginx

# Follow logs in real-time
docker-compose logs -f coreapi
```

## Support

This application uses simple JWT authentication with a Flask-based IoT management system for educational energy monitoring scenarios.
