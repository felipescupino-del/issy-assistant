# Phase 3: Insurance Q&A and Handoff — Research

**Researched:** 2026-02-24
**Domain:** Insurance knowledge injection into system prompts + WhatsApp-native human handoff state machine
**Confidence:** HIGH — all claims derived from existing codebase (ground truth), CONTEXT.md locked decisions, and TypeScript/OpenAI SDK documentation

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Knowledge Layer (KNOW-01 to KNOW-04)**
- Approach: Arquivo de facts embeddado — criar um arquivo .ts com fatos de seguros organizados por produto
- How it works: Fatos são injetados no system prompt dinamicamente baseado no tipo de produto detectado na mensagem
- No RAG, no embeddings — simples e suficiente para demo
- Existing note from STATE.md: Known facts layer content needs assessoria input to prevent hallucination

**Handoff (HAND-01, HAND-02)**
- Notification method: Mensagem no mesmo chat do WhatsApp
- Bot sends a structured briefing (resumo da conversa, intent, dados coletados) no próprio chat quando o corretor pede handoff
- O humano da assessoria lê o briefing ali mesmo quando assumir a conversa
- After handoff: bot sets humanMode=true, stops responding until admin sends /bot

**Admin Commands (HAND-03)**
- Allowlist method: Variável de ambiente ADMIN_PHONES no .env (comma-separated phone numbers)
- Commands:
  - `/humano` — any user can request handoff (not admin-only)
  - `/bot` — admin-only: return control to bot (sets humanMode=false)
  - `/status` — admin-only: show basic info (current mode, broker name, last message)
- Non-admin numbers sending /bot or /status receive no special response (treated as normal messages)

**Admin /status Content**
- Basic info only: Modo atual (bot/humano), nome do corretor, última mensagem
- Sufficient for demo — no detailed analytics needed

### Claude's Discretion

Nothing explicitly marked — all decisions above are locked. Discretion applies to:
- Internal structure of the `insuranceFacts.ts` file (product grouping, data shape)
- Exact product-detection logic for dynamic fact injection
- Exact wording/format of the structured handoff briefing message
- Exact wording of the bot confirmation message sent to the broker on handoff
- How admin commands are parsed (in-band via webhook vs. separate route)
- How `setHumanMode` is exposed (extend `conversation.ts` vs new service)

### Deferred Ideas (OUT OF SCOPE)

- RAG / embeddings over insurance PDFs (v2 — KNOW-05)
- Real pricing tables from assessoria (v2 — KNOW-06)
- Separate admin HTTP endpoint (use in-band WhatsApp commands instead)
- Detailed analytics in /status (basic info only)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| KNOW-01 | Bot responde dúvidas sobre produtos de seguros (saúde, auto, vida, residencial, empresarial) | Embedded facts file per product type, injected into system prompt based on product detection in the message |
| KNOW-02 | Bot responde sobre coberturas, exclusões e condições de cada produto | Facts file includes coverage/exclusion/conditions section per product; facts are hedged ("typically includes…") to avoid hallucination |
| KNOW-03 | Bot responde sobre regras de aceitação (elegibilidade do cliente) | Facts file includes acceptance rules section per product (age range, health conditions, etc.) — explicitly hedged |
| KNOW-04 | Bot usa tom profissional e conciso adequado para corretor de seguros | System prompt persona already enforces this; facts injection reinforces product focus |
| HAND-01 | Bot transfere conversa para humano no mesmo WhatsApp quando solicitado | `setHumanMode(phone, true)` via Prisma update; handoff intent already detected by classifyIntent('handoff') |
| HAND-02 | Bot envia pacote de contexto estruturado (resumo sintetizado) ao transferir | Structured briefing message sent to the same chat before setting humanMode=true; generated from conversation history |
| HAND-03 | Equipe admin controla bot via comandos (/bot, /status, /humano) | In-band commands parsed from webhook; ADMIN_PHONES allowlist already in config.ts (config.admin.phoneNumbers) |
</phase_requirements>

---

## Summary

