# Phase 4: Quote Flow (Health Insurance) - Research

**Researched:** 2026-02-24
**Domain:** Stateful multi-step conversational flow — WhatsApp webhook, Prisma JSONB, OpenAI GPT
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Coleta de dados**
- Uma pergunta por vez — bot pergunta um campo, espera resposta, segue pro próximo
- 4 campos básicos: quantidade de vidas, faixa etária, cidade, tipo de plano (enfermaria/apartamento)
- IA interpreta respostas ambíguas antes de rejeitar (ex: "muitas vidas" → tenta extrair número)
- Resumo de confirmação antes de gerar cotação: mostra todos os dados e pede "Correto?"

**Apresentação da cotação**
- 1 plano mockado por cotação (não comparação entre planos)
- Conteúdo completo: nome do plano, coberturas principais, carência, preço mensal mockado
- Formatação WhatsApp com emojis (🏥 Plano, 💰 Preço, ✅ Coberturas) e *negrito* para destaque
- Após cotação, oferecer próximos passos: "Quer cotar outro plano? Falar com um consultor?"

**Fluxo de conversação**
- Tom profissional amigável — cordial mas direto ("Perfeito! Agora me diz a cidade.")
- Interrupções: responde a dúvida e volta pra cotação ("Voltando à cotação de saúde, qual a cidade?")
- Retomada: resume dados coletados e continua de onde parou ("Você estava cotando saúde: 4 vidas, 25-35 anos. Falta a cidade. Quer continuar?")
- Uma cotação ativa por vez — nova cotação substitui a anterior se não foi concluída

**Validação e erros**
- 3 tentativas por campo — mensagens cada vez mais claras, na 3ª oferece pular ou falar com humano
- Cidade: lista fixa mockada (~5 cidades: SP, RJ, BH, Curitiba, POA). Fora da lista informa as disponíveis
- Tipo de plano: bot lista opções "1) Enfermaria 2) Apartamento" — corretor escolhe por número ou nome
- Erros de sistema: mensagem amigável ("Tive um problema técnico. Tenta de novo em alguns minutos?")

### Claude's Discretion
- Estrutura interna do state machine para o quote flow
- Formato exato dos dados mockados (nomes de operadoras, valores de preço)
- Como persistir o estado da cotação no banco (JSONB na conversa já decidido na Phase 1)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| QUOT-01 | Bot conduz fluxo de cotação guiado para seguro saúde (coleta dados, valida, retorna preço mockado) | State machine pattern + JSONB persistence + field-by-field prompt loop |
| QUOT-02 | Bot detecta automaticamente o tipo de seguro a partir de texto livre do corretor | Intent router already classifies 'quote' intent; extend to detect 'saude' product type using existing detectProductType |
| QUOT-03 | Bot apresenta resumo da cotação com coberturas, carências e preço | Mock data layer + WhatsApp-formatted output builder |
| QUOT-04 | Bot salva cotação parcial e retoma de onde parou quando corretor volta | JSONB state field on Conversation model already exists — read/write QuoteState on each step |
</phase_requirements>

---

## Summary

Phase 4 adds a stateful, multi-step conversational form to an existing Express/TypeScript webhook pipeline. The core challenge is not the individual steps — it is correctly modeling the quote flow as a persistent state machine that survives webhook calls, partial completions, and interruptions. The `Conversation.state` field (type `Json?`, mapped to `estado` in Postgres) was pre-provisioned in Phase 1 precisely for this purpose.

The recommended approach is a **lightweight hand-rolled state machine** stored as a typed JSONB object. Each incoming webhook call: (1) reads the current `QuoteState` from `Conversation.state`, (2) determines the active step, (3) validates/extracts the field for that step using GPT or a keyword matcher, (4) advances the state, and (5) writes the updated `QuoteState` back to `Conversation.state` via a Prisma update. This keeps the machine fully serializable, zero extra dependencies, and consistent with the project's existing patterns.

The existing `intent.ts` already classifies messages as `'quote'`. The webhook pipeline already branches on intent. Phase 4 extends the `'quote'` branch from a stub ("cotação disponível em breve") into a fully functional stepped flow. The `generateResponse` in `ai.ts` is **not** used for the quote flow — instead, the quote service will send deterministic, templated messages for each step (one prompt per field), reserving GPT only for ambiguous-input extraction.

