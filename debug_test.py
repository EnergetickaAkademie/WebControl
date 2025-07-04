#!/usr/bin/env python3
"""
Simple debug test to check authentication flow
"""

import requests

BASE_URL = "http://localhost"
API_URL = f"{BASE_URL}/api"
COREAPI_URL = f"{BASE_URL}/coreapi"

def test_debug():
    # First login
    session = requests.Session()
    
    print("1. Testing lecturer login...")
    response = session.post(f"{API_URL}/signin", json={
        "formFields": [
            {"id": "email", "value": "john.smith@university.edu"},
            {"id": "password", "value": "SecurePassword123!"}
        ]
    })
    
    print(f"Login status: {response.status_code}")
    print(f"Login response headers: {dict(response.headers)}")
    print(f"Login response cookies: {dict(response.cookies)}")
    print(f"Login response content: {response.text}")
    
    if response.status_code == 200:
        print("✓ Login successful")
        
        # Check for authentication tokens in headers
        access_token = response.headers.get('st-access-token')
        refresh_token = response.headers.get('st-refresh-token')
        front_token = response.headers.get('front-token')
        
        print(f"Access Token: {access_token}")
        print(f"Refresh Token: {refresh_token}")
        print(f"Front Token: {front_token}")
        
        # Check session cookies
        print(f"Session cookies: {dict(session.cookies)}")
        
        # Test debug endpoint with manual headers if tokens are found
        print("\n2. Testing debug endpoint...")
        headers = {}
        if access_token:
            headers['st-access-token'] = access_token
        
        debug_response = session.get(f"{COREAPI_URL}/debug/auth", headers=headers)
        print(f"Debug status: {debug_response.status_code}")
        if debug_response.status_code == 200:
            debug_data = debug_response.json()
            print("Debug data:")
            for key, value in debug_data.items():
                print(f"  {key}: {value}")
        else:
            print(f"Debug failed: {debug_response.text}")
    else:
        print(f"✗ Login failed: {response.text}")

if __name__ == "__main__":
    test_debug()