Phase 3 extends the existing Phase 2 pipeline in two orthogonal directions. The knowledge layer (KNOW-01 to KNOW-04) is a pure system prompt enhancement — a TypeScript file containing curated insurance facts, organized by product, is injected into the prompt at runtime when a product keyword is detected in the broker's message. The handoff layer (HAND-01 to HAND-03) adds a state transition to the pipeline: the bot detects `/humano` intent (already working in `intent.ts`), generates a structured context briefing, sends it to the same WhatsApp thread, then sets `humanMode=true` in the database, silencing the bot. Admin commands (`/bot`, `/status`) are parsed in-band from the webhook, validated against the `ADMIN_PHONES` allowlist already in `config.ts`.

The existing codebase provides nearly all the scaffolding needed. Phase 2 already: detects `handoff` intent, checks `humanMode` in the pipeline gate, has `setHumanMode` accessible via Prisma, loads conversation history, and has `ADMIN_PHONES` in `config.ts`. Phase 3 adds three new service functions (`setHumanMode`, `buildHandoffBriefing`, `handleAdminCommand`), one new data file (`insuranceFacts.ts`), and two new functions in the existing `ai.ts` (`getProductContext`, updated `buildSystemPrompt`).

The highest-risk item is the content of the facts file itself — hallucination prevention depends on facts being accurate and properly hedged. Since "assessoria input to prevent hallucination" is a noted blocker in STATE.md, the planner should create a placeholder facts file with clearly labeled `[ASSESSORIA: fill in real values]` markers that can be completed before the demo, rather than blocking code completion.

**Primary recommendation:** Build the facts layer and handoff flow as two separate plans. The facts layer is a pure content + system prompt enhancement with zero risk. The handoff flow touches `conversation.ts`, `webhook.ts`, and requires careful ordering (briefing send → humanMode=true, never reversed).

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openai` SDK | ^4.67.0 (installed) | Generates responses via Chat Completions — facts injected via system prompt | Already installed, using `chat.completions.create()` — no new library needed |
| Prisma | ^7.4.1 (installed) | `setHumanMode` via `prisma.conversation.update()` | Already the ORM; humanMode field already in schema |
| `axios` | ^1.7.7 (installed) | `sendTextMessage` for briefing + confirmation messages | Already installed in `whatsapp.ts` |

### Supporting

No new libraries required for Phase 3. All functionality is achievable with the existing installed stack:
- Product detection: TypeScript string matching on the message (same pattern as `intent.ts`)
- Facts storage: A plain `.ts` file exporting a typed object (`Record<ProductType, InsuranceFacts>`)
- Handoff briefing: A template string function using conversation history and contact name
- Admin commands: String parsing of the incoming `text` field in the webhook pipeline

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain `.ts` facts file | JSONB in DB | DB approach allows admin UI editing later; but over-engineering for demo — content will change rarely and a deploy is acceptable |
| Plain `.ts` facts file | `.json` file | JSON has no TypeScript type safety; `.ts` gets autocomplete and type checking at authoring time |
| In-band command parsing (webhook) | Separate HTTP admin route | Separate route requires the admin to make HTTP requests, not WhatsApp messages — CONTEXT.md confirms in-band WhatsApp commands |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure Changes

```
src/
├── config.ts              # Already has config.admin.phoneNumbers — no change needed
├── types/
│   └── index.ts           # Add ProductType, InsuranceFacts, HandoffBriefing types
├── data/
│   └── insuranceFacts.ts  # NEW: Facts organized by product type (saúde, auto, vida, etc.)
├── services/
│   ├── ai.ts              # UPDATE: buildSystemPrompt() injects product facts; add getProductContext()
│   ├── conversation.ts    # UPDATE: add setHumanMode() function
│   ├── handoff.ts         # NEW: buildHandoffBriefing(), executeHandoff()
│   └── admin.ts           # NEW: isAdminPhone(), parseAdminCommand(), handleAdminCommand()
└── routes/
    └── webhook.ts         # UPDATE: add admin command branch before human mode gate
