---
status: testing
phase: 04-quote-flow-health-insurance
source: 04-01-SUMMARY.md, 04-02-SUMMARY.md
started: 2026-02-24T18:00:00Z
updated: 2026-02-24T18:00:00Z
---

## Current Test

number: 1
name: Iniciar cotação por texto livre
expected: |
  Broker manda algo como "quero cotar saúde pra um cliente" no WhatsApp.
  O bot detecta intent='quote' e inicia o fluxo de cotação automaticamente — perguntando a quantidade de vidas como primeiro campo.
  Nenhum comando especial é necessário.
awaiting: user response

## Tests

### 1. Iniciar cotação por texto livre
expected: Broker manda "quero cotar saúde" e bot inicia o fluxo perguntando quantidade de vidas — sem necessidade de comando.
result: [pending]

### 2. Coletar quantidade de vidas
expected: Bot pergunta "Quantas pessoas serão beneficiárias?" e aceita número direto (ex: "4") ou texto ambíguo (ex: "pra minha família de 3") extraindo via IA.
result: [pending]

### 3. Coletar faixa etária
expected: Bot pergunta faixa etária e aceita formatos como "25 a 35", "25-35 anos", ou texto livre que a IA consegue interpretar.
result: [pending]

### 4. Coletar cidade
expected: Bot pergunta a cidade. Aceita alias como "sp", "rj", "bh", "cwb", "poa" e variantes acentuadas. Fora da lista fixa (SP, RJ, BH, Curitiba, POA) informa as cidades disponíveis.
result: [pending]

### 5. Coletar tipo de plano
expected: Bot lista "1) Enfermaria 2) Apartamento". Aceita número (1, 2) ou nome (enfermaria, apartamento, apto).
result: [pending]

### 6. Confirmação dos dados
expected: Após coletar todos os campos, bot mostra resumo: "4 vidas, 25-35 anos, São Paulo, Apartamento — Correto?" e espera confirmação.
result: [pending]

### 7. Correção de campo específico
expected: Se broker diz "não, a cidade está errada", bot volta APENAS para o campo cidade, preservando os outros dados já coletados.
result: [pending]

### 8. Resultado da cotação formatado
expected: Mensagem WhatsApp com emojis (🏥, ✅, ⏳, 💰), *negrito*, nome do plano (Saúde Segura / Essencial Plus), coberturas, carência, e preço mensal mockado.
result: [pending]

### 9. Próximos passos pós-cotação
expected: Após mostrar cotação, bot pergunta "Quer cotar outro plano? Falar com um consultor?" ou similar.
result: [pending]

### 10. Retomada de cotação incompleta
expected: Se broker abandona no meio (ex: já deu vidas e faixa etária) e volta depois, bot resume: "Você estava cotando saúde: X vidas, Y anos. Falta a cidade. Quer continuar?"
result: [pending]

### 11. Validação com retry escalonado
expected: Valor inválido (ex: "abc" pra vidas) gera mensagem cada vez mais clara. Na 3ª tentativa, oferece pular ou falar com humano.
result: [pending]

## Summary

total: 11
passed: 0
issues: 0
pending: 11
skipped: 0

## Gaps

[none yet]
