# Architecture Research

**Domain:** WhatsApp AI chatbot for insurance brokers (TypeScript/Express/PostgreSQL/OpenAI)
**Researched:** 2026-02-24
**Confidence:** HIGH — findings triangulated across external research, Evolution API docs, and existing codebase inspection

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL LAYER                               │
│                                                                      │
│  ┌──────────────────┐          ┌──────────────────────────────────┐  │
│  │  WhatsApp Network│          │  Team Admin (human operators)    │  │
│  └────────┬─────────┘          └─────────────────┬────────────────┘  │
│           │                                       │                  │
│  ┌────────▼─────────┐                             │                  │
│  │  Evolution API   │                             │                  │
│  │  (or Meta Cloud) │                             │                  │
│  └────────┬─────────┘                             │                  │
└───────────┼───────────────────────────────────────┼──────────────────┘
            │ POST /webhook                  POST /admin
            ▼                                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                             │
│                       (Express / TypeScript)                         │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                     WEBHOOK ROUTE (/webhook)                 │    │
│  │  1. Ack immediately (HTTP 200)                               │    │
│  │  2. Fire processMessage() async                              │    │
│  └──────────────────────────────┬──────────────────────────────┘    │
│                                 │                                    │
│  ┌──────────────────────────────▼──────────────────────────────┐    │
│  │                    MESSAGE PIPELINE                           │    │
│  │                                                              │    │
│  │  Parser → Contact → Intent → Response Builder → Sender       │    │
│  │                                                              │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐             │    │
│  │  │   Parser   │  │  Contact   │  │   Intent   │             │    │
│  │  │  Service   │  │  Service   │  │  Service   │             │    │
│  │  └────────────┘  └────────────┘  └────────────┘             │    │
│  │                                                              │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐             │    │
│  │  │    FAQ     │  │   Quote    │  │    AI      │             │    │
│  │  │  Service   │  │  Service   │  │  Service   │             │    │
│  │  └────────────┘  └────────────┘  └────────────┘             │    │
│  │                                                              │    │
│  │  ┌────────────┐  ┌────────────┐                             │    │
│  │  │  History   │  │ WhatsApp   │                             │    │
│  │  │  Service   │  │  Service   │                             │    │
│  │  └────────────┘  └────────────┘                             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    ADMIN ROUTE (/admin)                       │    │
│  │  Commands: /bot <phone>  /status <phone>                     │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
            │                                        │
            ▼                                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          DATA LAYER                                  │
│                                                                      │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐ │
│  │   PostgreSQL                 │  │   OpenAI API (external)       │ │
│  │   ─────────────────────────  │  │   ────────────────────────    │ │
│  │   contatos                   │  │   gpt-4o-mini                 │ │
│  │   historico_mensagens        │  │   Chat Completions            │ │
│  └──────────────────────────────┘  └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Webhook Route** | Receive Evolution API / Meta Cloud API POST, ack immediately, fire async processing | `POST /webhook` — responds HTTP 200 before any logic runs |
| **Admin Route** | Process team commands to switch contacts between bot/human mode | `POST /admin` — `/bot <phone>`, `/status <phone>` |
| **Parser Service** | Normalize raw webhook payloads into a unified `ParsedMessage` struct | Handles Evolution API and Meta Cloud API formats; strips JID suffix |
| **Contact Service** | Upsert contact record, determine human vs bot mode, enrich message with contact context | Owns `contatos` table; sets `atendimento_humano` flag |
| **Intent Service** | Classify message into discrete intents using keyword pattern matching | Returns one of: `saudacao`, `cotacao`, `faq`, `transferir_humano`, `conversa_geral` |
| **FAQ Service** | Return hardcoded/lookup answers for known insurance questions | Keyword pattern matching; falls back to AI if no match |
| **Quote Service** | Detect insurance type and return structured data-collection prompt | Currently static response templates; slot for real pricing engine |
| **AI Service** | Generate contextual responses via OpenAI GPT-4o-mini with system prompt | Builds `messages[]` array with system prompt + conversation history + current message |
| **History Service** | Load last N conversation turns from DB; persist each user/assistant exchange | Chronologically ordered `historico_mensagens` rows |
| **WhatsApp Service** | Send messages back via Evolution API or Meta Cloud API | Provider-agnostic send abstraction; computes humanization delay |
| **DB Client** | Connection pool to PostgreSQL | `pg.Pool` singleton |

---

## Recommended Project Structure

