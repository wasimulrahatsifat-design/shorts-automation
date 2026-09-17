import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

delete process.env.GOOGLE_API_KEY;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userTopic = body.topic || 'Liminal pool rooms';

    const prompt = `Generate a unique "Aesthetic / Liminal Space" video concept based on this theme: "${userTopic}".
    Return a structured JSON object with EXACTLY these fields:
    - "topic": The generated topic/title as a string.
    - "format": "AestheticVideo".
    - "scenes": An array of EXACTLY 5 objects. Each object MUST have:
      - "image_keyword": A VERY SPECIFIC, highly descriptive image prompt optimized for Imagen 3 (focusing on lighting, mood, aesthetic composition, and photorealism).
      - "duration": Number representing the duration of the scene in frames (e.g., 150 for 5 seconds at 30fps).
    Do not wrap the response in markdown blocks like \`\`\`json, just return the raw JSON object.`;

    const fallbackModels = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.5-flash'];
    let text = '';
    
    const generateWithKey = async (client: any, keyIndex: number) => {
      for (let i = 0; i < fallbackModels.length; i++) {
        try {
          console.log(`Attempting Gemini generation with model: ${fallbackModels[i]} (Key ${keyIndex})`);
          const response = await client.models.generateContent({
            model: fallbackModels[i],
            contents: prompt,
          });
          return response.text || '';
        } catch (err: any) {
          console.warn(`Model ${fallbackModels[i]} failed with Key ${keyIndex}: ${err.message}`);
          if (i === fallbackModels.length - 1) {
            throw err;
          }
        }
      }
      return '';
    };

    try {
      text = await generateWithKey(ai, 1);
    } catch (err: any) {
      if (process.env.GEMINI_API_KEY_2) {
        console.log('Falling back to GEMINI_API_KEY_2');
        const ai2 = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY_2 });
        try {
          text = await generateWithKey(ai2, 2);
        } catch (err2: any) {
           throw new Error(`Both Gemini keys failed. Last error: ${err2.message}`);
        }
      } else {
        throw new Error(`All Gemini models failed. Last error: ${err.message}`);
      }
    }
    
    const cleanedText = text.replace(/```json\n?|```/g, '').trim();
    const generatedData = JSON.parse(cleanedText);

    if (!generatedData.topic) {
      throw new Error('Invalid data format returned from Gemini: missing topic.');
    }

    return NextResponse.json({ success: true, data: generatedData });
  } catch (error: any) {
    console.error('Error generating aesthetic draft script:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
