"""
Buildings Management Screen
Manages energy consumers (buildings) for ESP32 boards
"""

from textual.app import ComposeResult
from textual.containers import Container, VerticalScroll
from textual.widgets import Button, DataTable, Footer, Header, Static, Select, Label
from textual.screen import Screen

from config import AVAILABLE_CONSUMERS

class ManageSourcesScreen(Screen):
	"""Screen to manage buildings (energy consumers) for a board."""
	
	def __init__(self, board, **kwargs):
		super().__init__(**kwargs)
		self.board = board

	def compose(self) -> ComposeResult:
		yield Header(f"Manage Buildings - {self.board.board_name}")
		with Container(id="main_container"):
			with VerticalScroll(id="left_panel"):
				yield Static("Energy Consumers", classes="title")
				yield Label("Total Consumption: 0.0 W", id="total_consumption")
				yield Select([(name, key) for key, name in AVAILABLE_CONSUMERS.items()], 
							id="add_consumer_select", prompt="Add Consumer")
				yield DataTable(id="consumers_table")
				yield Button("Back to Main Menu", id="back_button")

			with VerticalScroll(id="right_panel"):
				yield Static("Game State", classes="title")
				yield Label("Game Active: No", id="game_status")
				yield Label("Weather: -", id="weather_status")
				
				yield Static("Production Coefficients", classes="title")
				yield DataTable(id="coefficients_table")
				
		yield Footer()

	def on_mount(self) -> None:
		consumers_table = self.query_one("#consumers_table", DataTable)
		consumers_table.add_columns("ID", "Type", "Consumption (W)", "Action")
		
		coefficients_table = self.query_one("#coefficients_table", DataTable)
		coefficients_table.add_columns("Source Type", "Coefficient")
		
		self.update_tables()
		self.update_coefficients_table()
		self.set_interval(1, self.update_display)
		self.set_interval(5, self.update_game_state_display)

	def update_tables(self):
		consumers_table = self.query_one("#consumers_table", DataTable)
		consumers_table.clear()
		for id, consumer in self.board.connected_consumers.items():
			display_name = AVAILABLE_CONSUMERS.get(consumer["type"], 
												  consumer["type"].replace("_", " ").title())
			consumers_table.add_row(str(id), display_name, f"{consumer['consumption']:.1f}", 
								   "Remove", key=f"consumer_{id}")

	def update_coefficients_table(self):
		"""Update the production coefficients table"""
		# Import here to avoid circular imports
		import sys
		import os
		sys.path.append(os.path.dirname(os.path.dirname(__file__)))
		from tui_simulator import GLOBAL_PRODUCTION_COEFFICIENTS
		
		coefficients_table = self.query_one("#coefficients_table", DataTable)
		coefficients_table.clear()
		
		for source_type, coefficient in GLOBAL_PRODUCTION_COEFFICIENTS.items():
			display_name = source_type.replace('_', ' ').title()
			coefficients_table.add_row(display_name, f"{coefficient:.2f}")

	def update_display(self):
		self.update_tables()
		total_consumption = sum(c['consumption'] for c in self.board.connected_consumers.values())
		self.query_one("#total_consumption", Label).renderable = f"Total Consumption: {total_consumption:.1f} W"

	def update_game_state_display(self):
		"""Update game state information"""
		# Import here to avoid circular imports
		import sys
		import os
		sys.path.append(os.path.dirname(os.path.dirname(__file__)))
		from tui_simulator import (GLOBAL_PRODUCTION_COEFFICIENTS, GLOBAL_WEATHER, 
								  GLOBAL_GAME_ACTIVE, fetch_global_game_state)
		
		fetch_global_game_state()
		
		game_status = "Yes" if GLOBAL_GAME_ACTIVE else "No"
		self.query_one("#game_status", Label).renderable = f"Game Active: {game_status}"
		
		weather_text = ", ".join(GLOBAL_WEATHER) if GLOBAL_WEATHER else "-"
		self.query_one("#weather_status", Label).renderable = f"Weather: {weather_text}"
		
		self.update_coefficients_table()

	def on_select_changed(self, event: Select.Changed):
		if event.select.id == "add_consumer_select":
			if event.value and event.value in AVAILABLE_CONSUMERS:
				self.board.add_consumer(event.value)
				self.update_tables()
				event.control.clear()

	def on_button_pressed(self, event: Button.Pressed):
		if event.button.id == "back_button":
			self.app.pop_screen()

	def on_data_table_cell_selected(self, event) -> None:
		table_id = event.data_table.id
		if table_id == "consumers_table" and event.coordinate.column == 3:  # Action column
			row_key = event.cell_key.row_key.value
			if row_key and row_key.startswith("consumer_"):
				consumer_id = int(row_key.split("_")[1])
				self.board.remove_consumer(consumer_id)
				self.update_tables()