The existing codebase already implements a clean structure. This is what the architecture produces and should maintain:

```
src/
├── config.ts              # Env var loading; typed config object; fails fast on missing required vars
├── index.ts               # Express app bootstrap; route mounting
├── types/
│   └── index.ts           # Shared TypeScript interfaces (ParsedMessage, Contact, Intent, etc.)
├── db/
│   ├── client.ts          # pg.Pool singleton
│   └── migrations/
│       └── 001_initial.sql # DDL: contatos + historico_mensagens tables
├── routes/
│   ├── webhook.ts         # POST /webhook — message pipeline orchestrator
│   └── admin.ts           # POST /admin  — team command handler
└── services/
    ├── parser.service.ts      # Webhook payload → ParsedMessage
    ├── contact.service.ts     # Contact upsert, human mode, message enrichment
    ├── intent.service.ts      # Keyword-based intent classification
    ├── faq.service.ts         # Static FAQ lookup
    ├── quote.service.ts       # Insurance type detection + data-collection prompts
    ├── ai.service.ts          # OpenAI Chat Completions with system prompt
    ├── history.service.ts     # Conversation history load/save
    └── whatsapp.service.ts    # Message send abstraction (Evolution or Meta)
```

### Structure Rationale

- **routes/:** Routes are thin orchestrators only — they sequence service calls, do not contain logic. This is the critical architectural constraint to maintain.
- **services/:** Single-responsibility service files. Each owns one concern. They are independently testable and replaceable.
- **types/index.ts:** Central type registry prevents type drift across services.
- **db/migrations/:** SQL files committed with code keeps schema versioned and reviewable.
- **config.ts:** Single source of truth for all env vars; validates at startup so the app fails loudly rather than silently using defaults.

---

## Architectural Patterns

### Pattern 1: Immediate Ack + Async Processing

**What:** Webhook handler responds HTTP 200 immediately, then runs the message pipeline asynchronously in a `Promise` that is fire-and-forget (`processMessage().catch(...)`).

**When to use:** Always, for all webhook endpoints. WhatsApp (both Evolution API and Meta Cloud API) retries if it does not receive HTTP 200 within ~5-10 seconds. AI calls and DB writes routinely exceed this window.

**Trade-offs:** Error visibility is reduced — errors must be logged explicitly since the response is already sent. Consider adding structured error logging or alerting. The existing codebase already implements this pattern correctly.

**Example:**
```typescript
router.post('/', async (req: Request, res: Response): Promise<void> => {
  // Step 1: Ack immediately
  res.json({ status: 'received' });

  // Step 2: Process async — error logged but not surfaced to caller
  processMessage(req.body).catch((err) => {
    console.error('[Webhook] Error:', err?.message ?? err);
  });
});
```

### Pattern 2: Pipeline with Typed Handoff Objects

**What:** Each processing step consumes a typed struct and returns an enriched typed struct. Steps are composable because the output of step N is the input of step N+1.

**When to use:** Any multi-step message processing flow. Makes the pipeline traceable, testable, and safe to extend.

**Trade-offs:** Adds some verbosity (extra interfaces), but makes the data flow explicit and prevents "magic object" antipatterns.

**Example:**
```typescript
// Raw payload → ParsedMessage → EnrichedMessage → IntentResult → response string
const parsed: ParsedMessage = parseMessage(body);
const enriched: EnrichedMessage = await enrichMessage(parsed, contact);
const withIntent: IntentResult = detectIntent(enriched);
const responseText: string = await buildResponse(withIntent);
```

The type chain (`ParsedMessage → EnrichedMessage → IntentResult`) is defined in `src/types/index.ts`.

### Pattern 3: Human Mode Gate (Bot/Human State Machine)

**What:** Every contact has a boolean `atendimento_humano` flag in the database. The webhook pipeline checks this flag at step 4 (after contact enrichment) and short-circuits all AI processing if the contact is in human mode. Returning to bot mode requires an explicit admin command (`/bot <phone>`).

**When to use:** Any system that supports escalation to human agents. This is the correct pattern for WhatsApp — the bot and the human share the same number, so the gate must be in the application layer.

**Trade-offs:** Binary flag is simple and sufficient for v1. More sophisticated systems use a state enum (`bot`, `waiting_human`, `with_human`, `returning_to_bot`) to track handoff queues. The binary flag means the system cannot distinguish between "user just escalated" and "user has been with human for 3 days."

