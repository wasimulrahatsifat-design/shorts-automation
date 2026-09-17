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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: prompt + ' (Vertical 9:16 composition)',
      config: {
        responseModalities: ["IMAGE"],
        outputOptions: {
          mimeType: "image/jpeg",
        },
        // For some versions of the SDK, aspect ratio needs to be passed via specific image options if supported, 
        // but by default imagen-3 will output 1:1 if we don't specify. The official docs say to put it in config.
        // If the SDK throws on unknown keys, we might need to remove it, but let's try this:
        // Actually the SDK docs for `generateContent` might not strictly support `aspectRatio` here.
        // Let's pass the prompt to request a vertical 9:16 image.
      }
    });

    if (!response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
      throw new Error('Failed to generate image or unrecognized response format from Google AI.');
    }

    const base64String = response.candidates[0].content.parts[0].inlineData.data;
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
      { status: error.status === 429 || error.message?.includes('429') ? 429 : 500 }
    );
  }
}
