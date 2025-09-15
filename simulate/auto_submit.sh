#!/usr/bin/env bash

# --- Configuration ---
SERVER_URL="http://localhost"
LECTURER_USERNAME="demo"
LECTURER_PASSWORD="demo123"
SUBMIT_INTERVAL=1

declare -A BOARD_DATA=(
  #["w1b1"]="1205;NUCLEAR:1200"
  ["w1b2"]="1500;WIND:500;PHOTOVOLTAIC:500;GAS:500"
  ["w1b3"]="1500;WIND:500;PHOTOVOLTAIC:500;COAL:500"
  ["w1b4"]="1500;WIND:1000;PHOTOVOLTAIC:500;"
  #["w1b5"]="1000;NUCLEAR:1000"
  #["w1b2"]="150;COAL:80;WIND:70;SOLAR:20"
  #["w1b3"]="90;NUCLEAR:400;HYDRO:60"
)

log() {
  echo "[$(date +'%H:%M:%S')] $1"
}

log "Attempting to log in as '$LECTURER_USERNAME'..."
LOGIN_RESPONSE=$(curl -s -X POST "$SERVER_URL/coreapi/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$LECTURER_USERNAME\", \"password\": \"$LECTURER_PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  log "Login failed. Could not extract token."
  log "Server response: $LOGIN_RESPONSE"
  exit 1
fi

log "Login successful. Token extracted."
log "Starting data submission loop..."

while true; do
  log "--- New submission round ---"
  for BOARD_ID in "${!BOARD_DATA[@]}"; do
	DATA="${BOARD_DATA[$BOARD_ID]}"
	IFS=';' read -ra PARTS <<< "$DATA"
	
	CONSUMPTION="${PARTS[0]}"
	
	POWER_GEN="{"
	TOTAL_PRODUCTION=0
	for ((i=1; i<${#PARTS[@]}; i++)); do
	  IFS=':' read -ra PLANT <<< "${PARTS[i]}"
	  PLANT_TYPE="${PLANT[0]}"
	  PLANT_PRODUCTION="${PLANT[1]}"
	  
	  if [ $i -gt 1 ]; then
		POWER_GEN="$POWER_GEN,"
	  fi
	  POWER_GEN="$POWER_GEN\"$PLANT_TYPE\":$PLANT_PRODUCTION"
	  TOTAL_PRODUCTION=$((TOTAL_PRODUCTION + PLANT_PRODUCTION))
	done
	POWER_GEN="$POWER_GEN}"

	JSON_PAYLOAD=$(printf '{"board_id": "%s", "production": %d, "consumption": %d, "power_generation_by_type": %s}' "$BOARD_ID" "$TOTAL_PRODUCTION" "$CONSUMPTION" "$POWER_GEN")

	log "Submitting data for Board $BOARD_ID: Total P=$TOTAL_PRODUCTION, C=$CONSUMPTION"

	SUBMIT_RESPONSE=$(curl -s -X POST "$SERVER_URL/coreapi/lecturer/submit_board_data" \
	  -H "Authorization: Bearer $TOKEN" \
	  -H "Content-Type: application/json" \
	  -d "$JSON_PAYLOAD")

	SUCCESS=$(echo "$SUBMIT_RESPONSE" | jq -r '.success')
	if [ "$SUCCESS" != "true" ]; then
	  log "Warning: Submission for Board $BOARD_ID might have failed."
	  log "Response: $SUBMIT_RESPONSE"
	fi
  done
  
  log "Round complete. Waiting for $SUBMIT_INTERVAL seconds..."
  log ""
  sleep "$SUBMIT_INTERVAL"
done
