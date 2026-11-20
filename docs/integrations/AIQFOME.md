# Integração aiqfome — contrato da API, achados e plano (Fase 0)

> Status: **Fase 0 (descoberta). Nenhum código de produção foi escrito.**
> Data da leitura: 2026-11-19. Fonte: https://developer.aiqfome.com/docs/api/v2 e o fórum https://aiqfomedev.discourse.group/.
>
> Legenda: **VERIFICADO** = visto na documentação/fórum ou no código do FoodiHub. **NÃO CONFIRMADO** = a página não mostra, ou há conflito entre fontes. Nada foi preenchido de memória.
> Nenhuma chamada real à API do aiqfome foi feita.

---

## 0. Decisões aprovadas (2026-11-19)

- **Tipo de loja:** Cardápio. Ficam fora de escopo `in-separation` (só Catálogo) e o fluxo de Catálogo. As formas de pagamento podem ser definidas via API.
- **Rede:** desenvolvimento em localhost, sem URL pública. O receptor de webhook (`new-order` etc.) **fica para depois**, quando houver túnel ou deploy. Até lá, **polling de `GET /orders` é o único caminho de entrada de pedidos**.
- **Ordem das fases:** spike de leitura (0b) → 1 Fundação → 5 Pedidos → 4 Estoque → 3 Catálogo → 2 Loja/pagamentos → 6 Frontend → 7 Qualidade.
- **Pendente:** loja de teste e token de leitura (pergunta 8). O spike 0b depende disso.

---

## 1. Resumo executivo

1. **A documentação pública não basta para implementar.** Quase todas as páginas de endpoint têm as seções *Request* e *Response* vazias (só uma aba "200"). Só temos método, path e scope. Corpos, respostas, erros, paginação e rate limit **não estão publicados** nas páginas lidas.
2. **A autenticação é ambígua.** A introdução fala em "Generate API token" no painel; a página de versões e o guia de transição descrevem **token por loja via ID Magalu (OAuth)**, autorizado pelo lojista no painel. Isso muda o desenho das credenciais (ver §4).
3. **Não existe sandbox.** Desde 07/04/2026 o fluxo é direto em produção; há *lojas de teste* criadas no portal do desenvolvedor. A regra 4 do prompt (não escrever em loja real) passa a ser crítica: só devemos escrever em loja de teste.
4. **Existem webhooks de pedido** (`new-order`, `read-order`, `ready-order`, `cancel-order`, `order-refund`, além de `new-store`, `new-menu`, `order-logistic`). Não há evento genérico de "pedido atualizado". O `new-order` traz **pouco dado**; o detalhe exige um GET.
5. **O webhook do aiqfome não tem assinatura HMAC.** O header `Authorization` carrega o próprio `secret_key` cadastrado. Política de retry e resposta esperada **não estão documentadas**.
6. **O FoodiHub não tem hoje nenhum receptor de webhook público.** Os webhooks existentes são só de saída. Receber `new-order` exige uma rota pública (sem JWT) e uma URL alcançável da internet (em dev, um túnel).
7. **Semântica do `inventory-quantity` (valor absoluto ou delta) é desconhecida.** É o ponto mais crítico da Fase 4 e precisa de teste real em loja de teste antes de qualquer código.
8. O aiqfome tem **dois tipos de loja: Cardápio e Catálogo**, com comportamentos diferentes. Precisamos saber qual é o do cliente.

---

## 2. Contrato da API aiqfome v2

### 2.1 Ambiente e autenticação

| Item | Estado | Detalhe |
|---|---|---|
| Esquema | VERIFICADO | HTTP Bearer (`Authorization: Bearer <token>`) |
| Origem do token | **CONFLITO** | Intro: "Generate API token" no painel. Versões/guia de transição: token **exclusivo por loja**, via ID Magalu, autorizado pelo lojista em *Integrações* no painel; parceiros recebem `client_id`/`client_secret` no portal. Fórum cita `AUTHORIZATION_CODE` gerado no portal para loja de teste (indica *authorization code flow*). |
| Endpoint de token / refresh / validade | NÃO CONFIRMADO | Não aparece nas páginas lidas. Guia "Credenciais e autenticação" não foi lido. |
| Base URL (host) | NÃO CONFIRMADO | Só aparecem paths `/api/v2/...`. Guias usam `/store/{id}/...` sem o prefixo `/api/v2` — **inconsistência a resolver**. |
| Sandbox | VERIFICADO (não existe) | Post de 07/04/2026: "não teremos mais um ambiente de sandbox separado". Apps em *Rascunho* ficam isolados de lojistas reais. |
| Loja de teste | VERIFICADO | Criada no portal (`developer.aiqfome.com/stores`) com CNPJ válido, nome e tipo (Cardápio/Catálogo); nasce "Publicada e Aberta", sem produtos. |
| Scopes vistos | VERIFICADO | `aqf:store:read`, `aqf:menu:read`, `aqf:menu:create`, `aqf:order:read`, `aqf:order:create`. Lista completa não exibida. Na criação do app escolhe-se escopo por "Pedidos, Itens ou Loja". |
| Pedidos de teste | NÃO CONFIRMADO | Existe o tópico 90 "Endpoint para criação de pedidos de teste" (não lido). |

