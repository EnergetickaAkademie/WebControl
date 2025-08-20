# User Configuration Guide

This document explains how to configure board and lecturer accounts using the simple TOML configuration file.

## Configuration File

The user accounts are configured in `config/users.toml`. This file contains three main sections:

- `[lecturers]` - Lecturer accounts for game administration
- `[boards]` - Board accounts for ESP32 devices and teams  
- `[groups]` - Group configuration

## TOML Format

TOML (Tom's Obvious, Minimal Language) is a simple configuration file format. Here's the basic syntax:

```toml
# Comments start with #
[section_name]
key = "value"
username = { password = "pass123", name = "Display Name", group = "group1" }
```

## Configuration Sections

### Lecturers

Lecturer accounts have administrative access to the game dashboard.

```toml
[lecturers]
lecturer1 = { password = "lecturer123", name = "Dr. John Smith", group = "group1" }
lecturer2 = { password = "lecturer456", name = "Prof. Maria Garcia", group = "group1" }
admin = { password = "admin2024", name = "System Administrator", group = "group1" }
```

**Fields:**
- `password` - Login password (required)
- `name` - Display name shown in the interface (required)
- `group` - Group assignment (optional, defaults to "group1")

### Boards

Board accounts are used by ESP32 devices and student teams.

```toml
[boards]
board1 = { password = "board123", name = "Solar Panel Team", group = "group1" }
board2 = { password = "board456", name = "Wind Power Team", group = "group1" }
demo = { password = "demo123", name = "Demo Board", group = "demo" }
```

**Fields:**
- `password` - Login password (required)
- `name` - Display name for the team/device (required)
- `group` - Group assignment (optional, defaults to "group1")

### Groups

Groups organize boards and lecturers into separate game sessions.

```toml
[groups]
group1 = { name = "Primary Game Group", max_boards = 10 }
demo = { name = "Demo Group", max_boards = 5 }
```

**Fields:**
- `name` - Human-readable group name (required)
- `max_boards` - Maximum number of boards allowed in this group (optional)

## Managing Users

### Using the Management Script

A command-line tool is provided for managing users:

```bash
# List all users
python3 manage_users.py list

# Add a new lecturer
python3 manage_users.py add lecturer teacher1 pass123 "Dr. Jane Doe"

# Add a new board
python3 manage_users.py add board team5 team123 "Team 5"

# Remove a user
python3 manage_users.py remove board1

# Change password
python3 manage_users.py passwd lecturer1 newpass123

# Create sample configuration
python3 manage_users.py create-sample
```

### Manual Editing

You can also edit the `config/users.toml` file directly with any text editor.

**Important:** After making changes, restart the CoreAPI service or use the reload endpoint:

```bash
# Restart Docker services
docker-compose restart coreapi

# Or use the API endpoint
curl -X POST http://localhost/coreapi/config/reload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Examples

### Basic Setup

```toml
# Simple configuration for a classroom
[lecturers]
teacher = { password = "teach123", name = "Mrs. Johnson", group = "class1" }

[boards]
team1 = { password = "team123", name = "Team Alpha", group = "class1" }
team2 = { password = "team456", name = "Team Beta", group = "class1" }
team3 = { password = "team789", name = "Team Gamma", group = "class1" }

[groups]
class1 = { name = "Physics Class 2024", max_boards = 6 }
```

### Multi-Group Setup

```toml
# Configuration for multiple classes/sessions
[lecturers]
teacher1 = { password = "teach123", name = "Dr. Smith", group = "morning" }
teacher2 = { password = "teach456", name = "Prof. Johnson", group = "afternoon" }
admin = { password = "admin789", name = "Lab Admin", group = "morning" }

[boards]
# Morning session teams
morning1 = { password = "sun123", name = "Solar Team", group = "morning" }
morning2 = { password = "wind123", name = "Wind Team", group = "morning" }

# Afternoon session teams
afternoon1 = { password = "hydro123", name = "Hydro Team", group = "afternoon" }
afternoon2 = { password = "nuclear123", name = "Nuclear Team", group = "afternoon" }

# Demo board for both sessions
demo = { password = "demo123", name = "Demo Board", group = "demo" }

[groups]
morning = { name = "Morning Physics Lab", max_boards = 8 }
afternoon = { name = "Afternoon Engineering Lab", max_boards = 8 }
demo = { name = "Demonstration Setup", max_boards = 1 }
```

## Security Considerations

1. **Use strong passwords** - Especially for lecturer accounts
2. **Limit group access** - Assign users to appropriate groups
3. **Regular updates** - Change default passwords before production use
4. **Backup configuration** - Keep a backup of your `users.toml` file

## Troubleshooting

### Configuration Not Loading

1. Check file syntax using a TOML validator
2. Ensure the file is in the correct location: `config/users.toml`
3. Check file permissions (readable by the application)
4. Look at the CoreAPI logs for error messages

### Users Not Created

1. Check for duplicate usernames
2. Ensure all required fields are present (password, name)
3. Restart the CoreAPI service after configuration changes
4. Check the database file permissions

### Login Issues

1. Verify username and password are correct
2. Check that the user type matches (lecturer vs board)
3. Ensure the user's group exists in the configuration
4. Try reloading the configuration via the API

## API Endpoints

The system provides several API endpoints for configuration management:

- `GET /coreapi/config/users` - List all configured users
- `GET /coreapi/config/groups` - List all configured groups
- `POST /coreapi/config/reload` - Reload configuration from file

These endpoints require lecturer authentication.
