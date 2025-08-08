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
from Enak import Building

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
		# Cache last known max production per source type (W, considering count)
		self._last_max_by_type: Dict[str, float] = {}
		
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
		"""Poll the board status using binary protocol and apply updates"""
		try:
			response = requests.get(f"{COREAPI_URL}/poll_binary",
							  headers=self.headers)
			if response.status_code != 200:
				self.log(f"[{self.board_name}] Poll failed: {response.status_code}")
				return False

			# Parse binary payload: prod coeffs + building consumptions
			from .game_state import unpack_coefficients_response, GLOBAL_PRODUCTION_COEFFICIENTS
			prod_coeffs_raw, cons_vals_raw = unpack_coefficients_response(response.content)

			# Map production coeffs (ids -> UPPER names) into global and local
			source_names = {
				1: "PHOTOVOLTAIC",
				2: "WIND",
				3: "NUCLEAR",
				4: "GAS",
				5: "HYDRO",
				6: "HYDRO_STORAGE",
				7: "COAL",
				8: "BATTERY",
			}
			# Update globals only if we actually received coefficients to avoid transient 0s
			if prod_coeffs_raw:
				GLOBAL_PRODUCTION_COEFFICIENTS.clear()
				for sid, coeff in prod_coeffs_raw.items():
					name = source_names.get(sid)
					if name:
						GLOBAL_PRODUCTION_COEFFICIENTS[name] = coeff

			# After coefficients changed, auto-adjust plant productions
			self._apply_production_coefficients()

			# Apply building consumption values to connected consumers (by Building enum id)
			if cons_vals_raw:
				self._apply_consumption_updates(cons_vals_raw)

			# Recompute totals after updates
			self.update_totals()
			return True
		except Exception as e:
			self.log(f"[{self.board_name}] Poll error: {e}")
			return False

	def _apply_consumption_updates(self, cons_vals_raw: Dict[int, float]) -> None:
		"""Update each connected consumer's consumption to current building value."""
		for cid, consumer in list(self.connected_consumers.items()):
			bname_upper = consumer.get("type", "").upper()
			try:
				# Map 'factory' -> Building.FACTORY, etc.
				building_id = getattr(Building, bname_upper).value if hasattr(Building, bname_upper) else None
			except Exception:
				building_id = None
			if building_id is None:
				continue
			if building_id in cons_vals_raw:
				consumer["consumption"] = float(cons_vals_raw[building_id])

	def _apply_production_coefficients(self) -> None:
		"""Auto-update source productions based on latest coefficients.
		- Weather-dependent sources (WIND, PHOTOVOLTAIC) track their max automatically.
		- Other sources are clamped to the new max if coefficients reduced it.
		"""
		for plant_type, pdata in list(self.sources.items()):
			_min, max_prod = self.get_power_plant_range(plant_type)
			ptype_upper = plant_type.upper()
			if ptype_upper in ("WIND", "PHOTOVOLTAIC"):
				pdata["set_production"] = max_prod
				# Cache for UI/range stability
				self._last_max_by_type[plant_type] = pdata["set_production"]
			else:
				# Clamp to new max if needed
				if pdata["set_production"] > max_prod:
					pdata["set_production"] = max_prod

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

		# Prefer cached server-provided max if available to avoid transient zeros
		if plant_type in self._last_max_by_type:
			cached_max = self._last_max_by_type[plant_type]
			self.log(f"[{self.board_name}] Power range for {plant_type} (cached): total_max={cached_max}")
			return (0.0, cached_max)

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
		last_ranges_fetch = 0.0
		last_cons_fetch = 0.0
		while self.running:
			try:
				now = time.time()
				# Poll binary frequently to keep coefficients and consumptions fresh
				self.poll_binary()

				# Periodically fetch production ranges to reflect master-board behavior
				if now - last_ranges_fetch > 5.0:
					self._fetch_and_apply_prod_ranges()
					last_ranges_fetch = now

				# Periodically fetch explicit consumption values (backup to poll_binary)
				if now - last_cons_fetch > 5.0:
					self._fetch_and_apply_consumptions()
					last_cons_fetch = now

				# Always send current totals
				self.send_power_data()
				
				time.sleep(1)
				
			except Exception as e:
				self.log(f"[{self.board_name}] Simulation error: {e}")
				self.status = "Error"
				time.sleep(2)

	def _fetch_and_apply_prod_ranges(self) -> None:
		"""Fetch production ranges and apply to weather-dependent plants; clamp others."""
		try:
			resp = requests.get(f"{COREAPI_URL}/prod_vals", headers=self.headers)
			if resp.status_code != 200:
				return
			data = resp.content
			offset = 0
			if len(data) < 1:
				return
			num_entries = data[offset]
			offset += 1
			# Each entry: source_id(1) + min(4) + max(4)
			for _ in range(num_entries):
				if offset + 9 > len(data):
					break
				source_id, min_mw, max_mw = struct.unpack('>Bii', data[offset:offset+9])
				offset += 9
				# Map id->name lower key used in sources dict
				name_map = {
					1: 'photovoltaic', 2: 'wind', 3: 'nuclear', 4: 'gas',
					5: 'hydro', 6: 'hydro_storage', 7: 'coal', 8: 'battery'
				}
				ptype = name_map.get(source_id)
				if not ptype or ptype not in self.sources:
					continue
				# Prefer server-provided max (converted from mW to W) per source
				server_max_per_source = max_mw / 1000.0
				instances = self.sources.get(ptype, {}).get('count', 0)
				calc_max = server_max_per_source * instances
				if ptype.upper() in ("WIND", "PHOTOVOLTAIC"):
					self.sources[ptype]['set_production'] = calc_max
				else:
					if self.sources[ptype]['set_production'] > calc_max:
						self.sources[ptype]['set_production'] = calc_max
			self.update_totals()
		except Exception as e:
			self.log(f"[{self.board_name}] prod_vals fetch error: {e}")

	def refresh_prod_ranges(self) -> None:
		"""Public method to refresh production ranges immediately."""
		self._fetch_and_apply_prod_ranges()

	def _fetch_and_apply_consumptions(self) -> None:
		"""Fetch explicit consumption values and update consumers."""
		try:
			resp = requests.get(f"{COREAPI_URL}/cons_vals", headers=self.headers)
			if resp.status_code != 200:
				return
			data = resp.content
			offset = 0
			if len(data) < 1:
				return
			count = data[offset]
			offset += 1
			cons_vals = {}
			for _ in range(count):
				if offset + 5 > len(data):
					break
				bid, cons_mw = struct.unpack('>Bi', data[offset:offset+5])
				offset += 5
				cons_vals[bid] = cons_mw / 1000.0
			self._apply_consumption_updates(cons_vals)
			self.update_totals()
		except Exception as e:
			self.log(f"[{self.board_name}] cons_vals fetch error: {e}")
	
	def stop(self):
		"""Stop the simulation"""
		if self.running:
			self.log(f"[{self.board_name}] Stopping simulation")
			self.running = False
			self.status = "Stopped"