**Example:**
```typescript
// In webhook pipeline (step 4):
if (enriched.isHumanMode) {
  // Notify team, then stop — no AI involved
  await notifyTeam(enriched);
  return;
}
```

### Pattern 4: Intent-Keyed Response Routing

**What:** A `switch` on the classified intent routes to different response strategies: static FAQ lookup, structured quote prompt, AI generation, or human transfer trigger.

**When to use:** When responses for different intents have fundamentally different generation strategies (static vs dynamic, free-form AI vs structured template).

**Trade-offs:** The switch is easy to extend with new intents. The risk is pattern matching brittle keyword lists — the current implementation is keyword-based, which has known limitations (typos, synonyms, Brazilian Portuguese variations). GPT-based intent classification is more robust but adds latency and cost per message.

**Example:**
```typescript
switch (withIntent.intent) {
  case 'transferir_humano': /* set human mode, notify team */ break;
  case 'cotacao':           return buildQuoteResponse(msg, name);
  case 'faq':               return findFaqAnswer(msg) ?? generateAIResponse(...);
  default:                  return generateAIResponse(msg, contact, history);
}
```

---

## Data Flow

### Primary Message Flow (Bot Mode)

```
WhatsApp User Message
    │
    ▼
Evolution API / Meta Cloud API (receives, forwards)
    │
    │ POST /webhook (JSON payload)
    ▼
Express Webhook Route
    │ res.json({ status: 'received' }) ← HTTP 200 sent immediately
    │
    │ async (background)
    ▼
[1] Parser Service
    │ ParsedMessage { phoneNumber, messageText, senderName, messageType, timestamp }
    ▼
[2] Contact Service — findContact() + upsertContact() (parallel)
    │ reads/writes: contatos table
    ▼
[3] Contact Service — enrichMessage()
    │ EnrichedMessage { ...ParsedMessage, contact, isNewContact, isHumanMode }
    ▼
[4] Human Mode Gate
    │ if isHumanMode → notify team → STOP
    ▼
[5] Intent Service — detectIntent()
    │ IntentResult { ...EnrichedMessage, intent }
    ▼
[6] Response Builder (intent-keyed switch)
    │
    ├─ 'transferir_humano' → Contact Service.setHumanMode(true) + static text + notify team
    ├─ 'cotacao'           → Quote Service.buildQuoteResponse()
    ├─ 'faq'               → FAQ Service.findFaqAnswer()
    │                         └─ if null → AI Service.generateAIResponse()
    └─ 'saudacao'/'conversa_geral'
                           → History Service.loadHistory()
                              → AI Service.generateAIResponse(msg, contact, history)
    │
    │ responseText: string
    ▼
[7] WhatsApp Service — calculateHumanDelay() + sleep()
    │ typing simulation: 1.5s–8s based on response length
    ▼
[8] WhatsApp Service — sendMessage()
    │ Evolution API: POST /message/sendText/{instance}
    │ Meta Cloud API: POST /v20.0/{phone_number_id}/messages
    ▼
[9] History Service — saveExchange()
    │ writes: historico_mensagens (user + assistant rows)
    ▼
    DONE
```

### Human Mode Flow

```
User requests human ("falar com atendente")
    │
    ▼
Intent: 'transferir_humano' detected
    │
    ├─ Contact Service.setHumanMode(phone, true) → contatos.atendimento_humano = true
    ├─ Bot sends farewell message to user
    └─ WhatsApp Service.sendMessage(TEAM_NOTIFICATION_NUMBER, context_summary)
            Summary includes: name, phone, type, last message, /bot <phone> command

Team handles conversation directly in WhatsApp
    │ (all subsequent messages from user are silently forwarded to team via notification)

Team issues admin command: /bot <phone>
    │
    ▼
Admin Route → Contact Service.setHumanMode(phone, false) → contatos.atendimento_humano = false
Bot resumes handling messages from that contact
```

### AI Context Assembly

```
User sends message
    │
    ▼
History Service.loadHistory(phone) → last N turns from historico_mensagens (default: 20)
    │
    ▼
AI Service.generateAIResponse(userMessage, contact, history)
    │
    ▼
OpenAI messages[] array assembled:
    [
      { role: 'system',    content: buildSystemPrompt(contact) },  // persona + rules + contact context
      { role: 'user',      content: history[0].content },          // oldest turn
      { role: 'assistant', content: history[1].content },
      ...                                                           // up to 20 turns
      { role: 'user',      content: userMessage }                  // current message
    ]
    │
    ▼
POST openai.chat.completions.create({ model: 'gpt-4o-mini', messages, temperature: 0.85, max_tokens: 500 })
    │
    ▼
Return completion.choices[0].message.content
```

