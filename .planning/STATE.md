# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** Liberar o corretor de seguros da operação repetitiva para que ele gaste mais tempo vendendo
**Current focus:** Phase 1 → Phase 2 transition

## Current Position

Phase: 1 of 5 (Infrastructure) — CODE COMPLETE
Plan: 3 of 3 in current phase
Status: Phase 1 code written. Pending: Supabase credentials + Z-API setup + migration.
Last activity: 2026-02-24 — All 3 plans executed (code only, no credentials yet)

Progress: [██░░░░░░░░] 20%

## What's Done (Phase 1)

- Plan 01-01: Prisma installed, config rewritten for Z-API, types defined, .env.example ready
- Plan 01-02: Prisma schema with Contact, Conversation, Message models — validated + client generated
- Plan 01-03: Express server rewritten with Prisma + Z-API webhook handler + whatsapp send service

## What's Pending (Before Phase 1 is "complete")

1. User creates Supabase project → copies DATABASE_URL and DIRECT_URL to .env
2. User creates Z-API instance → copies ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN, ZAPI_CLIENT_TOKEN to .env
3. Run `npx prisma migrate dev --name init` to create tables in Supabase
4. Run `npm run dev` to verify server starts and connects to DB
5. Configure Z-API webhook URL → verify real WhatsApp message reaches endpoint

## Resume Instructions

Phase 1 code is complete. To finish Phase 1:
1. Create .env with real credentials (copy from .env.example)
2. Run: `npx prisma migrate dev --name init`
3. Run: `npm run dev`
4. Test webhook with real WhatsApp message

Then proceed: `/gsd:plan-phase 2` or `/gsd:execute-phase 2`

## Performance Metrics

**Velocity:**
- Total plans completed: 3 (Phase 1)
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Status |
|-------|-------|--------|
| 1. Infrastructure | 3/3 | Code complete (pending credentials) |
| 2. Core Pipeline | 0/TBD | Not started |
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

### Blockers/Concerns

- [Phase 1]: Supabase + Z-API credentials needed before migration and live testing
- [Phase 3]: Known facts layer content needs assessoria input to prevent hallucination

## Session Continuity

Last session: 2026-02-24
Stopped at: Phase 1 code complete — waiting for user credentials
Resume file: .planning/phases/01-infrastructure/01-CONTEXT.md
