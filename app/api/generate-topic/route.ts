import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Octokit } from 'octokit';
import { generateGeminiJson } from '@/lib/gemini';
import { fetchElevenLabsTTS } from '@/lib/elevenlabs';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

// No image generation logic here anymore

export async function POST(request: Request) {
  try {
    let showSubtitles = true;
    let videoFormat = 'Data Comparison';
    try {
      const body = await request.json();
      if (typeof body.showSubtitles === 'boolean') {
        showSubtitles = body.showSubtitles;
      }
      if (body.videoFormat) {
        videoFormat = body.videoFormat;
      }
    } catch (e) {
      // Ignored if no body is passed
    }

    let prompt = '';
    if (videoFormat === 'Would You Rather') {
      prompt = `Generate a unique "Would You Rather" topic (e.g., Superpowers, Tech, Food). 
      IMPORTANT: Generate completely random, creative, and highly engaging scenarios each time. Avoid repeating common or boring ones.
      Return a structured JSON object with EXACTLY these fields:
      - "topic": The generated topic as a string.
      - "format": "Would You Rather".
      - "scenarios": An array of EXACTLY 3 objects. Each object MUST have:
        - "option_a": String. KEEP THIS EXTREMELY SHORT (e.g., "never feel pain again", "unlimited money", "be able to fly"). Do NOT include "Would you rather" in this string.
        - "option_b": String. KEEP THIS EXTREMELY SHORT (e.g., "never feel sadness again", "unlimited time", "breathe underwater"). Do NOT include "or" in this string.
        - "image_keyword_a": A VERY SPECIFIC search keyword for Wikipedia to find an image for option A.
        - "image_keyword_b": A VERY SPECIFIC search keyword for Wikipedia to find an image for option B.
        - "percent_a": Number between 1 and 99 representing the percentage of people who would choose option A.
        - "percent_b": Number between 1 and 99 representing the percentage of people who would choose option B. (percent_a + percent_b MUST equal 100).
      Do not wrap the response in markdown blocks like \`\`\`json, just return the raw JSON object.`;
    } else if (videoFormat === 'Quiz') {
      prompt = `Generate a unique "Trivia Quiz" topic. 
      Return a structured JSON object with EXACTLY these fields:
      - "topic": The generated topic as a string.
      - "script": A short, engaging 10-15 second voiceover hook script for a YouTube Short asking the question and building suspense.
      - "question": The trivia question as a string.
      - "options": An array of exactly 3 string options.
      - "correct_answer": The exact string from the options array that is correct.
      - "image_keyword": A VERY SPECIFIC search keyword for Wikipedia to find an image related to the question.
      Do not wrap the response in markdown blocks like \`\`\`json, just return the raw JSON object.`;
    } else {
      prompt = `Generate a unique "Animated Racing Line Chart" topic (e.g., Growth of Tech Companies over 10 years, Population growth of cities). 
      Return a structured JSON object with EXACTLY these fields:
      - "topic": The generated topic as a string.
      - "script": A short, fast-paced, highly engaging 10-15 second voiceover hook script for a YouTube Short.
      - "timeline_labels": An array of strings representing the time steps (e.g., ["2018", "2019", "2020", "2021", "2022"]). MUST have at least 5 items.
      - "items": A REQUIRED array of at least 3 objects where each object MUST have "label" (string), "image_keyword" (string), and "values" (an array of numbers).
      CRITICAL: The length of the "values" array for EACH item MUST perfectly match the length of the "timeline_labels" array.
      Do not wrap the response in markdown blocks like \`\`\`json, just return the raw JSON object.`;
    }

    const generatedData = await generateGeminiJson(prompt);

    const { topic, script } = generatedData;
    let dataPayload = { ...generatedData, type: videoFormat };

    if (!topic) {
      throw new Error('Invalid data format returned from Gemini: missing topic.');
    }
    if (videoFormat !== 'Would You Rather' && !script) {
      throw new Error('Invalid data format returned from Gemini: missing script.');
    }

    // Fetch images based on format
    // No image generation is done here anymore. The frontend handles image uploads.

    // Generate TTS Audio
    let tts_url = null;
    let tts_urls = [];
    const voiceId = 'pNInz6obpgDQGcFmaJgB'; // Adam

    const fetchElevenLabs = (text: string) => fetchElevenLabsTTS(text, voiceId);

    try {
      if ((videoFormat === 'Quiz' || Array.isArray(dataPayload.questions)) && dataPayload.questions) {
        const generateTTSForText = async (text: string) => {
          const elResponse = await fetchElevenLabs(text);
          const audioBuffer = Buffer.from(await elResponse.arrayBuffer());
          const ttsFileName = `tts_${crypto.randomUUID()}.mp3`;
          await supabase.storage.from('shorts').upload(ttsFileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true });
          const { data: publicUrlData } = supabase.storage.from('shorts').getPublicUrl(ttsFileName);
          return publicUrlData.publicUrl;
        };

        for (const q of dataPayload.questions) {
          const text = `${q.question} A, ${q.options[0]}, B, ${q.options[1]}, C, ${q.options[2]}.`;
          const url = await generateTTSForText(text);
          tts_urls.push(url);
        }
        
        // Add "Thanks for watching" outro TTS
        const outroUrl = await generateTTSForText("Thanks for watching!");
        tts_urls.push(outroUrl);
      } else if (videoFormat === 'Would You Rather' && dataPayload.scenarios) {
        const generateTTSForText = async (text: string) => {
          const elResponse = await fetchElevenLabs(text);
          const audioBuffer = Buffer.from(await elResponse.arrayBuffer());
          const ttsFileName = `tts_${crypto.randomUUID()}.mp3`;
          await supabase.storage.from('shorts').upload(ttsFileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true });
          const { data: publicUrlData } = supabase.storage.from('shorts').getPublicUrl(ttsFileName);
          return publicUrlData.publicUrl;
        };

        for (const s of dataPayload.scenarios) {
          const text = `Would you rather ${s.option_a} or ${s.option_b}?`;
          const url = await generateTTSForText(text);
          tts_urls.push(url);
        }
        
        // Add "Thanks for watching" outro TTS
        const outroUrl = await generateTTSForText("Thanks for watching!");
        tts_urls.push(outroUrl);
      } else {
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

    let finalDuration = 15;
    if (videoFormat === 'Would You Rather' && dataPayload.scenarios) {
      let totalSeconds = 0;
      for (const s of dataPayload.scenarios) {
        const textLength = s.option_a.length + s.option_b.length + 20;
        const readingSeconds = (textLength / 15);
        totalSeconds += readingSeconds + 5; // timer 3s + reveal 2s
      }
      finalDuration = Math.round(totalSeconds + 3); // + outro
    } else if (videoFormat === 'Quiz' && dataPayload.questions) {
      let totalSeconds = 0;
      for (const q of dataPayload.questions) {
        const textLength = q.question.length + q.options.join('').length + 10;
        const readingSeconds = (textLength / 15) + 1;
        totalSeconds += readingSeconds + 7;
      }
      finalDuration = Math.round(totalSeconds + 3);
    }

    // Insert into Supabase
    const { data: dbData, error } = await supabase
      .from('shorts_queue')
      .insert([
        {
          topic: topic,
          data_json: {
            ...dataPayload,
            tts_url: tts_url,
            tts_urls: tts_urls,
            show_subtitles: true,
            duration_seconds: finalDuration
          },
          status: 'Pending',
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
    console.error('Error generating topic:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
