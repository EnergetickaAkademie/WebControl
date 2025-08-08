#!/usr/bin/env python3
"""
Test script for the lecturer/frontend API endpoints
Tests the new scenario-based game management system
"""

import requests
import json
import time
from typing import Dict, Optional

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
            response = requests.post(f"{COREAPI_URL}/login", 
                                   json={
                                       'username': self.username,
                                       'password': self.password
                                   })
            
            if response.status_code == 200:
                data = response.json()
                self.token = data['token']
                self.headers = {'Authorization': f'Bearer {self.token}'}
                print(f"✅ Logged in as {data['username']} ({data['user_type']})")
                return True
            else:
                print(f"❌ Login failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Login error: {e}")
            return False
    
    def get_scenarios(self):
        """Get available scenarios"""
        try:
            response = requests.get(f"{COREAPI_URL}/scenarios", headers=self.headers)
            
            if response.status_code == 200:
                data = response.json()
                scenarios = data.get('scenarios', [])
                print(f"📋 Available scenarios: {list(scenarios)}")
                return scenarios
            else:
                print(f"❌ Get scenarios failed: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"❌ Get scenarios error: {e}")
            return None
    
    def start_game(self, scenario_id: str):
        """Start game with specific scenario"""
        try:
            response = requests.post(f"{COREAPI_URL}/start_game", 
                                   json={'scenario_id': scenario_id},
                                   headers=self.headers)
            
            if response.status_code == 200:
                data = response.json()
                print(f"🎮 Game started: {data.get('message')}")
                print(f"   Started by: {data.get('started_by')}")
                return True
            else:
                print(f"❌ Start game failed: {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data.get('error')}")
                except:
                    pass
                return False
                
        except Exception as e:
            print(f"❌ Start game error: {e}")
            return False
    
    def get_pdf(self):
        """Get PDF URL for current scenario"""
        try:
            response = requests.get(f"{COREAPI_URL}/get_pdf", headers=self.headers)
            
            if response.status_code == 200:
                data = response.json()
                url = data.get('url')
                print(f"📄 PDF URL: {url}")
                return url
            else:
                print(f"❌ Get PDF failed: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"❌ Get PDF error: {e}")
            return None
    
    def next_round(self):
        """Advance to next round"""
        try:
            response = requests.post(f"{COREAPI_URL}/next_round", headers=self.headers)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'success':
                    print(f"⏭️ Advanced to round {data.get('round')}")
                    print(f"   Advanced by: {data.get('advanced_by')}")
                    return True
                elif data.get('status') == 'game_finished':
                    print(f"🏁 Game finished: {data.get('message')}")
                    print(f"   Finished by: {data.get('finished_by')}")
                    return False
            else:
                print(f"❌ Next round failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Next round error: {e}")
            return False
    
    def get_statistics(self):
        """Get game statistics"""
        try:
            response = requests.get(f"{COREAPI_URL}/get_statistics", headers=self.headers)
            
            if response.status_code == 200:
                data = response.json()
                stats = data.get('statistics', [])
                game_status = data.get('game_status', {})
                
                print(f"📊 Game Statistics:")
                print(f"   Current Round: {game_status.get('current_round', 0)}")
                print(f"   Total Rounds: {game_status.get('total_rounds', 0)}")
                print(f"   Game Active: {game_status.get('game_active', False)}")
                print(f"   Scenario: {game_status.get('scenario', 'None')}")
                
                for stat in stats:
                    print(f"   Board {stat.get('board_id')}: "
                          f"Prod={stat.get('current_production', 0)}W, "
                          f"Cons={stat.get('current_consumption', 0)}W, "
                          f"History={len(stat.get('production_history', []))} entries")
                
                return data
            else:
                print(f"❌ Get statistics failed: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"❌ Get statistics error: {e}")
            return None
    
    def end_game(self):
        """End the current game"""
        try:
            response = requests.post(f"{COREAPI_URL}/end_game", headers=self.headers)
            
            if response.status_code == 200:
                data = response.json()
                print(f"🛑 Game ended: {data.get('message')}")
                print(f"   Ended by: {data.get('ended_by')}")
                return True
            else:
                print(f"❌ End game failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ End game error: {e}")
            return False
    
    def run_full_test(self):
        """Run a complete test sequence"""
        print("\n🧪 Running full lecturer interface test...")
        
        # 1. Get available scenarios
        scenarios = self.get_scenarios()
        if not scenarios:
            print("❌ Cannot proceed without scenarios")
            return
        
        # 2. Start a game with the first scenario
        first_scenario = list(scenarios)[0] if scenarios else "demo"
        print(f"\n📅 Starting game with scenario: {first_scenario}")
        if not self.start_game(first_scenario):
            print("❌ Cannot start game")
            return
        
        # 3. Get PDF
        print(f"\n📄 Getting PDF...")
        self.get_pdf()
        
        # 4. Get initial statistics
        print(f"\n📊 Getting initial statistics...")
        self.get_statistics()
        
        # 5. Wait a bit for boards to connect (if running)
        print(f"\n⏳ Waiting 5 seconds for any board connections...")
        time.sleep(5)
        
        # 6. Advance a few rounds
        for i in range(3):
            print(f"\n⏭️ Advancing to next round (attempt {i+1})...")
            if not self.next_round():
                break
            time.sleep(2)
            
            # Get statistics after each round
            print(f"📊 Statistics after round advance:")
            self.get_statistics()
        
        # 7. End the game
        print(f"\n🛑 Ending game...")
        self.end_game()
        
        print(f"\n✅ Full test completed!")


def main():
    print("👨‍🏫 Lecturer Interface Test")
    print("=" * 60)
    
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
    
    # Test with lecturer account
    lecturer = LecturerInterface("lecturer1", "lecturer123")
    
    try:
        if lecturer.login():
            lecturer.run_full_test()
        else:
            print("❌ Cannot proceed without login")
            
    except KeyboardInterrupt:
        print("\n🛑 Test interrupted by user")
        print("✅ Test completed (interrupted)")


if __name__ == "__main__":
    main()