**Primary recommendation:** Hand-roll a `QuoteState` TypeScript interface persisted to `Conversation.state` (JSONB). Drive the flow with a `quoteService.ts` step-dispatcher called from webhook.ts when `intent === 'quote'` or when an active quote session is in progress.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma Client | ^7.4.1 (already installed) | Read/write `Conversation.state` (Json? field) | Already in use; `Json` type handles JSONB natively |
| OpenAI SDK | ^4.67.0 (already installed) | Ambiguous-value extraction only (not full response generation) | Already in use; structured outputs or simple prompt for extraction |
| TypeScript | ^5.6.3 (already installed) | Type-safe `QuoteState` interface; compile-time step validation | Already in use |
| Express | ^4.21.1 (already installed) | Webhook endpoint already wired | Already in use |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | ^3.x (not installed) | Runtime validation of QuoteState shape on DB read | Only if deserialization safety is needed; can also use manual type guard |
| XState | ^5.x (not installed) | Full state machine with guards, actions, serialization | Skip — overkill for 4-field linear flow; adds 200KB+ bundle and learning curve |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled QuoteState object | XState v5 | XState provides serializable snapshots via `actor.getPersistedSnapshot()`, but adds dependency and is unnecessary for a 4-step linear flow. Hand-roll is simpler and consistent with codebase style. |
| Deterministic step prompts | Full GPT for every response | GPT for every field adds latency and non-determinism. Use GPT only for ambiguous-value extraction, hard-coded prompts for field questions. |
| Zod schema for QuoteState | TypeScript type guard | Either works. Zod adds runtime safety on DB read; a simple manual `isQuoteState()` guard is enough given project has no Zod dependency. |

**Installation:**
```bash
# No new dependencies required — all packages are already installed.
# Optional Zod if type-guarding QuoteState on read:
# npm install zod
```

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
src/
├── data/
│   ├── insuranceFacts.ts          # existing — Phase 3
│   └── healthQuoteMock.ts         # NEW — mock operator data for health quote output
├── services/
│   ├── quoteService.ts            # NEW — quote state machine dispatcher
│   └── ...existing services
├── types/
│   └── index.ts                   # MODIFIED — add QuoteState interface, QuoteStep type
└── routes/
    └── webhook.ts                 # MODIFIED — add quote branch in processMessage()
```

### Pattern 1: QuoteState as Typed JSONB

**What:** A TypeScript interface defines the shape of the active quote. This object is stored directly in `Conversation.state` (Prisma `Json?` field = PostgreSQL JSONB). Each webhook call reads it, mutates it, and writes it back.

**When to use:** Whenever the user is in an active quote session (intent === 'quote' OR `quoteState.status === 'collecting'`).

**Example:**
```typescript
// src/types/index.ts — ADDITION

export type QuoteStep = 'lives' | 'age_range' | 'city' | 'plan_type' | 'confirm' | 'done';

export interface QuoteState {
  status: 'collecting' | 'confirming' | 'complete' | 'abandoned';
  currentStep: QuoteStep;
  retryCount: number;           // retries on the current field (max 3)
  // Collected fields — null until user provides valid value
  lives: number | null;
  ageRange: string | null;      // e.g. "25-35"
  city: string | null;          // one of ALLOWED_CITIES
  planType: 'enfermaria' | 'apartamento' | null;
  startedAt: string;            // ISO timestamp — for future TTL logic
  updatedAt: string;            // ISO timestamp — updated on every step
}
```

**Prisma read/write:**
```typescript
// Source: https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields

// Read (cast Json? to QuoteState):
const conv = await prisma.conversation.findUnique({ where: { phone } });
const quoteState = isQuoteState(conv?.state) ? conv.state as QuoteState : null;

// Write (plain object — Prisma serializes to JSONB):
await prisma.conversation.update({
  where: { phone },
  data: { state: updatedQuoteState },
});

