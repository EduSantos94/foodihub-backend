# FoodiHub Architecture

Documento de arquitetura do projeto FoodiHub com decisões de design e estrutura de repos.

## 🏗️ Visão Geral

```
┌─────────────────┐
│   Frontend      │ React Native / Expo
│  (Port 3000)    │ - State: Context API
│                 │ - Auth: JWT + AsyncStorage
└────────┬────────┘
         │ HTTP REST
         ▼
┌─────────────────────────────────┐
│   Backend API (Port 3333)       │
│   Node.js + Express + MVC       │
│                                 │
│  ┌─ Controllers ──┐             │
│  ├─ Services ─────┤             │
│  └─ Routes ───────┘             │
└────────┬────────────────────────┘
         │
         ├──────────┬──────────┐
         ▼          ▼          ▼
    PostgreSQL   Redis    Audit Logs
    (Port 5432)  (6379)   (TypeORM)
```

## 📁 Estrutura de Repos

### 1. Backend Repository (`./backend`)

```
backend/
├── src/
│   ├── server.ts                    # Entry point
│   ├── controllers/                 # HTTP handlers
│   │   ├── AuthController.ts       # Login, Register
│   │   ├── StoreController.ts      # Store CRUD
│   │   └── UserController.ts       # User CRUD
│   ├── services/                    # Business logic
│   │   ├── AuthService.ts
│   │   ├── StoreService.ts
│   │   └── UserService.ts
│   ├── routes/                      # Express routes
│   │   ├── auth.routes.ts
│   │   ├── store.routes.ts
│   │   └── user.routes.ts
│   ├── middleware/
│   │   └── auth.ts                 # JWT validation
│   ├── types/
│   │   └── index.ts                # Interfaces
│   └── database/
│       ├── connection.ts            # TypeORM setup
│       ├── models/                  # Entities
│       │   ├── StoreModel.ts
│       │   ├── UserModel.ts
│       │   └── AuditLogModel.ts
│       ├── migrations/              # SQL files
│       └── seeders/                 # Initial data
├── package.json
├── tsconfig.json
├── Dockerfile
└── README.md
```

**Padrão: MVC (Model-View-Controller)**
- Controllers: Recebem requests HTTP
- Services: Lógica de negócio
- Models: Entities TypeORM / Database

### 2. Frontend Repository (`./frontend`)

```
frontend/
├── app/
│   ├── screens/                     # Telas
│   │   ├── LoginScreen.tsx
│   │   ├── DashboardScreen.tsx
│   │   ├── StoresScreen.tsx
│   │   └── UsersScreen.tsx
│   ├── components/                  # Componentes reutilizáveis
│   │   ├── Header.tsx
│   │   ├── Card.tsx
│   │   └── Button.tsx
│   ├── services/                    # API calls
│   │   ├── api.ts
│   │   └── auth.ts
│   ├── context/                     # React Context
│   │   └── AuthContext.tsx
│   ├── types/                       # TypeScript interfaces
│   │   └── index.ts
│   └── utils/                       # Utilidades
│       └── helpers.ts
├── app.json                         # Expo config
├── package.json
├── Dockerfile
└── README.md
```

**Stack: React Native + Expo**
- Multiplataforma (iOS, Android, Web)
- State: Context API
- HTTP: Axios + Interceptors

### 3. Config Repository (`./config`)

```
config/
├── docker-compose.yml              # Orquestração
├── .env.example                    # Variáveis exemplo
├── .env                            # Variáveis desenvolvimento
├── Makefile                        # Scripts auxiliares
├── README.md                       # Setup instructions
└── (docs compartilhada vai em ../)
```

**Responsibilidade:**
- Docker Compose centralizado
- Variáveis de ambiente
- Scripts de help (Makefile)
- Documentação de setup

---

## 🔄 Fluxo de Dados

### 1. Autenticação

```
User (Frontend)
    │
    ├─ POST /auth/login {email, password}
    │
    ▼
AuthController
    │
    ├─ Validar email/senha
    ├─ Hash password vs banco
    │
    ▼
AuthService
    │
    ├─ JWT.sign(user_id, secret)
    │
    ▼
Return Token
    │
    ├─ AsyncStorage.setItem('token', token)
    │
    ▼
Frontend armazena e envia em próximas requests
```

### 2. Protected Routes

```
Frontend Request
    │
    ├─ GET /api/stores
    ├─ Header: Authorization: Bearer <token>
    │
    ▼
Backend Middleware (auth.ts)
    │
    ├─ Extract token
    ├─ JWT.verify(token, secret)
    ├─ Validate user exists
    │
    ▼ (✅ Valid)
StoreController → StoreService → Database
    │
    ▼ (❌ Invalid)
Return 401 Unauthorized
```

### 3. CRUD Operation

```
StoreController.getStores()
    │
    ├─ Extract pagination {page, limit}
    │
    ▼
StoreService.getAllStores()
    │
    ├─ Repository.findAndCount()
    ├─ Offset = (page-1) * limit
    ├─ Query database
    │
    ▼
TypeORM (QueryBuilder)
    │
    ├─ SELECT * FROM stores
    ├─ WHERE deleted_at IS NULL
    ├─ OFFSET / LIMIT
    │
    ▼
Database (PostgreSQL)
    │
    ├─ Return data + total count
    │
    ▼
StoreService.mapToResponse()
    │
    ├─ Format response DTO
    │
    ▼
Frontend receives paginated data
```

