#!/bin/bash
# Generate JWT secrets for InfoSec application
# Usage: source env.template.sh

echo "Generating JWT secrets..."

# Generate 32-byte hex strings (64 hex characters)
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)

echo ""
echo "========== GENERATED SECRETS =========="
echo "Copy these to your .env file:"
echo "========== GENERATED SECRETS =========="
echo ""
echo "JWT_SECRET=$JWT_SECRET"
echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
echo ""
echo "========== ========== =========="
echo ""
echo "Or run: ./env.template.sh >> .env"
