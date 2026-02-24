# Stack Research

**Domain:** WhatsApp AI Chatbot for Insurance Brokers
**Researched:** 2026-02-24
**Confidence:** MEDIUM-HIGH (core stack verified via npm registry; some integration-specific claims from WebSearch)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | 5.9.3 | Language | Pre-decided. Strong typing eliminates a whole class of runtime bugs in message-parsing logic; strict mode catches null/undefined on incoming webhook payloads before they blow up prod. |
| Node.js | 22 LTS | Runtime | Pre-decided. LTS stability for long-running webhook server; native async/await maps cleanly to I/O-heavy chatbot workloads (DB, OpenAI calls, WhatsApp sends). |
| Express | 5.2.1 | HTTP server / webhook receiver | Pre-decided. Minimal overhead, massive ecosystem, well-understood middleware model for rate limiting, auth, and error handling. Fastify is faster but Express 5.x is sufficient at 50-broker scale and has better plugin compatibility. |
| Prisma ORM | 7.4.1 | Database access layer | Best automated-migration story in the TypeScript ORM space: `prisma migrate dev` generates + applies SQL; schema is the single source of truth. TypeScript types are auto-generated — no manual type-sync. Prisma 6/7 uses a TypeScript-based engine (faster cold start, smaller Docker images than Prisma 5). |
| PostgreSQL | 16 | Primary data store | Pre-decided. JSONB columns store conversation message arrays without a separate schema change every time the OpenAI message format evolves. Full SQL for analytics (conversation counts, intent distribution). Proven reliability at chatbot scale. |
| OpenAI SDK (`openai`) | 6.23.0 | LLM integration | Official SDK; Chat Completions API is fully supported and simpler than the new Responses API for the conversational loop pattern this project needs. Zod-backed structured outputs work with `strict: true` function calling. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | 4.3.6 | Schema validation + OpenAI structured output schemas | Use for validating all incoming webhook payloads and for defining function-calling tool schemas passed to OpenAI. Prevents bad data from propagating through the system. |
| `pino` | 10.3.1 | Structured JSON logging | Use instead of `console.log`. JSON output makes logs queryable in production (Logtail, Datadog, etc.). pino is the fastest logger in the Node.js ecosystem — important for low-latency webhook response. |
| `helmet` | 8.1.0 | HTTP security headers | Use on all Express routes; sets sensible defaults (CSP, X-Content-Type, etc.) with one line. |
| `cors` | 2.8.6 | CORS middleware | Use if any browser-side tooling (future admin UI) needs to hit the API. |
| `express-rate-limit` | 8.2.1 | Rate limiting on webhook endpoint | Prevents runaway Evolution API retries or malicious floods from exhausting OpenAI quota. |
| `dotenv` | 17.3.1 | Environment variable loading | Dev-only: load `.env` file. In prod use real environment injection (Docker, Fly.io, Railway). |
| `bullmq` | 5.70.1 | Message processing queue | Use to dequeue incoming WhatsApp messages before processing. Decouples the webhook (must respond 200 within ~5s) from the OpenAI call (can take 3-15s). Prevents duplicate processing on Evolution API retries. Requires Redis. |
| `ioredis` | 5.9.3 | Redis client (for BullMQ) | Required when using BullMQ. Also doubles as fast in-memory cache for conversation state (active_session flag, pending human-handoff, typing lock). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `tsx` 4.21.0 | TypeScript execution in dev (`tsx watch`) | Replaces `ts-node` for local development; faster cold start, native ESM support, no separate `tsconfig` setup. Use `tsx watch src/index.ts` as the dev script. |
| `vitest` 4.0.18 | Test runner | Modern, zero-config TypeScript support, HMR watch mode, Jest-compatible API. 30–70% faster than Jest for TypeScript projects. The standard choice for new TypeScript projects in 2025. |
| `supertest` 7.2.2 | HTTP integration testing | Tests Express routes at the HTTP level without starting a real server. Pair with Vitest for webhook handler integration tests. |
| `@faker-js/faker` 10.3.0 | Test data generation | Generate realistic WhatsApp message payloads in tests. |
| ESLint + Prettier | Linting + formatting | Use `@typescript-eslint/eslint-plugin`. Prevent common async/await mistakes and enforce consistent code style across message handlers. |
| `ngrok` or `smee.io` | Local webhook tunneling | Required in development to receive Evolution API webhooks on localhost. ngrok for simplicity; smee.io for free persistent URLs. |

