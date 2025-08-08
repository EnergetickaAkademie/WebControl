#!/usr/bin/env python3
"""
Full Workflow Test - Frontend + Backend + ESP32 Integration
Tests the complete lecturer workflow with new frontend
"""

import requests
import threading
import time
import subprocess
import sys

BASE_URL = "http://localhost"
COREAPI_URL = f"{BASE_URL}/coreapi"

def test_backend_workflow():
    """Test the backend workflow step by step"""
    print("🧪 Testing Backend Workflow")
    print("-" * 40)
    
    # Login as lecturer
    print("1. 🔐 Testing lecturer login...")
    login_response = requests.post(f"{COREAPI_URL}/login", json={
        'username': 'lecturer1',
        'password': 'lecturer123'
    })
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code}")
        return False
    
    token = login_response.json()['token']
    headers = {'Authorization': f'Bearer {token}'}
    print("✅ Lecturer login successful")
    
    # Get scenarios
    print("2. 📋 Getting available scenarios...")
    scenarios_response = requests.get(f"{COREAPI_URL}/scenarios", headers=headers)
    if scenarios_response.status_code == 200:
        scenarios = scenarios_response.json()['scenarios']
        print(f"✅ Found scenarios: {scenarios}")
    else:
        print(f"❌ Failed to get scenarios: {scenarios_response.status_code}")
        return False
    
    # Start game (without automatically advancing)
    print("3. 🎮 Starting game...")
    start_response = requests.post(f"{COREAPI_URL}/start_game", 
                                 json={'scenario_id': 'demo'}, 
                                 headers=headers)
    if start_response.status_code == 200:
        print("✅ Game started successfully")
        print(f"   Response: {start_response.json()}")
    else:
        print(f"❌ Failed to start game: {start_response.status_code}")
        return False
    
    # Get PDF
    print("4. 📄 Getting PDF...")
    pdf_response = requests.get(f"{COREAPI_URL}/get_pdf", headers=headers)
    if pdf_response.status_code == 200:
        pdf_url = pdf_response.json()['url']
        print(f"✅ PDF URL: {pdf_url}")
    else:
        print(f"❌ Failed to get PDF: {pdf_response.status_code}")
        return False
    
    # Test PDF download
    print("5. 📥 Testing PDF download...")
    pdf_download_response = requests.get(f"{COREAPI_URL}/download_pdf/presentation.pdf", headers=headers)
    if pdf_download_response.status_code == 200:
        print(f"✅ PDF download successful ({len(pdf_download_response.content)} bytes)")
    else:
        print(f"❌ PDF download failed: {pdf_download_response.status_code}")
    
    # Advance to first round
    print("6. ⏭️ Advancing to first round...")
    next_response = requests.post(f"{COREAPI_URL}/next_round", json={}, headers=headers)
    if next_response.status_code == 200:
        round_data = next_response.json()
        print(f"✅ Advanced to round {round_data.get('round')}")
        print(f"   Round type: {round_data.get('round_type')}")
        if round_data.get('slide_range'):
            print(f"   Slide range: {round_data['slide_range']}")
        if round_data.get('game_data'):
            print(f"   Game data available: {list(round_data['game_data'].keys())}")
    else:
        print(f"❌ Failed to advance round: {next_response.status_code}")
        return False
    
    # Test pollforusers
    print("7. 📊 Testing board polling...")
    poll_response = requests.get(f"{COREAPI_URL}/pollforusers", headers=headers)
    if poll_response.status_code == 200:
        poll_data = poll_response.json()
        print(f"✅ Board polling successful")
        print(f"   Connected boards: {len(poll_data.get('boards', []))}")
        print(f"   Game status: {poll_data.get('game_status', {})}")
    else:
        print(f"❌ Board polling failed: {poll_response.status_code}")
        return False
    
    print("\n✅ Backend workflow test completed successfully!")
    return True

def test_esp32_boards():
    """Test ESP32 board simulation"""
    print("\n🤖 Testing ESP32 Boards")
    print("-" * 40)
    
    try:
        # Run ESP32 simulation for 20 seconds
        result = subprocess.run([
            "timeout", "20", "python", "esp32_board_simulation.py"
        ], cwd="/home/jirka/programovani/ea/WebControl", 
           capture_output=True, text=True)
        
        print("ESP32 Simulation Output:")
        print(result.stdout)
        if result.stderr:
            print("ESP32 Errors:")
            print(result.stderr)
        
        # Check if boards registered successfully
        if "Board registered successfully" in result.stdout:
            print("✅ ESP32 boards registered successfully")
        else:
            print("❌ ESP32 board registration failed")
            
        if "Received game coefficients" in result.stdout:
            print("✅ ESP32 boards received game data")
        else:
            print("❌ ESP32 boards failed to receive game data")
        
        return result.returncode in [0, 124]  # 124 is timeout exit code
    except Exception as e:
        print(f"❌ ESP32 test error: {e}")
        return False

def main():
    print("🧪 Complete Workflow Test - Frontend + Backend + ESP32")
    print("=" * 60)
    
    # Test API connectivity
    print("🔍 Checking API connectivity...")
    try:
        response = requests.get(f"{COREAPI_URL}/health", timeout=5)
        if response.status_code == 200:
            print("✅ CoreAPI is accessible")
        else:
            print(f"⚠️ CoreAPI returned status {response.status_code}")
            return
    except Exception as e:
        print(f"❌ Cannot connect to CoreAPI: {e}")
        print("Make sure Docker services are running")
        return
    
    # Test backend workflow
    if not test_backend_workflow():
        print("❌ Backend workflow test failed")
        return
    
    # Wait a moment
    print("\n⏳ Waiting 3 seconds before testing ESP32...")
    time.sleep(3)
    
    # Test ESP32 boards
    if test_esp32_boards():
        print("✅ ESP32 board test completed")
    else:
        print("❌ ESP32 board test failed")
    
    print("\n" + "=" * 60)
    print("✅ Complete workflow test finished!")
    print("\n📱 You can now test the frontend at: http://localhost")
    print("   Login: lecturer1 / lecturer123")

if __name__ == "__main__":
    main()