// Important: Prisma's Json? field requires reading first, then writing
// the ENTIRE object. No partial JSON updates in place via Prisma ORM.
// Pattern: read → mutate in-memory → write full object back.
```

**Type guard (no Zod needed):**
```typescript
function isQuoteState(value: unknown): value is QuoteState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.status === 'string' &&
    typeof v.currentStep === 'string' &&
    typeof v.retryCount === 'number'
  );
}
```

---

### Pattern 2: Step-Dispatcher in quoteService.ts

**What:** A single async function `handleQuoteMessage(phone, text, contact, quoteState?)` is the entry point for all quote interactions. It contains a switch on `quoteState.currentStep` and delegates to per-step handlers.

**When to use:** Called from webhook.ts whenever `intent === 'quote'` OR when `quoteState` exists and is not 'complete'/'abandoned'. The second condition is critical: it ensures mid-flow messages (e.g., the user answering a field prompt without repeating the word "cotar") are captured.

**Webhook.ts integration — key insight:** The webhook pipeline must check for an active quote session BEFORE routing to the normal `generateResponse` AI path. An active `QuoteState` takes priority over re-classifying intent.

```typescript
// src/routes/webhook.ts — updated step sequence (additions in Phase 4)

// Step 6 (modified): Load history AND quote state
const history = await loadHistory(phone);
const quoteState = await getQuoteState(phone);  // reads Conversation.state

// Step 8 (new): Route to quote flow if active session OR new quote intent
if (quoteState?.status === 'collecting' || quoteState?.status === 'confirming' || intent === 'quote') {
  await handleQuoteMessage(phone, text, contact, quoteState);
  await saveMessage(phone, 'user', text);
  // handleQuoteMessage sends its own response and saves assistant message
  return;
}

// Step 9+ (existing): Continue to AI response for non-quote messages
```

**quoteService.ts dispatcher sketch:**
```typescript
// src/services/quoteService.ts

export async function handleQuoteMessage(
  phone: string,
  text: string,
  contact: { name: string; phone: string },
  existingState: QuoteState | null,
): Promise<void> {
  // 1. Initialize or reset state if no active session
  const state: QuoteState = existingState ?? createFreshQuoteState();

  // 2. New 'cotar' message replaces abandoned/complete session
  if (intent === 'quote' && (state.status === 'complete' || state.status === 'abandoned')) {
    const fresh = createFreshQuoteState();
    await persistQuoteState(phone, fresh);
    await sendStepPrompt(phone, fresh);
    return;
  }

  // 3. Dispatch to step handler
  switch (state.currentStep) {
    case 'lives':     await handleLivesStep(phone, text, state); break;
    case 'age_range': await handleAgeRangeStep(phone, text, state); break;
    case 'city':      await handleCityStep(phone, text, state); break;
    case 'plan_type': await handlePlanTypeStep(phone, text, state); break;
    case 'confirm':   await handleConfirmStep(phone, text, state); break;
    case 'done':      /* show quote again or redirect to next steps */ break;
  }
}
```

---

### Pattern 3: Retry Loop per Field (max 3)

**What:** Each step handler reads `state.retryCount`. On validation failure: increment `retryCount`, save state, send increasingly explicit error message. On 3rd failure: offer to skip or transfer to human (QUOT-01 requirement per CONTEXT.md).

**Why:** Prevents infinite loops. Consistent with CONTEXT.md decision: "3 tentativas por campo — mensagens cada vez mais claras, na 3ª oferece pular ou falar com humano."

```typescript
async function handleLivesStep(phone: string, text: string, state: QuoteState): Promise<void> {
  const extracted = await extractLivesCount(text);  // GPT or regex

  if (extracted !== null) {
    state.lives = extracted;
    state.currentStep = 'age_range';
    state.retryCount = 0;
    await persistQuoteState(phone, state);
    await sendStepPrompt(phone, state);  // sends next field prompt
    await saveMessage(phone, 'assistant', PROMPTS.age_range);
  } else {
    state.retryCount += 1;
    await persistQuoteState(phone, state);
    const errorMsg = getRetryMessage('lives', state.retryCount);
    await sendTextMessage(phone, errorMsg, computeDelaySeconds());
    await saveMessage(phone, 'assistant', errorMsg);
  }
}

