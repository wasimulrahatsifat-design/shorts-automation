import { GoogleGenAI } from '@google/genai';

// Modern, active Gemini models list in order of speed and stability
export const GEMINI_FALLBACK_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-flash-latest'
];

/**
 * Robustly parses JSON from LLM output, handling markdown code blocks,
 * conversational wrappers, preambles, and minor formatting imperfections.
 */
export function parseGeminiJson(rawText: string): any {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty response received from Gemini.');
  }

  // 1. Strip markdown fences if present
  let text = rawText.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // 2. Direct parse attempt
  try {
    return JSON.parse(text);
  } catch (e1: any) {
    // 3. Extract JSON object {...} or array [...] if there is conversational text before/after
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = text.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate);
      } catch (e2) {
        // Try cleaning trailing commas: e.g. [1, 2, ] or {"a": 1, }
        const cleaned = candidate.replace(/,\s*([}\]])/g, '$1');
        try {
          return JSON.parse(cleaned);
        } catch (e3) {
          // continue
        }
      }
    }

    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      const candidate = text.substring(firstBracket, lastBracket + 1);
      try {
        return JSON.parse(candidate);
      } catch (e4) {
        const cleaned = candidate.replace(/,\s*([}\]])/g, '$1');
        try {
          return JSON.parse(cleaned);
        } catch (e5) {
          // continue
        }
      }
    }

    console.error('Failed to parse Gemini response as JSON. Raw text was:\n', rawText);
    throw new Error('Failed to parse Gemini response as JSON.');
  }
}

/**
 * Executes a generation request across models and backup keys with JSON constraint.
 */
export async function generateGeminiJson(prompt: string, options?: { temperature?: number }): Promise<any> {
  // Delete GOOGLE_API_KEY to prevent @google/genai SDK from prioritizing it over GEMINI_API_KEY
  delete process.env.GOOGLE_API_KEY;
  const ai1 = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const tryGenerateWithClient = async (client: GoogleGenAI, keyIndex: number): Promise<string> => {
    for (let i = 0; i < GEMINI_FALLBACK_MODELS.length; i++) {
      const model = GEMINI_FALLBACK_MODELS[i];
      try {
        console.log(`Attempting Gemini generation with model: ${model} (Key ${keyIndex})`);
        const response = await client.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: options?.temperature ?? 0.95
          }
        });
        if (response.text) return response.text;
      } catch (err: any) {
        console.warn(`Model ${model} failed with Key ${keyIndex}: ${err.message}`);
        if (i === GEMINI_FALLBACK_MODELS.length - 1) {
          throw err;
        }
      }
    }
    return '';
  };

  let rawText = '';
  try {
    rawText = await tryGenerateWithClient(ai1, 1);
  } catch (err: any) {
    if (process.env.GEMINI_API_KEY_2) {
      console.log('Falling back to GEMINI_API_KEY_2');
      const ai2 = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY_2 });
      try {
        rawText = await tryGenerateWithClient(ai2, 2);
      } catch (err2: any) {
        throw new Error(`Both Gemini keys failed. Last error: ${err2.message}`);
      }
    } else {
      throw new Error(`All Gemini models failed. Last error: ${err.message}`);
    }
  }

  return parseGeminiJson(rawText);
}
