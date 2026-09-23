import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { uploadToStorageWithFailover } from '@/lib/supabase';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_IMAGE_API_KEY });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = body.prompt;

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'Prompt is required.' }, { status: 400 });
    }

    console.log(`Generating image for prompt: "${prompt}"`);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: prompt + ' (Vertical 9:16 composition)',
      config: {
        responseModalities: ["IMAGE"],
      } as any
    });

    if (!response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
      throw new Error('Failed to generate image or unrecognized response format from Google AI.');
    }

    const base64String = response.candidates[0].content.parts[0].inlineData.data;
    const imageBuffer = Buffer.from(base64String, 'base64');

    const fileName = `img_${crypto.randomUUID()}.jpg`;
    
    console.log(`Uploading ${fileName} to Supabase...`);
    const { publicUrl } = await uploadToStorageWithFailover('shorts', fileName, imageBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

    return NextResponse.json({ success: true, url: publicUrl });

  } catch (error: any) {
    console.error('Error generating image:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status === 429 || error.message?.includes('429') ? 429 : 500 }
    );
  }
}
