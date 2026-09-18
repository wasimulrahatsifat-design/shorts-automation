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

    if (!data_json || !data_json.topic) {
      throw new Error('Invalid data payload. Must contain topic.');
    }
    if (data_json.format !== 'Would You Rather' && data_json.format !== 'AestheticVideo' && data_json.format !== 'Arena Clash' && !data_json.script) {
      throw new Error('Invalid data payload. Must contain script.');
    }

    const script = data_json.script || '';
    const topic = data_json.topic;

    // Generate TTS Audio
    let tts_url = null;
    let tts_urls = [];
    const voiceId = data_json.voice_id || 'pNInz6obpgDQGcFmaJgB'; // Default to Adam if not specified
    
    const fetchElevenLabs = async (text: string) => {
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
      const payload = JSON.stringify({ text, model_id: 'eleven_multilingual_v2' });
      let res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': process.env.ELEVENLABS_API_KEY || '' },
        body: payload,
      });
      if (!res.ok && (res.status === 429 || res.status === 401) && process.env.ELEVENLABS_API_KEY_2) {
        console.log('Falling back to ELEVENLABS_API_KEY_2');
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'xi-api-key': process.env.ELEVENLABS_API_KEY_2 || '' },
          body: payload,
        });
      }
      if (!res.ok) throw new Error(`ElevenLabs API error: ${res.statusText}`);
      return res;
    };

    try {
      if ((data_json.format === 'Quiz' || Array.isArray(data_json.questions)) && data_json.questions) {
        // Generate a separate audio file for each question for perfect sync
        const generateTTSForText = async (text: string) => {
          const elResponse = await fetchElevenLabs(text);
          const audioBuffer = Buffer.from(await elResponse.arrayBuffer());
          const ttsFileName = `tts_${crypto.randomUUID()}.mp3`;
          await supabase.storage.from('shorts').upload(ttsFileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true });
          const { data: publicUrlData } = supabase.storage.from('shorts').getPublicUrl(ttsFileName);
          return publicUrlData.publicUrl;
        };

        for (const q of data_json.questions) {
          const text = `${q.question} A, ${q.options[0]}, B, ${q.options[1]}, C, ${q.options[2]}.`;
          const url = await generateTTSForText(text);
          tts_urls.push(url);
        }
        
        // Add "Thanks for watching" outro TTS
        const outroUrl = await generateTTSForText("Thanks for watching!");
        tts_urls.push(outroUrl);
        
      } else if (data_json.format === 'Would You Rather' && data_json.scenarios) {
        const generateTTSForText = async (text: string) => {
          const elResponse = await fetchElevenLabs(text);
          const audioBuffer = Buffer.from(await elResponse.arrayBuffer());
          const ttsFileName = `tts_${crypto.randomUUID()}.mp3`;
          await supabase.storage.from('shorts').upload(ttsFileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true });
          const { data: publicUrlData } = supabase.storage.from('shorts').getPublicUrl(ttsFileName);
          return publicUrlData.publicUrl;
        };

        for (const s of data_json.scenarios) {
          const text = `Would you rather ${s.option_a} or ${s.option_b}?`;
          const url = await generateTTSForText(text);
          tts_urls.push(url);
        }
        
        // Add "Thanks for watching" outro TTS
        const outroUrl = await generateTTSForText("Thanks for watching!");
        tts_urls.push(outroUrl);
      } else if (data_json.format === 'AestheticVideo') {
        // Aesthetic videos don't require TTS audio
        tts_url = null;
      } else if (data_json.format === 'Arena Clash' && !script) {
        // Arena Clash without script can use optional announcer tts_url
        tts_url = data_json.tts_url || null;
      } else {
        // Standard single TTS logic
        const elResponse = await fetchElevenLabs(script);
        if (!elResponse.ok) throw new Error(`ElevenLabs API error: ${elResponse.statusText}`);
        const audioBuffer = Buffer.from(await elResponse.arrayBuffer());
        const ttsFileName = `tts_${crypto.randomUUID()}.mp3`;
        const { error: uploadError } = await supabase.storage.from('shorts').upload(ttsFileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true });
        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage.from('shorts').getPublicUrl(ttsFileName);
          tts_url = publicUrlData.publicUrl;
        }
      }
    } catch (ttsError) {
      console.error('TTS Generation failed:', ttsError);
    }

    let finalDuration = duration;
    if (data_json.format === 'Would You Rather' && data_json.scenarios) {
      let totalSeconds = 0;
      for (const s of data_json.scenarios) {
        const textLength = s.option_a.length + s.option_b.length + 20;
        const readingSeconds = (textLength / 15) + 1;
        totalSeconds += readingSeconds + 5; // timer 3s + reveal 2s
      }
      finalDuration = Math.round(totalSeconds + 3); // + outro
    } else if (data_json.format === 'Quiz' && data_json.questions) {
      let totalSeconds = 0;
      for (const q of data_json.questions) {
        const textLength = q.question.length + q.options.join('').length + 10;
        const readingSeconds = (textLength / 15) + 1;
        totalSeconds += readingSeconds + 7;
      }
    } else if (data_json.format === 'Arena Clash' && data_json.duration_seconds) {
      finalDuration = data_json.duration_seconds;
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
            duration_seconds: finalDuration
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
