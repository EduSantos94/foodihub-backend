# Troubleshooting - FoodiHub

Soluções para problemas comuns encontrados no setup e desenvolvimento.

## 🔧 Problemas Gerais

### "Port already in use"

**Problema**: `Error: listen EADDRINUSE: address already in use :::3333`

**Solução**:
```bash
# Encontrar processo usando porta
lsof -i :3333

# Kill processo
kill -9 <PID>

# Ou usar porta diferente
PORT=3334 npm run dev
```

### "Cannot find module"

**Problema**: `Cannot find module './database'`

**Solução**:
```bash
# Limpar node_modules e reinstalar
rm -rf node_modules package-lock.json
npm install

# Recompile TypeScript
npm run build
```

---

## 🐳 Docker Issues

### "Docker daemon is not running"

**Problema**: `Cannot connect to Docker daemon`

**Solução (macOS)**:
```bash
# Abrir Docker Desktop ou:
open /Applications/Docker.app
```

**Solução (Ubuntu)**:
```bash
sudo systemctl start docker
```

### "Container exits immediately"

**Problema**: Container criado mas sai logo depois

**Solução**:
```bash
# Ver logs
docker compose logs <service>

# Rebuild sem cache
docker compose build --no-cache <service>

# Restart
docker compose restart <service>
```

### "docker: permission denied"

**Problema**: `Got permission denied while trying to connect to Docker daemon`

**Solução (Linux)**:
```bash
# Adicionar user ao grupo docker
sudo usermod -aG docker $USER

# Aplicar permissões (logout/login necessário)
newgrp docker
```

---

## 📊 Database Issues

### "Cannot connect to database"

**Problema**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solução**:
```bash
# Verificar se DB container está rodando
docker compose ps db

# Ver logs do DB
docker compose logs db

# Verificar saúde do DB
docker compose exec db pg_isready -U postgres

# Se necessário, resetar BD
docker compose down -v
docker compose up -d db
sleep 5
docker compose exec backend npm run migrate
```

### "Database already exists"

**Problema**: `ERROR: database "foodihub" already exists`

**Solução**:
```bash
# Remover database existente
docker compose exec db dropdb -U postgres foodihub

# Recriar
docker compose exec db createdb -U postgres foodihub

# Rodar migrations
docker compose exec backend npm run migrate
```

### "Migration failed"

**Problema**: Migrations não rodam ou com erro SQL

**Solução**:
```bash
# Ver logs detalhados
docker compose exec backend npm run migrate 2>&1 | tail -50

# Verificar arquivo SQL
cat backend/src/database/migrations/001_initial_schema.sql

# Limpar e reiniciar
docker compose down -v
docker compose up -d
docker compose exec backend npm run migrate:seed
```

### "Too many connections"

**Problema**: `FATAL: too many connections for role "postgres"`

**Solução**:
```bash
# Resetar conexões
docker compose exec db psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'foodihub';"

# Restart container
docker compose restart db
```

---

## 🔐 Authentication Issues

### "Invalid token" / "jwt expired"

**Problema**: JWT token inválido ou expirado

**Solução**:
```bash
# Login novamente para obter novo token
curl -X POST http://localhost:3333/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@foodihub.local","password":"123456"}'

# Copiar novo token
TOKEN="eyJhbGci..."

# Testar
curl http://localhost:3333/api/stores \
  -H "Authorization: Bearer $TOKEN"
```

### "Cannot find user"

**Problema**: Usuário não existe no seeders

**Solução**:
```bash
# Recriar seeders
docker compose exec backend npm run migrate:seed

# Ou criar manual
curl -X POST http://localhost:3333/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"novo@example.com",
    "password":"123456",
    "first_name":"Test",
    "last_name":"User"
  }'
```

---

## 🎨 Frontend Issues

### "Cannot reach API"

**Problema**: Frontend 404 ao chamar `/api/stores`

**Solução**:
```bash
# 1. Verificar backend rodando
curl http://localhost:3333/health

# 2. Verificar .env
cat config/.env | grep API_URL

# 3. Rebuild frontend
docker compose build --no-cache frontend
docker compose restart frontend

# 4. Se no simulador Android, usar gateway IP
VITE_API_URL=http://10.0.2.2:3333
```

### "Expo Metro not found"

**Problema**: `Cannot find module react-native`

