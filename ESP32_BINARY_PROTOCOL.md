# ESP32 Binary Protocol Documentation

This document describes the binary protocol for ESP32 board communication with the WebControl game server.

## Overview

The binary protocol is designed to minimize bandwidth usage and memory consumption on ESP32 devices. It uses structured binary data instead of JSON for efficient communication.

### Key Benefits

- **Bandwidth savings** compared to JSON
- **Memory efficient** - no JSON parsing overhead  
- **Overflow protection** - validates all inputs
- **Simple authentication** - JWT bearer tokens
- **Milliwatt precision** - power values stored as integers (W * 1000)

## Authentication Flow

### 1. Login Request

**Endpoint:** `POST /coreapi/login`  
**Content-Type:** `application/json`

```json
{
    "username": "board1",
    "password": "board123"
}
```

### 2. Login Response

```json
{
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user_type": "board",
    "username": "board1",
    "group_id": "group1"
}
```

### 3. Subsequent Requests

All binary endpoints require the JWT token in the Authorization header:
```
Authorization: Bearer <JWT_TOKEN>
```

## Authentication

All binary endpoints require JWT authentication via HTTP header:
```
Authorization: Bearer <JWT_TOKEN>
```

Board ID is extracted from the JWT token username (e.g., `board1`, `board2`, etc.)

## Binary Endpoints

### 1. Board Registration

**Endpoint:** `POST /coreapi/register`  
**Content-Type:** `application/octet-stream`  
**Request Body:** Empty (board ID extracted from JWT)

### 2. Registration Response

**Content-Type:** `application/octet-stream`  
**Size:** Variable (2 + message length bytes)

```
Offset | Size | Type   | Description
-------|------|--------|---------------------------
0      | 1    | uint8  | Success flag (0x00=fail, 0x01=success)
1      | 1    | uint8  | Message length (N)
2      | N    | char[] | Status message
```

### 3. Power Data Submission

**Endpoint:** `POST /coreapi/post_vals`  
**Size:** 8 bytes (fixed)  
**Content-Type:** `application/octet-stream`

```
Offset | Size | Type   | Description
-------|------|--------|---------------------------
0      | 4    | int32  | Production (milliwatts, big-endian)
4      | 4    | int32  | Consumption (milliwatts, big-endian)
```

### 4. Game Status and Coefficients Poll

**Endpoint:** `GET /coreapi/poll_binary`  
**Content-Type:** `application/octet-stream`  
**Response:** Variable size with production and consumption coefficients

```
Offset | Size | Type   | Description
-------|------|--------|---------------------------
0      | 1    | uint8  | Production coefficient count (P)
1      | P*5  | array  | Production coefficients
X      | 1    | uint8  | Consumption coefficient count (C)
X+1    | C*5  | array  | Consumption coefficients
```

**Production Coefficient Entry (5 bytes):**
```
Offset | Size | Type   | Description
-------|------|--------|---------------------------
0      | 1    | uint8  | Source ID
1      | 4    | int32  | Coefficient (milliwatts, big-endian)
```

**Consumption Coefficient Entry (5 bytes):**
```
Offset | Size | Type   | Description
-------|------|--------|---------------------------
0      | 1    | uint8  | Building ID
1      | 4    | int32  | Consumption (milliwatts, big-endian)
```

### 5. Connected Power Plants Report

**Endpoint:** `POST /coreapi/prod_connected`  
**Content-Type:** `application/octet-stream`

```
Offset | Size | Type   | Description
-------|------|--------|---------------------------
0      | 1    | uint8  | Count of power plants (N)
1      | N*8  | array  | Power plant entries
```

**Power Plant Entry (8 bytes):**
```
Offset | Size | Type   | Description
-------|------|--------|---------------------------
0      | 4    | uint32 | Plant ID (big-endian)
4      | 4    | int32  | Set power (milliwatts, big-endian)
```

### 6. Connected Consumers Report

**Endpoint:** `POST /coreapi/cons_connected`  
**Content-Type:** `application/octet-stream`

```
Offset | Size | Type   | Description
-------|------|--------|---------------------------
0      | 1    | uint8  | Count of consumers (N)
1      | N*4  | array  | Consumer IDs
```

**Consumer Entry (4 bytes):**
```
Offset | Size | Type   | Description
-------|------|--------|---------------------------
0      | 4    | uint32 | Consumer ID (big-endian)
```

### 7. Production Values Query

