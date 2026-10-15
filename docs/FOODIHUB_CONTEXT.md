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

## 🗄️ Tabelas (migrations 001–019)

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
| 019 | — | `users.is_platform_admin` (administrador do sistema; só alterável pelo banco/CLI) |
| 018 | views `vw_*` | Relatórios: `vw_sales_by_status`, `vw_top_products`, `vw_integration_status`, `vw_webhook_errors`, `vw_supplies_stock` |

As migrations 001–019 estão aplicadas no banco do Docker. Models, services, controllers, rotas e testes existem para todas as tabelas, inclusive vendas (`/api/sales`) e integrações/webhooks (`/api/integrations`).

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

## 🖥️ Frontend (`frontend/`, Expo Router: web/desktop primeiro)

- Docker: `localhost:3000` (build estático servido pelo nginx; `app.json` usa `web.output: "single"`, ou seja, SPA, para não haver hidratação de páginas protegidas). Dev: `npm run web` (usa `EXPO_PUBLIC_API_URL`).
- **Layout:** menu lateral no desktop (≥ 900 px) e barra superior com menu no celular. Tabelas viram cartões abaixo de 700 px.
- **Telas prontas (Cadastros base):** Início (totais), Produtos (+ tamanhos), Categorias, Insumos, Fornecedores, Clientes. Listagem paginada, criar/editar em diálogo com validação, excluir com confirmação, erros da API mostrados no diálogo.
- **Estrutura:** `lib/` (tema, cliente de API com token e logout automático em 401, formatação, tipos), `components/ui/` (Button, inputs, Dialog, DataTable, feedback), `components/ResourcePage.tsx` (CRUD genérico dirigido por configuração: cada tela é só colunas + campos), `components/Sidebar.tsx`.
- **Sessão:** token e usuário ficam no `AsyncStorage`; ao recarregar a página o usuário continua logado.
- **Permissões na tela:** Categorias só editáveis pelo administrador do sistema; as lojas veem a lista em modo leitura e escolhem a categoria no formulário de produto (só as ativas aparecem).
- **Vendas (prontas):** `/pdv` (Nova venda: catálogo com busca, carrinho limitado ao estoque, cliente opcional, retirada/entrega/no local, pagamento, desconto, "pagamento já recebido") e `/sales` (lista com filtro de status, detalhes, avançar status, receber, cancelar só admin/manager). Tamanhos de produto ainda não são escolhidos no PDV.
- **Lojas (`/stores`):** só aparece no menu para o administrador do sistema; lista, edita, ativa/desativa e exclui lojas. Não cria: lojas novas nascem em `/register`.
- **Compras (`/purchases`):** lista, nova compra (fornecedor, data DD/MM/AAAA, itens com insumo/quantidade/preço/lote/validade, "já foi pago"), detalhes, marcar como paga e excluir (admin/manager; estorna o estoque). Datas de compra são `DATE` sem fuso.
- **Usuários (`/users`, admin/manager):** lista; só o admin cria (e-mail, senha inicial ≥ 8, papel) e edita (nome, telefone, ativo). Não há exclusão: desativar bloqueia o acesso na hora. **Meu perfil (`/profile`):** dados pessoais e troca da própria senha. **Minha loja (`/store`):** dados de contato; só o admin da loja edita.
- **Integrações (`/integrations`, admin/manager):** CRUD (tipo fixo após criar; chave/segredo nunca exibidos e, ao editar, vazio = manter) e o diálogo "Webhooks" (adicionar, testar, ativar, excluir, últimos eventos com reenvio).
- **Relatórios (`/reports`, admin/manager):** `GET /api/reports/overview` (views `vw_*` + estoque baixo; 30 dias) alimenta a tela (faturamento, vendas por status, faturamento por dia, mais vendidos, estoque baixo, saúde das integrações) e dois cartões do Início. O PDV pergunta o tamanho quando o produto tem tamanhos ativos.
- Próximas fatias sugeridas: recuperação de senha (exige envio de e-mail, ainda não configurado).

- **Máscaras e validação de campos (reaproveitável):** `frontend/lib/masks.ts` define as máscaras (`phone`, `cnpj`, `cpf`, `cep`, `uf`, `date`, `decimal`, `integer`), cada uma com formatação ao digitar, validação e se vai só com dígitos para a API. Usa-se com `<TextField mask="phone" />` ou `mask: 'phone'` num campo do `ResourcePage` (decimal/integer entram sozinhos). Para criar outra, basta uma entrada em `MASKS`. Telefone, CPF e CEP são guardados **só com dígitos** e mostrados formatados. O **CNPJ aceita letras** (CNPJ alfanumérico): os 12 primeiros caracteres são 0-9/A-Z e os 2 últimos (dígitos verificadores) são números; cada caractere vale o código ASCII menos 48 no cálculo, então CNPJs numéricos continuam válidos. É guardado sem pontuação e em maiúsculas (`12ABC34501DE35`). O backend repete a validação e a normalização (`utils/brazil.ts`: `normalizeBrazilianFields`) em fornecedores, clientes, lojas e usuários; valores inválidos voltam 400. Registros antigos gravados com pontuação continuam legíveis; ao editar e salvar, passam a ficar só com dígitos.

