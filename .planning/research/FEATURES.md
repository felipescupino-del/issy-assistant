# Feature Research

**Domain:** WhatsApp AI Chatbot for Insurance Brokers (B2B internal tool)
**Researched:** 2026-02-24
**Confidence:** MEDIUM — Based on WebSearch across industry sources (botpress.com, masterofcode.com, multimodal.dev, kaily.ai, beeia.com.br, insurebuddy.ai, spurnow.com, agentiveaiq.com). No Context7 applicable (product domain, not library). Multiple sources agree on core features; broker-specific tool (vs consumer-facing) is less documented but patterns are clear.

---

## Context

This research covers a **broker-facing internal tool**, not a consumer-facing chatbot. The distinction matters significantly:

- **Consumer chatbots** (B2C): handle policy purchases, claims filing, payment reminders, renewals
- **Broker assistant bots** (B2B, this project): help professional brokers answer questions faster, run guided quote flows on behalf of clients, and escalate to senior humans when stuck

Most market research covers B2C. Where broker-specific patterns diverge, this document calls it out explicitly.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features brokers assume exist. Missing these = product feels broken or unprofessional.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Intent detection | Brokers ask in natural language — bot must classify: Q&A, quote request, human escalation, or general chat. Without this, every message goes through the wrong path. | MEDIUM | 4 core intents: Q&A, quote_flow, human_handoff, general. Use LLM classification, not rigid keyword matching. |
| Insurance Q&A — products, coverages, exclusions | Core value prop. A broker needs instant access to product knowledge (auto, life, home, business). Without this the bot is useless. | MEDIUM | GPT-4o-mini with insurance system prompt. Knowledge is general-purpose for v1; document ingestion is v2. |
| Acceptance rules Q&A | Brokers constantly ask "will this client be accepted?" — profile-specific eligibility questions. Table stakes for a broker tool. | MEDIUM | Rule-based criteria embedded in system prompt or structured knowledge. Critical for underwriting guidance. |
| Guided quote flow | Brokers need to run quotes while on the phone with clients. Bot must collect required data fields for each insurance type and return a price. | HIGH | Per-product field collection (auto: plate, model, year, driver age; life: age, smoker, sum insured; etc.). Mocked prices for v1. |
| Human handoff with full context | When bot can't help or broker explicitly requests a human, transfer must happen in the same WhatsApp thread — no context loss. | MEDIUM | Context packet (summary, intent, collected data) passed to human agent. Human replies in same thread. |
| Conversation history / session memory | Bot must remember what was said earlier in the conversation — required for coherent multi-turn exchanges. | LOW | Per-conversation message history stored in DB, truncated window sent to LLM. Standard RAG-adjacent pattern. |
| Contact/broker identification | Bot must know which broker it's talking to — enables personalization, context, and admin controls. | LOW | Phone number as identifier. First-message onboarding flow to capture broker name. State stored in DB. |
| Natural response timing (humanization) | Instant responses feel robotic. A small typing delay (1-3s) makes the bot feel natural. For a tool used all day, uncanny robotic feel degrades adoption. | LOW | WhatsApp typing indicator + programmatic delay before sending. Max 3-4s. Do not fake longer than necessary. |
| Graceful fallback for unknown questions | When bot doesn't know the answer, it must say so clearly and offer human escalation rather than hallucinating. | LOW | Explicit "I don't know" path. Offer to escalate or ask user to rephrase. Critical for trust. |
| Admin controls (return to bot, check status) | Operations team needs to: return a conversation to bot after human handling, check bot status, pause/resume bot for a specific contact. | LOW | Command-based (/bot, /human, /status) recognized only from designated admin numbers. |

### Differentiators (Competitive Advantage)

