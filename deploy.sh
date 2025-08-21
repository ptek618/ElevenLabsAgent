#!/bin/bash


echo "=== ElevenLabs-Sonar Service Deployment ==="
echo "Docker image: elevenlabs-sonar-tools"
echo "Local port: 8080"
echo ""

echo "Testing local Docker container..."
docker run -d --name elevenlabs-test -p 8081:8080 \
  -e SONAR_API_URL="${SONAR_API_URL}" \
  -e SONAR_API_KEY="${SONAR_API_KEY}" \
  -e LOCAL_TOOL_API_KEY="${LOCAL_TOOL_API_KEY}" \
  elevenlabs-sonar-tools

sleep 5

echo "Testing health endpoint..."
curl -s http://localhost:8081/healthz || echo "Health check failed"

docker stop elevenlabs-test && docker rm elevenlabs-test

echo ""
echo "Local Docker test completed."
echo "Ready for cloud deployment."