### 2.2 Endpoints com método + path + scope **verificados**

Para **todos** abaixo: parâmetros, corpo, resposta, erros, paginação e rate limit = **NÃO CONFIRMADO**.

| Uso | Método e path | Scope |
|---|---|---|
| Listar lojas | `GET /api/v2/store` | `aqf:store:read` |
| Exibir menu | `POST /api/v2/menu` (a página se chama "Show menu by url") | `aqf:menu:read` |
| Atualizar estoque do item | `PUT /api/v2/menu/:store_id/items/:item_uuid/inventory-quantity` | `aqf:menu:create` |
| Pedidos não lidos | `GET /api/v2/orders` | `aqf:order:read` |
| Buscar pedidos | `GET /api/v2/orders/search` | `aqf:order:read` |
| Marcar pedido pronto | `POST /api/v2/orders/mark-as-ready` | `aqf:order:create` |

Notas:
- **`GET /orders/search`** (fórum, tópico 118): filtro `status` com `read` (lido, aguardando preparo), `in-separation` (**só loja Catálogo**), `ready`, `cancelled`; `date_start` sozinho filtra as 24h do dia; `date_end` não pode ser menor que `date_start`. Formato de data e paginação não declarados.
- **`mark-as-ready` não leva o id na URL** (diferente do que o prompt supõe para os outros). O corpo é desconhecido.
- O prompt cita como "confirmados" `GET /api/v2/orders/:order_id`, `GET /api/v2/store/:store_id/payment-methods` e `POST /api/v2/store/:store_id/webhooks`. **Não consegui verificar esses três com o prefixo `/api/v2`.** Os guias mostram `GET|POST /store/{store_id}/payment-methods` e `POST /store/{store_id}/webhooks` **sem** o prefixo. Tratar o prefixo como NÃO CONFIRMADO até uma chamada GET real.

### 2.3 Endpoints existentes mas **não lidos** (só o nome na barra lateral)

- *Store*: abrir/fechar/standby, tempo de preparo/entrega, horários, anexar/listar forma de pagamento, listar/criar/atualizar/remover webhooks.
- *Menu*: categorias, itens, tamanhos (criar/mostrar/atualizar/apagar/toggle/"block until tomorrow"), grupos obrigatórios, itens obrigatórios, itens adicionais, imagens do item, vendas diárias.
- *Order*: listar abertos/cancelados, mostrar pedido, `cancel-order-items`, `replace-order-items`, `order-read`, `order-in-separation`, `order-delivered`.
- Seções *Catalog* (20), *Aiqentrega* (8), *Auxiliary* (6), *Financial* (3), *Helper* (4), *Order Logistic* (6), *City* (1).
- Guia `/docs/guides/v2/orders/get-orders` e o guia de credenciais/autenticação.
- Tópicos do fórum: 90 (pedido de teste), 59 (SSO ID Magalu), 170, 47 (logística), 228 (financeiro), 227 (áreas de entrega), 393 (502 em `GET /store`).

**Consequência:** como tamanhos, adicionais e grupos obrigatórios não foram lidos, **não dá para decidir ainda** como mapear `products` + `product_sizes` (§5, Fase 3).

### 2.4 Formas de pagamento (guia `stores/payment-methods`) — VERIFICADO

