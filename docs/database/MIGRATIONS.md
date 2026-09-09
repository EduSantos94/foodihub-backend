# Database Migrations

Script automático para executar migrations do FoodiHub.

## 📋 Disponível

### Via npm (recomendado)

```bash
# Apenas migrations
cd backend
npm run migrate

# Migrations + seeders (dados demo)
npm run migrate:seed
```

### Via script shell

```bash
# Apenas migrations
./backend/migrate.sh

# Migrations + seeders
./backend/migrate.sh seed
```

### Via Docker

```bash
# Apenas migrations
docker exec foodihub_backend npm run migrate

# Migrations + seeders
docker exec foodihub_backend npm run migrate:seed
```

---

## 🔄 O que faz

### `npm run migrate`
✅ Executa todos os arquivos `.sql` em `/src/database/migrations/` em ordem numérica
✅ Cria tabelas com `IF NOT EXISTS` (seguro rodar múltiplas vezes)
✅ Cria índices para performance
✅ Adiciona comentários nas colunas

### `npm run migrate:seed`
✅ Executa todas as migrations
✅ Cria dados demo (lojas e usuários de teste)

---

## 📁 Estrutura

```
backend/
├── src/database/
│   ├── migrations/
│   │   ├── 001_create_stores_table.sql
│   │   ├── 002_create_users_table.sql
│   │   ├── 003_create_audit_logs_table.sql
│   │   └── 004_add_user_phone_field.sql
│   ├── seeders/
│   │   ├── StoreSeed.ts
│   │   ├── UserSeed.ts
│   │   └── index.ts
│   ├── migrate.ts         # ← Script principal
│   └── connection.ts      # Conexão com DB
├── migrate.sh             # ← Script shell
└── package.json
```

---

## 🚀 Primeiras vezes

### 1️⃣ Criar banco com estrutura

```bash
npm run migrate
```

Isso cria:
- `stores` - lojas/restaurantes
- `users` - usuários da loja
- `audit_logs` - log de todas as ações

### 2️⃣ Adicionar dados de teste

```bash
npm run migrate:seed
```

Dados criados:
- **Demo Store** (demo@foodihub.com)
- **Admin User** (admin@demo.com / senha: admin123)
- **Manager User** (manager@demo.com / senha: manager123)
- **Staff User** (staff@demo.com / senha: staff123)

---

## ➕ Adicionar nova migration

1. Criar novo arquivo em `src/database/migrations/`
   ```sql
   -- 005_add_new_column.sql
   ALTER TABLE stores ADD COLUMN IF NOT EXISTS new_column VARCHAR(100);
   ```

2. Executar
   ```bash
   npm run migrate
   ```

Pronto! Será executada automaticamente em ordem numérica.

---

## 🔍 Verificar resultado

Conectar ao banco:
```bash
docker exec -it foodihub_db psql -U postgres -d foodihub
```

Dentro do psql:
```sql
-- Ver tabelas
\dt

-- Ver schema da tabela stores
\d stores

-- Ver dados
SELECT * FROM stores;
SELECT * FROM users;
```

---

## ⚠️ Troubleshooting

### Erro: "Cannot find module 'typeorm'"
```bash
cd backend
npm install
```

### Erro: "Connection refused"
Verificar se o Docker está rodando:
```bash
docker compose ps
```

### Resetar tudo (apaga dados!)
```bash
docker compose down -v
docker compose up -d
npm run migrate:seed
```

---

## 📝 Notas

- Migrations são **idempotentes** (seguro rodar múltiplas vezes)
- Ordem é determinada pelo número no nome do arquivo
- Use `IF NOT EXISTS` para evitar erros
- Seeders são **opcionais** - use apenas para dados de teste

