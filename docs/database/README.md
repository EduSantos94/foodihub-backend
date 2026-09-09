# Banco de Dados FoodiHub

Documentação completa sobre a estrutura e uso do banco de dados.

## 📋 Índice

- [Models](#models) - Entidades e estrutura
- [Queries](#queries-crud-operations) - Operações de dados
- [Migrations](./MIGRATIONS.md) - Scripts de atualização
- [Seeders](./SEEDERS.md) - Dados de teste

---

## Models

### StoreModel (Loja)

Representa um restaurante/loja no sistema.

```typescript
{
  id: UUID (PK)
  name: string
  email: string (unique)
  phone: string?
  document: string (unique) - CPF/CNPJ
  address: string?
  city: string?
  state: string? (2 chars)
  zip_code: string?
  country: string
  active: boolean
  created_at: Date
  updated_at: Date
  deleted_at: Date? (soft delete)
}
```

**Relações:**
- 1 Store → N Users
- 1 Store → N AuditLogs

---

### UserModel (Usuário)

Usuário/Staff de uma loja.

```typescript
{
  id: UUID (PK)
  store_id: UUID (FK) → Store
  email: string (unique)
  password_hash: string
  first_name: string
  last_name: string?
  phone: string?
  role: enum (admin, manager, staff)
  active: boolean
  last_login: Date?
  created_at: Date
  updated_at: Date
  deleted_at: Date? (soft delete)
}
```

**Regra de Negócio:** Um usuário pertence a UMA ÚNICA loja.

**Roles:**
- `admin` - Acesso total à loja
- `manager` - Gerenciar operações
- `staff` - Acesso limitado

---

### AuditLogModel (Auditoria)

Log imutável de todas as ações.

```typescript
{
  id: UUID (PK)
  store_id: UUID (FK) → Store
  user_id: UUID (FK, nullable) → User
  action: enum (CREATE, UPDATE, DELETE, READ, LOGIN, LOGOUT)
  entity_type: string - tipo de entidade
  entity_id: UUID?
  old_values: JSONB?
  new_values: JSONB?
  ip_address: string?
  user_agent: string?
  description: string?
  status: enum (success, error)
  error_message: string?
  created_at: Date
}
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

---

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
findAll(): Promise<UserModel[]>
findActive(): Promise<UserModel[]>

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
isEmailUnique(email: string, excludeId?: string): Promise<boolean>
```

---

### AuditLogQueries

```typescript
// Create
create(data: Partial<AuditLogModel>): Promise<AuditLogModel>

// Read
findById(id: string): Promise<AuditLogModel | null>
findByStoreId(storeId: string, limit?: number): Promise<AuditLogModel[]>
findByUserId(userId: string, limit?: number): Promise<AuditLogModel[]>
findByAction(action: AuditAction): Promise<AuditLogModel[]>
findByEntityType(entityType: string): Promise<AuditLogModel[]>
findByEntityId(entityId: string): Promise<AuditLogModel[]>
findByDateRange(startDate: Date, endDate: Date): Promise<AuditLogModel[]>

// Analytics
countByStore(storeId: string): Promise<number>
countByStoreAndAction(storeId: string, action: AuditAction): Promise<number>
countErrors(): Promise<number>
getActivitySummary(storeId: string): Promise<Record<string, number>>
```

---

## 🔗 Relacionamentos

```
Stores (1) ─────────────────── (N) Users
  │
  └─→ Usuário pertence a UMA loja
  └─→ Loja pode ter múltiplos admins

Stores (1) ─────────────────── (N) AuditLogs
Users  (1) ─────────────────── (N) AuditLogs (nullable)
  │
  └─→ Registra quem fez o quê e quando
```

---

## 💾 Dados Demo

**Loja Demo:**
- Email: demo@foodihub.com
- Document: 12345678901234
- Cidade: São Paulo

**Usuários Demo:**
- Admin: admin@demo.com (senha: admin123)
- Manager: manager@demo.com (senha: manager123)
- Staff: staff@demo.com (senha: staff123)

---

## 📖 Próximos Passos

- [Executar Migrations](./MIGRATIONS.md)
- [Criar Seeders](./SEEDERS.md)
- [Ver Estrutura Completa](../README.md)
