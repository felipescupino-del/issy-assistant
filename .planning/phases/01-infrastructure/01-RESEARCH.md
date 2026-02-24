# Phase 1: Infrastructure - Research

**Researched:** 2026-02-24
**Domain:** Express/TypeScript server setup, Prisma ORM with Supabase PostgreSQL, Z-API webhook integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **WhatsApp Provider:** Z-API as the sole WhatsApp provider (NOT Evolution API or Meta Cloud API)
- **No multi-provider abstraction** — Z-API only, simplify the code
- **Database:** PostgreSQL hosted on Supabase (free tier, cloud-based)
- **ORM:** Prisma with declarative schema and automatic migrations
- **Naming convention:** Code in English, database tables/columns in Portuguese
- **Message history:** Store ALL messages in database, send only last N to LLM at query time
- **Supabase connection:** Use standard connection string — no Supabase SDK
- **Runtime:** No Docker — database is cloud-hosted, app runs locally with ts-node-dev
- **Linting:** No ESLint/Prettier for now — deferred to later phase
- **Codebase:** Clean rebuild from scratch (do not evolve existing files)

### Claude's Discretion

- Folder organization pattern (layered vs feature-based)
- Tunnel choice for dev (ngrok vs cloudflared)
- Rate limiting strategy for WhatsApp messages
- Quote state storage format (JSONB vs dedicated columns)
- Error handling patterns

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

## Summary

This phase bootstraps the application from scratch. The existing codebase uses raw `pg` pool, Evolution API, and plain SQL migrations — all of which must be replaced. The clean rebuild replaces `pg` with Prisma ORM, wires up Z-API for webhook receipt and message sending, configures Supabase PostgreSQL via standard connection string, and stands up an Express server with a `/health` endpoint.

The biggest new surface area is Z-API: its webhook payload differs structurally from Evolution API (different field paths for phone, text, sender name), and its send-message endpoint requires instance ID + token in the URL rather than an instance name + API key pattern. The research confirms that Z-API's webhook payload has a documented structure with predictable field names, and the send-text endpoint is straightforward REST.

Prisma with Supabase requires two connection strings in `.env` when using connection pooling: `DATABASE_URL` (session pooler, port 5432) for runtime queries and `DIRECT_URL` (direct connection) for `prisma migrate`. For a local dev server that is not serverless, using the session pooler URL for both is acceptable, but setting `directUrl` to the direct connection avoids known migration issues.

**Primary recommendation:** Replace all legacy code (pg pool, Evolution API, raw SQL schema) with Prisma + Z-API from scratch. Do not patch or extend existing files — delete and rewrite.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | ^4.21.1 | HTTP server + webhook receiver | Already in project, battle-tested |
| prisma | ^6.x (dev dep) | Schema management + migrations | Locked decision; declarative, type-safe, auto-migrates |
| @prisma/client | ^6.x | Type-safe DB queries at runtime | Generated from schema; replaces raw `pg` pool |
| dotenv | ^16.4.5 | Env var loading | Already in project |
| axios | ^1.7.7 | Z-API HTTP calls (send messages) | Already in project |
| ts-node-dev | ^2.0.0 | Dev server with hot reload | Already in project |
| typescript | ^5.6.3 | Type safety | Already in project |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ngrok or cloudflared | latest CLI | Expose local port for Z-API webhook | Dev only — needed to receive webhooks from Z-API |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prisma | raw `pg` Pool | pg is already in project but raw SQL is not type-safe and requires hand-written migrations — Prisma is locked decision |
| cloudflared | ngrok | cloudflared is free with no time limits and stable custom subdomains; ngrok free tier resets URL on restart. Recommend cloudflared. |
| axios | node-fetch or got | axios already installed, no reason to add another HTTP client |

**Installation (new dependencies only):**
```bash
npm install prisma @prisma/client --save-dev
npm install @prisma/client
# Note: @prisma/client is both a dev dep (for types) and a production dep (for runtime)
```

Correct split:
```bash
npm install --save-dev prisma
npm install @prisma/client
```

**Remove legacy dependency (no longer needed):**
```bash
npm uninstall pg @types/pg
```

---

## Architecture Patterns

### Recommended Project Structure

This is a layered architecture (the right choice for a single-service bot with clear separation of concerns):

