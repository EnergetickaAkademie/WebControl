#!/usr/bin/env python3
"""
Realistic Board Simulation
Simulates board behavior that registers, waits for game start, and responds to round changes.
"""

import requests
import json
import time
import threading
import random
import math
from datetime import datetime
from typing import Dict, Optional

BASE_URL = "http://localhost"
COREAPI_URL = f"{BASE_URL}/coreapi"

class BoardSimulator:
    def __init__(self, board_id: int, username: str, password: str, board_name: str, board_type: str):
        self.board_id = board_id
        self.username = username
        self.password = password
        self.board_name = board_name
        self.board_type = board_type
        self.token = None
        self.headers = {}
        self.running = False
        self.last_round = 0
        self.is_registered = False
        
        # Board-specific power generation patterns
        self.generation_patterns = {
            "solar": self._solar_pattern,
            "wind": self._wind_pattern,
            "hydro": self._hydro_pattern,
            "battery": self._battery_pattern,
            "generic": self._generic_pattern
        }
        
        self.consumption_patterns = {
            "factory": self._factory_consumption,
            "residential": self._residential_consumption,
            "commercial": self._commercial_consumption,
            "datacenter": self._datacenter_consumption,
            "generic": self._generic_consumption
        }
        
        # Determine patterns based on board type
        self.generation_func = self.generation_patterns.get(board_type, self._generic_pattern)
        if board_type in ["factory", "residential", "commercial", "datacenter"]:
            self.consumption_func = self.consumption_patterns[board_type]
        else:
            self.consumption_func = self._generic_consumption
    
    def _solar_pattern(self, round_type: str) -> float:
        """Solar generation pattern - high during day, zero at night"""
        if round_type == "night":
            return 0.0
        # Day pattern: peak around noon
        base_generation = 50.0
        variation = random.uniform(0.8, 1.2)  # ±20% variation
        return base_generation * variation
    
    def _wind_pattern(self, round_type: str) -> float:
        """Wind generation - variable, slightly higher at night"""
        base = 30.0 if round_type == "night" else 25.0
        variation = random.uniform(0.3, 1.5)  # High variability
        return base * variation
    
    def _hydro_pattern(self, round_type: str) -> float:
        """Hydro generation - consistent with minor variations"""
        base_generation = 40.0
        variation = random.uniform(0.9, 1.1)  # ±10% variation
        return base_generation * variation
    
    def _battery_pattern(self, round_type: str) -> float:
        """Battery - discharge during peak hours, charge during low demand"""
        if round_type == "day":
            return random.uniform(10.0, 25.0)  # Discharging
        else:
            return random.uniform(0.0, 5.0)  # Minimal discharge
    
    def _generic_pattern(self, round_type: str) -> float:
        """Generic generation pattern"""
        base = 20.0
        variation = random.uniform(0.7, 1.3)
        return base * variation
    
    def _factory_consumption(self, round_type: str) -> float:
        """Factory consumption - high during day, low at night"""
        if round_type == "day":
            return random.uniform(60.0, 80.0)
        else:
            return random.uniform(10.0, 20.0)
    
    def _residential_consumption(self, round_type: str) -> float:
        """Residential consumption - peaks in morning and evening"""
        if round_type == "day":
            return random.uniform(25.0, 35.0)
        else:
            return random.uniform(35.0, 45.0)  # Higher at night (evening peak)
    
    def _commercial_consumption(self, round_type: str) -> float:
        """Commercial consumption - high during business hours"""
        if round_type == "day":
            return random.uniform(40.0, 60.0)
        else:
            return random.uniform(15.0, 25.0)
    
    def _datacenter_consumption(self, round_type: str) -> float:
        """Datacenter consumption - consistent 24/7"""
        return random.uniform(45.0, 55.0)
    
    def _generic_consumption(self, round_type: str) -> float:
        """Generic consumption pattern"""
        base = 30.0
        variation = random.uniform(0.8, 1.2)
        return base * variation
    
    def login(self) -> bool:
        """Login and get authentication token"""
        try:
            response = requests.post(f"{COREAPI_URL}/login", json={
                "username": self.username,
                "password": self.password
            }, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('token')
                if self.token:
                    self.headers = {'Authorization': f'Bearer {self.token}'}
                    print(f"🔐 [{self.board_name}] Successfully logged in")
                    return True
            
            print(f"❌ [{self.board_name}] Login failed: {response.status_code}")
            return False
            
        except requests.RequestException as e:
            print(f"❌ [{self.board_name}] Login error: {e}")
            return False
    
    def register(self) -> bool:
        """Register the board with the game"""
        try:
            response = requests.post(f"{COREAPI_URL}/register", 
                                   headers=self.headers,
                                   json={
                                       "board_id": self.board_id,
                                       "board_name": self.board_name,
                                       "board_type": self.board_type
                                   }, timeout=10)
            
            if response.status_code == 200:
                print(f"📋 [{self.board_name}] Successfully registered (ID: {self.board_id})")
                self.is_registered = True
                return True
            else:
                print(f"❌ [{self.board_name}] Registration failed: {response.status_code}")
                return False
                
        except requests.RequestException as e:
            print(f"❌ [{self.board_name}] Registration error: {e}")
            return False
    
    def poll_status(self) -> Optional[Dict]:
        """Poll the board status from the server"""
        try:
            response = requests.get(f"{COREAPI_URL}/poll/{self.board_id}", 
                                  headers=self.headers, timeout=10)
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"❌ [{self.board_name}] Poll failed: {response.status_code}")
                return None
                
        except requests.RequestException as e:
            print(f"❌ [{self.board_name}] Poll error: {e}")
            return None
    
    def submit_power_data(self, generation: float, consumption: float) -> bool:
        """Submit power generation and consumption data"""
        timestamp = datetime.now().isoformat() + "Z"
        
        success = True
        
        # Submit generation data
        try:
            gen_response = requests.post(f"{COREAPI_URL}/power_generation",
                                       headers=self.headers,
                                       json={
                                           "board_id": self.board_id,
                                           "power": generation,
                                           "timestamp": timestamp
                                       }, timeout=10)
            
            if gen_response.status_code != 200:
                print(f"❌ [{self.board_name}] Generation submission failed: {gen_response.status_code}")
                success = False
                
        except requests.RequestException as e:
            print(f"❌ [{self.board_name}] Generation submission error: {e}")
            success = False
        
        # Submit consumption data
        try:
            cons_response = requests.post(f"{COREAPI_URL}/power_consumption",
                                        headers=self.headers,
                                        json={
                                            "board_id": self.board_id,
                                            "power": consumption,
                                            "timestamp": timestamp
                                        }, timeout=10)
            
            if cons_response.status_code != 200:
                print(f"❌ [{self.board_name}] Consumption submission failed: {cons_response.status_code}")
                success = False
                
        except requests.RequestException as e:
            print(f"❌ [{self.board_name}] Consumption submission error: {e}")
            success = False
        
        if success:
            print(f"⚡ [{self.board_name}] Submitted data - Gen: {generation:.1f}kW, Cons: {consumption:.1f}kW")
        
        return success
    
    def run_simulation(self):
        """Main simulation loop"""
        print(f"🚀 [{self.board_name}] Starting board simulation...")
        
        # Step 1: Login
        if not self.login():
            print(f"❌ [{self.board_name}] Failed to login, stopping simulation")
            return
        
        # Step 2: Register
        if not self.register():
            print(f"❌ [{self.board_name}] Failed to register, stopping simulation")
            return
        
        self.running = True
        print(f"⏳ [{self.board_name}] Waiting for game to start...")
        
        # Step 3: Main simulation loop
        while self.running:
            try:
                # Poll current status
                status = self.poll_status()
                if not status:
                    time.sleep(5)
                    continue
                
                current_round = status.get('r', 0)
                game_active = status.get('game_active', False)
                expecting_data = status.get('expecting_data', False)
                round_type = status.get('rt', 'day')
                
                # Check if game started
                if not game_active:
                    if self.last_round > 0:
                        print(f"🏁 [{self.board_name}] Game finished!")
                        break
                    else:
                        # Still waiting for game to start
                        time.sleep(3)
                        continue
                
                # Game is active - check if new round or expecting data
                if current_round > self.last_round:
                    print(f"🔄 [{self.board_name}] New round detected: {current_round} ({round_type})")
                    self.last_round = current_round
                
                # Submit data if the server is expecting it
                if expecting_data:
                    generation = self.generation_func(round_type)
                    consumption = self.consumption_func(round_type)
                    
                    if self.submit_power_data(generation, consumption):
                        print(f"✅ [{self.board_name}] Data submitted for round {current_round}")
                    else:
                        print(f"❌ [{self.board_name}] Failed to submit data for round {current_round}")
                
                # Wait before next poll
                time.sleep(2)
                
            except KeyboardInterrupt:
                print(f"🛑 [{self.board_name}] Simulation interrupted by user")
                break
            except Exception as e:
                print(f"❌ [{self.board_name}] Unexpected error: {e}")
                time.sleep(5)
        
        self.running = False
        print(f"🔚 [{self.board_name}] Simulation ended")
    
    def stop(self):
        """Stop the simulation"""
        self.running = False