## 🔒 Isolamento entre lojas e permissões (backend)

- **Lojas:** todas as rotas de `/api/stores` exigem login e só expõem a **própria** loja: `GET /` devolve só a loja do usuário, e `/:id` de outra loja responde **404** (não revela que existe). `PUT` exige o papel `admin` da loja e só altera dados de contato (nome, e-mail, telefone, endereço; nunca CNPJ nem `active`). Desativar, reativar, excluir e listar todas as lojas é só do **administrador do sistema**, em `/api/admin/stores` (`GET /`, `PUT /:id`, `PATCH /:id/activate|deactivate`, `DELETE /:id`; ele não desativa nem exclui a própria loja). Não existe mais listagem geral nem `POST /api/stores` público; lojas novas nascem em `POST /auth/register` (loja + primeiro admin).
- **Categorias (globais):** só o **administrador do sistema** (`users.is_platform_admin = true`) cria, edita e exclui. As lojas apenas **selecionam** o que já existe: todo usuário logado lê a lista, e ao cadastrar/editar um produto o `category_id` precisa existir e estar ativo (`Category not found` / `Category is inactive`; a categoria que o produto já tem pode continuar mesmo se for desativada depois).
- **Administrador do sistema:** é um usuário comum com a flag ligada, independente do papel na loja (`admin`/`manager`/`staff`). A flag **não pode ser alterada pela API** (registro e `PUT /api/users` a ignoram); só por CLI: `npm run platform-admin -- email@exemplo.com` (e `-- email --revoke` para retirar). A checagem (`requirePlatformAdmin`) consulta o banco a cada chamada, então revogar vale na hora, sem esperar o token expirar. O login devolve `user.is_platform_admin`, que a tela usa para mostrar ou esconder o CRUD de categorias.
- Guardas cobertas por testes: `middleware/__tests__/auth.test.ts` (`authorizeRole`, `requireOwnStore`) e `routes/__tests__/access.routes.test.ts` (a corrente de middlewares de cada rota).
- **Cadastro da loja (`POST /auth/register`):** público, mas só cria uma loja nova + o seu primeiro `admin`. Exige **CNPJ válido** (numérico ou alfanumérico, com dígitos verificadores; guardado sem pontuação, então `11.222.333/0001-81` e `11222333000181` são o mesmo), e-mails válidos e senha de no mínimo 8 caracteres. Falhou no meio (ex.: senha fraca)? A loja é desfeita e o CNPJ pode ser usado de novo. O e-mail de acesso é conferido antes de criar qualquer coisa.
- **Usuários (`/api/users`):** tudo exige login e fica restrito à própria loja (id de outra loja = 404). `POST` (criar) e `PATCH /:id/deactivate`: só `admin` (e nunca a si mesmo); `GET /` (listar): `admin`/`manager`; `GET /:id`: `staff` só vê a si mesmo; `PUT /:id`: cada um edita o próprio perfil (nome/telefone), `admin` edita qualquer um da loja e é o único que muda `active`; troca de senha **só da própria conta**. `role` precisa ser `admin`/`manager`/`staff`; `store_id` e `is_platform_admin` vêm sempre do servidor, nunca do corpo.
- **Contas desativadas:** o token vale 24 h, mas a conta é conferida no banco (cache de 15 s, zerado ao desativar usuário ou loja): usuário desativado, loja desativada/apagada ou usuário inexistente recebem 401 na hora.
- **Atualizações (`PUT`) só aceitam os campos documentados** em produtos, tamanhos, clientes, fornecedores, insumos, categorias e imagens (`utils/pick.ts`); campos como `store_id` enviados no corpo são ignorados.
- **Login:** mesma resposta para e-mail inexistente e senha errada (e custo de tempo igual); "conta desativada" só aparece para quem acertou a senha. Limite de tentativas: 10 por IP+e-mail e 100 por IP a cada 15 min; cadastro: 10 por hora por IP (HTTP 429). O limite é por processo e usa `req.ip`: atrás de proxy defina `TRUST_PROXY` (ex.: `1`).
- **Produção:** o backend se recusa a subir sem `JWT_SECRET` (e sem `INTEGRATION_ENCRYPTION_KEY` ao gravar segredos).
- **Telas:** `/login` (sem credenciais de teste) e `/register` (cadastro por CNPJ com máscara e validação; após criar, já entra como administrador da nova loja).
- **Ainda não coberto:** o limitador é em memória; recuperação de senha e confirmação de e-mail não existem; um `admin` pode ser o único admin da loja e ficar sem acesso (não há "último admin").

## 💡 Notas Importantes

- **Multi-tenant:** sempre filtrar por `store_id`.
- **Soft delete:** usar `active` em vez de DELETE quando possível.
- **Numeric no Postgres:** `NUMERIC` volta como string no driver; converter com `Number()` nos services.
- **Migrations:** `src/database/migrations/` (SQL puro, idempotentes).

---

## 🚀 Próximos Passos

1. Conectores iFood/aiQFome (receber pedidos e sincronizar status via `sale_integrations.sync_status`): dependem da documentação oficial e de credenciais de homologação de cada plataforma.
2. Rotação da `INTEGRATION_ENCRYPTION_KEY` (hoje só uma chave).