Features that set this product apart. Not expected out of the box, but deliver significant value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Insurance-type detection from free text | Broker says "quero uma cotação pra um Corolla 2022" — bot classifies as auto quote without explicit category selection. Saves multiple interaction turns. | MEDIUM | LLM intent + entity extraction in a single pass. Detect: insurance type + key entities in one shot. |
| Structured context handoff packet | When escalating to human, bot sends a structured summary: broker name, intent, insurance type, collected quote data, and key unknowns. Human reads one message and is ready. Context is not raw conversation dump — it's synthesized. | MEDIUM | LLM summarization step at handoff. Transforms raw history into structured briefing. Real competitive edge for the demo. |
| Partial quote save and resume | Broker starts a quote, gets interrupted, returns hours later. Bot resumes from where it left off: "Você estava cotando Auto para um Corolla 2022. Continuamos?" | MEDIUM | Quote state persisted to DB with expiry (e.g., 24h TTL). Resumption prompt on new message in same flow. |
| Per-insurance-type field validation | Bot validates collected quote data in real time — e.g., year out of range, invalid plate format, missing mandatory field. Prevents junk quotes. | MEDIUM | Per-product validation schema. Field-level rejection with correction prompt. |
| Tone calibration for broker context | Response style is professional and concise — this is a tool, not a consumer chatbot. Avoids excessive pleasantries, gets to the answer fast. | LOW | System prompt engineering. Broker-appropriate persona. Directly measurable in demo quality. |
| Clear quote summary with coverage breakdown | Quote result is not just a price — it includes coverage highlights, deductible, key exclusions, and a clear note that prices are illustrative (for v1). Sets professional expectation. | LOW | Output template for quote result. Mocked price + coverage summary. Demo-ready. |
| Multi-product knowledge in one session | Broker can ask about auto, then pivot to life, then ask about a home quote — all in one session. Bot handles context switching without losing state. | MEDIUM | Conversation history window management. Quote state is per-flow, not per-session. New quote intent resets flow but not history. |

### Anti-Features (Deliberately NOT Building)

Features that seem like good ideas but create problems for this project's goals.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real insurer API integration (Quiver, Agger, Segfy) | "Real prices would be better" | Requires credentials, complex integration, insurer-specific data schemas, and ongoing maintenance. Blocks the demo. Will change per assessoria. | Mock prices with realistic structure. Slot for real API is built into architecture but not implemented in v1. |
| PDF / document ingestion for policy conditions | "Bot should know the full policy text" | Chunking, embedding, retrieval pipelines add 2-3x complexity. Retrieval quality is hard to validate. For demo, general insurance knowledge covers 80% of questions. | System prompt with curated general insurance knowledge. Document ingestion is an explicit v2 feature. |
| Web / dashboard interface for brokers | "A dashboard would be nice" | Channel is WhatsApp — brokers live there. Adding a dashboard fragments attention, doubles surface area, and delays the demo. | Stay WhatsApp-only. Bot IS the interface. |
| Proactive outbound messages to clients | "Bot could remind clients about renewals" | Shifts product from broker tool to CRM. Requires policy expiry data, consent management, LGPD compliance, and different integration model. Out of scope for demo. | Manual outbound by broker. Future CRM integration is separate product decision. |
| Multi-tenancy (multiple assessorias) | "Could sell to other agencies too" | Forces multi-tenant data isolation, per-tenant config, billing, and onboarding flows from day one. Premature for demo targeting one agency. | Single-tenant for v1. Tenant isolation can be added once product-market fit is confirmed. |
| Voice message transcription and response | "Brokers sometimes send voice notes" | Audio transcription (Whisper) adds latency and cost per message. Voice response (TTS) adds more complexity. Not in scope for demo. | Text-only in v1. Voice support is a v2 differentiator if brokers demand it. |
| Rich media responses (PDFs, images, buttons) | "WhatsApp supports buttons and PDFs" | Interactive buttons require WhatsApp Business API approval and template pre-approval. Images add formatting complexity. Over-engineering for demo. | Text-only responses for v1. WhatsApp interactive messages can be added as polish in v1.x. |
| Full CRM features (pipeline, tasks, reminders) | "Would be useful to track broker pipeline" | CRM is a different product. Scope creep that delays demo. | Bot is a productivity tool, not a CRM. Explicitly out of scope. |
| Real-time sentiment analysis and escalation | "Bot should detect frustrated broker" | For a professional broker tool, frustration escalation is less critical than for consumer chatbots. Brokers will simply type "falar com humano". | Explicit escalation command + bot failure counter (2 unhelpful responses → offer escalation). |

---

## Feature Dependencies

