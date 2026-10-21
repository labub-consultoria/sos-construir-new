# SOS Construir — Sistema de Cadastros

Sistema de cadastro com a identidade visual do [SOS Construir](https://sosconstruir.com.br):

- **Cadastro de Empresa** — Razão Social, Nome da Empresa, CNPJ/CPF, Segmento, Cidade e logo (opcional).
- **Cadastro de Prestador de Serviço** — Nome Completo, Data de Nascimento, RG/CPF, Telefone, Endereço e foto (opcional).

Os dados ficam em **PostgreSQL** e as imagens em um **bucket S3-compatível**. As tabelas são criadas
automaticamente por *migrations* quando o backend inicia.

## Sumário

1. [Pré-requisitos](#1-pré-requisitos)
2. [Estrutura do projeto](#2-estrutura-do-projeto)
3. [Setup local passo a passo](#3-setup-local-passo-a-passo)
4. [Variáveis de ambiente](#4-variáveis-de-ambiente)
5. [Como funcionam as migrations](#5-como-funcionam-as-migrations)
6. [API](#6-api)
7. [Comandos úteis](#7-comandos-úteis)
8. [Resolução de problemas](#8-resolução-de-problemas)
9. [Produção](#9-produção)

---

## 1. Pré-requisitos

| Ferramenta | Versão | Para quê |
|---|---|---|
| [Node.js](https://nodejs.org) | **20.6 ou superior** (testado na 24) | Rodar o backend (usa `--env-file`) |
| npm | 10+ (já vem com o Node) | Instalar dependências |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | com Docker Compose v2 | Subir o PostgreSQL e o S3 local |

Confira no terminal:

```bash
node -v
docker -v
docker compose version
```

> O Docker Desktop precisa estar **aberto e rodando** antes de continuar.

## 2. Estrutura do projeto

```
sosconstruir/
├── docker-compose.yml        # PostgreSQL + S3 local (desenvolvimento)
├── frontend/                 # Páginas estáticas (servidas pelo backend)
│   ├── index.html            #   escolha do tipo de cadastro
│   ├── empresa.html          #   formulário de empresa
│   ├── prestador.html        #   formulário de prestador
│   ├── css/styles.css        #   identidade visual
│   ├── js/forms.js           #   máscaras, validação e envio
│   └── assets/logo.svg
└── backend/
    ├── .env.example          # modelo das variáveis de ambiente
    ├── migrations/           # SQL versionado (001_cadastros.sql, ...)
    └── src/
        ├── server.js         #   API Express + servidor do frontend
        ├── migrate.js        #   executor de migrations
        ├── db.js             #   conexão com o PostgreSQL
        ├── storage.js        #   upload/download no bucket S3
        └── validate.js       #   validação no servidor (CPF, CNPJ, etc.)
```

## 3. Setup local passo a passo

### 3.1. Subir o PostgreSQL e o bucket

Na raiz do projeto:

```bash
docker compose up -d
```

Isso sobe dois containers:

| Serviço | Porta | O que é |
|---|---|---|
| `postgres` | `5432` | PostgreSQL 16 (banco `sosconstruir`) |
| `s3` | `9090` | S3 local (`adobe/s3mock`) com o bucket `sosconstruir-imagens` já criado |

Confirme que estão de pé (o Postgres deve aparecer como `healthy`):

```bash
docker compose ps
```

Os dados ficam em volumes Docker (`pgdata` e `s3data`) e **sobrevivem** a reinícios.

### 3.2. Configurar as variáveis de ambiente

```bash
cd backend
cp .env.example .env
```

No Windows (PowerShell) use `Copy-Item .env.example .env`.

Os valores padrão já funcionam com o `docker-compose.yml`. Não é preciso editar nada para rodar localmente.

### 3.3. Instalar dependências e iniciar

Ainda dentro de `backend/`:

```bash
npm install
npm start
```

Saída esperada na primeira execução:

```
migration aplicada: 001_cadastros.sql
http://localhost:3000
```

Nas execuções seguintes a linha da migration não aparece, pois ela já foi aplicada.

### 3.4. Abrir o sistema

Acesse **http://localhost:3000**.

- http://localhost:3000/empresa.html — cadastro de empresa
- http://localhost:3000/prestador.html — cadastro de prestador

### 3.5. Conferir que gravou

Depois de enviar um cadastro, consulte o banco:

```bash
docker compose exec postgres psql -U sosconstruir -c "select razao_social, documento, created_at from empresas"
```

```bash
docker compose exec postgres psql -U sosconstruir -c "select nome, nascimento, created_at from prestadores"
```

## 4. Variáveis de ambiente

Definidas em `backend/.env` (modelo em `backend/.env.example`):

| Variável | Padrão local | Descrição |
|---|---|---|
| `PORT` | `3000` | Porta do servidor |
| `DATABASE_URL` | `postgres://sosconstruir:sosconstruir@localhost:5432/sosconstruir` | String de conexão do PostgreSQL |
| `S3_ENDPOINT` | `http://localhost:9090` | Endpoint do S3 |
| `S3_REGION` | `us-east-1` | Região |
| `S3_ACCESS_KEY` | `sosconstruir` | Chave de acesso |
| `S3_SECRET_KEY` | `sosconstruir123` | Chave secreta |
| `S3_BUCKET` | `sosconstruir-imagens` | Nome do bucket (criado automaticamente se não existir) |

> `backend/.env` está no `.gitignore`. **Nunca** versione credenciais reais.

## 5. Como funcionam as migrations

- Ficam em `backend/migrations/` como arquivos `.sql` numerados (`001_...`, `002_...`).
- **Ao iniciar o backend**, todas as migrations ainda não aplicadas rodam em ordem alfabética, cada uma dentro de uma transação (se falhar, nada é gravado e o servidor não sobe).
- O controle fica na tabela `schema_migrations`.
- Para só aplicar as migrations, sem subir o servidor: `npm run migrate`.

**Para criar uma nova migration**, adicione um arquivo com o próximo número, por exemplo
`backend/migrations/002_adiciona_email.sql`:

```sql
ALTER TABLE empresas ADD COLUMN email text;
```

Reinicie o backend e ela será aplicada. **Não edite** uma migration já aplicada: crie uma nova.

### Tabelas atuais

**`empresas`** — `id` (uuid), `razao_social`, `nome`, `documento` (só dígitos, **único**), `segmento`, `cidade`, `logo_key`, `created_at`

**`prestadores`** — `id` (uuid), `nome`, `nascimento` (date), `documento`, `telefone`, `endereco`, `foto_key`, `created_at`

`logo_key` e `foto_key` guardam a chave do arquivo no bucket (ex.: `logos/<uuid>.png`).

## 6. API

Todas as rotas de cadastro aceitam `multipart/form-data`.

### `POST /api/empresas`

| Campo | Obrigatório | Observação |
|---|---|---|
| `razaoSocial` | sim | mín. 2 caracteres |
| `nomeEmpresa` | sim | mín. 2 caracteres |
| `cnpj` | sim | CNPJ ou CPF válido (com ou sem máscara) |
| `segmento` | sim | mín. 2 caracteres |
| `cidade` | sim | mín. 2 caracteres |
| `logo` | não | imagem JPG, PNG ou WebP, até 5 MB |

### `POST /api/prestadores`

| Campo | Obrigatório | Observação |
|---|---|---|
| `nome` | sim | mín. 2 caracteres |
| `nascimento` | sim | formato `AAAA-MM-DD`, maior de 18 anos |
| `documento` | sim | RG ou CPF (se for CPF, é validado) |
| `telefone` | sim | com DDD, 10 ou 11 dígitos |
| `endereco` | sim | mín. 2 caracteres |
| `foto` | não | imagem JPG, PNG ou WebP, até 5 MB |

### Respostas

| Status | Significado | Corpo |
|---|---|---|
| `201` | Criado | `{ "id": "<uuid>" }` |
| `400` | Dados inválidos | `{ "errors": { "campo": "mensagem" } }` |
| `409` | CNPJ/CPF de empresa já cadastrado | `{ "errors": { "cnpj": "..." } }` |
| `500` | Erro interno | `{ "error": "Erro interno." }` |

### `GET /api/imagens/:pasta/:arquivo`

Devolve uma imagem do bucket. `:pasta` é `logos` ou `fotos`.

### Exemplo com curl

```bash
curl -X POST http://localhost:3000/api/empresas \
  -F razaoSocial="Exemplo Ltda" -F nomeEmpresa="Exemplo" \
  -F cnpj="11.444.777/0001-61" -F segmento="Pintura" -F cidade="Foz do Iguaçu" \
  -F logo=@logo.png
```

## 7. Comandos úteis

| O que fazer | Comando |
|---|---|
| Subir banco e bucket | `docker compose up -d` |
| Parar (mantém os dados) | `docker compose stop` |
| Derrubar containers (mantém os dados) | `docker compose down` |
| **Apagar tudo** (banco e imagens) | `docker compose down -v` |
| Ver logs | `docker compose logs -f postgres` ou `docker compose logs -f s3` |
| Console SQL | `docker compose exec postgres psql -U sosconstruir` |
| Listar tabelas | `docker compose exec postgres psql -U sosconstruir -c "\dt"` |
| Rodar só as migrations | `cd backend && npm run migrate` |
| Recomeçar do zero | `docker compose down -v && docker compose up -d` e depois `npm start` |

## 8. Resolução de problemas

**`ECONNREFUSED 127.0.0.1:5432`** — o Postgres não está de pé. Verifique se o Docker Desktop está aberto
e rode `docker compose up -d`. Aguarde o status `healthy` em `docker compose ps`.

**`ECONNREFUSED 127.0.0.1:9090` ou erro de S3 ao iniciar** — o container `s3` ainda está subindo (leva alguns
segundos) ou caiu. Veja `docker compose logs s3` e tente `npm start` de novo.

**`EADDRINUSE: address already in use :::3000`** — outra aplicação usa a porta 3000. Troque `PORT` em
`backend/.env` (ex.: `3001`).

**`port is already allocated` (5432 ou 9090)** — já existe um PostgreSQL local (ou outro serviço) nessas portas.
Pare-o, ou mude o lado esquerdo do mapeamento em `docker-compose.yml` (ex.: `"5433:5432"`) e ajuste
`DATABASE_URL`/`S3_ENDPOINT` no `.env`.

**`bad option: --env-file`** — Node antigo. Atualize para 20.6 ou superior.

**Erro 500 `InternalError` do S3 ao iniciar** — o container do S3 não consegue gravar no volume. O compose já usa
`user: root` para evitar isso; se persistir, rode `docker compose down -v && docker compose up -d`.

**Falha em uma migration** — o servidor não sobe e a mensagem indica o arquivo (`falha em 00X_...sql: ...`).
Corrija o SQL (a transação foi revertida) e reinicie.

**Troquei a senha do Postgres e não conecta** — a senha só vale na criação do volume. Rode
`docker compose down -v` para recriar o banco (apaga os dados) ou altere a senha dentro do banco.

## 9. Produção

O `docker-compose.yml` é **apenas para desenvolvimento**. O `adobe/s3mock` é um simulador e não deve ser usado em produção.

1. Use um PostgreSQL gerenciado e informe a `DATABASE_URL` (com SSL, se o provedor exigir).
2. Use um bucket S3-compatível real (AWS S3, Cloudflare R2, etc.): ajuste `S3_ENDPOINT`, `S3_REGION`,
   `S3_ACCESS_KEY`, `S3_SECRET_KEY` e `S3_BUCKET`. Crie o bucket com antecedência e dê ao usuário permissão
   de leitura e escrita.
3. Troque todas as senhas e chaves do exemplo.
4. Coloque o backend atrás de HTTPS (proxy reverso).
5. Considere adicionar autenticação em uma área administrativa para consultar os cadastros: hoje não existe tela
   para isso, e as rotas de imagem são públicas para quem tiver o link.
