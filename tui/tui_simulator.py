#!/usr/bin/env python3
"""
ESP32 Board Simulator TUI
A modular terminal user interface for ESP32 board simulation management.
"""

import requests
import struct
import time
import threading
from typing import Dict, Any, Callable

from textual.app import App, ComposeResult
from textual.containers import Container, VerticalScroll, Horizontal
from textual.widgets import Button, DataTable, Footer, Header, Static, Log, Select, Input, Label
from textual.screen import Screen
from textual.widgets._data_table import CellDoesNotExist

from config import (
	COREAPI_URL, AVAILABLE_POWER_PLANTS, AVAILABLE_CONSUMERS, 
	BOARDS, POWER_PLANT_POWERS, CONSUMER_POWERS
)

# Import ESP32BoardSimulator with path workaround
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'core'))
try:
	from board_simulator import ESP32BoardSimulator
except ImportError:
	# Fallback - define a placeholder class
	class ESP32BoardSimulator:
		def __init__(self, *args, **kwargs):
			pass

# ============================================================================
# GLOBAL GAME STATE MODULE
# ============================================================================

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
		response = requests.post(f"{COREAPI_URL}/login", 
							   json={
								   'username': 'lecturer',
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

def unpack_coefficients_response(data: bytes) -> tuple:
	"""Unpack production and consumption coefficients from binary response"""
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
					log_file.write(f"poll_binary Response Length: {len(response.content)} bytes\n")

				if response.status_code == 200:
					data = response.content
					production_coeffs, consumption_coeffs = unpack_coefficients_response(data)
					
					# Convert source IDs to string names for compatibility
					source_names = {
						1: "PHOTOVOLTAIC", 2: "WIND", 3: "NUCLEAR", 4: "GAS",
						5: "HYDRO", 6: "HYDRO_STORAGE", 7: "COAL", 8: "BATTERY"
					}
					
					GLOBAL_PRODUCTION_COEFFICIENTS = {}
					for source_id, coeff in production_coeffs.items():
						if source_id in source_names:
							GLOBAL_PRODUCTION_COEFFICIENTS[source_names[source_id]] = coeff

					with open("tui.log", "a") as log_file:
						log_file.write(f"Unpacked coefficients: {production_coeffs}\n")
						log_file.write(f"Global coefficients: {GLOBAL_PRODUCTION_COEFFICIENTS}\n")
					
					GLOBAL_WEATHER = []
					GLOBAL_GAME_ACTIVE = len(production_coeffs) > 0
					return True
				else:
					with open("tui.log", "a") as log_file:
						log_file.write(f"poll_binary failed for {board.board_name}: {response.status_code}\n")
						
			except Exception as e:
				with open("tui.log", "a") as log_file:
					log_file.write(f"poll_binary error for {board.board_name}: {e}\n")
	
	# Fallback: set empty coefficients
	GLOBAL_PRODUCTION_COEFFICIENTS = {}
	GLOBAL_WEATHER = []
	GLOBAL_GAME_ACTIVE = False
	
	with open("tui.log", "a") as log_file:
		log_file.write(f"No valid board tokens available\n")
	
	return False

try:
	from .screens import (
		ManageSourcesScreen,
		ManagePowerPlantsScreen, 
		PowerInputScreen,
		SetProductionScreen,
		ControlPanel,
		DebugScreen
	)
	
except ImportError:
	class ManageSourcesScreen(Screen):
		def __init__(self, board, **kwargs):
			super().__init__(**kwargs)
			self.board = board
		def compose(self) -> ComposeResult:
			yield Header("Buildings Management - Placeholder")
			yield Static("This screen is being modularized. Please use the main menu.")
			yield Button("Back", id="back")
		def on_button_pressed(self, event):
			if event.button.id == "back":
				self.app.pop_screen()
	
	class ManagePowerPlantsScreen(Screen):
		def __init__(self, board, **kwargs):
			super().__init__(**kwargs)
			self.board = board
		def compose(self) -> ComposeResult:
			yield Header("Power Plants Management - Placeholder")
			yield Static("This screen is being modularized. Please use the main menu.")
			yield Button("Back", id="back")
		def on_button_pressed(self, event):
			if event.button.id == "back":
				self.app.pop_screen()
	
	class SetProductionScreen(Screen):
		def __init__(self, board, **kwargs):
			super().__init__(**kwargs)
			self.board = board
		def compose(self) -> ComposeResult:
			yield Header("Production Management - Placeholder")
			yield Static("This screen is being modularized. Please use the main menu.")
			yield Button("Back", id="back")
		def on_button_pressed(self, event):
			if event.button.id == "back":
				self.app.pop_screen()
	
	class PowerInputScreen(Screen):
		def __init__(self, board, plant_type, current_value, min_val, max_val, **kwargs):
			super().__init__(**kwargs)
			self.board = board
		def compose(self) -> ComposeResult:
			yield Header("Power Input - Placeholder")
			yield Static("This dialog is being modularized.")
			yield Button("Back", id="back")
		def on_button_pressed(self, event):
			if event.button.id == "back":
				self.app.pop_screen()
	
	class ControlPanel(Screen):
		def __init__(self, board, **kwargs):
			super().__init__(**kwargs)
			self.board = board
		def compose(self) -> ComposeResult:
			yield Header("Control Panel - Placeholder")
			yield Static("This screen is being modularized.")
			yield Button("Back", id="back")
		def on_button_pressed(self, event):
			if event.button.id == "back":
				self.app.pop_screen()
	
	class DebugScreen(Screen):
		def __init__(self, **kwargs):
			super().__init__(**kwargs)
		def compose(self) -> ComposeResult:
			yield Header("Debug Screen - Placeholder")
			yield Static("This debug screen is being modularized.")
			yield Button("Back", id="back")
		def on_button_pressed(self, event):
			if event.button.id == "back":
				self.app.pop_screen()

class BoardSimTUI(App):
	"""A Textual app to manage ESP32 board simulations."""

	CSS_PATH = "tui_simulator.css"
	BINDINGS = [("d", "toggle_dark", "Toggle dark mode"), ("q", "quit", "Quit")]

	def __init__(self, **kwargs):
		super().__init__(**kwargs)
		self.boards = []
		self.threads = []

	def compose(self) -> ComposeResult:
		"""Create child widgets for the app."""
		yield Header("ESP32 Board Simulator")
		with Container():
			yield DataTable(id="board_status")
			with Horizontal(id="controls"):
				yield Button("Start All", id="start_all", variant="success")
				yield Button("Stop All", id="stop_all", variant="error")
			yield Log(id="log")
		yield Footer()

	def on_mount(self) -> None:
		"""Called when the app is mounted."""
		table = self.query_one(DataTable)
		table.add_columns("Board Name", "Status", "Production (W)", "Consumption (W)", "Consumers", "Sources", "Production")
		
		log = self.query_one("#log", Log)
		
		self.boards = [
			ESP32BoardSimulator(
				board_name=board_config["name"],
				username=board_config["username"],
				password=board_config["password"],
				log_callback=log.write_line
			) for board_config in BOARDS
		]
		
		# Make boards available to fetch_global_game_state function
		fetch_global_game_state.boards = self.boards
		
		for i, board in enumerate(self.boards):
			table.add_row(
				board.board_name,
				board.status,
				f"{board.production:.1f}",
				f"{board.consumption:.1f}",
				"Manage",
				"Manage", 
				"Set",
				key=str(i)
			)

		self.set_interval(1, self.update_table)

	def update_table(self) -> None:
		"""Update the board status table."""
		table = self.query_one(DataTable)
		for i, board in enumerate(self.boards):
			row_key = str(i)
			try:
				table.update_cell(row_key, "Status", board.status)
				table.update_cell(row_key, "Production (W)", f"{board.production:.1f}")
				table.update_cell(row_key, "Consumption (W)", f"{board.consumption:.1f}")
			except CellDoesNotExist:
				# The cell may not be ready yet, just skip the update for this cycle
				pass

	def on_button_pressed(self, event: Button.Pressed) -> None:
		"""Event handler called when a button is pressed."""
		if event.button.id == "start_all":
			self.start_all_simulations()
		elif event.button.id == "stop_all":
			self.stop_all_simulations()

	def on_data_table_cell_selected(self, event) -> None:
		"""Event handler called when a DataTable cell is selected."""
		table = event.data_table
		board_index = int(event.coordinate.row)
		
		log = self.query_one(Log)
		log.write_line(f"Main table cell clicked: row={board_index}, column={event.coordinate.column}")
		
		if board_index < len(self.boards):
			selected_board = self.boards[board_index]
			
			# Check if board is ready
			if not selected_board.running:
				selected_board.log(f"[{selected_board.board_name}] Please start the simulation first.")
				return
			if selected_board.status not in ["Registered", "Running"]:
				selected_board.log(f"[{selected_board.board_name}] Board not ready. Status: {selected_board.status}")
				return
			
			# Handle different column clicks
			if event.coordinate.column == 4:  # Consumers
				log.write_line(f"Opening Manage Buildings screen for {selected_board.board_name}")
				self.push_screen(ManageSourcesScreen(selected_board))
			elif event.coordinate.column == 5:  # Sources
				log.write_line(f"Opening Manage Sources screen for {selected_board.board_name}")
				self.push_screen(ManagePowerPlantsScreen(selected_board))
			elif event.coordinate.column == 6:  # Production
				log.write_line(f"Opening Manage Production screen for {selected_board.board_name}")
				self.push_screen(SetProductionScreen(selected_board))
			else:
				log.write_line(f"Clicked on non-actionable column {event.coordinate.column}")

	def start_all_simulations(self):
		"""Start all board simulations."""
		log = self.query_one(Log)
		log.write_line("Starting all simulations...")
		for board in self.boards:
			if not board.running:
				thread = threading.Thread(target=board.simulate_board_operation)
				thread.daemon = True
				self.threads.append(thread)
				thread.start()
	
	def stop_all_simulations(self):
		"""Stop all board simulations."""
		log = self.query_one(Log)
		log.write_line("Stopping all simulations...")
		for board in self.boards:
			board.stop()
		
		for thread in self.threads:
			if thread.is_alive():
				thread.join(timeout=1.0)
		self.threads = []
		log.write_line("All simulations stopped.")

	def action_toggle_dark(self) -> None:
		"""An action to toggle dark mode."""
		self.dark = not self.dark

if __name__ == "__main__":
	app = BoardSimTUI()
	app.run()