```
src/
├── index.ts              # Express app entry: boots server, registers routes
├── config.ts             # All env vars validated at startup
├── lib/
│   └── prisma.ts         # PrismaClient singleton (one instance across app)
├── routes/
│   └── webhook.ts        # POST /whatsapp-webhook — acknowledge immediately, dispatch
├── services/
│   └── whatsapp.ts       # Z-API send-text call (replaces whatsapp.service.ts)
└── types/
    └── zapi.ts           # TypeScript interfaces for Z-API webhook payload shape

prisma/
├── schema.prisma         # Declarative schema (English model names, Portuguese @@map)
└── migrations/           # Auto-generated by prisma migrate dev
```

The existing src layout (`routes/`, `services/`, `types/`) is already correct. The key change is:
- `src/db/client.ts` (pg Pool) → `src/lib/prisma.ts` (PrismaClient singleton)
- `src/db/migrations/*.sql` → `prisma/migrations/` (auto-generated)

### Pattern 1: PrismaClient Singleton

**What:** One shared PrismaClient instance for the entire application lifetime.
**When to use:** Always — creating a new PrismaClient per request leaks connections.

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

*Note: The global singleton guard is mainly needed for Next.js hot reload. For ts-node-dev, a plain `export const prisma = new PrismaClient()` also works, but the guard is harmless and idiomatic.*

### Pattern 2: Webhook Acknowledge-Then-Process

**What:** Return HTTP 200 immediately, do heavy processing asynchronously.
**When to use:** Always for WhatsApp webhooks — Z-API expects fast acknowledgment.

```typescript
// src/routes/webhook.ts
router.post('/', (req, res) => {
  res.json({ status: 'received' }); // acknowledge immediately
  processMessage(req.body).catch((err) =>
    console.error('[webhook] processing error:', err.message),
  );
});
```

This pattern already exists in the current codebase and is correct. Keep it.

### Pattern 3: Z-API Send Text

**What:** POST to Z-API's REST endpoint with instance + token in URL path.

```typescript
// src/services/whatsapp.ts
// Source: https://developer.z-api.io/en/message/send-message-text
import axios from 'axios';

export async function sendTextMessage(phone: string, message: string): Promise<void> {
  const { instanceId, instanceToken, clientToken } = config.zapi;
  await axios.post(
    `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/send-text`,
    { phone, message },
    {
      headers: { 'Client-Token': clientToken },
      timeout: 10_000,
    },
  );
}
```

### Pattern 4: Z-API Webhook Payload Parsing

**What:** Extract phone, text, and sender name from incoming Z-API webhook POST.
**When to use:** At the start of every webhook handler.

```typescript
// src/types/zapi.ts
export interface ZApiWebhookPayload {
  instanceId: string;
  messageId: string;
  phone: string;           // sender phone number (e.g., "5511999999999")
  fromMe: boolean;         // true if bot sent this — always filter out
  senderName: string;      // display name of sender
  momment: number;         // unix timestamp (ms) — note: typo in Z-API docs
  status: string;          // "RECEIVED" | "SENT" | "READ" etc.
  chatName: string;
  isGroup: boolean;
  type: string;            // "ReceivedCallback"
  text?: {
    message: string;       // the actual text content
  };
  image?: { caption?: string; imageUrl: string };
  audio?: { audioUrl: string; ptt: boolean };
  // ... other media types
}

// Parse function
export function parseZApiPayload(body: ZApiWebhookPayload) {
  return {
    phone: body.phone,
    text: body.text?.message ?? null,
    senderName: body.senderName ?? body.chatName,
    messageId: body.messageId,
    fromMe: body.fromMe,
    isGroup: body.isGroup,
    timestamp: new Date(body.momment),
  };
}
```

**Critical:** Always filter `fromMe === true` to prevent the bot from processing its own outbound messages.

### Pattern 5: Prisma Schema with Portuguese DB Names

**What:** English model names in Prisma code mapped to Portuguese table/column names via `@@map` and `@map`.

