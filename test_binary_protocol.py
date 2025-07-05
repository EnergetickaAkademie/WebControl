#!/usr/bin/env python3
"""
Test script for binary protocol endpoints
Tests the new ESP32-optimized binary endpoints.
"""

import requests
import time
import sys
import os

# Add the CoreAPI src directory to the path to import binary_protocol
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'CoreAPI', 'src'))

try:
    from binary_protocol import BoardBinaryProtocol, BinaryProtocolError
except ImportError as e:
    print(f"❌ Could not import binary protocol: {e}")
    print("Make sure CoreAPI/src/binary_protocol.py exists")
    sys.exit(1)

BASE_URL = "http://localhost"
COREAPI_URL = f"{BASE_URL}/coreapi"

def test_binary_protocol():
    print("🧪 Binary Protocol Test")
    print("=" * 50)
    
    # Step 1: Login as lecturer and start a new game
    print("1. 👨‍🏫 Setting up game...")
    response = requests.post(f"{COREAPI_URL}/login", json={
        "username": "lecturer1",
        "password": "lecturer123"
    })
    
    if response.status_code != 200:
        print(f"❌ Lecturer login failed: {response.status_code}")
        return False
    
    lecturer_token = response.json()['token']
    lecturer_headers = {'Authorization': f'Bearer {lecturer_token}'}
    
    # Start the game
    response = requests.post(f"{COREAPI_URL}/game/start", headers=lecturer_headers, json={})
    if response.status_code == 200:
        print("✅ Game started successfully")
    else:
        print(f"❌ Game start failed: {response.status_code}")
        return False
    
    # Step 2: Login as board
    print("2. 🔌 Logging in as board...")
    response = requests.post(f"{COREAPI_URL}/login", json={
        "username": "board1",
        "password": "board123"
    })
    
    if response.status_code != 200:
        print(f"❌ Board login failed: {response.status_code}")
        return False
    
    board_token = response.json()['token']
    board_headers = {'Authorization': f'Bearer {board_token}'}
    print("✅ Board login successful")
    
    # Step 3: Test binary registration
    print("3. 📋 Testing binary registration...")
    try:
        board_id = 3001
        board_name = "ESP32 Solar Panel"
        board_type = "solar"
        
        registration_data = BoardBinaryProtocol.pack_registration_request(board_id, board_name, board_type)
        print(f"   📦 Registration packet size: {len(registration_data)} bytes")
        
        response = requests.post(f"{COREAPI_URL}/register_binary", 
                               data=registration_data,
                               headers={**board_headers, 'Content-Type': 'application/octet-stream'})
        
        if response.status_code == 200:
            success, message = BoardBinaryProtocol.unpack_registration_response(response.content)
            if success:
                print(f"✅ Binary registration successful: {message}")
            else:
                print(f"❌ Registration failed: {message}")
                return False
        else:
            print(f"❌ Registration request failed: {response.status_code}")
            return False
            
    except BinaryProtocolError as e:
        print(f"❌ Protocol error: {e}")
        return False
    
    # Step 4: Test binary poll
    print("4. 📊 Testing binary poll...")
    try:
        response = requests.get(f"{COREAPI_URL}/poll_binary/{board_id}", headers=board_headers)
        
        if response.status_code == 200:
            print(f"   📦 Poll response size: {len(response.content)} bytes")
            status = BoardBinaryProtocol.unpack_poll_response(response.content)
            print("✅ Binary poll successful:")
            print(f"   Round: {status['round']}")
            print(f"   Score: {status['score']}")
            print(f"   Game Active: {status['game_active']}")
            print(f"   Expecting Data: {status['expecting_data']}")
            print(f"   Round Type: {status['round_type']}")
            print(f"   Timestamp: {status['timestamp']}")
        else:
            print(f"❌ Poll request failed: {response.status_code}")
            return False
            
    except BinaryProtocolError as e:
        print(f"❌ Protocol error: {e}")
        return False
    
    # Step 5: Test binary power data submission
    print("5. ⚡ Testing binary power data submission...")
    try:
        generation = 45.75  # kW
        consumption = 12.34  # kW
        timestamp = int(time.time())
        
        power_data = BoardBinaryProtocol.pack_power_data(board_id, generation, consumption, timestamp)
        print(f"   📦 Power data packet size: {len(power_data)} bytes")
        
        response = requests.post(f"{COREAPI_URL}/power_data_binary",
                               headers={**board_headers, 'Content-Type': 'application/octet-stream'},
                               data=power_data)
        
        if response.status_code == 200:
            response_text = response.content.decode('utf-8')
            print(f"✅ Power data submitted successfully: {response_text}")
        else:
            error_text = response.content.decode('utf-8', errors='ignore')
            print(f"❌ Power data submission failed: {response.status_code} - {error_text}")
            return False
            
    except BinaryProtocolError as e:
        print(f"❌ Protocol error: {e}")
        return False
    
    # Step 6: Verify data was received by polling again
    print("6. 🔍 Verifying data was received...")
    try:
        response = requests.get(f"{COREAPI_URL}/poll_binary/{board_id}", headers=board_headers)
        
        if response.status_code == 200:
            status = BoardBinaryProtocol.unpack_poll_response(response.content)
            print("✅ Data verification successful:")
            print(f"   Generation: {status['generation']} kW")
            print(f"   Consumption: {status['consumption']} kW")
            print(f"   Score: {status['score']}")
            print(f"   Expecting Data: {status['expecting_data']}")
            
            # Verify the values match what we sent
            if abs(status['generation'] - generation) < 0.01 and abs(status['consumption'] - consumption) < 0.01:
                print("✅ Data integrity verified!")
            else:
                print(f"❌ Data mismatch! Sent gen={generation}, cons={consumption}")
                print(f"                  Got gen={status['generation']}, cons={status['consumption']}")
                return False
        else:
            print(f"❌ Verification poll failed: {response.status_code}")
            return False
            
    except BinaryProtocolError as e:
        print(f"❌ Protocol error: {e}")
        return False
    
    # Step 7: Test protocol overhead comparison
    print("7. 📈 Protocol overhead comparison...")
    
    # Calculate JSON equivalent size
    json_registration = {
        "board_id": board_id,
        "board_name": board_name,
        "board_type": board_type
    }
    import json
    json_reg_size = len(json.dumps(json_registration).encode('utf-8'))
    
    json_power = {
        "board_id": board_id,
        "power": generation,
        "timestamp": timestamp
    }
    json_power_size = len(json.dumps(json_power).encode('utf-8'))
    
    binary_reg_size = 53  # Fixed size from protocol
    binary_power_size = 22  # Fixed size from protocol
    binary_poll_size = 24  # Fixed size from protocol
    
    print(f"   Registration: JSON={json_reg_size}B vs Binary={binary_reg_size}B (saved {json_reg_size-binary_reg_size}B)")
    print(f"   Power data:   JSON={json_power_size}B vs Binary={binary_power_size}B (saved {json_power_size-binary_power_size}B)")
    print(f"   Poll response: ~JSON=150B vs Binary={binary_poll_size}B (saved ~126B)")
    
    savings_percent = ((json_reg_size + json_power_size + 150) - (binary_reg_size + binary_power_size + binary_poll_size)) / (json_reg_size + json_power_size + 150) * 100
    print(f"   💾 Total bandwidth savings: ~{savings_percent:.1f}%")
    
    print("\n" + "=" * 50)
    print("🏁 Binary protocol test completed successfully!")
    return True

