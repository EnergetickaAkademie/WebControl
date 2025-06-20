#!/bin/bash

# Setup script for creating predefined lecturer accounts in production

echo "Setting up predefined lecturer accounts..."

# Wait for the backend to be ready
echo "Waiting for backend to be ready..."
until curl -f http://localhost/api/health 2>/dev/null; do
    sleep 2
done

# Run the user setup script inside the backend container
docker-compose exec api npm run setup-users

echo "Production setup complete!"