---

## Conversation State Model

The chatbot needs to track per-contact state between messages. Use PostgreSQL as the source of truth with Redis as a fast read-through cache.

**PostgreSQL tables (schema-first with Prisma):**

```
contacts          — phone number, broker name, created_at
conversations     — contact_id, started_at, ended_at, channel (whatsapp)
messages          — conversation_id, role (user/assistant/system), content (TEXT), created_at
conversation_state — conversation_id, state (IDLE | COLLECTING_QUOTE | AWAITING_HUMAN), metadata (JSONB), updated_at
```

**Why not store all state in Redis?**
Redis is fast but ephemeral. If Redis restarts, active quote flows are lost. PostgreSQL is durable. Use Redis only for hot-path reads (current state lookup per phone number) — write-through to PostgreSQL on every state change.

**Why not a dedicated conversation management library (Botpress, Typebot, BuilderBot)?**
Those frameworks take over routing and make custom AI integrations harder. This project needs GPT-4o-mini in the decision loop, not as a plugin. Custom TypeScript state machine gives full control.

---

## WhatsApp Integration

### Evolution API (Primary)

Evolution API is self-hosted, open-source, and wraps the unofficial WhatsApp Web protocol (Baileys under the hood). The project already has prior experience with it.

**Key integration points:**
- Webhook event: `MESSAGES_UPSERT` — fires when a new message is received. Payload contains `from`, `body`, `messageType`, `messageTimestamp`.
- Send message: POST to `https://{evolution-host}/message/sendText/{instance}` with JSON body.
- Typing indicator: POST to `https://{evolution-host}/chat/updatePresence/{instance}` with `{"number": "...", "options": {"presence": "composing"}}`. Lasts up to 25s or until message is sent.
- Configure webhook URL on instance creation or via PUT to `https://{evolution-host}/webhook/set/{instance}`.

**Humanization pattern:**
1. Receive message → push to BullMQ queue → respond 200 to Evolution immediately.
2. Worker dequeues → sets "composing" presence on WhatsApp.
3. Worker calls OpenAI (3-15s).
4. Worker sends response → clears presence.

This prevents the "instant reply feels robotic" problem and avoids webhook timeout (Evolution retries if 200 is not received quickly).

### Meta Cloud API (Fallback)

Use `@kapso/whatsapp-cloud-api` or the official `WhatsApp-Nodejs-SDK` (TypeScript, official Meta). Webhook events follow the same MESSAGES_UPSERT semantics but with different payload shape. Abstract the provider behind a `IWhatsAppProvider` interface so swapping is one implementation change.

---

## AI Integration Pattern

Use OpenAI Chat Completions (not the new Responses API) with the `openai` SDK v6.

**Pattern: System prompt + rolling history window**

```typescript
const messages: ChatCompletionMessageParam[] = [
  { role: 'system', content: INSURANCE_BROKER_SYSTEM_PROMPT },
  // Last N messages from PostgreSQL (rolling window of 20 messages)
  ...recentMessages.map(m => ({ role: m.role, content: m.content })),
  { role: 'user', content: incomingText }
];

const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages,
  tools: [intentDetectionTool, quoteDataCollectionTool, humanHandoffTool],
  tool_choice: 'auto'
});
```

**Function calling with `strict: true`** forces GPT to return structured intent detection (QUOTE_REQUEST | PRODUCT_QUESTION | HUMAN_HANDOFF | GENERAL) rather than free text, enabling deterministic routing to conversation states.

