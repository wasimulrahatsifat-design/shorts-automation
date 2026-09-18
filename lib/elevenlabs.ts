/**
 * Helper to retrieve all configured ElevenLabs API keys from environment variables.
 * Supports:
 * - ELEVENLABS_API_KEY
 * - ELEVENLABS_API_KEY_1, ELEVENLABS_API_KEY_2, ELEVENLABS_API_KEY_3, ... ELEVENLABS_API_KEY_20
 * - ELEVENLABS_API_KEYS (comma-separated list of keys)
 */
export function getElevenLabsApiKeys(): string[] {
  const keys: string[] = [];

  const addKey = (k?: string) => {
    if (k && typeof k === 'string') {
      const trimmed = k.trim();
      if (trimmed && !keys.includes(trimmed)) {
        keys.push(trimmed);
      }
    }
  };

  addKey(process.env.ELEVENLABS_API_KEY);
  addKey(process.env.ELEVENLABS_API_KEY_1);
  addKey(process.env.ELEVENLABS_API_KEY_2);

  // Dynamically check indexed keys up to 30
  for (let i = 3; i <= 30; i++) {
    addKey(process.env[`ELEVENLABS_API_KEY_${i}`]);
  }

  // Also check comma-separated list if provided
  if (process.env.ELEVENLABS_API_KEYS) {
    const list = process.env.ELEVENLABS_API_KEYS.split(',');
    list.forEach(addKey);
  }

  return keys;
}

/**
 * Calls ElevenLabs text-to-speech API with automatic multi-key fallback across
 * all configured keys (ELEVENLABS_API_KEY, ELEVENLABS_API_KEY_2, _3, _4, etc.).
 */
export async function fetchElevenLabsTTS(
  text: string,
  voiceId: string = 'pNInz6obpgDQGcFmaJgB',
  modelId: string = 'eleven_multilingual_v2'
): Promise<Response> {
  const keys = getElevenLabsApiKeys();

  if (keys.length === 0) {
    throw new Error('No ElevenLabs API keys configured in environment variables.');
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const payload = JSON.stringify({ text, model_id: modelId });

  let lastStatus = 0;
  let lastErrorMsg = '';

  for (let i = 0; i < keys.length; i++) {
    const apiKey = keys[i];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: payload,
      });

      if (res.ok) {
        return res;
      }

      lastStatus = res.status;
      lastErrorMsg = res.statusText;

      // If quota exceeded (429) or unauthorized/expired (401), try the next key
      if (res.status === 429 || res.status === 401) {
        console.warn(`[ElevenLabs] Key #${i + 1} exhausted/failed with status ${res.status} (${res.statusText}). Trying next key...`);
        continue;
      }

      // Other HTTP errors (e.g. 5xx or bad request)
      const errBody = await res.text().catch(() => '');
      lastErrorMsg = `${res.statusText} - ${errBody}`;
      console.warn(`[ElevenLabs] Key #${i + 1} failed: ${lastErrorMsg}. Trying next key...`);
    } catch (err: any) {
      lastErrorMsg = err.message || 'Network error';
      console.warn(`[ElevenLabs] Key #${i + 1} request threw error: ${lastErrorMsg}. Trying next key...`);
    }
  }

  throw new Error(`All ${keys.length} ElevenLabs API keys failed (Last status: ${lastStatus}, error: ${lastErrorMsg})`);
}