```

### Pattern 1: Dynamic Facts Injection into System Prompt

**What:** Detect which insurance product the broker's message is about, then inject the relevant facts section into the system prompt before calling OpenAI. Facts are NOT sent as a separate user/system turn — they are part of the system prompt context block.

**When to use:** Every Q&A request where a product is identified. When no product is detected, the system prompt gets no injection (the existing prompt is sufficient for general questions).

**Why this approach:** The system prompt is the correct place for grounding facts because:
1. It does not pollute the conversation history (history stays as user/assistant turns only)
2. The LLM treats system prompt content as authoritative context, not as something to debate
3. Facts can be updated per-message without touching history

**Example:**
```typescript
// src/data/insuranceFacts.ts
export type ProductType = 'saude' | 'auto' | 'vida' | 'residencial' | 'empresarial';

export interface InsuranceFacts {
  productName: string;         // "Seguro Saúde"
  description: string;         // 1-2 sentences
  commonCoverages: string[];   // what is typically covered
  commonExclusions: string[];  // what is typically excluded
  acceptanceRules: string[];   // age ranges, health conditions, etc.
  importantNotes: string[];    // hedging notes, "consult policy for exact values"
}

export const insuranceFacts: Record<ProductType, InsuranceFacts> = {
  saude: {
    productName: 'Seguro Saúde',
    description: 'Plano de saúde individual ou coletivo que cobre consultas, exames e internações.',
    commonCoverages: [
      'Consultas médicas em clínicas credenciadas',
      'Exames laboratoriais e de imagem',
      'Internações hospitalares (com carência)',
      'Urgência e emergência',
      // [ASSESSORIA: adicionar coberturas reais do portfólio]
    ],
    commonExclusions: [
      'Tratamentos estéticos não relacionados a doenças',
      'Medicamentos de uso contínuo (em geral)',
      // [ASSESSORIA: confirmar exclusões padrão]
    ],
    acceptanceRules: [
      'Idade de entrada: geralmente 0 a 59 anos (coletivo) ou 0 a 65 anos (individual)',
      'Declaração de saúde obrigatória para planos individuais',
      // [ASSESSORIA: inserir regras reais de aceitação por seguradora]
    ],
    importantNotes: [
      'Valores e carências variam por seguradora e produto — consulte a tabela atualizada',
    ],
  },
  // ... auto, vida, residencial, empresarial
};
```

```typescript
// src/services/ai.ts — updated buildSystemPrompt
import { detectProductType } from './productDetector';
import { insuranceFacts } from '../data/insuranceFacts';

