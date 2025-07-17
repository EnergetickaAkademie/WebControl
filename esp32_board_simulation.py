#!/usr/bin/env python3
"""
ESP32 Board Simulation using Binary Protocol
Simulates ESP32 boards with minimal memory usage using binary endpoints.
"""

import requests
import time
import random
import sys
import os
import threading
import struct
from typing import Optional

# Add the CoreAPI src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'CoreAPI', 'src'))

try:
    from binary_protocol import BoardBinaryProtocol, BinaryProtocolError
except ImportError as e:
    print(f"❌ Could not import binary protocol: {e}")
    sys.exit(1)

BASE_URL = "http://localhost"
COREAPI_URL = f"{BASE_URL}/coreapi"

class ESP32BoardSimulator:
    """Simulates an ESP32 board with minimal memory usage"""
    
    def __init__(self, username: str, password: str, board_id: int, 
                 board_name: str, board_type: str):
        self.username = username
        self.password = password
        self.board_id = board_id
        self.board_name = board_name
        self.board_type = board_type
        self.token: Optional[str] = None
        self.headers: dict = {}
        self.running = False
        self.current_round = 0
        self.last_generation = 0.0
        self.last_consumption = 0.0
        
    def login(self) -> bool:
        """Login to get authentication token"""
        try:
            response = requests.post(f"{COREAPI_URL}/login", json={
                "username": self.username,
                "password": self.password
            })
            
            if response.status_code == 200:
                data = response.json()
                self.token = data['token']
                self.headers = {'Authorization': f'Bearer {self.token}'}
                print(f"[{self.board_name}] ✅ Login successful")
                return True
            else:
                print(f"[{self.board_name}] ❌ Login failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"[{self.board_name}] ❌ Login error: {e}")
            return False
    
    def register_binary(self) -> bool:
        """Register board using binary protocol"""
        try:
            # Pack registration data
            registration_data = BoardBinaryProtocol.pack_registration_request(
                self.board_id, self.board_name, self.board_type
            )
            
            # Send binary registration
            response = requests.post(f"{COREAPI_URL}/register_binary",
                                   data=registration_data,
                                   headers={**self.headers, 'Content-Type': 'application/octet-stream'})
            
            if response.status_code == 200:
                success, message = BoardBinaryProtocol.unpack_registration_response(response.content)
                if success:
                    print(f"[{self.board_name}] ✅ Binary registration successful: {message}")
                    return True
                else:
                    print(f"[{self.board_name}] ❌ Registration failed: {message}")
                    return False
            else:
                print(f"[{self.board_name}] ❌ Registration request failed: {response.status_code}")
                return False
                
        except BinaryProtocolError as e:
            print(f"[{self.board_name}] ❌ Binary protocol error: {e}")
            return False
        except Exception as e:
            print(f"[{self.board_name}] ❌ Registration error: {e}")
            return False
    
    def poll_binary(self) -> Optional[dict]:
        """Poll board status using binary protocol"""
        try:
            response = requests.get(f"{COREAPI_URL}/poll_binary/{self.board_id}", 
                                  headers=self.headers)
            
            if response.status_code == 200:
                return BoardBinaryProtocol.unpack_poll_response(response.content)
            elif response.status_code == 404:
                print(f"[{self.board_name}] ❌ Board not found")
                return None
            else:
                print(f"[{self.board_name}] ❌ Poll failed: {response.status_code}")
                return None
                
        except BinaryProtocolError as e:
            print(f"[{self.board_name}] ❌ Poll protocol error: {e}")
            return None
        except Exception as e:
            print(f"[{self.board_name}] ❌ Poll error: {e}")
            return None
    
    def send_power_data_binary(self, generation: Optional[float], 
                             consumption: Optional[float]) -> bool:
        """Send power data using binary protocol"""
        try:
            # Pack power data with current Unix timestamp
            power_data = BoardBinaryProtocol.pack_power_data(
                self.board_id, generation, consumption, int(time.time())
            )
            
            # Send binary power data
            response = requests.post(f"{COREAPI_URL}/power_data_binary",
                                   data=power_data,
                                   headers={**self.headers, 'Content-Type': 'application/octet-stream'})
            
            if response.status_code == 200:
                return True
            else:
                error_text = response.content.decode('utf-8', errors='ignore')
                print(f"[{self.board_name}] ❌ Power data failed: {response.status_code} - {error_text}")
                return False
                
        except BinaryProtocolError as e:
            print(f"[{self.board_name}] ❌ Power data protocol error: {e}")
            return False
        except Exception as e:
            print(f"[{self.board_name}] ❌ Power data error: {e}")
            return False
    
    def generate_realistic_data(self, round_type: str) -> tuple[float, float]:
        """Generate realistic power data based on board type and round"""
        if self.board_type == "solar":
            if round_type == "day":
                # Solar panels generate more during day
                base_generation = random.uniform(25, 50)
                variation = random.uniform(-5, 5)
                generation = max(0, base_generation + variation)
            else:
                # Minimal generation at night
                generation = random.uniform(0, 2)
            
            # Solar panels consume minimal power
            consumption = random.uniform(1, 3)
            
        elif self.board_type == "wind":
            # Wind is more random but less dependent on day/night
            base_generation = random.uniform(10, 30)
            variation = random.uniform(-8, 8)
            generation = max(0, base_generation + variation)
            consumption = random.uniform(2, 5)
            
        elif self.board_type == "battery":
            # Battery storage - more consumption during day (charging)
            if round_type == "day":
                generation = random.uniform(0, 5)  # Minimal generation
                consumption = random.uniform(20, 40)  # Higher consumption (charging)
            else:
                generation = random.uniform(15, 35)  # Discharging at night
                consumption = random.uniform(5, 15)  # Lower consumption
        else:
            # Generic board
            generation = random.uniform(5, 20)
            consumption = random.uniform(5, 15)
        
        return generation, consumption
    
    def wait_for_game_start(self) -> bool:
        """Wait for the game to start using binary polling"""
        print(f"[{self.board_name}] 🕐 Waiting for game to start...")
        
        while True:
            status = self.poll_binary()
            if status is None:
                time.sleep(1)
                continue
            
            if status['game_active']:
                print(f"[{self.board_name}] 🚀 Game started! Round {status['round']}")
                self.current_round = status['round']
                
                # Send initial data if expected
                if status['expecting_data']:
                    generation, consumption = self.generate_realistic_data(status['round_type'])
                    if self.send_power_data_binary(generation, consumption):
                        self.last_generation = generation
                        self.last_consumption = consumption
                        print(f"[{self.board_name}] 📊 Initial data sent - Gen: {generation:.2f}kW, Cons: {consumption:.2f}kW")
                
                return True
            
            time.sleep(1)  # Poll every second
    
    def main_loop(self):
        """Main ESP32 simulation loop with minimal memory usage"""
        print(f"[{self.board_name}] 🎮 Entering main game loop...")
        
        while self.running:
            status = self.poll_binary()
            if status is None:
                time.sleep(2)
                continue
            
            # Check if game is still active
            if not status['game_active']:
                print(f"[{self.board_name}] 🏁 Game ended")
                break
            
            # Check for new round
            if status['round'] != self.current_round:
                print(f"[{self.board_name}] ⏭️ New round {status['round']} ({status['round_type']})")
                self.current_round = status['round']
            
            # Send data only if expected
            if status['expecting_data']:
                generation, consumption = self.generate_realistic_data(status['round_type'])
                
                if self.send_power_data_binary(generation, consumption):
                    self.last_generation = generation
                    self.last_consumption = consumption
                    print(f"[{self.board_name}] 📊 Round {status['round']} data - Gen: {generation:.2f}kW, Cons: {consumption:.2f}kW")
                else:
                    print(f"[{self.board_name}] ❌ Failed to send data for round {status['round']}")
            
            # ESP32-like polling interval (conserve battery/processing)
            time.sleep(3)
    
    def test_new_endpoints(self):
        """Test the new binary endpoints"""
        print(f"[{self.board_name}] 🧪 Testing new endpoints...")
        
        try:
            # Test getting production values
            response = requests.get(f"{COREAPI_URL}/prod_vals", headers=self.headers)
            if response.status_code == 200:
                data = response.content
                if len(data) > 0:
                    count = struct.unpack('B', data[:1])[0]
                    print(f"[{self.board_name}] 📊 Production values: {count} power plants available")
                else:
                    print(f"[{self.board_name}] ❌ No production data received")
            
            # Test getting consumption values  
            response = requests.get(f"{COREAPI_URL}/cons_vals", headers=self.headers)
            if response.status_code == 200:
                data = response.content
                if len(data) > 0:
                    count = struct.unpack('B', data[:1])[0]
                    print(f"[{self.board_name}] 📊 Consumption values: {count} consumers available")
                else:
                    print(f"[{self.board_name}] ❌ No consumption data received")
            
            # Test posting connected power plants
            power_plants_data = struct.pack('B', 2)  # 2 power plants
            power_plants_data += struct.pack('>Ii', 1, 50)  # FVE with 50W set power
            power_plants_data += struct.pack('>Ii', 2, 30)  # Wind with 30W set power
            
            response = requests.post(f"{COREAPI_URL}/prod_connected", 
                                   data=power_plants_data,
                                   headers={**self.headers, 'Content-Type': 'application/octet-stream'})
            if response.status_code == 200:
                print(f"[{self.board_name}] ✅ Connected power plants reported")
            else:
                print(f"[{self.board_name}] ❌ Failed to report power plants: {response.status_code}")
            
            # Test posting connected consumers
            consumers_data = struct.pack('B', 1)  # 1 consumer
            consumers_data += struct.pack('>I', 3)  # Housing units
            
            response = requests.post(f"{COREAPI_URL}/cons_connected", 
                                   data=consumers_data,
                                   headers={**self.headers, 'Content-Type': 'application/octet-stream'})
            if response.status_code == 200:
                print(f"[{self.board_name}] ✅ Connected consumers reported")
            else:
                print(f"[{self.board_name}] ❌ Failed to report consumers: {response.status_code}")
            
            # Test posting production/consumption values
            post_data = struct.pack('>ii', 45, 25)  # 45W production, 25W consumption
            response = requests.post(f"{COREAPI_URL}/post_vals", 
                                   data=post_data,
                                   headers={**self.headers, 'Content-Type': 'application/octet-stream'})
            if response.status_code == 200:
                print(f"[{self.board_name}] ✅ Posted power values (45W production, 25W consumption)")
            else:
                print(f"[{self.board_name}] ❌ Failed to post power values: {response.status_code}")
                
        except Exception as e:
            print(f"[{self.board_name}] ❌ Error testing new endpoints: {e}")
    
    def run(self):
        """Run the complete ESP32 board simulation"""
        print(f"[{self.board_name}] 🔌 Starting ESP32 simulation...")
        
        # Step 1: Login
        if not self.login():
            return False
        
        # Step 2: Register using binary protocol
        if not self.register_binary():
            return False
        
        # Step 2.5: Test new endpoints
        self.test_new_endpoints()
        
        # Step 3: Wait for game to start
        if not self.wait_for_game_start():
            return False
        
        # Step 4: Run main loop
        self.running = True
        try:
            self.main_loop()
        except KeyboardInterrupt:
            print(f"[{self.board_name}] 🛑 Simulation stopped by user")
        finally:
            self.running = False
        
        return True

def run_board_simulation(config):
    """Run a single board simulation"""
    simulator = ESP32BoardSimulator(**config)
    simulator.run()

def main():
    print("🤖 ESP32 Binary Protocol Board Simulation")
    print("=" * 60)
    
    # Board configurations optimized for ESP32
    board_configs = [
        {
            "username": "board1",
            "password": "board123", 
            "board_id": 4001,
            "board_name": "ESP32 Solar #1",
            "board_type": "solar"
        },
        {
            "username": "board2", 
            "password": "board456",
            "board_id": 4002,
            "board_name": "ESP32 Wind #1",
            "board_type": "wind"
        },
        {
            "username": "board3",
            "password": "board789", 
            "board_id": 4003,
            "board_name": "ESP32 Battery #1",
            "board_type": "battery"
        }
    ]
    
    # Start all board simulations in parallel
    threads = []
    for config in board_configs:
        thread = threading.Thread(target=run_board_simulation, args=(config,))
        thread.daemon = True
        thread.start()
        threads.append(thread)
        time.sleep(0.5)  # Stagger startup
    
    # Wait for all threads or user interrupt
    try:
        for thread in threads:
            thread.join()
    except KeyboardInterrupt:
        print("\n🛑 Stopping all simulations...")

if __name__ == "__main__":
    main()
