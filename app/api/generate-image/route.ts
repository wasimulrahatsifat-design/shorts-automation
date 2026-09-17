import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: prompt,
      numberOfImages: 1,
      outputMimeType: 'image/jpeg',
      aspectRatio: '9:16'
    });

    const base64String = response.generatedImages[0].image.imageBytes;
    const imageBuffer = Buffer.from(base64String, 'base64');

    const fileName = `img_${crypto.randomUUID()}.jpg`;
    
    console.log(`Uploading ${fileName} to Supabase...`);
    const { error: uploadError } = await supabase.storage
      .from('shorts')
      .upload(fileName, imageBuffer, { contentType: 'image/jpeg', upsert: true });

    if (uploadError) {
      throw new Error(`Failed to upload image to Supabase: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage.from('shorts').getPublicUrl(fileName);
    const publicUrl = publicUrlData.publicUrl;

    return NextResponse.json({ success: true, url: publicUrl });

  } catch (error: any) {
    console.error('Error generating image:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
