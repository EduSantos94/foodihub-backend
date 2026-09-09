# FoodiHub API Reference

Documentação completa dos endpoints REST da API Backend.

## 🔐 Autenticação

Todos os endpoints protegidos usam **JWT Bearer Token**.

### Headers Padrão

```http
Authorization: Bearer <token>
Content-Type: application/json
```

### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "admin@foodihub.local",
  "password": "123456"
}
```

**Response (200)**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "admin@foodihub.local",
    "first_name": "Admin",
    "last_name": "User",
    "role": "ADMIN"
  }
}
```

### Register

```http
POST /auth/register
Content-Type: application/json

{
  "email": "novo@example.com",
  "password": "senha123",
  "first_name": "João",
  "last_name": "Silva"
}
```

**Response (201)**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "novo@example.com",
    "first_name": "João",
    "last_name": "Silva",
    "role": "STAFF"
  }
}
```

---

## 🏪 Stores Endpoints

### Listar Stores

```http
GET /api/stores?page=1&limit=10
Authorization: Bearer <token>
```

**Response (200)**:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Mercado Central",
      "email": "contato@mercadocentral.com",
      "phone": "11999999999",
      "document": "12345678000195",
      "address": "Rua A, 123",
      "city": "São Paulo",
      "state": "SP",
      "zip_code": "01000000",
      "country": "Brasil",
      "active": true,
      "created_at": "2026-09-01T10:00:00Z",
      "updated_at": "2026-09-01T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "total_pages": 5
  }
}
```

### Obter Store Específica

```http
GET /api/stores/:id
Authorization: Bearer <token>
```

**Response (200)**: Store object

**Response (404)**:
```json
{
  "success": false,
  "error": "Store not found"
}
```

### Criar Store

**Requer**: `ADMIN` role

```http
POST /api/stores
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Nova Loja",
  "email": "nova@loja.com",
  "phone": "11988888888",
  "document": "12345678000196",
  "address": "Rua B, 456",
  "city": "Rio de Janeiro",
  "state": "RJ",
  "zip_code": "20000000",
  "country": "Brasil"
}
```

**Response (201)**: Store object

### Atualizar Store

**Requer**: `ADMIN` role

```http
PUT /api/stores/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Loja Atualizada",
  "phone": "11987654321",
  "active": true
}
```

**Response (200)**: Store object atualizado

### Deletar Store

**Requer**: `ADMIN` role

```http
DELETE /api/stores/:id
Authorization: Bearer <token>
```

**Response (204)**: No content

---

## 👥 Users Endpoints

### Listar Usuários

**Requer**: `MANAGER` ou `ADMIN` role

```http
GET /api/users?page=1&limit=10
Authorization: Bearer <token>
```

**Response (200)**:
```json
{
  "data": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "first_name": "João",
      "last_name": "Silva",
      "phone": "11999999999",
      "role": "STAFF",
      "active": true,
      "created_at": "2026-09-01T10:00:00Z",
      "updated_at": "2026-09-01T10:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

### Obter Usuário

```http
GET /api/users/:id
Authorization: Bearer <token>
```

### Criar Usuário

**Requer**: `MANAGER` ou `ADMIN` role

```http
POST /api/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "novo@example.com",
  "password": "senha123",
  "first_name": "Maria",
  "last_name": "Santos",
  "phone": "11987654321",
  "role": "STAFF"
}
```

**Roles disponíveis**: `ADMIN`, `MANAGER`, `STAFF`

### Atualizar Usuário

```http
PUT /api/users/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "first_name": "Maria Atualizada",
  "phone": "11988888888"
}
```

### Trocar Senha

```http
POST /api/users/:id/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "current_password": "senha_antiga",
  "new_password": "senha_nova"
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

### Deactivar Usuário

```http
DELETE /api/users/:id
Authorization: Bearer <token>
```

---

## ℹ️ Info Endpoints

### Health Check

```http
GET /health
```

**Response (200)**:
```json
{
  "status": "ok",
  "timestamp": "2026-09-09T04:13:37.350Z",
  "version": "1.0.0"
}
```

### API Info

```http
GET /api
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Welcome to FoodiHub Backend API",
  "version": "1.0.0",
  "endpoints": {
    "auth": "/auth",
    "stores": "/api/stores",
    "users": "/api/users"
  }
}
```

---

## 🔄 Status Codes

| Code | Significado         |
|------|-------------------|
| 200  | OK - Sucesso      |
| 201  | Created - Criado  |
| 204  | No Content - OK   |
| 400  | Bad Request       |
| 401  | Unauthorized      |
| 403  | Forbidden         |
| 404  | Not Found         |
| 500  | Server Error      |

---

## 📊 Query Parameters

### Pagination

```http
GET /api/stores?page=2&limit=20
```

- `page` (default: 1) - Número da página
- `limit` (default: 10) - Items por página

### Filter (quando suportado)

```http
GET /api/stores?active=true&city=São Paulo
```

---

## 🔑 Roles & Permissions

| Role    | Stores | Users | Audit |
|---------|--------|-------|-------|
| ADMIN   | ✅ R/W | ✅ R/W | ✅ R  |
| MANAGER | ✅ R   | ✅ R/W | ✅ R  |
| STAFF   | ✅ R   | ⚠️ Own | ❌    |

**R** = Read | **W** = Write | **Own** = Dados próprios | **Audit** = Audit logs

---

## 💡 Exemplos cURL

### Login

```bash
curl -X POST http://localhost:3333/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@foodihub.local",
    "password": "123456"
  }'
```

### Listar Stores com Token

```bash
TOKEN="eyJhbGci..."

curl http://localhost:3333/api/stores \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

### Criar Store

```bash
TOKEN="eyJhbGci..."

curl -X POST http://localhost:3333/api/stores \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nova Loja",
    "email": "loja@example.com",
    "phone": "11999999999",
    "document": "12345678000196",
    "address": "Rua A, 100",
    "city": "São Paulo",
    "state": "SP",
    "zip_code": "01000000",
    "country": "Brasil"
  }'
```

### Mudar Senha

```bash
TOKEN="eyJhbGci..."
USER_ID="550e8400..."

curl -X POST http://localhost:3333/api/users/$USER_ID/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "current_password": "senha_antiga",
    "new_password": "senha_nova"
  }'
```

---

## 🧪 Testar com Postman

1. Import `API.postman_collection.json` (gerado automaticamente)
2. Configurar variáveis:
   - `baseUrl`: http://localhost:3333
   - `token`: Obter via POST /auth/login
3. Run collection

---

## 📞 Support

- Issues: Abrir no repositório backend
- Docs: Ver [ARCHITECTURE.md](./ARCHITECTURE.md)
- Backend: Ver [backend/README.md](../backend/README.md)

---

**Base URL**: http://localhost:3333 (desenvolvimento)
