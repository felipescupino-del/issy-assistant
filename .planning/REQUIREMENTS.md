# Requirements: Issy Assistant

**Defined:** 2026-02-24
**Core Value:** Liberar o corretor de seguros da operação repetitiva para que ele gaste mais tempo vendendo

## v1 Requirements

Requirements for demo release targeting assessoria with 50+ brokers.

### Core Messaging

- [ ] **CORE-01**: Bot recebe mensagens do WhatsApp via webhook e responde no mesmo canal
- [ ] **CORE-02**: Bot identifica o corretor pelo telefone e captura nome na primeira interação
- [x] **CORE-03**: Bot classifica intenção do corretor (Q&A, cotação, handoff humano, conversa geral)
- [ ] **CORE-04**: Bot mantém histórico de conversa por contato para contexto nas respostas
- [x] **CORE-05**: Bot responde "não sei" e oferece escalação humana quando não tem a resposta

### Insurance Knowledge

- [x] **KNOW-01**: Bot responde dúvidas sobre produtos de seguros (saúde, auto, vida, residencial, empresarial)
- [x] **KNOW-02**: Bot responde sobre coberturas, exclusões e condições de cada produto
- [x] **KNOW-03**: Bot responde sobre regras de aceitação (elegibilidade do cliente)
- [x] **KNOW-04**: Bot usa tom profissional e conciso adequado para corretor de seguros

### Quote Flow

- [ ] **QUOT-01**: Bot conduz fluxo de cotação guiado para seguro saúde (coleta dados, valida, retorna preço mockado)
- [ ] **QUOT-02**: Bot detecta automaticamente o tipo de seguro a partir de texto livre do corretor
- [ ] **QUOT-03**: Bot apresenta resumo da cotação com coberturas, carências e preço
- [ ] **QUOT-04**: Bot salva cotação parcial e retoma de onde parou quando corretor volta

### Handoff & Admin

- [ ] **HAND-01**: Bot transfere conversa para humano no mesmo WhatsApp quando solicitado
- [ ] **HAND-02**: Bot envia pacote de contexto estruturado (resumo sintetizado) ao transferir
- [ ] **HAND-03**: Equipe admin controla bot via comandos (/bot, /status, /humano)

### UX

- [x] **UX-01**: Bot aguarda 1-3s com indicador de digitação antes de responder

## v2 Requirements

Deferred to after demo validation with assessoria.

### Multi-Product Quote Flows

- **QUOT-05**: Bot conduz fluxo de cotação para seguro auto
- **QUOT-06**: Bot conduz fluxo de cotação para seguro vida
- **QUOT-07**: Bot conduz fluxo de cotação para seguro residencial
- **QUOT-08**: Bot conduz fluxo de cotação para seguro empresarial

### Enhanced Validation

- **QUOT-09**: Bot valida cada campo coletado em tempo real com prompt de correção

### Knowledge Enhancement

- **KNOW-05**: Bot ingere PDFs de condições gerais das seguradoras (RAG)
- **KNOW-06**: Bot consulta tabelas de preço reais fornecidas pela assessoria

### Platform

- **PLAT-01**: Suporte a mensagens de voz (transcrição via Whisper)
- **PLAT-02**: Mensagens interativas do WhatsApp (botões, listas)
- **PLAT-03**: Dashboard de analytics para gestão da assessoria

## Out of Scope

| Feature | Reason |
|---------|--------|
| Integração real com APIs de seguradoras (Quiver, Agger, Segfy) | Vem após demo — assessoria fornecerá tabelas reais depois |
| Upload/processamento de PDFs de condições gerais | Complexidade alta, conhecimento geral cobre 80% para demo |
| Painel web/dashboard para corretores | WhatsApp é o canal único — bot É a interface |
| App mobile | Canal é WhatsApp |
| Multi-tenancy (múltiplas assessorias) | v1 para uma assessoria; isolamento de tenant vem depois |
| Mensagens proativas/outbound (CRM) | Muda escopo de ferramenta para CRM — produto diferente |
| Análise de sentimento em tempo real | Corretor usa comando explícito /humano |
| Rich media responses (PDFs, imagens) | Over-engineering para demo |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 2 | Pending |
| CORE-02 | Phase 2 | Pending |
| CORE-03 | Phase 2 | Complete |
| CORE-04 | Phase 2 | Pending |
| CORE-05 | Phase 2 | Complete |
| KNOW-01 | Phase 3 | Complete |
| KNOW-02 | Phase 3 | Complete |
| KNOW-03 | Phase 3 | Complete |
| KNOW-04 | Phase 3 | Complete |
| QUOT-01 | Phase 4 | Pending |
| QUOT-02 | Phase 4 | Pending |
| QUOT-03 | Phase 4 | Pending |
| QUOT-04 | Phase 4 | Pending |
| HAND-01 | Phase 3 | Pending |
| HAND-02 | Phase 3 | Pending |
| HAND-03 | Phase 3 | Pending |
| UX-01 | Phase 2 | Complete |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-02-24*
*Last updated: 2026-02-24 after roadmap creation — traceability complete*
