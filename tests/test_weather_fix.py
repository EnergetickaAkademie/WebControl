#!/usr/bin/env python3
"""
Test script to verify the weather message fix for WebControl.

This script tests the specific scenario from normal.py round 20:
- Night round with FVE enabled
- Windy weather condition
- Should show: FVE not producing, Wind producing full power
"""

import sys
import os

# Add the CoreAPI/src directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'CoreAPI', 'src'))

from weather_messages import WeatherMessageHandler
from enak import Source, Enak

# Mock DISPLAY_TRANSLATIONS (simplified version for testing)
DISPLAY_TRANSLATIONS = {
    'NIGHT': {
        'name': 'Noc',
        'temperature': '15°',
        'icon_url': '/icons/10_night.svg',
        'background_image': 'url(/icons/bg_night.jpg)',
        'wind_speed': '2 m/s',
        'show_wind': True,
        'effects': [
            {
                'text': 'Solární elektrárny nevyrábí',
                'icon_url': '/icons/DASH_solarPP.svg',
                'type': Source.PHOTOVOLTAIC.value,
                'priority': 2
            },
            {
                'text': 'Větrné elektrárny nevyrábí',
                'icon_url': '/icons/DASH_windPP.svg',
                'type': Source.WIND.value,
                'priority': 2
            }
        ]
    },
    'WINDY': {
        'name': 'větrno',
        'temperature': None,
        'icon_url': '/icons/09_WINDY.svg',
        'background_image': 'url(/icons/bg_windy.jpg)',
        'wind_speed': '14 m/s',
        'show_wind': True,
        'effects': [
            {
                'text': 'Větrné elektrárny vyrábí na plný výkon',
                'icon_url': '/icons/DASH_windPP.svg',
                'type': Source.WIND.value,
                'priority': 0
            }
        ]
    }
}

class MockRoundType:
    def __init__(self, name):
        self.name = name

class MockWeather:
    def __init__(self, name):
        self.name = name

class MockScript:
    def __init__(self):
        # Simulate FVE and Wind being enabled (coefficient > 0 in master coefficients)
        # But FVE has current coefficient 0 (night), Wind has coefficient 1 (windy)
        self.master_production_coefficients = {
            Source.PHOTOVOLTAIC: 1,  # FVE enabled in game but coefficient 0 due to night
            Source.WIND: 1,          # Wind enabled and coefficient 1 due to windy
            Source.COAL: 1,          # Other sources also enabled
            Source.NUCLEAR: 1,
        }

def test_night_windy_scenario():
    """Test the night + windy scenario that should show FVE not producing."""
    print("Testing Night + Windy scenario (Round 20 from normal.py)")
    print("=" * 60)
    
    # Create the weather message handler
    handler = WeatherMessageHandler(DISPLAY_TRANSLATIONS)
    
    # Set up the test scenario
    round_type = MockRoundType('NIGHT')
    weather_conditions = [MockWeather('WINDY')]
    script = MockScript()
    
    # Generate the display data
    display_data = handler.generate_weather_display_data(
        round_type, weather_conditions, script
    )
    
    print(f"Round type: {round_type.name}")
    print(f"Weather conditions: {[w.name for w in weather_conditions]}")
    print(f"Enabled sources: {list(script.master_production_coefficients.keys())}")
    print()
    
    print("Generated effects:")
    effects = display_data.get('effects', [])
    for i, effect in enumerate(effects):
        effect_type = effect.get('type', 'No type')
        text = effect.get('text', 'No text')
        print(f"  {i+1}. Type {effect_type}: {text}")
    
    print()
    
    # Verify the fix
    photovoltaic_effects = [e for e in effects if e.get('type') == Source.PHOTOVOLTAIC.value]
    wind_effects = [e for e in effects if e.get('type') == Source.WIND.value]
    
    print("Verification:")
    print(f"  FVE (Photovoltaic) effects found: {len(photovoltaic_effects)}")
    if photovoltaic_effects:
        print(f"    Message: {photovoltaic_effects[0]['text']}")
        expected_fve = 'nevyrábí' in photovoltaic_effects[0]['text'].lower()
        print(f"    Correct (shows not producing): {expected_fve}")
    else:
        print("    ERROR: No FVE effect found! This is the bug.")
        expected_fve = False
    
    print(f"  Wind effects found: {len(wind_effects)}")
    if wind_effects:
        print(f"    Message: {wind_effects[0]['text']}")
        expected_wind = 'plný výkon' in wind_effects[0]['text'].lower()
        print(f"    Correct (shows full production): {expected_wind}")
    else:
        print("    ERROR: No Wind effect found!")
        expected_wind = False
    
    print()
    print("=" * 60)
    success = expected_fve and expected_wind
    print(f"TEST RESULT: {'PASSED' if success else 'FAILED'}")
    
    if success:
        print("✅ The fix works! FVE shows 'not producing' during night when enabled.")
    else:
        print("❌ The fix failed. Check the weather message logic.")
    
    return success

if __name__ == '__main__':
    test_night_windy_scenario()
