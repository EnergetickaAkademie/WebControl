#!/usr/bin/env python3
"""
Quick Board Test Script
Simple script to test board registration and data submission.
"""

import requests
import json
import time

BASE_URL = "http://localhost"
COREAPI_URL = f"{BASE_URL}/coreapi"

def test_board_flow():
    """Test the complete board workflow"""
    
    # Test board credentials
    board_username = "board1"
    board_password = "board123"
    board_id = 9999
    board_name = "Test Board"
    board_type = "solar"
    
    print("=== Testing Board Flow ===")
    
    # Step 1: Login
    print("1. Logging in as board...")
    login_response = requests.post(f"{COREAPI_URL}/login", json={
        "username": board_username,
        "password": board_password
    })
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code} - {login_response.text}")
        return
    
    login_data = login_response.json()
    token = login_data.get('token')
    if not token:
        print("❌ No token received")
        return
    
    print(f"✅ Login successful, got token")
    headers = {'Authorization': f'Bearer {token}'}
    
    # Step 2: Register board
    print("2. Registering board...")
    register_response = requests.post(f"{COREAPI_URL}/register", 
                                    headers=headers,
                                    json={
                                        "board_id": board_id,
                                        "board_name": board_name,
                                        "board_type": board_type
                                    })
    
    if register_response.status_code == 200:
        print("✅ Board registered successfully")
    else:
        print(f"❌ Registration failed: {register_response.status_code} - {register_response.text}")
        return
    
    # Step 3: Send power generation data
    print("3. Sending power generation data...")
    gen_response = requests.post(f"{COREAPI_URL}/power_generation",
                               headers=headers,
                               json={
                                   "board_id": board_id,
                                   "power": 45.5,
                                   "timestamp": "2024-01-01T12:00:00Z"
                               })
    
    if gen_response.status_code == 200:
        print("✅ Power generation data sent")
    else:
        print(f"❌ Generation data failed: {gen_response.status_code} - {gen_response.text}")
    
    # Step 4: Send power consumption data
    print("4. Sending power consumption data...")
    cons_response = requests.post(f"{COREAPI_URL}/power_consumption",
                                headers=headers,
                                json={
                                    "board_id": board_id,
                                    "power": 15.2,
                                    "timestamp": "2024-01-01T12:00:00Z"
                                })
    
    if cons_response.status_code == 200:
        print("✅ Power consumption data sent")
    else:
        print(f"❌ Consumption data failed: {cons_response.status_code} - {cons_response.text}")
    
    # Step 5: Poll board status
    print("5. Polling board status...")
    poll_response = requests.get(f"{COREAPI_URL}/poll/{board_id}", headers=headers)
    
    if poll_response.status_code == 200:
        poll_data = poll_response.json()
        print("✅ Board status retrieved:")
        print(f"   Round: {poll_data.get('r', 'N/A')}")
        print(f"   Score: {poll_data.get('s', 'N/A')}")
        print(f"   Generation: {poll_data.get('g', 'N/A')} kW")
        print(f"   Consumption: {poll_data.get('c', 'N/A')} kW")
        print(f"   Round Type: {poll_data.get('rt', 'N/A')}")
        print(f"   Game Active: {poll_data.get('game_active', 'N/A')}")
        print(f"   Expecting Data: {poll_data.get('expecting_data', 'N/A')}")
    else:
        print(f"❌ Poll failed: {poll_response.status_code} - {poll_response.text}")

def test_lecturer_flow():
    """Test the lecturer workflow"""
    
    # Test lecturer credentials
    lecturer_username = "lecturer1"
    lecturer_password = "lecturer123"
    
    print("\n=== Testing Lecturer Flow ===")
    
    # Step 1: Login
    print("1. Logging in as lecturer...")
    login_response = requests.post(f"{COREAPI_URL}/login", json={
        "username": lecturer_username,
        "password": lecturer_password
    })
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code} - {login_response.text}")
        return
    
    login_data = login_response.json()
    token = login_data.get('token')
    if not token:
        print("❌ No token received")
        return
    
    print(f"✅ Login successful, got token")
    headers = {'Authorization': f'Bearer {token}'}
    
    # Step 2: Get game status
    print("2. Getting game status...")
    status_response = requests.get(f"{COREAPI_URL}/game/status", headers=headers)
    
    if status_response.status_code == 200:
        status_data = status_response.json()
        print("✅ Game status retrieved:")
        print(f"   Game Active: {status_data.get('game_active', False)}")
        print(f"   Current Round: {status_data.get('current_round', 0)}")
        print(f"   Total Rounds: {status_data.get('total_rounds', 0)}")
        print(f"   Registered Boards: {status_data.get('boards', 0)}")
        
        if status_data.get('board_details'):
            print(f"   Board Details: {len(status_data['board_details'])} boards")
            for board in status_data['board_details']:
                print(f"     - {board.get('name', 'Unknown')} (ID: {board.get('board_id')})")
    else:
        print(f"❌ Status retrieval failed: {status_response.status_code} - {status_response.text}")
    
    # Step 3: Try to start game (if not active)
    if status_response.status_code == 200:
        status_data = status_response.json()
        if not status_data.get('game_active', False):
            print("3. Starting game...")
            start_response = requests.post(f"{COREAPI_URL}/game/start", headers=headers, json={})
            
            if start_response.status_code == 200:
                print("✅ Game started successfully")
            else:
                print(f"❌ Game start failed: {start_response.status_code} - {start_response.text}")
    
    # Step 4: Get all boards data (lecturer endpoint)
    print("4. Getting all boards data...")
    boards_response = requests.get(f"{COREAPI_URL}/pollforusers", headers=headers)
    
    if boards_response.status_code == 200:
        boards_data = boards_response.json()
        print("✅ All boards data retrieved:")
        print(f"   Total boards: {len(boards_data.get('boards', []))}")
        for board in boards_data.get('boards', []):
            print(f"     - {board.get('board_name', 'Unknown')} ({board.get('board_type', 'Unknown')})")
            print(f"       Generation: {board.get('g', 0)} kW, Consumption: {board.get('c', 0)} kW")
    else:
        print(f"❌ Boards data retrieval failed: {boards_response.status_code} - {boards_response.text}")

def test_game_status_public():
    """Test the public game status endpoint"""
    print("\n=== Testing Public Game Status ===")
    
    response = requests.get(f"{COREAPI_URL}/game/status")
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Public game status retrieved:")
        print(f"   Game Active: {data.get('game_active', False)}")
        print(f"   Current Round: {data.get('current_round', 0)}")
        print(f"   Total Rounds: {data.get('total_rounds', 0)}")
        print(f"   Round Type: {data.get('round_type', 'N/A')}")
        print(f"   Registered Boards: {data.get('boards', 0)}")
    else:
        print(f"❌ Public status failed: {response.status_code} - {response.text}")

if __name__ == "__main__":
    print("Quick Board Test Script")
    print("=" * 50)
    
    # Test public endpoint first
    test_game_status_public()
    
    # Test board functionality
    test_board_flow()
    
    # Test lecturer functionality
    test_lecturer_flow()
    
    print("\n" + "=" * 50)
    print("Test complete!")
