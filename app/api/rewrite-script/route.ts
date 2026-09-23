import { NextResponse } from 'next/server';
import { Octokit } from 'octokit';
import { generateGeminiJson } from '@/lib/gemini';
import { fetchElevenLabsTTS } from '@/lib/elevenlabs';
import { findVideoAcrossProjects, uploadToStorageWithFailover } from '@/lib/supabase';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// No image generation logic here anymore

export async function POST(request: Request) {
  try {
    const { videoId, targetDuration } = await request.json();

    if (!videoId || !targetDuration) {
      return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    // 1. Fetch current row across configured projects
    const found = await findVideoAcrossProjects(videoId);
    if (!found || !found.video) {
      throw new Error('Video not found');
    }
    const { video: row, client: videoClient } = found;

    const currentScript = row.data_json.script;
    const currentItems = JSON.stringify(row.data_json.items || []);
    
    // 2. Rewrite script with Gemini
    const videoFormat = row.data_json.type || 'Data Comparison';
    let prompt = '';
    
    if (videoFormat === 'Quiz') {
      const currentQuestions = JSON.stringify(row.data_json.questions || []);
      prompt = `Rewrite this quiz voiceover script to specifically fit a ${targetDuration}-second YouTube Short pacing. The first 3 questions MUST be general knowledge (easy level) so most people can answer them. The last 2 can be of moderate difficulty. Ensure all questions and options are very short so they can be read aloud in under 8 seconds.
      Current script: "${currentScript}"
      
      You MUST return a JSON object with EXACTLY these fields:
      - "script": The rewritten voiceover script. DO NOT add any conversational fluff.
      - "questions": Keep this exact questions array or update it if you changed the script: ${currentQuestions}
      Do not wrap the response in markdown blocks like \`\`\`json, just return the raw JSON object.`;
    } else {
      prompt = `Rewrite this voiceover script to specifically fit a ${targetDuration}-second YouTube Short pacing. Make it engaging and fast-paced.
      Current script: "${currentScript}"
      The current year is 2026. Make sure to include up-to-date statistical data and projections up to 2026 if applicable.
      
      You MUST return a JSON object with EXACTLY these fields:
      - "script": The rewritten voiceover script.
      - "x_axis_label": Label for the X-axis (e.g. "Year", "Month").
      - "y_axis_label": Label for the Y-axis (e.g. "Monthly Players", "Revenue").
      - "timeline_labels": An array of strings representing the time steps (e.g., ["2018", "2019", "2020", "2021", "2022"]). MUST have at least 5 items.
      - "items": Keep this exact data array, or update the labels/values to match the new script: ${currentItems}
      CRITICAL: The length of the "values" array for EACH item MUST perfectly match the length of the "timeline_labels" array.
      
      Do not wrap the response in markdown blocks like \`\`\`json, just return the raw JSON object.`;
    }

    const generatedData = await generateGeminiJson(prompt);

    const newScript = generatedData.script;
    const newItems = generatedData.items || generatedData.questions;

    if (!newScript || !newItems || !Array.isArray(newItems)) {
      throw new Error('Invalid JSON format returned from Gemini in rewrite-script.');
    }

    // 3. Generate New TTS
    let tts_url = null;
    let tts_urls: string[] = [];
    const voiceId = row.data_json?.voice_id || 'pNInz6obpgDQGcFmaJgB'; // Adam default

    const fetchElevenLabs = (text: string) => fetchElevenLabsTTS(text, voiceId);

    try {
      if ((videoFormat === 'Quiz' || Array.isArray(newItems)) && newItems && newItems.length > 0 && newItems[0].question) {
        const generateTTSForText = async (text: string) => {
          const elResponse = await fetchElevenLabs(text);
          const audioBuffer = Buffer.from(await elResponse.arrayBuffer());
          const ttsFileName = `tts_${crypto.randomUUID()}.mp3`;
          const { publicUrl } = await uploadToStorageWithFailover('shorts', ttsFileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true });
          return publicUrl;
        };

        for (const q of newItems) {
          const text = `${q.question} A, ${q.options[0]}, B, ${q.options[1]}, C, ${q.options[2]}.`;
          const url = await generateTTSForText(text);
          tts_urls.push(url);
        }
        
        // Add custom end_title outro TTS only if provided
        const outroText = (row.data_json?.end_title || '').trim();
        if (outroText) {
          const outroUrl = await generateTTSForText(outroText);
          tts_urls.push(outroUrl);
        }
      } else if (videoFormat === 'Would You Rather' && newItems && newItems.length > 0 && newItems[0].option_a) {
        const generateTTSForText = async (text: string) => {
          const elResponse = await fetchElevenLabs(text);
          const audioBuffer = Buffer.from(await elResponse.arrayBuffer());
          const ttsFileName = `tts_${crypto.randomUUID()}.mp3`;
          const { publicUrl } = await uploadToStorageWithFailover('shorts', ttsFileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true });
          return publicUrl;
        };

        for (const s of newItems) {
          const text = `Would you rather ${s.option_a} or ${s.option_b}?`;
          const url = await generateTTSForText(text);
          tts_urls.push(url);
        }
        
        // Add custom end_title outro TTS only if provided
        const outroText = (row.data_json?.end_title || '').trim();
        if (outroText) {
          const outroUrl = await generateTTSForText(outroText);
          tts_urls.push(outroUrl);
        }
      } else {
        let fullScript = newScript;
        if (row.data_json?.end_title && typeof row.data_json.end_title === 'string' && row.data_json.end_title.trim() && !newScript.includes(row.data_json.end_title.trim())) {
          fullScript = `${newScript.trim()} ... ${row.data_json.end_title.trim()}`;
        }
        const elResponse = await fetchElevenLabs(fullScript);
        if (!elResponse.ok) throw new Error(`ElevenLabs API error: ${elResponse.statusText}`);
        const audioBuffer = Buffer.from(await elResponse.arrayBuffer());
        const ttsFileName = `tts_${crypto.randomUUID()}.mp3`;
        const { publicUrl } = await uploadToStorageWithFailover('shorts', ttsFileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true });
        tts_url = publicUrl;
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
      tts_urls: tts_urls,
      duration_seconds: parseInt(targetDuration)
    };

    const { error: updateError } = await videoClient
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
