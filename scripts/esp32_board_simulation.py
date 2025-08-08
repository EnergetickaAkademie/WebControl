#!/usr/bin/env python3
"""
ESP32 Board Simulation Script
Simulates ESP32 boards communicating with the CoreAPI using binary protocol
"""

import requests
import struct
import time
import random
import threading
from typing import Dict, Any

# Configuration
BASE_URL = "http://localhost"
COREAPI_URL = f"{BASE_URL}/coreapi"

class ESP32BoardSimulator:
    def __init__(self, board_name: str, username: str, password: str):
        self.board_name = board_name
        self.username = username
        self.password = password
        self.token = None
        self.headers = {}
        self.running = True
        
        # Simulation state
        self.production = 0.0
        self.consumption = 0.0
        self.connected_power_plants = []
        self.connected_consumers = []
    
    def login(self) -> bool:
        """Authenticate with the API and get JWT token"""
        try:
            response = requests.post(f"{COREAPI_URL}/login", 
                                   json={
                                       'username': self.username,
                                       'password': self.password
                                   })
            
            if response.status_code == 200:
                data = response.json()
                self.token = data['token']
                self.headers = {'Authorization': f'Bearer {self.token}'}
                print(f"[{self.board_name}] ✅ Logged in successfully")
                return True
            else:
                print(f"[{self.board_name}] ❌ Login failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"[{self.board_name}] ❌ Login error: {e}")
            return False
    
    def register_board(self) -> bool:
        """Register the board with the API using binary protocol"""
        try:
            # Binary registration now requires only JWT authentication
            # No board data needed in request - board ID comes from JWT token
            
            response = requests.post(f"{COREAPI_URL}/register",
                                   data=b'',  # Empty data - board ID extracted from JWT
                                   headers={**self.headers, 'Content-Type': 'application/octet-stream'})
            
            if response.status_code == 200:
                print(f"[{self.board_name}] ✅ Board registered successfully")
                return True
            else:
                print(f"[{self.board_name}] ❌ Registration failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"[{self.board_name}] ❌ Registration error: {e}")
            return False
    
    def poll_binary(self) -> bool:
        """Poll the board status using binary protocol"""
        try:
            response = requests.get(f"{COREAPI_URL}/poll_binary",
                                  headers=self.headers)
            
            if response.status_code == 200:
                print(f"[{self.board_name}] 📡 Received game coefficients")
                return True
            else:
                print(f"[{self.board_name}] ⚠️ Poll failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"[{self.board_name}] ❌ Poll error: {e}")
            return False
    
    def send_power_data(self, production: float, consumption: float) -> bool:
        """Send power data using binary protocol (post_vals endpoint)"""
        try:
            # Pack production and consumption as signed integers (W to mW conversion)
            prod_int = int(production * 1000)
            cons_int = int(consumption * 1000)
            
            data = struct.pack('>ii', prod_int, cons_int)
            
            response = requests.post(f"{COREAPI_URL}/post_vals",
                                   data=data,
                                   headers={**self.headers, 'Content-Type': 'application/octet-stream'})
            
            if response.status_code == 200:
                self.production = production
                self.consumption = consumption
                return True
            else:
                print(f"[{self.board_name}] ⚠️ Power data failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"[{self.board_name}] ❌ Power data error: {e}")
            return False
    
    def report_connected_production(self, plant_ids: list) -> bool:
        """Report connected power plants"""
        try:
            count = len(plant_ids)
            data = struct.pack('B', count)
            
            for plant_id in plant_ids:
                set_power = random.randint(500, 2000)  # Random set power in mW
                data += struct.pack('>Ii', plant_id, set_power)
            
            response = requests.post(f"{COREAPI_URL}/prod_connected",
                                   data=data,
                                   headers={**self.headers, 'Content-Type': 'application/octet-stream'})
            
            if response.status_code == 200:
                self.connected_power_plants = plant_ids
                print(f"[{self.board_name}] ✅ Reported {count} connected power plants")
                return True
            else:
                print(f"[{self.board_name}] ⚠️ Production report failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"[{self.board_name}] ❌ Production report error: {e}")
            return False
    
    def report_connected_consumption(self, consumer_ids: list) -> bool:
        """Report connected consumers"""
        try:
            count = len(consumer_ids)
            data = struct.pack('B', count)
            
            for consumer_id in consumer_ids:
                data += struct.pack('>I', consumer_id)
            
            response = requests.post(f"{COREAPI_URL}/cons_connected",
                                   data=data,
                                   headers={**self.headers, 'Content-Type': 'application/octet-stream'})
            
            if response.status_code == 200:
                self.connected_consumers = consumer_ids
                print(f"[{self.board_name}] ✅ Reported {count} connected consumers")
                return True
            else:
                print(f"[{self.board_name}] ⚠️ Consumption report failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"[{self.board_name}] ❌ Consumption report error: {e}")
            return False
    
    def generate_realistic_data(self) -> tuple[float, float]:
        """Generate realistic power data based on board type"""
        # Simple simulation - random values for demonstration
        production = random.uniform(800, 1500)  # 800-1500W
        consumption = random.uniform(200, 600)  # 200-600W
        
        return production, consumption
    
    def simulate_board_operation(self):
        """Main simulation loop"""
        print(f"[{self.board_name}] 🎮 Starting board simulation")
        
        # Login and register
        if not self.login():
            return
        
        if not self.register_board():
            return
            
        # Report some initial connections
        self.report_connected_production([1, 2, 3])  # Connected to power plants 1, 2, 3
        self.report_connected_consumption([1, 2])     # Connected to consumers 1, 2
        
        # Main simulation loop
        while self.running:
            try:
                # Poll for game status
                if self.poll_binary():
                    # Generate and send power data
                    prod, cons = self.generate_realistic_data()
                    if self.send_power_data(prod, cons):
                        print(f"[{self.board_name}] 📊 Sent: Production={prod:.1f}W, Consumption={cons:.1f}W")
                
                # Wait before next update
                time.sleep(5)
                
            except KeyboardInterrupt:
                print(f"[{self.board_name}] 🛑 Stopping simulation")
                self.running = False
                break
            except Exception as e:
                print(f"[{self.board_name}] ❌ Simulation error: {e}")
                time.sleep(2)
    
    def stop(self):
        """Stop the simulation"""
        self.running = False


def main():
    print("🤖 ESP32 Board Simulator")
    print("=" * 50)
    
    # Test API connectivity first
    try:
        response = requests.get(f"{COREAPI_URL}/health", timeout=5)
        if response.status_code == 200:
            print("✅ CoreAPI is accessible")
        else:
            print(f"⚠️ CoreAPI returned status {response.status_code}")
    except Exception as e:
        print(f"❌ Cannot connect to CoreAPI: {e}")
        print("Make sure Docker services are running: docker-compose up")
        return
    
    # Create board simulators
    boards = [
        ESP32BoardSimulator("Solar Panel Board #1", "board1", "board123"),
        ESP32BoardSimulator("Wind Turbine Board #2", "board2", "board456"), 
        ESP32BoardSimulator("Battery Storage Board #3", "board3", "board789")
    ]
    
    # Start simulation threads
    threads = []
    for board in boards:
        thread = threading.Thread(target=board.simulate_board_operation)
        thread.daemon = True
        threads.append(thread)
        thread.start()
        time.sleep(1)  # Stagger the starts
    
    try:
        print("\n🔄 Boards are running. Press Ctrl+C to stop all simulations.")
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Stopping all board simulations...")
        for board in boards:
            board.stop()
        
        print("✅ All simulations stopped.")


if __name__ == "__main__":
    main()
