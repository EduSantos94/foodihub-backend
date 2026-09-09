# Setup Local - FoodiHub

Guia completo para setup local do projeto FoodiHub com 3 repos.

## 📋 Pré-requisitos

- **Git** - Controle de versão
- **Docker** & **Docker Compose** - Containerização (recomendado)
- **Node.js 26+** - Se rodar localmente sem Docker
- **PostgreSQL 16** - Se rodar sem Docker

## 🔧 Instalação

### Opção 1: Com Docker (Recomendado ✅)

Mais fácil, sem instalar dependências localmente.

#### 1. Clone / Prepare as Repos

Se começando do zero:
```bash
mkdir -p ~/Documentos/foodihub && cd ~/Documentos/foodihub

git clone <backend-url> backend
git clone <frontend-url> frontend
git clone <config-url> config
```

Ou se já existem (monorepo):
```bash
cd ~/Documentos/foodihub
# backend/, frontend/, config/ já devem estar aqui
```

#### 2. Setup Environment

```bash
cd config

# Copiar arquivo de exemplo
cp .env.example .env

# Editar se necessário (padrões já servem para dev)
# vim .env
```

#### 3. Build & Start

```bash
# Build imagens Docker
docker compose build

# Start serviços em background
docker compose up -d

# Verificar status
docker compose ps
```

#### 4. Primeiras Migrations

```bash
# Rodar migrations + seeders
docker compose exec backend npm run migrate:seed

# Output esperado:
# ✓ Database connected
# 📦 Found 1 migration(s)
# ✓ Completed: 001_initial_schema.sql
# ✅ All migrations completed successfully!
```

#### 5. Verificar Tudo Funciona

```bash
# Backend
curl http://localhost:3333/health
# {"status":"ok","version":"1.0.0"}

# Frontend (pode levar 1-2 min na primeira vez)
curl http://localhost:3000/
```

✅ **Pronto!** Todos os serviços rodando.

---

### Opção 2: Local (sem Docker)

Requer instalação local de dependências.

#### Backend

```bash
cd backend

# Instalar Node.js 26+ antes

# Dependências
npm install

# Setup DB local (PostgreSQL deve estar rodando)
createdb -U postgres foodihub

# Migrations
npm run migrate
npm run migrate:seed

# Dev server
npm run dev
# http://localhost:3333
```

#### Frontend

```bash
cd frontend

# Instalar Node.js 18+ antes

# Instalar Expo CLI global
npm install -g expo-cli

# Dependências
npm install

# Dev server (Expo)
npm start

# Opções:
# - Press 'i' → iOS Simulator
# - Press 'a' → Android Emulator
# - Scan QR Code → Expo Go app
```

#### Database

```bash
# Instalar PostgreSQL 16
# macOS: brew install postgresql@16
# Ubuntu: sudo apt install postgresql-16
# Windows: https://www.postgresql.org/download/

# Criar DB
createdb -U postgres foodihub

# Seed inicial
cd backend && npm run migrate:seed
```

---

## 🔌 Conectar aos Serviços

### Backend API

```bash
# Health
curl http://localhost:3333/health

# API Info
curl http://localhost:3333/api

# Login (get JWT token)
curl -X POST http://localhost:3333/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@foodihub.local","password":"123456"}'
```

### Frontend

```bash
# Web (Expo Web)
http://localhost:3000

# Mobile (Expo Go app)
1. Download Expo Go do App Store / Play Store
2. Escanear QR Code no terminal
```

### Database

```bash
# Com Docker
docker compose exec db psql -U postgres -d foodihub

# Sem Docker (local)
psql -U postgres -d foodihub

# Queries úteis:
SELECT * FROM stores;
SELECT * FROM users;
SELECT * FROM audit_logs;
```

---

## 📝 Arquivo .env

Copiar de `.env.example` e editar conforme necessário:

```env
# Environment
NODE_ENV=development        # development | production

# Database
DB_USER=postgres            # Usuário PostgreSQL
DB_PASSWORD=postgres        # Senha PostgreSQL
DB_NAME=foodihub            # Nome do banco
DB_PORT=5432                # Porta PostgreSQL

# JWT
JWT_SECRET=dev_secret...    # MUDAR EM PRODUCTION!

# Ports
API_PORT=3333               # Backend
FRONTEND_PORT=3000          # Frontend
```

**Importante**: Nunca commitar `.env` com valores reais! Use `.env.example`.

---

## ✅ Checklist de Setup

- [ ] Docker & Docker Compose instalados
- [ ] Repos clonadas (backend/, frontend/, config/)
- [ ] `.env` criado de `.env.example`
- [ ] `docker compose build` executado
- [ ] `docker compose up -d` rodando
- [ ] `docker compose ps` mostra 4 containers
- [ ] `curl http://localhost:3333/health` retorna 200
- [ ] Migrations rodaram com sucesso
- [ ] Consegue fazer login com `admin@foodihub.local`

---

## 🚨 Problemas Comuns

### "Ports already in use"

```bash
# Encontrar processo
lsof -i :3333
lsof -i :3000

# Kill processo
kill -9 <PID>

# Ou mudar porta no .env
```

### "Cannot connect to database"

```bash
# Verificar container
docker compose ps db

# Ver logs
docker compose logs db

# Testar conexão
docker compose exec db pg_isready -U postgres

# Reset database
docker compose down -v
docker compose up -d db
docker compose exec backend npm run migrate:seed
```

### "Frontend cannot reach API"

```bash
# Backend rodando?
curl http://localhost:3333/health

# Check .env no config/
cat config/.env | grep API_URL

# Rebuild frontend
docker compose build --no-cache frontend
docker compose restart frontend
```

Ver mais em [docs/TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## 🎯 Próximos Passos

1. **Explorar API** - Ver endpoints em [docs/API.md](./API.md)
2. **Entender Arquitetura** - Ler [docs/ARCHITECTURE.md](./ARCHITECTURE.md)
3. **Começar Dev** - Ver [backend/README.md](../backend/README.md) e [frontend/README.md](../frontend/README.md)
4. **Contributing** - Ler [docs/CONTRIBUTING.md](./CONTRIBUTING.md)

---

**Precisa de help?** Ver [Troubleshooting](./TROUBLESHOOTING.md) ou abrir issue no repo.