function getRetryMessage(field: QuoteStep, attempt: number): string {
  if (attempt === 1) return 'Não entendi bem. Quantas pessoas serão cobertas pelo plano? (ex: 3, 5, 10)';
  if (attempt === 2) return 'Me diz somente o número de vidas, por exemplo: *4*';
  return 'Tive dificuldade em entender. Quer pular essa pergunta e falar com um consultor? (responda *sim* para transferir ou *não* para tentar de novo)';
}
```

---

### Pattern 4: Ambiguous-Value Extraction with GPT

**What:** For fields like `lives` (where broker may say "muitas", "pra uma família de 4") or `age_range` (where broker may say "uns 30 e poucos anos"), use a targeted GPT prompt to extract the structured value before falling back to validation failure.

**When to use:** Primary extraction layer — run before declaring validation failure. Use simple regex first (faster/cheaper), GPT as fallback for ambiguous input.

**GPT extraction call (targeted, not full chat completion):**
```typescript
// Source: OpenAI SDK v4 — openai.chat.completions.create() with focused system prompt
// Model: gpt-4o-mini (already configured) — adequate for simple extraction tasks

async function extractLivesCount(text: string): Promise<number | null> {
  // Fast path: pure numeric
  const directMatch = text.match(/\b(\d+)\b/);
  if (directMatch) return parseInt(directMatch[1], 10);

  // Slow path: GPT extraction for ambiguous Portuguese input
  const completion = await openai.chat.completions.create({
    model: config.openai.model,  // gpt-4o-mini
    messages: [
      {
        role: 'system',
        content: 'Você extrai o número de vidas de um texto em português. Responda APENAS com um número inteiro ou a palavra NENHUM se não for possível extrair.',
      },
      { role: 'user', content: text },
    ],
    temperature: 0,
    max_tokens: 10,
  });
  const raw = completion.choices[0]?.message?.content?.trim() ?? 'NENHUM';
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? null : parsed;
}
```

**Note:** For `city` (fixed list) and `planType` (binary choice), skip GPT entirely — keyword matching is sufficient and cheaper.

---

### Pattern 5: Mock Data Layer for Quote Output

**What:** A static TypeScript object provides the mocked operator data. No external calls. The quote output is assembled deterministically from this data + collected QuoteState fields.

**Why:** CONTEXT.md specifies "Tudo mockado para demo — preços fictícios, operadoras fictícias, coberturas genéricas." This is a presentation layer only; real integration is explicitly deferred.

```typescript
// src/data/healthQuoteMock.ts

export interface HealthQuotePlan {
  operator: string;          // e.g. "Saúde Segura"
  planName: string;          // e.g. "Plano Essencial Plus"
  coverages: string[];
  carencia: string;          // e.g. "30 dias para urgências, 180 dias para cirurgias"
  baseMonthlyPrice: number;  // per person, enfermaria
  apartamentoMultiplier: number;  // multiply for apartamento tier
}

// Price formula: monthlyTotal = baseMonthlyPrice * lives * multiplier + ageAdjustment
// All values are fictional for demo purposes.
```

**WhatsApp formatting output (assembled by quoteService):**
```
🏥 *Plano de Saúde — Cotação*

*Operadora:* Saúde Segura
*Plano:* Essencial Plus
*Acomodação:* Apartamento

✅ *Coberturas incluídas:*
- Consultas médicas e especialidades
- Internação hospitalar
- Exames laboratoriais e imagem
- Pronto-socorro 24h
- Cirurgias eletivas (rol ANS)

⏳ *Carências:*
- 30 dias: urgências e emergências
- 180 dias: cirurgias eletivas
- 300 dias: partos

💰 *Valor estimado:* R$ 1.240,00/mês
_(4 vidas | faixa 25-35 anos | SP | Apartamento)_

