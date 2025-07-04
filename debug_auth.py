#!/usr/bin/env python3
"""
Debug script to test authentication and inspect cookies
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost"
API_URL = f"{BASE_URL}/api"
COREAPI_URL = f"{BASE_URL}/coreapi"

def debug_login():
    """Debug login and inspect cookies"""
    session = requests.Session()
    
    print("=== Login Test ===")
    response = session.post(f"{API_URL}/signin", json={
        "formFields": [
            {"id": "email", "value": "john.smith@university.edu"},
            {"id": "password", "value": "SecurePassword123!"}
        ]
    })
    
    print(f"Login Status: {response.status_code}")
    print(f"Login Response: {response.text}")
    print("Login Headers:")
    for name, value in response.headers.items():
        print(f"  {name}: {value}")
    
    print("\nLogin Cookies:")
    for name, value in session.cookies.items():
        print(f"  {name}: {value}")
    
    print("\n=== Testing CoreAPI with Cookies ===")
    # Test a simple endpoint
    response = session.get(f"{COREAPI_URL}/health")
    print(f"Health Status: {response.status_code}")
    print(f"Health Response: {response.text}")
    
    # Test an authenticated endpoint
    response = session.get(f"{COREAPI_URL}/pollforusers")
    print(f"PollForUsers Status: {response.status_code}")
    print(f"PollForUsers Response: {response.text}")
    
    print("\nRequest Headers for CoreAPI:")
    for name, value in response.request.headers.items():
        print(f"  {name}: {value}")
    
    print("\nCookies being sent to CoreAPI:")
    for name, value in session.cookies.items():
        print(f"  {name}: {value}")

if __name__ == "__main__":
    debug_login()
