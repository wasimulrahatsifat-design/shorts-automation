import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Octokit } from 'octokit';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data_json, showSubtitles, duration } = body;

    if (!data_json || !data_json.topic || !data_json.script) {
      throw new Error('Invalid data payload. Must contain topic and script.');
    }

    const script = data_json.script;
    const topic = data_json.topic;

    // Generate TTS Audio
    let tts_url = null;
    let tts_urls = [];
    const voiceId = 'pNInz6obpgDQGcFmaJgB'; // Adam
    
    try {
      if (data_json.format === 'Quiz' && data_json.questions) {
        // Generate a separate audio file for each question for perfect sync
        const generateTTSForText = async (text: string) => {
          const elResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'xi-api-key': process.env.ELEVENLABS_API_KEY || '' },
            body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
          });
          if (!elResponse.ok) throw new Error(`ElevenLabs API error`);
          const audioBuffer = Buffer.from(await elResponse.arrayBuffer());
          const ttsFileName = `tts_${crypto.randomUUID()}.mp3`;
          await supabase.storage.from('shorts').upload(ttsFileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true });
          const { data: publicUrlData } = supabase.storage.from('shorts').getPublicUrl(ttsFileName);
          return publicUrlData.publicUrl;
        };

        const promises = data_json.questions.map((q: any) => {
          const text = `${q.question} A, ${q.options[0]}, B, ${q.options[1]}, C, ${q.options[2]}.`;
          return generateTTSForText(text);
        });
        
        tts_urls = await Promise.all(promises);
        
      } else {
        // Standard single TTS logic
        const elResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'xi-api-key': process.env.ELEVENLABS_API_KEY || '' },
          body: JSON.stringify({ text: script, model_id: 'eleven_multilingual_v2' }),
        });
        if (!elResponse.ok) throw new Error(`ElevenLabs API error: ${elResponse.statusText}`);
        const audioBuffer = Buffer.from(await elResponse.arrayBuffer());
        const ttsFileName = `tts_${crypto.randomUUID()}.mp3`;
        const { error: uploadError } = await supabase.storage.from('shorts').upload(ttsFileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true });
        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage.from('shorts').getPublicUrl(ttsFileName);
          tts_url = publicUrlData.publicUrl;
        }
      }
      }
    } catch (ttsError) {
      console.error('TTS Generation failed:', ttsError);
    }

    // Insert into Supabase
    const { data: dbData, error } = await supabase
      .from('shorts_queue')
      .insert([
        {
          topic: topic,
          data_json: {
            ...data_json,
            tts_url: tts_url,
            tts_urls: tts_urls,
            show_subtitles: showSubtitles,
            duration_seconds: duration
          },
          status: 'Pending', // Status is Pending until GitHub Action picks it up
        },
      ])
      .select();

    if (error) {
      throw error;
    }

    const videoId = dbData[0].id;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;

    if (!owner || !repo) {
       console.warn('GITHUB_OWNER or GITHUB_REPO is not configured. Skipping workflow trigger.');
    } else {
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
        console.log(`Successfully triggered GitHub Action for video_id: ${videoId}`);
      } catch (ghError) {
        console.error('Failed to trigger GitHub Action:', ghError);
      }
    }

    return NextResponse.json({ success: true, data: dbData });
  } catch (error: any) {
    console.error('Error queuing video:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
