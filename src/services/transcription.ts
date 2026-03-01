// src/services/transcription.ts
// Audio transcription via OpenAI Whisper — receives Z-API audio URL, returns text

import OpenAI from 'openai';
import { config } from '../config';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

/**
 * Download audio from Z-API URL and transcribe via Whisper.
 * Z-API serves OGG/opus which Whisper accepts natively — no conversion needed.
 * Returns transcribed text, or null if transcription fails.
 */
export async function transcribeAudio(audioUrl: string): Promise<string | null> {
  try {
    const response = await fetch(audioUrl);
    if (!response.ok) {
      console.error(`[transcription] Failed to download audio: ${response.status}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const file = new File([buffer], 'audio.ogg', { type: 'audio/ogg' });

    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      language: 'pt',
    });

    const text = transcription.text?.trim();
    if (!text) return null;

    console.log(`[transcription] Transcribed ${text.length} chars from audio`);
    return text;
  } catch (err: any) {
    console.error('[transcription] Whisper error:', err?.message);
    return null;
  }
}