**Endpoint:** `GET /coreapi/prod_vals`  
**Content-Type:** `application/octet-stream`  
**Response:** Same format as production coefficients in poll_binary

### 8. Consumption Values Query

**Endpoint:** `GET /coreapi/cons_vals`  
**Content-Type:** `application/octet-stream`  
**Response:** Same format as consumption coefficients in poll_binary

## Error Responses

Binary endpoints return simple ASCII error responses with appropriate HTTP status codes:

- `OK` - Success (200)
- `INVALID_DATA` - Invalid binary format (400)
- `INVALID_BOARD` - Invalid board authentication (400)
- `BOARD_NOT_FOUND` - Board ID not registered (404)
- `INACTIVE_GAME` - No active game scenario (503)
- `ERROR` - Server error (500)

## ESP32 Implementation Example

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

struct PowerData {
    int32_t production;  // milliwatts
    int32_t consumption; // milliwatts
} __attribute__((packed));

struct ProductionEntry {
    uint8_t source_id;
    int32_t coefficient; // milliwatts
} __attribute__((packed));

struct ConsumptionEntry {
    uint8_t building_id;
    int32_t consumption; // milliwatts
} __attribute__((packed));

// Convert to big-endian for network transmission
uint32_t htonl(uint32_t hostlong) {
    return ((hostlong & 0xff000000) >> 24) |
           ((hostlong & 0x00ff0000) >> 8) |
           ((hostlong & 0x0000ff00) << 8) |
           ((hostlong & 0x000000ff) << 24);
}

String token; // Store JWT token

bool login(const char* username, const char* password) {
    HTTPClient http;
    http.begin("http://server/coreapi/login");
    http.addHeader("Content-Type", "application/json");
    
    String payload = "{\"username\":\"" + String(username) + 
                    "\",\"password\":\"" + String(password) + "\"}";
    
    int httpCode = http.POST(payload);
    
    if (httpCode == 200) {
        String response = http.getString();
        DynamicJsonDocument doc(1024);
        deserializeJson(doc, response);
        token = doc["token"].as<String>();
        return true;
    }
    return false;
}

bool registerBoard() {
    HTTPClient http;
    http.begin("http://server/coreapi/register");
    http.addHeader("Authorization", "Bearer " + token);
    http.addHeader("Content-Type", "application/octet-stream");
    
    int httpCode = http.POST((uint8_t*)nullptr, 0); // Empty body
    return httpCode == 200;
}

bool sendPowerData(float production_W, float consumption_W) {
    PowerData data;
    data.production = htonl((int32_t)(production_W * 1000));
    data.consumption = htonl((int32_t)(consumption_W * 1000));
    
    HTTPClient http;
    http.begin("http://server/coreapi/post_vals");
    http.addHeader("Authorization", "Bearer " + token);
    http.addHeader("Content-Type", "application/octet-stream");
    
    int httpCode = http.POST((uint8_t*)&data, sizeof(data));
    return httpCode == 200;
}

bool reportConnectedProduction(uint32_t* plant_ids, int32_t* set_powers, uint8_t count) {
    size_t dataSize = 1 + count * 8; // count + (id+power)*count
    uint8_t* data = (uint8_t*)malloc(dataSize);
    
    data[0] = count;
    size_t offset = 1;
    
    for (int i = 0; i < count; i++) {
        *(uint32_t*)(data + offset) = htonl(plant_ids[i]);
        *(int32_t*)(data + offset + 4) = htonl(set_powers[i]);
        offset += 8;
    }
    
    HTTPClient http;
    http.begin("http://server/coreapi/prod_connected");
    http.addHeader("Authorization", "Bearer " + token);
    http.addHeader("Content-Type", "application/octet-stream");
    
    int httpCode = http.POST(data, dataSize);
    free(data);
    return httpCode == 200;
}

bool reportConnectedConsumers(uint32_t* consumer_ids, uint8_t count) {
    size_t dataSize = 1 + count * 4; // count + id*count
    uint8_t* data = (uint8_t*)malloc(dataSize);
    
    data[0] = count;
    size_t offset = 1;
    
    for (int i = 0; i < count; i++) {
        *(uint32_t*)(data + offset) = htonl(consumer_ids[i]);
        offset += 4;
    }
    
    HTTPClient http;
    http.begin("http://server/coreapi/cons_connected");
    http.addHeader("Authorization", "Bearer " + token);
    http.addHeader("Content-Type", "application/octet-stream");
    
    int httpCode = http.POST(data, dataSize);
    free(data);
    return httpCode == 200;
}

