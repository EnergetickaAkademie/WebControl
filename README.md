# Lecturer Login App

A secure login system for lecturers that ensures no traces are left on school computers.

## Features

- **🔒 Secure Authentication**: Uses SuperTokens with HttpOnly cookies
- **🚫 No Traces**: Session cookies are cleared when browser closes
- **👥 Predefined Users**: No registration - only predefined lecturer accounts
- **📱 Mobile Friendly**: Responsive design for all devices

## Demo Users

- **lecturer1@school.edu** / SecurePass123!
- **lecturer2@school.edu** / TeachSafe456!
- **lecturer3@school.edu** / EduSecure789!
- **admin@school.edu** / AdminPass000!

## Quick Start

### Development Mode

1. **Start SuperTokens Core:**
   ```bash
   docker run -d -p 3567:3567 --name st-core registry.supertokens.io/supertokens/supertokens-postgresql:latest
   ```

2. **Start Backend:**
   ```bash
   cd backend
   npm install
   npm run dev
   ```

3. **Start Frontend:**
   ```bash
   cd frontend
   npm install
   ng serve --port 4200
   ```

4. **Visit:** http://localhost:4200

### Production Mode (Docker)

```bash
docker-compose up --build
```

Then visit: http://localhost:4200

## Security Features

| Feature | Description |
|---------|-------------|
| **HttpOnly Cookies** | Tokens are not accessible to JavaScript, preventing XSS attacks |
| **Session Expiry** | Sessions expire when browser closes (no persistent login) |
| **CORS Protection** | Configured to only allow requests from the frontend domain |
| **Anti-CSRF** | SuperTokens handles CSRF protection automatically |
| **Predefined Users** | No user registration - only authorized lecturer accounts |

## Architecture

- **Frontend**: Angular 17 with reactive forms
- **Backend**: Express.js with SuperTokens authentication
- **Database**: In-memory (perfect for demos, no data persistence)
- **Authentication**: SuperTokens with EmailPassword recipe

## Perfect for School Environments

This app is designed specifically for lecturers who need to login on school computers:

1. **No Registration**: Only predefined accounts can login
2. **No Persistent State**: Sessions clear when browser closes
3. **Secure Cookies**: No credentials stored in localStorage or sessionStorage
4. **Easy Logout**: One-click logout clears all session data

## API Endpoints

- `POST /api/auth/signin` - Login with email/password
- `POST /api/auth/signout` - Logout and clear session
- `GET /api/profile` - Get user profile (protected)
- `GET /api/hello` - Hello world endpoint (protected)

## Files Structure

```
├── docker-compose.yml          # Docker orchestration
├── backend/
│   ├── Dockerfile
│   ├── index.ts               # Main server file
│   └── package.json
└── frontend/
    ├── Dockerfile
    ├── src/app/
    │   ├── auth.service.ts    # Authentication service
    │   ├── auth.guard.ts      # Route protection
    │   ├── creds.interceptor.ts # HTTP interceptor
    │   ├── login/             # Login component
    │   └── dashboard/         # Protected dashboard
    └── package.json
```

## Support

This application follows the SuperTokens tutorial and best practices for secure authentication in educational environments.
