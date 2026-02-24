# Phase 2: Core Pipeline - Research

**Researched:** 2026-02-24
**Domain:** WhatsApp webhook pipeline — contact persistence, intent detection, conversation history, OpenAI Chat Completions, Z-API typing indicator
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CORE-01 | Bot recebe mensagens do WhatsApp via webhook e responde no mesmo canal | Phase 1 infrastructure already handles receive. Phase 2 wires the response path end-to-end. |
| CORE-02 | Bot identifica o corretor pelo telefone e captura nome na primeira interação | `prisma.contact.upsert()` on phone + Z-API `senderName` in payload; first-message detection via `contact.createdAt === contact.updatedAt`. |
| CORE-03 | Bot classifica intenção do corretor (Q&A, cotação, handoff humano, conversa geral) | Keyword-based intent classifier in a dedicated service; clean interface so internals can swap to GPT later. |
| CORE-04 | Bot mantém histórico de conversa por contato para contexto nas respostas | Load last N messages from `mensagens` table, feed as `messages[]` array to OpenAI; persist each exchange after response. |
| CORE-05 | Bot responde "não sei" e oferece escalação humana quando não tem a resposta | System prompt instruction + explicit fallback branch in intent router when confidence is `unknown`. |
| UX-01 | Bot aguarda 1-3s com indicador de digitação antes de responder | Z-API `send-text` native `delayTyping` parameter (1-15s); compute random value in `[HUMAN_DELAY_MIN_MS, HUMAN_DELAY_MAX_MS]` range. |
</phase_requirements>

---

## Summary

Phase 2 takes the skeleton webhook handler from Phase 1 — which currently parses and logs — and wires it into a full end-to-end response pipeline. Six services must be created or extended: contact service, conversation service, intent service, AI service, history service, and an updated WhatsApp service. The webhook route remains the thin orchestrator from Phase 1 and is extended only enough to call these services in sequence.

The entire standard stack is already installed. `openai` v4.104.0 is in `node_modules`. Prisma 7 client is generated at `src/generated/prisma`. The only new code is TypeScript service files and the updated webhook handler. No new `npm install` commands are needed for Phase 2.

The single most important architectural decision confirmed by research: Z-API's `send-text` endpoint accepts a native `delayTyping` parameter (integer 1-15 seconds). This means UX-01 (typing indicator) is implemented by passing `delayTyping` in the send-text request body — there is no separate typing indicator API call and no need for a timer or `setTimeout`. The typing indicator and the message delivery are a single atomic Z-API operation.

**Primary recommendation:** Build services in dependency order — contact → conversation → history → intent → AI → send — with each service in its own file. The webhook handler calls them sequentially. Keeping each service to a single responsibility makes the pipeline debuggable one layer at a time.

---

## Standard Stack

### Core

All libraries already installed. No new dependencies required for Phase 2.

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------------------|---------|--------------|
| openai | 4.104.0 | Chat Completions API | Official SDK; `client.chat.completions.create()` is the stable, non-streaming path |
| @prisma/client | 7.4.1 | Contact, Conversation, Message upsert/query | Generated types from Phase 1 schema; `upsert`, `findMany`, `create`, `update` all confirmed in generated client |
| axios | 1.7.7 | Z-API HTTP calls (already used in whatsapp.ts) | Already in use for `send-text`; extend with `delayTyping` parameter |
| dotenv | 16.4.5 | Config already loaded | Used in `src/config.ts` |
| express | 4.21.1 | Webhook route already exists | Extend `processMessage()` in `src/routes/webhook.ts` |

### Supporting

No new dependencies. Everything below is already imported or available.

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript | 5.6.3 | Type-safe service interfaces | Already configured; define `ParsedMessage`, `Intent`, `ConversationContext` types |
| ts-node-dev | 2.0.0 | Dev hot reload | Already in `npm run dev` script |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Keyword intent classifier | GPT-based intent classification | GPT is more accurate but adds latency + cost. Keyword is instant and free. Phase 2 uses keyword; clean interface allows swap in Phase 5 |
| Single `processMessage()` function | Class-based services | Classes add ceremony. For Phase 2 scale, plain functions in modules are simpler and equally testable |
| `delayTyping` Z-API param | Manual `setTimeout` + separate presence call | Z-API has no standalone "send presence" endpoint. `delayTyping` is the correct and only native solution |

**Installation:** None required. All dependencies are already installed.

---

## Architecture Patterns

### Recommended Project Structure

The Phase 1 structure is extended. Only add files under `src/services/`:

