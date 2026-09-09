#!/bin/bash

# Migration Runner Script
# Facilita a execução de migrations dentro ou fora do Docker

set -e

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== FoodiHub Migration Runner ===${NC}\n"

# Detectar se está dentro de um container Docker
if [ -f /.dockerenv ]; then
    echo -e "${GREEN}✓ Running inside Docker${NC}\n"
    IS_DOCKER=true
else
    echo -e "${YELLOW}ℹ Running locally${NC}\n"
    IS_DOCKER=false
fi

# Função para executar migrations
run_migrations() {
    echo -e "${BLUE}Running migrations...${NC}\n"
    
    if [ "$IS_DOCKER" = true ]; then
        npm run migrate
    else
        cd "$(dirname "$0")"
        npm run migrate
    fi
    
    echo -e "\n${GREEN}✅ Migrations completed!${NC}\n"
}

# Função para executar migrations + seeders
run_migrations_with_seed() {
    echo -e "${BLUE}Running migrations + seeders...${NC}\n"
    
    if [ "$IS_DOCKER" = true ]; then
        npm run migrate:seed
    else
        cd "$(dirname "$0")"
        npm run migrate:seed
    fi
    
    echo -e "\n${GREEN}✅ Migrations and seeds completed!${NC}\n"
}

# Processar argumentos
case "$1" in
    seed)
        run_migrations_with_seed
        ;;
    *)
        run_migrations
        ;;
esac
