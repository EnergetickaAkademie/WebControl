import threading
import argparse
import sys

from textual.app import App, ComposeResult
from textual.containers import Container, Horizontal
from textual.widgets import Button, DataTable, Footer, Header, Log
from textual.widgets._data_table import CellDoesNotExist

from config import BOARDS

# Import core components
from core.board_simulator import ESP32BoardSimulator
from core.game_state import fetch_global_game_state, fetch_lecturer_view_state, calculate_board_status
from config import BOARDS, STATUS_THRESHOLD_MW

# Import screens  
from screens import (
    ManageSourcesScreen,
    ManagePowerPlantsScreen, 
    SetProductionScreen,
    PowerInputScreen,
    ControlPanel,
    DebugScreen
)

# Global debug flag
DEBUG_MODE = False

def debug_log(message):
	"""Log debug message to tui.log if debug mode is enabled"""
	if DEBUG_MODE:
		with open("tui.log", "a") as log_file:
			from datetime import datetime
			log_file.write(f"[{datetime.now()}] DEBUG: {message}\n")

class BoardSimTUI(App):
	"""A Textual app to manage ESP32 board simulations."""

	CSS_PATH = "tui_simulator.css"
	BINDINGS = [("d", "toggle_dark", "Toggle dark mode"), ("q", "quit", "Quit")]

	def __init__(self, **kwargs):
		super().__init__(**kwargs)
		self.boards = []
		self.threads = []
		self.team_states = {}

	def compose(self) -> ComposeResult:
		"""Create child widgets for the app."""
		yield Header("ESP32 Board Simulator")
		with Container():
			yield DataTable(id="board_status")
			with Horizontal(id="controls"):
				yield Button("Start All", id="start_all", variant="success")
				yield Button("Stop All", id="stop_all", variant="error")
				yield Button("Debug Screen", id="debug_screen", variant="primary")
			yield Log(id="log")
		yield Footer()

	def on_mount(self) -> None:
		"""Called when the app is mounted."""
		table = self.query_one(DataTable)
		table.add_columns("Board Name", "Status", "Consumers", "Sources", "Production")
		
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
				"Manage",
				"Manage", 
				"Set",
				key=str(i)
			)

		self.set_interval(1, self.update_table)

	def update_table(self) -> None:
		"""Update the board status table."""
		log = self.query_one(Log)
		
		try:
			# We still fetch the state to know if the game is active, etc.
			fetch_lecturer_view_state()
		except Exception as e:
			log.write_line(f"Error fetching lecturer view state: {e}")

		table = self.query_one(DataTable)
		for i, board in enumerate(self.boards):
			row_key = str(i)
			try:
				table.update_cell(row_key, "Status", board.status)
			except CellDoesNotExist:
				pass

	def on_button_pressed(self, event: Button.Pressed) -> None:
		"""Event handler called when a button is pressed."""
		if event.button.id == "start_all":
			self.start_all_simulations()
		elif event.button.id == "stop_all":
			self.stop_all_simulations()
		elif event.button.id == "debug_screen":
			self.push_screen(DebugScreen())

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
			if event.coordinate.column == 2:  # Consumers
				log.write_line(f"Opening Manage Buildings screen for {selected_board.board_name}")
				self.push_screen(ManageSourcesScreen(selected_board))
			elif event.coordinate.column == 3:  # Sources
				log.write_line(f"Opening Manage Sources screen for {selected_board.board_name}")
				self.push_screen(ManagePowerPlantsScreen(selected_board))
			elif event.coordinate.column == 4:  # Production
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
	parser = argparse.ArgumentParser(description="ESP32 Board Simulator TUI")
	parser.add_argument("--debug", action="store_true", help="Enable debug logging to tui.log")
	args = parser.parse_args()
	
	# Set global debug flag
	DEBUG_MODE = args.debug
	
	# Also set debug mode in game_state module
	import core.game_state
	core.game_state.DEBUG_MODE = args.debug
	
	app = BoardSimTUI()
	app.run()
