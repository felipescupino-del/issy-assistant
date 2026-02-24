# Architecture

**Analysis Date:** 2026-02-23

## Pattern Overview

**Overall:** Service-oriented layered architecture with request-response background processing pattern.

**Key Characteristics:**
- Three-layer separation: HTTP routing layer, business logic services, and data access layer
- Immediate webhook response (200) with asynchronous background message processing
- Middleware pipeline for message enhancement and intent routing
- Service functions exported for composition in route handlers
- Single Express application with two primary endpoints handling WhatsApp integration

## Layers

**HTTP Routes Layer:**
- Purpose: Receive webhook events, parse HTTP requests, return immediate responses
- Location: `src/routes/webhook.ts`, `src/routes/admin.ts`
- Contains: Express Router definitions, request validation, response composition
- Depends on: Services layer, config, database client
- Used by: Express app in `src/index.ts`

**Services Layer:**
- Purpose: Business logic encapsulation including parsing, intent detection, data enrichment, message generation
- Location: `src/services/` (8 service files)
- Contains: Pure functions and async operations for domain logic
- Depends on: Database client, external APIs (OpenAI, WhatsApp providers), config, types
- Used by: Route handlers, other services

**Data Access Layer:**
- Purpose: PostgreSQL connection pooling and query execution
- Location: `src/db/client.ts`
- Contains: pg Pool configuration, connection error handling
- Depends on: config (database URL)
- Used by: History service, contact service, admin route

**Configuration Layer:**
- Purpose: Environment variable validation and centralized config object
- Location: `src/config.ts`
- Contains: Required/optional env var parsing, typed config object
- Depends on: dotenv, process.env
- Used by: All other layers

## Data Flow

**Webhook Processing Pipeline:**

1. HTTP POST `/whatsapp-webhook` received → Return `{status: "received"}` immediately
2. Call `processMessage(body)` in background (fire-and-forget, async)
3. Parse webhook payload (Evolution API or Meta Cloud API format) → `ParsedMessage`
4. Filter empty messages (skip if no text)
5. Find existing contact or create new one
6. Enrich message with contact data → `EnrichedMessage`
7. Check human mode flag:
   - If true: notify team, return
   - If false: continue to step 8
8. Detect intent using keyword patterns → `IntentResult`
9. Route on intent:
   - `transferir_humano`: Set human mode, send transfer response, notify team
   - `cotacao`: Build insurance quote prompt based on keywords
   - `faq`: Look up FAQ by keyword matching, fallback to AI if not found
   - `saudacao` / `conversa_geral`: Load chat history, call OpenAI with system prompt
10. Calculate human delay (response length × 30ms + variance, clamped to min/max)
11. Sleep for calculated delay (humanization)
12. Send message via Evolution API or Meta Cloud API
13. Save exchange (user message + assistant response) to `historico_mensagens`

**Admin Command Processing:**

1. HTTP POST `/whatsapp-admin` with `{command: "/bot <phone>" | "/status <phone>"}`
2. Parse command string
3. Route on action:
   - `/bot <phone>`: Set `atendimento_humano = false` for contact
   - `/status <phone>`: Query and return contact record

**State Management:**
- Contact state persisted in PostgreSQL `contatos` table (human mode flag, contact type, etc.)
- Conversation history stored in `historico_mensagens` (paginated, last N messages)
- Request-scoped enriched message objects passed through processing pipeline
- No in-memory session state or caching

## Key Abstractions

**ParsedMessage:**
- Purpose: Normalized webhook payload regardless of provider format
- Examples: `src/services/parser.service.ts` produces this type
- Pattern: Adapter pattern — transforms Evolution API or Meta API JSON into common structure

**EnrichedMessage:**
- Purpose: Message annotated with contact data and processing flags
- Examples: Extended from `ParsedMessage` with contact object, isNewContact, isHumanMode
- Pattern: Data enrichment pipeline — each layer adds context

**IntentResult:**
- Purpose: Message plus detected user intention for routing
- Examples: Extends `EnrichedMessage` with intent field (5-value union type)
- Pattern: Route classification — enables switch-based handler selection

**Contact:**
- Purpose: Persistent user representation in system
- Examples: `src/types/index.ts` defines structure with phone, name, type, human mode flag
- Pattern: Domain model — maps to PostgreSQL schema

**HistoryMessage:**
- Purpose: Conversation turn for OpenAI context
- Examples: `{role: "user" | "assistant", content: string}`
- Pattern: OpenAI protocol adaptation — aligns with Chat Completions API format

## Entry Points

**Express Server:**
- Location: `src/index.ts`
- Triggers: `npm run dev` or `npm start`
- Responsibilities: Load config, test DB connection, create Express app, register routes, listen on port

**Webhook Route:**
- Location: `src/routes/webhook.ts` - `POST /whatsapp-webhook`
- Triggers: WhatsApp provider sends incoming message notification
- Responsibilities: Parse webhook, respond immediately, spawn background processing

**Admin Route:**
- Location: `src/routes/admin.ts` - `POST /whatsapp-admin`
- Triggers: Internal team commands (return to bot, check status)
- Responsibilities: Parse command, execute action (set human mode or return contact)

**Health Check:**
- Location: `src/index.ts` - `GET /health`
- Triggers: Monitoring/load balancer polls
- Responsibilities: Return service status and timestamp

## Error Handling

**Strategy:** Silent catches with console logging; non-blocking errors don't crash server

**Patterns:**
- Route handlers wrap `processMessage()` in `.catch()` — logs error, doesn't respond
- Service functions throw on critical failures (OpenAI API errors, DB connection errors)
- Fallback text returned if AI response parsing fails: `"Hmm, não consegui processar isso. Me manda de novo? 😊"`
- FAQ lookup returns `null` on no match, triggers AI fallback
- Message sending failures caught but logged (notifications suppress errors with `.catch(() => null)`)
- DB pool error handler logs but doesn't exit

## Cross-Cutting Concerns

**Logging:**
- Pattern: `console.log` with `[Component]` prefix (e.g., `[Webhook]`, `[DB]`, `[Server]`)
- Used in: Every service and route for debugging
- Information: User phone numbers, intent detection, API calls, delays

**Validation:**
- Pattern: Type narrowing via TypeScript; no runtime schema validation
- Environment: Config layer validates required env vars at startup (throws Error if missing)
- Input: Parser accepts any JSON structure, extracts fields via optional chaining

**Authentication:**
- Pattern: API key-based for external services (OpenAI, WhatsApp providers)
- Stored: Config layer reads from env vars
- Admin endpoint: No authentication (assumes internal use)

**Rate Limiting:** None detected — relies on WhatsApp provider's rate limits

---

*Architecture analysis: 2026-02-23*
