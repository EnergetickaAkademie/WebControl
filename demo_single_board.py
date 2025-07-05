#!/usr/bin/env python3
"""
Single Board Demo
Simple demonstration of realistic board behavior with one board.
"""

import requests
import json
import time
import random
from datetime import datetime

BASE_URL = "http://localhost"
COREAPI_URL = f"{BASE_URL}/coreapi"

def demo_board_behavior():
    """Demonstrate realistic board behavior"""
    
    # Board configuration
    board_id = 9999
    username = "board1"
    password = "board123"
    board_name = "Demo Solar Farm"
    board_type = "solar"
    
    print("=" * 50)
    print(f"🔌 Demo Board: {board_name}")
    print("=" * 50)
    
    # Step 1: Login
    print("1. 🔐 Logging in...")
    login_response = requests.post(f"{COREAPI_URL}/login", json={
        "username": username,
        "password": password
    })
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code}")
        return
    
    token = login_response.json().get('token')
    headers = {'Authorization': f'Bearer {token}'}
    print("✅ Successfully logged in")
    
    # Step 2: Register
    print("2. 📋 Registering board...")
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
        print(f"❌ Registration failed: {register_response.status_code}")
        if register_response.status_code == 400:
            print("   (Board may already be registered)")
    
    # Step 3: Wait for game to start and respond to rounds
    print("3. ⏳ Monitoring game state...")
    last_round = 0
    
    for i in range(60):  # Monitor for 1 minute
        try:
            # Poll board status
            poll_response = requests.get(f"{COREAPI_URL}/poll/{board_id}", headers=headers)
            
            if poll_response.status_code != 200:
                print(f"❌ Poll failed: {poll_response.status_code}")
                time.sleep(3)
                continue
            
            status = poll_response.json()
            current_round = status.get('r', 0)
            game_active = status.get('game_active', False)
            expecting_data = status.get('expecting_data', False)
            round_type = status.get('rt', 'day')
            
            # Display current status
            print(f"📊 Round: {current_round}, Active: {game_active}, Type: {round_type}, Expecting: {expecting_data}")
            
            if not game_active:
                if last_round > 0:
                    print("🏁 Game finished!")
                    break
                else:
                    print("   Waiting for game to start...")
            
            # Check for new round
            if current_round > last_round:
                print(f"🔄 New round detected: {current_round} ({round_type})")
                last_round = current_round
            
            # Submit data if expected
            if expecting_data and game_active:
                # Generate realistic solar data
                if round_type == "day":
                    generation = random.uniform(45.0, 55.0)  # Solar peak
                    consumption = random.uniform(20.0, 30.0)  # Daytime consumption
                else:
                    generation = 0.0  # No solar at night
                    consumption = random.uniform(15.0, 25.0)  # Night consumption
                
                timestamp = datetime.now().isoformat() + "Z"
                
                # Submit generation
                gen_response = requests.post(f"{COREAPI_URL}/power_generation",
                                           headers=headers,
                                           json={
                                               "board_id": board_id,
                                               "power": generation,
                                               "timestamp": timestamp
                                           })
                
                # Submit consumption
                cons_response = requests.post(f"{COREAPI_URL}/power_consumption",
                                            headers=headers,
                                            json={
                                                "board_id": board_id,
                                                "power": consumption,
                                                "timestamp": timestamp
                                            })
                
                if gen_response.status_code == 200 and cons_response.status_code == 200:
                    net_power = generation - consumption
                    print(f"⚡ Data submitted - Gen: {generation:.1f}kW, Cons: {consumption:.1f}kW, Net: {net_power:.1f}kW")
                else:
                    print(f"❌ Data submission failed")
            
            time.sleep(3)
            
        except KeyboardInterrupt:
            print("\n🛑 Demo interrupted by user")
            break
        except Exception as e:
            print(f"❌ Error: {e}")
            time.sleep(3)
    
    print("🔚 Demo completed")

if __name__ == "__main__":
    print("Single Board Demo")
    print("Start the game using the lecturer dashboard, then watch this board respond!")
    print("Press Ctrl+C to stop\n")
    
    demo_board_behavior()
