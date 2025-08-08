from textual.app import ComposeResult
from textual.containers import Container, VerticalScroll
from textual.widgets import Button, DataTable, Footer, Header, Static
from textual.screen import Screen

from config import AVAILABLE_POWER_PLANTS

# Import PowerInputScreen with fallback
try:
	from .PowerInput import PowerInputScreen
except ImportError:
	try:
		from PowerInput import PowerInputScreen
	except ImportError:
		# Create a placeholder if import fails
		from textual.screen import Screen as PowerInputScreen

class SetProductionScreen(Screen):
	"""Screen to manage production values for energy sources."""
	
	def __init__(self, board, **kwargs):
		super().__init__(**kwargs)
		self.board = board

	def compose(self) -> ComposeResult:
		yield Header(f"Manage Production - {self.board.board_name}")
		with Container(id="main_container"):
			with VerticalScroll(id="left_panel"):
				yield Static("Power Plant Production Control", classes="title")
				yield DataTable(id="production_table")

			with VerticalScroll(id="right_panel"):
				yield Static("Production Coefficients", classes="title")
				yield DataTable(id="coefficients_table")
				
				yield Static("Instructions", classes="title")
				yield Static("Click 'Set' to enter a production value", id="instructions")
				yield Static("Wind and Solar plants show 'Auto' - controlled by weather.", id="instructions2")
				
				yield Button("Back to Main Menu", id="back_button")
		yield Footer()

	def on_mount(self) -> None:
		production_table = self.query_one("#production_table", DataTable)
		production_table.add_columns("Type", "Count", "Current Production (W)", "Max Possible (W)", "Control")
		
		coefficients_table = self.query_one("#coefficients_table", DataTable)
		coefficients_table.add_columns("Source Type", "Coefficient")
		
		# Immediately fetch game state on mount to prevent delay
		self.update_game_state_display()
		
		self.update_tables()
		self.update_coefficients_table()
		self.set_interval(1, self.update_display)
		self.set_interval(5, self.update_game_state_display)

	def update_tables(self):
		production_table = self.query_one("#production_table", DataTable)
		production_table.clear()
		
		for type, data in self.board.sources.items():
			display_name = AVAILABLE_POWER_PLANTS.get(type, type.replace("_", " ").title())
			
			min_val, max_val = self.board.get_power_plant_range(type)
			plant_type_upper = type.upper()
			is_weather_dependent = plant_type_upper in ["WIND", "PHOTOVOLTAIC"]
			
			# For weather-dependent sources, production is determined by weather, not user setting.
			# We should reflect the actual production based on coefficients.
			current_production = max_val if is_weather_dependent else data['set_production']
			if is_weather_dependent:
				# Automatically set the production to the max possible for weather-dependent sources
				self.board.set_source_type_production(type, current_production)

			control_text = "Auto" if is_weather_dependent else "Set"
			
			production_table.add_row(
				display_name,
				str(data['count']),
				f"{current_production:.1f}", 
				f"{max_val:.1f}",
				control_text, 
				key=f"production_{type}"
			)

	def update_coefficients_table(self):
		# Import with fallback
		try:
			from tui.core.game_state import GLOBAL_PRODUCTION_COEFFICIENTS
		except ImportError:
			try:
				from core.game_state import GLOBAL_PRODUCTION_COEFFICIENTS
			except ImportError:
				# Fallback to empty dict
				GLOBAL_PRODUCTION_COEFFICIENTS = {}
		
		coefficients_table = self.query_one("#coefficients_table", DataTable)
		coefficients_table.clear()
		
		for source_type, coefficient in GLOBAL_PRODUCTION_COEFFICIENTS.items():
			display_name = source_type.replace('_', ' ').title()
			coefficients_table.add_row(display_name, f"{coefficient:.2f}")

	def update_display(self):
		self.update_tables()

	def update_game_state_display(self):
		# Import with fallback
		try:
			from tui.core.game_state import fetch_global_game_state
		except ImportError:
			try:
				from core.game_state import fetch_global_game_state
			except ImportError:
				# Fallback - create dummy function
				def fetch_global_game_state():
					pass
		
		fetch_global_game_state()
		self.update_coefficients_table()

	def on_button_pressed(self, event: Button.Pressed):
		if event.button.id == "back_button":
			self.app.pop_screen()

	def on_data_table_cell_selected(self, event) -> None:
		if event.data_table.id != "production_table":
			return
		# Stop bubbling to main screen to avoid unintended navigation
		event.stop()
		row_key = event.cell_key.row_key.value if event.cell_key else None
		if not row_key or not row_key.startswith("production_"):
			return
		plant_type = row_key.split("_", 1)[1]
		source_data = self.board.sources.get(plant_type)
		if not source_data:
			return
		plant_type_upper = plant_type.upper()
		# Columns: 0=Type,1=Count,2=Current,3=Max,4=Control
		click_col = event.coordinate.column
		# If clicking on Current or Control, open input for adjustable plants
		if plant_type_upper not in ["WIND", "PHOTOVOLTAIC"] and click_col in (2, 4):
			# Refresh latest ranges to avoid transient zero max
			try:
				self.board.refresh_prod_ranges()
			except Exception:
				pass
			min_val, max_val = self.board.get_power_plant_range(plant_type)
			self.app.push_screen(
				PowerInputScreen(
					self.board,
					plant_type,
					source_data["set_production"],
					min_val,
					max_val
				)
			)
		# Otherwise do nothing
