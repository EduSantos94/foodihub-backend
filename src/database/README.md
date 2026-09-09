# Database Structure

Esta é a organização do banco de dados FoodiHub.

## Estrutura de Pastas

```
src/database/
├── models/                  # TypeORM entities
│   ├── StoreModel.ts       # Loja/Restaurante
│   ├── UserModel.ts        # Usuário
│   └── AuditLogModel.ts    # Log de auditoria
│
├── queries/                 # CRUD operations
│   ├── StoreQueries.ts     # Operações com lojas
│   ├── UserQueries.ts      # Operações com usuários
│   └── AuditLogQueries.ts  # Operações com logs
│
├── migrations/              # Histórico de mudanças
│   ├── 001_create_stores_table.sql
│   ├── 002_create_users_table.sql
│   ├── 003_create_audit_logs_table.sql
│   └── 004_add_user_phone_field.sql
│
├── seeders/                 # Dados iniciais
│   ├── StoreSeed.ts        # Seed de lojas
│   ├── UserSeed.ts         # Seed de usuários
│   ├── AuditLogSeed.ts     # Seed de auditoria
│   └── index.ts            # Executor de seeds
│
├── connection.ts           # Configuração TypeORM
└── index.ts               # Exportações centralizadas
```

---

## Models

### StoreModel (Loja)
Representa um restaurante/loja no sistema.

```typescript
- id: UUID (PK)
- name: string
- email: string (unique)
- phone: string
- document: string (unique) - CPF/CNPJ
- address: string
- city: string
- state: string (2 chars)
- zip_code: string
- country: string
- active: boolean
- created_at: timestamp
- updated_at: timestamp
- deleted_at: timestamp (soft delete)
```

**Relações:**
- 1 Store → N Users
- 1 Store → N AuditLogs

---

### UserModel (Usuário)
Usuário/Staff de uma loja.

```typescript
- id: UUID (PK)
- store_id: UUID (FK) → Store
- email: string (unique)
- password_hash: string
- first_name: string
- last_name: string
- phone: string
- role: enum (admin, manager, staff)
- active: boolean
- last_login: timestamp
- created_at: timestamp
- updated_at: timestamp
- deleted_at: timestamp (soft delete)
```

**Regra:** Um usuário pertence a UMA ÚNICA LOJA.
**Roles:**
- `admin` - Acesso total à loja
- `manager` - Gerenciar operações
- `staff` - Acesso limitado

---

### AuditLogModel (Auditoria)
Log imutável de todas as ações.

```typescript
- id: UUID (PK)
- store_id: UUID (FK) → Store
- user_id: UUID (FK, nullable) → User
- action: enum (CREATE, UPDATE, DELETE, READ, LOGIN, LOGOUT)
- entity_type: string - tipo de entidade modificada
- entity_id: UUID - ID da entidade
- old_values: JSONB - valores antigos
- new_values: JSONB - valores novos
- ip_address: string
- user_agent: string
- description: string
- status: enum (success, error)
- error_message: string
- created_at: timestamp
```

---

## Queries (CRUD Operations)

### StoreQueries
```typescript
// Create
create(data: Partial<StoreModel>): Promise<StoreModel>

// Read
findById(id: string): Promise<StoreModel | null>
findByEmail(email: string): Promise<StoreModel | null>
findByDocument(document: string): Promise<StoreModel | null>
findAll(): Promise<StoreModel[]>
findActive(): Promise<StoreModel[]>
findByCity(city: string): Promise<StoreModel[]>

// Update
update(id: string, data: Partial<StoreModel>): Promise<StoreModel | null>
toggleActive(id: string): Promise<StoreModel | null>

// Delete
delete(id: string): Promise<boolean>
softDelete(id: string): Promise<boolean>
restore(id: string): Promise<boolean>

// Analytics
countTotal(): Promise<number>
countActive(): Promise<number>
findWithUsers(id: string): Promise<StoreModel | null>
```

