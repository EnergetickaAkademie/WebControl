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

2. **Visit:** http://localhost

### Development Mode

1. **Start services:**
   ```bash
   docker-compose up --build
   ```

2. **Test with simulation:**
   ```bash
   python3 esp32_board_simulation.py
   ```

3. **Or test with single board:**
   ```bash
   python3 demo_single_board.py
   ```

## Testing

The project includes two Python scripts for testing:

- **`esp32_board_simulation.py`** - Simulates multiple ESP32 boards using the binary protocol
- **`demo_single_board.py`** - Simple demonstration with a single board

## Project Structure

```
WebControl/
├── CoreAPI/              # Flask-based API backend
├── frontend/             # Angular frontend application
├── docker-compose.yml    # Docker setup for production
├── nginx.conf           # Nginx configuration
├── esp32_board_simulation.py  # Multi-board simulation
└── demo_single_board.py       # Single board demo
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