**Token budget management:** GPT-4o-mini has a 128K context window, but keep the rolling window to 20-30 messages (~3-4K tokens) to control cost at 50+ brokers sending multiple messages per day.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Prisma 7.x | Drizzle ORM 0.45 | If you want zero code-generation, pure TypeScript schemas, and faster cold starts for serverless. Drizzle is the better choice if deploying to serverless edge functions. For a long-running Express server, Prisma's migration tooling is worth the overhead. |
| Prisma 7.x | TypeORM | Never: TypeORM is effectively in maintenance mode in 2025, has active CVEs, and its decorator-based API is incompatible with modern TypeScript strict settings. |
| BullMQ + Redis | Process message synchronously in webhook handler | Only viable for ultra-low-latency scenarios where OpenAI responds in < 3s reliably. In practice, GPT-4o-mini can take 5-15s under load. BullMQ decouples receive from process and handles retries for free. |
| Vitest | Jest | If migrating an existing large Jest codebase. For greenfield TypeScript, Vitest is faster, simpler to configure, and has native ESM/TypeScript support. No Babel required. |
| BullMQ + Redis | Simple `setTimeout` delay for humanization | setTimeout is not retry-safe and doesn't survive process restarts. BullMQ jobs are durable. |
| Express | Fastify | If you need higher HTTP throughput (> 1,000 req/s). At 50-broker demo scale, Express 5.x is sufficient. Fastify has a higher learning curve and less middleware ecosystem coverage. |
| `openai` SDK direct | Vercel AI SDK (`ai` package) | If building a Next.js frontend with streaming UI. The Vercel AI SDK adds abstraction layers that complicate function calling and structured output patterns needed here. Use direct OpenAI SDK for backend-only chatbots. |
| `openai` SDK direct | LangChain | If you need RAG, vector search, or chained multi-model pipelines. LangChain is overkill for single-model Q&A + guided flows. It adds ~300KB bundle overhead and introduces breaking changes frequently. For v1, the OpenAI SDK is sufficient. |
| Pino | Winston | Winston 3.x is stable but slower and produces verbose output by default. Pino is 5-10x faster and outputs structured JSON natively. Both are fine; Pino is the better greenfield choice. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Baileys (directly) | Baileys is the unofficial WhatsApp Web reverse-engineering library. Using it directly violates Meta ToS, can result in phone number bans, and has an unstable API surface. Evolution API wraps Baileys but adds abstraction and active maintenance. | Evolution API (wraps Baileys with stability layer) or Meta Cloud API (official) |
| TypeORM | In active maintenance-mode since 2023. Multiple unpatched CVEs. Decorator-based API conflicts with TypeScript strict mode. The ecosystem has moved to Prisma and Drizzle. | Prisma 7.x |
| LangChain (for this scope) | Heavy, frequent breaking changes, abstracts away OpenAI function calling in ways that complicate structured output integration. Overkill for a single-model assistant. Consider for v2 if RAG over insurance documents is added. | Direct `openai` SDK |
| `node-schedule` / `cron` | Not relevant here, but tempting for "send follow-up after X minutes." Cron-based solutions don't survive restarts and can't be monitored. | BullMQ delayed jobs |
| Storing conversation history only in Redis | Redis is in-memory and can lose data. Conversation history is a business asset (audit trail, analytics). | PostgreSQL as source of truth; Redis as read cache |
| `ts-node` for production | ts-node compiles on-demand and is slow for production startup. It also has esm compatibility issues. | Compile to JS with `tsc` for production; use `tsx` for dev only |

---

## Stack Patterns by Variant

**If using Evolution API (primary):**
- Configure webhook on instance creation: `POST /instance/create` with `{ webhook: { url, enabled: true, events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'] } }`
- Parse `data.key.remoteJid` to extract phone number, strip `@s.whatsapp.net` suffix
- Respond 200 immediately; process message async via BullMQ worker
- Use Evolution's `updatePresence` (composing) for typing indicator before sending

**If using Meta Cloud API (fallback):**
- Use official `WhatsApp/WhatsApp-Nodejs-SDK` or `whatsapp-api-js`
- Webhook verification requires returning `hub.challenge` on GET request with `hub.verify_token`
- Message event is `messages` array in `entry[0].changes[0].value`
- Abstract behind `IWhatsAppProvider` interface to avoid spreading provider-specific code

