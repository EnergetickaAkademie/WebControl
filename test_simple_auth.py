#!/usr/bin/env python3
"""
CoreAPI Simple Authentication Test Script
Tests the new token-based authentication system
"""

import requests
import json

BASE_URL = "http://localhost"
COREAPI_URL = f"{BASE_URL}/coreapi"

def login_user(username, password):
    """Login user and return token"""
    response = requests.post(f"{COREAPI_URL}/login", json={
        "username": username,
        "password": password
    })
    
    if response.status_code == 200:
        data = response.json()
        return data['token'], data
    else:
        print(f"Login failed: {response.status_code} - {response.text}")
        return None, None

def make_authenticated_request(method, url, token, **kwargs):
    """Make a request with token authentication"""
    headers = kwargs.get('headers', {})
    headers['Authorization'] = f'Bearer {token}'
    kwargs['headers'] = headers
    
    if method.upper() == 'GET':
        return requests.get(url, **kwargs)
    elif method.upper() == 'POST':
        return requests.post(url, **kwargs)
    else:
        raise ValueError(f"Unsupported method: {method}")

def test_lecturer_endpoints(token):
    """Test lecturer-only endpoints"""
    print("=== Testing Lecturer Endpoints ===")
    
    # Test pollforusers (lecturer only)
    print("\n1. Testing pollforusers (lecturer only):")
    response = make_authenticated_request('GET', f"{COREAPI_URL}/pollforusers", token)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Found {len(data.get('boards', []))} boards")
        lecturer_info = data.get('lecturer_info', {})
        print(f"Lecturer: {lecturer_info.get('name', 'Unknown')}")
        print(f"Department: {lecturer_info.get('department', 'Unknown')}")
    else:
        print(f"Error: {response.text}")
    
    # Test game start (lecturer only)
    print("\n2. Testing game start (lecturer only):")
    response = make_authenticated_request('POST', f"{COREAPI_URL}/game/start", token)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Game started by: {data.get('started_by', 'Unknown')}")
        print(f"Department: {data.get('lecturer_department', 'Unknown')}")
    else:
        print(f"Error: {response.text}")

def test_board_endpoints(token):
    """Test board-only endpoints"""
    print("=== Testing Board Endpoints ===")
    
    # Test board registration (board only)
    print("\n1. Testing board registration (board only):")
    response = make_authenticated_request('POST', f"{COREAPI_URL}/register", token,
                           json={
                               "board_id": 101,
                               "board_name": "Test Solar Panel",
                               "board_type": "solar"
                           })
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Registered by: {data.get('registered_by', 'Unknown')}")
    else:
        print(f"Error: {response.text}")
    
    # Test power generation update (board only)
    print("\n2. Testing power generation (board only):")
    response = make_authenticated_request('POST', f"{COREAPI_URL}/power_generation", token,
                           json={
                               "board_id": 101,
                               "power": 25.5,
                               "timestamp": "2025-07-04T12:30:00Z"
                           })
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Updated by: {data.get('updated_by', 'Unknown')}")
    else:
        print(f"Error: {response.text}")

def test_cross_role_access(lecturer_token, board_token):
    """Test that roles cannot access each other's endpoints"""
    print("=== Testing Role Separation ===")
    
    # Lecturer trying to access board endpoint
    print("\n1. Lecturer trying board endpoint (should fail):")
    response = make_authenticated_request('POST', f"{COREAPI_URL}/register", lecturer_token,
                           json={"board_id": 999, "board_name": "Test"})
    print(f"Status: {response.status_code} (should be 403)")
    if response.status_code != 200:
        print(f"Error (expected): {response.text}")
    
    # Board trying to access lecturer endpoint
    print("\n2. Board trying lecturer endpoint (should fail):")
    response = make_authenticated_request('GET', f"{COREAPI_URL}/pollforusers", board_token)
    print(f"Status: {response.status_code} (should be 403)")
    if response.status_code != 200:
        print(f"Error (expected): {response.text}")

def test_query_param_auth():
    """Test authentication via query parameters (for IoT boards)"""
    print("=== Testing Query Parameter Authentication ===")
    
    # Get board token
    board_token, _ = login_user("board1", "board123")
    if not board_token:
        print("✗ Could not get board token")
        return
    
    # Test board endpoint with token as query parameter
    print("\n1. Testing board endpoint with query param auth:")
    response = requests.get(f"{COREAPI_URL}/poll/101?token={board_token}")
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print("✓ Query parameter authentication works!")
        print(f"Response: {response.json()}")
    else:
        print(f"Error: {response.text}")

def main():
    print("CoreAPI Simple Authentication Test")
    print("==================================")
    
    lecturer_accounts = [
        ("lecturer1", "lecturer123"),
        ("lecturer2", "lecturer456"),
    ]
    
    board_accounts = [
        ("board1", "board123"),
        ("board2", "board456"),
    ]
    
    lecturer_token = None
    lecturer_info = None
    board_token = None
    board_info = None

    print("\n--- Testing Lecturer Login ---")
    for username, password in lecturer_accounts:
        print(f"Trying lecturer: {username}")
        token, info = login_user(username, password)
        if token:
            print(f"✓ Lecturer login successful!")
            print(f"  Name: {info['name']}")
            print(f"  Type: {info['user_type']}")
            print(f"  Token: {token[:20]}...")
            lecturer_token = token
            lecturer_info = info
            break
        print("✗ Login failed")
    
    print("\n--- Testing Board Login ---")
    for username, password in board_accounts:
        print(f"Trying board: {username}")
        token, info = login_user(username, password)
        if token:
            print(f"✓ Board login successful!")
            print(f"  Name: {info['name']}")
            print(f"  Type: {info['user_type']}")
            print(f"  Token: {token[:20]}...")
            board_token = token
            board_info = info
            break
        print("✗ Login failed")
    
    # Test endpoints based on available tokens
    if lecturer_token:
        print("\n" + "="*50)
        test_lecturer_endpoints(lecturer_token)
    
    if board_token:
        print("\n" + "="*50)
        test_board_endpoints(board_token)
    
    if lecturer_token and board_token:
        print("\n" + "="*50)
        test_cross_role_access(lecturer_token, board_token)
    
    # Test query parameter authentication
    print("\n" + "="*50)
    test_query_param_auth()
    
    # Test public endpoints
    print("\n" + "="*50)
    print("=== Testing Public Endpoints ===")
    
    print("\n1. Health check (public):")
    response = requests.get(f"{COREAPI_URL}/health")
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Service: {data.get('service', 'Unknown')}")
        print(f"Boards registered: {data.get('boards_registered', 0)}")
    
    print("\n2. Game status (public with limited info):")
    response = requests.get(f"{COREAPI_URL}/game/status")
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Game active: {data.get('game_active', False)}")
        print(f"Current round: {data.get('current_round', 0)}")
    
    # Test authenticated game status
    if lecturer_token:
        print("\n3. Game status (authenticated lecturer):")
        response = make_authenticated_request('GET', f"{COREAPI_URL}/game/status", lecturer_token)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Board details available: {'board_details' in data}")
            lecturer_info = data.get('lecturer_info', {})
            if lecturer_info:
                print(f"Lecturer: {lecturer_info.get('name', 'Unknown')}")
                print(f"Department: {lecturer_info.get('department', 'Unknown')}")

if __name__ == "__main__":
    main()
