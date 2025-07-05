#!/usr/bin/env python3
"""
Realistic Board Simulation
Simulates actual board behavior - register, wait for game start, respond to rounds
"""

import requests
import json
import time
import threading
import random
import math
from datetime import datetime

BASE_URL = "http://localhost"
COREAPI_URL = f"{BASE_URL}/coreapi"

class BoardSimulator:
    def __init__(self, username, password, board_id, board_name, board_type):
        self.username = username
        self.password = password
        self.board_id = board_id
        self.board_name = board_name
        self.board_type = board_type
        self.token = None
        self.last_round = 0
        self.running = False
        
    def log(self, message):
        print(f"[{self.board_name}] {message}")
    
    def login(self):
        """Login and get authentication token"""
        self.log("Logging in...")
        try:
            response = requests.post(f"{COREAPI_URL}/login", json={
                "username": self.username,
                "password": self.password
            })
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('token')
                if self.token:
                    self.log("✅ Login successful")
                    return True
                else:
                    self.log("❌ No token received")
                    return False
            else:
                self.log(f"❌ Login failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            self.log(f"❌ Login error: {e}")
            return False
    
    def register_board(self):
        """Register the board with the game system"""
        if not self.token:
            self.log("❌ Not logged in")
            return False
            
        self.log("Registering board...")
        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            response = requests.post(f"{COREAPI_URL}/register", 
                                   headers=headers,
                                   json={
                                       "board_id": self.board_id,
                                       "board_name": self.board_name,
                                       "board_type": self.board_type
                                   })
            
            if response.status_code == 200:
                self.log("✅ Board registered successfully")
                return True
            else:
                self.log(f"❌ Registration failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            self.log(f"❌ Registration error: {e}")
            return False
    
    def poll_status(self):
        """Poll the board status and check for round changes"""
        if not self.token:
            return None
            
        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            response = requests.get(f"{COREAPI_URL}/poll/{self.board_id}", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                return data
            else:
                self.log(f"❌ Poll failed: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            self.log(f"❌ Poll error: {e}")
            return None
    
    def generate_power_data(self, round_num):
        """Generate realistic power data based on board type and round"""
        # Use round number to simulate time of day (assuming each round = 1 hour)
        hour_of_day = (round_num - 1) % 24
        
        generation = 0
        consumption = 0
        
        if self.board_type == "solar":
            # Solar generates power during daylight (6 AM to 6 PM)
            if 6 <= hour_of_day <= 18:
                # Peak generation at noon (hour 12)
                noon_factor = 1 - abs(hour_of_day - 12) / 6
                generation = 30 + 20 * noon_factor + random.uniform(-5, 5)
            else:
                generation = 0
            consumption = random.uniform(2, 5)  # Minimal self-consumption
            
        elif self.board_type == "wind":
            # Wind is more variable but has some patterns
            base_wind = 15 + 10 * math.sin((hour_of_day - 6) * math.pi / 12)
            generation = max(0, base_wind + random.uniform(-10, 15))
            consumption = random.uniform(3, 6)
            
        elif self.board_type == "storage":
            # Storage can generate (discharge) or consume (charge)
            # Typically generates during peak hours, consumes during low demand
            if 17 <= hour_of_day <= 21:  # Evening peak
                generation = random.uniform(20, 40)
                consumption = random.uniform(2, 5)
            elif 1 <= hour_of_day <= 5:  # Night charging
                generation = 0
                consumption = random.uniform(15, 30)
            else:
                generation = random.uniform(0, 10)
                consumption = random.uniform(5, 15)
        
        return round(generation, 2), round(consumption, 2)
    
    def send_power_data(self, generation, consumption):
        """Send power generation and consumption data"""
        if not self.token:
            return False
            
        headers = {'Authorization': f'Bearer {self.token}'}
        timestamp = datetime.now().isoformat() + "Z"
        
        # Send generation data
        if generation > 0:
            try:
                response = requests.post(f"{COREAPI_URL}/power_generation",
                                       headers=headers,
                                       json={
                                           "board_id": self.board_id,
                                           "power": generation,
                                           "timestamp": timestamp
                                       })
                if response.status_code != 200:
                    self.log(f"❌ Generation data failed: {response.status_code}")
                    return False
            except Exception as e:
                self.log(f"❌ Generation error: {e}")
                return False
        
        # Send consumption data
        if consumption > 0:
            try:
                response = requests.post(f"{COREAPI_URL}/power_consumption",
                                       headers=headers,
                                       json={
                                           "board_id": self.board_id,
                                           "power": consumption,
                                           "timestamp": timestamp
                                       })
                if response.status_code != 200:
                    self.log(f"❌ Consumption data failed: {response.status_code}")
                    return False
            except Exception as e:
                self.log(f"❌ Consumption error: {e}")
                return False
        
        self.log(f"📊 Sent data - Gen: {generation}kW, Cons: {consumption}kW")
        return True
    
    def run_simulation(self):
        """Main simulation loop"""
        self.running = True
        
        # Step 1: Login
        if not self.login():
            return
        
        # Step 2: Register
        if not self.register_board():
            return
        
        # Step 3: Wait for game to start
        self.log("🕐 Waiting for game to start...")
        game_started = False
        
        while self.running and not game_started:
            status = self.poll_status()
            if status and status.get('r', 0) > 0:  # Round > 0 means game started
                game_started = True
                self.last_round = status.get('r', 0)
                self.log(f"🚀 Game started! Currently round {self.last_round}")
                
                # Send initial data for the current round
                if status.get('expecting_data', False):
                    generation, consumption = self.generate_power_data(self.last_round)
                    self.send_power_data(generation, consumption)
            else:
                time.sleep(2)  # Poll every 2 seconds while waiting
        
        # Step 4: Main game loop - respond to round changes
        self.log("🎮 Entering main game loop...")
        
        while self.running:
            status = self.poll_status()
            
            if status:
                current_round = status.get('r', 0)
                expecting_data = status.get('expecting_data', False)
                
                # Check if round has advanced
                if current_round > self.last_round:
                    self.log(f"🔄 New round detected: {current_round} (was {self.last_round})")
                    self.last_round = current_round
                    
                    # Send data for the new round
                    if expecting_data:
                        generation, consumption = self.generate_power_data(current_round)
                        self.send_power_data(generation, consumption)
                
                # If we haven't sent data for current round and system expects it
                elif expecting_data:
                    self.log("📤 System expects data, sending...")
                    generation, consumption = self.generate_power_data(current_round)
                    self.send_power_data(generation, consumption)
            
            time.sleep(3)  # Poll every 3 seconds during active game
    
    def stop(self):
        """Stop the simulation"""
        self.running = False
        self.log("🛑 Simulation stopped")

def main():
    """Create and run board simulations"""
    
    # Define the existing board credentials
    boards = [
        {
            "username": "board1",
            "password": "board123", 
            "board_id": 1001,
            "board_name": "Solar Panel Board #1",
            "board_type": "solar"
        },
        {
            "username": "board2", 
            "password": "board456",
            "board_id": 1002,
            "board_name": "Wind Turbine Board #2",
            "board_type": "wind"
        },
        {
            "username": "board3",
            "password": "board789",
            "board_id": 1003, 
            "board_name": "Battery Storage Board #3",
            "board_type": "storage"
        }
    ]
    
    print("🤖 Starting Realistic Board Simulation")
    print("=" * 60)
    
    # Create board simulators
    simulators = []
    for board_config in boards:
        simulator = BoardSimulator(**board_config)
        simulators.append(simulator)
    
    # Start each board in its own thread
    threads = []
    for simulator in simulators:
        thread = threading.Thread(target=simulator.run_simulation, daemon=True)
        thread.start()
        threads.append(thread)
        time.sleep(1)  # Stagger the starts slightly
    
    print("\n🎮 All boards started! Press Ctrl+C to stop simulation...")
    print("💡 Use the lecturer dashboard to start the game and advance rounds")
    print("📊 Boards will automatically send data when rounds advance")
    
    try:
        # Keep main thread alive
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Stopping simulation...")
        for simulator in simulators:
            simulator.stop()
        
        # Wait for threads to finish
        for thread in threads:
            thread.join(timeout=2)
        
        print("✅ Simulation stopped")

if __name__ == "__main__":
    main()
