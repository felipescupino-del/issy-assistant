# Phase 4: Quote Flow (Health Insurance) - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Broker completa uma cotação de plano de saúde inteira pelo WhatsApp — da detecção de intenção até receber um preço mockado com resumo de coberturas. Todos os dados de planos e preços são mockados para demo. Dados reais virão em fase futura.

</domain>

<decisions>
## Implementation Decisions

### Coleta de dados
- Uma pergunta por vez — bot pergunta um campo, espera resposta, segue pro próximo
- 4 campos básicos: quantidade de vidas, faixa etária, cidade, tipo de plano (enfermaria/apartamento)
- IA interpreta respostas ambíguas antes de rejeitar (ex: "muitas vidas" → tenta extrair número)
- Resumo de confirmação antes de gerar cotação: mostra todos os dados e pede "Correto?"

### Apresentação da cotação
- 1 plano mockado por cotação (não comparação entre planos)
- Conteúdo completo: nome do plano, coberturas principais, carência, preço mensal mockado
- Formatação WhatsApp com emojis (🏥 Plano, 💰 Preço, ✅ Coberturas) e *negrito* para destaque
- Após cotação, oferecer próximos passos: "Quer cotar outro plano? Falar com um consultor?"

### Fluxo de conversação
- Tom profissional amigável — cordial mas direto ("Perfeito! Agora me diz a cidade.")
- Interrupções: responde a dúvida e volta pra cotação ("Voltando à cotação de saúde, qual a cidade?")
- Retomada: resume dados coletados e continua de onde parou ("Você estava cotando saúde: 4 vidas, 25-35 anos. Falta a cidade. Quer continuar?")
- Uma cotação ativa por vez — nova cotação substitui a anterior se não foi concluída

### Validação e erros
- 3 tentativas por campo — mensagens cada vez mais claras, na 3ª oferece pular ou falar com humano
- Cidade: lista fixa mockada (~5 cidades: SP, RJ, BH, Curitiba, POA). Fora da lista informa as disponíveis
- Tipo de plano: bot lista opções "1) Enfermaria 2) Apartamento" — corretor escolhe por número ou nome
- Erros de sistema: mensagem amigável ("Tive um problema técnico. Tenta de novo em alguns minutos?")

### Claude's Discretion
- Estrutura interna do state machine para o quote flow
- Formato exato dos dados mockados (nomes de operadoras, valores de preço)
- Como persistir o estado da cotação no banco (JSONB na conversa já decidido na Phase 1)

</decisions>

<specifics>
## Specific Ideas

- Tudo mockado para demo — preços fictícios, operadoras fictícias, coberturas genéricas
- Dados reais serão integrados em fase futura (o usuário explicitou: "DEPOIS VOU FORNECER OS DADOS")
- O bot deve parecer funcional para um demo — a experiência deve ser convincente mesmo com dados fake

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-quote-flow-health-insurance*
*Context gathered: 2026-02-24*