```
src/
├── config.ts               # Already exists — add HISTORY_LIMIT reference
├── lib/
│   └── prisma.ts           # Already exists
├── types/
│   ├── zapi.ts             # Already exists
│   └── index.ts            # Already exists — add Intent, ConversationContext types
├── routes/
│   └── webhook.ts          # Extend processMessage() to call pipeline services
└── services/
    ├── whatsapp.ts         # Already exists — extend sendTextMessage() with delayTyping
    ├── contact.ts          # NEW — upsertContact(), isFirstMessage()
    ├── conversation.ts     # NEW — getOrCreateConversation(), isHumanMode()
    ├── history.ts          # NEW — loadHistory(), saveMessage()
    ├── intent.ts           # NEW — classifyIntent()
    └── ai.ts               # NEW — generateResponse()
```

### Pattern 1: Immediate ACK + Async Processing (already implemented)

**What:** Webhook route sends HTTP 200 immediately, then runs pipeline in fire-and-forget async.
**When to use:** Always for webhook handlers — downstream provider (Z-API) gives up if response takes >5s.
**Example:**

```typescript
// src/routes/webhook.ts — existing pattern, extend processMessage() only
router.post('/', (req, res) => {
  res.json({ status: 'received' });            // immediate 200
  processMessage(req.body).catch(console.error); // fire-and-forget
});
```

### Pattern 2: Contact Upsert — First-Message Detection

**What:** Use `prisma.contact.upsert()` with phone as unique key. The contact's `senderName` from the Z-API payload is used as name source. Detect first message by comparing `createdAt` and `updatedAt` on the returned record: when they are equal (within 1 second), the record was just created.

**Source:** Confirmed from Prisma 7 generated client (`Contact.upsertOne` in class.ts strings) and schema.prisma `@unique @map("telefone")`.

```typescript
// src/services/contact.ts
import { prisma } from '../lib/prisma';

export async function upsertContact(phone: string, senderName: string) {
  return prisma.contact.upsert({
    where: { phone },
    create: { phone, name: senderName },
    update: { name: senderName },   // always sync name in case broker renames
  });
}

export function isFirstMessage(contact: { createdAt: Date; updatedAt: Date }): boolean {
  // createdAt and updatedAt are within 1s of each other on a newly created record
  return Math.abs(contact.createdAt.getTime() - contact.updatedAt.getTime()) < 1000;
}
```

### Pattern 3: Conversation Upsert — Human Mode Gate

**What:** Use `prisma.conversation.upsert()` keyed on phone. Check `humanMode` flag before calling OpenAI — this is the atomic gate that prevents bot/human double-response.

```typescript
// src/services/conversation.ts
import { prisma } from '../lib/prisma';

export async function getOrCreateConversation(phone: string) {
  return prisma.conversation.upsert({
    where: { phone },
    create: { phone },
    update: {},    // no-op update; just ensure record exists
  });
}

// Called BEFORE any GPT call — never optimistically after
export function isHumanMode(conversation: { humanMode: boolean }): boolean {
  return conversation.humanMode;
}
```

### Pattern 4: History Load + Save

**What:** Load last N messages ordered by `createdAt ASC` for LLM context; save each user+assistant turn after response is generated. `HISTORY_LIMIT` from config (default 20) caps the context window.

```typescript
// src/services/history.ts
import { prisma } from '../lib/prisma';
import { config } from '../config';

export async function loadHistory(phone: string) {
  const messages = await prisma.message.findMany({
    where: { phone },
    orderBy: { createdAt: 'desc' },
    take: config.app.historyLimit,
  });
  return messages.reverse(); // oldest-first for LLM context
}

export async function saveMessage(phone: string, role: 'user' | 'assistant', content: string) {
  return prisma.message.create({
    data: { phone, role, content },
  });
}
```

### Pattern 5: Keyword Intent Classifier

**What:** Switch on lowercased message text against keyword sets. Returns one of 4 intent strings. Interface is a single function `classifyIntent(text: string): Intent`. The internals are swappable.

**Why keyword-first:** Zero latency, zero cost, no external dependency. Sufficient for Phase 2 demo intents. GPT-based classification is a Phase 5 upgrade.

