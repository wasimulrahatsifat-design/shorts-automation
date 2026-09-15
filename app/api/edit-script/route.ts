import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: Request) {
  try {
    const { currentScript, userInstruction } = await request.json();

    if (!currentScript || !userInstruction) {
      return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    const prompt = `You are an AI script editor. Here is the current JSON script for a video: ${currentScript}. The user wants to modify it with this instruction: ${userInstruction}. Apply the changes perfectly and return ONLY the updated JSON structure. Do not wrap in markdown blocks, just raw JSON.`;

    const fallbackModels = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-flash-latest'];
    let text = '';
    
    for (let i = 0; i < fallbackModels.length; i++) {
      try {
        console.log(`Attempting Gemini generation with model: ${fallbackModels[i]}`);
        const response = await ai.models.generateContent({
          model: fallbackModels[i],
          contents: prompt,
        });
        text = response.text;
        break; // Success! Break out of the fallback loop.
      } catch (err: any) {
        console.warn(`Model ${fallbackModels[i]} failed: ${err.message}`);
        if (i === fallbackModels.length - 1) {
          throw new Error(`All Gemini models failed. Last error: ${err.message}`);
        }
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
