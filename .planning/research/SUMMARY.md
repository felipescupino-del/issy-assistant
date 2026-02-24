# Project Research Summary

**Project:** Issy Assistant — WhatsApp AI Chatbot for Insurance Brokers
**Domain:** B2B conversational AI, WhatsApp automation, insurance tech
**Researched:** 2026-02-24
**Confidence:** MEDIUM-HIGH

## Executive Summary

Issy is a broker-facing (B2B) WhatsApp assistant, not a consumer chatbot. This distinction drives every architectural and feature decision. Brokers are professional users with high expectations for speed and accuracy; they need a productivity tool that helps them answer client questions faster and run guided quote flows on behalf of clients — not a general-purpose AI assistant. The recommended approach is a TypeScript/Express webhook server with PostgreSQL as the durable state store, OpenAI GPT-4o-mini for conversational AI, and a clean service-layer pipeline that sequences: parse message, identify contact, detect intent, route to Q&A/quote/handoff, and send response. The existing codebase already implements this pattern correctly and provides a strong foundation.

The critical implementation discipline is to treat the webhook handler as an orchestrator only — respond HTTP 200 immediately, then process asynchronously. Every downstream service must be independently testable with a single responsibility. Conversation state (current quote flow step, handoff status) must live in PostgreSQL from day one, never in-process memory. Intent detection starts as keyword-based (fast, zero-cost), with a clean interface so the internals can be swapped to GPT-based classification when keyword matching becomes a bottleneck.

The top three risks to manage from the start: (1) bot and human agent responding simultaneously after handoff — requires an atomic handoff gate checked before any GPT call is made; (2) Meta policy enforcement against general-purpose assistants — requires the system prompt to be scoped strictly to business intents with explicit refusal of off-topic requests; (3) AI hallucination of insurance coverage details — requires explicit uncertainty instructions and a curated "known facts" layer for the 3-5 demo products. The Evolution API phone number ban risk must also be addressed in infrastructure setup before any testing with real broker numbers.

## Key Findings

### Recommended Stack

The stack is TypeScript 5.x on Node.js 22 LTS, Express 5.x as the HTTP server, PostgreSQL 16 as the primary data store (with JSONB for flexible metadata), and the official OpenAI SDK v6 with GPT-4o-mini. Prisma 7.x is recommended for schema management and auto-generated TypeScript types — its migration tooling (`prisma migrate dev`) is the strongest in the TypeScript ORM space for a long-running Express server. Pino replaces `console.log` for structured JSON logging. BullMQ + Redis handles message queuing to decouple webhook acknowledgment from OpenAI processing. Zod validates all webhook payloads and defines function-calling tool schemas passed to OpenAI.

See `.planning/research/STACK.md` for full version table, installation commands, and alternatives considered.

**Core technologies:**
- TypeScript 5.x + Node.js 22 LTS: type safety for webhook payload parsing, LTS stability for a long-running server
- Express 5.2.1: proven webhook receiver; immediate ack pattern is well-supported with fire-and-forget async
- PostgreSQL 16: durable state store; JSONB columns absorb OpenAI message format changes without schema migrations
- Prisma 7.4.1: schema-first ORM with auto-generated types; migration history committed with code
- OpenAI SDK 6.23.0 + GPT-4o-mini: Chat Completions with function calling and `strict: true` for deterministic intent routing
- BullMQ 5.x + ioredis 5.x: durable message queue; decouples the 200ms webhook ack from the 3-15s OpenAI call
- Zod 4.x: validates incoming webhook payloads; defines OpenAI tool schemas
- Pino 10.x: structured JSON logging; queryable in production

### Expected Features

Features are divided into three tiers based on broker workflow needs. The dependency chain is fixed: contact identification must come first, intent detection gates all downstream features, and conversation history must be persisted from message one. The guided quote flow for auto insurance is the most complex single feature and should be built after Q&A is stable.

See `.planning/research/FEATURES.md` for the full prioritization matrix, dependency graph, and anti-feature list.

**Must have (table stakes for demo):**
- Contact identification — phone number as key, broker name captured on first message
- Intent detection — classify: Q&A, quote flow, human handoff, general conversation
- Insurance Q&A — general knowledge on products, coverages, acceptance rules; GPT-4o-mini with scoped system prompt
- Guided quote flow (auto) — field collection, per-field validation, mocked price with coverage summary
- Human handoff with structured context packet — same WhatsApp thread, synthesized briefing to agent
- Conversation history — per-conversation rolling window in DB sent to LLM as context
- Admin controls — /bot, /status commands from designated admin phone numbers only
- Natural response timing — typing indicator + 1-3s randomized delay
- Graceful fallback — explicit "I don't know" path with offer to escalate