class SimulationManager:
    def __init__(self):
        self.simulators = []
        self.threads = []
    
    def add_board(self, board_id: int, username: str, password: str, board_name: str, board_type: str):
        """Add a board to the simulation"""
        simulator = BoardSimulator(board_id, username, password, board_name, board_type)
        self.simulators.append(simulator)
    
    def start_all(self):
        """Start all board simulations"""
        print("🎯 Starting all board simulations...")
        
        for simulator in self.simulators:
            thread = threading.Thread(target=simulator.run_simulation, daemon=True)
            thread.start()
            self.threads.append(thread)
            time.sleep(1)  # Stagger starts to avoid overwhelming the server
        
        print(f"✅ Started {len(self.simulators)} board simulations")
    
    def stop_all(self):
        """Stop all board simulations"""
        print("🛑 Stopping all board simulations...")
        
        for simulator in self.simulators:
            simulator.stop()
        
        # Wait for threads to finish
        for thread in self.threads:
            thread.join(timeout=5)
        
        print("✅ All simulations stopped")
    
    def wait_for_completion(self):
        """Wait for all simulations to complete"""
        try:
            while any(thread.is_alive() for thread in self.threads):
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n🛑 Interrupted by user, stopping all simulations...")
            self.stop_all()

def main():
    """Main function to run the simulation"""
    print("=" * 60)
    print("🔌 Realistic Board Simulation")
    print("=" * 60)
    
    # Create simulation manager
    manager = SimulationManager()
    
    # Add different types of boards (using available test credentials)
    boards = [
        (2001, "test_board", "board123", "Solar Farm Alpha", "solar"),
        (2002, "test_board", "board123", "Solar Farm Beta", "solar"),
        (2003, "test_board", "board123", "Wind Farm Charlie", "wind"),
        (2004, "test_board", "board123", "Wind Farm Delta", "wind"),
        (2005, "test_board", "board123", "Hydro Plant Echo", "hydro"),
        (2006, "test_board", "board123", "Steel Factory", "factory"),
        (2007, "test_board", "board123", "Residential District", "residential"),
        (2008, "test_board", "board123", "Cloud Datacenter", "datacenter"),
    ]
    
    for board_id, username, password, name, board_type in boards:
        manager.add_board(board_id, username, password, name, board_type)
    
    print(f"📋 Configured {len(boards)} boards:")
    for _, _, _, name, board_type in boards:
        print(f"   - {name} ({board_type})")
    
    print("\n🎮 Instructions:")
    print("1. Boards will register and wait for the game to start")
    print("2. Use the lecturer dashboard to start the game")
    print("3. Boards will automatically respond to round changes")
    print("4. Use 'Next Round' button to advance rounds")
    print("5. Press Ctrl+C to stop the simulation")
    print("\n" + "=" * 60)
    
    try:
        # Start all simulations
        manager.start_all()
        
        # Wait for completion or interruption
        manager.wait_for_completion()
        
    except KeyboardInterrupt:
        print("\n🛑 Simulation interrupted by user")
    finally:
        manager.stop_all()
        print("🏁 Simulation complete!")

if __name__ == "__main__":
    main()