```
[Contact Identification]
    └──required by──> [Intent Detection]
    └──required by──> [Admin Controls]
    └──required by──> [Conversation History]

[Intent Detection]
    └──required by──> [Insurance Q&A]
    └──required by──> [Guided Quote Flow]
    └──required by──> [Human Handoff]

[Conversation History]
    └──required by──> [Insurance Q&A]  (needs context window)
    └──required by──> [Partial Quote Save/Resume]
    └──required by──> [Structured Context Handoff Packet]

[Guided Quote Flow]
    └──required by──> [Per-insurance-type field validation]
    └──required by──> [Clear Quote Summary]
    └──required by──> [Partial Quote Save/Resume]
    └──enables──> [Insurance-type detection from free text]

[Human Handoff]
    └──enhanced by──> [Structured Context Handoff Packet]
    └──requires──> [Admin Controls]  (for returning conv. to bot)
```

### Dependency Notes

- **Contact Identification must come first:** Everything else depends on knowing who the broker is and maintaining per-contact state. Phone number as key, stored in DB on first message.
- **Intent Detection gates all downstream features:** Without reliable intent classification, quote flows are triggered by accident and Q&A is bypassed. Build this before anything else.
- **Conversation History enables coherent Q&A:** LLM responses without history context produce jarring, repetitive responses. Must persist from message 1.
- **Guided Quote Flow is the most complex single feature:** It has internal state (which fields collected, which pending), validation logic, per-product branching, and a price return step. Implement after Q&A is stable.
- **Human Handoff depends on Admin Controls:** After handoff, an admin must be able to return the conversation to bot mode. Without this, handoffs are one-way traps.
- **Structured Handoff Packet enhances Human Handoff:** Both can be built independently, but the structured packet is what makes handoff feel professional in the demo. Build both together.

---

## MVP Definition

### Launch With (v1) — Demo-Ready

Minimum feature set to run a convincing demo for an assessoria with 50+ brokers.

- [ ] **Contact identification** — Know who the broker is, maintain state per phone number
- [ ] **Intent detection** — Classify: Q&A, quote flow, human handoff, general conversation
- [ ] **Insurance Q&A** — General knowledge on auto, life, home, business — products, coverages, acceptance rules
- [ ] **Guided quote flow** — At minimum auto (highest volume). Collect fields, validate, return mocked price with coverage summary
- [ ] **Human handoff with structured context packet** — Transfer to human in same thread, send synthesized briefing
- [ ] **Conversation history** — Per-conversation memory window, stored in DB
- [ ] **Admin controls** — /bot, /human, /status commands from designated admin numbers
- [ ] **Natural response timing** — Typing indicator + 1-3s delay
- [ ] **Graceful fallback** — "Não sei, posso te passar para um humano?" when answer is unknown

### Add After Validation (v1.x)

Add once demo converts to production agreement and first brokers are using it daily.

- [ ] **Partial quote save and resume** — Trigger: brokers complain about restarting interrupted quotes
- [ ] **Multi-product quote flows** — Life, home, business quotes after auto is validated
- [ ] **Insurance-type auto-detection from free text** — Reduces quote flow turns; add once base flow is stable
- [ ] **Per-field validation with correction prompts** — Reduces junk data; add once field collection pattern is proven

### Future Consideration (v2+)

Defer until product-market fit established with the pilot assessoria.

- [ ] **Document ingestion (PDF policy conditions)** — High complexity; add only when general-knowledge gaps are validated by real usage
- [ ] **Voice message support** — Add only if brokers strongly prefer audio over text
- [ ] **Real insurer API integration** — Add when assessoria provides actual pricing tables
- [ ] **WhatsApp interactive messages (buttons, lists)** — Polish, not core. Add once flows are stable
- [ ] **Analytics dashboard** — Operational visibility for assessoria management

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Contact identification | HIGH | LOW | P1 |
| Conversation history | HIGH | LOW | P1 |
| Intent detection | HIGH | MEDIUM | P1 |
| Insurance Q&A | HIGH | MEDIUM | P1 |
| Guided quote flow (auto) | HIGH | HIGH | P1 |
| Human handoff + context packet | HIGH | MEDIUM | P1 |
| Admin controls | MEDIUM | LOW | P1 |
| Natural response timing | MEDIUM | LOW | P1 |
| Graceful fallback | HIGH | LOW | P1 |
| Partial quote save/resume | MEDIUM | MEDIUM | P2 |
| Insurance-type auto-detection | MEDIUM | MEDIUM | P2 |
| Per-field validation | MEDIUM | MEDIUM | P2 |
| Multi-product quote flows (life, home) | HIGH | HIGH | P2 |
| Tone calibration / persona | HIGH | LOW | P1 (system prompt, no extra build) |
| Document ingestion (RAG) | HIGH | HIGH | P3 |
| Voice message support | LOW | HIGH | P3 |
| Real insurer API | HIGH | HIGH | P3 |
| WhatsApp interactive messages | MEDIUM | MEDIUM | P3 |

