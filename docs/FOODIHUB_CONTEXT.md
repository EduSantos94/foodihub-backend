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

## 🗄️ Tabelas (migrations 001–018)

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
| 015 | `integrations`, `webhooks`, `webhook_events` | iFood/aiQFome/custom; `UNIQUE (store_id, type)`; log de eventos com retry |
| 016 | `sales`, `sale_items` | Venda + itens com snapshot de nome e preço |
| 017 | `sale_integrations` | Origem da venda (`ifood`, `aiqfome`, `manual`, `app`, `web`), `UNIQUE (sale_id)` |
| 018 | views `vw_*` | Relatórios: `vw_sales_by_status`, `vw_top_products`, `vw_integration_status`, `vw_webhook_errors`, `vw_supplies_stock` |

As migrations 001–018 estão aplicadas no banco do Docker. Models, services, controllers, rotas e testes existem para todas as tabelas, inclusive vendas (`/api/sales`) e integrações/webhooks (`/api/integrations`).

Padrões das migrations: ids `UUID`, status/tipos como `VARCHAR` + `CHECK` (sem `CREATE TYPE ENUM`), `IF NOT EXISTS` e constraints nomeadas.

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
- Compra, itens e ajuste de estoque (criar ou apagar) rodam em **uma transação**. O fornecedor e todos os insumos precisam pertencer à loja (senão `Supplier not found` / `Supply not found`); quantidade deve ser > 0 e preço ≥ 0.
- **Editar compra** (`updatePurchase`) não altera itens, portanto não mexe no estoque.
- Ajuste manual: `PUT /supplies/:id` com `amount`.
- Implementação: `PurchaseQueries.adjustSupplyStock` (filtra por `store_id`).

### Vendas (`sales` / `sale_items`)

- `sale_items` guarda snapshot de `product_name` e `unit_price`; `quantity > 0`.
- `POST /api/sales`: o preço vem do produto (snapshot em `sale_items`), nunca do cliente. Venda, itens, desconto de `products.amount` e `sale_integrations` rodam numa transação; sem saldo, a venda inteira é recusada (rollback).
- `POST /api/sales/:id/cancel` (ou `PUT` com `status: cancelled`) devolve as quantidades ao estoque. Venda cancelada não pode mais ser alterada; venda `delivered` não pode ser cancelada.
- Não há DELETE de venda: cancelar é o caminho.
- Fluxo de `sales.status`: `pending → preparing → ready → delivered` (ou `cancelled`). Pagamento em `payment_status` (`pending | paid | cancelled`).
- `sale_integrations` só existe para vendas vindas de plataformas externas; venda manual não precisa de registro lá (a coluna `integration_id` é obrigatória).

### Integrações e webhooks

- `/api/integrations` (CRUD), `/api/integrations/:id/webhooks` (CRUD), `POST .../webhooks/:webhookId/test` (ping `webhook.test`), `GET .../:id/events` (log) e `POST .../:id/events/:eventId/retry` (recoloca na fila um evento `failed`/`skipped`).
- `api_key`, `api_secret` e `webhook_token` da integração nunca são devolvidos (a API devolve `has_api_key` / `has_api_secret`). O `type` da integração não pode ser alterado.
- **Criptografia em repouso:** `api_key` e `api_secret` são gravados com AES-256-GCM (`enc:v1:...`, transformer em `IntegrationModel`) usando `INTEGRATION_ENCRYPTION_KEY` (obrigatória em produção; em dev há uma chave insegura de fallback, com aviso). Valores antigos em texto puro continuam legíveis. Limite de 250 caracteres por segredo. **Perder a chave torna os segredos ilegíveis: guarde um backup.** O `webhook_token` (usado para assinar as entregas) continua em texto puro.
- **Permissões:** `/api/integrations/*` só para `admin` e `manager`; cancelar venda (`POST /:id/cancel` ou `PUT` com `status: cancelled`) e apagar compra só para `admin` e `manager`. `staff` continua podendo criar e consultar vendas.
- **Limpeza:** o worker apaga, a cada 6 h, eventos `delivered`/`skipped` com mais de `WEBHOOK_RETENTION_DAYS` (30) e `failed` com mais de `WEBHOOK_FAILED_RETENTION_DAYS` (90).
- **Eventos:** `order.created`, `order.updated`, `order.cancelled` (disparados por `SaleService` para os webhooks ativos da loja) e `webhook.test`. Só esses tipos são aceitos em `webhooks.event_type`.
- **Fila:** o evento é gravado em `webhook_events` (`pending`) e entregue por `WebhookWorker` (`WebhookDispatcher.processDue`), a cada `WEBHOOK_WORKER_INTERVAL_MS` (padrão 30000; `0` desativa). Falha ao enfileirar nunca derruba a venda.
- **Entrega:** `POST` JSON com `X-Webhook-Id`, `X-Webhook-Event`, `X-Webhook-Token` e `X-Webhook-Signature: sha256=<HMAC-SHA256 do corpo com o webhook_token>`. Timeout 10s, sem seguir redirects; 2xx = `delivered`.
- **Retry:** falha volta para `pending` com `next_retry` em 5 min, 15 min, 1 h, 4 h e 12 h (depois repete 12 h). Ao atingir `max_retries` tentativas (1–10, padrão 5) vira `failed`. Webhook/integração inativos ou removidos viram `skipped`. Evento preso em `sent` por mais de 5 min é retomado.
- **Concorrência:** os eventos são reservados com `FOR UPDATE SKIP LOCKED`, então mais de uma instância pode rodar o worker.
- **Segurança:** `endpoint_url` só aceita http(s) e bloqueia hosts privados/locais (localhost, 10.x, 172.16–31.x, 192.168.x, 169.254.x, `.internal`, IPv6 local); em desenvolvimento, `WEBHOOK_ALLOW_PRIVATE=true` libera. Hostnames não são resolvidos (DNS rebinding não coberto).
- **Horários:** colunas `timestamp` sem fuso; `next_retry` é sempre calculado pelo banco (`NOW()`), nunca pelo app, para não depender do fuso do servidor.
- Ainda não há conectores iFood/aiQFome: a integração só guarda configuração e recebe/dispara webhooks.

### Testes

- `npm test`: unitários (com mock), não precisam de banco.
- `npm run test:integration`: roda contra o Postgres real (docker `db`, migrations aplicadas; usa `DB_HOST=localhost`). Cobre venda/estoque/cancelamento, compras e transação, criptografia, entrega/retry/limpeza de webhooks e as views. Cada teste cria uma loja temporária e a remove no final.

### Limitações conhecidas

- Sem histórico de movimentações: só o saldo atual (e `audit_logs` para ações gerais).
- Sem preço médio ponderado nem custo por produto.
- `purchase_items.batch_number`, `manufacturing_date` e `expiry_date` são só informativos; não há alerta nem baixa automática por validade.

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

1. Conectores iFood/aiQFome (receber pedidos e sincronizar status via `sale_integrations.sync_status`): dependem da documentação oficial e de credenciais de homologação de cada plataforma.
2. Endpoints que leem as views `vw_*` (relatórios na API).
3. Rotação da `INTEGRATION_ENCRYPTION_KEY` (hoje só uma chave).
