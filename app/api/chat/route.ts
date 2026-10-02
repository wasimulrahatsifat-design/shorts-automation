import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { GEMINI_FALLBACK_MODELS } from '@/lib/gemini';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, history = [], masterPrompt, category = 'Time lapse' } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ success: false, error: 'Message is required.' }, { status: 400 });
    }

    delete process.env.GOOGLE_API_KEY;
    const ai1 = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const defaultSystemInstruction = `You are a world-class AI Video Producer, Creative Director, and Prompt Engineering Master specializing in viral YouTube Shorts, TikToks, and Reels for "${category}".

When the user asks for concepts, ideas, or prompts:
1. Provide actionable, high-performing concepts with exact Days breakdown (e.g. Day 0, Day 15, Day 30, Day 60, Day 90).
2. Write exact, hyper-detailed Image/Video generation prompts optimized for Midjourney v6, Kling AI, Luma Dream Machine, Runway Gen-3, Pika, and Hailuo.
3. Suggest punchy, high-CTR titles in clean Quicksand style.
4. Keep answers structured with clear headings, bullet points, and codeblocks for prompts so the user can easily copy them.`;

    const systemInstruction = (masterPrompt && masterPrompt.trim()) ? masterPrompt.trim() : defaultSystemInstruction;

    // Build conversation contents for @google/genai
    const contents: any[] = [];

    if (Array.isArray(history)) {
      for (const h of history) {
        if (h && h.text && typeof h.text === 'string') {
          contents.push({
            role: h.role === 'model' ? 'model' : 'user',
            parts: [{ text: h.text }],
          });
        }
      }
    }

    contents.push({
      role: 'user',
      parts: [{ text: message.trim() }],
    });

    const tryChatWithClient = async (client: GoogleGenAI, keyIndex: number): Promise<string> => {
      for (let i = 0; i < GEMINI_FALLBACK_MODELS.length; i++) {
        const model = GEMINI_FALLBACK_MODELS[i];
        try {
          console.log(`[Chat API] Generating with model: ${model} (Key ${keyIndex})`);
          const response = await client.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction,
              temperature: 0.85,
            },
          });
          if (response.text) return response.text;
        } catch (err: any) {
          console.warn(`[Chat API] Model ${model} failed with Key ${keyIndex}: ${err.message}`);
          if (i === GEMINI_FALLBACK_MODELS.length - 1) {
            throw err;
          }
        }
      }
      return '';
    };

    let reply = '';
    try {
      reply = await tryChatWithClient(ai1, 1);
    } catch (err: any) {
      if (process.env.GEMINI_API_KEY_2) {
        console.log('[Chat API] Falling back to GEMINI_API_KEY_2');
        const ai2 = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY_2 });
        try {
          reply = await tryChatWithClient(ai2, 2);
        } catch (err2: any) {
          throw new Error(`Both Gemini keys failed: ${err2.message}`);
        }
      } else {
        throw err;
      }
    }

    return NextResponse.json({ success: true, reply });
  } catch (error: any) {
    console.error('[Chat API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate chat response.' },
      { status: 500 }
    );
  }
}
