---
phase: 02-core-pipeline
plan: "03"
subsystem: webhook-pipeline
tags: [webhook, pipeline, integration, CORE-01]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [end-to-end message pipeline]
  affects: [src/routes/webhook.ts]
tech_stack:
  added: []
  patterns: [fire-and-forget async, human-mode gate, load-before-save history pattern]
key_files:
  modified:
    - src/routes/webhook.ts
decisions:
  - "loadHistory called BEFORE saveMessage(user) to prevent current message appearing twice in LLM context"
  - "saveMessage(assistant) called AFTER sendTextMessage to prevent phantom assistant messages on send failure"
  - "Non-text guard (!parsed.text) at top prevents classifyIntent(null) throw on image/audio messages"
metrics:
  duration: "~5 min"
  completed: "2026-02-24"
  tasks_completed: 1
  tasks_deferred: 1
  files_modified: 1
---

# Phase 2 Plan 03: Webhook Pipeline Wiring Summary

One-liner: Full end-to-end pipeline wired in processMessage() — contact upsert, human-mode gate, intent classify, history load/save, AI response, typed WhatsApp send (CORE-01 satisfied in code).

## What Was Built

`src/routes/webhook.ts` rewritten with 8-step pipeline orchestrating all Phase 2 services:

1. `parseZApiPayload` + non-text guard
2. `upsertContact` + `isFirstMessage`
3. `isHumanMode` gate (exits early if human agent active)
4. `classifyIntent`
5. `loadHistory` (before saving user message)
6. `saveMessage(user)`
7. `generateResponse` with name, history, text, intent
8. `sendTextMessage` with `computeDelaySeconds()`
9. `saveMessage(assistant)` after send succeeds

## Deviations from Plan

None — plan executed exactly as written.

## Task 2: Deferred (Human Verify)

Task 2 is a `checkpoint:human-verify` gate requiring live credentials (Supabase, Z-API, OpenAI) and a real WhatsApp device. Deferred until user sets up credentials and runs `npx prisma migrate dev --name init`.

Manual verification steps when ready:
- Send "Oi, tudo bem?" → expect Portuguese greeting with broker name, ~2-3s delay
- Send follow-up → expect history-aware response (`firstMsg=false` in logs)
- Send unknown query → expect "Não tenho essa informação" fallback
- Check Supabase tables: `contatos`, `conversas`, `mensagens` all populated

## Self-Check

- [x] `src/routes/webhook.ts` modified (45 insertions)
- [x] `npx tsc --noEmit --skipLibCheck` passes with zero errors
- [x] Commit `6e65677` exists

## Self-Check: PASSED

## Notes for Phase 3

- `buildSystemPrompt` in `ai.ts` will grow significantly in Phase 3 (insurance Q&A knowledge layer)
- `classifyIntent` returns `'handoff'` but webhook currently only logs it — Phase 3 adds `setHumanMode(true)` on handoff intent
- History limit is controlled by `HISTORY_LIMIT` env var (default 20) — may need tuning