function buildSystemPrompt(contactName: string, intent: Intent, messageText: string): string {
  const product = detectProductType(messageText);
  const factsBlock = product
    ? formatFactsBlock(insuranceFacts[product])
    : '';

  return `Você é a Issy, assistente virtual da assessoria de seguros...
${factsBlock ? `\n## Fatos sobre ${insuranceFacts[product].productName}\n${factsBlock}` : ''}
...existing rules...`;
}
```

### Pattern 2: Product Type Detection (Keyword-Based, Same as Intent)

**What:** A pure function that scans the message text for product-related keywords and returns a `ProductType | null`. Returns `null` if no specific product is detected (general question).

**When to use:** Called once per message, before `buildSystemPrompt()`.

**Example:**
```typescript
// src/services/productDetector.ts
import { ProductType } from '../data/insuranceFacts';

const PRODUCT_KEYWORDS: Record<ProductType, string[]> = {
  saude:       ['saúde', 'saude', 'plano de saúde', 'health', 'médico', 'medico', 'hospitalar'],
  auto:        ['auto', 'automóvel', 'automovel', 'carro', 'veículo', 'veiculo', 'frota'],
  vida:        ['vida', 'morte', 'funeral', 'renda', 'seguro de vida'],
  residencial: ['residencial', 'casa', 'apartamento', 'imóvel', 'imovel', 'residência'],
  empresarial: ['empresarial', 'empresa', 'negócio', 'negocio', 'comercial', 'cnpj'],
};

export function detectProductType(text: string): ProductType | null {
  const lower = text.toLowerCase();
  for (const [product, keywords] of Object.entries(PRODUCT_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return product as ProductType;
  }
  return null;
}
```

### Pattern 3: Handoff Execution Sequence

**What:** A strict ordering of operations to guarantee: (1) briefing is sent before bot goes silent, (2) humanMode is set after send succeeds, (3) broker receives confirmation. This prevents a race condition where humanMode is set but briefing fails to send.

**When to use:** Whenever `intent === 'handoff'` in the webhook pipeline.

**Critical ordering:**
```typescript
// src/services/handoff.ts
export async function executeHandoff(phone: string, contact: Contact, history: Message[]): Promise<void> {
  // 1. Build briefing BEFORE any sends (pure, no side effects)
  const briefing = buildHandoffBriefing(contact, history);

  // 2. Send briefing to the SAME chat (admin reads it there)
  await sendTextMessage(phone, briefing);

  // 3. Set humanMode=true AFTER briefing is sent (prevents bot from going silent before briefing arrives)
  await setHumanMode(phone, true);

  // 4. Send confirmation to broker
  const confirmation = `Entendido, ${contact.name}! Estou transferindo para um especialista da assessoria. Eles vão ver todo o contexto aqui e entrar em contato em breve.`;
  await sendTextMessage(phone, confirmation);

  // 5. Save briefing and confirmation to history (for audit)
  await saveMessage(phone, 'assistant', briefing);
  await saveMessage(phone, 'assistant', confirmation);
}
```

**Why humanMode is set at step 3 (not step 1):** If we set humanMode first and the briefing send fails, the broker gets no confirmation and the admin gets no briefing — but the bot is silenced. Setting humanMode after the send ensures the briefing always reaches the chat.

### Pattern 4: In-Band Admin Command Parsing

**What:** Admin commands (`/bot`, `/status`) arrive as regular WhatsApp messages through the webhook. The pipeline checks for commands BEFORE the human mode gate — because `/bot` is used specifically to exit human mode, it must not be gated behind the human mode check.

**When to use:** Every incoming message — admin check is an early branch in `processMessage()`.

**Critical placement in pipeline:**
```typescript
// webhook.ts processMessage() — revised flow
async function processMessage(body: ZApiWebhookPayload): Promise<void> {
  const parsed = parseZApiPayload(body);
  if (!parsed || !parsed.text) return;

  const { phone, text, senderName } = parsed;

  // Step 1: Persist contact
  const contact = await upsertContact(phone, senderName);
  const firstMsg = isFirstMessage(contact);

  // Step 2: NEW — Admin command check (BEFORE human mode gate)
  // /bot and /status only work from ADMIN_PHONES. /humano works from any phone.
  if (isAdminCommand(text)) {
    const isAdmin = isAdminPhone(phone);
    if (isAdmin) {
      await handleAdminCommand(phone, text);
    }
    // Non-admin sending /bot or /status: no response, no processing
    return;
  }

  // Step 3: Human mode gate (UNCHANGED from Phase 2)
  const conversation = await getOrCreateConversation(phone);
  if (isHumanMode(conversation)) {
    console.log(`[webhook] Human mode active for ${phone} — skipping bot response`);
    return;
  }

  // Step 4: Intent classification
  const intent = classifyIntent(text);

  // Step 5: NEW — Handoff intent handling (before AI call)
  if (intent === 'handoff') {
    const history = await loadHistory(phone);
    await executeHandoff(phone, contact, history);
    return;  // pipeline ends — bot is now silent
  }

  // Steps 6-10: Unchanged Phase 2 Q&A pipeline (with updated buildSystemPrompt)
  // ...
}
```

**Why admin check is before human mode gate:** The `/bot` command must work even when `humanMode=true`. If the admin check came after the human mode gate, `/bot` would be silenced — deadlock.

### Pattern 5: Handoff Briefing Message Structure

**What:** A formatted WhatsApp message (plain text, no rich media) that gives the human agent everything they need at a glance.

**Format:**
```
🤝 *TRANSFERÊNCIA PARA ATENDIMENTO HUMANO*

*Corretor:* {name} ({phone})
*Assunto:* {last detected product or "Geral"}
*Última mensagem:* "{last user message}"
*Contexto da conversa:* {N} mensagens anteriores

*Resumo:*
{last 3 user messages as bullet points}

Para retornar ao bot: envie */bot* neste chat
```

**Why plain text:** WhatsApp does not allow bots to send interactive buttons/templates from unofficial API (Z-API). Bold (`*text*`) and italic (`_text_`) are supported as WhatsApp markdown.

### Anti-Patterns to Avoid

- **Setting humanMode before sending briefing:** If the send fails, the bot is silenced with no briefing sent and no confirmation to the broker. Always send first, then set the flag.
- **Routing /bot through the human mode gate:** This creates a deadlock — the admin cannot restore bot mode because the gate blocks all processing when humanMode=true.
- **Injecting full facts file into every prompt:** Only inject facts for the detected product. Injecting all 5 product sections for every message inflates token usage by ~2000 tokens per call.
- **Treating /humano as admin-only:** Per CONTEXT.md, any user can trigger handoff with `/humano`. Only `/bot` and `/status` require admin phone.
- **Saving briefing to history before sending:** Same pattern as Phase 2's `saveMessage(assistant)` — always save AFTER send succeeds to prevent phantom messages.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured prompt assembly | Custom templating engine | Plain TypeScript template literals | Template literals are type-safe, debuggable, and sufficient for a system prompt |
| Product type detection | ML-based NER | Keyword matching (same pattern as `classifyIntent`) | Overkill for 5 product types with well-defined keywords; keyword matching is zero-latency, zero-cost |
| Handoff briefing generation | GPT call to summarize conversation | Deterministic template with last N messages | More reliable (no hallucination), faster (no extra API call), and sufficient for the demo use case |
| Admin phone validation | JWT/session auth | Simple `config.admin.phoneNumbers.includes(phone)` | Admin phones are a closed list in env; session auth adds infrastructure for no benefit at this scale |

**Key insight:** Every "smart" feature proposed here (ML detection, GPT summarization) introduces non-determinism and latency. For Phase 3, deterministic functions + curated content produce better demos than probabilistic AI.

---

## Common Pitfalls

### Pitfall 1: humanMode Gate Blocks /bot Command

**What goes wrong:** Admin sends `/bot` but bot is in humanMode=true, so the pipeline gate at Step 2 (current webhook.ts line 41) returns early before the command is parsed. The bot can never be restored without direct DB intervention.

**Why it happens:** The human mode gate in Phase 2 is placed before any processing. It's correct for messages, but wrong for admin commands.

**How to avoid:** Admin command check MUST come before the human mode gate in `processMessage()`. See Pattern 4 above.

**Warning signs:** `/bot` command sent, bot does not resume, no log output from admin handler.

### Pitfall 2: Facts File Hallucination (Wrong or Missing Values)

**What goes wrong:** Facts file contains placeholder content or fabricated values (e.g., `R$ 89/mês` for a health plan). LLM uses these as authoritative and quotes them to the broker. Broker trusts the value, reality diverges.

**Why it happens:** Developer writes plausible-sounding placeholder values that are never replaced.

**How to avoid:** All placeholder values MUST use the format `[ASSESSORIA: fill in real value]` — this is a recognizable marker that the LLM will surface in its response ("I have a note here that says...") rather than quoting as fact. Never write `R$ XX` as placeholder.

**Warning signs:** Bot quotes specific prices, exact waiting periods, or specific coverage limits without a hedging qualifier.

### Pitfall 3: Briefing Sent After humanMode=true

**What goes wrong:** humanMode is set first, briefing is attempted second, but the briefing send is now a message from a silenced bot. If any guard in `sendTextMessage` checks humanMode before sending, the briefing never arrives.

**Why it happens:** Logical ordering error — developer sets state before completing the side effects that depend on the old state.

**How to avoid:** The `sendTextMessage` function in `whatsapp.ts` does NOT check humanMode (it's a pure send function). However, the ordering still matters for correctness: set humanMode only after all sends complete.

### Pitfall 4: Admin /status Reveals Too Much to Non-Admins

**What goes wrong:** `/status` command returns broker information (name, phone, last message) to any phone number that sends it, exposing broker PII.

**Why it happens:** Admin validation is forgotten or applied inconsistently.

**How to avoid:** Both `/bot` and `/status` check `isAdminPhone(phone)` BEFORE any processing. If not admin, return immediately with no response (same as treating it as a normal message).

### Pitfall 5: /humano Keyword Already in Intent Classifier

**What goes wrong:** `/humano` is already in `HANDOFF_KEYWORDS` in `intent.ts`. Adding it as an admin command check could intercept it before intent classification, preventing the actual handoff flow from running.

**Why it happens:** Admin command check intercepts `/humano` before classifyIntent() is called.

**How to avoid:** The admin command check must only intercept `/bot` and `/status` — NOT `/humano`. `/humano` flows through the normal intent pipeline and hits the `handoff` branch. See Pattern 4's `isAdminCommand()` function — it should only return true for `/bot` and `/status`.

### Pitfall 6: generateResponse Called with Facts-Enhanced Prompt but No Product Context in signature

**What goes wrong:** `generateResponse()` currently takes `(contactName, history, currentMessage, intent)`. Adding product detection requires either: (a) passing messageText again (it's already `currentMessage`), or (b) passing the detected product type.

**Why it happens:** Signature was designed for Phase 2 — product context was not anticipated.

**How to avoid:** Extend the signature to accept an optional `productType: ProductType | null` parameter. `buildSystemPrompt` then uses it to inject the right facts block. This is a clean, backwards-compatible extension.

---

## Code Examples

Verified patterns derived from existing codebase:

### setHumanMode Function (extends conversation.ts)

```typescript
// src/services/conversation.ts — add this function
/**
 * Set humanMode for a conversation. Used by handoff flow (true) and admin /bot command (false).
 * Prefer explicit boolean over toggle — callers state intent clearly.
 */
export async function setHumanMode(phone: string, mode: boolean): Promise<void> {
  await prisma.conversation.update({
    where: { phone },
    data: { humanMode: mode },
  });
}
```

### isAdminPhone and Admin Command Handler

```typescript
// src/services/admin.ts
import { config } from '../config';
import { setHumanMode } from './conversation';
import { prisma } from '../lib/prisma';
import { sendTextMessage } from './whatsapp';

export function isAdminPhone(phone: string): boolean {
  return config.admin.phoneNumbers.includes(phone);
}

export function isAdminCommand(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return lower === '/bot' || lower === '/status';
}

export async function handleAdminCommand(phone: string, text: string): Promise<void> {
  const lower = text.trim().toLowerCase();

  if (lower === '/bot') {
    await setHumanMode(phone, false);
    await sendTextMessage(phone, '✅ Bot mode restaurado. Issy voltou a responder neste chat.');
    console.log(`[admin] /bot executed by ${phone}`);
    return;
  }

  if (lower === '/status') {
    const conversation = await prisma.conversation.findUnique({ where: { phone } });
    const contact = await prisma.contact.findUnique({ where: { phone } });
    const lastMessage = await prisma.message.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    });

    const status = [
      `*Status do Bot*`,
      `Modo: ${conversation?.humanMode ? 'Humano' : 'Bot'}`,
      `Corretor: ${contact?.name ?? 'Desconhecido'}`,
      `Última mensagem: "${lastMessage?.content?.slice(0, 100) ?? 'nenhuma'}"`,
    ].join('\n');

    await sendTextMessage(phone, status);
    console.log(`[admin] /status executed by ${phone}`);
    return;
  }
}
```

**Note:** `/status` is called with the admin's own phone as `phone`, meaning the status of the admin's own conversation is returned. If the design intent is to check status of a specific broker, the command would need to be `/status 5511999999999`. CONTEXT.md says "basic info only" — querying the admin's own conversation (or the last active one) is sufficient for demo. **Planner should clarify this and pick the simpler implementation.**

### buildHandoffBriefing Function

```typescript
// src/services/handoff.ts
import { Contact } from '@prisma/client';  // or from Prisma generated types
import { Message } from '../types';

export function buildHandoffBriefing(
  contact: { name: string; phone: string },
  history: Array<{ role: string; content: string }>,
): string {
  const userMessages = history
    .filter((m) => m.role === 'user')
    .slice(-3)
    .map((m) => `• ${m.content.slice(0, 120)}`)
    .join('\n');

  return [
    `🤝 *TRANSFERÊNCIA PARA ATENDIMENTO HUMANO*`,
    ``,
    `*Corretor:* ${contact.name} (${contact.phone})`,
    `*Mensagens anteriores:* ${history.length}`,
    ``,
    `*Últimas mensagens do corretor:*`,
    userMessages || '• (sem histórico)',
    ``,
    `Para retornar ao bot: envie */bot* neste chat`,
  ].join('\n');
}
```

### Updated generateResponse Signature

```typescript
// src/services/ai.ts — updated signature
export async function generateResponse(
  contactName: string,
  historyMessages: Array<{ role: string; content: string }>,
  currentMessage: string,
  intent: Intent,
  productType: ProductType | null = null,  // NEW: optional, defaults to null
): Promise<string>
```

### Facts Block Formatter

```typescript
// src/services/ai.ts — helper for injecting facts
function formatFactsBlock(facts: InsuranceFacts): string {
  const lines = [
    `Produto: ${facts.productName}`,
    `Descrição: ${facts.description}`,
    '',
    'Coberturas comuns (verifique apólice para valores exatos):',
    ...facts.commonCoverages.map((c) => `- ${c}`),
    '',
    'Exclusões comuns:',
    ...facts.commonExclusions.map((e) => `- ${e}`),
    '',
    'Regras de aceitação típicas:',
    ...facts.acceptanceRules.map((r) => `- ${r}`),
    '',
    'Notas importantes:',
    ...facts.importantNotes.map((n) => `- ${n}`),
  ];
  return lines.join('\n');
}
```

---

## Implementation Plan Decomposition

Based on the research, Phase 3 naturally decomposes into **two plans**:

### Plan 03-01: Knowledge Layer (KNOW-01 to KNOW-04)

**Tasks:**
1. Create `src/data/insuranceFacts.ts` with types and placeholder content for all 5 product types
2. Create `src/services/productDetector.ts` with `detectProductType()` function
3. Update `src/services/ai.ts`:
   - Update `generateResponse()` signature to accept `productType: ProductType | null`
   - Update `buildSystemPrompt()` to inject product facts block when product is detected
   - Add `formatFactsBlock()` helper
4. Update `src/routes/webhook.ts` to call `detectProductType(text)` and pass result to `generateResponse()`
5. Update `src/types/index.ts` with `ProductType` and `InsuranceFacts` types

**Success:** Bot receives "quais são as coberturas do seguro saúde?" and responds with facts from the file, with hedging qualifiers, in Portuguese.

### Plan 03-02: Handoff and Admin Commands (HAND-01 to HAND-03)

**Tasks:**
1. Update `src/services/conversation.ts`: add `setHumanMode()` function
2. Create `src/services/handoff.ts` with `buildHandoffBriefing()` and `executeHandoff()`
3. Create `src/services/admin.ts` with `isAdminPhone()`, `isAdminCommand()`, `handleAdminCommand()`
4. Update `src/routes/webhook.ts`:
   - Add admin command check as Step 2 (before human mode gate)
   - Add handoff intent branch as Step 5 (before AI call, exits pipeline)
5. Update `src/types/index.ts` if needed for handoff-related types

**Success:** `/humano` triggers briefing + confirmation. `/bot` from admin phone restores bot mode. `/status` from admin phone returns current state. All in the same WhatsApp chat.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate admin HTTP endpoint | In-band WhatsApp commands | This project, CONTEXT.md decision | Admin uses same WhatsApp channel — no tooling needed |
| GPT-based FAQ answering with no grounding | Facts injection into system prompt | This phase | Reduces hallucination for specific product questions |
| Full RAG pipeline for knowledge | Embedded `.ts` facts file | Deferred to v2 | Sufficient for demo; zero infrastructure overhead |

**Deprecated/outdated (for this project):**
- Separate admin route (`POST /admin`): The architecture research proposed this, but CONTEXT.md locked in-band WhatsApp commands — the admin route concept does not apply to Phase 3.

---

## Open Questions

1. **What does `/status` query — admin's own conversation or a specific broker?**
   - What we know: `/status` is sent by admin from their phone. The admin has their own conversation record in the DB. But the likely intent is to check a broker's status.
   - What's unclear: Does the admin send `/status 5511999999999` (targeting a broker) or just `/status` (seeing their own state)?
   - Recommendation: Implement `/status` querying the admin's OWN conversation for v1 demo (simplest). If the admin is testing a broker's status, they can use it on that broker's conversation by having that number send it — or accept the limitation. **Planner should pick one and document it.**

2. **Should the briefing message include a generated summary from GPT, or just raw last messages?**
   - What we know: CONTEXT.md says "resumo da conversa" but also says facts injection is simple (no extra AI calls mentioned).
   - What's unclear: Whether "resumo" means a GPT-generated summary or a structured last-N-messages display.
   - Recommendation: Use deterministic last-3-messages template (Pattern 5 in Code Examples). This avoids an extra API call, is reliable, and is sufficient for the demo. Document as "v1 deterministic summary."

3. **Can `setHumanMode` be called with a phone that has no Conversation record yet?**
   - What we know: `getOrCreateConversation()` uses upsert — a conversation always exists by the time handoff runs. The pipeline runs `getOrCreateConversation` before the intent check.
   - What's unclear: The `setHumanMode` function uses `prisma.conversation.update()` which fails if record doesn't exist (unlike upsert).
   - Recommendation: Use `prisma.conversation.upsert()` in `setHumanMode` instead of `update()` to be safe. Or ensure `getOrCreateConversation` is always called before `setHumanMode` (it is, per the pipeline order).

---

## Sources

### Primary (HIGH confidence)

- `src/services/ai.ts` (ground truth) — current `buildSystemPrompt`, `generateResponse` signature, Intent type
- `src/services/intent.ts` (ground truth) — HANDOFF_KEYWORDS, keyword matching pattern
- `src/routes/webhook.ts` (ground truth) — pipeline step order, human mode gate position
- `src/services/conversation.ts` (ground truth) — `getOrCreateConversation`, `isHumanMode`
- `src/config.ts` (ground truth) — `config.admin.phoneNumbers` already parsed from `ADMIN_PHONES` env var
- `prisma/schema.prisma` (ground truth) — `humanMode` boolean field on Conversation, `state` JSONB field
- `.planning/phases/03-insurance-qa-handoff/03-CONTEXT.md` — locked decisions (no RAG, in-band commands, same-chat briefing)
- `.planning/STATE.md` — "Known facts layer content needs assessoria input to prevent hallucination" blocker

### Secondary (MEDIUM confidence)

- `.planning/research/ARCHITECTURE.md` — human mode state machine pattern, admin command flow design
- `.planning/research/PITFALLS.md` — not explicitly read but covered by codebase inspection

### Tertiary (LOW confidence)

None — all findings are directly traceable to the codebase or locked decisions.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all existing stack
- Architecture: HIGH — derived directly from existing codebase + locked CONTEXT.md decisions
- Pitfalls: HIGH — most pitfalls derived from reading actual code and finding the exact edge cases
- Facts content: LOW — content quality depends on assessoria input; placeholder markers are the mitigation

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (stable — no fast-moving external APIs involved; all local TypeScript)