**If demo only (no real broker phones):**
- ngrok tunnel for local development
- Hardcode a test phone number in `.env`; send test messages from your own WhatsApp
- Evolution API supports sending to yourself for integration testing

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `prisma@7.4.1` | `@prisma/client@7.4.1` | Always keep prisma and @prisma/client at identical versions. Mismatches cause cryptic runtime errors. |
| `openai@6.23.x` | Node.js 18+ | Node 22 LTS is fully supported. |
| `bullmq@5.x` | `ioredis@5.x` | BullMQ v5 requires Redis 7.2+. Check Redis version if self-hosting. |
| `vitest@4.x` | TypeScript 5.x | Vitest 4.x requires TypeScript 5.0+ and Node 18+. |
| `express@5.x` | `@types/express@5.x` | Express 5 is a major version; some older middleware may not be compatible. Check `cors`, `helmet`, `express-rate-limit` — all are compatible with Express 5. |
| `tsx@4.x` | TypeScript 5.x | tsx uses esbuild internally; TypeScript 5.x features (const type params, etc.) are fully supported. |

---

## Installation

```bash
# Core runtime
npm install express @prisma/client openai zod pino bullmq ioredis dotenv helmet cors express-rate-limit

# Prisma CLI (generates client, runs migrations)
npm install -D prisma

# TypeScript + build tooling
npm install -D typescript tsx @types/node @types/express @types/cors

# Testing
npm install -D vitest supertest @types/supertest @faker-js/faker

# Initialize Prisma
npx prisma init --datasource-provider postgresql
```

---

## Sources

- npm registry (direct query via `npm info`) — versions for `express`, `typescript`, `vitest`, `zod`, `prisma`, `openai`, `bullmq`, `ioredis`, `pino`, `helmet`, `cors`, `express-rate-limit`, `supertest`, `tsx`, `@faker-js/faker` — **HIGH confidence**
- [Evolution API v2 Webhook Documentation](https://doc.evolution-api.com/v2/en/configuration/webhooks) — webhook events and configuration — **MEDIUM confidence** (page returned 403 on direct fetch; findings from WebSearch corroborating docs)
- [Evolution API GitHub](https://github.com/EvolutionAPI/evolution-api) — open-source status, active maintenance confirmed — **HIGH confidence**
- [OpenAI Node.js SDK GitHub](https://github.com/openai/openai-node) — Chat Completions API, function calling, TypeScript types — **HIGH confidence**
- [OpenAI Structured Outputs Guide](https://developers.openai.com/api/docs/guides/structured-outputs/) — `strict: true` in function calling — **HIGH confidence**
- [Prisma ORM Documentation](https://www.prisma.io/docs) — Prisma 7.x TypeScript engine, migration tooling — **HIGH confidence**
- [WhatsApp Nodejs SDK (Official Meta)](https://github.com/WhatsApp/WhatsApp-Nodejs-SDK) — Meta Cloud API TypeScript support — **MEDIUM confidence** (GitHub page, not direct doc verification)
- [BrightCoding: Evolution API Platform](https://www.blog.brightcoding.dev/2026/02/17/evolution-api-the-revolutionary-whatsapp-integration-platform) — Evolution API event streaming options (WebSocket, RabbitMQ, Kafka, SQS) — **LOW confidence** (single blog post)
- [BetterStack: Drizzle vs Prisma](https://betterstack.com/community/guides/scaling-nodejs/drizzle-vs-prisma/) — ORM comparison rationale — **MEDIUM confidence**
- [LogRocket: Vitest adoption guide](https://blog.logrocket.com/vitest-adoption-guide/) — Vitest 4.x migration and benefits — **MEDIUM confidence**
- [Courier: WhatsApp Typing Indicators](https://www.courier.com/blog/how-to-use-whatsapp-typing-indicators-on-twilio-public-beta-guide) — typing indicator best practices — **MEDIUM confidence**

---

*Stack research for: Issy Assistant — WhatsApp AI Chatbot for Insurance Brokers*
*Researched: 2026-02-24*
