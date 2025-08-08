import requests
import struct
from datetime import datetime

from config import COREAPI_URL

# Global game state variables
GLOBAL_PRODUCTION_COEFFICIENTS = {}
GLOBAL_WEATHER = []
GLOBAL_GAME_ACTIVE = False
LECTURER_TOKEN = None
LECTURER_HEADERS = {}

def get_lecturer_token():
	"""Get lecturer authentication token"""
	global LECTURER_TOKEN, LECTURER_HEADERS
	
	if LECTURER_TOKEN:
		return LECTURER_TOKEN
	
	try:
		# Try logging in as a lecturer (first board credentials should work)
		response = requests.post(f"{COREAPI_URL}/login", 
							   json={
								   'username': 'lecturer',  # Default lecturer account
								   'password': 'password123'
							   })
		
		print(f"Lecturer login response status: {response.status_code}")
		print(f"Lecturer login response text: {response.text}")
		
		if response.status_code == 200:
			data = response.json()
			LECTURER_TOKEN = data['token']
			LECTURER_HEADERS = {'Authorization': f'Bearer {LECTURER_TOKEN}'}
			print(f"Lecturer login successful, token: {LECTURER_TOKEN[:20]}...")
			return LECTURER_TOKEN
		else:
			print(f"Lecturer login failed: {response.status_code}")
			return None
			
	except Exception as e:
		print(f"Lecturer login error: {e}")
		return None

def fetch_global_game_state():
	"""Fetch global game state from API using poll_binary endpoint"""
	global GLOBAL_PRODUCTION_COEFFICIENTS, GLOBAL_WEATHER, GLOBAL_GAME_ACTIVE

	with open("tui.log", "a") as log_file:
		log_file.write(f"DEBUG: Fetching global game state\n")

	for board in getattr(fetch_global_game_state, 'boards', []):
		if board.token and board.headers:
			try:
				response = requests.get(f"{COREAPI_URL}/poll_binary", headers=board.headers)
				
				with open("tui.log", "a") as log_file:
					log_file.write(f"poll_binary API Response Status: {response.status_code}\n")
					log_file.write(f"poll_binary API Response Headers: {response.headers}\n")
					log_file.write(f"poll_binary Response Length: {len(response.content)} bytes\n")

				if response.status_code == 200:
					# Unpack binary coefficients response
					data = response.content
					production_coeffs, consumption_coeffs = unpack_coefficients_response(data)
					
					with open('tui.log', 'a') as log_file:
						log_file.write(f"[{datetime.now()}] Parsed production coefficients: {production_coeffs}\n")
						log_file.write(f"[{datetime.now()}] Parsed consumption coefficients: {consumption_coeffs}\n")
					
					# Convert source IDs to string names for compatibility
					source_names = {
						1: "PHOTOVOLTAIC",
						2: "WIND", 
						3: "NUCLEAR",
						4: "GAS",
						5: "HYDRO",
						6: "HYDRO_STORAGE",
						7: "COAL",
						8: "BATTERY"
					}
					
					GLOBAL_PRODUCTION_COEFFICIENTS = {}
					for source_id, coeff in production_coeffs.items():
						if source_id in source_names:
							GLOBAL_PRODUCTION_COEFFICIENTS[source_names[source_id]] = coeff

					with open("tui.log", "a") as log_file:
						log_file.write(f"[{datetime.now()}] Unpacked production coefficients: {production_coeffs}\n")
						log_file.write(f"[{datetime.now()}] Converted to GLOBAL_PRODUCTION_COEFFICIENTS: {GLOBAL_PRODUCTION_COEFFICIENTS}\n")
						log_file.write(f"[{datetime.now()}] Unpacked consumption coefficients: {consumption_coeffs}\n")
						log_file.write(f"[{datetime.now()}] Total coefficients count: {len(GLOBAL_PRODUCTION_COEFFICIENTS)}\n")
					
					# Set other defaults since we don't have weather/game status from this endpoint
					GLOBAL_WEATHER = []
					GLOBAL_GAME_ACTIVE = len(production_coeffs) > 0  # Assume game is active if we have coefficients

					return True
				else:
					with open("tui.log", "a") as log_file:
						log_file.write(f"poll_binary failed for board {board.board_name}: {response.status_code}\n")
						
			except Exception as e:
				with open("tui.log", "a") as log_file:
					log_file.write(f"poll_binary error for board {board.board_name}: {e}\n")
	
	# Fallback: set empty coefficients
	GLOBAL_PRODUCTION_COEFFICIENTS = {}
	GLOBAL_WEATHER = []
	GLOBAL_GAME_ACTIVE = False
	
	with open("tui.log", "a") as log_file:
		log_file.write(f"No valid board tokens available, setting empty coefficients\n")
	
	return False

def unpack_coefficients_response(data: bytes) -> tuple:
	"""
	Unpack production and consumption coefficients from binary response
	Format: prod_count(1) + [source_id(1) + coeff(4)]* + cons_count(1) + [building_id(1) + consumption(4)]*
	"""
	import struct
	
	if len(data) < 2:
		return {}, {}
	
	offset = 0
	
	# Unpack production coefficients
	prod_count = data[offset]
	offset += 1
	
	production_coeffs = {}
	for i in range(prod_count):
		if offset + 5 > len(data):
			break
		source_id, coeff_mw = struct.unpack('>Bi', data[offset:offset+5])
		production_coeffs[source_id] = coeff_mw / 1000.0  # Convert from mW to W
		offset += 5
	
	# Unpack consumption coefficients
	if offset >= len(data):
		return production_coeffs, {}
	
	cons_count = data[offset]
	offset += 1
	
	consumption_coeffs = {}
	for i in range(cons_count):
		if offset + 5 > len(data):
			break
		building_id, cons_mw = struct.unpack('>Bi', data[offset:offset+5])
		consumption_coeffs[building_id] = cons_mw / 1000.0  # Convert from mW to W
		offset += 5
	
	return production_coeffs, consumption_coeffs