```typescript
// src/services/intent.ts
export type Intent = 'greeting' | 'qa' | 'quote' | 'handoff' | 'unknown';

const HANDOFF_KEYWORDS = ['/humano', 'falar com humano', 'atendente', 'pessoa real', 'quero falar com'];
const QUOTE_KEYWORDS = ['cotar', 'cotação', 'cotacao', 'seguro', 'preço', 'valor'];
const GREETING_KEYWORDS = ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'hey', 'hello'];

export function classifyIntent(text: string): Intent {
  const lower = text.toLowerCase().trim();
  if (HANDOFF_KEYWORDS.some(k => lower.includes(k))) return 'handoff';
  if (QUOTE_KEYWORDS.some(k => lower.includes(k))) return 'quote';
  if (GREETING_KEYWORDS.some(k => lower.startsWith(k))) return 'greeting';
  if (lower.length > 3) return 'qa';  // any non-trivial text is a Q&A attempt
  return 'unknown';
}
```

### Pattern 6: OpenAI Chat Completions — Installed SDK v4.104.0

**What:** `client.chat.completions.create()` with `messages[]` array containing system + history + current user message. Non-streaming only for Phase 2 (simpler error handling).

**Source:** Confirmed from `node_modules/openai/resources/chat/completions/completions.d.ts`. `ChatCompletionMessageParam` supports `role: 'system' | 'user' | 'assistant'`. `ChatCompletionCreateParamsNonStreaming` accepts `model`, `messages`, `temperature`, `max_tokens`.

```typescript
// src/services/ai.ts
import OpenAI from 'openai';
import { config } from '../config';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

export async function generateResponse(
  contactName: string,
  historyMessages: Array<{ role: string; content: string }>,
  currentMessage: string,
  intent: string,
): Promise<string> {
  const systemPrompt = buildSystemPrompt(contactName, intent);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...historyMessages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: currentMessage },
  ];

  const completion = await openai.chat.completions.create({
    model: config.openai.model,
    messages,
    temperature: config.openai.temperature,
    max_tokens: config.openai.maxTokens,
  });

  return completion.choices[0]?.message?.content ?? getFallbackMessage();
}

function buildSystemPrompt(contactName: string, intent: string): string {
  return `Você é a Issy, assistente virtual da assessoria de seguros. Você ajuda corretores de seguros a responder dúvidas sobre produtos, coberturas e aceitação.

Corretor atual: ${contactName}
Intenção detectada: ${intent}

Regras de comportamento:
- Responda SEMPRE em português brasileiro, tom profissional e conciso
- NUNCA invente valores de R$, coberturas específicas ou regras de aceitação — diga que não tem certeza e ofereça escalar para um humano
- Se não souber responder, diga "Não tenho essa informação no momento. Posso transferir para um especialista da assessoria — deseja que eu faça isso?"
- Foque em: produtos de seguro (saúde, auto, vida, residencial, empresarial), coberturas, exclusões, aceitação
- Recuse educadamente qualquer assunto não relacionado a seguros`;
}

function getFallbackMessage(): string {
  return 'Desculpe, ocorreu um problema ao processar sua mensagem. Por favor, tente novamente em alguns instantes.';
}
```

### Pattern 7: Z-API Send with Native Typing Indicator

**What:** Extend the existing `sendTextMessage()` to accept `delayTyping` (integer seconds). This replaces the manual `HUMAN_DELAY_MIN_MS`/`HUMAN_DELAY_MAX_MS` timer for the typing indicator (the timer for the message delivery delay is separate from the typing indicator display).

**Critical finding:** Z-API `send-text` endpoint accepts two optional parameters:
- `delayTyping` (1-15s) — shows "typing..." to recipient BEFORE the message is delivered
- `delayMessage` (1-15s) — delays the actual message send (after typing indicator)

**Source:** Confirmed from `developer.z-api.io/en/message/send-message-text` (HTTP 200 response, URL pattern matches existing `src/services/whatsapp.ts`).

```typescript
// src/services/whatsapp.ts — extend existing function
import axios from 'axios';
import { config } from '../config';

export async function sendTextMessage(
  phone: string,
  message: string,
  delayTypingSeconds = 2,
): Promise<void> {
  const { instanceId, instanceToken, clientToken } = config.zapi;

  await axios.post(
    `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/send-text`,
    {
      phone,
      message,
      delayTyping: delayTypingSeconds,  // shows typing indicator before delivery
    },
    {
      headers: { 'Client-Token': clientToken },
      timeout: 15_000,  // increase from 10s to accommodate delayTyping
    },
  );
}

// Helper: compute randomized delay in seconds from config ms values
export function computeDelaySeconds(): number {
  const minSec = Math.floor(config.app.humanDelayMinMs / 1000);
  const maxSec = Math.ceil(config.app.humanDelayMaxMs / 1000);
  return Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec;
}
```