### Admin Command Flow

```
Team operator sends HTTP POST to /admin
    │ Body: { command: "/bot 5511999999999" }
    ▼
Admin Route → parseAdminCommand()
    │
    ├─ '/bot <phone>'    → Contact Service.setHumanMode(phone, false) → HTTP 200 + status
    └─ '/status <phone>' → DB query on contatos → HTTP 200 + contact row
```

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–50 contacts (current demo target) | Single Express process, synchronous-enough. No queue needed. Immediate ack + async processing is sufficient. Vertical scaling is fine. |
| 50–500 contacts | First bottleneck is OpenAI API rate limits (gpt-4o-mini: 500 RPM tier 1). Add per-contact debouncing: ignore duplicate messages within a 5s window using message ID or timestamp. Add connection pool tuning for PostgreSQL. |
| 500–5k contacts | Add message deduplication via Redis using Evolution API's message ID as the deduplication key. Separate intake (webhook ack) from processing (worker). Bull/BullMQ queue backed by Redis is the standard pattern for Express/TypeScript. |
| 5k+ contacts | Split webhook intake service from processing workers (separate Node processes or containers). Horizontal scale workers independently. DB read replicas for history queries. Consider intent classification offload to keep AI calls only for necessary intents. |

### Scaling Priorities

1. **First bottleneck:** OpenAI API rate limits. gpt-4o-mini is cheaper but not unlimited. At 50+ concurrent brokers sending messages, rate limits will be hit during peak hours. Per-user rate limiting and caching FAQ responses are the first mitigations.
2. **Second bottleneck:** Missing deduplication. Evolution API (Baileys-based) can deliver duplicate `MESSAGES_UPSERT` events. The current codebase has no deduplication guard — at scale this causes double-responses, double AI calls, and duplicate history rows.
3. **Third bottleneck:** PostgreSQL connection pool exhaustion. Each async processMessage() fires DB queries concurrently. Pool size must be configured explicitly (`max` in `pg.Pool`).

---

## Anti-Patterns

### Anti-Pattern 1: Business Logic in Routes

**What people do:** Put intent detection, AI calls, and response building directly inside the route handler function.

**Why it's wrong:** Routes become untestable monoliths. Changing response logic requires understanding the full HTTP stack. Adding a new intent or changing the AI behavior requires editing the route.

**Do this instead:** Routes orchestrate; services execute. The route's `processMessage()` function in the existing codebase correctly calls services and should remain a thin coordinator.

### Anti-Pattern 2: Blocking the Webhook Response

**What people do:** Await the full AI + DB pipeline before sending HTTP 200 back to the webhook caller.

**Why it's wrong:** GPT-4o-mini can take 3–10 seconds. Evolution API and Meta Cloud API both retry after ~5 seconds without a 200. This causes duplicate message processing, double AI calls, and confusing user experience (bot responds twice).

**Do this instead:** `res.json()` immediately. `processMessage().catch()` in the background. This is already implemented correctly.

### Anti-Pattern 3: Storing Full Conversation in a Single Column

**What people do:** Serialize entire chat history as JSON into a single `TEXT` column on the contact record (`ultimo_contexto`).

**Why it's wrong:** Makes history queries inflexible, prevents pruning, causes unbounded column growth, and makes it impossible to query specific turns.

**Do this instead:** The existing schema correctly uses a separate `historico_mensagens` table with indexed `telefone` and `criado_em` columns. The `ultimo_contexto` column on `contatos` exists but should be used for structured summary context (e.g., active quote type), not raw chat history.

### Anti-Pattern 4: Single Intent Classification Strategy Forever

**What people do:** Build keyword-based intent detection and treat it as permanent.

**Why it's wrong:** Keyword matching breaks on: typos, synonyms, multi-intent messages, Brazilian Portuguese variations (vc/você, pra/para, cotação/cotação). As the conversation complexity grows, keyword lists become unmaintainable.

