#!/usr/bin/env python3
"""
Board Simulation Test Script
Simulates multiple boards generating and consuming power with realistic patterns.
"""

import requests
import json
import time
import random
import threading
from datetime import datetime
import math

BASE_URL = "http://localhost"
COREAPI_URL = f"{BASE_URL}/coreapi"

class BoardSimulator:
    """Simulates a single board with realistic power patterns"""
    
    def __init__(self, board_id, board_name, board_type, username, password):
        self.board_id = board_id
        self.board_name = board_name
        self.board_type = board_type
        self.username = username
        self.password = password
        self.token = None
        self.running = False
        self.thread = None
        
        # Power generation patterns based on board type
        if board_type == "solar":
            self.base_generation = 50.0
            self.generation_variance = 20.0
            self.consumption = 5.0
        elif board_type == "wind":
            self.base_generation = 30.0
            self.generation_variance = 25.0
            self.consumption = 3.0
        elif board_type == "hydro":
            self.base_generation = 80.0
            self.generation_variance = 10.0
            self.consumption = 8.0
        elif board_type == "factory":
            self.base_generation = 0.0
            self.generation_variance = 0.0
            self.consumption = 100.0
        elif board_type == "residential":
            self.base_generation = 0.0
            self.generation_variance = 0.0
            self.consumption = 25.0
        else:  # generic
            self.base_generation = 20.0
            self.generation_variance = 10.0
            self.consumption = 15.0
    
    def login(self):
        """Login and get authentication token"""
        try:
            response = requests.post(f"{COREAPI_URL}/login", json={
                "username": self.username,
                "password": self.password
            })
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('token')
                print(f"[{self.board_name}] Login successful")
                return True
            else:
                print(f"[{self.board_name}] Login failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print(f"[{self.board_name}] Login error: {e}")
            return False
    
    def register_board(self):
        """Register this board with the game"""
        if not self.token:
            return False
        
        headers = {'Authorization': f'Bearer {self.token}'}
        
        try:
            response = requests.post(f"{COREAPI_URL}/register", 
                                   headers=headers,
                                   json={
                                       "board_id": self.board_id,
                                       "board_name": self.board_name,
                                       "board_type": self.board_type
                                   })
            
            if response.status_code == 200:
                print(f"[{self.board_name}] Board registered successfully")
                return True
            else:
                print(f"[{self.board_name}] Registration failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print(f"[{self.board_name}] Registration error: {e}")
            return False
    
    def get_power_generation(self):
        """Calculate current power generation based on time and randomness"""
        if self.base_generation == 0:
            return 0.0
        
        # Simulate day/night cycle for solar
        current_hour = datetime.now().hour
        if self.board_type == "solar":
            # Solar generation peaks at noon, zero at night
            if 6 <= current_hour <= 18:
                time_factor = math.sin((current_hour - 6) * math.pi / 12)
            else:
                time_factor = 0
        elif self.board_type == "wind":
            # Wind is more variable but has some daily patterns
            time_factor = 0.7 + 0.3 * math.sin((current_hour + random.randint(-2, 2)) * math.pi / 12)
        else:
            # Hydro and others are more constant
            time_factor = 0.8 + 0.2 * random.random()
        
        # Add some randomness
        random_factor = 1.0 + (random.random() - 0.5) * (self.generation_variance / 100.0)
        
        return max(0, self.base_generation * time_factor * random_factor)
    
    def get_power_consumption(self):
        """Calculate current power consumption with some variance"""
        base_consumption = self.consumption
        
        # Add daily patterns for consumption
        current_hour = datetime.now().hour
        if self.board_type in ["factory", "residential"]:
            # Higher consumption during day for factories, peaks in evening for residential
            if self.board_type == "factory":
                if 8 <= current_hour <= 17:
                    time_factor = 1.2
                else:
                    time_factor = 0.6
            else:  # residential
                if 17 <= current_hour <= 22:
                    time_factor = 1.5
                elif 6 <= current_hour <= 9:
                    time_factor = 1.2
                else:
                    time_factor = 0.8
        else:
            time_factor = 1.0
        
        # Add some randomness
        random_factor = 1.0 + (random.random() - 0.5) * 0.2
        
        return base_consumption * time_factor * random_factor
    
    def send_power_data(self):
        """Send current power generation and consumption data"""
        if not self.token:
            return False
        
        headers = {'Authorization': f'Bearer {self.token}'}
        
        generation = self.get_power_generation()
        consumption = self.get_power_consumption()
        timestamp = datetime.now().isoformat()
        
        try:
            # Send generation data
            if generation > 0:
                gen_response = requests.post(f"{COREAPI_URL}/power_generation",
                                           headers=headers,
                                           json={
                                               "board_id": self.board_id,
                                               "power": round(generation, 2),
                                               "timestamp": timestamp
                                           })
                
                if gen_response.status_code != 200:
                    print(f"[{self.board_name}] Generation update failed: {gen_response.status_code}")
            
            # Send consumption data
            cons_response = requests.post(f"{COREAPI_URL}/power_consumption",
                                        headers=headers,
                                        json={
                                            "board_id": self.board_id,
                                            "power": round(consumption, 2),
                                            "timestamp": timestamp
                                        })
            
            if cons_response.status_code == 200:
                net_power = generation - consumption
                status = "+" if net_power > 0 else ""
                print(f"[{self.board_name}] Gen: {generation:.1f}kW, Cons: {consumption:.1f}kW, Net: {status}{net_power:.1f}kW")
                return True
            else:
                print(f"[{self.board_name}] Consumption update failed: {cons_response.status_code}")
                return False
                
        except Exception as e:
            print(f"[{self.board_name}] Data sending error: {e}")
            return False
    
    def simulation_loop(self):
        """Main simulation loop"""
        while self.running:
            if self.send_power_data():
                time.sleep(5 + random.uniform(-1, 1))  # Send data every ~5 seconds with some jitter
            else:
                time.sleep(10)  # Wait longer if there's an error
    
    def start_simulation(self):
        """Start the simulation in a separate thread"""
        if self.login() and self.register_board():
            self.running = True
            self.thread = threading.Thread(target=self.simulation_loop)
            self.thread.daemon = True
            self.thread.start()
            return True
        return False
    
    def stop_simulation(self):
        """Stop the simulation"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)

class GameSimulation:
    """Manages multiple board simulators"""
    
    def __init__(self):
        self.simulators = []
    
    def create_test_boards(self):
        """Create a set of test boards with different types"""
        board_configs = [
            (1001, "Solar Farm Alpha", "solar", "solar_board_1", "solar123"),
            (1002, "Wind Turbine Beta", "wind", "wind_board_1", "wind123"),
            (1003, "Hydro Plant Gamma", "hydro", "hydro_board_1", "hydro123"),
            (1004, "Factory Delta", "factory", "factory_board_1", "factory123"),
            (1005, "Residential Complex Epsilon", "residential", "residential_board_1", "residential123"),
            (1006, "Solar Farm Zeta", "solar", "solar_board_2", "solar456"),
            (1007, "Wind Turbine Eta", "wind", "wind_board_2", "wind456"),
            (1008, "Generic Station Theta", "generic", "generic_board_1", "generic123"),
        ]
        
        for config in board_configs:
            simulator = BoardSimulator(*config)
            self.simulators.append(simulator)
    
    def start_all_simulations(self):
        """Start all board simulations"""
        print("Starting board simulations...")
        successful = 0
        
        for simulator in self.simulators:
            if simulator.start_simulation():
                successful += 1
                time.sleep(1)  # Stagger the starts
        
        print(f"Started {successful}/{len(self.simulators)} board simulations")
        return successful
    
    def stop_all_simulations(self):
        """Stop all board simulations"""
        print("Stopping all simulations...")
        for simulator in self.simulators:
            simulator.stop_simulation()
    
    def run_simulation(self, duration_minutes=60):
        """Run the simulation for a specified duration"""
        if self.start_all_simulations() > 0:
            try:
                print(f"Simulation running for {duration_minutes} minutes...")
                print("Press Ctrl+C to stop early")
                time.sleep(duration_minutes * 60)
            except KeyboardInterrupt:
                print("\nStopping simulation...")
            finally:
                self.stop_all_simulations()
        else:
            print("No simulations started successfully")

def test_game_status():
    """Test the game status endpoint"""
    try:
        response = requests.get(f"{COREAPI_URL}/game/status")
        if response.status_code == 200:
            data = response.json()
            print("\n=== Game Status ===")
            print(f"Game Active: {data.get('game_active', False)}")
            print(f"Current Round: {data.get('current_round', 0)}")
            print(f"Total Rounds: {data.get('total_rounds', 0)}")
            print(f"Round Type: {data.get('round_type', 'N/A')}")
            print(f"Registered Boards: {data.get('boards', 0)}")
        else:
            print(f"Failed to get game status: {response.status_code}")
    except Exception as e:
        print(f"Error getting game status: {e}")

def main():
    """Main function"""
    print("Board Simulation Test Script")
    print("=" * 50)
    
    # Test game status first
    test_game_status()
    
    # Create and run simulation
    simulation = GameSimulation()
    simulation.create_test_boards()
    
    print(f"\nCreated {len(simulation.simulators)} board simulators:")
    for sim in simulation.simulators:
        print(f"  - {sim.board_name} ({sim.board_type})")
    
    print("\nStarting simulation...")
    print("This will simulate realistic power generation and consumption patterns.")
    print("Solar panels will generate more during the day, factories will consume more during business hours, etc.")
    
    try:
        simulation.run_simulation(duration_minutes=30)  # Run for 30 minutes by default
    except Exception as e:
        print(f"Simulation error: {e}")
    
    print("Simulation complete")

if __name__ == "__main__":
    main()
