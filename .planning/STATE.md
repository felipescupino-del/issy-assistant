# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** Liberar o corretor de seguros da operação repetitiva para que ele gaste mais tempo vendendo
**Current focus:** Phase 2 execution — Core Pipeline

## Current Position

Phase: 2 of 5 (Core Pipeline) — IN PROGRESS
Plan: 1 of TBD in current phase
Status: Phase 2 plan 01 complete. Contact + conversation services written.
Last activity: 2026-02-24 — 02-01 executed (contact/conversation persistence services)

Progress: [███░░░░░░░] 24%

## What's Done (Phase 1)

- Plan 01-01: Prisma installed, config rewritten for Z-API, types defined, .env.example ready
- Plan 01-02: Prisma schema with Contact, Conversation, Message models — validated + client generated
- Plan 01-03: Express server rewritten with Prisma + Z-API webhook handler + whatsapp send service

## What's Done (Phase 2)

- Plan 02-01: ConversationContext type, upsertContact/isFirstMessage, getOrCreateConversation/isHumanMode services

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
- Total plans completed: 4 (Phase 1: 3, Phase 2: 1)
- Average duration: ~10 min (02-01)
- Total execution time: —

**By Phase:**

| Phase | Plans | Status |
|-------|-------|--------|
| 1. Infrastructure | 3/3 | Code complete (pending credentials) |
| 2. Core Pipeline | 1/TBD | In progress |
| 3. Insurance Q&A and Handoff | 0/TBD | Not started |
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

### Blockers/Concerns

- [Phase 1]: Supabase + Z-API credentials needed before migration and live testing
- [Phase 3]: Known facts layer content needs assessoria input to prevent hallucination

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed 02-01-PLAN.md — contact and conversation persistence services
Resume file: .planning/phases/02-core-pipeline/02-01-SUMMARY.md
