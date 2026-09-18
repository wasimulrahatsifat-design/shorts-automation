import { NextResponse } from 'next/server';
import { generateGeminiJson } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const { currentScript, userInstruction } = await request.json();

    if (!currentScript || !userInstruction) {
      return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    const scriptText = typeof currentScript === 'string' ? currentScript : JSON.stringify(currentScript, null, 2);

    const prompt = `You are an AI video script editor.
Here is the current JSON script for the video:
${scriptText}

The user wants to modify it with this instruction:
"${userInstruction}"

Apply the requested changes accurately while preserving valid structure and all required fields.
Return ONLY the complete updated JSON object.`;

    const generatedData = await generateGeminiJson(prompt);

    return NextResponse.json({ success: true, newScript: JSON.stringify(generatedData, null, 2) });
  } catch (error: any) {
    console.error('Error in edit-script:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

