---
phase: 02-core-pipeline
plan: 01
subsystem: persistence
tags: [prisma, contact, conversation, pipeline, types]
dependency_graph:
  requires: [01-01, 01-02]
  provides: [upsertContact, isFirstMessage, getOrCreateConversation, isHumanMode, ConversationContext]
  affects: [02-02, 02-03, 03-01]
tech_stack:
  added: []
  patterns: [prisma-upsert-no-op, date-getTime-comparison]
key_files:
  created:
    - src/types/index.ts
    - src/services/contact.ts
    - src/services/conversation.ts
  modified: []
decisions:
  - "isFirstMessage uses getTime() numeric diff (<1000ms) not === to avoid JavaScript Date reference equality pitfall"
  - "getOrCreateConversation uses update:{} no-op to preserve humanMode and state on existing rows"
  - "Both services import from ../lib/prisma singleton, not @prisma/client directly"
metrics:
  duration: "~10 minutes"
  completed: "2026-02-24"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 0
---

# Phase 02 Plan 01: Contact and Conversation Persistence Summary

**One-liner:** Prisma upsert-based contact identity and conversation session services with first-message detection and human-mode gating.

## What Was Built

The first two pipeline steps for every inbound WhatsApp message:

1. **ConversationContext type** (`src/types/index.ts`) — shared interface passed between pipeline services to avoid circular imports
2. **Contact service** (`src/services/contact.ts`) — upserts broker identity by phone on every message, always syncing senderName; detects first-message via timestamp proximity
3. **Conversation service** (`src/services/conversation.ts`) — gets or creates one Conversation row per phone number; isHumanMode() gate prevents AI processing when a human agent has taken over

## Files Created

| File | Purpose | Exports |
|------|---------|---------|
| `src/types/index.ts` | Shared pipeline context type | `ConversationContext` |
| `src/services/contact.ts` | Broker identity persistence (CORE-02) | `upsertContact`, `isFirstMessage` |
| `src/services/conversation.ts` | Session state persistence (CORE-04) | `getOrCreateConversation`, `isHumanMode` |

## Key Implementation Decisions

**1. isFirstMessage uses getTime() numeric comparison**
- `Math.abs(contact.createdAt.getTime() - contact.updatedAt.getTime()) < 1000`
- Using `===` between two Date objects compares object references, not values — always false
- 1000ms threshold accounts for sub-second Prisma write latency

**2. getOrCreateConversation uses no-op update**
- `update: {}` is intentional — on existing rows, all fields are preserved
- humanMode and state (quote flow JSON) are never overwritten by an inbound message

**3. Prisma singleton import**
- Import from `../lib/prisma` not from `@prisma/client` directly
- Ensures single connection pool in dev hot-reload environments

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] `src/types/index.ts` exists and exports `ConversationContext`
- [x] `src/services/contact.ts` exists and exports `upsertContact`, `isFirstMessage`
- [x] `src/services/conversation.ts` exists and exports `getOrCreateConversation`, `isHumanMode`
- [x] `npx tsc --noEmit` passes with zero errors

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 82f0666 | feat(02-01): add ConversationContext type to src/types/index.ts |
| Task 2 | 404b814 | feat(02-01): create contact and conversation persistence services |