---
Quer cotar outro plano? Ou prefere falar com um consultor?
```

---

### Anti-Patterns to Avoid

- **Using `generateResponse` for quote flow steps:** The existing AI response function is designed for open-ended Q&A with a full conversation history. Quote flow prompts must be deterministic — templated messages, not LLM-generated. Use GPT only for extraction of ambiguous values.
- **Checking intent alone to detect active quote session:** A broker mid-flow will say "São Paulo" without repeating "cotar saúde". The webhook must check `quoteState.status` BEFORE re-classifying intent from the message text.
- **Overwriting QuoteState on new 'cotar' message during active session:** CONTEXT.md decision is "nova cotação substitui a anterior se não foi concluída." This means: if `status === 'collecting'`, receiving a new quote intent should reset to a fresh state, not continue the old one.
- **Partial Prisma JSON updates:** Prisma's `Json` field does not support partial nested updates. Always read → mutate in memory → write full object. Attempting `data: { state: { lives: 4 } }` will REPLACE the entire state object with `{ lives: 4 }` (confirmed: prisma/prisma Discussion #3070).
- **Saving assistant message BEFORE sendTextMessage:** Established project invariant (Phase 2) — always save after send succeeds. Apply same rule in quoteService.
- **Treating JSONB reads as always typed:** `Conversation.state` is `Json?` — Prisma returns it as `Prisma.JsonValue | null`. Always cast through a type guard before accessing properties.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Number extraction from Portuguese text | Custom NLP parser | GPT targeted prompt (regex first, GPT fallback) | Handles "quatro", "pra um casal", "uns 3" without regex explosion |
| WhatsApp-formatted message construction | HTML templating | String template literals with `\n` and `*bold*` | WhatsApp uses plain text with markdown-like markers — no HTML |
| State serialization | Custom binary encoding | Native JSON.stringify via Prisma Json? | Prisma handles serialization; JSONB in Postgres is already indexed |

**Key insight:** The project's existing patterns (Prisma JSONB for state, GPT for NLU, templated strings for WhatsApp messages) are exactly the right tools for this phase. No new architectural concepts required — only a new service module and data file.

---

## Common Pitfalls

### Pitfall 1: Active Session Not Detected on Mid-Flow Messages
**What goes wrong:** Broker answers "São Paulo" mid-flow. Intent classifier sees no quote keyword → routes to Q&A → GPT gives a generic response. Quote flow stalls.
**Why it happens:** `classifyIntent` is keyword-based and only triggers on "cotar", "cotação", etc.
**How to avoid:** In `processMessage()`, read `quoteState` from DB BEFORE intent routing. If `quoteState.status === 'collecting' || 'confirming'`, immediately route to `handleQuoteMessage` regardless of classified intent. This must be checked early in the pipeline — before the `generateResponse` call.
**Warning signs:** Broker complains bot "forgot" the quote mid-flow.

### Pitfall 2: Race Condition on State Write
**What goes wrong:** Two rapid messages arrive before the first Prisma write completes. Both read the same `quoteState`, both process independently, second write overwrites first.
**Why it happens:** Webhook acknowledges immediately (fire-and-forget) per existing architecture. Concurrent processMessage calls can happen.
**How to avoid:** For Phase 4 (single user flow via WhatsApp), this is LOW risk — WhatsApp serializes messages per contact. But if it surfaces: add a simple lock on `phone` using a Prisma `$transaction` for read+write, or an in-memory Map<phone, Promise> guard. Flag as LOW severity for demo phase.
**Warning signs:** State jumps back to a previous step unexpectedly.

### Pitfall 3: Prisma Json? Field Type Cast Failure
**What goes wrong:** `conv.state` is `null` for new conversations. Code accesses `conv.state.currentStep` → runtime TypeError crash.
**Why it happens:** `Conversation.state` defaults to null (no Prisma default defined, nullable field).
**How to avoid:** Always guard: `const quoteState = isQuoteState(conv?.state) ? conv.state as QuoteState : null`. If null, treat as no active session (start fresh on 'quote' intent).
**Warning signs:** TypeScript compiler may not catch this if wrong cast is used.

### Pitfall 4: Webhook Pipeline Short-Circuit Missing saveMessage
**What goes wrong:** `handleQuoteMessage` returns early (sends response) but the user's incoming message was never saved to history. History becomes inconsistent.
**Why it happens:** The existing pipeline saves user message at Step 7 (after loadHistory). If the quote branch returns before Step 7, the message is skipped.
**How to avoid:** Save user message BEFORE routing to quote branch — or ensure quoteService saves it explicitly. Adopt the same ordering established in Phase 2: save user message → process → send response → save assistant message.
**Warning signs:** Message history gaps visible in /status or handoff briefing.

### Pitfall 5: City Validation Edge Cases
**What goes wrong:** Broker sends "sp", "são paulo", "S.Paulo" — none match the exact expected string. Validation fails unnecessarily.
**Why it happens:** String equality check on raw input.
**How to avoid:** Normalize city input: lowercase + remove accents + trim before matching. Build a normalizeCity() helper that maps aliases ("sp" → "São Paulo", "rj" → "Rio de Janeiro") to canonical values.
**Warning signs:** Broker reports city was "rejected" despite entering correct city.

### Pitfall 6: Quote Session Not Reset Properly on New Intent
**What goes wrong:** Broker completes a quote, then starts a new one. Old `QuoteState` has `status: 'complete'`. Code checks `status === 'collecting'` only → misses re-initialization → broker gets asked to confirm old data.
**How to avoid:** On new `'quote'` intent, always create a fresh `QuoteState` regardless of existing status. Exception: only continue if `status === 'collecting'` or `'confirming'`. `'complete'` and `'abandoned'` always trigger reset.

---

## Code Examples

### QuoteState Initialization
```typescript
// src/services/quoteService.ts

