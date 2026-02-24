# Roadmap: Issy Assistant

## Overview

Starting from a blank TypeScript project, we build a WhatsApp AI assistant for insurance brokers in five phases. Phase 1 establishes the infrastructure — environment, database schema, webhook tunnel — because getting this wrong (especially the phone number ban risk) is permanent damage. Phase 2 builds the full message pipeline: the broker sends a WhatsApp message and the bot responds intelligently. Phase 3 layers the two highest-value features on that pipeline: insurance Q&A and human handoff with structured context. Phase 4 implements the guided health insurance quote flow — the demo centerpiece. Phase 5 hardens the system for real use by 50+ brokers: message queue, deduplication, rate limiting, and UX polish. The result is a demo-ready WhatsApp assistant that a broker assessoria will want to adopt.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Infrastructure** - Running server, database schema, and webhook tunnel ready for development
- [ ] **Phase 2: Core Pipeline** - Broker sends a WhatsApp message and bot responds with AI using full conversation context
- [ ] **Phase 3: Insurance Q&A and Handoff** - Bot answers insurance questions and transfers to a human with structured context
- [ ] **Phase 4: Quote Flow (Health Insurance)** - Bot guides broker through a complete health insurance quote and returns a mocked price
- [ ] **Phase 5: Polish and Demo Hardening** - System is reliable and professional enough to demo to a 50-broker assessoria

## Phase Details

### Phase 1: Infrastructure
**Goal**: The development environment is fully configured, the PostgreSQL schema is in place for all conversation state, and the Express server responds to WhatsApp webhooks
**Depends on**: Nothing (first phase)
**Requirements**: (none — prerequisite infrastructure, not feature requirements)
**Success Criteria** (what must be TRUE):
  1. Running `npm run dev` starts the Express server and logs a health check response at `/health`
  2. A test WhatsApp message from a dev phone number reaches the webhook endpoint and is logged (no processing yet)
  3. PostgreSQL database has all tables: contacts, conversations, messages, conversation_state — confirmed by running `prisma migrate status`
  4. Dev phone number is separate from any production number — confirmed by config inspection
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Install Prisma, replace pg/Evolution config, create Z-API types and PrismaClient singleton
- [ ] 01-02-PLAN.md — Write Prisma schema (Contact, Conversation, Message) and run initial migration to Supabase
- [ ] 01-03-PLAN.md — Rewrite Express server and webhook handler for Z-API; human-verify real message receipt

### Phase 2: Core Pipeline
**Goal**: A broker can send any message on WhatsApp and the bot responds coherently using conversation history and intelligent intent routing
**Depends on**: Phase 1
**Requirements**: CORE-01, CORE-02, CORE-03, CORE-04, CORE-05, UX-01
**Success Criteria** (what must be TRUE):
  1. Broker sends first message and bot replies using their name after capturing it — broker identity is persisted to database
  2. Broker asks a general question; bot classifies intent and responds with a relevant AI answer in Portuguese
  3. Broker sends a follow-up message and bot's response demonstrates awareness of the previous exchange (conversation history in context)
  4. Broker types something the bot cannot answer; bot says it doesn't know and offers to escalate to a human
  5. Bot response arrives after a visible typing indicator and a 1-3 second natural delay — never instant
**Plans**: 3 plans

Plans:
- [ ] 02-01-PLAN.md — Contact + conversation services (types, upsertContact, getOrCreateConversation)
- [ ] 02-02-PLAN.md — History + intent + AI + WhatsApp typing indicator services
- [ ] 02-03-PLAN.md — Webhook pipeline wiring + human-verify end-to-end

### Phase 3: Insurance Q&A and Handoff
**Goal**: The bot is a credible insurance knowledge assistant and can hand off to a human agent with zero loss of context
**Depends on**: Phase 2
**Requirements**: KNOW-01, KNOW-02, KNOW-03, KNOW-04, HAND-01, HAND-02, HAND-03
**Success Criteria** (what must be TRUE):
  1. Broker asks about a health, auto, life, residential, or business insurance product and receives a factually grounded, professional-tone answer in Portuguese
  2. Broker asks about coverage inclusions, exclusions, or acceptance rules for a specific product and receives a specific, hedged answer (not a hallucination of invented R$ values)
  3. Broker types `/humano` or asks to speak with a person; bot sets handoff mode, sends a structured briefing message to the human agent in the same WhatsApp thread, and confirms the transfer to the broker
  4. After handoff, bot does not respond to broker messages until admin returns control — no double-response race condition
  5. Admin sends `/bot` or `/status` from an allowlisted phone number; command executes correctly; non-admin numbers receive no response to these commands
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md — Insurance knowledge layer (facts file, product detection, system prompt injection)
- [ ] 03-02-PLAN.md — Handoff flow and admin commands (setHumanMode, briefing, /bot, /status)

### Phase 4: Quote Flow (Health Insurance)
**Goal**: A broker can complete an end-to-end health insurance quote entirely within WhatsApp — from intent detection through data collection to receiving a mocked price with coverage summary
**Depends on**: Phase 3
**Requirements**: QUOT-01, QUOT-02, QUOT-03, QUOT-04
**Success Criteria** (what must be TRUE):
  1. Broker sends a free-text message like "quero cotar saúde pra um cliente" and bot immediately begins the health insurance quote flow without requiring a command
  2. Bot collects each required field (beneficiary count, age range, city, plan type) one at a time with clear prompts — broker never needs to guess what to provide
  3. Broker provides an invalid field value and bot explains the problem and asks again without losing previously collected data
  4. Bot presents a final quote summary with plan name, coverages, carência periods, and a mocked monthly price in a readable WhatsApp-formatted message
  5. Broker stops mid-quote and returns later; bot resumes the flow from the last completed step without restarting from the beginning
**Plans**: TBD

Plans: TBD

### Phase 5: Polish and Demo Hardening
**Goal**: The system handles concurrent broker messages without errors, is protected against duplicate processing and webhook abuse, and presents a professional UX that will not embarrass during the demo
**Depends on**: Phase 4
**Requirements**: (all 17 v1 requirements hardened — no new feature requirements; this phase raises the quality bar)
**Success Criteria** (what must be TRUE):
  1. Two brokers send messages simultaneously; both receive correct, independent responses — no crossed context, no out-of-order replies
  2. Evolution API retries the same webhook event twice; the message is processed exactly once — no duplicate bot responses
  3. OpenAI API returns an error or times out; broker receives a graceful fallback message within a reasonable time — bot does not go silent
  4. Webhook endpoint rejects requests without valid Evolution API signature — unauthorized callers receive 401, not 200
  5. Conversation history is capped at the last 20 messages sent to OpenAI — no token explosion on long conversations
**Plans**: TBD

Plans: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure | 0/TBD | Not started | - |
| 2. Core Pipeline | 0/TBD | Not started | - |
| 3. Insurance Q&A and Handoff | 0/TBD | Not started | - |
| 4. Quote Flow (Health Insurance) | 0/TBD | Not started | - |
| 5. Polish and Demo Hardening | 0/TBD | Not started | - |