```prisma
// prisma/schema.prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")  // required for prisma migrate with Supabase pooler
}

generator client {
  provider = "prisma-client-js"
}

model Contact {
  id         Int       @id @default(autoincrement())
  phone      String    @unique @map("telefone")
  name       String    @default("Desconhecido") @map("nome")
  createdAt  DateTime  @default(now()) @map("criado_em")
  updatedAt  DateTime  @updatedAt @map("atualizado_em")
  messages   Message[]

  @@map("contatos")
}

model Conversation {
  id          Int      @id @default(autoincrement())
  phone       String   @unique @map("telefone")
  humanMode   Boolean  @default(false) @map("modo_humano")
  state       Json?    @map("estado")   // quote flow state, JSONB
  updatedAt   DateTime @updatedAt @map("atualizado_em")

  @@map("conversas")
}

model Message {
  id          Int      @id @default(autoincrement())
  phone       String   @map("telefone")
  role        String   @map("papel")    // "user" | "assistant"
  content     String   @map("conteudo")
  createdAt   DateTime @default(now()) @map("criado_em")
  contact     Contact  @relation(fields: [phone], references: [phone])

  @@index([phone], name: "idx_messages_phone")
  @@index([createdAt], name: "idx_messages_created_at")
  @@map("mensagens")
}
```