def test_protocol_edge_cases():
    print("\n🧪 Protocol Edge Cases Test")
    print("=" * 50)
    
    # Test string length validation
    print("1. Testing string length validation...")
    try:
        # This should work
        BoardBinaryProtocol.pack_registration_request(1001, "Normal Name", "solar")
        print("✅ Normal strings work")
        
        # This should work (truncated)
        long_name = "A" * 100
        data = BoardBinaryProtocol.pack_registration_request(1002, long_name, "wind")
        board_id, name, board_type = BoardBinaryProtocol.unpack_registration_request(data)
        if len(name) <= 31:  # Max 31 chars + null terminator
            print("✅ Long strings are properly truncated")
        else:
            print("❌ String truncation failed")
            return False
            
    except Exception as e:
        print(f"❌ String validation failed: {e}")
        return False
    
    # Test power value overflow protection
    print("2. Testing power value overflow protection...")
    try:
        # Large but valid values
        BoardBinaryProtocol.pack_power_data(1003, 999999.99, 999999.99)
        print("✅ Large values work")
        
        # This should raise an error
        try:
            BoardBinaryProtocol.pack_power_data(1004, 99999999.0, 0)
            print("❌ Overflow protection failed")
            return False
        except BinaryProtocolError:
            print("✅ Overflow protection works")
            
    except Exception as e:
        print(f"❌ Power validation failed: {e}")
        return False
    
    # Test timestamp validation
    print("3. Testing timestamp validation...")
    try:
        # Valid timestamp
        BoardBinaryProtocol.pack_power_data(1005, 10.0, 5.0, int(time.time()))
        print("✅ Valid timestamps work")
        
        # Invalid timestamp
        try:
            BoardBinaryProtocol.pack_power_data(1006, 10.0, 5.0, -1)
            print("❌ Timestamp validation failed")
            return False
        except BinaryProtocolError:
            print("✅ Timestamp validation works")
            
    except Exception as e:
        print(f"❌ Timestamp validation failed: {e}")
        return False
    
    print("✅ All edge case tests passed!")
    return True

def main():
    if not test_binary_protocol():
        print("❌ Binary protocol test failed!")
        return 1
    
    if not test_protocol_edge_cases():
        print("❌ Edge case tests failed!")
        return 1
    
    print("\n🎉 All tests passed! Binary protocol is ready for ESP32 deployment.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
