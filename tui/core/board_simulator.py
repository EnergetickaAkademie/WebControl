"""
ESP32 Board Simulator
Handles individual ESP32 board simulation and API communication
"""

import requests
import struct
import sys
import os
from typing import Dict, Any, Callable

from config import COREAPI_URL, POWER_PLANT_POWERS, CONSUMER_POWERS

# Import GLOBAL_PRODUCTION_COEFFICIENTS with path workaround
sys.path.insert(0, os.path.dirname(__file__))
try:
	from game_state import GLOBAL_PRODUCTION_COEFFICIENTS
except ImportError:
	# Fallback if module structure changes
	GLOBAL_PRODUCTION_COEFFICIENTS = {}

class ESP32BoardSimulator:
	def __init__(self, board_name: str, username: str, password: str, log_callback: Callable[[str], None]):
		self.board_name = board_name
		self.username = username
		self.password = password
		self.token = None
		self.headers = {}
		self.running = False
		self.log = log_callback
		
		# Simulation state
		self.status = "Stopped"
		self.production = 0.0
		self.consumption = 0.0
		self.sources: Dict[str, Dict[str, Any]] = {}
		self.connected_consumers: Dict[int, Dict[str, Any]] = {}
		self.next_consumer_id = 1
		
		# Game state
		self.production_coefficients = {}
		self.current_weather = []
		self.game_active = False

	def login(self) -> bool:
		"""Authenticate with the API and get JWT token"""
		try:
			self.status = "Logging in..."
			response = requests.post(f"{COREAPI_URL}/login", 
								   json={
									   'username': self.username,
									   'password': self.password
								   })
			
			if response.status_code == 200:
				data = response.json()
				self.token = data['token']
				self.headers = {'Authorization': f'Bearer {self.token}'}
				self.log(f"[{self.board_name}] Logged in successfully")
				self.status = "Logged in"
				return True
			else:
				self.log(f"[{self.board_name}] Login failed: {response.status_code}")
				self.status = "Login Failed"
				return False
				
		except Exception as e:
			self.log(f"[{self.board_name}] Login error: {e}")
			self.status = "Login Error"
			return False
	
	def register_board(self) -> bool:
		"""Register the board with the API using binary protocol"""
		try:
			self.status = "Registering..."
			response = requests.post(f"{COREAPI_URL}/register",
								   data=b'',  # Empty data - board ID extracted from JWT
								   headers={**self.headers, 'Content-Type': 'application/octet-stream'})
			
			if response.status_code == 200:
				self.log(f"[{self.board_name}] Board registered successfully")
				self.status = "Registered"
				return True
			else:
				self.log(f"[{self.board_name}] Registration failed: {response.status_code}")
				self.status = "Register Failed"
				return False
				
		except Exception as e:
			self.log(f"[{self.board_name}] Registration error: {e}")
			self.status = "Register Error"
			return False
	
	def poll_binary(self) -> bool:
		"""Poll the board status using binary protocol"""
		try:
			response = requests.get(f"{COREAPI_URL}/poll_binary",
								  headers=self.headers)
			
			if response.status_code == 200:
				return True
			else:
				self.log(f"[{self.board_name}] Poll failed: {response.status_code}")
				return False
				
		except Exception as e:
			self.log(f"[{self.board_name}] Poll error: {e}")
			return False

	def fetch_game_state(self) -> bool:
		"""Fetch current game state including production coefficients"""
		try:
			response = requests.get(f"{COREAPI_URL}/game/status",
								  headers=self.headers)
			
			if response.status_code == 200:
				data = response.json()
				self.game_active = data.get('game_active', False)
				return True
			else:
				self.log(f"[{self.board_name}] Game state fetch failed: {response.status_code}")
				return False
				
		except Exception as e:
			self.log(f"[{self.board_name}] Game state fetch error: {e}")
			return False
	
	def send_power_data(self) -> bool:
		"""Send power data using binary protocol (post_vals endpoint)"""
		try:
			prod_int = int(self.production * 1000)
			cons_int = int(self.consumption * 1000)
			
			data = struct.pack('>ii', prod_int, cons_int)
			
			response = requests.post(f"{COREAPI_URL}/post_vals",
								   data=data,
								   headers={**self.headers, 'Content-Type': 'application/octet-stream'})
			
			if response.status_code == 200:
				return True
			else:
				self.log(f"[{self.board_name}] Power data failed: {response.status_code}")
				return False
				
		except Exception as e:
			self.log(f"[{self.board_name}] Power data error: {e}")
			return False

	def report_connected_production(self) -> bool:
		"""Report connected power plants"""
		try:
			# Report total production using simplified approach
			# Since we're managing by source type, we just report the total
			response = requests.post(f"{COREAPI_URL}/post_vals",
								   data=struct.pack('>ii', int(self.production * 1000), int(self.consumption * 1000)),
								   headers={**self.headers, 'Content-Type': 'application/octet-stream'})
			
			if response.status_code == 200:
				self.log(f"[{self.board_name}] Reported total production: {self.production:.1f}W")
				return True
			else:
				self.log(f"[{self.board_name}] Production report failed: {response.status_code}")
				return False
				
		except Exception as e:
			self.log(f"[{self.board_name}] Production report error: {e}")
			return False

	def report_connected_consumption(self) -> bool:
		"""Report connected consumers"""
		try:
			consumer_ids = list(self.connected_consumers.keys())
			count = len(consumer_ids)
			data = struct.pack('B', count)
			
			for consumer_id in consumer_ids:
				data += struct.pack('>I', consumer_id)
			
			response = requests.post(f"{COREAPI_URL}/cons_connected",
								   data=data,
								   headers={**self.headers, 'Content-Type': 'application/octet-stream'})
			
			if response.status_code == 200:
				self.log(f"[{self.board_name}] Reported {count} connected consumers")
				return True
			else:
				self.log(f"[{self.board_name}] Consumption report failed: {response.status_code}")
				return False
				
		except Exception as e:
			self.log(f"[{self.board_name}] Consumption report error: {e}")
			return False

	def add_power_plant(self, plant_type: str):
		"""Add an instance of a power plant type."""
		if plant_type not in POWER_PLANT_POWERS:
			self.log(f"[{self.board_name}] Unknown plant type: {plant_type}")
			return
		
		if plant_type not in self.sources:
			self.sources[plant_type] = {"count": 0, "set_production": 0.0}
		
		self.sources[plant_type]["count"] += 1
		self.update_totals()
		self.report_connected_production()

	def remove_power_plant(self, plant_type: str):
		"""Remove one instance of a power plant type."""
		if plant_type in self.sources and self.sources[plant_type]["count"] > 0:
			self.sources[plant_type]["count"] -= 1
			
			# Also reduce set_production if it exceeds the new max
			_min, max_prod = self.get_power_plant_range(plant_type)
			if self.sources[plant_type]['set_production'] > max_prod:
				self.sources[plant_type]['set_production'] = max_prod

			if self.sources[plant_type]["count"] == 0:
				del self.sources[plant_type]
			
			self.update_totals()
			self.report_connected_production()

			self.update_totals()
			self.report_connected_production()

	def add_consumer(self, consumer_type: str):
		"""Add a consumer using config data"""
		if consumer_type not in CONSUMER_POWERS:
			self.log(f"[{self.board_name}] Unknown consumer type: {consumer_type}")
			return
		
		consumer_id = self.next_consumer_id
		base_consumption = CONSUMER_POWERS[consumer_type]
		self.connected_consumers[consumer_id] = {"type": consumer_type, "consumption": base_consumption}
		self.next_consumer_id += 1
		self.update_totals()
		self.report_connected_consumption()

	def remove_consumer(self, consumer_id: int):
		if consumer_id in self.connected_consumers:
			del self.connected_consumers[consumer_id]
			self.update_totals()
			self.report_connected_consumption()

	def set_source_type_production(self, plant_type: str, new_production: float):
		"""Set the total production value for a given source type."""
		if plant_type in self.sources:
			self.sources[plant_type]["set_production"] = new_production
			self.update_totals()
			self.report_connected_production()

	def update_production_coefficients(self):
		"""Update the board's production coefficients from the global state."""
		from .game_state import GLOBAL_PRODUCTION_COEFFICIENTS
		self.production_coefficients = GLOBAL_PRODUCTION_COEFFICIENTS
		self.log(f"[{self.board_name}] Updated local coefficients: {self.production_coefficients}")

	def get_power_plant_range(self, plant_type: str) -> tuple:
		"""Get the min/max range for a power plant type based on count and coefficients."""
		self.update_production_coefficients()

		if plant_type not in self.sources:
			return (0.0, 0.0)

		base_max = POWER_PLANT_POWERS.get(plant_type, 0.0)
		count = self.sources[plant_type].get("count", 0)
		base_min = 0.0
		
		coefficient = self.production_coefficients.get(plant_type.upper(), 0.0)
		
		total_max = base_max * count * coefficient
		total_min = base_min * count * coefficient

		self.log(f"[{self.board_name}] Power range for {plant_type}: base_max={base_max}, count={count}, coefficient={coefficient}, total_max={total_max}")

		return (total_min, total_max)

	def update_totals(self):
		self.production = sum(s["set_production"] for s in self.sources.values())
		self.consumption = sum(c["consumption"] for c in self.connected_consumers.values())

	def simulate_board_operation(self):
		"""Main simulation loop"""
		import time
		
		self.log(f"[{self.board_name}] Starting board simulation")
		
		if not self.login():
			self.stop()
			return
		
		if not self.register_board():
			self.stop()
			return
			
		self.status = "Running"
		self.running = True
		while self.running:
			try:
				# Fetch game state periodically
				self.fetch_game_state()
				
				if self.poll_binary():
					if self.send_power_data():
						pass
				
				time.sleep(2)
				
			except Exception as e:
				self.log(f"[{self.board_name}] Simulation error: {e}")
				self.status = "Error"
				time.sleep(2)
	
	def stop(self):
		"""Stop the simulation"""
		if self.running:
			self.log(f"[{self.board_name}] Stopping simulation")
			self.running = False
			self.status = "Stopped"