*Note: The success criteria in the roadmap mentions `contacts, conversations, messages, conversation_state` — the schema above maps to those four tables (`contatos`, `conversas`, `mensagens`, and `estado` is JSONB within `conversas` rather than a separate table, which is the right call per Claude's discretion).*

### Anti-Patterns to Avoid

- **Creating a new PrismaClient per request:** Exhausts the connection pool. Use the singleton.
- **Using raw `pg` Pool alongside Prisma:** Creates two connection pools; pick one. The pg package can be uninstalled.
- **Not filtering `fromMe`:** Bot processes its own sent messages, causing infinite loops.
- **Blocking the webhook HTTP response while processing:** Z-API will retry, creating duplicate processing. Acknowledge first.
- **Storing migrations outside `prisma/migrations/`:** Prisma's migration engine tracks state in `_prisma_migrations` table; hand-written SQL alongside breaks this.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DB schema migrations | Custom SQL migration runner | `prisma migrate dev` | Tracks applied migrations in `_prisma_migrations`, handles ordering, down migrations, checksums |
| Type-safe DB queries | Custom query builders | Prisma Client | Auto-generated from schema; compile-time type safety |
| Connection pooling | Custom PgPool wrapper | PrismaClient default pool | Prisma manages pool size, idle timeouts, error reconnection |
| Env var validation | String checks everywhere | `config.ts` with startup-time assertion | Fail fast at boot, not mid-request |
| WhatsApp sending abstraction | Multi-provider factory | Single Z-API function | Lock in Z-API only, zero abstraction needed |

**Key insight:** The old codebase hand-rolled SQL migrations and a pg Pool. Replacing both with Prisma removes ~200 lines of plumbing.

---

## Common Pitfalls

### Pitfall 1: Missing DIRECT_URL for Supabase Migrations

**What goes wrong:** `prisma migrate dev` fails or hangs when `DATABASE_URL` points to Supabase's connection pooler (Supavisor).
**Why it happens:** The pooler does not support the prepared statements and advisory locks that Prisma's migration engine uses.
**How to avoid:** Set `directUrl = env("DIRECT_URL")` in `schema.prisma` datasource, where `DIRECT_URL` is the direct database URL (bypasses pooler). The direct URL is on port 5432 of the `db.PROJECT_REF.supabase.co` host, not the pooler host.
**Warning signs:** `prisma migrate dev` hangs or throws connection timeout errors.

```
# .env
DATABASE_URL="postgres://prisma.PROJECT_REF:PASSWORD@REGION.pooler.supabase.com:5432/postgres"
DIRECT_URL="postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres"
```

### Pitfall 2: Z-API fromMe Loop

**What goes wrong:** Bot receives its own sent messages via webhook, processes them as if a user sent them, sends another reply, which triggers another webhook — infinite loop.
**Why it happens:** Z-API sends a `ReceivedCallback` for messages sent by the connected number too (the "notify from me" webhook type). Even the standard receive webhook may deliver these.
**How to avoid:** Always check `body.fromMe === true` at the very start of `processMessage()` and return immediately.
**Warning signs:** Bot replies to itself, message count in DB grows explosively.

### Pitfall 3: Z-API Webhook URL Reset on ngrok Restart

**What goes wrong:** ngrok assigns a new random URL every restart (free tier). Z-API is configured with the old URL. Webhooks stop arriving.
**Why it happens:** ngrok free tier does not support persistent custom subdomains.
**How to avoid:** Use cloudflared with a named tunnel (persistent URL) OR update Z-API webhook URL via API after each ngrok restart. Recommend cloudflared.
**Warning signs:** Webhooks stop arriving after restarting the tunnel.

### Pitfall 4: Z-API Phone Number Format

**What goes wrong:** Sending to wrong/unreachable number format.
**Why it happens:** Z-API expects `DDI+DDD+NUMBER` format with no formatting — e.g., `5511999999999` (Brazil country code 55 + DDD + number). No `+`, no dashes, no spaces.
**How to avoid:** Normalize phone numbers to E.164 digits-only format before storing and before calling `send-text`.
**Warning signs:** Z-API returns 4xx or message is undelivered.

### Pitfall 5: Prisma Client Not Regenerated After Schema Change

**What goes wrong:** TypeScript errors or runtime `Unknown field` errors after schema change.
**Why it happens:** The generated client in `node_modules/@prisma/client` is stale.
**How to avoid:** `prisma migrate dev` automatically runs `prisma generate`. After any manual schema edit without running a migration, run `npx prisma generate` explicitly.
**Warning signs:** TypeScript IDE errors on model fields that exist in schema.

### Pitfall 6: The `momment` Typo in Z-API

**What goes wrong:** Trying to access `body.moment` or `body.timestamp` for the message timestamp.
**Why it happens:** Z-API's payload field is spelled `momment` (double-m), which is a typo in their API that has persisted.
**How to avoid:** Use `body.momment` in the TypeScript interface (document the typo with a comment).

---

## Code Examples

Verified patterns from official sources:

### Supabase + Prisma datasource block

```prisma
// Source: https://supabase.com/docs/guides/database/prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

### .env file for Supabase

```bash
# Connection pooler (session mode, port 5432) — used for app queries
DATABASE_URL="postgres://prisma.[PROJECT-REF]:[PASSWORD]@[REGION].pooler.supabase.com:5432/postgres"

# Direct connection — used only by prisma migrate
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
```

### Z-API send-text call

```typescript
// Source: https://developer.z-api.io/en/message/send-message-text
await axios.post(
  `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_INSTANCE_TOKEN}/send-text`,
  { phone: '5511999999999', message: 'Hello' },
  { headers: { 'Client-Token': ZAPI_CLIENT_TOKEN } },
);
```

### Prisma migration workflow

```bash
# First time: initialize Prisma
npx prisma init

# After editing schema.prisma:
npx prisma migrate dev --name init

# Verify migration status (success criteria from roadmap):
npx prisma migrate status

# Regenerate client only (no migration):
npx prisma generate
```

### Config for Z-API (what config.ts needs)

```typescript
// Z-API credentials
zapi: {
  instanceId:    required('ZAPI_INSTANCE_ID'),
  instanceToken: required('ZAPI_INSTANCE_TOKEN'),
  clientToken:   required('ZAPI_CLIENT_TOKEN'),  // Account security token
},
```

### Z-API webhook payload TypeScript interface (verified field names)

```typescript
// Source: https://developer.z-api.io/en/webhooks/on-message-received
interface ZApiTextWebhook {
  instanceId: string;
  messageId: string;
  phone: string;
  fromMe: boolean;
  senderName: string;
  chatName: string;
  momment: number;     // ← typo intentional — Z-API field name
  status: string;
  isGroup: boolean;
  type: string;
  text?: { message: string };
}
```

### cloudflared quick setup (recommended tunnel)

```bash
# Install (macOS)
brew install cloudflare/cloudflare/cloudflared

# One-time login
cloudflared tunnel login

# Dev: quick tunnel (temporary URL, no account needed)
cloudflared tunnel --url http://localhost:3000

# OR: named tunnel (persistent URL, needs Cloudflare account)
cloudflared tunnel create issy-dev
cloudflared tunnel run issy-dev
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw `pg` Pool + hand-written SQL | Prisma ORM with declarative schema | Prisma GA ~2021, mature since 2023 | Type-safe queries, auto-generated migrations, no SQL boilerplate |
| `prisma-client-js` provider (Prisma v5) | `prisma-client` provider (Prisma v6+) | Prisma v6, late 2024 | ESM-first client; v6 is current stable — use `prisma-client-js` for v5 compatibility if needed |
| Evolution API / raw meta API | Z-API (locked decision) | — | Simpler integration for Brazil-based WhatsApp automation |
| ngrok (free) | cloudflared (free, persistent) | Cloudflare Tunnel free tier ~2022 | No URL resets on restart, more stable for dev |

**Deprecated/outdated:**
- `pg` package: Still valid but replaced by Prisma Client in this project.
- Evolution API config in `config.ts`: All `evolutionApiUrl`, `evolutionApiKey`, `evolutionInstance` fields can be removed.
- Meta API config: `metaAccessToken`, `metaPhoneNumberId` can be removed.
- `WHATSAPP_PROVIDER` env var: No longer needed — Z-API is the only provider.
- `src/db/migrations/001_initial.sql`: Replaced by `prisma/migrations/` (auto-generated).
- `src/db/client.ts` (pg Pool): Replaced by `src/lib/prisma.ts` (PrismaClient).

---

## Open Questions

1. **Supabase connection string format for free tier project**
   - What we know: Session pooler URL format is `postgres://prisma.[PROJECT-REF]:PASSWORD@REGION.pooler.supabase.com:5432/postgres`; direct URL is `postgresql://postgres:PASSWORD@db.[PROJECT-REF].supabase.co:5432/postgres`
   - What's unclear: The exact region and project ref are only known once the user creates their Supabase project. The planner should include a "create Supabase project" setup task.
   - Recommendation: Include a prerequisite task: user creates Supabase project → copies both connection strings to `.env`.

2. **Z-API dev vs prod phone separation**
   - What we know: User confirmed they still need to acquire phone numbers for dev/prod. Z-API gives a separate instance per phone.
   - What's unclear: Whether user has dev phone number yet.
   - Recommendation: Flag as setup prerequisite in the plan — create a `ZAPI_INSTANCE_ID`, `ZAPI_INSTANCE_TOKEN`, `ZAPI_CLIENT_TOKEN` env var set per environment (dev and prod are separate Z-API instances).

3. **conversation_state table vs JSONB column**
   - What we know: Success criteria mentions a `conversation_state` table exists. Claude's discretion allows JSONB vs structured table.
   - What's unclear: Whether the schema should have a separate `conversation_state` table or embed state as JSONB in `conversas`.
   - Recommendation: Use a `state` JSONB column on the `conversas` table for Phase 1 (simpler schema). If the roadmap specifically expects a separate `conversation_state` table by name, create `estados_conversa` table with `@@map`. Check roadmap success criteria phrasing.

4. **Z-API Client-Token scope**
   - What we know: `Client-Token` is the "Account Security Token" used as a header on send-text calls. It is distinct from the Instance Token in the URL.
   - What's unclear: Whether the `Client-Token` header is also sent by Z-API on incoming webhooks for webhook validation.
   - Recommendation: The Z-API docs did not confirm webhook-side token validation. For Phase 1, skip webhook signature validation — just receive and process. Add webhook security in a later phase.

---

## Sources

### Primary (HIGH confidence)

- https://developer.z-api.io/en/webhooks/on-message-received — Z-API webhook payload field names (verified by fetching docs directly)
- https://developer.z-api.io/en/message/send-message-text — Z-API send-text endpoint URL, headers, body (verified by fetching docs directly)
- https://developer.z-api.io/en/security/client-token — Z-API Client-Token header (fetched from official docs)
- https://supabase.com/docs/guides/database/prisma — Supabase + Prisma connection string format (official Supabase docs)
- https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/custom-model-and-field-names — `@map` / `@@map` for Portuguese names (official Prisma docs)
- https://www.prisma.io/docs/orm/prisma-migrate/getting-started — `prisma migrate dev` workflow (official Prisma docs)

### Secondary (MEDIUM confidence)

- https://dev.to/aryan_shourie/secure-tunneling-explained-ngrok-vs-cloudflared-mcl — ngrok vs cloudflared comparison (community article, multiple consistent sources)
- https://www.npmjs.com/package/prisma — Prisma v6/v7 version numbers (npmjs registry)

### Tertiary (LOW confidence)

- WebSearch results about Prisma v7 generator provider change (`prisma-client` vs `prisma-client-js`) — mentioned in multiple search results but not directly verified against official docs. Use `prisma-client-js` (v5/v6 stable) to avoid v7 breaking changes until explicitly upgrading.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are well-documented, versions confirmed via npm
- Architecture: HIGH — patterns verified against Prisma official docs and Z-API official docs
- Z-API payload structure: HIGH — fetched directly from developer.z-api.io documentation pages
- Supabase/Prisma connection: HIGH — verified via official Supabase docs
- Pitfalls: MEDIUM — fromMe loop and phone format verified from Z-API docs; ngrok URL reset from community sources consistent with known ngrok behavior

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (30 days — Prisma and Z-API APIs are stable; Z-API may update webhook format)
