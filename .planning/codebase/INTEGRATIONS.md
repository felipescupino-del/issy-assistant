# External Integrations

**Analysis Date:** 2026-02-23

## APIs & External Services

**AI/LLM:**
- OpenAI - GPT-4o-mini chat completions for conversational responses
  - SDK/Client: `openai` 4.67.0
  - Auth: `OPENAI_API_KEY` environment variable
  - Implementation: `src/services/ai.service.ts`
  - Configuration: Model, temperature, and max tokens configurable via env vars

**Messaging (Dual Provider):**
- Evolution API - WhatsApp Business API via Evolution platform
  - SDK/Client: `axios` 1.7.7 (REST calls)
  - Auth: `EVOLUTION_API_KEY` header
  - URL: `EVOLUTION_API_URL` environment variable
  - Instance: `EVOLUTION_INSTANCE` environment variable
  - Endpoint: `POST /{evolutionApiUrl}/message/sendText/{evolutionInstance}`
  - Implementation: `src/services/whatsapp.service.ts` → `sendViaEvolutionApi()`

- Meta Cloud API - WhatsApp Official Business API
  - SDK/Client: `axios` 1.7.7 (REST calls)
  - Auth: `META_ACCESS_TOKEN` bearer token
  - Phone Number ID: `META_PHONE_NUMBER_ID` environment variable
  - Endpoint: `POST https://graph.facebook.com/v20.0/{phoneNumberId}/messages`
  - Implementation: `src/services/whatsapp.service.ts` → `sendViaMetaApi()`
  - Provider selection: `WHATSAPP_PROVIDER` env var ("evolution" or "meta")

## Data Storage

**Databases:**
- PostgreSQL 12+
  - Connection: `DATABASE_URL` environment variable
  - Client: `pg` 8.13.0 (node-postgres)
  - Connection pool: `src/db/client.ts`
    - Max connections: 10
    - Idle timeout: 30,000ms
    - Connection timeout: 5,000ms
  - Schema: `src/db/migrations/001_initial.sql`

**Schema Tables:**
- `contatos` - Contact information for leads, brokers, and clients
  - Columns: id, telefone (unique), nome, tipo (lead/corretor/cliente), corretora, atendimento_humano (flag), ultimo_contexto, criado_em, atualizado_em
  - Indexes: idx_contatos_telefone
  - Triggers: auto-update atualizado_em on row changes

- `historico_mensagens` - Conversation history for AI context
  - Columns: id, telefone, role (user/assistant), content, criado_em
  - Indexes: idx_historico_telefone, idx_historico_criado_em
  - Purpose: Provides message history for OpenAI chat context window

**File Storage:**
- Not detected - No file storage integration (local or cloud)

**Caching:**
- None - In-memory or Redis not used

## Authentication & Identity

**Auth Provider:**
- Custom implementation - No third-party auth provider
  - API keys managed via environment variables
  - Webhook validation: via provider-specific headers (Evolution: apikey header, Meta: Bearer token validation)

**Security:**
- Evolution API: Header-based API key authentication
- Meta API: Bearer token in Authorization header
- Database: Connection string-based authentication (PostgreSQL)
- OpenAI: Header-based API key

## Monitoring & Observability

**Error Tracking:**
- Not detected - No Sentry, DataDog, or similar

**Logs:**
- Console logging only
  - `console.log()` and `console.error()` throughout codebase
  - Log locations: `src/index.ts`, `src/routes/webhook.ts`, `src/db/client.ts`, `src/services/`
  - Example tags: `[DB]`, `[Server]`, `[Webhook]`, `[Admin]`

## CI/CD & Deployment

**Hosting:**
- Not detected - No platform specified (likely self-hosted or containerized)

**CI Pipeline:**
- Not detected - No GitHub Actions, GitLab CI, or similar

## Environment Configuration

**Required env vars (must be set):**
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key
- At least one WhatsApp provider:
  - If `WHATSAPP_PROVIDER=evolution`: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`
  - If `WHATSAPP_PROVIDER=meta`: `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`

**Optional env vars:**
- `PORT` (default: 3000)
- `WHATSAPP_PROVIDER` (default: evolution)
- `OPENAI_MODEL` (default: gpt-4o-mini)
- `OPENAI_TEMPERATURE` (default: 0.85)
- `OPENAI_MAX_TOKENS` (default: 500)
- `TEAM_NOTIFICATION_NUMBER` (default: empty - no team notifications)
- `HUMAN_DELAY_MIN_MS` (default: 1500)
- `HUMAN_DELAY_MAX_MS` (default: 8000)
- `HISTORY_LIMIT` (default: 20)

**Secrets location:**
- `.env` file (local development, not committed)
- Environment variables (production)
- See `.env.example` for template

## Webhooks & Callbacks

**Incoming:**
- WhatsApp Webhook: `POST /whatsapp-webhook`
  - Receives messages from Evolution API or Meta Cloud API
  - Parses provider format to extract phone, name, message text
  - Routes to message processing pipeline
  - Returns 200 immediately, processes asynchronously
  - Implementation: `src/routes/webhook.ts` → `processMessage()`

**Outgoing:**
- WhatsApp Message Send: Evolution API or Meta Cloud API
  - Called after AI generates response
  - Includes humanization delay to simulate typing
  - Target: User's WhatsApp phone number
  - Implementation: `src/services/whatsapp.service.ts` → `sendMessage()`

- Team Notifications: WhatsApp message to team
  - Sent when contact requests human transfer or is in human mode
  - Contains contact info, message text, and revert command
  - Target: `TEAM_NOTIFICATION_NUMBER` (if configured)
  - Implementation: `src/routes/webhook.ts` (lines 48-54, 77-86)

---

*Integration audit: 2026-02-23*
