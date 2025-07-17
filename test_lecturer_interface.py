#!/usr/bin/env python3
"""
Test script for the lecturer/frontend API endpoints
Tests the new scenario-based game management system
"""

import requests
import time
import json
import sys

BASE_URL = "http://localhost"
COREAPI_URL = f"{BASE_URL}/coreapi"

class LecturerInterface:
    """Test interface for lecturer API endpoints"""
    
    def __init__(self, username: str, password: str):
        self.username = username
        self.password = password
        self.token = None
        self.headers = {}
    
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
                print(f"✅ Login successful as {data['name']} ({data['user_type']})")
                return True
            else:
                print(f"❌ Login failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Login error: {e}")
            return False
    
    def get_scenarios(self):
        """Test /scenarios endpoint"""
        print("\n🎯 Testing /scenarios endpoint...")
        try:
            response = requests.get(f"{COREAPI_URL}/scenarios", headers=self.headers)
            
            if response.status_code == 200:
                data = response.json()
                scenarios = data.get('scenarios', [])
                print(f"✅ Available scenarios: {len(scenarios)}")
                for scenario in scenarios:
                    print(f"   - ID: {scenario['id']}, Name: {scenario['name']}")
                return scenarios
            else:
                print(f"❌ Failed to get scenarios: {response.status_code}")
                return []
                
        except Exception as e:
            print(f"❌ Error getting scenarios: {e}")
            return []
    
    def start_game(self, scenario_id: int):
        """Test /start_game endpoint"""
        print(f"\n🚀 Testing /start_game with scenario {scenario_id}...")
        try:
            response = requests.post(f"{COREAPI_URL}/start_game", 
                                   json={"scenario_id": scenario_id},
                                   headers=self.headers)
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Game started: {data['message']}")
                print(f"   Started by: {data['started_by']}")
                return True
            else:
                print(f"❌ Failed to start game: {response.status_code}")
                if response.headers.get('content-type', '').startswith('application/json'):
                    error_data = response.json()
                    print(f"   Error: {error_data.get('error', 'Unknown error')}")
                return False
                
        except Exception as e:
            print(f"❌ Error starting game: {e}")
            return False
    
    def get_pdf(self):
        """Test /get_pdf endpoint"""
        print("\n📄 Testing /get_pdf endpoint...")
        try:
            response = requests.get(f"{COREAPI_URL}/get_pdf", headers=self.headers)
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ PDF URL: {data['url']}")
                return data['url']
            else:
                print(f"❌ Failed to get PDF: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"❌ Error getting PDF: {e}")
            return None
    
    def next_round(self):
        """Test /next_round endpoint"""
        print("\n⏭️ Testing /next_round endpoint...")
        try:
            response = requests.post(f"{COREAPI_URL}/next_round", headers=self.headers)
            
            if response.status_code == 200:
                data = response.json()
                if data['status'] == 'success':
                    print(f"✅ Advanced to round {data['round']}")
                    print(f"   Advanced by: {data['advanced_by']}")
                elif data['status'] == 'game_finished':
                    print(f"🏁 Game finished: {data['message']}")
                    print(f"   Finished by: {data['finished_by']}")
                return True
            else:
                print(f"❌ Failed to advance round: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Error advancing round: {e}")
            return False
    
    def get_statistics(self):
        """Test /get_statistics endpoint"""
        print("\n📊 Testing /get_statistics endpoint...")
        try:
            response = requests.get(f"{COREAPI_URL}/get_statistics", headers=self.headers)
            
            if response.status_code == 200:
                data = response.json()
                statistics = data.get('statistics', [])
                game_status = data.get('game_status', {})
                
                print(f"✅ Statistics for {len(statistics)} boards:")
                print(f"   Game Status: Round {game_status.get('current_round', 0)}/{game_status.get('total_rounds', 0)}")
                print(f"   Active: {game_status.get('game_active', False)}")
                print(f"   Scenario: {game_status.get('scenario', 'None')}")
                
                for board in statistics:
                    print(f"   Board {board['board_id']} ({board['board_name']}):")
                    print(f"     - Generation: {board['current_generation']}W")
                    print(f"     - Consumption: {board['current_consumption']}W")
                    print(f"     - Score: {board['total_score']}")
                    print(f"     - Connected Power Plants: {board['connected_power_plants']}")
                    print(f"     - Connected Consumers: {board['connected_consumers']}")
                
                return statistics
            else:
                print(f"❌ Failed to get statistics: {response.status_code}")
                return []
                
        except Exception as e:
            print(f"❌ Error getting statistics: {e}")
            return []
    
    def end_game(self):
        """Test /end_game endpoint"""
        print("\n🔚 Testing /end_game endpoint...")
        try:
            response = requests.post(f"{COREAPI_URL}/end_game", headers=self.headers)
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Game ended: {data['message']}")
                print(f"   Ended by: {data['ended_by']}")
                return True
            else:
                print(f"❌ Failed to end game: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Error ending game: {e}")
            return False
    
    def run_full_test(self):
        """Run complete test of lecturer interface"""
        print("🧪 Starting lecturer interface test...")
        print("=" * 60)
        
        # Step 1: Login
        if not self.login():
            return False
        
        # Step 2: Get scenarios
        scenarios = self.get_scenarios()
        if not scenarios:
            print("❌ No scenarios available")
            return False
        
        # Step 3: Start game with first scenario
        first_scenario_id = scenarios[0]['id']
        if not self.start_game(first_scenario_id):
            return False
        
        # Step 4: Get PDF
        self.get_pdf()
        
        # Step 5: Wait a bit for boards to connect
        print("\n⏳ Waiting 3 seconds for boards to connect...")
        time.sleep(3)
        
        # Step 6: Get statistics
        self.get_statistics()
        
        # Step 7: Advance a couple of rounds
        for i in range(3):
            print(f"\n⏳ Waiting 2 seconds before advancing round {i+1}...")
            time.sleep(2)
            if not self.next_round():
                break
            self.get_statistics()
        
        # Step 8: End game
        self.end_game()
        
        print("\n✅ Lecturer interface test completed!")
        return True

def main():
    print("👨‍🏫 Lecturer Interface Test")
    print("=" * 60)
    
    # Test with lecturer account
    lecturer = LecturerInterface("lecturer1", "lecturer123")
    
    try:
        lecturer.run_full_test()
    except KeyboardInterrupt:
        print("\n🛑 Test stopped by user")
        lecturer.end_game()

if __name__ == "__main__":
    main()
