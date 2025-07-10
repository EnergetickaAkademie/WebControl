#!/usr/bin/env python3
"""
Building Consumption Table Management Test
Tests the new building table functionality end-to-end.
"""

import requests
import json
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

def test_building_table_management():
    """Test the complete building table management workflow"""
    print("🏢 Testing Building Table Management")
    print("=" * 50)
    
    # Step 1: Login as lecturer
    print("1. 🔐 Logging in as lecturer...")
    lecturer_response = requests.post(f"{COREAPI_URL}/login", json={
        "username": "lecturer1",
        "password": "lecturer123"
    })
    
    if lecturer_response.status_code != 200:
        print(f"❌ Lecturer login failed: {lecturer_response.status_code}")
        return False
    
    lecturer_token = lecturer_response.json()['token']
    lecturer_headers = {'Authorization': f'Bearer {lecturer_token}'}
    print("✅ Lecturer login successful")
    
    # Step 2: Get current building table
    print("2. 📊 Getting current building table...")
    table_response = requests.get(f"{COREAPI_URL}/building_table", headers=lecturer_headers)
    
    if table_response.status_code != 200:
        print(f"❌ Failed to get building table: {table_response.status_code}")
        return False
    
    current_table = table_response.json()
    print(f"✅ Current building table (version {current_table['version']}):")
    for building_type, consumption in sorted(current_table['table'].items()):
        print(f"   Building {building_type}: {consumption}W")
    
    # Step 3: Update building table
    print("3. ✏️ Updating building table...")
    updated_table = current_table['table'].copy()
    updated_table['1'] = 30.5  # Change residential from 25.0 to 30.5W
    updated_table['9'] = 45.0  # Add new building type
    
    update_response = requests.post(f"{COREAPI_URL}/building_table", 
                                   headers=lecturer_headers,
                                   json={'table': updated_table})
    
    if update_response.status_code != 200:
        print(f"❌ Failed to update building table: {update_response.status_code}")
        return False
    
    new_version = update_response.json()['version']
    print(f"✅ Building table updated successfully (new version: {new_version})")
    
    # Step 4: Verify the update
    print("4. 🔍 Verifying building table update...")
    verify_response = requests.get(f"{COREAPI_URL}/building_table", headers=lecturer_headers)
    
    if verify_response.status_code != 200:
        print("❌ Failed to verify building table update")
        return False
    
    verified_table = verify_response.json()
    print(f"✅ Verified building table (version {verified_table['version']}):")
    for building_type, consumption in sorted(verified_table['table'].items()):
        print(f"   Building {building_type}: {consumption}W")
    
    # Step 5: Test binary download
    print("5. 📦 Testing binary building table download...")
    
    # Login as board
    board_response = requests.post(f"{COREAPI_URL}/login", json={
        "username": "board1",
        "password": "board123"
    })
    
    if board_response.status_code != 200:
        print(f"❌ Board login failed: {board_response.status_code}")
        return False
    
    board_token = board_response.json()['token']
    board_headers = {'Authorization': f'Bearer {board_token}'}
    
    # Download binary table
    binary_response = requests.get(f"{COREAPI_URL}/building_table_binary", headers=board_headers)
    
    if binary_response.status_code != 200:
        print(f"❌ Binary table download failed: {binary_response.status_code}")
        return False
    
    # Parse binary table
    try:
        binary_table, binary_version = BoardBinaryProtocol.unpack_building_table(binary_response.content)
        print(f"✅ Binary table downloaded successfully (version {binary_version}):")
        for building_type, consumption_centiwatts in sorted(binary_table.items()):
            consumption_watts = consumption_centiwatts / 100.0
            print(f"   Building {building_type}: {consumption_watts}W")
        
        # Verify versions match
        if binary_version == verified_table['version']:
            print("✅ Binary and REST table versions match")
        else:
            print(f"❌ Version mismatch: binary={binary_version}, REST={verified_table['version']}")
            return False
            
    except BinaryProtocolError as e:
        print(f"❌ Failed to parse binary table: {e}")
        return False
    
    # Step 6: Test poll response with table version
    print("6. 📡 Testing poll response with building table version...")
    
    # Register a test board first
    register_response = requests.post(f"{COREAPI_URL}/register", 
                                     headers=board_headers,
                                     json={
                                         "board_id": 9999,
                                         "board_name": "Test Building Board",
                                         "board_type": "generic"
                                     })
    
    if register_response.status_code == 200:
        print("✅ Test board registered")
    elif register_response.status_code == 400:
        print("✅ Test board already registered")
    else:
        print(f"❌ Board registration failed: {register_response.status_code}")
        return False
    
    # Poll board status
    poll_response = requests.get(f"{COREAPI_URL}/poll_binary/9999", headers=board_headers)
    
    if poll_response.status_code != 200:
        print(f"❌ Poll failed: {poll_response.status_code}")
        return False
    
    try:
        poll_data = BoardBinaryProtocol.unpack_poll_response(poll_response.content)
        poll_table_version = poll_data['building_table_version']
        print(f"✅ Poll successful, building table version: {poll_table_version}")
        
        if poll_table_version == verified_table['version']:
            print("✅ Poll table version matches current table")
        else:
            print(f"❌ Poll version mismatch: {poll_table_version} vs {verified_table['version']}")
            return False
            
    except BinaryProtocolError as e:
        print(f"❌ Failed to parse poll response: {e}")
        return False
    
    print("\n" + "=" * 50)
    print("🏁 Building table management test completed successfully!")
    return True

def main():
    """Main test function"""
    print("Building Table Management Test")
    print("Make sure the WebControl system is running on localhost")
    print()
    
    try:
        success = test_building_table_management()
        if success:
            print("\n✅ All tests passed!")
            return 0
        else:
            print("\n❌ Some tests failed!")
            return 1
    except KeyboardInterrupt:
        print("\n🛑 Test interrupted by user")
        return 1
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