- Ler as aceitas: `GET /store/{store_id}/payment-methods` → `{ "data": [ { "id", "name" } ] }` (ex.: "Visa Crédito", "Dinheiro"). Tipo do `id` não declarado.
- Definir: `POST /store/{store_id}/payment-methods` com `{"payment_methods_ids": ["224"]}`. **Substitui** a lista atual.
- IDs disponíveis: `GET /auxiliary/payment-methods`.
- **Só loja Cardápio** pode usar o POST; Catálogo é "NÃO PERMITIDO" (falar com o suporte).
- Lojas nascem com pagamento offline e `nupay`, que só o time do aiqfome desativa.

### 2.5 Webhooks do aiqfome (guia `stores/webhooks` + tópico 94) — VERIFICADO

- Eventos: `new-order`, `read-order`, `ready-order`, `cancel-order`, `order-refund`, `new-store`, `new-menu`, `order-logistic`. **Não há** "pedido atualizado".
- Registro: `GET /auxiliary/webhook-events` (ids) → `POST /store/{store_id}/webhooks` com `{"webhooks":[{"url","secret_key","webhook_event_id"}]}` (3 campos obrigatórios); `PUT|PATCH /store/{store_id}/webhooks/{id}`; `DELETE` para de enviar "imediatamente".
- Cabeçalhos enviados: `User-Agent: aiqfome`, `Content-Type: application/json`, `Authorization: <secret_key cadastrada>`.
- **Sem assinatura HMAC.** A validação é comparar o `Authorization` com o segredo (comparação em tempo constante).
- Payload: `{ event, store_id, data }`.
  - `new-order.data`: `order_id, created_at, user_name, is_aiqentrega_delivery, order_delivery_time, order_is_pickup, store_id, store_name` → **sem itens, valores, endereço nem pagamento**; exige `GET` do pedido.
  - `read-order`: `order_id, read_at` · `ready-order`: `order_id, ready_at` · `cancel-order`: `order_id, canceled_at, reason` · `order-refund`: `order_id, subtotal, refunded_value`.
  - `new-store` vem aninhado (`data.data.success[].storeId`, sem `store_id` no topo).
  - `order-logistic`: `data.order_id, status (pickup_ongoing|delivery_ongoing…), metadata (driver_name, driver_phone só em pickup_ongoing)`.
- **NÃO CONFIRMADO:** política de retry, timeout, código HTTP esperado de volta, ordem de entrega, deduplicação. Portanto o receptor deve ser **idempotente** e o polling é obrigatório como rede de segurança.

---

## 3. Verificação das premissas do prompt contra o código do FoodiHub

Tudo conferido em `backend/src` em 2026-11-19.

| Premissa do prompt | Resultado |
|---|---|
| Última migration é a `020` | **Parcial.** No repositório sim (`020_unique_documents_per_store.sql`), mas o banco e a imagem Docker em execução já têm a `021_import_batch.sql` (importação por planilha), **cujo código-fonte não está no repositório** (ver §3.1). As migrations da integração começam na `022`. |
| `integrations.type` aceita `aiqfome`, `UNIQUE(store_id,type)`, status, `config` JSONB | **Confirmado** (migration 015). |
| `api_key`/`api_secret` criptografados em AES-256-GCM | **Confirmado** (`utils/crypto.ts`, formato `enc:v1:<iv>:<tag>:<cipher>`). |
| `sale_integrations`: só `UNIQUE(sale_id)`, `external_id` com índice não único | **Confirmado** (migration 017). `external_id` é `VARCHAR(100)`. |
| `WebhookWorker` com `setInterval`, sem sobreposição, desligável por env | **Confirmado** (`WEBHOOK_WORKER_INTERVAL_MS`, `0` desliga). |
| `claimDueEvents` usa `FOR UPDATE SKIP LOCKED` | Não reconferi esse trecho do `WebhookQueries`; o worker em si é como descrito. Reconferir na Fase 1. |
| Estoque = `products.amount`; mudanças só em `SaleQueries` e `ProductService` | **Confirmado.** Só há 2 `UPDATE products` em SQL cru (`SaleQueries` linhas ~124 e ~138). Criação/edição manual passam pelo repositório TypeORM em `ProductService`. Nenhum seeder, importação ou outro caminho altera `amount`. |
| `createSale` exige `amount >= qty` para qualquer produto | **Confirmado** (`WHERE ... AND amount >= $1`; erro "Insufficient stock"). **Produto sob encomenda (`amount=0`) hoje não pode ser vendido.** |
| `sales.payment_method` CHECK restrito | **Confirmado**: `cash, credit_card, debit_card, pix, bank_transfer`. |
| `sales` sem coluna de taxa de entrega | **Confirmado** (sem `delivery_fee` na migration 016). `delivery_address` é `VARCHAR(500)`. |
| `sale_items.product_id` NOT NULL | Consistente com o prompt; não reconferido linha a linha. |
| CPF único por loja (índice parcial) | **Confirmado** (migration 020, `uq_customers_store_cpf`). |
| View `vw_integration_status` | **Existe** (migration 018). |