**Should have (add post-demo validation):**
- Partial quote save and resume — 24h TTL on in-progress flows
- Multi-product quote flows — life, home, business after auto is validated
- Insurance-type auto-detection from free text — reduces quote flow turns
- Per-field validation with correction prompts — reduces junk data entering the system

**Defer (v2+):**
- Document ingestion (PDF policy conditions) — chunking + retrieval pipeline adds 2-3x complexity
- Voice message support — Whisper transcription adds latency and cost per message
- Real insurer API integration (Quiver, Agger, Segfy) — credentials and schemas vary per assessoria
- WhatsApp interactive messages (buttons, lists) — requires template pre-approval
- Analytics dashboard — operational visibility once product is in use

### Architecture Approach

The architecture is a clean service-layer pipeline inside a single Express process. The webhook route acts as a thin orchestrator only: acknowledge immediately, then call services in sequence. Each service owns exactly one concern and is independently testable. All state lives in PostgreSQL; Redis is used only as a fast read cache for hot-path lookups. The existing codebase at `src/` already implements this structure correctly and must be maintained.

See `.planning/research/ARCHITECTURE.md` for the full system diagram, data flow, component responsibility table, and anti-pattern explanations.

**Major components:**
1. Webhook Route — acks HTTP 200 immediately, fires `processMessage()` async
2. Parser Service — normalizes Evolution API / Meta Cloud API payloads into a unified `ParsedMessage` struct
3. Contact Service — upserts contact record, owns human/bot mode flag, enriches message with contact context
4. Intent Service — keyword-based classification (v1); clean interface for future GPT-based swap
5. FAQ Service — static lookup, falls back to AI Service if no match
6. Quote Service — per-product field collection prompts; slot for real pricing engine
7. AI Service — assembles `messages[]` array with system prompt + rolling history window, calls OpenAI
8. History Service — loads last 20 turns from DB; persists each user/assistant exchange
9. WhatsApp Service — provider-agnostic send abstraction (Evolution or Meta); computes humanization delay
10. Admin Route — processes /bot and /status commands, validates sender against admin allowlist

### Critical Pitfalls

1. **Bot and human respond simultaneously after handoff** — check `handoff_active` in PostgreSQL before any GPT call is made; never after. This is an atomic gate, not an optimistic check. Must be correct from day one.
2. **Meta policy violation: general-purpose assistant classification** — scope the system prompt strictly to business intents; add explicit refusal for off-topic requests. 80-90% of conversations must map to defined business workflows per Meta enforcement guidelines.
3. **AI hallucinating insurance coverage details** — include explicit uncertainty instructions; build a curated "known facts" layer (small JSON/DB of actual rules for demo products) injected into context; never let the bot state specific R$ values or acceptance rules without hedging.
4. **Evolution API phone number ban** — never use the production number for dev testing; rate-limit outbound messages to 1 per 3-5 seconds per conversation; add typing indicators (signals human-like behavior to Meta detection).
5. **Conversation state lost on crash/restart** — all flow state (current step, collected data, handoff status) must live in PostgreSQL JSONB columns from day one; treat every request as a potential cold start.

## Implications for Roadmap

Based on the dependency chain in FEATURES.md and the build order in ARCHITECTURE.md, a 5-phase structure is recommended. Each phase builds on the previous, and the pitfall-to-phase mapping from PITFALLS.md is incorporated directly.

### Phase 0: Infrastructure and Environment Setup
**Rationale:** Infrastructure must be correct before any code is written. The most catastrophic and unrecoverable pitfall (Evolution API phone number ban) is an infrastructure failure. Separating dev and prod numbers, setting up the PostgreSQL schema with full conversation state columns, and configuring the webhook tunnel are prerequisites for all subsequent work.
**Delivers:** Running Express server with health check, PostgreSQL with full schema (contacts, conversations, messages, conversation_state tables with JSONB), Evolution API instance with dev phone number, ngrok/smee webhook tunnel, environment variable validation, Prisma migrations committed.
**Addresses:** Phone number ban risk; conversation state durability; missing deduplication guard (message_id column in schema).
**Avoids:** Production number ban (dev/prod separation); in-memory state (PostgreSQL schema from day one); missing connection pool (pg configuration).
**Research flag:** Low — standard infrastructure setup; no deeper research needed.

