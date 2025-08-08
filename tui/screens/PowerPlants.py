"""
Power Plants Management Screen
Manages energy sources (power plants) for ESP32 boards
"""

from textual.app import ComposeResult
from textual.containers import Container, VerticalScroll
from textual.widgets import Button, DataTable, Footer, Header, Static, Select, Label
from textual.screen import Screen

from config import AVAILABLE_POWER_PLANTS

class ManagePowerPlantsScreen(Screen):
	"""Screen to manage energy sources (power plants) for a board."""
	
	def __init__(self, board, **kwargs):
		super().__init__(**kwargs)
		self.board = board

	def compose(self) -> ComposeResult:
		yield Header(f"Manage Sources - {self.board.board_name}")
		with Container(id="main_container"):
			with VerticalScroll(id="left_panel"):
				yield Static("Energy Sources", classes="title")
				yield Select([(name, key) for key, name in AVAILABLE_POWER_PLANTS.items()], 
							id="add_plant_select", prompt="Add Energy Source")
				yield DataTable(id="plants_table")

			with VerticalScroll(id="right_panel"):
				yield Static("Board Status", classes="title")
				yield Label(f"Production: {self.board.production:.1f} W", id="total_production")
				yield Label(f"Consumption: {self.board.consumption:.1f} W", id="total_consumption")
				
				yield Button("Back to Main Menu", id="back_button")
		yield Footer()

	def on_mount(self) -> None:
		plants_table = self.query_one("#plants_table", DataTable)
		plants_table.add_columns("Type", "Count", "Action")
		
		self.update_tables()
		self.set_interval(1, self.update_display)

	def update_tables(self):
		plants_table = self.query_one("#plants_table", DataTable)
		plants_table.clear()
		for type, data in self.board.sources.items():
			display_name = AVAILABLE_POWER_PLANTS.get(type, type.replace("_", " ").title())
			plants_table.add_row(display_name, str(data['count']), "Remove", key=f"plant_{type}")

	def update_display(self):
		self.query_one("#total_production", Label).renderable = f"Production: {self.board.production:.1f} W"
		self.query_one("#total_consumption", Label).renderable = f"Consumption: {self.board.consumption:.1f} W"
		self.update_tables()

	def on_select_changed(self, event: Select.Changed):
		if event.select.id == "add_plant_select":
			if event.value and event.value in AVAILABLE_POWER_PLANTS:
				self.board.add_power_plant(event.value)
				self.update_tables()
				event.control.clear()

	def on_button_pressed(self, event: Button.Pressed):
		if event.button.id == "back_button":
			self.app.pop_screen()

	def on_data_table_cell_selected(self, event) -> None:
		table_id = event.data_table.id
		if table_id == "plants_table" and event.coordinate.column == 2:  # Action column
			row_key = event.cell_key.row_key.value
			if row_key and row_key.startswith("plant_"):
				plant_type = row_key.split("_", 1)[1]
				self.board.remove_power_plant(plant_type)
				self.update_tables()
