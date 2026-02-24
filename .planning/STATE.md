# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** Liberar o corretor de seguros da operação repetitiva para que ele gaste mais tempo vendendo
**Current focus:** Phase 3 — Insurance Q&A and Handoff

## Current Position

Phase: 3 of 5 (Insurance Q&A and Handoff) — IN PROGRESS
Plan: 1 of 2 in current phase
Status: Phase 3 plan 01 complete. Insurance knowledge layer wired. Plan 02 (handoff logic) next.
Last activity: 2026-02-24 — Phase 3 plan 01 executed (insurance facts + product detection)

Progress: [████░░░░░░] 45%

## Resume Instructions

Phase 3 plan 01 complete. Continue with:
```
/gsd:execute-phase 3
```
This will execute phase 3 plan 02 (handoff and human takeover logic).

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

## What's Pending (Before Phase 1 is "complete")

1. User creates Supabase project → copies DATABASE_URL and DIRECT_URL to .env
2. User creates Z-API instance → copies ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN, ZAPI_CLIENT_TOKEN to .env
3. Run `npx prisma migrate dev --name init` to create tables in Supabase
4. Run `npm run dev` to verify server starts and connects to DB
5. Configure Z-API webhook URL → verify real WhatsApp message reaches endpoint

## Resume Instructions

Phase 2 plan 01 complete. Continue with next plan in Phase 2.

## Performance Metrics

**Velocity:**
- Total plans completed: 7 (Phase 1: 3, Phase 2: 3, Phase 3: 1)
- Average duration: ~8-10 min
- Total execution time: —

**By Phase:**

| Phase | Plans | Status |
|-------|-------|--------|
| 1. Infrastructure | 3/3 | Code complete (pending credentials) |
| 2. Core Pipeline | 3/3 | Code complete |
| 3. Insurance Q&A and Handoff | 1/2 | In progress |
| 4. Quote Flow (Health Insurance) | 0/TBD | Not started |
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

### Blockers/Concerns

- [Phase 1]: Supabase + Z-API credentials needed before migration and live testing

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed 03-01-PLAN.md — insurance knowledge layer wired, 2/2 tasks done
Resume file: .planning/phases/03-insurance-qa-handoff/03-01-SUMMARY.md
