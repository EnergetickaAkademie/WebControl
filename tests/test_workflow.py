#!/usr/bin/env python3
"""
Test the new next_round endpoint response format
"""

import requests

BASE_URL = "http://localhost"
COREAPI_URL = f"{BASE_URL}/coreapi"

def test_next_round_workflow():
    print("🧪 Testing New Next Round Workflow")
    print("=" * 50)
    
    # Login as lecturer
    login_response = requests.post(f"{COREAPI_URL}/login", json={
        'username': 'lecturer1',
        'password': 'lecturer123'
    })
    
    if login_response.status_code != 200:
        print("❌ Login failed")
        return
    
    token = login_response.json()['token']
    headers = {'Authorization': f'Bearer {token}'}
    
    # Start game
    start_response = requests.post(f"{COREAPI_URL}/start_game", 
                                 json={'scenario_id': 'demo'}, 
                                 headers=headers)
    
    if start_response.status_code != 200:
        print("❌ Failed to start game")
        return
    
    print("✅ Game started")
    
    # Test first round advancement
    print("\n📋 Testing next round responses...")
    for i in range(3):
        next_response = requests.post(f"{COREAPI_URL}/next_round", json={}, headers=headers)
        
        if next_response.status_code == 200:
            data = next_response.json()
            print(f"\n🔄 Round {data.get('round', 'unknown')}:")
            print(f"   Type: {data.get('round_type', 'unknown')}")
            
            if data.get('slide_range'):
                print(f"   Slides: {data['slide_range']['start']}-{data['slide_range']['end']}")
            
            if data.get('game_data'):
                prod_coeffs = data['game_data'].get('production_coefficients', {})
                cons_mods = data['game_data'].get('consumption_modifiers', {})
                print(f"   Production sources: {len(prod_coeffs)}")
                print(f"   Consumption buildings: {len(cons_mods)}")
                
                # Show a few examples
                if prod_coeffs:
                    for key, value in list(prod_coeffs.items())[:2]:
                        print(f"     {key}: {value} MW")
        else:
            print(f"❌ Next round failed: {next_response.status_code}")
            break
    
    # Test PDF download
    pdf_response = requests.get(f"{COREAPI_URL}/get_pdf", headers=headers)
    if pdf_response.status_code == 200:
        pdf_data = pdf_response.json()
        print(f"\n📄 PDF URL: {pdf_data.get('url')}")
        
        # Try to download the PDF
        if pdf_data.get('url', '').startswith('/coreapi/'):
            download_url = f"{BASE_URL}{pdf_data['url']}"
            download_response = requests.get(download_url, headers=headers)
            if download_response.status_code == 200:
                print(f"✅ PDF downloaded successfully ({len(download_response.content)} bytes)")
            else:
                print(f"❌ PDF download failed: {download_response.status_code}")
    
    # End game
    end_response = requests.post(f"{COREAPI_URL}/end_game", json={}, headers=headers)
    if end_response.status_code == 200:
        print("\n✅ Game ended successfully")
    
    print("\n✅ Workflow test completed!")

if __name__ == "__main__":
    test_next_round_workflow()
