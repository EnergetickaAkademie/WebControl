"""
Power Input Screen
Dialog for entering production values with validation
"""

from textual.app import ComposeResult
from textual.containers import Container, Horizontal
from textual.widgets import Button, Static, Input
from textual.screen import Screen

from config import AVAILABLE_POWER_PLANTS

class PowerInputScreen(Screen):
	"""Screen for setting power plant production value."""

	def __init__(self, board, plant_type, current_value, min_val, max_val, **kwargs):
		super().__init__(**kwargs)
		self.board = board
		self.plant_type = plant_type
		self.current_value = current_value
		self.min_val = min_val
		self.max_val = max_val

	def compose(self) -> ComposeResult:
		with Container(id="dialog"):
			yield Static(f"Set Production for {AVAILABLE_POWER_PLANTS.get(self.plant_type, self.plant_type)}", classes="title")
			yield Static(f"Range: {self.min_val:.1f} - {self.max_val:.1f} W")
			yield Input(
				value=str(self.current_value),
				placeholder=f"Enter value ({self.min_val:.1f}-{self.max_val:.1f})",
				id="production_input"
			)
			with Horizontal():
				yield Button("Set", id="set_power", variant="primary")
				yield Button("Cancel", id="cancel_power")

	def on_mount(self) -> None:
		self.query_one(Input).focus()

	def on_button_pressed(self, event: Button.Pressed) -> None:
		if event.button.id == "set_power":
			input_widget = self.query_one("#production_input", Input)
			try:
				new_value = float(input_widget.value)
				if self.min_val <= new_value <= self.max_val:
					# Additional validation: check if coefficient allows any production
					try:
						from tui.core.game_state import GLOBAL_PRODUCTION_COEFFICIENTS
					except ImportError:
						try:
							from core.game_state import GLOBAL_PRODUCTION_COEFFICIENTS
						except ImportError:
							GLOBAL_PRODUCTION_COEFFICIENTS = {}
					
					coefficient = GLOBAL_PRODUCTION_COEFFICIENTS.get(self.plant_type.upper(), 0.0)
					
					if coefficient == 0.0 and new_value > 0:
						self.board.log(f"[{self.board.board_name}] Cannot set production for {self.plant_type}: coefficient is 0.0 (weather/game conditions don't allow it)")
						self.board.log(f"[{self.board.board_name}] Current coefficient: {coefficient}")
					else:
						self.board.set_source_type_production(self.plant_type, new_value)
						self.board.log(f"[{self.board.board_name}] Set {self.plant_type} production to {new_value:.1f}W (coefficient: {coefficient})")
						self.app.pop_screen()
				else:
					self.board.log(f"[{self.board.board_name}] Value must be between {self.min_val:.1f} and {self.max_val:.1f}")
			except ValueError:
				self.board.log(f"[{self.board.board_name}] Invalid number format")
		elif event.button.id == "cancel_power":
			self.app.pop_screen()