**Priority key:**
- P1: Must have for demo launch
- P2: Should have, add when brokers adopt it
- P3: Defer to v2+

---

## Competitor Feature Analysis

Most competitors are B2C insurance chatbots (customer-facing). Broker-tool specific products are fewer and less documented. The table below maps B2C features to their B2B broker equivalent.

| Feature | B2C Market (e.g., InsureBuddy, Kaily) | B2B Broker Tool (this project) |
|---------|---------------------------------------|-------------------------------|
| Quote collection | Collects from end customer | Collects from broker acting for client |
| Knowledge base | Product information for consumers | Acceptance rules + underwriting guidance for professionals |
| Human handoff | To call center agent | To senior broker or operations team |
| Claims | Filing, status updates, document upload | Out of scope (broker tool, not claims system) |
| CRM / reminders | Renewal reminders to policyholders | Out of scope for v1 |
| Auth / login | OTP-based customer login | Phone number = implicit identity; no login needed |
| Multilingual | Consumer language diversity | Portuguese (Brazil) only |
| Sentiment escalation | Frustrated customer → agent | Explicit /humano command, 2-failure fallback |
| Analytics | Customer satisfaction scores | Admin status commands; full analytics is v2 |

---

## Sources

- [WhatsApp AI Chatbot for Insurance - AeroChat](https://aerochat.ai/blog/whatsapp-ai-chatbot-for-insurance) — MEDIUM confidence (WebSearch)
- [Best 5+ Insurance Chatbots for 2026 - Strada](https://www.getstrada.com/blog/chatbot-insurance) — MEDIUM confidence (WebSearch)
- [Complete Guide to AI Chatbots in Insurance 2026 - Botpress](https://botpress.com/blog/insurance-chatbots) — MEDIUM confidence (WebSearch)
- [Insurance AI Chatbots: 20 Use Cases - Master of Code](https://masterofcode.com/blog/insurance-chatbot) — MEDIUM confidence (verified via WebFetch)
- [WhatsApp Chatbot for Insurance - Kaily](https://www.kaily.ai/blog/whatsapp-chatbot-for-insurance) — MEDIUM confidence (verified via WebFetch)
- [WhatsApp Automation for Corretoras - Beeia](https://www.beeia.com.br/automacao-whatsapp-corretoras-de-seguros/) — MEDIUM confidence (verified via WebFetch, Brazil-specific)
- [Whatsapp Insurance - InsureBuddy](https://www.insurebuddy.ai/WhatsApp-Insurance) — MEDIUM confidence (verified via WebFetch)
- [Chatbot to Human Handoff Guide - SpurNow](https://www.spurnow.com/en/blogs/chatbot-to-human-handoff) — MEDIUM confidence (verified via WebFetch)
- [7 Best Features Customer Service Chatbot - AgentiveAIQ](https://agentiveaiq.com/listicles/7-best-features-of-a-customer-service-chatbot-for-insurance-agencies) — MEDIUM confidence (verified via WebFetch)
- [Conversational AI for Insurance 2026 - Multimodal.dev](https://www.multimodal.dev/post/conversational-ai-for-insurance-a-guide-for-2025) — MEDIUM confidence (verified via WebFetch)
- [WhatsApp Chatbot for Insurance - ChatMaxima](https://chatmaxima.com/blog/how-to-use-whatsapp-chatbots-for-insurance-a-complete-guide/) — MEDIUM confidence (WebSearch)
- [WhatsApp Chatbot for Insurance - Verloop](https://www.verloop.io/blog/whatsapp-chatbots-for-insurance/) — MEDIUM confidence (WebSearch)

---
*Feature research for: WhatsApp AI Chatbot for Insurance Brokers (Issy Assistant)*
*Researched: 2026-02-24*