### Phase 1: Core Message Pipeline and Conversation State
**Rationale:** The pipeline architecture (webhook ack, parser, contact, intent, human mode gate, AI, history, WhatsApp send) is the backbone. Everything else is layered on top. The handoff race condition is the most critical bug and must be solved here — retrofitting it later requires touching every message-handling path.
**Delivers:** End-to-end message flow working: broker sends message on WhatsApp, bot responds. Includes: immediate 200 ack, parser service, contact upsert, human mode gate (atomic PostgreSQL check before GPT call), keyword-based intent detection, conversation history (load + save), AI service with scoped system prompt, WhatsApp send with humanization delay. All conversation state in PostgreSQL.
**Addresses:** P1 features: contact identification, intent detection, conversation history, natural response timing, graceful fallback. Human handoff gate (atomic check before GPT).
**Avoids:** Business logic in routes (routes stay as orchestrators only); blocking webhook response; in-process state storage; handoff race condition.
**Stack used:** Express, Prisma, PostgreSQL, OpenAI SDK, pino, Zod webhook validation.
**Research flag:** Low — well-documented patterns; existing codebase provides strong reference.

### Phase 2: Insurance Q&A and Human Handoff
**Rationale:** With the pipeline stable, the two highest-value user-facing features can be built: insurance Q&A (the core value proposition) and human handoff with a structured context packet (the trust-building mechanism). These share the same pipeline path and can be built together. The system prompt must be scoped here — Meta policy compliance is a Phase 2 gate.
**Delivers:** GPT-4o-mini with insurance-scoped system prompt answering product, coverage, and acceptance rule questions in Portuguese; "known facts" layer (curated JSON/DB for 3-5 demo products) injected into context to prevent hallucination; human handoff that sets mode flag, sends structured briefing to team, and confirms to broker in same thread; admin controls (/bot, /status) with phone number allowlist validation.
**Addresses:** P1 features: insurance Q&A, human handoff with structured context packet, admin controls, graceful fallback. Meta policy compliance (system prompt scoping). AI hallucination prevention (known facts layer + uncertainty instructions).
**Avoids:** General-purpose assistant classification; hallucinated coverage details; admin command spoofing.
**Research flag:** Medium — system prompt engineering for insurance domain needs validation against actual broker questions; known facts layer content needs input from assessoria.

### Phase 3: Guided Quote Flow (Auto)
**Rationale:** The quote flow is the most complex single feature (internal state, per-product branching, field validation, price return). It is built after Q&A is stable because it depends on the intent detection and conversation history infrastructure. Auto insurance is highest volume for the target assessoria and is the demo centerpiece.
**Delivers:** Multi-turn auto quote flow: detect auto quote intent from free text, collect fields (plate, model, year, driver age) one per message, validate each field with correction prompts, return mocked price with coverage summary (stored in config file, not system prompt). Quote state persisted to PostgreSQL JSONB for crash recovery.
**Addresses:** P1 feature: guided quote flow (auto). P2 features: per-field validation, insurance-type auto-detection from free text, clear quote summary with coverage breakdown.
**Avoids:** Flow state in memory; mocked prices embedded in system prompt string; junk data flowing through without validation.
**Research flag:** Low — quote flow is a well-understood form-collection pattern; mock price structure is internal design decision.

### Phase 4: Polish and Demo Preparation
**Rationale:** Before presenting to a real assessoria with 50+ brokers, the rough edges that destroy trust must be eliminated. This phase targets the "looks done but isn't" checklist from PITFALLS.md and adds the BullMQ message queue to handle concurrent broker messages safely.
**Delivers:** BullMQ + Redis message queue (decouples webhook ack from OpenAI call, handles retries, prevents out-of-order responses for fast typists); message deduplication via message_id in database; webhook signature validation (Evolution API secret); rate limiting on webhook endpoint; randomized humanization delay (base + random 0-2s, proportional to message length); OpenAI error fallback message; rolling window cap on conversation history (last 20 messages); LGPD data retention policy documented.
**Addresses:** Reliability and security hardening. Concurrent messages arriving out of order. Webhook retry causing duplicate processing. Admin command spoofing. GPT timeout silence.
**Avoids:** Performance traps at 50-broker scale; security holes; UX pitfalls in demo.
**Research flag:** Low — BullMQ and Redis patterns are well-documented in STACK.md.

### Phase 5: v1.x Expansion (Post-Demo Validation)
**Rationale:** Only after the demo converts to a production agreement. Features in this phase require broker feedback to validate they are actually needed. Building them speculatively delays the demo and risks solving the wrong problems.
**Delivers:** Partial quote save and resume (24h TTL); multi-product quote flows (life, home, business); voice message transcription (Whisper); expanded known-facts layer based on real broker feedback.
**Addresses:** P2 features from FEATURES.md.
**Research flag:** High — each expansion requires dedicated research (Whisper integration, life/home quote field schemas, real insurer data model alignment).