### UserQueries
```typescript
// Create
create(data: Partial<UserModel>): Promise<UserModel>

// Read
findById(id: string): Promise<UserModel | null>
findByEmail(email: string): Promise<UserModel | null>
findByStoreId(storeId: string): Promise<UserModel[]>
findAdminsByStoreId(storeId: string): Promise<UserModel[]>
findByRole(role: UserRole): Promise<UserModel[]>
findByStoreAndRole(storeId: string, role: UserRole): Promise<UserModel[]>

// Update
update(id: string, data: Partial<UserModel>): Promise<UserModel | null>
updateLastLogin(id: string): Promise<UserModel | null>
toggleActive(id: string): Promise<UserModel | null>
updateRole(id: string, role: UserRole): Promise<UserModel | null>

// Delete
delete(id: string): Promise<boolean>
softDelete(id: string): Promise<boolean>
restore(id: string): Promise<boolean>

// Analytics
countTotal(): Promise<number>
countByStore(storeId: string): Promise<number>
countAdminsByStore(storeId: string): Promise<number>
```

### AuditLogQueries
```typescript
// Create
create(data: Partial<AuditLogModel>): Promise<AuditLogModel>

// Read
findByStoreId(storeId: string, limit?: number): Promise<AuditLogModel[]>
findByUserId(userId: string, limit?: number): Promise<AuditLogModel[]>
findByAction(action: AuditAction): Promise<AuditLogModel[]>
findByEntityType(entityType: string): Promise<AuditLogModel[]>
findByEntityId(entityId: string): Promise<AuditLogModel[]>
findByDateRange(startDate: Date, endDate: Date): Promise<AuditLogModel[]>

// Analytics
countByStore(storeId: string): Promise<number>
getActivitySummary(storeId: string): Promise<Record<string, number>>
```

---

## Migrations

Versionadas com números sequenciais:

- **001** - Criar tabela stores
- **002** - Criar tabela users
- **003** - Criar tabela audit_logs
- **004** - Adicionar campo phone em users

Para adicionar nova migration:
1. Criar arquivo `005_describe_change.sql`
2. Manter ordem numérica
3. Adicionar comments
4. Testar localmente

---

## Seeders

### Uso Básico

```typescript
import { database } from './database';

// Inicializar
await database.initialize();

// Rodar seeders
await database.runSeeds();

// Limpar dados (cuidado!)
await database.cleanDatabase();

// Fechar conexão
await database.close();
```

### Seed Específicos

```typescript
// Seed de lojas
await database.seedStores.seedDemoStore();
await database.seedStores.seedMultipleStores(10);

// Seed de usuários
await database.seedUsers.seedAdminUser(storeId);
await database.seedUsers.seedDemoUsers(storeId);

// Seed de auditoria
await database.seedAuditLogs.seedLoginAudit(storeId, userId);
```

---

## DatabaseService

Classe central que centraliza todas as operações:

```typescript
import { database } from './database';

// Acessar queries
await database.users.findByEmail('admin@demo.com');
await database.stores.findActive();
await database.auditLogs.findByStoreId(storeId);

// Acessar seeders
await database.seedUsers.seedAdminUser(storeId);
```

---

## Dados Demo

**Loja Demo:**
- Email: demo@foodihub.com
- Document: 12345678901234

**Usuários Demo:**
- Admin: admin@demo.com / senha: admin123
- Manager: manager@demo.com / senha: manager123
- Staff: staff@demo.com / senha: staff123

---

## Relacionamentos

```
Stores (1) ─────── (N) Users
  │
  └─── Usuário pertence a UMA ÚNICA loja
  └─── Uma loja pode ter múltiplos admins

Stores (1) ─────── (N) AuditLogs
Users (1) ─────── (N) AuditLogs (nullable)
  │
  └─── Registra quem fez o quê e quando
```

---

## Boas Práticas

1. **Sempre usar soft delete** para manter auditoria
2. **Log todas as operações** em audit_logs
3. **Validar email único** antes de criar usuário
4. **Verificar store_id** para operações multi-tenant
5. **Usar prepared statements** para evitar SQL injection
6. **Hash de senha** sempre com bcrypt

---

## Troubleshooting

**Conexão recusada:**
```bash
# Verificar se Docker está rodando
docker compose ps

# Conectar manualmente
docker exec -it foodihub_db psql -U postgres -d foodihub
```

**Migrations não rodaram:**
```bash
# Manualmente executar SQL
docker exec -it foodihub_db psql -U postgres -d foodihub < migration.sql
```

**Limpar tudo:**
```bash
docker compose down -v
docker compose up --build
```
