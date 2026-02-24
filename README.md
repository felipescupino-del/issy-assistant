# Issy Assistant — WhatsApp AI para Corretores de Seguros

Backend Node.js/TypeScript que implementa a lógica da Issy: assistente IA para corretores de seguros via WhatsApp.

## Stack

- **Runtime**: Node.js 20+
- **Linguagem**: TypeScript 5
- **HTTP Server**: Express 4
- **Banco de dados**: PostgreSQL (node-postgres)
- **IA**: OpenAI GPT-4o-mini
- **WhatsApp**: Evolution API ou Meta Cloud API

## Estrutura

```
src/
├── index.ts                  # Entry point
├── config.ts                 # Configurações e env vars
├── types/index.ts            # Interfaces TypeScript
├── db/
│   ├── client.ts             # Pool PostgreSQL
│   └── migrations/001_initial.sql
├── routes/
│   ├── webhook.ts            # POST /whatsapp-webhook
│   └── admin.ts              # POST /whatsapp-admin
└── services/
    ├── parser.service.ts     # Parseia mensagens (Evolution/Meta/genérico)
    ├── contact.service.ts    # CRUD de contatos
    ├── intent.service.ts     # Detecção de intenção
    ├── faq.service.ts        # Base de FAQ
    ├── quote.service.ts      # Fluxo de cotação
    ├── ai.service.ts         # OpenAI com histórico de conversa
    ├── whatsapp.service.ts   # Envio de mensagens + delay de humanização
    └── history.service.ts    # Histórico de mensagens no PostgreSQL
```

## Setup

### 1. Pré-requisitos

- Node.js 20+
- PostgreSQL 14+

### 2. Instalar dependências

```bash
cd issy-assistant
npm install
```

### 3. Configurar variáveis de ambiente

```bash
cp .env.example .env
# Edite o .env com seus valores
```

### 4. Criar banco de dados

```bash
# Criar banco
createdb issy_assistant

# Rodar migration
npm run db:migrate
# ou manualmente:
psql $DATABASE_URL -f src/db/migrations/001_initial.sql
```

### 5. Rodar em desenvolvimento

```bash
npm run dev
```

### 6. Build para produção

```bash
npm run build
npm start
```

## Endpoints

### `POST /whatsapp-webhook`
Recebe mensagens do WhatsApp. Retorna `200 {"status":"received"}` imediatamente e processa em background.

**Formato Evolution API:**
```json
{
  "data": {
    "key": { "remoteJid": "5511999999999@s.whatsapp.net" },
    "message": { "conversation": "Olá!" },
    "pushName": "Felipe"
  }
}
```

**Formato Meta Cloud API:**
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{ "from": "5511999999999", "text": { "body": "Olá!" } }],
        "contacts": [{ "profile": { "name": "Felipe" } }]
      }
    }]
  }]
}
```

### `POST /whatsapp-admin`
Comandos administrativos.

```bash
# Devolver contato ao bot (desativar modo humano)
curl -X POST http://localhost:3000/whatsapp-admin \
  -H "Content-Type: application/json" \
  -d '{"command": "/bot 5511999999999"}'

# Verificar status de um contato
curl -X POST http://localhost:3000/whatsapp-admin \
  -H "Content-Type: application/json" \
  -d '{"command": "/status 5511999999999"}'
```

### `GET /health`
Health check do servidor.

## Fluxo de Mensagens

```
Webhook → Parsear → Filtrar vazias → Buscar/Criar contato
  ↓
Em modo humano? → Sim: notificar equipe, parar
  ↓ Não
Detectar intenção:
  ├── transferir_humano → ativar modo humano + resposta de transferência
  ├── cotacao → perguntar dados do seguro
  ├── faq → buscar na base de conhecimento (fallback: IA)
  └── saudacao / conversa_geral → OpenAI com histórico
  ↓
Delay de humanização (1.5s – 8s baseado no tamanho da resposta)
  ↓
Enviar mensagem → Salvar histórico
```

## Intenções Detectadas

| Intenção | Exemplos de frases |
|---|---|
| `transferir_humano` | "falar com atendente", "humano", "transferir" |
| `cotacao` | "cotar seguro", "cotação auto", "simular" |
| `faq` | "como funciona", "quanto custa", "sinistro" |
| `saudacao` | "oi", "bom dia", "olá" |
| `conversa_geral` | qualquer outra coisa → IA |

## Teste Rápido

```bash
# Simular mensagem "oi" de um usuário (Evolution API format)
curl -X POST http://localhost:3000/whatsapp-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "key": { "remoteJid": "5511999999999@s.whatsapp.net" },
      "message": { "conversation": "oi" },
      "pushName": "Felipe"
    }
  }'

# Simular pedido de cotação
curl -X POST http://localhost:3000/whatsapp-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "key": { "remoteJid": "5511999999999@s.whatsapp.net" },
      "message": { "conversation": "quero cotar seguro auto" },
      "pushName": "Felipe"
    }
  }'
```
