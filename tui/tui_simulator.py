#!/usr/bin/env python3
"""
ESP32 Board Simulation TUI
A Textual application to control and monitor ESP32 board simulations.
"""

import requests
import struct
import time
import random
import threading
from typing import Dict, Any, Callable

from textual.app import App, ComposeResult
from textual.containers import Container, VerticalScroll, Horizontal
from textual.widgets import Button, DataTable, Footer, Header, Static, Log, Select, Input, Label
from textual.screen import Screen
from textual.reactive import reactive
from textual.widgets._data_table import CellDoesNotExist

from config import COREAPI_URL, AVAILABLE_POWER_PLANTS, AVAILABLE_CONSUMERS, BOARDS, POWER_PLANT_POWERS, CONSUMER_POWERS

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
        
        if response.status_code == 200:
            data = response.json()
            LECTURER_TOKEN = data['token']
            LECTURER_HEADERS = {'Authorization': f'Bearer {LECTURER_TOKEN}'}
            return LECTURER_TOKEN
        else:
            print(f"Lecturer login failed: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"Lecturer login error: {e}")
        return None

def fetch_global_game_state():
    """Fetch global game state from API"""
    global GLOBAL_PRODUCTION_COEFFICIENTS, GLOBAL_WEATHER, GLOBAL_GAME_ACTIVE
    
    if not get_lecturer_token():
        return False
    
    try:
        response = requests.get(f"{COREAPI_URL}/pollforusers", headers=LECTURER_HEADERS)
        
        if response.status_code == 200:
            data = response.json()
            GLOBAL_PRODUCTION_COEFFICIENTS = data.get('production_coefficients', {})
            GLOBAL_WEATHER = data.get('current_weather', [])
            GLOBAL_GAME_ACTIVE = data.get('game_status', {}).get('game_active', False)
            return True
        else:
            print(f"Global game state fetch failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"Global game state fetch error: {e}")
        return False

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
        self.connected_power_plants = {} # id: {type, production}
        self.connected_consumers = {} # id: {type, consumption}
        self.next_plant_id = 1
        self.next_consumer_id = 1
        
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
        """Poll the board status using binary protocol"""
        try:
            response = requests.get(f"{COREAPI_URL}/poll_binary",
                                  headers=self.headers)
            
            if response.status_code == 200:
                return True
            else:
                self.log(f"[{self.board_name}] Poll failed: {response.status_code}")
                return False
                
        except Exception as e:
            self.log(f"[{self.board_name}] Poll error: {e}")
            return False

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
            plant_ids = list(self.connected_power_plants.keys())
            count = len(plant_ids)
            data = struct.pack('B', count)
            
            for plant_id in plant_ids:
                set_power = int(self.connected_power_plants[plant_id]['production'] * 1000)
                data += struct.pack('>Ii', plant_id, set_power)
            
            response = requests.post(f"{COREAPI_URL}/prod_connected",
                                   data=data,
                                   headers={**self.headers, 'Content-Type': 'application/octet-stream'})
            
            if response.status_code == 200:
                self.log(f"[{self.board_name}] Reported {count} connected power plants")
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
        """Add a power plant using config data"""
        if plant_type not in POWER_PLANT_POWERS:
            self.log(f"[{self.board_name}] Unknown plant type: {plant_type}")
            return
        
        plant_id = self.next_plant_id
        
        # Apply coefficient to base production
        base_production = POWER_PLANT_POWERS[plant_type]
        coefficient = GLOBAL_PRODUCTION_COEFFICIENTS.get(plant_type.upper(), 1.0)
        actual_production = base_production * coefficient
        
        self.connected_power_plants[plant_id] = {"type": plant_type, "production": actual_production}
        self.next_plant_id += 1
        self.update_totals()
        self.report_connected_production()

    def remove_power_plant(self, plant_id: int):
        if plant_id in self.connected_power_plants:
            del self.connected_power_plants[plant_id]
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

    def set_power_plant_production(self, plant_id: int, new_production: float):
        """Set the production value for a specific power plant"""
        if plant_id in self.connected_power_plants:
            self.connected_power_plants[plant_id]["production"] = new_production
            self.update_totals()
            self.report_connected_production()

    def get_power_plant_range(self, plant_type: str) -> tuple:
        """Get the min/max range for a power plant type"""
        # Get base range from config
        base_max = POWER_PLANT_POWERS.get(plant_type, 100.0)
        base_min = 0.0
        
        # Apply coefficient if available
        coefficient = GLOBAL_PRODUCTION_COEFFICIENTS.get(plant_type.upper(), 1.0)
        
        return (base_min * coefficient, base_max * coefficient)

    def update_totals(self):
        self.production = sum(p["production"] for p in self.connected_power_plants.values())
        self.consumption = sum(c["consumption"] for c in self.connected_consumers.values())

    def simulate_board_operation(self):
        """Main simulation loop"""
        self.log(f"[{self.board_name}] Starting board simulation")
        
        if not self.login():
            self.stop()
            return
        
        if not self.register_board():
            self.stop()
            return
            
        self.status = "Running"
        self.running = True
        while self.running:
            try:
                # Fetch game state periodically
                self.fetch_game_state()
                
                if self.poll_binary():
                    if self.send_power_data():
                        pass
                
                time.sleep(2)
                
            except Exception as e:
                self.log(f"[{self.board_name}] Simulation error: {e}")
                self.status = "Error"
                time.sleep(2)
    
    def stop(self):
        """Stop the simulation"""
        if self.running:
            self.log(f"[{self.board_name}] Stopping simulation")
            self.running = False
            self.status = "Stopped"

class ManageSourcesScreen(Screen):
    """Screen to manage buildings (energy consumers) for a board."""
    
    def __init__(self, board: ESP32BoardSimulator, **kwargs):
        super().__init__(**kwargs)
        self.board = board

    def compose(self) -> ComposeResult:
        yield Header(f"Manage Buildings - {self.board.board_name}")
        with Container(id="main_container"):
            with VerticalScroll(id="left_panel"):
                yield Static("Energy Consumers", classes="title")
                yield Select([(name, key) for key, name in AVAILABLE_CONSUMERS.items()], id="add_consumer_select", prompt="Add Consumer")
                yield DataTable(id="consumers_table")

            with VerticalScroll(id="right_panel"):
                yield Static("Game State", classes="title")
                yield Label("Game Active: No", id="game_status")
                yield Label("Weather: -", id="weather_status")
                
                yield Static("Production Coefficients", classes="title")
                yield DataTable(id="coefficients_table")
                
                yield Button("Back to Main Menu", id="back_button")
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
            display_name = AVAILABLE_CONSUMERS.get(consumer["type"], consumer["type"].replace("_", " ").title())
            consumers_table.add_row(str(id), display_name, f"{consumer['consumption']:.1f}", "Remove", key=f"consumer_{id}")

    def update_coefficients_table(self):
        """Update the production coefficients table"""
        coefficients_table = self.query_one("#coefficients_table", DataTable)
        coefficients_table.clear()
        
        for source_type, coefficient in GLOBAL_PRODUCTION_COEFFICIENTS.items():
            display_name = source_type.replace('_', ' ').title()
            coefficients_table.add_row(display_name, f"{coefficient:.2f}")

    def update_display(self):
        self.update_tables()

    def update_game_state_display(self):
        """Update game state information"""
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

class ManagePowerPlantsScreen(Screen):
    """Screen to manage energy sources (power plants) for a board."""
    
    def __init__(self, board: ESP32BoardSimulator, **kwargs):
        super().__init__(**kwargs)
        self.board = board

    def compose(self) -> ComposeResult:
        yield Header(f"Manage Sources - {self.board.board_name}")
        with Container(id="main_container"):
            with VerticalScroll(id="left_panel"):
                yield Static("Energy Sources", classes="title")
                yield Select([(name, key) for key, name in AVAILABLE_POWER_PLANTS.items()], id="add_plant_select", prompt="Add Energy Source")
                yield DataTable(id="plants_table")

            with VerticalScroll(id="right_panel"):
                yield Static("Board Status", classes="title")
                yield Label(f"Production: {self.board.production:.1f} W", id="total_production")
                yield Label(f"Consumption: {self.board.consumption:.1f} W", id="total_consumption")
                
                yield Button("Back to Main Menu", id="back_button")
        yield Footer()

    def on_mount(self) -> None:
        plants_table = self.query_one("#plants_table", DataTable)
        plants_table.add_columns("ID", "Type", "Production (W)", "Action")
        
        self.update_tables()
        self.set_interval(1, self.update_display)

    def update_tables(self):
        plants_table = self.query_one("#plants_table", DataTable)
        plants_table.clear()
        for id, plant in self.board.connected_power_plants.items():
            display_name = AVAILABLE_POWER_PLANTS.get(plant["type"], plant["type"].replace("_", " ").title())
            plants_table.add_row(str(id), display_name, f"{plant['production']:.1f}", "Remove", key=f"plant_{id}")

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
        if table_id == "plants_table" and event.coordinate.column == 3:  # Action column
            row_key = event.cell_key.row_key.value
            if row_key and row_key.startswith("plant_"):
                plant_id = int(row_key.split("_")[1])
                self.board.remove_power_plant(plant_id)
                self.update_tables()

class PowerInputScreen(Screen):
    """Screen for setting power plant production value."""

    def __init__(self, board, plant_id, plant_type, current_value, min_val, max_val, **kwargs):
        super().__init__(**kwargs)
        self.board = board
        self.plant_id = plant_id
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
                    self.board.set_power_plant_production(self.plant_id, new_value)
                    self.app.pop_screen()
                else:
                    self.board.log(f"[{self.board.board_name}] Value must be between {self.min_val:.1f} and {self.max_val:.1f}")
            except ValueError:
                self.board.log(f"[{self.board.board_name}] Invalid number format")
        elif event.button.id == "cancel_power":
            self.app.pop_screen()

class SetProductionScreen(Screen):
    """Screen to manage production values for energy sources."""
    
    def __init__(self, board: ESP32BoardSimulator, **kwargs):
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
        production_table.add_columns("ID", "Type", "Current Production (W)", "Max Possible (W)", "Control")
        
        coefficients_table = self.query_one("#coefficients_table", DataTable)
        coefficients_table.add_columns("Source Type", "Coefficient")
        
        self.update_tables()
        self.update_coefficients_table()
        self.set_interval(1, self.update_display)
        self.set_interval(5, self.update_game_state_display)

    def update_tables(self):
        production_table = self.query_one("#production_table", DataTable)
        production_table.clear()
        
        for id, plant in self.board.connected_power_plants.items():
            display_name = AVAILABLE_POWER_PLANTS.get(plant["type"], plant["type"].replace("_", " ").title())
            
            min_val, max_val = self.board.get_power_plant_range(plant["type"])
            plant_type_upper = plant["type"].upper()
            is_weather_dependent = plant_type_upper in ["WIND", "PHOTOVOLTAIC"]
            control_text = "Auto" if is_weather_dependent else "Set"
            
            production_table.add_row(
                str(id), 
                display_name, 
                f"{plant['production']:.1f}", 
                f"{max_val:.1f}",
                control_text, 
                key=f"production_{id}"
            )

    def update_coefficients_table(self):
        coefficients_table = self.query_one("#coefficients_table", DataTable)
        coefficients_table.clear()
        
        for source_type, coefficient in GLOBAL_PRODUCTION_COEFFICIENTS.items():
            display_name = source_type.replace('_', ' ').title()
            coefficients_table.add_row(display_name, f"{coefficient:.2f}")

    def update_display(self):
        self.update_tables()

    def update_game_state_display(self):
        fetch_global_game_state()
        self.update_coefficients_table()

    def on_button_pressed(self, event: Button.Pressed):
        if event.button.id == "back_button":
            self.app.pop_screen()

    def on_data_table_cell_selected(self, event) -> None:
        if event.data_table.id == "production_table" and event.coordinate.column == 4:
            # Stop the event from bubbling up to the main app screen, which was causing the bug.
            event.stop()
            
            row_key = event.cell_key.row_key.value
            if row_key and row_key.startswith("production_"):
                plant_id = int(row_key.split("_")[1])
                plant = self.board.connected_power_plants.get(plant_id)
                if plant:
                    plant_type_upper = plant["type"].upper()
                    if plant_type_upper not in ["WIND", "PHOTOVOLTAIC"]:
                        # Use the dedicated PowerInputScreen for a modal dialog experience
                        min_val, max_val = self.board.get_power_plant_range(plant["type"])
                        self.app.push_screen(
                            PowerInputScreen(
                                self.board,
                                plant_id,
                                plant["type"],
                                plant["production"],
                                min_val,
                                max_val
                            )
                        )

class ControlPanel(Screen):
    """Legacy control panel - keeping for compatibility."""

    def __init__(self, board: ESP32BoardSimulator, **kwargs):
        super().__init__(**kwargs)
        self.board = board

    def compose(self) -> ComposeResult:
        yield Header(f"Control Panel - {self.board.board_name}")
        with Container():
            yield Static("This screen has been replaced by separate management screens.")
            yield Button("Back to Main Menu", id="back_button")
        yield Footer()

    def on_button_pressed(self, event: Button.Pressed):
        if event.button.id == "back_button":
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
