from Enak import Source, Building
from demo import building_consumptions, source_productions

SERVER_IP = "localhost"
SERVER_PORT = 80

BASE_URL = f"http://{SERVER_IP}:{SERVER_PORT}" if SERVER_PORT != 80 else f"http://{SERVER_IP}"
COREAPI_URL = f"{BASE_URL}/coreapi"

BOARDS = [
    {"name": "Team 1", "username": "board1", "password": "board123"},
    {"name": "Team 2", "username": "board2", "password": "board456"},
    {"name": "Team 3", "username": "board3", "password": "board789"},
]

POWER_PLANT_POWERS = {
    source.name.lower(): max(source_productions[source]) for source in Source
    if source in source_productions
}

CONSUMER_POWERS = {
    building.name.lower(): max(building_consumptions[building]) if isinstance(building_consumptions[building], tuple) 
    else building_consumptions[building]
    for building in Building 
    if building in building_consumptions
}

AVAILABLE_POWER_PLANTS = {
    source.name.lower(): source.name.replace('_', ' ').title() for source in Source
    if source in source_productions
}

AVAILABLE_CONSUMERS = {
    building.name.lower(): building.name.replace('_', ' ').title() for building in Building 
    if building in building_consumptions
}

LECTURER_CREDENTIALS = {"username": "lecturer1", "password": "lecturer123"}
STATUS_THRESHOLD_MW = 25