### Pattern 8: Webhook Pipeline Orchestration

**What:** The updated `processMessage()` function calls all services in sequence. Each step is a single `await`. Error in any step is caught at the top level and logged.

```typescript
// src/routes/webhook.ts — updated processMessage()
async function processMessage(body: ZApiWebhookPayload): Promise<void> {
  const parsed = parseZApiPayload(body);
  if (!parsed || !parsed.text) return;  // ignore non-text messages for now

  const { phone, text, senderName } = parsed;

  // 1. Persist contact (upsert by phone)
  const contact = await upsertContact(phone, senderName);
  const firstMessage = isFirstMessage(contact);

  // 2. Check human mode — abort before any GPT call if human agent is active
  const conversation = await getOrCreateConversation(phone);
  if (isHumanMode(conversation)) return;

  // 3. Detect intent
  const intent = classifyIntent(text);

  // 4. Load history
  const history = await loadHistory(phone);

  // 5. Save incoming user message
  await saveMessage(phone, 'user', text);

  // 6. Generate AI response
  const nameToUse = firstMessage ? senderName : contact.name;
  const responseText = await generateResponse(nameToUse, history, text, intent);

  // 7. Save assistant response
  await saveMessage(phone, 'assistant', responseText);

  // 8. Send response with typing indicator
  const delaySeconds = computeDelaySeconds();
  await sendTextMessage(phone, responseText, delaySeconds);
}
```

### Anti-Patterns to Avoid

- **Human mode check after GPT call:** Check `humanMode` as step 2, before loading history or calling OpenAI. Checking after is a race condition — human and bot can respond simultaneously.
- **Saving assistant message before sending:** Save AFTER the `sendTextMessage()` call succeeds. If send fails, we don't want a phantom assistant message in history causing the LLM to believe it already responded.
- **In-memory conversation state:** Never store current step, intent, or history in process memory. Every request must be treated as a cold start — all state from PostgreSQL.
- **Blocking the webhook response:** The `res.json({ status: 'received' })` must fire before the async pipeline begins. Already correct in Phase 1 code; do not refactor this.
- **Hard-coding the system prompt as a string literal in config:** Keep the system prompt as a function that accepts `contactName` and `intent` — it will need to grow significantly in Phase 3 and must be testable independently.
- **Passing `null` text to OpenAI:** `parsed.text` can be null for image/audio messages. Guard with `if (!parsed.text) return;` at the top of `processMessage`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Typing indicator | Manual `setTimeout` + fake presence call | Z-API `delayTyping` param in `send-text` | Z-API has no standalone presence-send endpoint; native param is atomic with message delivery |
| Contact creation/deduplication | Manual INSERT + SELECT guard | `prisma.contact.upsert()` | Prisma upsert is atomic — no race condition when two messages arrive simultaneously from same phone |
| Conversation history truncation | Manual slice + token counting | `findMany({ take: N, orderBy: desc })` + `reverse()` | Prisma handles the LIMIT in SQL; no need to load all messages and slice in application code |
| OpenAI client instantiation | `axios.post()` to OpenAI API | `new OpenAI({ apiKey })` from `openai` package | SDK handles retries, error types, TypeScript types, and auth header |

**Key insight:** Z-API's `delayTyping` parameter is a native feature of the send-text call — there is no separate "send presence" API. Attempting to build this independently (separate HTTP call to set presence) would require an endpoint that does not exist in Z-API.

---

## Common Pitfalls

### Pitfall 1: axios timeout shorter than delayTyping

**What goes wrong:** `sendTextMessage()` currently sets `timeout: 10_000` (10 seconds). If `delayTyping` is set to 2 seconds and the OpenAI call took 8 seconds, the Z-API call will timeout before the typing indicator completes.
**Why it happens:** `delayTyping` is a server-side hold before message delivery. The HTTP response from Z-API is not returned until after the delay completes.
**How to avoid:** Set axios timeout to `(delayTyping + 10) * 1000` or a flat 20_000ms. The current 10_000ms is insufficient when delayTyping >= 2.
**Warning signs:** `ETIMEDOUT` errors from Z-API send calls in logs.

### Pitfall 2: First-message detection via createdAt/updatedAt comparison

