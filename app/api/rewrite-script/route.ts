import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { Octokit } from 'octokit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export async function POST(request: Request) {
  try {
    const { videoId, targetDuration } = await request.json();

    if (!videoId || !targetDuration) {
      return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    // 1. Fetch current row
    const { data: row, error: fetchError } = await supabase
      .from('shorts_queue')
      .select('*')
      .eq('id', videoId)
      .single();

    if (fetchError || !row) {
      throw new Error('Video not found');
    }

    const currentScript = row.data_json.script;
    const currentItems = JSON.stringify(row.data_json.items || []);
    
    // 2. Rewrite script with Gemini
    const prompt = `Rewrite this voiceover script to specifically fit a ${targetDuration}-second YouTube Short pacing. Make it engaging and fast-paced.
    Current script: "${currentScript}"
    
    You MUST return a JSON object with EXACTLY two fields:
    - "script": The rewritten voiceover script.
    - "items": Keep this exact data array, or update the labels/values to match the new script: ${currentItems}
    
    Do not wrap the response in markdown blocks like \`\`\`json, just return the raw JSON object.`;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
    });

    const text = response.text;
    const cleanedText = text.replace(/```json\n?|```/g, '').trim();
    let generatedData;
    try {
      generatedData = JSON.parse(cleanedText);
    } catch (e) {
      throw new Error('Failed to parse Gemini response as JSON.');
    }

    const newScript = generatedData.script;
    const newItems = generatedData.items;

    if (!newScript || !newItems || !Array.isArray(newItems)) {
      throw new Error('Invalid JSON format returned from Gemini in rewrite-script.');
    }

    // 3. Generate New TTS
    let tts_url = row.data_json.tts_url;
    try {
      const voiceId = 'pNInz6obpgDQGcFmaJgB'; // Adam
      const elResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY || '',
        },
        body: JSON.stringify({
          text: newScript,
          model_id: 'eleven_multilingual_v2',
        }),
      });

      if (!elResponse.ok) {
        throw new Error(`ElevenLabs API error: ${elResponse.statusText}`);
      }

      const audioBuffer = Buffer.from(await elResponse.arrayBuffer());
      const ttsFileName = `tts_${crypto.randomUUID()}.mp3`;

      const { error: uploadError } = await supabase.storage
        .from('shorts')
        .upload(ttsFileName, audioBuffer, {
          contentType: 'audio/mpeg',
          upsert: true,
        });

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage.from('shorts').getPublicUrl(ttsFileName);
        tts_url = publicUrlData.publicUrl;
      }
    } catch (ttsError) {
      console.error('TTS Generation failed:', ttsError);
    }

    // 4. Update Database
    const updatedDataJson = {
      ...row.data_json,
      script: newScript,
      items: newItems,
      tts_url: tts_url,
      duration_seconds: parseInt(targetDuration)
    };

    const { error: updateError } = await supabase
      .from('shorts_queue')
      .update({
        data_json: updatedDataJson,
        status: 'Pending' // Reset status to render again
      })
      .eq('id', videoId);

    if (updateError) throw updateError;

    // 5. Trigger GitHub Action
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;

    if (owner && repo) {
      try {
        await octokit.rest.actions.createWorkflowDispatch({
          owner,
          repo,
          workflow_id: 'render-video.yml',
          ref: 'main',
          inputs: {
            video_id: videoId,
          },
        });
      } catch (ghError) {
        console.error('Failed to trigger GitHub Action:', ghError);
      }
    }

    return NextResponse.json({ success: true, newScript });
  } catch (error: any) {
    console.error('Error rewriting script:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
