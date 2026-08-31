# WebControl

WebControl is an educational energy-management system. Lecturers control
scenario-based games in the Angular web application. ESP32 boards report power
generation and consumption to the Flask API.

## Components

- `frontend/`: Angular application served by Nginx.
- `CoreAPI/`: Flask API, game state, scoring, authentication, and board APIs.
- `config/`: deployment configuration for users, boards, and firmware updates.
- `scripts/esp32_board_simulation.py`: optional board simulator.

## Requirements

- Docker with Docker Compose.
- Git with submodule support.

Clone the repository with its CoreAPI submodule:

```bash
git clone --recurse-submodules https://github.com/EnergetickaAkademie/WebControl.git
cd WebControl
```

If the repository was cloned without submodules, run:

```bash
git submodule update --init --recursive
```

## Configuration

Create the deployment-only `config/` directory with these files:

- `config/users.toml`: lecturer and board accounts, display names, groups, and
  per-board `ota_password` values.
- `config/firmware.toml`: firmware repository or manifest URL, GitHub token,
  cache duration, and OTA port.

The configuration is mounted read-only into CoreAPI. Edit it on the host and
restart CoreAPI after changes:

```bash
docker compose restart coreapi
```

Do not commit passwords or tokens. See
[docs/USER_CONFIGURATION.md](docs/USER_CONFIGURATION.md) for the TOML format.

## Run locally

Production containers:

```bash
docker compose up --build -d
```

Open `http://localhost` after the containers start.

For frontend hot reload and verbose CoreAPI logging:

```bash
docker compose -f docker-compose.debug.yml up --build
```

Stop the services with:

```bash
docker compose down
```

The production compose file builds both images locally. Pushing to the
`deploy` branch also runs the GitHub Actions workflow that publishes the
`coreapi` and `webcontrol` images to GHCR.

## Test and build

CoreAPI:

```bash
cd CoreAPI
python -m pytest -q
```

Frontend:

```bash
cd frontend
npm ci
npm test -- --watch=false
npm run build -- --configuration production
```

Optional board simulation:

```bash
python scripts/esp32_board_simulation.py
```

## Documentation

- [docs/ENDPOINTS.md](docs/ENDPOINTS.md): lecturer and board endpoints.
- [docs/ESP32_BINARY_PROTOCOL.md](docs/ESP32_BINARY_PROTOCOL.md): binary
  protocol formats.
- [docs/COREAPI_INTEGRATION.md](docs/COREAPI_INTEGRATION.md): frontend and
  API integration details.
- [CoreAPI/README.md](CoreAPI/README.md): CoreAPI-specific information.
- [frontend/README.md](frontend/README.md): Angular development commands.

## License

MIT. See [LICENSE](LICENSE).