**Solução**:
```bash
cd frontend

# Clean Expo cache
expo r -c

# Ou:
rm -rf node_modules
npm install
npm start
```

### "Port 3000 already in use"

**Problema**: Frontend não inicia

**Solução**:
```bash
lsof -i :3000
kill -9 <PID>

# Ou usar porta diferente
PORT=3001 npm start
```

---

## 🔙 Backend Issues

### "ReferenceError: Cannot access Model before initialization"

**Problema**: Circular dependency em models

**Solução**:
```bash
# Limpar dist e rebuild
cd backend
rm -rf dist
npm run build

# Se persiste:
docker compose build --no-cache backend
docker compose restart backend
```

### "TypeError: Cannot read property of undefined"

**Problema**: Service ou repository não inicializado

**Solução**:
```bash
# Verificar injeção de dependências
# Services devem chamar ensureRepository() antes de usar

# Ver logs
docker compose logs -f backend

# Restart
docker compose restart backend
```

### "Cannot POST /api/stores"

**Problema**: Route não encontrada ou não registrada

**Solução**:
```bash
# Verificar routes estão carregadas em server.ts
cat backend/src/server.ts | grep "app.use"

# Restart backend
docker compose restart backend

# Testar endpoint
curl http://localhost:3333/api
```

---

## 📝 Environment (.env) Issues

### "Cannot find .env"

**Problema**: `.env` não existe

**Solução**:
```bash
cd config
cp .env.example .env

# Editar se necessário
vim .env

# Reload services
docker compose down
docker compose up -d
```

### "Variable undefined in container"

**Problema**: Variável de `.env` não chega no container

**Solução**:
```bash
# 1. Verificar .env está no lugar certo
cat config/.env

# 2. Rebuild sem cache
docker compose build --no-cache

# 3. Verificar dentro do container
docker compose exec backend env | grep DB_HOST

# 4. Restart
docker compose restart backend
```

---

## 🌐 Network Issues

### "Cannot reach localhost:3333 from simulator"

**Problema**: Android emulator não consegue acessar host local

**Solução**:
```bash
# Android emulator usa IP especial:
EXPO_PUBLIC_API_URL=http://10.0.2.2:3333

# iOS simulator:
EXPO_PUBLIC_API_URL=http://localhost:3333

# Physical device:
EXPO_PUBLIC_API_URL=http://<your-computer-ip>:3333
```

### "CORS error"

**Problema**: `Access-Control-Allow-Origin` error

**Solução**:
```bash
# Verificar CORS middleware em backend
cat backend/src/server.ts | grep cors

# Adicionar se não existe:
app.use(cors());

# Restart backend
docker compose restart backend
```

---

## 🧹 Cleanup & Reset

### "Nothing works, start fresh"

```bash
# Full reset
docker compose down -v
rm -rf backend/dist
rm -rf frontend/dist
rm config/.env

# Reinstall
cp config/.env.example config/.env
docker compose build --no-cache

# Start fresh
docker compose up -d
docker compose exec backend npm run migrate:seed

# Verify
curl http://localhost:3333/health
```

### "Remove specific container"

```bash
docker compose down backend
docker compose build --no-cache backend
docker compose up -d backend
```

### "Prune everything (Docker)"

```bash
# ⚠️  CUIDADO: Remove todos containers, imagens e volumes não utilizados
docker system prune -a --volumes

# Depois:
docker compose build
docker compose up -d
```

---

## 📋 Checklist para Debugging

- [ ] Backend rodando? `curl http://localhost:3333/health`
- [ ] Database rodando? `docker compose exec db pg_isready`
- [ ] Redis rodando? `docker compose exec redis redis-cli ping`
- [ ] Logs sem erros? `docker compose logs | grep ERROR`
- [ ] .env preenchido? `cat config/.env`
- [ ] Migrations rodadas? `docker compose exec backend npm run migrate`
- [ ] Token válido? `curl -H "Authorization: Bearer <token>" http://localhost:3333/api/stores`

---

## 🆘 Ainda não funciona?

1. **Verificar logs** - `docker compose logs -f`
2. **Buscar error** - Procurar mensagem de erro no Google
3. **Limpar e resetar** - `docker compose down -v && docker compose build --no-cache`
4. **Abrir issue** - Com logs e descrição do erro

---

**Última atualização**: Set 2026
