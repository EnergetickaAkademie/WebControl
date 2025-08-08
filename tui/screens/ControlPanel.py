"""
Control Panel Screen
Legacy ESP32 board control interface (deprecated)
"""

from textual.app import ComposeResult
from textual.containers import Container
from textual.widgets import Button, Footer, Header, Static
from textual.screen import Screen

class ControlPanel(Screen):
	"""Legacy control panel - keeping for compatibility."""

	def __init__(self, board, **kwargs):
		super().__init__(**kwargs)
		self.board = board

	def compose(self) -> ComposeResult:
		yield Header(f"Control Panel - {self.board.board_name}")
		with Container():
			yield Static("This screen has been replaced by separate management screens.")
			yield Static("Use 'Manage Sources' and 'Set Production' for power plant management.")
			yield Button("Back to Main Menu", id="back_button")
		yield Footer()

	def on_button_pressed(self, event: Button.Pressed):
		if event.button.id == "back_button":
			self.app.pop_screen()
