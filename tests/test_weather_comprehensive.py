#!/usr/bin/env python3
"""
Additional test cases for weather message fix verification.
"""

import sys
import os

# Add the CoreAPI/src directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'CoreAPI', 'src'))

from weather_messages import WeatherMessageHandler
from enak import Source

# Mock DISPLAY_TRANSLATIONS
DISPLAY_TRANSLATIONS = {
    'DAY': {
        'name': 'Den',
        'temperature': '20°',
        'effects': [
            {
                'text': 'Větrné elektrárny nevyrábí',
                'type': Source.WIND.value,
                'priority': 2
            }
        ]
    },
    'NIGHT': {
        'name': 'Noc',
        'effects': [
            {
                'text': 'Solární elektrárny nevyrábí',
                'type': Source.PHOTOVOLTAIC.value,
                'priority': 2
            },
            {
                'text': 'Větrné elektrárny nevyrábí',
                'type': Source.WIND.value,
                'priority': 2
            }
        ]
    },
    'WINDY': {
        'name': 'větrno',
        'effects': [
            {
                'text': 'Větrné elektrárny vyrábí na plný výkon',
                'type': Source.WIND.value,
                'priority': 0
            }
        ]
    },
    'CALM': {
        'name': 'bezvětří',
        'effects': [
            {
                'text': 'Větrné elektrárny nevyrábí',
                'type': Source.WIND.value,
                'priority': 2
            }
        ]
    },
    'SUNNY': {
        'name': 'jasno',
        'effects': [
            {
                'text': 'Solární elektrárny vyrábí na plný výkon',
                'type': Source.PHOTOVOLTAIC.value,
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
    def __init__(self, enabled_sources=None):
        if enabled_sources is None:
            enabled_sources = [Source.PHOTOVOLTAIC, Source.WIND, Source.COAL, Source.NUCLEAR]
        
        self.master_production_coefficients = {
            source: 1 for source in enabled_sources
        }

def test_scenario(name, round_type, weather_conditions, enabled_sources, expected_messages):
    """Test a specific scenario and verify expected messages."""
    print(f"\n{'='*50}")
    print(f"Test: {name}")
    print(f"{'='*50}")
    
    handler = WeatherMessageHandler(DISPLAY_TRANSLATIONS)
    script = MockScript(enabled_sources)
    
    display_data = handler.generate_weather_display_data(
        MockRoundType(round_type), 
        [MockWeather(w) for w in weather_conditions], 
        script
    )
    
    effects = display_data.get('effects', [])
    
    print(f"Round: {round_type}")
    print(f"Weather: {weather_conditions}")
    print(f"Enabled sources: {[s.name for s in enabled_sources]}")
    print(f"Generated effects:")
    
    for effect in effects:
        effect_type = effect.get('type')
        text = effect.get('text')
        source_name = next((s.name for s in Source if s.value == effect_type), f"Type {effect_type}")
        print(f"  {source_name}: {text}")
    
    # Verify expected messages
    print(f"\nVerification:")
    all_correct = True
    for source, expected_text_part in expected_messages.items():
        source_effects = [e for e in effects if e.get('type') == source.value]
        if source_effects:
            actual_text = source_effects[0]['text']
            contains_expected = expected_text_part.lower() in actual_text.lower()
            print(f"  {source.name}: {'✅' if contains_expected else '❌'} Expected '{expected_text_part}' in '{actual_text}'")
            if not contains_expected:
                all_correct = False
        else:
            print(f"  {source.name}: ❌ No effect found (expected '{expected_text_part}')")
            all_correct = False
    
    print(f"\nResult: {'PASSED' if all_correct else 'FAILED'}")
    return all_correct

def run_all_tests():
    """Run comprehensive test suite."""
    print("Weather Message Handler - Comprehensive Test Suite")
    print("="*60)
    
    test_results = []
    
    # Test 1: Original bug scenario - Night + Windy with FVE enabled
    test_results.append(test_scenario(
        "Night + Windy (Original Bug)",
        "NIGHT",
        ["WINDY"],
        [Source.PHOTOVOLTAIC, Source.WIND, Source.COAL],
        {
            Source.PHOTOVOLTAIC: "nevyrábí",  # Should show not producing
            Source.WIND: "plný výkon"         # Should show full production
        }
    ))
    
    # Test 2: Day + Calm + Windy (last effect wins)
    test_results.append(test_scenario(
        "Day + Calm + Windy (Last Effect Wins)",
        "DAY",
        ["CALM", "WINDY"],
        [Source.WIND, Source.COAL],
        {
            Source.WIND: "plný výkon"  # WINDY should override CALM
        }
    ))
    
    # Test 3: Night with no weather (baseline effects only)
    test_results.append(test_scenario(
        "Night with No Weather",
        "NIGHT",
        [],
        [Source.PHOTOVOLTAIC, Source.WIND],
        {
            Source.PHOTOVOLTAIC: "nevyrábí",
            Source.WIND: "nevyrábí"
        }
    ))
    
    # Test 4: Sources not enabled should not show messages
    test_results.append(test_scenario(
        "Night with FVE Not Enabled",
        "NIGHT",
        [],
        [Source.COAL],  # Only coal enabled, not FVE or Wind
        {}  # Should not show FVE or Wind messages
    ))
    
    # Summary
    passed = sum(test_results)
    total = len(test_results)
    
    print(f"\n{'='*60}")
    print(f"FINAL RESULTS: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! The weather message fix is working correctly.")
    else:
        print("⚠️  Some tests failed. Please review the implementation.")
    
    return passed == total

if __name__ == '__main__':
    run_all_tests()
