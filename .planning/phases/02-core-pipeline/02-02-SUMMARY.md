---
phase: 02-core-pipeline
plan: "02"
subsystem: ai-pipeline
tags: [openai, history, intent, whatsapp, typing-indicator]
dependency_graph:
  requires: []
  provides: [history-service, intent-service, ai-service, whatsapp-typing]
  affects: [02-03-PLAN.md]
tech_stack:
  added: []
  patterns: [openai-sdk-v4, prisma-desc-reverse, keyword-intent-classifier, zapi-delay-typing]
key_files:
  created:
    - src/services/history.ts
    - src/services/intent.ts
    - src/services/ai.ts
  modified:
    - src/services/whatsapp.ts
decisions:
  - "desc+reverse pattern for LIMIT query preserves chronological order for LLM without subquery"
  - "HANDOFF_KEYWORDS checked before QUOTE_KEYWORDS to prevent /humano matching quote bucket"
  - "Intent label not exposed in system prompt (prevents routing internals leaking to broker)"
  - "axios timeout raised from 10_000 to 20_000ms to cover delayTyping duration in Z-API"
  - "computeDelaySeconds() converts config ms bounds to integer seconds required by Z-API API"
  - "try/catch in generateResponse ensures OpenAI errors return fallback instead of crashing pipeline"
metrics:
  duration: "82 seconds"
  completed_date: "2026-02-24"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
requirements_addressed: [CORE-03, CORE-05, UX-01]
---

# Phase 02 Plan 02: History, Intent, AI, and WhatsApp Typing Services Summary

**One-liner:** Keyword intent classifier + Prisma history retrieval + OpenAI Chat Completions with Portuguese system prompt + Z-API delayTyping parameter for humanized typing indicator.

## What Was Built

Four services that form the AI and messaging layer of the Phase 2 pipeline:

1. **`src/services/history.ts`** — Loads conversation history from the database (last N messages, oldest-first) and persists new messages. Uses `orderBy: desc` + `reverse()` for correct LIMIT pattern.

2. **`src/services/intent.ts`** — Zero-latency keyword classifier routing messages into 5 buckets: `handoff`, `quote`, `greeting`, `qa`, `unknown`. Handoff keywords are checked first to prevent false quote matches.

3. **`src/services/ai.ts`** — OpenAI Chat Completions integration using SDK v4. Builds a Portuguese system prompt using contact name and intent context (without leaking the raw intent label). Falls back to a safe error message on OpenAI failure.

4. **`src/services/whatsapp.ts`** — Extended with `delayTypingSeconds` parameter (default 2s) sent as `delayTyping` in the Z-API POST body. `computeDelaySeconds()` converts ms config bounds to random integer seconds. Axios timeout raised to 20_000ms.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create history and intent services | 9df4800 | src/services/history.ts, src/services/intent.ts |
| 2 | Create AI service and extend WhatsApp service | 66e746e | src/services/ai.ts, src/services/whatsapp.ts |

## Verification

- `npx tsc --noEmit` — zero errors across all 4 new/modified files
- `history.ts` — `orderBy: { createdAt: 'desc' }` + `reverse()` confirmed
- `intent.ts` — HANDOFF_KEYWORDS position confirmed before QUOTE_KEYWORDS
- `ai.ts` — `role: m.role as 'user' | 'assistant'` cast on history messages confirmed
- `whatsapp.ts` — `timeout: 20_000` confirmed (was 10_000)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files exist:
- FOUND: src/services/history.ts
- FOUND: src/services/intent.ts
- FOUND: src/services/ai.ts
- FOUND: src/services/whatsapp.ts

Commits exist:
- FOUND: 9df4800 (Task 1)
- FOUND: 66e746e (Task 2)
