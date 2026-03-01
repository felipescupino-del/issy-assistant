// src/services/transcription.ts
// Audio transcription via OpenAI Whisper — receives Z-API audio URL, returns text

import OpenAI, { toFile } from 'openai';
import axios from 'axios';
import { config } from '../config';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

/**
 * Download audio from Z-API URL and transcribe via Whisper.
 * Z-API serves OGG/opus which Whisper accepts natively — no conversion needed.
 * Uses OpenAI's toFile() helper for Node.js compatibility (no Web File API needed).
 */
export async function transcribeAudio(audioUrl: string): Promise<string | null> {
  try {
    const response = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 15_000 });
    const buffer = Buffer.from(response.data);
    const file = await toFile(buffer, 'audio.ogg', { type: 'audio/ogg' });

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