**What goes wrong:** Using `contact.createdAt === contact.updatedAt` with `===` operator compares object references, not timestamps. In TypeScript, two Date objects with the same value are not `===` equal.
**Why it happens:** JavaScript Date comparison gotcha.
**How to avoid:** Use `Math.abs(contact.createdAt.getTime() - contact.updatedAt.getTime()) < 1000` (within 1 second = freshly created).
**Warning signs:** Bot never says it's a first message, or always says it is.

### Pitfall 3: History loaded before user message saved

**What goes wrong:** If history is loaded AFTER the current user message is saved, the user's current message appears in history AND as the final `{ role: 'user', content: text }` in the OpenAI messages array — doubling the message.
**Why it happens:** Order of operations error.
**How to avoid:** Always load history BEFORE saving the current user message. Save user message as step 5, load history as step 4 (see pipeline pattern above).
**Warning signs:** LLM acknowledges the message twice in its response, or conversation context drifts.

### Pitfall 4: OpenAI messages array role type mismatch

**What goes wrong:** Messages loaded from DB have `role: string` (Prisma infers string). Passing `role: string` to `ChatCompletionMessageParam` fails TypeScript typecheck because the union type expects `'user' | 'assistant' | 'system'`.
**Why it happens:** Prisma schema stores `role` as plain `String`, not an enum.
**How to avoid:** Cast with `role: m.role as 'user' | 'assistant'` when mapping DB messages to OpenAI format, after validating the value.
**Warning signs:** TypeScript compile error `Type 'string' is not assignable to type '"user" | "assistant" | "system"'`.

### Pitfall 5: Empty message text crashes intent classifier

**What goes wrong:** Broker sends an image with no caption. `parsed.text` is null. `classifyIntent(null)` throws.
**Why it happens:** `parseZApiPayload` returns `text: null` for non-text messages.
**How to avoid:** Guard at the top of `processMessage`: `if (!parsed.text) return;`. Phase 2 handles only text messages; image/audio support is deferred.
**Warning signs:** Uncaught TypeError in webhook error logs.

### Pitfall 6: System prompt leaks internal routing information

**What goes wrong:** Including `intent: 'qa'` or `intent: 'unknown'` literally in the system prompt teaches the broker that the bot internally routes by keyword. Leaks implementation details and can be gamed.
**Why it happens:** Debugging convenience becomes production behavior.
**How to avoid:** Use intent internally for routing decisions only. Do not pass raw intent string to the system prompt in production. Optionally use it to adjust tone/focus instructions in the prompt, but not expose the label.
**Warning signs:** Brokers start typing specific keywords to trigger routes.

---

## Code Examples

Verified patterns from official/installed sources:

### OpenAI Chat Completions — Non-Streaming

```typescript
// Source: node_modules/openai/resources/chat/completions/completions.d.ts
// ChatCompletionCreateParamsNonStreaming
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello' },
  ],
  temperature: 0.85,
  max_tokens: 500,
});

const text = completion.choices[0]?.message?.content ?? '';
```

### Prisma 7 Contact Upsert

```typescript
// Source: src/generated/prisma/internal/class.ts (Contact.upsertOne confirmed)
// Schema: prisma/schema.prisma — Contact model with @unique phone
const contact = await prisma.contact.upsert({
  where: { phone: '5511999999999' },
  create: { phone: '5511999999999', name: 'João Silva' },
  update: { name: 'João Silva' },
});
```

### Prisma 7 History Query — Last N Messages

```typescript
// Source: src/generated/prisma/internal/class.ts (Message.findMany confirmed)
const messages = await prisma.message.findMany({
  where: { phone: '5511999999999' },
  orderBy: { createdAt: 'desc' },
  take: 20,
});
const history = messages.reverse(); // chronological for LLM
```

### Z-API Send Text with Typing Indicator

```typescript
// Source: developer.z-api.io/en/message/send-message-text — confirmed delayTyping param
// Existing service: src/services/whatsapp.ts
await axios.post(
  `https://api.z-api.io/instances/${INSTANCE_ID}/token/${TOKEN}/send-text`,
  {
    phone: '5511999999999',
    message: 'Olá! Como posso ajudá-lo?',
    delayTyping: 2,   // shows typing indicator for 2 seconds before delivery
  },
  {
    headers: { 'Client-Token': CLIENT_TOKEN },
    timeout: 20_000,  // must exceed delayTyping duration
  },
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual typing indicator (separate API call) | Z-API `delayTyping` param in send-text body | Available in Z-API since initial release | No separate presence endpoint needed; UX-01 is a single-line parameter change |
| OpenAI SDK v3 `createChatCompletion()` | SDK v4 `client.chat.completions.create()` | SDK v4 (2023) | Different import, client instantiation, and method path |
| `function_call` for intent routing | Keyword classifier + `tool_calls` for structured output | 2024 | `function_call` is deprecated in v4 SDK; `tool_calls` is current; but Phase 2 uses keyword classifier, not LLM routing |

