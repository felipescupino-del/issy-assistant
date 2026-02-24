# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** Liberar o corretor de seguros da operação repetitiva para que ele gaste mais tempo vendendo
**Current focus:** Phase 4 complete — Quote flow fully wired. Phase 5 (Polish and Demo Hardening) next.

## Current Position

Phase: 4 of 5 (Quote Flow — Health Insurance) — COMPLETE
Plan: 2 of 2 in current phase — COMPLETE
Status: Phase 4 complete. Quote flow state machine (Plan 01) and webhook wiring (Plan 02) both done. Phase 5 next.
Last activity: 2026-02-24 — Phase 4 plan 02 executed (webhook quote branch, ai.ts prompt update)

Progress: [████████░░] 75%

## Resume Instructions

Phase 4 complete. Start Phase 5:
```
/gsd:execute-phase 5
```
This will execute Phase 5 (Polish and Demo Hardening).

## What's Done (Phase 1)

- Plan 01-01: Prisma installed, config rewritten for Z-API, types defined, .env.example ready
- Plan 01-02: Prisma schema with Contact, Conversation, Message models — validated + client generated
- Plan 01-03: Express server rewritten with Prisma + Z-API webhook handler + whatsapp send service

## What's Done (Phase 2)

- Plan 02-01: ConversationContext type, upsertContact/isFirstMessage, getOrCreateConversation/isHumanMode services
- Plan 02-02: history/intent/ai/whatsapp services — loadHistory, saveMessage, classifyIntent, generateResponse, sendTextMessage
- Plan 02-03: webhook.ts pipeline wired — 8-step processMessage() connecting all Phase 2 services (CORE-01 code-complete)

## What's Done (Phase 3)

- Plan 03-01: Insurance facts layer — 5 product types with curated facts, detectProductType, dynamic system prompt injection (KNOW-01 through KNOW-04)
- Plan 03-02: Human handoff and admin commands — setHumanMode, handoff service (buildHandoffBriefing + executeHandoff), admin service (isAdminPhone, isAdminCommand, handleAdminCommand), webhook pipeline rewired (HAND-01, HAND-02, HAND-03)

## What's Done (Phase 4)

- Plan 04-01: QuoteState/QuoteStep types, HealthQuotePlan mock data, complete quoteService.ts state machine (handleQuoteMessage, getQuoteState, 4 step handlers, GPT extraction, retry logic, quote output builder)
- Plan 04-02: Quote branch wired into webhook processMessage Steps 6-7 (active session priority routing + new quote intent handling + save-before-process + short-circuit return). ai.ts quote prompt updated (no more "em breve"). Phase 4 code-complete.

## What's Pending (Before Phase 1 is "complete")

1. User creates Supabase project → copies DATABASE_URL and DIRECT_URL to .env
2. User creates Z-API instance → copies ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN, ZAPI_CLIENT_TOKEN to .env
3. Run `npx prisma migrate dev --name init` to create tables in Supabase
4. Run `npm run dev` to verify server starts and connects to DB
5. Configure Z-API webhook URL → verify real WhatsApp message reaches endpoint

## Performance Metrics

**Velocity:**
- Total plans completed: 10 (Phase 1: 3, Phase 2: 3, Phase 3: 2, Phase 4: 2)
- Average duration: ~8 min
- Total execution time: —

**By Phase:**

| Phase | Plans | Status |
|-------|-------|--------|
| 1. Infrastructure | 3/3 | Code complete (pending credentials) |
| 2. Core Pipeline | 3/3 | Code complete |
| 3. Insurance Q&A and Handoff | 2/2 | Code complete |
| 4. Quote Flow (Health Insurance) | 2/2 | Code complete |
| 5. Polish and Demo Hardening | 0/TBD | Not started |

## Accumulated Context

### Decisions

- [Init]: Começar código limpo — arquitetura certa desde o início
- [Init]: Preços mockados para demo
- [Init]: Conhecimento geral sobre seguros sem PDFs
- [Phase 1]: Z-API como provedor único (não Evolution API)
- [Phase 1]: Supabase para PostgreSQL (cloud, free tier)
- [Phase 1]: Prisma 7 com prisma-client generator
- [Phase 1]: Quote state como JSONB na tabela conversas (não tabela separada)
- [Phase 1]: cloudflared como tunnel de dev (não ngrok)
- [Phase 1]: Código inglês, banco português
- [Init]: Quote flow v1 foca em saúde (QUOT-01) — não auto
- [02-01]: isFirstMessage usa comparação numérica getTime() (<1000ms), não === (evita bug de referência Date)
- [02-01]: getOrCreateConversation usa update:{} (no-op) para preservar humanMode e estado da cotação
- [Phase 02-core-pipeline]: desc+reverse LIMIT pattern for chronological LLM history without subquery
- [Phase 02-core-pipeline]: HANDOFF_KEYWORDS before QUOTE_KEYWORDS to prevent false intent routing
- [Phase 02-core-pipeline]: axios timeout 20_000ms for Z-API delayTyping (was 10_000, caused ETIMEDOUT)
- [02-03]: loadHistory before saveMessage(user) prevents current message doubling in LLM context
- [02-03]: saveMessage(assistant) after sendTextMessage prevents phantom messages on send failure
- [03-01]: Colocate detectProductType in insuranceFacts.ts — knowledge layer is self-contained
- [03-01]: No hardcoded R$ values — all financial references use [ASSESSORIA] marker
- [03-01]: empresarial keywords checked before auto to prevent substring collision
- [03-01]: productType: ProductType | null = null default keeps generateResponse backwards-compatible
- [03-02]: classifyIntent BEFORE admin check so /humano routes to handoff branch (not silently dropped)
- [03-02]: Admin check BEFORE getOrCreateConversation to prevent /bot deadlock when humanMode=true
- [03-02]: buildHandoffBriefing is pure (no DB, no GPT) — deterministic and independently testable
- [03-02]: executeHandoff sends briefing BEFORE setHumanMode(true) — bot speaks last words before going silent
- [03-02]: isAdminCommand returns false for /humano — handoff must flow through intent pipeline
- [04-01]: GPT as slow-path fallback after regex fast-path for lives and age_range extraction
- [04-01]: resolveCity and resolvePlanType are pure (no GPT) — alias map sufficient for fixed city set
- [04-01]: handleConfirmStep preserves collected data on field-specific correction (no full restart)
- [04-01]: Prisma JSONB cast via Prisma.InputJsonObject from generated/prisma/client
- [Phase 04-02]: Active QuoteState check (collecting/confirming) precedes intent check — mid-flow messages without quote keywords correctly route to quote branch
- [Phase 04-02]: New quote intent always passes null state to handleQuoteMessage — forces fresh session (CONTEXT: nova cotacao substitui a anterior)
- [Phase 04-02]: saveMessage(user) inside quote branch before handleQuoteMessage — maintains save-before-process invariant on short-circuit path

### Blockers/Concerns

- [Phase 1]: Supabase + Z-API credentials needed before migration and live testing

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed 04-02-PLAN.md — webhook quote branch wired, ai.ts prompt updated, Phase 4 code-complete, 1/1 tasks done
Resume file: .planning/phases/04-quote-flow-health-insurance/04-02-SUMMARY.md
