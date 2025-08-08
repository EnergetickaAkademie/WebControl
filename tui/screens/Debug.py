"""
Debug Screen
Displays current game state, production coefficients, weather data, and API polling status
"""

import json
from datetime import datetime
from textual.app import ComposeResult
from textual.containers import Container, VerticalScroll, Horizontal
from textual.widgets import Button, DataTable, Footer, Header, Static, Log
from textual.screen import Screen

from config import COREAPI_URL

class DebugScreen(Screen):
	"""Debug screen to monitor game state and API status."""
	
	def __init__(self, **kwargs):
		super().__init__(**kwargs)
		self.log_entries = []

	def compose(self) -> ComposeResult:
		yield Header("Debug Screen - Game State Monitor")
		with Container(id="debug_container"):
			with Horizontal():
				with VerticalScroll(id="left_panel"):
					yield Static("Production Coefficients", classes="debug_title")
					yield DataTable(id="coefficients_table")
					
					yield Static("Weather Data", classes="debug_title") 
					yield DataTable(id="weather_table")
					
					yield Static("Game Status", classes="debug_title")
					yield DataTable(id="game_status_table")
				
				with VerticalScroll(id="right_panel"):
					yield Static("API Call Log", classes="debug_title")
					yield Log(id="api_log", auto_scroll=True)
					
					yield Static("Controls", classes="debug_title")
					yield Button("Refresh Game State", id="refresh_button", variant="primary")
					yield Button("Test API Connection", id="test_api_button")
					yield Button("Clear Log", id="clear_log_button")
					yield Button("Back to Main Menu", id="back_button")
		yield Footer()

	def on_mount(self) -> None:
		# Set up tables
		coefficients_table = self.query_one("#coefficients_table", DataTable)
		coefficients_table.add_columns("Source Type", "Coefficient", "Last Updated")
		
		weather_table = self.query_one("#weather_table", DataTable)
		weather_table.add_columns("Weather Condition", "Active")
		
		game_status_table = self.query_one("#game_status_table", DataTable)
		game_status_table.add_columns("Property", "Value", "Last Updated")
		
		# Initial refresh
		self.refresh_all_data()
		
		# Set up auto-refresh every 5 seconds
		self.set_interval(5, self.refresh_all_data)

	def log_api_call(self, message: str):
		"""Log an API call with timestamp"""
		timestamp = datetime.now().strftime("%H:%M:%S")
		log_entry = f"[{timestamp}] {message}"
		self.log_entries.append(log_entry)
		
		api_log = self.query_one("#api_log", Log)
		api_log.write_line(log_entry)

	def refresh_all_data(self):
		"""Refresh all debug data"""
		self.log_api_call("Refreshing game state data...")
		
		# Import game state data with fallback and logging
		try:
			from tui.core.game_state import (
				GLOBAL_PRODUCTION_COEFFICIENTS, 
				GLOBAL_WEATHER, 
				GLOBAL_GAME_ACTIVE,
				fetch_global_game_state
			)
		except ImportError:
			try:
				from core.game_state import (
					GLOBAL_PRODUCTION_COEFFICIENTS, 
					GLOBAL_WEATHER, 
					GLOBAL_GAME_ACTIVE,
					fetch_global_game_state
				)
			except ImportError:
				self.log_api_call("ERROR: Could not import game state modules")
				return
		
		# Fetch latest data
		try:
			fetch_global_game_state()
			self.log_api_call(f"Game state fetched successfully from {COREAPI_URL}")
		except Exception as e:
			self.log_api_call(f"ERROR fetching game state: {e}")
		
		# Update coefficients table
		self.update_coefficients_table(GLOBAL_PRODUCTION_COEFFICIENTS)
		
		# Update weather table  
		self.update_weather_table(GLOBAL_WEATHER)
		
		# Update game status table
		self.update_game_status_table(GLOBAL_GAME_ACTIVE, GLOBAL_PRODUCTION_COEFFICIENTS, GLOBAL_WEATHER)

	def update_coefficients_table(self, coefficients):
		"""Update the production coefficients table"""
		table = self.query_one("#coefficients_table", DataTable)
		table.clear()
		
		timestamp = datetime.now().strftime("%H:%M:%S")
		
		if not coefficients:
			table.add_row("No coefficients", "N/A", timestamp)
			self.log_api_call("WARNING: No production coefficients found")
			return
		
		for source_type, coefficient in coefficients.items():
			display_name = source_type.replace('_', ' ').title()
			table.add_row(display_name, f"{coefficient:.3f}", timestamp)
		
		self.log_api_call(f"Updated {len(coefficients)} production coefficients")

	def update_weather_table(self, weather_data):
		"""Update the weather data table"""
		table = self.query_one("#weather_table", DataTable)
		table.clear()
		
		if not weather_data:
			table.add_row("No weather data", "N/A")
			self.log_api_call("WARNING: No weather data found")
			return
		
		for weather_condition in weather_data:
			table.add_row(weather_condition, "Active")
		
		self.log_api_call(f"Updated weather data: {', '.join(weather_data) if weather_data else 'None'}")

	def update_game_status_table(self, game_active, coefficients, weather):
		"""Update the game status table"""
		table = self.query_one("#game_status_table", DataTable)
		table.clear()
		
		timestamp = datetime.now().strftime("%H:%M:%S")
		
		# Game active status
		table.add_row("Game Active", "Yes" if game_active else "No", timestamp)
		
		# Coefficient count
		coeff_count = len(coefficients) if coefficients else 0
		table.add_row("Coefficient Count", str(coeff_count), timestamp)
		
		# Weather conditions count
		weather_count = len(weather) if weather else 0
		table.add_row("Weather Conditions", str(weather_count), timestamp)
		
		# API URL
		table.add_row("API URL", COREAPI_URL, timestamp)
		
		self.log_api_call(f"Game Active: {game_active}, Coefficients: {coeff_count}, Weather: {weather_count}")

	def test_api_connection(self):
		"""Test API connection"""
		self.log_api_call("Testing API connection...")
		
		try:
			import requests
			response = requests.get(f"{COREAPI_URL}/health", timeout=5)
			if response.status_code == 200:
				self.log_api_call(f"✓ API connection successful: {response.status_code}")
			else:
				self.log_api_call(f"⚠ API responded with status: {response.status_code}")
		except requests.exceptions.ConnectionError:
			self.log_api_call("✗ API connection failed: Connection refused")
		except requests.exceptions.Timeout:
			self.log_api_call("✗ API connection failed: Timeout")
		except Exception as e:
			self.log_api_call(f"✗ API connection failed: {e}")

	def on_button_pressed(self, event: Button.Pressed) -> None:
		if event.button.id == "refresh_button":
			self.refresh_all_data()
		elif event.button.id == "test_api_button":
			self.test_api_connection()
		elif event.button.id == "clear_log_button":
			api_log = self.query_one("#api_log", Log)
			api_log.clear()
			self.log_entries.clear()
			self.log_api_call("Log cleared")
		elif event.button.id == "back_button":
			self.app.pop_screen()
