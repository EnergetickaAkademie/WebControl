#!/usr/bin/env python3
"""
Simple User Management Script for WebControl

This script helps manage users in the TOML configuration file.
"""

import argparse
import sys
import os
import toml
from typing import Dict, Any

def load_config(config_file: str) -> Dict[str, Any]:
    """Load TOML configuration file"""
    try:
        if os.path.exists(config_file):
            with open(config_file, 'r', encoding='utf-8') as f:
                return toml.load(f)
        else:
            return {"lecturers": {}, "boards": {}, "groups": {}}
    except Exception as e:
        print(f"❌ Error loading config: {e}")
        return {"lecturers": {}, "boards": {}, "groups": {}}

def save_config(config: Dict[str, Any], config_file: str) -> bool:
    """Save TOML configuration file"""
    try:
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(config_file), exist_ok=True)
        
        with open(config_file, 'w', encoding='utf-8') as f:
            toml.dump(config, f)
        return True
    except Exception as e:
        print(f"❌ Error saving config: {e}")
        return False

def list_users(args):
    """List all users"""
    config = load_config(args.config)
    
    if args.type in ['lecturers', 'all']:
        lecturers = config.get('lecturers', {})
        print(f"👨‍🏫 Lecturers ({len(lecturers)}):")
        for username, info in lecturers.items():
            print(f"   - {username:15} | {info.get('name', 'N/A'):25} | {info.get('group', 'group1'):10}")
    
    if args.type in ['boards', 'all']:
        boards = config.get('boards', {})
        print(f"\n📱 Boards ({len(boards)}):")
        for username, info in boards.items():
            print(f"   - {username:15} | {info.get('name', 'N/A'):25} | {info.get('group', 'group1'):10}")
    
    groups = config.get('groups', {})
    if groups:
        print(f"\n🏢 Groups ({len(groups)}):")
        for group_id, info in groups.items():
            print(f"   - {group_id:15} | {info.get('name', 'N/A'):25} | max: {info.get('max_boards', 'N/A')}")

def add_user(args):
    """Add a new user"""
    config = load_config(args.config)
    
    user_type = args.type
    username = args.username
    password = args.password
    name = args.name or username
    group = args.group or "group1"
    
    # Check if user already exists
    if username in config.get(f"{user_type}s", {}):
        print(f"❌ User {username} already exists in {user_type}s")
        return False
    
    # Add user
    if f"{user_type}s" not in config:
        config[f"{user_type}s"] = {}
    
    config[f"{user_type}s"][username] = {
        "password": password,
        "name": name,
        "group": group
    }
    
    if save_config(config, args.config):
        print(f"✅ Added {user_type} user: {username} ({name})")
        return True
    else:
        return False

def remove_user(args):
    """Remove a user"""
    config = load_config(args.config)
    
    username = args.username
    
    # Find user in lecturers or boards
    found = False
    for user_type in ['lecturers', 'boards']:
        if username in config.get(user_type, {}):
            del config[user_type][username]
            found = True
            print(f"✅ Removed {user_type[:-1]} user: {username}")
            break
    
    if not found:
        print(f"❌ User {username} not found")
        return False
    
    return save_config(config, args.config)

def change_password(args):
    """Change user password"""
    config = load_config(args.config)
    
    username = args.username
    new_password = args.password
    
    # Find user in lecturers or boards
    found = False
    for user_type in ['lecturers', 'boards']:
        if username in config.get(user_type, {}):
            config[user_type][username]["password"] = new_password
            found = True
            print(f"✅ Changed password for {user_type[:-1]} user: {username}")
            break
    
    if not found:
        print(f"❌ User {username} not found")
        return False
    
    return save_config(config, args.config)

def create_sample(args):
    """Create sample configuration"""
    config = {
        "lecturers": {
            "lecturer1": {"password": "lecturer123", "name": "Dr. John Smith", "group": "group1"},
            "admin": {"password": "admin2024", "name": "System Administrator", "group": "group1"}
        },
        "boards": {
            "board1": {"password": "board123", "name": "Solar Panel Team", "group": "group1"},
            "board2": {"password": "board456", "name": "Wind Power Team", "group": "group1"},
            "demo": {"password": "demo123", "name": "Demo Board", "group": "demo"}
        },
        "groups": {
            "group1": {"name": "Primary Game Group", "max_boards": 10},
            "demo": {"name": "Demo Group", "max_boards": 5}
        }
    }
    
    if not args.force and os.path.exists(args.config):
        print(f"❌ Configuration file already exists: {args.config}")
        print("Use --force to overwrite")
        return False
    
    if save_config(config, args.config):
        print(f"✅ Created sample configuration: {args.config}")
        return True
    else:
        return False

def sync_database(args):
    """Force restart of CoreAPI to reload configuration"""
    print("🔄 To sync the database with your TOML configuration:")
    print("   1. Make sure your TOML file is correct")
    print("   2. Restart the CoreAPI container:")
    print("      docker-compose restart coreapi")
    print("   3. Check the logs to see if users were loaded:")
    print("      docker-compose logs coreapi")
    print("\nNote: The system loads users from TOML when the database is empty")
    return True

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="WebControl User Management Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s list                                    # List all users
  %(prog)s add lecturer teacher1 pass123 "Dr. Jane Doe"  # Add lecturer
  %(prog)s add board team5 team123 "Team 5"       # Add board
  %(prog)s remove board1                           # Remove user
  %(prog)s passwd lecturer1 newpass123            # Change password
  %(prog)s create-sample                           # Create sample config
  %(prog)s sync-db                                 # Instructions to sync database
        """
    )
    
    parser.add_argument('--config', default='config/users.toml',
                        help='Configuration file path (default: config/users.toml)')
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # List command
    list_parser = subparsers.add_parser('list', help='List users')
    list_parser.add_argument('--type', choices=['lecturers', 'boards', 'all'], 
                             default='all', help='Type of users to list')
    
    # Add command
    add_parser = subparsers.add_parser('add', help='Add a new user')
    add_parser.add_argument('type', choices=['lecturer', 'board'], help='User type')
    add_parser.add_argument('username', help='Username')
    add_parser.add_argument('password', help='Password')
    add_parser.add_argument('name', nargs='?', help='Display name (optional)')
    add_parser.add_argument('--group', help='Group ID (default: group1)')
    
    # Remove command
    remove_parser = subparsers.add_parser('remove', help='Remove a user')
    remove_parser.add_argument('username', help='Username to remove')
    
    # Password command
    passwd_parser = subparsers.add_parser('passwd', help='Change user password')
    passwd_parser.add_argument('username', help='Username')
    passwd_parser.add_argument('password', help='New password')
    
    # Create sample command
    sample_parser = subparsers.add_parser('create-sample', help='Create sample configuration')
    sample_parser.add_argument('--force', action='store_true',
                               help='Overwrite existing configuration')
    
    # Sync database command
    sync_parser = subparsers.add_parser('sync-db', help='Instructions to sync database')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    # Execute command
    command_functions = {
        'list': list_users,
        'add': add_user,
        'remove': remove_user,
        'passwd': change_password,
        'create-sample': create_sample,
        'sync-db': sync_database
    }
    
    success = command_functions[args.command](args)
    return 0 if success else 1

if __name__ == '__main__':
    sys.exit(main())
