# Phase 3 Context: Insurance Q&A and Handoff

## Design Decisions

### Knowledge Layer (KNOW-01 to KNOW-04)
- **Approach:** Arquivo de facts embeddado — criar um arquivo .ts com fatos de seguros organizados por produto
- **How it works:** Fatos são injetados no system prompt dinamicamente baseado no tipo de produto detectado na mensagem
- **No RAG, no embeddings** — simples e suficiente para demo
- **Existing note from STATE.md:** Known facts layer content needs assessoria input to prevent hallucination

### Handoff (HAND-01, HAND-02)
- **Notification method:** Mensagem no mesmo chat do WhatsApp
- **Bot sends a structured briefing** (resumo da conversa, intent, dados coletados) no próprio chat quando o corretor pede handoff
- **O humano da assessoria lê o briefing ali mesmo quando assumir a conversa**
- **After handoff:** bot sets humanMode=true, stops responding until admin sends /bot

### Admin Commands (HAND-03)
- **Allowlist method:** Variável de ambiente ADMIN_PHONES no .env (comma-separated phone numbers)
- **Commands:**
  - `/humano` — any user can request handoff (not admin-only)
  - `/bot` — admin-only: return control to bot (sets humanMode=false)
  - `/status` — admin-only: show basic info (current mode, broker name, last message)
- **Non-admin numbers sending /bot or /status receive no special response** (treated as normal messages)

### /status Content
- **Basic info only:** Modo atual (bot/humano), nome do corretor, última mensagem
- Sufficient for demo — no detailed analytics needed