bool pollGameCoefficients() {
    HTTPClient http;
    http.begin("http://server/coreapi/poll_binary");
    http.addHeader("Authorization", "Bearer " + token);
    
    int httpCode = http.GET();
    
    if (httpCode == 200) {
        // Parse coefficients response
        WiFiClient* stream = http.getStreamPtr();
        // Process binary response data...
        return true;
    }
    return false;
}
```

## Memory Usage

- **Registration:** Empty request body
- **Power data:** 8 bytes packet  
- **Production connections:** 1 + N*8 bytes (N = number of plants)
- **Consumer connections:** 1 + N*4 bytes (N = number of consumers)
- **Poll response:** Variable size based on coefficients
- **Total structs:** ~50 bytes RAM
- **HTTP overhead:** ~200-300 bytes

**Total ESP32 memory usage:** < 350 bytes per operation

## Security

- **Authentication:** JWT Bearer token in HTTP header
- **Validation:** All inputs validated for size/range
- **Overflow protection:** Buffer lengths enforced
- **Board identification:** From verified JWT token

## Data Format Notes

- **Power values:** Always in milliwatts (W * 1000) as signed 32-bit integers
- **Network byte order:** Big-endian for multi-byte values
- **String encoding:** UTF-8 with null termination where applicable
- **Error handling:** ASCII error messages for debugging

## Python Simulation Example

The `esp32_board_simulation.py` demonstrates the protocol implementation:

```python
import struct
import requests

class ESP32BoardSimulator:
    def login(self) -> bool:
        """Authenticate with the API and get JWT token"""
        response = requests.post(f"{COREAPI_URL}/login", 
                               json={
                                   'username': self.username,
                                   'password': self.password
                               })
        
        if response.status_code == 200:
            data = response.json()
            self.token = data['token']
            self.headers = {'Authorization': f'Bearer {self.token}'}
            return True
        return False
    
    def register_board(self) -> bool:
        """Register the board with empty body - board ID from JWT"""
        response = requests.post(f"{COREAPI_URL}/register",
                               data=b'',  # Empty data
                               headers={**self.headers, 'Content-Type': 'application/octet-stream'})
        return response.status_code == 200

    def send_power_data(self, production: float, consumption: float) -> bool:
        # Convert W to mW as signed integers
        prod_int = int(production * 1000)
        cons_int = int(consumption * 1000)
        
        # Pack as big-endian signed integers
        data = struct.pack('>ii', prod_int, cons_int)
        
        response = requests.post(f"{COREAPI_URL}/post_vals",
                               data=data,
                               headers={**self.headers, 'Content-Type': 'application/octet-stream'})
        return response.status_code == 200
    
    def report_connected_production(self, plant_ids: list) -> bool:
        count = len(plant_ids)
        data = struct.pack('B', count)  # 1 byte count
        
        for plant_id in plant_ids:
            set_power = random.randint(500, 2000)  # Random set power in mW
            data += struct.pack('>Ii', plant_id, set_power)  # 4+4 bytes per entry
        
        response = requests.post(f"{COREAPI_URL}/prod_connected",
                               data=data,
                               headers={**self.headers, 'Content-Type': 'application/octet-stream'})
        return response.status_code == 200
    
    def report_connected_consumption(self, consumer_ids: list) -> bool:
        count = len(consumer_ids)
        data = struct.pack('B', count)  # 1 byte count
        
        for consumer_id in consumer_ids:
            data += struct.pack('>I', consumer_id)  # 4 bytes per entry
        
        response = requests.post(f"{COREAPI_URL}/cons_connected",
                               data=data,
                               headers={**self.headers, 'Content-Type': 'application/octet-stream'})
        return response.status_code == 200
```

## Communication Flow

1. **Login** → Get JWT token
2. **Register** → Register board with server
3. **Report Connections** → Send connected devices
4. **Main Loop:**
   - Poll for game coefficients
   - Send current power data
   - Wait 3-5 seconds
   - Repeat

## Network Considerations

- **Poll interval:** 3-5 seconds (battery conservation)
- **Retry logic:** Exponential backoff on failures
- **Connection reuse:** Keep-alive when possible
- **Timeout:** 10-15 second timeouts for ESP32
- **Error recovery:** Re-authenticate on 401 responses
