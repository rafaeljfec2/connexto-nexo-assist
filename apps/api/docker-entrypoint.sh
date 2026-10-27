#!/bin/sh
set -eu

echo "Running database migrations..."
node dist/db/migrate.js

echo "Running database seed (idempotent)..."
node dist/db/seed.js

echo "Starting API..."
exec node dist/main.js