---

## 🗄️ Database Schema

```sql
stores
├── id (UUID)
├── name (VARCHAR)
├── email (VARCHAR, UNIQUE)
├── phone (VARCHAR)
├── document (VARCHAR, UNIQUE)
├── address (VARCHAR)
├── city (VARCHAR)
├── state (VARCHAR)
├── zip_code (VARCHAR)
├── country (VARCHAR, default: Brasil)
├── active (BOOLEAN, default: true)
├── created_at (TIMESTAMP)
├── updated_at (TIMESTAMP)
└── deleted_at (TIMESTAMP, nullable)

users
├── id (UUID)
├── store_id (UUID, FK → stores)
├── email (VARCHAR, UNIQUE)
├── password_hash (VARCHAR)
├── first_name (VARCHAR)
├── last_name (VARCHAR)
├── phone (VARCHAR, nullable)
├── role (ENUM: ADMIN, MANAGER, STAFF)
├── active (BOOLEAN, default: true)
├── created_at (TIMESTAMP)
├── updated_at (TIMESTAMP)
└── deleted_at (TIMESTAMP, nullable)

audit_logs
├── id (UUID)
├── store_id (UUID, FK → stores)
├── user_id (UUID, FK → users, nullable)
├── action (ENUM: CREATE, UPDATE, DELETE, READ, LOGIN, LOGOUT)
├── entity_type (VARCHAR)
├── entity_id (UUID, nullable)
├── old_values (JSONB, nullable)
├── new_values (JSONB, nullable)
├── ip_address (VARCHAR, nullable)
├── user_agent (VARCHAR, nullable)
├── status (ENUM: success, error)
├── error_message (TEXT, nullable)
└── created_at (TIMESTAMP)
```

---

## 🔐 Segurança

### JWT Token

```typescript
// Payload
{
  iss: "FoodiHub",
  sub: "user_id",
  email: "user@example.com",
  role: "STAFF",
  iat: 1694212417,
  exp: 1694298817  // 24h
}

// Algoritmo: HS256 (HMAC SHA-256)
// Secret: JWT_SECRET from .env
```

### Roles & Permissions

```
ADMIN
  ├─ Gerenciar stores (create/update/delete)
  ├─ Gerenciar users (create/update/delete)
  └─ Ver audit logs

MANAGER
  ├─ Ler stores
  ├─ Gerenciar users da loja
  └─ Ver audit logs

STAFF
  ├─ Ler stores
  └─ Atualizar dados próprios
```

### Passwords

- Hash: bcrypt com salt 10
- Compare: bcrypt.compare()
- Never: Return hash em responses

---

## 📊 Error Handling

```typescript
// Padrão de resposta
{
  "success": false,
  "error": "descriptive message",
  "status_code": 400,
  "timestamp": "2026-09-09T10:00:00Z"
}

// HTTP Status Codes
200 - OK
201 - Created
400 - Bad Request
401 - Unauthorized (sem token)
403 - Forbidden (sem permissão)
404 - Not Found
500 - Server Error
```

---

## 🚀 Deployment

### Development

```bash
# Local com Docker Compose
cd config
docker compose up -d

# Ou local sem Docker
cd backend && npm run dev  # Terminal 1
cd frontend && npm start   # Terminal 2
```

### Production

```bash
# Build imagens
docker compose build

# Push para registry (Docker Hub, ECR, etc)
docker tag foodihub-backend:latest myregistry/foodihub-backend:1.0.0
docker push myregistry/foodihub-backend:1.0.0

# Deploy (K8s, ECS, Heroku, etc)
# ... específico da plataforma
```

---

## 🔄 CI/CD Pipeline (Ready)

```
Git Push (backend)
    │
    ├─ GitHub Actions
    ├─ npm ci
    ├─ npm run build
    ├─ npm run test (if configured)
    ├─ docker build
    ├─ docker push
    │
    ▼
Deploy to production
```

---

## 📈 Escalabilidade

### Horizontal Scaling

```
Load Balancer
    │
    ├─ Backend Pod 1
    ├─ Backend Pod 2
    └─ Backend Pod 3
         │
         └─ Shared PostgreSQL
         └─ Shared Redis
```

### Caching Layer (Redis)

```
Request → Redis (cached data)
              │
              ├─ Hit: Return cached
              └─ Miss: Query DB + Cache + Return
```

---

## 🔄 Decisões de Design

### Por que 3 Repos?

✅ **Vantagens**
- Scaling independente
- Deploy separado
- Equipes paralelas
- Versionamento independente
- CI/CD específico

❌ **Desvantagens**
- Mais complexo de clonar
- Múltiplos repos para gerir

### Por que MVC?

✅ **Controllers**: Lidam com HTTP
✅ **Services**: Lógica de negócio reutilizável
✅ **Models**: Entities TypeORM

### Por que TypeORM?

✅ Active Record pattern
✅ Suporta PostgreSQL
✅ Migrations automáticas
✅ Lazy loading

### Por que React Native/Expo?

✅ Code sharing (iOS/Android/Web)
✅ Fast development
✅ Hot reload
✅ OTA updates

---

## 📚 Referências

- Backend: `../backend/README.md`
- Frontend: `../frontend/README.md`
- Config: `../config/README.md`
- API: `./API.md`
- Setup: `./SETUP.md`

---

**Última atualização**: Set 2026
