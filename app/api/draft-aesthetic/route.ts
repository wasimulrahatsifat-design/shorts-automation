import { NextResponse } from 'next/server';
import { generateGeminiJson } from '@/lib/gemini';

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

    const generatedData = await generateGeminiJson(prompt);

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
