# Publicar o FoodiHub em um servidor (VPS com Docker)

Tudo roda em Docker no mesmo servidor: **Caddy** (HTTPS automático) na frente, o **site** e a **API** atrás
dele, e o **Postgres** sem nenhuma porta aberta para a internet. Site e API ficam no **mesmo endereço**
(o Caddy manda `/api`, `/auth` e `/health` para a API), então não há CORS para configurar.

Este roteiro foi ensaiado de ponta a ponta (migrations, cadastro da primeira loja, fechar o cadastro,
backup e restauração, redefinir senha).

## 0. O que você precisa

- Um servidor Linux (Ubuntu 22.04 ou 24.04), com **2 GB de RAM** ou mais, e acesso por SSH.
- O **IP público** do servidor.
- Um endereço para o site:
  - **Com domínio** (recomendado, ex.: registro.br, ~R$ 40/ano): crie um registro **A** `app` apontando para o IP.
    O endereço fica `app.seudominio.com.br`.
  - **Sem domínio**: use `app.<IP com pontos>.sslip.io`, por exemplo `app.203.0.113.10.sslip.io`. É gratuito e
    recebe certificado HTTPS de verdade. Serve para testar; para uso contínuo, registre um domínio.

## 1. Preparar o servidor

```bash
# firewall: só SSH, HTTP e HTTPS
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443 && sudo ufw enable

# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER      # saia e entre de novo no SSH
```

## 2. Baixar o código (os dois repositórios lado a lado)

```bash
sudo mkdir -p /opt/foodihub && sudo chown $USER /opt/foodihub && cd /opt/foodihub
git clone git@github.com:EduSantos94/foodihub-backend.git  backend
git clone git@github.com:EduSantos94/foodihub-frontend.git frontend
```

## 3. Configurar os segredos

```bash
cd /opt/foodihub/backend/deploy
cp .env.prod.example .env.prod
nano .env.prod
```

Preencha:

| Campo | Valor |
|---|---|
| `SITE_ADDRESS` | o endereço do passo 0 (sem `https://`) |
| `DB_PASSWORD` | `openssl rand -hex 24` |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `INTEGRATION_ENCRYPTION_KEY` | `openssl rand -hex 32` |

**Guarde uma cópia do `.env.prod` em lugar seguro, fora do servidor** (gerenciador de senhas). Se a
`INTEGRATION_ENCRYPTION_KEY` for perdida, as chaves de API salvas nas integrações ficam ilegíveis.
O arquivo nunca vai para o Git.

## 4. Subir

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.prod -f docker-compose.prod.yml exec backend npm run migrate
```

> Dica: `alias dc='docker compose --env-file .env.prod -f docker-compose.prod.yml'` deixa os comandos curtos.

Abra `https://SEU_ENDERECO`. Na primeira vez o certificado leva alguns segundos para sair.

## 5. Criar a sua loja e virar administrador do sistema

1. Em `https://SEU_ENDERECO`, clique em **Cadastre sua loja** e preencha com os dados reais (CNPJ válido).
2. Torne-se administrador do sistema (libera Categorias e Lojas):
   ```bash
   docker compose --env-file .env.prod -f docker-compose.prod.yml exec backend npm run platform-admin -- seu@email.com
   ```
3. **Feche o cadastro público**: no `.env.prod` troque para `ALLOW_PUBLIC_REGISTRATION=false` e aplique:
   ```bash
   docker compose --env-file .env.prod -f docker-compose.prod.yml up -d backend
   ```
   O link "Cadastre sua loja" some do login. Para receber uma loja nova, abra de novo por um instante e feche.

## 6. Backup (não pule)

```bash
chmod +x /opt/foodihub/backend/deploy/backup.sh
/opt/foodihub/backend/deploy/backup.sh            # teste: deve imprimir "ok: ... (XXK)"
crontab -e
# todo dia às 3h:
0 3 * * * /opt/foodihub/backend/deploy/backup.sh >> /var/log/foodihub-backup.log 2>&1
```

Os backups ficam em `/opt/foodihub-backups` por 14 dias. **Copie essa pasta para outro lugar** (outra máquina
com `rsync`, ou um bucket com `rclone`): backup só no mesmo servidor não protege se o servidor for perdido.

**Teste a restauração** pelo menos uma vez, em um banco separado, sem tocar no de verdade:

```bash
DC="docker compose --env-file .env.prod -f docker-compose.prod.yml"
$DC exec -T db sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE restore_test"'
gunzip -c /opt/foodihub-backups/ARQUIVO.sql.gz | $DC exec -T db sh -c 'psql -U "$POSTGRES_USER" -d restore_test -q'
echo "select count(*) from stores" | $DC exec -T db sh -c 'psql -U "$POSTGRES_USER" -d restore_test -At'
$DC exec -T db sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE restore_test"'
```

## 7. Atualizar o sistema

```bash
cd /opt/foodihub/backend  && git pull
cd /opt/foodihub/frontend && git pull
cd /opt/foodihub/backend/deploy
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.prod -f docker-compose.prod.yml exec backend npm run migrate
```

Faça um backup antes de atualizar quando houver migration nova.

## 8. Dia a dia

```bash
DC="docker compose --env-file .env.prod -f docker-compose.prod.yml"
$DC ps                          # situação dos serviços
$DC logs -f backend             # logs da API
$DC logs --tail 100 caddy       # logs do HTTPS
# alguém esqueceu a senha (ainda não há recuperação por e-mail):
$DC exec backend npm run reset-password -- pessoa@email.com
#   imprime uma senha nova; entregue com segurança e peça para trocar em "Meu perfil"
```

## Checklist antes de usar de verdade

- [ ] `https://SEU_ENDERECO` abre com cadeado e o login funciona
- [ ] Você é administrador do sistema (menu **Plataforma → Lojas** aparece)
- [ ] Cadastro público fechado (`ALLOW_PUBLIC_REGISTRATION=false`)
- [ ] Backup rodou, está no cron e foi copiado para fora do servidor
- [ ] Restauração testada uma vez
- [ ] `.env.prod` guardado fora do servidor
- [ ] Nenhum usuário de teste (`admin@foodihub.local`, senha `123456`) existe nesse banco: ele só existe no seu
      computador de desenvolvimento. O banco de produção começa vazio.
- [ ] `ufw status` mostra só 22, 80 e 443

## Limitações conhecidas

- **Sem recuperação de senha por e-mail** (use `reset-password`).
- O limite de tentativas de login fica na memória: zera quando a API reinicia (suficiente para uma instância).
- Uma única instância da API em um único servidor: para o piloto basta; alta disponibilidade é outro assunto.
- Planos e cobrança não existem: cobre à mão e use a tela **Lojas** para ativar/desativar.