### 3.1 Código fora do repositório (achado importante)

A imagem `foodihub-backend:latest` (build de 26/10) e o banco de desenvolvimento contêm uma funcionalidade que **não existe no git**: importação por planilha de produtos, insumos, fornecedores, compras e histórico de vendas (`importHandler.ts`, `productImport.ts`, `saleHistoryImport.ts`, `purchaseHistoryImport.ts`, `supplierImport.ts`, `supplyImport.ts`, `importCommon.ts`, `bulkInsert.ts`, a migration `021_import_batch.sql` e alterações em models, rotas e services). Uma cópia foi salva em `~/Documentos/foodihub_backup_container_src/`. Até essa funcionalidade voltar ao repositório, ela corre risco de se perder se a imagem for reconstruída, e as migrations da integração evitam o número `021`.

### Riscos novos encontrados (não estavam no prompt)

1. **`integrations.api_key` e `api_secret` são `VARCHAR(500)`.** O valor criptografado cresce (~4/3 por base64url + prefixo ~60 caracteres). Um access token longo (tipo JWT, comum em OAuth/ID Magalu) **pode estourar 500 caracteres** quando criptografado. Provável migration `ALTER ... TYPE TEXT`. Além disso, OAuth exige guardar **refresh token** e **expiração** — não há coluna; iriam em `config` criptografado ou em colunas novas.
2. **Receptor de webhook público** é inédito no projeto: precisa ficar fora do `authenticateToken`, ter rate limit próprio e entrar no teste `access.routes.test.ts` como exceção documentada.
3. **O descontar-estoque do pedido importado não pode falhar.** O `decrementStock` atual lança erro se faltar saldo (rollback). Para pedido já aceito no aiqfome precisamos de um caminho que importe e marque *oversold* (como o prompt pede), sem reaproveitar a função como está.
4. **Duplo desconto:** não sabemos se o aiqfome desconta o estoque dele ao receber pedido (pergunta 3). Se desconta, importar o pedido e depois empurrar o `amount` pode divergir.
5. **Escopo de `categories`:** global no FoodiHub e por loja no aiqfome. O mapeamento precisa ser por integração.

---

## 4. Decisões de desenho já propostas (dependem da sua aprovação)

- **Credenciais:** reaproveitar `integrations.api_key/api_secret` + `config` (cifrado) para `client_id`/`refresh_token`/expiração. Migration para `TEXT` nas duas colunas, se o token real for longo. Renovação de token dentro do `AiqfomeClient` (com lock por integração para evitar refresh concorrente).
- **Estoque:** captura por **trigger Postgres** em `products` (`AFTER UPDATE OF amount, price, active`) gravando no outbox com coalescência — cobre os 3 caminhos atuais e qualquer futuro. Envio sempre do valor **absoluto atual** (se o contrato confirmar que é absoluto).
- **Sob encomenda:** coluna explícita `track_stock` (por produto ou em `external_mappings`) e ajuste do `decrementStock` para não exigir saldo quando não houver controle de estoque. Teste de regressão do comportamento atual antes de mexer.
- **Webhook de entrada:** rota pública `POST /webhooks/aiqfome/:integrationId`, valida `Authorization` com comparação em tempo constante, **só enfileira** (responde 200 rápido) e o worker processa; `GET` do pedido faz o detalhe. Polling de `GET /orders` como rede de segurança.
- **Idempotência de pedidos:** `UNIQUE` parcial em `sale_integrations (integration_id, external_id) WHERE external_id IS NOT NULL`.

---

## 5. Plano por fase (ajustado ao que a descoberta mostrou)

