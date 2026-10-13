# FoodiHub - Contexto do Projeto

**Desenvolvedor:** Eduardo Santos  
**Email:** eduardo.santos@fastcore.com.br  
**Projeto:** FoodiHub (SaaS para lojas alimentícias)  
**Stack:** PostgreSQL + Node.js/TypeScript (Express + TypeORM)  
**Repositório:** https://github.com/EduSantos94/foodihub-backend

---

## 📋 O que é FoodiHub?

Sistema SaaS **multi-tenant** para controle de **estoque, compras e vendas de lojas alimentícias** (pizzarias, confeitarias, lanchonetes, distribuidoras).

**Princípio do estoque: simples.** Não há depósitos, lotes de produção nem tabela de movimentações. O saldo é uma única coluna `amount`:

- `products.amount` → quantidade de produtos
- `supplies.amount` → quantidade de insumos (na unidade de `supplies.unit_measure`)

---

## 🗄️ Tabelas (migrations 001–014)

| Migration | Tabela | Observação |
|-----------|--------|------------|
| 001 | `stores` | Tenant raiz |
| 002 | `users` | Funcionários/admin |
| 003 | `audit_logs` | Auditoria de ações |
| 005 | `products` | `price`, `amount`, `category_id` |
| 006 | `product_sizes` | Tamanhos (P, M, G); sem preço próprio |
| 007 | `categories` | Globais, gerenciadas pelo admin da plataforma |
| 009 | `customers` | Clientes |
| 010 | `suppliers` | Fornecedores |
| 011 | `images` | Imagens genéricas por tipo |
| 012 | `supplies` | Insumos: `type`, `unit_measure` |
| 013 | `purchases`, `purchase_items` | Compras com lote e validade por item |
| 014 | — | `supplies.amount` + `CHECK (amount >= 0)` em `supplies` e `products` |

Ainda não existem: vendas (`sales`, `sale_items`) e integrações (iFood/aiQFome, webhooks).

---

## 📦 Estoque simples

### Produtos (`products.amount`)

- Toda venda **desconta** de `products.amount`. Não há flag "sob demanda": produtos feitos na hora (ex.: pizza) também descontam, então o lojista mantém um `amount` alto ou repõe quando necessário.
- O desconto deve ser atômico, para o `CHECK (amount >= 0)` barrar venda sem saldo:

```sql
UPDATE products SET amount = amount - $1
WHERE id = $2 AND store_id = $3 AND amount >= $1;
-- 0 linhas afetadas → recusar a venda por falta de estoque
```

### Insumos (`supplies.amount`)

- **Criar compra** → soma `purchase_items.quantity` em `supplies.amount` (sem status de entrega: a compra entra no estoque ao ser criada).
- **Apagar compra** → subtrai as quantidades, com piso em 0.
- **Editar compra** (`updatePurchase`) não altera itens, portanto não mexe no estoque.
- Ajuste manual: `PUT /supplies/:id` com `amount`.
- Implementação: `PurchaseQueries.adjustSupplyStock` (filtra por `store_id`).

### Limitações conhecidas

- Sem histórico de movimentações: só o saldo atual (e `audit_logs` para ações gerais).
- Sem preço médio ponderado nem custo por produto.
- `purchase_items.batch_number`, `manufacturing_date` e `expiry_date` são só informativos; não há alerta nem baixa automática por validade.
- Criar compra, itens e ajuste de estoque não rodam em transação única.
- O `supply_id` dos itens de compra não é validado contra a loja (o ajuste de estoque ignora insumos de outra loja).

---

## 🖼️ Images

Tabela genérica com `type` (shop, product, supplier, banner, category, promotional, others) e `type_id` opcional apontando para o registro dono.

---

## 💡 Notas Importantes

- **Multi-tenant:** sempre filtrar por `store_id`.
- **Soft delete:** usar `active` em vez de DELETE quando possível.
- **Numeric no Postgres:** `NUMERIC` volta como string no driver; converter com `Number()` nos services.
- **Migrations:** `src/database/migrations/` (SQL puro, idempotentes).

---

## 🚀 Próximos Passos

1. Aplicar a migration 014 no banco.
2. Implementar vendas (`sales`, `sale_items`) descontando `products.amount` com o `UPDATE` atômico acima.
3. Validar `supply_id` dos itens de compra contra a loja.
4. Integrações (iFood/aiQFome) e webhooks, se necessário.
