import { NextResponse } from 'next/server';
import { Octokit } from 'octokit';
import { fetchElevenLabsTTS } from '@/lib/elevenlabs';
import { uploadToStorageWithFailover, executeWithSupabaseFailover } from '@/lib/supabase';
import { generateArenaSimulation } from '@/lib/arena-physics';

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
    
    const fetchElevenLabs = (text: string) => fetchElevenLabsTTS(text, voiceId);

    try {
      if ((data_json.format === 'Quiz' || Array.isArray(data_json.questions)) && data_json.questions) {
        // Generate a separate audio file for each question for perfect sync
        const generateTTSForText = async (text: string) => {
          const elResponse = await fetchElevenLabs(text);
          const audioBuffer = Buffer.from(await elResponse.arrayBuffer());
          const ttsFileName = `tts_${crypto.randomUUID()}.mp3`;
          const { publicUrl } = await uploadToStorageWithFailover('shorts', ttsFileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true });
          return publicUrl;
        };

        for (const q of data_json.questions) {
          const text = `${q.question} A, ${q.options[0]}, B, ${q.options[1]}, C, ${q.options[2]}.`;
          const url = await generateTTSForText(text);
          tts_urls.push(url);
        }
        
        // Add custom end_title outro TTS only if end_title is provided
        const outroText = (data_json.end_title || '').trim();
        if (outroText) {
          const outroUrl = await generateTTSForText(outroText);
          tts_urls.push(outroUrl);
        }
        
      } else if (data_json.format === 'Would You Rather' && data_json.scenarios) {
        const generateTTSForText = async (text: string) => {
          const elResponse = await fetchElevenLabs(text);
          const audioBuffer = Buffer.from(await elResponse.arrayBuffer());
          const ttsFileName = `tts_${crypto.randomUUID()}.mp3`;
          const { publicUrl } = await uploadToStorageWithFailover('shorts', ttsFileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true });
          return publicUrl;
        };

        for (let i = 0; i < data_json.scenarios.length; i++) {
          const s = data_json.scenarios[i];
          const cleanA = (s.option_a || '').replace(/^would you rather\s+/i, '').trim();
          const cleanB = (s.option_b || '').replace(/^would you rather\s+/i, '').trim();
          const text = i === 0
            ? `Would you rather ${cleanA} or ${cleanB}?`
            : `${cleanA.charAt(0).toUpperCase() + cleanA.slice(1)} or ${cleanB}?`;
          const url = await generateTTSForText(text);
          tts_urls.push(url);
        }
        
        // Add custom end_title outro TTS only if end_title is provided
        const outroText = (data_json.end_title || '').trim();
        if (outroText) {
          const outroUrl = await generateTTSForText(outroText);
          tts_urls.push(outroUrl);
        }
      } else if (data_json.format === 'AestheticVideo') {
        // Aesthetic videos don't require TTS audio
        tts_url = null;
      } else if (data_json.format === 'Arena Clash' && !script) {
        // Arena Clash without script can use optional announcer tts_url
        tts_url = data_json.tts_url || null;
      } else {
        // Standard single TTS logic - append end_title if present
        let fullScript = script;
        if (data_json.end_title && typeof data_json.end_title === 'string' && data_json.end_title.trim() && !script.includes(data_json.end_title.trim())) {
          fullScript = `${script.trim()} ... ${data_json.end_title.trim()}`;
        }
        const elResponse = await fetchElevenLabs(fullScript);
        if (!elResponse.ok) throw new Error(`ElevenLabs API error: ${elResponse.statusText}`);
        const audioBuffer = Buffer.from(await elResponse.arrayBuffer());
        const ttsFileName = `tts_${crypto.randomUUID()}.mp3`;
        const { publicUrl } = await uploadToStorageWithFailover('shorts', ttsFileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true });
        tts_url = publicUrl;
      }
    } catch (ttsError: any) {
      console.error('TTS Generation failed:', ttsError);
      throw new Error(`Voice generation failed: ${ttsError?.message || ttsError}`);
    }

    let finalDuration = duration;
    const hasOutro = Boolean(data_json.end_title && data_json.end_title.trim());
    if (data_json.format === 'Would You Rather' && data_json.scenarios) {
      let totalSeconds = 0;
      for (let i = 0; i < data_json.scenarios.length; i++) {
        const s = data_json.scenarios[i];
        const prefixLength = i === 0 ? 17 : 0;
        const cleanA = (s.option_a || '').replace(/^would you rather\s+/i, '').trim();
        const cleanB = (s.option_b || '').replace(/^would you rather\s+/i, '').trim();
        const textLength = cleanA.length + cleanB.length + prefixLength + 4;
        const readingSeconds = Math.max(1.5, textLength / 21);
        totalSeconds += readingSeconds + 5; // timer 3s + reveal 2s
      }
      finalDuration = Math.round(totalSeconds + (hasOutro ? 2.8 : 0));
    } else if (data_json.format === 'Quiz' && data_json.questions) {
      let totalSeconds = 0;
      for (const q of data_json.questions) {
        const textLength = q.question.length + q.options.join('').length + 10;
        const readingSeconds = Math.max(1.8, textLength / 18);
        totalSeconds += readingSeconds + 5;
      }
      finalDuration = Math.round(totalSeconds + (hasOutro ? 2.8 : 0));
    } else if (data_json.format === 'Arena Clash' && data_json.contestants) {
      const sim = generateArenaSimulation(data_json.contestants, 3600, data_json.seed || 42);
      finalDuration = sim.totalSeconds;
    } else if (data_json.format === 'Arena Clash' && data_json.duration_seconds) {
      finalDuration = data_json.duration_seconds;
    }

    // Check if background music is enabled
    const isBgMusicEnabled = body.bg_music_enabled !== false && data_json.bg_music_enabled !== false;
    const finalBgMusicUrl = isBgMusicEnabled ? (body.bg_music_url || data_json.bg_music_url || undefined) : undefined;
    const finalBgMusicVolume = isBgMusicEnabled ? (typeof body.bg_music_volume === 'number' ? body.bg_music_volume : data_json.bg_music_volume) : undefined;

    // Insert into Supabase with failover
    const { data: dbData, error } = await executeWithSupabaseFailover((client) =>
      client
        .from('shorts_queue')
        .insert([
          {
            topic: topic,
            data_json: {
              ...data_json,
              tts_url: tts_url,
              tts_urls: tts_urls,
              bg_music_url: finalBgMusicUrl,
              bg_music_volume: finalBgMusicVolume,
              bg_music_enabled: isBgMusicEnabled,
              show_subtitles: showSubtitles,
              duration_seconds: finalDuration
            },
            status: 'Pending', // Status is Pending until GitHub Action picks it up
          },
        ])
        .select()
    );

    if (error || !dbData || dbData.length === 0) {
      throw error || new Error('Failed to insert video into database.');
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
