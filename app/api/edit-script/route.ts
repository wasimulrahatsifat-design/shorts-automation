import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Delete GOOGLE_API_KEY to prevent @google/genai SDK from prioritizing it over GEMINI_API_KEY
delete process.env.GOOGLE_API_KEY;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: Request) {
  try {
    const { currentScript, userInstruction } = await request.json();

    if (!currentScript || !userInstruction) {
      return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    const prompt = `You are an AI script editor. Here is the current JSON script for a video: ${currentScript}. The user wants to modify it with this instruction: ${userInstruction}. Apply the changes perfectly and return ONLY the updated JSON structure. Do not wrap in markdown blocks, just raw JSON.`;

    const fallbackModels = ['gemini-1.5-flash-8b', 'gemini-1.5-flash-latest', 'gemini-1.5-pro-latest'];
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
    
    // Parse just to ensure it's valid JSON
    let generatedData;
    try {
      generatedData = JSON.parse(cleanedText);
    } catch (e) {
      throw new Error('Failed to parse Gemini response as JSON.');
    }

    return NextResponse.json({ success: true, newScript: JSON.stringify(generatedData, null, 2) });
  } catch (error: any) {
    console.error('Error in edit-script:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
