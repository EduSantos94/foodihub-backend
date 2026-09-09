# Database Seeders

Documentação sobre seeders e dados de teste.

## 🌱 O que são Seeders?

Seeders são scripts que populam o banco de dados com dados de teste iniciais. Útil para:
- Desenvolvimento local
- Testes automatizados
- Demonstração do sistema
- Ambiente de staging

---

## 📦 Seeders Disponíveis

### StoreSeed

Cria lojas de teste.

```typescript
// Criar loja demo
await database.seedStores.seedDemoStore();

// Criar múltiplas lojas
await database.seedStores.seedMultipleStores(5);

// Deletar loja por email
await database.seedStores.deleteByEmail('demo@foodihub.com');
```

---

### UserSeed

Cria usuários com diferentes roles.

```typescript
// Criar admin de uma loja
await database.seedUsers.seedAdminUser(storeId, 'admin@demo.com');

// Criar manager
await database.seedUsers.seedManagerUser(storeId, 'manager@demo.com');

// Criar staff
await database.seedUsers.seedStaffUser(storeId, 'staff@demo.com');

// Criar todos os tipos de usuários para uma loja
await database.seedUsers.seedDemoUsers(storeId);

// Criar múltiplos usuários com roles aleatórios
await database.seedUsers.seedMultipleUsers(storeId, 5);

// Criar usuário customizado
await database.seedUsers.createUser(
  storeId,
  'custom@demo.com',
  'John',
  'Doe',
  'password123',
  UserRole.MANAGER,
  '(11) 99999-9999'
);
```

---

### AuditLogSeed

Registra eventos de auditoria.

```typescript
// Registrar login
await database.seedAuditLogs.seedLoginAudit(storeId, userId, '192.168.1.1');

// Deletar todos os logs
await database.seedAuditLogs.deleteAll();
```

---

## 🚀 Como Executar

### Opção 1: Via npm
```bash
cd backend
npm run migrate:seed
```

### Opção 2: Via Docker
```bash
docker exec foodihub_backend npm run migrate:seed
```

### Opção 3: Via script shell
```bash
./backend/migrate.sh seed
```

---

## 📊 Dados Criados

### Demo Store
```
Nome: FoodiHub Demo Store
Email: demo@foodihub.com
CNPJ: 12345678901234
Cidade: São Paulo
Estado: SP
```

### Demo Users
```
Admin:
  Email: admin@demo.com
  Senha: admin123
  Role: admin

Manager:
  Email: manager@demo.com
  Senha: manager123
  Role: manager

Staff:
  Email: staff@demo.com
  Senha: staff123
  Role: staff
```

---

## 🔄 Workflow Completo

```bash
# 1. Criar estrutura do banco
npm run migrate

# 2. Popultar com dados de teste
npm run migrate:seed

# 3. Acessar a aplicação
# Frontend: http://localhost
# API: http://localhost:3333
# Login: admin@demo.com / admin123
```

---

## ⚠️ Notas Importantes

### ✅ Use Seeders Para:
- Desenvolvimento local
- Testes manuais
- Demonstração
- Staging

### ❌ NÃO use em Produção:
- Pode sobrescrever dados reais
- Use `npm run migrate` apenas
- Seeders devem ser opcionais

---

## 🧹 Limpar Dados

### Deletar loja específica
```typescript
await database.seedStores.deleteByEmail('demo@foodihub.com');
```

### Deletar usuários de uma loja
```typescript
await database.seedUsers.deleteByStoreId(storeId);
```

### Deletar todos os usuários
```typescript
await database.seedUsers.deleteAll();
```

### Deletar todos os logs de auditoria
```typescript
await database.seedAuditLogs.deleteAll();
```

---

## 📝 Criar Novo Seeder

1. Criar arquivo em `backend/src/database/seeders/`

```typescript
// MyEntitySeed.ts
import { Repository } from 'typeorm';
import { MyModel } from '../models/MyModel';

export class MyEntitySeed {
  constructor(private repository: Repository<MyModel>) {}

  async seedDemo(): Promise<MyModel> {
    const entity = this.repository.create({
      // dados
    });
    return this.repository.save(entity);
  }

  async deleteAll(): Promise<number> {
    const result = await this.repository.delete({});
    return result.affected || 0;
  }
}
```

2. Registrar em `backend/src/database/index.ts`

3. Usar no seeder principal

---

## 🔗 Referências

- [Database README](./README.md)
- [Migrations](./MIGRATIONS.md)
- [Models](../database/README.md#models)