**Do this instead:** The current keyword-based approach is correct for v1 (fast, zero cost, predictable). Build the intent service with a clean interface. When keyword matching becomes a bottleneck, swap the internals to GPT-based classification via a function call — no changes to the pipeline.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Evolution API** | HTTP POST to `{EVOLUTION_API_URL}/message/sendText/{instance}` with `apikey` header | Outbound only — bot sends via this endpoint. Inbound via webhook. Instance name is configured per deployment. Supports Baileys (Whatsapp Web protocol). |
| **Meta Cloud API** | HTTP POST to `graph.facebook.com/v20.0/{phone_number_id}/messages` with Bearer token | Alternative provider. Requires Meta Business verification. Webhook payload format differs from Evolution. |
| **OpenAI API** | `openai` SDK, `chat.completions.create()` | Uses gpt-4o-mini. Key configured via env. Errors should be caught and fallback text returned — current implementation returns hardcoded fallback string. |
| **PostgreSQL** | `pg.Pool` direct SQL (no ORM) | Connection string via `DATABASE_URL`. No migration runner — SQL files applied manually. Consider `node-pg-migrate` or `db-migrate` for automatic migration management. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Route → Services** | Direct TypeScript function calls | Routes import and call service functions synchronously. No DI container. Acceptable for this scale. |
| **Services → DB** | Imported `db` pool singleton | All services import `db` from `../db/client`. Centralized pool means connection limit applies globally. |
| **Services → Services** | Direct import | `webhook.ts` imports all services directly. Circular dependencies between services must be avoided — none currently exist. |
| **Webhook → Admin** | Shared `Contact Service` | Both routes call `setHumanMode()` from Contact Service. This is correct — shared domain logic belongs in the service. |

---

## Build Order Implications

The component dependencies define the only valid build order:

```
1. Types (src/types/index.ts)
       ↓ (all services depend on types)
2. DB Client + Schema (src/db/client.ts + migrations/)
       ↓ (Contact and History services depend on DB)
3. Config (src/config.ts)
       ↓ (all services depend on config)
4. Parser Service (no dependencies except types)
       ↓
5. Contact Service (depends on DB, types)
       ↓
6. Intent Service (depends on types only)
   History Service (depends on DB, config, types)
   FAQ Service (no dependencies)
   Quote Service (no dependencies)
       ↓
7. AI Service (depends on config, openai SDK)
   WhatsApp Service (depends on config, axios)
       ↓
8. Routes (depend on all services)
       ↓
9. Express App / index.ts (mounts routes)
```

**Phase structure implication:** Infrastructure-first (types, DB, config), then stateless pure services (parser, intent, FAQ, quote), then stateful/external services (contact, history, AI, WhatsApp), then orchestrators (routes, app). This order matches how dependencies flow and means each layer can be tested before the next is built.

---

## Sources

- [Building a Scalable Webhook Architecture for Custom WhatsApp Solutions](https://www.chatarchitect.com/news/building-a-scalable-webhook-architecture-for-custom-whatsapp-solutions) — MEDIUM confidence (WebSearch, verified with direct fetch)
- [Evolution API Deep Wiki — Architecture and Webhook Format](https://deepwiki.com/EvolutionAPI/evolution-api) — HIGH confidence (official source)
- [Evolution API Webhooks Documentation](https://doc.evolution-api.com/v2/en/configuration/webhooks) — HIGH confidence (official docs)
- [How to Build and Deploy a Production-Ready WhatsApp Bot with Evolution API](https://www.freecodecamp.org/news/how-to-build-and-deploy-a-production-ready-whatsapp-bot/) — MEDIUM confidence (verified architectural claims match Evolution API docs)
- [Guide to WhatsApp Webhooks — Hookdeck](https://hookdeck.com/webhooks/platforms/guide-to-whatsapp-webhooks-features-and-best-practices) — HIGH confidence (detailed technical, verifiable claims on Meta API behavior)
- [Chatbot System Design — systemdesignhandbook.com](https://www.systemdesignhandbook.com/guides/chatbot-system-design-interview/) — MEDIUM confidence (general patterns, aligns with implementation)
- [State Machines for WhatsApp Messaging Bots — Vonage](https://developer.vonage.com/en/blog/state-machines-for-messaging-bots) — HIGH confidence (official developer docs from Vonage)
- [WhatsApp-Based Ticket Escalation Workflows — ChatArchitect](https://www.chatarchitect.com/news/whatsapp-based-ticket-escalation-workflows-from-bot-to-human) — MEDIUM confidence (patterns consistent with implementation)
- Existing codebase at `/Users/felipescupino/issy-assistant/src/` — HIGH confidence (ground truth; all component descriptions verified against actual code)

---

*Architecture research for: WhatsApp AI chatbot for insurance brokers (Issy Assistant)*
*Researched: 2026-02-24*