**Deprecated/outdated:**
- `openai.createChatCompletion()`: Removed in SDK v4. Use `openai.chat.completions.create()`.
- `function_call` in OpenAI messages: Deprecated. Use `tool_calls` if LLM routing is needed (not needed in Phase 2).

---

## Open Questions

1. **Contact name: use Z-API senderName directly or ask for confirmation?**
   - What we know: Z-API `senderName` is the WhatsApp display name (can be a nickname, emoji, or phone number if unnamed). It is available in the parsed payload as `parsed.senderName`.
   - What's unclear: Whether the assessoria wants to use the raw WhatsApp name or ask the broker to confirm their name in the first interaction.
   - Recommendation: Phase 2 uses `senderName` from Z-API directly — no name-confirmation prompt. This avoids an extra round-trip on first message and keeps the pipeline simple. If the assessoria reports name quality issues, add confirmation prompt in Phase 5.

2. **What should happen when intent is `quote`?**
   - What we know: Phase 2 routes `quote` intent to the AI service, which will respond with a generic "cotação" acknowledgment. The actual quote flow is Phase 4.
   - What's unclear: Whether to tell the broker that the quote flow is not available yet, or let the AI respond generically.
   - Recommendation: For Phase 2, treat `quote` intent same as `qa` — let OpenAI handle it with the system prompt in scope. The system prompt will correctly respond with something like "Posso ajudar com cotações! Para iniciar, preciso de algumas informações..." This naturally flows into Phase 4's structured flow.

3. **How long should `delayTyping` be — fixed or proportional to message length?**
   - What we know: Config has `HUMAN_DELAY_MIN_MS=1500` and `HUMAN_DELAY_MAX_MS=3000`. Z-API accepts integer seconds 1-15.
   - What's unclear: Whether randomized-per-message or proportional-to-response-length feels more natural.
   - Recommendation: Phase 2 uses randomized value between 1-3 seconds (derived from config). Proportional delay (1 second per 100 characters) can be added in Phase 5 UX polish.

---

## Sources

### Primary (HIGH confidence)

- `src/generated/prisma/internal/class.ts` — Confirmed operations: `Contact.upsertOne`, `Contact.findFirst`, `Conversation.upsertOne`, `Message.findMany`, `Message.createOne` in generated client string table
- `src/generated/prisma/models/Contact.ts` — Confirmed Contact model fields: `phone`, `name`, `createdAt`, `updatedAt`
- `node_modules/openai/resources/chat/completions/completions.d.ts` — Confirmed `ChatCompletionCreateParamsNonStreaming`, `ChatCompletionMessageParam`, `role: 'system' | 'user' | 'assistant'`, `temperature`, `max_tokens`
- `node_modules/openai/package.json` — Installed version: 4.104.0
- `developer.z-api.io/en/message/send-message-text` — Confirmed `delayTyping` (1-15s) and `delayMessage` parameters in send-text request body
- `prisma/schema.prisma` — Ground truth schema: Contact, Conversation, Message models with field names
- `src/routes/webhook.ts`, `src/services/whatsapp.ts`, `src/config.ts` — Phase 1 code patterns to extend

### Secondary (MEDIUM confidence)

- `developer.z-api.io/en/webhooks/on-chat-presence` — Confirmed that Z-API has NO standalone "send presence" endpoint; `on-chat-presence` is receive-only webhook; `delayTyping` in send-text is the only way to show typing indicator
- OpenAI GPT-4.1 Prompting Guide (developers.openai.com/cookbook) — System prompt structure: high-level rules, category subsections, explicit fallback instructions; applies equally to GPT-4o-mini

### Tertiary (LOW confidence)

- WebSearch: keyword-based intent classification pattern — standard practice confirmed across multiple sources but no single authoritative reference; implementation is straightforward enough that low confidence does not affect the plan

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions read directly from installed node_modules
- Architecture: HIGH — patterns derived from Phase 1 code + confirmed Prisma 7 client API + confirmed Z-API endpoint params
- Pitfalls: HIGH for pitfalls 1-5 (derived from code inspection and API docs); MEDIUM for pitfall 6 (system prompt leakage — common knowledge, no authoritative source needed)

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (stable libraries — 30 day window)
