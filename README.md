# FoodiHub Backend

Backend API com arquitetura MVC, JWT authentication e PostgreSQL.

## Arquitetura

```
src/
├── controllers/     HTTP handlers (AuthController, StoreController, UserController)
├── services/        Business logic (AuthService, StoreService, UserService)
├── routes/          Express routes (auth.routes, store.routes, user.routes)
├── middleware/      Authentication middleware (JWT + role-based access)
├── types/           TypeScript interfaces e tipos
└── database/
    ├── models/      TypeORM entities (StoreModel, UserModel, AuditLogModel)
    ├── migrations/  SQL migration files
    └── seeders/     Seed data para desenvolvimento
```

## Documentação

- [Setup](./docs/SETUP.md) - Instalação e configuração
- [API Reference](./docs/API.md) - Endpoints e autenticação
- [Architecture](./docs/ARCHITECTURE.md) - Decisões de design
- [Troubleshooting](./docs/TROUBLESHOOTING.md) - Problemas comuns
- [Contributing](./docs/CONTRIBUTING.md) - Guia de contribuição
- [Database](./docs/database/README.md) - Migrations e seeders

## Desenvolvimento Local

### Pré-requisitos
- Node.js 26+
- PostgreSQL 16+ ou Docker

### Setup

```bash
# Instalar dependências
npm install

# Copiar variáveis de ambiente
cp .env.dev .env

# Rodar migrations (com docker-compose rodando)
npm run migrate

# Rodar seeders
npm run migrate:seed
```

### Dev Server

```bash
npm run dev
```

Servidor rodando em `http://localhost:3333`

## Build & Deploy

### Build

```bash
npm run build
```

Compilado em `dist/`

### Docker

```bash
docker build -t foodihub-backend .
docker run -p 3333:3333 foodihub-backend
```

Ou via `docker-compose` (ver em `../config/docker-compose.yml`)

## Variáveis de Ambiente

```env
NODE_ENV=development|production
PORT=3333                           # Porta do servidor
DB_HOST=localhost                   # Host PostgreSQL
DB_PORT=5432                        # Porta PostgreSQL
DB_USER=postgres                    # Usuário DB
DB_PASSWORD=postgres                # Senha DB
DB_NAME=foodihub                    # Nome do banco
JWT_SECRET=seu_secret_aqui          # Chave JWT (change in production!)
```

## API Endpoints

### Health & Info
- `GET /health` - Health check
- `GET /api` - API info

### Autenticação
- `POST /auth/register` - Registrar novo usuário
- `POST /auth/login` - Login com email/senha
- `POST /auth/logout` - Logout

### Stores
- `GET /api/stores` - Listar lojas (requer JWT)
- `GET /api/stores/:id` - Obter loja (requer JWT)
- `POST /api/stores` - Criar loja (requer JWT + ADMIN)
- `PUT /api/stores/:id` - Atualizar loja (requer JWT + ADMIN)
- `DELETE /api/stores/:id` - Deletar loja (requer JWT + ADMIN)

### Users
- `GET /api/users` - Listar usuários (requer JWT + MANAGER/ADMIN)
- `GET /api/users/:id` - Obter usuário (requer JWT)
- `POST /api/users` - Criar usuário (requer JWT + MANAGER/ADMIN)
- `PUT /api/users/:id` - Atualizar usuário (requer JWT)
- `POST /api/users/:id/change-password` - Trocar senha (requer JWT)

## Authentication

Todas as rotas protegidas usam JWT Bearer token:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3333/api/stores
```

## Scripts

- `npm run dev` - Dev server com hot reload
- `npm run build` - Build para production
- `npm run start` - Rodar build compilado
- `npm run migrate` - Rodar migrations SQL
- `npm run migrate:seed` - Rodar migrations + seeders
- `npm run lint` - ESLint (se configurado)
- `npm run test` - Run tests (se configurado)

## Troubleshooting

### "Cannot connect to database"
- Verificar se PostgreSQL está rodando
- Verificar variáveis de ambiente `.env`
- Ver logs: `docker logs foodihub_db`

### "ReferenceError: Cannot access Model before initialization"
- Limpar `dist/`: `rm -rf dist`
- Rebuild: `npm run build`
- Restart container

## Support

Para issues ou dúvidas, abrir issue na repo ou contactar time backend.
