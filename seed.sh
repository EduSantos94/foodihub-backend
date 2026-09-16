#!/bin/bash
set -e

echo "🌱 Running seeders..."
docker compose exec -T backend npm run migrate:seed

echo "✅ Seeders completed!"
