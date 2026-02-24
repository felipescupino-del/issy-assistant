# Issy Assistant

## What This Is

Issy Assistant é um chatbot de WhatsApp com IA que funciona como assistente inteligente para corretores de seguros. O corretor manda mensagem diretamente pro bot para tirar dúvidas sobre produtos, coberturas, regras de aceitação, e iniciar fluxos de cotação — tudo dentro do WhatsApp. O objetivo imediato é uma demo convincente para uma assessoria com 50+ corretores.

## Core Value

Liberar o corretor de seguros da operação repetitiva para que ele gaste mais tempo vendendo — transformando o WhatsApp em ferramenta de inteligência e apoio comercial.

## Requirements

### Validated

(None yet — começando código limpo)

### Active

- [ ] Bot recebe e responde mensagens no WhatsApp via webhook
- [ ] Detecção inteligente de intenção do corretor (dúvida, cotação, transferência humana, conversa geral)
- [ ] Respostas com IA sobre produtos de seguros, coberturas e regras de aceitação
- [ ] Fluxo de cotação guiado: bot identifica tipo de seguro (auto, vida, residencial, empresa, etc.), coleta dados e apresenta preço
- [ ] Preços mockados para demo (estrutura pronta para tabelas reais no futuro)
- [ ] Transferência inteligente para humano no mesmo WhatsApp, com contexto estruturado
- [ ] Histórico de conversa para contexto nas respostas da IA
- [ ] Comandos admin para equipe (retornar ao bot, checar status)
- [ ] Delay de humanização nas respostas (parecer natural)
- [ ] Gestão de contatos (identificar corretor, manter estado)

### Out of Scope

- Integração real com APIs de seguradoras (Quiver, Agger, Segfy) — vem após demo, quando assessoria fornecer tabelas reais
- Upload e processamento de PDFs de condições gerais — futuro, v1 usa conhecimento geral
- Painel web/dashboard para corretores — foco é 100% WhatsApp
- App mobile — canal é WhatsApp
- Multi-tenancy (múltiplas assessorias) — v1 é para uma assessoria específica

## Context

- Cliente é uma assessoria de corretores de seguros com 50+ corretores
- Corretores perdem muito tempo respondendo perguntas repetidas, buscando informações em PDFs, tentando entender qual produto encaixa no perfil do cliente
- Existe código prévio (TypeScript/Express/PostgreSQL/OpenAI) que serve como referência de arquitetura, mas será reconstruído do zero
- WhatsApp é o canal único — corretores já vivem no WhatsApp
- Provedor WhatsApp: Evolution API (principal) com suporte a Meta Cloud API
- Objetivo imediato: demo funcional que convença a assessoria a adotar
- IA usa GPT-4o-mini com conhecimento geral sobre seguros (sem documentos específicos por ora)

## Constraints

- **Canal**: WhatsApp exclusivamente — via Evolution API ou Meta Cloud API
- **IA**: OpenAI GPT-4o-mini (custo-benefício para volume de 50+ corretores)
- **Preços**: Mockados na v1 — estrutura preparada para tabelas reais
- **Stack**: TypeScript, Express, PostgreSQL (decisão validada pelo código anterior)
- **Objetivo**: Demo convincente — priorizar fluxo completo e polido sobre features extras

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Começar código limpo (não evoluir o existente) | Usuário quer arquitetura certa desde o início | — Pending |
| Preços mockados para demo | Assessoria vai fornecer tabelas reais depois — não travar demo esperando dados | — Pending |
| Conhecimento geral sobre seguros (sem PDFs) | Simplifica v1, PDFs vêm como evolução futura | — Pending |
| Corretor como usuário direto (não cliente final) | O bot é ferramenta do corretor, não atendimento ao consumidor | — Pending |
| Evolution API como provedor principal | Já usado no código anterior, flexível e open-source | — Pending |

---
*Last updated: 2026-02-23 after initialization*
