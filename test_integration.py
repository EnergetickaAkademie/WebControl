#!/usr/bin/env python3
"""
Integration test - Start a game and test ESP32 boards simultaneously
"""

import requests
import threading
import time
import subprocess
import sys

BASE_URL = "http://localhost"
COREAPI_URL = f"{BASE_URL}/coreapi"

def start_game():
    """Start a game using lecturer credentials"""
    print("🎮 Starting game...")
    
    # Login as lecturer
    login_response = requests.post(f"{COREAPI_URL}/login", json={
        'username': 'lecturer1',
        'password': 'lecturer123'
    })
    
    if login_response.status_code != 200:
        print("❌ Lecturer login failed")
        return False
    
    token = login_response.json()['token']
    headers = {'Authorization': f'Bearer {token}'}
    
    # Start game with demo scenario
    start_response = requests.post(f"{COREAPI_URL}/start_game", 
                                 json={'scenario_id': 'demo'}, 
                                 headers=headers)
    
    if start_response.status_code == 200:
        print("✅ Game started successfully")
        return True
    else:
        print(f"❌ Failed to start game: {start_response.status_code}")
        return False

def test_esp32_boards():
    """Test ESP32 board simulation for 30 seconds"""
    print("🤖 Testing ESP32 boards...")
    
    try:
        # Run ESP32 simulation for 30 seconds
        result = subprocess.run([
            "timeout", "30", "python", "esp32_board_simulation.py"
        ], cwd="/home/jirka/programovani/ea/WebControl", 
           capture_output=True, text=True)
        
        print("ESP32 Output:")
        print(result.stdout)
        if result.stderr:
            print("ESP32 Errors:")
            print(result.stderr)
        
        return result.returncode in [0, 124]  # 124 is timeout exit code
    except Exception as e:
        print(f"❌ ESP32 test error: {e}")
        return False

def main():
    print("🧪 Integration Test - Lecturer + ESP32 Boards")
    print("=" * 50)
    
    # Test API connectivity
    try:
        response = requests.get(f"{COREAPI_URL}/health", timeout=5)
        if response.status_code == 200:
            print("✅ CoreAPI is accessible")
        else:
            print(f"⚠️ CoreAPI returned status {response.status_code}")
    except Exception as e:
        print(f"❌ Cannot connect to CoreAPI: {e}")
        return
    
    # Start game
    if not start_game():
        return
    
    # Wait a moment for game to be ready
    time.sleep(2)
    
    # Test ESP32 boards
    if test_esp32_boards():
        print("✅ ESP32 boards tested successfully")
    else:
        print("❌ ESP32 board test failed")
    
    print("\n✅ Integration test completed!")

if __name__ == "__main__":
    main()
