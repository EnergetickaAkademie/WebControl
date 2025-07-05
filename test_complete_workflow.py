#!/usr/bin/env python3
"""
Complete Board Workflow Test
Tests the complete board workflow including expecting_data flag.
"""

import requests
import json
import time

BASE_URL = "http://localhost"
COREAPI_URL = f"{BASE_URL}/coreapi"

def main():
    print("🧪 Complete Board Workflow Test")
    print("=" * 50)
    
    # Step 1: Login as lecturer and start a new game
    print("1. 👨‍🏫 Logging in as lecturer...")
    response = requests.post(f"{COREAPI_URL}/login", json={
        "username": "lecturer1",
        "password": "lecturer123"
    })
    
    if response.status_code != 200:
        print(f"❌ Lecturer login failed: {response.status_code}")
        return
    
    lecturer_token = response.json()['token']
    lecturer_headers = {'Authorization': f'Bearer {lecturer_token}'}
    print("✅ Lecturer login successful")
    
    # Start the game
    print("2. 🚀 Starting new game...")
    response = requests.post(f"{COREAPI_URL}/game/start", headers=lecturer_headers, json={})
    if response.status_code == 200:
        print("✅ Game started successfully")
    else:
        print(f"❌ Game start failed: {response.status_code} - {response.text}")
        return
    
    # Step 2: Login as board
    print("3. 🔌 Logging in as board1...")
    response = requests.post(f"{COREAPI_URL}/login", json={
        "username": "board1",
        "password": "board123"
    })
    
    if response.status_code != 200:
        print(f"❌ Board login failed: {response.status_code}")
        return
    
    board_token = response.json()['token']
    board_headers = {'Authorization': f'Bearer {board_token}'}
    print("✅ Board login successful")
    
    # Step 3: Register board
    print("4. 📋 Registering board...")
    response = requests.post(f"{COREAPI_URL}/register", headers=board_headers, json={
        "board_id": 2001,
        "board_name": "Test Solar Panel",
        "board_type": "solar"
    })
    
    if response.status_code == 200:
        print("✅ Board registered successfully")
    else:
        print(f"❌ Board registration failed: {response.status_code} - {response.text}")
        return
    
    # Step 4: Poll board status before sending data
    print("5. 📊 Polling board status (before sending data)...")
    response = requests.get(f"{COREAPI_URL}/poll/2001", headers=board_headers)
    
    if response.status_code == 200:
        status = response.json()
        print("✅ Board status retrieved:")
        print(f"   Round: {status.get('r', 'N/A')}")
        print(f"   Score: {status.get('s', 'N/A')}")
        print(f"   Generation: {status.get('g', 'N/A')}")
        print(f"   Consumption: {status.get('c', 'N/A')}")
        print(f"   Round Type: {status.get('rt', 'N/A')}")
        print(f"   Game Active: {status.get('game_active', 'N/A')}")
        print(f"   Expecting Data: {status.get('expecting_data', 'N/A')}")
        
        if status.get('expecting_data', False):
            print("🎯 System is expecting data from this board!")
        else:
            print("⏳ System is not expecting data yet")
            
    else:
        print(f"❌ Board status poll failed: {response.status_code} - {response.text}")
        return
    
    # Step 5: Send power data
    print("6. ⚡ Sending power data...")
    
    # Send generation data
    response = requests.post(f"{COREAPI_URL}/power_generation", headers=board_headers, json={
        "board_id": 2001,
        "power": 35.7,
        "timestamp": "2024-01-01T12:00:00Z"
    })
    
    if response.status_code == 200:
        print("✅ Generation data sent")
    else:
        print(f"❌ Generation data failed: {response.status_code}")
    
    # Send consumption data
    response = requests.post(f"{COREAPI_URL}/power_consumption", headers=board_headers, json={
        "board_id": 2001,
        "power": 12.3,
        "timestamp": "2024-01-01T12:00:00Z"
    })
    
    if response.status_code == 200:
        print("✅ Consumption data sent")
    else:
        print(f"❌ Consumption data failed: {response.status_code}")
    
    # Step 6: Poll board status after sending data
    print("7. 📊 Polling board status (after sending data)...")
    response = requests.get(f"{COREAPI_URL}/poll/2001", headers=board_headers)
    
    if response.status_code == 200:
        status = response.json()
        print("✅ Board status retrieved:")
        print(f"   Round: {status.get('r', 'N/A')}")
        print(f"   Score: {status.get('s', 'N/A')}")
        print(f"   Generation: {status.get('g', 'N/A')}")
        print(f"   Consumption: {status.get('c', 'N/A')}")
        print(f"   Round Type: {status.get('rt', 'N/A')}")
        print(f"   Game Active: {status.get('game_active', 'N/A')}")
        print(f"   Expecting Data: {status.get('expecting_data', 'N/A')}")
        
        if status.get('expecting_data', True):  # Default True if field missing
            print("⚠️ System still expecting data (or field missing)")
        else:
            print("✅ System no longer expecting data - data received!")
            
    else:
        print(f"❌ Board status poll failed: {response.status_code}")
    
    # Step 7: Advance to next round and test again
    print("8. ⏭️ Advancing to next round...")
    response = requests.post(f"{COREAPI_URL}/game/next_round", headers=lecturer_headers, json={})
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Advanced to round {result.get('round', 'N/A')}")
    else:
        print(f"❌ Round advance failed: {response.status_code}")
    
    # Step 8: Poll board status after round advance
    print("9. 📊 Polling board status (after round advance)...")
    response = requests.get(f"{COREAPI_URL}/poll/2001", headers=board_headers)
    
    if response.status_code == 200:
        status = response.json()
        print("✅ Board status retrieved:")
        print(f"   Round: {status.get('r', 'N/A')}")
        print(f"   Score: {status.get('s', 'N/A')}")
        print(f"   Generation: {status.get('g', 'N/A')}")
        print(f"   Consumption: {status.get('c', 'N/A')}")
        print(f"   Round Type: {status.get('rt', 'N/A')}")
        print(f"   Game Active: {status.get('game_active', 'N/A')}")
        print(f"   Expecting Data: {status.get('expecting_data', 'N/A')}")
        
        if status.get('expecting_data', False):
            print("🎯 System is expecting data for the new round!")
        else:
            print("⏳ System is not expecting data yet")
            
    else:
        print(f"❌ Board status poll failed: {response.status_code}")
    
    print("\n" + "=" * 50)
    print("🏁 Complete workflow test finished!")

if __name__ == "__main__":
    main()
