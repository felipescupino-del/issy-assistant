// src/services/ai.ts
// OpenAI Chat Completions service — Luna / Grupo Futura União
import OpenAI from 'openai';
import { config } from '../config';
import { Intent } from './intent';
import { ProductType, InsuranceFacts } from '../types/index';
import { insuranceFacts } from '../data/insuranceFacts';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

export interface GenerateOptions {
  isNewSession?: boolean;
  quoteActive?: boolean;
}

/**
 * Generate an AI response for the broker using conversation history and current message.
 */
export async function generateResponse(
  contactName: string,
  historyMessages: Array<{ role: string; content: string }>,
  currentMessage: string,
  intent: Intent,
  productType: ProductType | null = null,
  options: GenerateOptions = {},
): Promise<string> {
  const systemPrompt = buildSystemPrompt(contactName, intent, productType, options);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...historyMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: currentMessage },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      messages,
      temperature: config.openai.temperature,
      max_tokens: config.openai.maxTokens,
    });

    return completion.choices[0]?.message?.content ?? getFallbackMessage();
  } catch (err: any) {
    console.error('[ai] Erro ao chamar OpenAI:', {
      message: err?.message,
      status: err?.status,
      code: err?.code,
      type: err?.type,
      model: config.openai.model,
      keyPrefix: config.openai.apiKey?.slice(0, 10) + '...',
    });
    return getFallbackMessage();
  }
}

/**
 * Builds the system prompt with Grupo Futura União identity.
 * Intent adjusts focus; productType injects curated facts.
 */
function buildSystemPrompt(
  contactName: string,
  intent: Intent,
  productType: ProductType | null,
  options: GenerateOptions,
): string {
  const intentContext = intent === 'quote'
    ? 'O corretor quer fazer uma cotação. O fluxo de cotação será tratado separadamente — apenas confirme que vai iniciar a coleta de dados.'
    : intent === 'handoff'
    ? 'O corretor quer falar com um humano. Confirme que vai transferir e inclua [TRANSFER] no final da sua resposta.'
    : intent === 'greeting'
    ? 'O corretor está iniciando uma conversa. Cumprimente de forma acolhedora e pergunte como pode ajudar.'
    : 'Responda à pergunta do corretor com base em seu conhecimento sobre seguros.';

  const sessionContext = options.isNewSession
    ? '\nEsta é uma nova sessão (mais de 30 minutos desde a última interação). Cumprimente novamente de forma breve.'
    : '';

  const productFactsBlock = productType !== null
    ? `\n## Informações sobre ${insuranceFacts[productType].productName}\n${formatFactsBlock(insuranceFacts[productType])}\n`
    : '';

  return `Você é a Luna, assistente virtual do Grupo Futura União, uma assessoria de seguros que atende exclusivamente corretores de seguros.

## Sobre o Grupo Futura União
- Fundado em 2009, com filiais em São Paulo, Santos e ABC
- Composto pelas assessorias Futura União e ABI
- Trabalha com diversos ramos de seguros
- Missão: "Ressignificamos o conceito de consultoria para gerar novas oportunidades"
- Atende APENAS corretores de seguros, não clientes finais

## Corretor atual: ${contactName}
${intentContext}${sessionContext}
${productFactsBlock}
## Suas capacidades
- Tirar dúvidas sobre seguros (saúde, auto, vida, residencial, empresarial)
- Explicar processos da Futura União (como enviar propostas, prazos, documentação)
- Informar sobre operadoras e seguradoras parceiras
- Regras básicas de subscrição/aceitação
- Comissões e repasses (informações gerais)
- Sinistros — orientações gerais de como proceder
- Regulamentações — ANS, SUSEP, regras básicas do mercado

## Regras de comportamento
1. Seja profissional mas acessível — você fala com profissionais do mercado de seguros
2. NUNCA invente informações, preços, valores, tabelas ou percentuais de comissão
3. Se não souber algo, seja honesta e ofereça transferir para um consultor humano
4. Mantenha respostas concisas — é WhatsApp, ninguém quer ler um textão (máximo ~300 palavras)
5. Use emojis com moderação para deixar a conversa mais leve (1-2 por mensagem, no máximo)
6. Identifique a intenção do corretor mesmo sem ele usar o menu numérico
7. Se o corretor mencionar múltiplos assuntos, trate todos na mesma resposta
8. Recuse educadamente qualquer assunto não relacionado a seguros
9. Responda sempre em português brasileiro natural
10. Você é a Luna, assistente virtual — nunca finja ser humana

## Marcadores especiais (use quando apropriado)
- Se o corretor pedir para falar com humano/atendente/especialista, inclua [TRANSFER] no final da sua resposta
- Se você não souber responder com confiança e perceber frustração, inclua [TRANSFER] no final
- Esses marcadores NÃO são mostrados ao corretor, são processados pelo sistema`;
}

/**
 * Formats an InsuranceFacts object into a readable text block for the system prompt.
 */
function formatFactsBlock(facts: InsuranceFacts): string {
  const lines: string[] = [];

  lines.push(`Produto: ${facts.productName}`);
  lines.push(facts.description);
  lines.push('');
  lines.push('Coberturas comuns (verifique apólice para valores exatos):');
  facts.commonCoverages.forEach((c) => lines.push(`- ${c}`));
  lines.push('');
  lines.push('Exclusões comuns:');
  facts.commonExclusions.forEach((e) => lines.push(`- ${e}`));
  lines.push('');
  lines.push('Regras de aceitação típicas:');
  facts.acceptanceRules.forEach((r) => lines.push(`- ${r}`));
  lines.push('');
  lines.push('Notas importantes:');
  facts.importantNotes.forEach((n) => lines.push(`- ${n}`));

  return lines.join('\n');
}

function getFallbackMessage(): string {
  return 'Desculpe, tive um problema ao processar sua mensagem. Pode tentar novamente? 😊';
}
