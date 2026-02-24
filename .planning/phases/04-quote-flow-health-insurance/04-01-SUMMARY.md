---
phase: 04-quote-flow-health-insurance
plan: "01"
subsystem: quote-flow
tags: [quote, state-machine, health-insurance, types, mock-data]
dependency_graph:
  requires: [03-02-SUMMARY]
  provides: [QuoteState types, HealthQuotePlan mock data, handleQuoteMessage entry point, getQuoteState reader]
  affects: [src/services/quoteService.ts, src/types/index.ts, src/data/healthQuoteMock.ts]
tech_stack:
  added: []
  patterns: [JSONB-state-machine, GPT-value-extraction, WhatsApp-formatting, escalating-retry]
key_files:
  created:
    - src/data/healthQuoteMock.ts
    - src/services/quoteService.ts
  modified:
    - src/types/index.ts
decisions:
  - GPT extraction as slow-path fallback after regex fast-path for lives and age_range
  - resolveCity and resolvePlanType are pure (no GPT) — alias map sufficient
  - handleConfirmStep preserves collected data on field-specific correction (no full restart)
  - Prisma cast via Prisma.InputJsonObject from generated/prisma/client for JSONB write
metrics:
  duration: "~2min"
  completed: "2026-02-24"
  tasks_completed: 2
  files_changed: 3
---

# Phase 4 Plan 01: Quote Flow Types, Mock Data, and State Machine

One-liner: Hand-rolled JSONB-persisted quote state machine with GPT-assisted extraction, city alias resolution, escalating retry, and WhatsApp-formatted quote output using Saude Segura / Essencial Plus mock data.

## What Was Built

### Task 1: QuoteState types + HealthQuotePlan mock data
- Extended `src/types/index.ts` with `QuoteStep` type and `QuoteState` interface (status, currentStep, retryCount, 4 nullable collected fields, timestamps)
- Created `src/data/healthQuoteMock.ts` with `HealthQuotePlan` interface and `HEALTH_PLAN` constant (Saude Segura / Essencial Plus, 6 coverages, carencia by category, age multipliers for 10 bands, base price R$280)
- Exported `ALLOWED_CITIES` as `['Sao Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Porto Alegre']`

### Task 2: Complete quoteService.ts state machine
- `handleQuoteMessage(phone, text, existingState)` — main exported entry point; starts fresh on null/complete/abandoned, dispatches by currentStep
- `getQuoteState(phone)` — exported state reader; reads Conversation.state JSONB, returns null if not a valid QuoteState
- `isQuoteState(value)` — exported type guard
- `createFreshQuoteState()` and `persistQuoteState()` — internal state lifecycle helpers
- **4 step handlers:** `handleLivesStep`, `handleAgeRangeStep`, `handleCityStep`, `handlePlanTypeStep` — each extracts value, advances step on success, increments retryCount + sends escalating message on failure
- **Extraction functions:** `extractLivesCount` (regex fast-path + GPT slow-path), `extractAgeRange` (4 pattern variants + GPT slow-path), `resolveCity` (alias map, no GPT), `resolvePlanType` (pure match)
- **City alias map:** covers sp/rj/bh/cwb/poa, accented variants, full city names
- `handleConfirmStep` — parses approval/rejection with field-level correction (preserves already-collected data when user specifies which field to fix)
- `buildConfirmationMessage` — human-readable summary of all 4 fields asking for approval
- `buildQuoteMessage` — WhatsApp-formatted output with emojis (hospital, checkmark, hourglass, money bag), mocked price calculation (base * lives * age_multiplier * tier_multiplier)
- **STEP_PROMPTS** and **getRetryMessage** (3 escalating messages per field)
- Every sendTextMessage call uses `computeDelaySeconds()` and is followed by `saveMessage()` (save-after-send invariant)

## Decisions Made

1. **GPT as slow-path fallback:** Regex handles clean numeric/range input without API call. GPT only invoked when fast-path fails. Temperature 0, max_tokens 10-15 for deterministic extraction.

2. **resolveCity and resolvePlanType are pure (no GPT):** City set is small and fixed; alias map covers all reasonable inputs. resolvePlanType matches 1/2/enfermaria/apartamento/apto — no ambiguity to resolve with LLM.

3. **Field-level correction preserves data:** On "nao" + specific field keyword, only that field is cleared and step is rewound to that field. Ambiguous rejection restarts from 'lives'. Implements CONTEXT.md requirement "sem perder dados ja coletados."

4. **Prisma JSONB cast:** `state as unknown as Prisma.InputJsonObject` imported from `../generated/prisma/client`. Required because Prisma 7 generated client is in non-standard location.

## Deviations from Plan

None — plan executed exactly as written. All extraction functions, step handlers, retry logic, confirmation flow, and quote output builder implemented as specified.

## Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `src/types/index.ts` | Modified | Added QuoteStep type and QuoteState interface |
| `src/data/healthQuoteMock.ts` | Created | HealthQuotePlan interface + HEALTH_PLAN mock + ALLOWED_CITIES |
| `src/services/quoteService.ts` | Created | Complete quote flow state machine (508 lines) |

## Commits

| Hash | Message |
|------|---------|
| 172ca0c | feat(04-01): add QuoteState types and mock health plan data |
| 9348085 | feat(04-01): create quoteService.ts — complete quote flow state machine |

## Self-Check: PASSED

All artifacts verified:
- src/types/index.ts — FOUND, exports QuoteStep and QuoteState
- src/data/healthQuoteMock.ts — FOUND, exports HEALTH_PLAN and ALLOWED_CITIES
- src/services/quoteService.ts — FOUND, exports handleQuoteMessage, getQuoteState, isQuoteState
- Commit 172ca0c — FOUND
- Commit 9348085 — FOUND
- TypeScript compiles cleanly (`npx tsc --noEmit` — no errors)