function createFreshQuoteState(): QuoteState {
  const now = new Date().toISOString();
  return {
    status: 'collecting',
    currentStep: 'lives',
    retryCount: 0,
    lives: null,
    ageRange: null,
    city: null,
    planType: null,
    startedAt: now,
    updatedAt: now,
  };
}
```

### Persisting QuoteState to Conversation.state
```typescript
// Source: https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields
// Pattern: read → mutate → write full object

async function persistQuoteState(phone: string, state: QuoteState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  await prisma.conversation.update({
    where: { phone },
    data: { state: state as unknown as Prisma.JsonObject },
  });
}
```

### Reading QuoteState from Conversation
```typescript
async function getQuoteState(phone: string): Promise<QuoteState | null> {
  const conv = await prisma.conversation.findUnique({ where: { phone } });
  return isQuoteState(conv?.state) ? (conv!.state as unknown as QuoteState) : null;
}
```

### City Normalization Helper
```typescript
// src/services/quoteService.ts

const CITY_ALIASES: Record<string, string> = {
  'sp': 'São Paulo', 'sao paulo': 'São Paulo', 'são paulo': 'São Paulo',
  'rj': 'Rio de Janeiro', 'rio': 'Rio de Janeiro', 'rio de janeiro': 'Rio de Janeiro',
  'bh': 'Belo Horizonte', 'belo horizonte': 'Belo Horizonte',
  'cwb': 'Curitiba', 'curitiba': 'Curitiba',
  'poa': 'Porto Alegre', 'porto alegre': 'Porto Alegre',
};

const ALLOWED_CITIES = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Porto Alegre'];

function resolveCity(input: string): string | null {
  const normalized = input.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');  // remove accents
  return CITY_ALIASES[normalized] ?? null;
}
```

### Quote Message Formatter
```typescript
// src/services/quoteService.ts

function buildQuoteMessage(state: QuoteState, plan: HealthQuotePlan): string {
  const multiplier = state.planType === 'apartamento' ? plan.apartamentoMultiplier : 1;
  const total = (plan.baseMonthlyPrice * (state.lives ?? 1) * multiplier).toFixed(2);

  return [
    '🏥 *Plano de Saúde — Cotação*',
    '',
    `*Operadora:* ${plan.operator}`,
    `*Plano:* ${plan.planName}`,
    `*Acomodação:* ${state.planType === 'apartamento' ? 'Apartamento' : 'Enfermaria'}`,
    '',
    '✅ *Coberturas incluídas:*',
    ...plan.coverages.map(c => `- ${c}`),
    '',
    `⏳ *Carências:* ${plan.carencia}`,
    '',
    `💰 *Valor estimado:* R$ ${total}/mês`,
    `_(${state.lives} vida${(state.lives ?? 1) > 1 ? 's' : ''} | faixa ${state.ageRange} anos | ${state.city} | ${state.planType === 'apartamento' ? 'Apartamento' : 'Enfermaria'})_`,
    '',
    '---',
    'Quer cotar outro plano? Ou prefere falar com um consultor? Responda *1* para nova cotação ou *2* para falar com um especialista.',
  ].join('\n');
}
```

### Step Prompt Templates
```typescript
// src/services/quoteService.ts