| Fase | Entrega | Bloqueada por |
|---|---|---|
| **0b (nova)** | Spike de leitura com loja de teste: resolver token (painel vs OAuth), base URL, formato de `inventory-quantity`, payloads reais de `GET /store`, `POST /menu`, `GET /orders`, `payment-methods`. Registrar tudo neste doc como VERIFICADO. | Seu aceite + token/loja de teste (perguntas 1 e 8) |
| **1 Fundação** | Migrations 022+ (`external_mappings`, `sync_outbox`, UNIQUE parcial, `TEXT` nas credenciais se preciso), `AiqfomeClient` com refresh de token, worker, rotas `connect/status/sync`. | 0b |
| **2 Loja e pagamentos** | Snapshot da loja, mapa de pagamentos (ampliar CHECK ou `other`, guardando o original em `origin_data`). | 0b (formato real de `payment-methods` e do pedido) |
| **3 Catálogo** | FoodiHub → aiqfome, importação com dry-run, opt-in por produto. | Ler endpoints de itens/tamanhos/adicionais (§2.3) + pergunta 4 |
| **4 Estoque** | Trigger + outbox, `track_stock`, reconciliação, anti-eco, *oversold*. | Pergunta 3 (absoluto vs delta; aiqfome desconta sozinho?) |
| **5 Pedidos** | Receptor de webhook + polling, import idempotente, cliente, itens não mapeados, taxa de entrega, status nos dois sentidos. | Ler os endpoints de transição de status (§2.3) |
| **6 Frontend** | Conectar, status, configuração, mapeamento de produtos, origem nas vendas. | Fases 1–5 |
| **7 Qualidade** | Testes com cliente mockado, observabilidade, docs, runbook. | — |

Ordem sugerida: 0b → 1 → 5 (pedidos entrando) → 4 (estoque) → 3 (catálogo) → 2 → 6 → 7, porque pedidos e estoque geram valor primeiro e o catálogo depende de ler mais endpoints. Posso seguir a ordem do prompt se preferir.

---

## 6. Perguntas em aberto (com recomendação)

1. **Qual autenticação vamos usar: token do painel ou OAuth/ID Magalu por loja?** Recomendo **OAuth por loja** (é o modelo oficial da v2 e o único que escala para vários lojistas). Preciso do `client_id`/`client_secret` do app no portal, ou do token do painel só para o spike de leitura.
2. **Base URL e prefixo.** Os guias usam `/store/...` e as páginas de endpoint `/api/v2/store/...`. Recomendo confirmar com um `GET /store` real e registrar o host.
3. **O aiqfome desconta o estoque sozinho ao receber um pedido? O `inventory-quantity` é valor absoluto ou delta? O que acontece ao chegar a 0?** Recomendo testar na loja de teste com um item de estoque 5: enviar `3`, ler de volta, depois criar pedido de teste. Sem isso a Fase 4 não começa.
4. **Qual o tipo da loja do cliente: Cardápio ou Catálogo?** Muda `in-separation`, formas de pagamento e provavelmente o modelo de itens. Recomendo começar só pelo tipo do cliente.
5. **Como o aiqfome modela preço por tamanho, adicionais e grupos obrigatórios?** Preciso ler as páginas de Menu. Hoje `product_sizes` não tem preço; se o aiqfome exigir, vira migration.
6. **Quais formas de pagamento o aiqfome devolve no pedido** (vale-refeição, online, dinheiro com troco…)? Recomendo adicionar `other` ao CHECK e guardar o original em `origin_data`.
7. **Quem entrega (loja ou Aiqentrega) e há taxa de entrega no pedido?** O payload do `new-order` tem `is_aiqentrega_delivery` e `order_is_pickup`. Recomendo `delivery_fee` em `sales`, verificando antes as views `vw_*`.
8. **Você pode criar uma loja de teste e me passar o token (somente leitura, `aqf:store:read`, `aqf:menu:read`, `aqf:order:read`)?** Preciso disso para o spike. Escrita só com sua autorização explícita naquela sessão.
9. **O servidor do FoodiHub é alcançável da internet** (para receber `new-order`)? Em dev, aceita um túnel (ngrok/cloudflared)? Se não, começamos só com polling.
10. **Intervalo de polling aceitável** (recomendo 30–60 s, ajustável por `AIQFOME_SYNC_INTERVAL_MS`) e, se houver rate limit, ele só aparece com uso real.
11. **Auto-aceite de pedido:** `order-read` marca como lido; confirmar se "ler" equivale a "aceitar" para o aiqfome (afeta a regra "só marcar como lido depois de persistir").

---

## 7. O que NÃO foi feito

- Nenhum código de produção, migration, rota ou teste.
- Nenhuma chamada à API real do aiqfome (nem GET).
- Nenhum commit nem branch (`feature/aiqfome-fase-0`). Posso criar e commitar este doc quando você pedir.
