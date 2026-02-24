// src/services/ai.ts
// OpenAI Chat Completions service — CORE-05
// Uses SDK v4.104.0 (already installed): openai.chat.completions.create()
import OpenAI from 'openai';
import { config } from '../config';
import { Intent } from './intent';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

/**
 * Generate an AI response for the broker using conversation history and current message.
 * Returns a fallback string if OpenAI returns empty content.
 *
 * IMPORTANT: historyMessages role must be cast — Prisma returns role as string,
 * but ChatCompletionMessageParam requires 'user' | 'assistant'. Cast is safe because
 * only 'user' and 'assistant' values are ever written by saveMessage().
 */
export async function generateResponse(
  contactName: string,
  historyMessages: Array<{ role: string; content: string }>,
  currentMessage: string,
  intent: Intent,
): Promise<string> {
  const systemPrompt = buildSystemPrompt(contactName, intent);

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
  } catch (err) {
    console.error('[ai] Erro ao chamar OpenAI:', err);
    return getFallbackMessage();
  }
}

/**
 * Builds the system prompt. Intent is used internally to adjust focus instructions
 * but is NOT exposed verbatim to avoid leaking routing internals to the broker.
 * This function must remain a function (not a config string) — it grows in Phase 3.
 */
function buildSystemPrompt(contactName: string, intent: Intent): string {
  const intentContext = intent === 'quote'
    ? 'O corretor está interessado em fazer uma cotação. Colete informações necessárias e informe que o fluxo completo de cotação estará disponível em breve.'
    : intent === 'handoff'
    ? 'O corretor quer falar com um humano. Confirme que você vai transferir a conversa.'
    : intent === 'greeting'
    ? 'O corretor está iniciando uma conversa. Responda de forma acolhedora e pergunte como pode ajudar.'
    : 'Responda à pergunta do corretor com base em seu conhecimento sobre seguros.';

  return `Você é a Issy, assistente virtual da assessoria de seguros. Você ajuda corretores de seguros a responder dúvidas sobre produtos, coberturas e aceitação.

Corretor atual: ${contactName}
${intentContext}

Regras de comportamento:
- Responda SEMPRE em português brasileiro, tom profissional e conciso
- NUNCA invente valores de R$, coberturas específicas ou regras de aceitação — diga que não tem certeza e ofereça escalar para um humano
- Se não souber responder, diga exatamente: "Não tenho essa informação no momento. Posso transferir para um especialista da assessoria — deseja que eu faça isso?"
- Foque em: produtos de seguro (saúde, auto, vida, residencial, empresarial), coberturas, exclusões, aceitação
- Recuse educadamente qualquer assunto não relacionado a seguros
- Nunca responda como se fosse um humano — você é a Issy, assistente virtual`;
}

function getFallbackMessage(): string {
  return 'Desculpe, ocorreu um problema ao processar sua mensagem. Por favor, tente novamente em alguns instantes.';
}