const STEP_PROMPTS: Record<QuoteStep, string> = {
  lives:     '👋 Vamos fazer sua cotação de plano de saúde!\n\nPrimeiro: *quantas vidas* serão cobertas pelo plano? (ex: 1, 3, 10)',
  age_range: 'Ótimo! Agora me diz a *faixa etária* dos beneficiários. (ex: 20-30, 35-45, 50-60)',
  city:      `Perfeito! Em qual *cidade* o plano será utilizado?\n\nCidades disponíveis: São Paulo, Rio de Janeiro, Belo Horizonte, Curitiba, Porto Alegre`,
  plan_type: 'Quase lá! Qual *tipo de acomodação* você prefere?\n\n1️⃣ Enfermaria\n2️⃣ Apartamento',
  confirm:   '', // built dynamically with collected values
  done:      '', // final message built dynamically
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| External state machine library (XState) for every bot | Hand-rolled typed object for simple linear flows | Established best practice for lightweight bots | Zero dependency, fully serializable, simpler debugging |
| LLM generates every message including form prompts | LLM used only for extraction; prompts are templated | Industry shift ~2023-2024 | Faster responses, deterministic UX, lower token cost |
| Separate session table for flow state | JSONB column on existing conversation record | Enabled by PostgreSQL JSONB maturity | No extra join; schema stays minimal; Prisma handles it natively |

**Deprecated/outdated:**
- Storing conversation state in Redis only (without DB persistence): Loses state on pod restart; JSONB in Postgres is durable and already available.
- Using Structured Outputs / response_format JSON schema for field-by-field conversation management: Adds overhead for simple 4-field flow; targeted minimal prompts are more reliable and cheaper.

---

## Open Questions

1. **Interruption handling depth**
   - What we know: CONTEXT.md says "responde a dúvida e volta pra cotação" during mid-flow interruptions
   - What's unclear: Should an off-topic message during quote flow be passed to `generateResponse` (AI answers it) and then the next bot message brings broker back? Or should the bot refuse off-topic messages during quote flow?
   - Recommendation: Pass off-topic intent to AI for a brief answer, then immediately follow with the quote-resumption prompt in the same turn (two sequential `sendTextMessage` calls). This matches the CONTEXT.md intent.

2. **Age range format normalization**
   - What we know: Broker may say "25-35", "uns 30 anos", "maioria com 40", "entre 30 e 50"
   - What's unclear: What canonical format does the mock data require? Bands of 10 years? Exact input string?
   - Recommendation: Accept free-text; normalize to decade band (25-35, 35-45, etc.) with GPT extraction; store as string in QuoteState. Mock data should define price tiers for 3-4 age bands and clamp.

3. **Confirmation step behavior — partial correction**
   - What we know: Bot shows all 4 fields and asks "Correto?"
   - What's unclear: If broker says "a cidade está errada", does bot go back to city step only, or restart?
   - Recommendation: Go back to city step only (`currentStep = 'city'`, preserve other fields, reset `retryCount = 0`). This matches CONTEXT.md "sem perder dados já coletados".

---

## Sources

### Primary (HIGH confidence)
- [Prisma Docs — Working with Json fields](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields) — read/write patterns, type casting, partial update limitation
- [XState v5 — Persisting and Restoring State](https://stately.ai/blog/2023-10-02-persisting-state) — getPersistedSnapshot API, storage-agnostic serialization
- [OpenAI — Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs) — response_format, strict:true, gpt-4o-mini compatibility
- Codebase direct inspection (Phases 1-3) — existing service patterns, Prisma schema, webhook pipeline, conversation.ts, intent.ts

### Secondary (MEDIUM confidence)
- [Vonage — State Machines for WhatsApp Bots](https://developer.vonage.com/en/blog/state-machines-for-messaging-bots) — pattern: manual state storage per phone number, step dispatcher loop, state+domain table separation
- [prisma/prisma Discussion #3070](https://github.com/prisma/prisma/discussions/3070) — confirmed: `update` on Json field replaces entire object, not partial update
- [OpenAI Community — Structured Outputs reliability](https://community.openai.com/t/structured-outputs-not-reliable-with-gpt-4o-mini-and-gpt-4o/918735) — gpt-4o-mini less reliable than gpt-4o for structured outputs; use targeted prompts instead

### Tertiary (LOW confidence)
- [DEV Community — You don't need a library for state machines](https://dev.to/davidkpiano/you-don-t-need-a-library-for-state-machines-k7h) — supports hand-rolled approach for simple linear flows

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed; Prisma JSONB pattern verified against official docs
- Architecture: HIGH — hand-rolled state machine pattern verified against multiple sources; consistent with existing codebase patterns
- Pitfalls: HIGH for Pitfalls 1-4 (derived from codebase analysis + established patterns); MEDIUM for Pitfall 5-6 (derived from general chatbot patterns + reasoning)

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (stable stack — Prisma, OpenAI SDK, TypeScript all at pinned versions)
