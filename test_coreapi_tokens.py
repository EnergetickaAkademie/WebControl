#!/usr/bin/env python3
"""
CoreAPI Authentication Test Script - Token-based authentication
"""

import requests
import json

BASE_URL = "http://localhost"
API_URL = f"{BASE_URL}/api"
COREAPI_URL = f"{BASE_URL}/coreapi"

def login_and_get_token(email, password):
    """Login user and extract access token"""
    response = requests.post(f"{API_URL}/signin", json={
        "formFields": [
            {"id": "email", "value": email},
            {"id": "password", "value": password}
        ]
    })
    
    if response.status_code == 200:
        # Try to get token from response JSON
        response_data = response.json()
        access_token = response_data.get('accessToken')
        
        # If not in JSON, try headers
        if not access_token:
            access_token = response.headers.get('st-access-token')
        
        return access_token
    
    print(f"Login failed: {response.status_code} - {response.text}")
    return None

def make_authenticated_request(method, url, token, **kwargs):
    """Make a request with token authentication"""
    headers = kwargs.get('headers', {})
    headers['st-access-token'] = token
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
    else:
        print(f"Error: {response.text}")
    
    # Test game start (lecturer only)
    print("\n2. Testing game start (lecturer only):")
    response = make_authenticated_request('POST', f"{COREAPI_URL}/game/start", token)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Game started by: {data.get('started_by', 'Unknown')}")
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
    board_token = login_and_get_token("board1@iot.local", "BoardSecure001!")
    if not board_token:
        print("✗ Could not get board token")
        return
    
    # Test board endpoint with token as query parameter
    print("\n1. Testing board endpoint with query param auth:")
    response = requests.get(f"{COREAPI_URL}/poll/101?access_token={board_token}")
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print("✓ Query parameter authentication works!")
        print(f"Response: {response.json()}")
    else:
        print(f"Error: {response.text}")

def main():
    print("CoreAPI Token-Based Authentication Test")
    print("======================================")
    
    lecturer_accounts = [
        ("john.smith@university.edu", "SecurePassword123!"),
        ("maria.garcia@university.edu", "SecurePassword456!"),
    ]
    
    board_accounts = [
        ("board1@iot.local", "BoardSecure001!"),
        ("board2@iot.local", "BoardSecure002!"),
    ]
    
    lecturer_token = None
    board_token = None

    print("\n--- Testing Lecturer Login ---")
    for email, password in lecturer_accounts:
        print(f"Trying lecturer: {email}")
        token = login_and_get_token(email, password)
        if token:
            print(f"✓ Lecturer login successful! Token: {token[:20]}...")
            lecturer_token = token
            break
        print("✗ Login failed")
    
    print("\n--- Testing Board Login ---")
    for email, password in board_accounts:
        print(f"Trying board: {email}")
        token = login_and_get_token(email, password)
        if token:
            print(f"✓ Board login successful! Token: {token[:20]}...")
            board_token = token
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
        print(f"Service: {response.json().get('service', 'Unknown')}")
    
    print("\n2. Game status (public with limited info):")
    response = requests.get(f"{COREAPI_URL}/game/status")
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Game active: {data.get('game_active', False)}")
        print(f"Current round: {data.get('current_round', 0)}")

if __name__ == "__main__":
    main()
