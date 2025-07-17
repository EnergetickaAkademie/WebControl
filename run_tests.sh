#!/bin/bash
# Test runner for the WebControl system

echo "🧪 WebControl System Test Runner"
echo "================================"

echo "🔧 Building and starting services..."
docker-compose down
docker rmi webcontrol-coreapi-1 2>/dev/null || true
docker-compose up --build -d

echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if services are running
if ! curl -s http://localhost/coreapi/health > /dev/null; then
    echo "❌ CoreAPI is not responding. Check docker logs:"
    docker-compose logs coreapi
    exit 1
fi

echo "✅ Services are ready!"

echo ""
echo "🤖 Testing ESP32 board simulation..."
python3 esp32_board_simulation.py &
BOARD_PID=$!

echo "⏳ Waiting for boards to register..."
sleep 5

echo ""
echo "👨‍🏫 Testing lecturer interface..."
python3 test_lecturer_interface.py

echo ""
echo "🛑 Stopping board simulation..."
kill $BOARD_PID 2>/dev/null || true

echo ""
echo "📋 Checking logs..."
echo "--- CoreAPI Logs ---"
docker-compose logs --tail=20 coreapi

echo ""
echo "✅ Test completed!"
echo ""
echo "💡 To run manual tests:"
echo "   - Board simulation: python3 esp32_board_simulation.py"
echo "   - Lecturer interface: python3 test_lecturer_interface.py"
echo "   - Access frontend: http://localhost"
echo "   - API health check: curl http://localhost/coreapi/health"
