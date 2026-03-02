// src/services/ai.ts
// OpenAI Chat Completions service — Luna / Grupo Futura União
import OpenAI from 'openai';
import { config } from '../config';
import { Intent } from './intent';
import { ProductType, InsuranceFacts } from '../types/index';
import { insuranceFacts } from '../data/insuranceFacts';
import { OpenAIError } from '../errors';

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
  imageUrl?: string,
): Promise<string> {
  const systemPrompt = buildSystemPrompt(contactName, intent, productType, options);

  // Build user message — with image content array if imageUrl is provided
  const userContent: OpenAI.Chat.ChatCompletionContentPart[] | string = imageUrl
    ? [
        { type: 'text' as const, text: currentMessage },
        { type: 'image_url' as const, image_url: { url: imageUrl } },
      ]
    : currentMessage;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...historyMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: userContent },
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
    const wrappedErr = new OpenAIError('Failed to generate AI response', err);
    console.error('[ai] Erro ao chamar OpenAI:', {
      message: err?.message,
      status: err?.status,
      code: err?.code,
      type: err?.type,
      model: config.openai.model,
      keyPrefix: config.openai.apiKey?.slice(0, 10) + '...',
      wrappedCode: wrappedErr.code,
    });
    return getFallbackMessage();
  }
}

/**
 * Builds the system prompt with Grupo Futura União identity.
 * Intent adjusts focus; productType injects curated facts.
 */
export function buildSystemPrompt(
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

  return `Você é a Luna, assistente virtual do Grupo Futura União — uma assessoria de seguros que atende exclusivamente corretores.

## Sobre o Grupo Futura União
- Fundado em 2009, filiais em SP, Santos e ABC
- Assessorias Futura União e ABI
- Missão: "Ressignificamos o conceito de consultoria para gerar novas oportunidades"
- Público: APENAS corretores de seguros, nunca clientes finais

## Corretor atual: ${contactName}
${intentContext}${sessionContext}
${productFactsBlock}
## O que você sabe fazer
- Dúvidas sobre seguros (saúde, auto, vida, residencial, empresarial)
- Processos da Futura União (propostas, prazos, documentação)
- Operadoras e seguradoras parceiras
- Subscrição, aceitação, comissões e repasses (informações gerais)
- Sinistros — orientações de como proceder
- Regulamentações — ANS, SUSEP, regras do mercado

## Estilo de escrita
- Você está no WhatsApp: parágrafos curtos (2-3 linhas no máximo), linguagem direta
- Tom informal-profissional: use "pra", "tá", "beleza", "tranquilo" naturalmente
- Varie suas aberturas — nunca comece duas respostas seguidas do mesmo jeito
- Alterne expressões: "Show!", "Beleza!", "Entendi!", "Boa!", "Tranquilo!" em vez de sempre "Perfeito!"
- Emojis com moderação (1-2 por mensagem, no máximo)
- Máximo ~250 palavras por resposta

## Princípios
1. Fale como colega de profissão — natural, direto, sem formalidade excessiva
2. Nunca invente dados: preços, tabelas, comissões ou percentuais
3. Não sabe? Seja honesta e ofereça transferir pra um consultor humano
4. Identifique a intenção do corretor mesmo sem menu numérico
5. Recuse com jeitinho qualquer assunto fora de seguros
6. Você é a Luna, assistente virtual — nunca finja ser humana

## Marcadores especiais (processados pelo sistema, invisíveis pro corretor)
- Corretor pede humano/atendente/especialista → inclua [TRANSFER] no final
- Não sabe responder com confiança e percebe frustração → inclua [TRANSFER] no final`;
}

/**
 * Formats an InsuranceFacts object into a readable text block for the system prompt.
 */
export function formatFactsBlock(facts: InsuranceFacts): string {
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

export function getFallbackMessage(): string {
  return 'Desculpe, tive um problema ao processar sua mensagem. Pode tentar novamente? 😊';
}
