#!/bin/bash

# Setup script for creating predefined lecturer accounts in production

echo "Setting up predefined lecturer accounts..."

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until docker-compose exec postgres pg_isready -U supertokens 2>/dev/null; do
    echo "Waiting for database..."
    sleep 2
done

# Wait for SuperTokens Core to be ready
echo "Waiting for SuperTokens Core to be ready..."
until curl -f http://localhost/coreapi/health 2>/dev/null; do
    echo "Waiting for services..."
    sleep 2
done

# Wait a bit more for everything to stabilize
sleep 5

# Run the user setup script inside the backend container
echo "Creating user accounts..."
docker-compose exec api npm run setup-users-prod

echo "Production setup complete!"
echo ""
echo "Available accounts:"
echo "- john.smith@university.edu / SecurePassword123!"
echo "- maria.garcia@university.edu / SecurePassword456!"
echo "- david.johnson@university.edu / SecurePassword789!"
echo "- admin@university.edu / AdminPassword123!"