### Phase Ordering Rationale

- Infrastructure before code because the phone number ban is permanent and cannot be recovered from.
- Pipeline before features because intent detection and conversation history are dependencies of every user-facing feature.
- Q&A before quote flow because the quote flow depends on stable intent detection and the AI service, and because Q&A is simpler to validate.
- Polish before demo because a demo with race conditions and duplicate messages destroys credibility faster than missing features.
- v1.x expansion after validation because broker feedback is required to prioritize correctly.

### Research Flags

Phases needing deeper research during planning:
- **Phase 2 (System Prompt and Known Facts):** Insurance domain knowledge must be validated against actual broker questions from the target assessoria. The "known facts" JSON structure needs to be designed with the assessoria's actual product portfolio, not generic insurance knowledge.
- **Phase 5 (v1.x Expansion):** Each expansion topic (voice, multi-product schemas, real insurer integration) is a mini-research effort on its own.

Phases with standard patterns (skip research-phase):
- **Phase 0 (Infrastructure):** PostgreSQL + Prisma + Express + Evolution API setup follows documented patterns.
- **Phase 1 (Core Pipeline):** Existing codebase already implements this architecture; extend, do not replace.
- **Phase 3 (Quote Flow):** Form collection pattern is well-understood; field schemas for auto insurance are deterministic.
- **Phase 4 (Polish):** BullMQ, deduplication, and rate limiting are documented standard patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core versions verified via npm registry directly. Evolution API integration patterns corroborated by official docs and GitHub issues. OpenAI SDK via official GitHub. |
| Features | MEDIUM | B2B broker tool is less documented than B2C insurance chatbots. Core feature set inferred from adjacent domain research. Feature priorities need validation with actual brokers at the target assessoria. |
| Architecture | HIGH | Findings triangulated across external research, Evolution API docs, and existing codebase inspection. Existing code is ground truth — architecture research confirmed what is already built. |
| Pitfalls | MEDIUM-HIGH | Critical pitfalls (handoff race condition, phone number ban, Meta policy) are corroborated by multiple sources including GitHub issues on the Evolution API repo. LGPD compliance analysis from authoritative legal source. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Known facts layer content:** Research can identify the architecture; only the assessoria can provide the actual product-specific coverage rules, acceptance criteria, and price ranges for the demo. This must be collected as a prerequisite for Phase 2.
- **Evolution API webhook secret validation:** The documentation was partially inaccessible (403 on direct fetch). Implementation should be verified against the Evolution API source code or community examples rather than solely from documentation.
- **Meta policy 80/90% business-intent threshold:** The enforcement guideline percentage was cited by a secondary source (respond.io), not directly from Meta's platform policy documentation. The system prompt scoping principle is sound regardless of the exact threshold.
- **OpenAI rate limits at 50-broker scale:** GPT-4o-mini rate limits are tier-dependent. The actual tier for this project's API key is unknown. Per-user rate limiting and OpenAI billing alerts should be set up in Phase 4 before real broker usage.

## Sources

### Primary (HIGH confidence)
- npm registry (direct package queries) — all version numbers in STACK.md
- Evolution API GitHub (official repo) — issues #2228 (ban risk), #2326 (@lid identifier bug)
- OpenAI Node.js SDK GitHub — Chat Completions API, function calling
- Evolution API DeepWiki — architecture and webhook format
- WhatsApp Webhooks Guide (Hookdeck) — Meta API webhook behavior
- State Machines for Messaging Bots (Vonage) — human mode gate pattern
- Existing codebase at `src/` — architecture ground truth
- Covington & Burling — Brazil LGPD legal analysis

### Secondary (MEDIUM confidence)
- Botpress, MasterOfCode, Kaily, Beeia, InsureBuddy — B2C insurance chatbot feature landscape
- ChatArchitect — WhatsApp webhook architecture patterns
- SpurNow — chatbot-to-human handoff best practices
- respond.io — WhatsApp 2026 AI policy enforcement
- BetterStack — Drizzle vs Prisma comparison
- WATI — WhatsApp API rate limits
- SpurNow, ConnVerz — human handoff patterns

### Tertiary (LOW confidence)
- BrightCoding blog — Evolution API event streaming options (RabbitMQ, Kafka, SQS) — not relevant for v1 scale

---
*Research completed: 2026-02-24*
*Ready for roadmap: yes*
