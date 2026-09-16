import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { Octokit } from 'octokit';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const getWikiImageUrl = async (query: string) => {
  try {
    const searchRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*`);
    const searchData = await searchRes.json();
    if (!searchData.query?.search?.length) return null;
    const title = searchData.query.search[0].title;
    
    const imgRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=500&origin=*`);
    const imgData = await imgRes.json();
    const pages = imgData.query?.pages;
    if (!pages) return null;
    const pageId = Object.keys(pages)[0];
    return pages[pageId]?.thumbnail?.source || null;
  } catch (e) {
    return null;
  }
};

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
      Return a structured JSON object with EXACTLY these fields:
      - "topic": The generated topic as a string.
      - "script": A short, fast-paced, highly engaging 10-15 second voiceover hook script for a YouTube Short reading the scenario.
      - "scenario_a": String describing option A.
      - "scenario_b": String describing option B.
      - "image_keyword_a": A VERY SPECIFIC search keyword for Wikipedia to find an image for option A.
      - "image_keyword_b": A VERY SPECIFIC search keyword for Wikipedia to find an image for option B.
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

    const fallbackModels = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-flash-latest'];
    let text = '';
    
    for (let i = 0; i < fallbackModels.length; i++) {
      try {
        console.log(`Attempting Gemini generation with model: ${fallbackModels[i]}`);
        const response = await ai.models.generateContent({
          model: fallbackModels[i],
          contents: prompt,
        });
        text = response.text;
        break; // Success! Break out of the fallback loop.
      } catch (err: any) {
        console.warn(`Model ${fallbackModels[i]} failed: ${err.message}`);
        if (i === fallbackModels.length - 1) {
          // If this was the last model, throw the error
          throw new Error(`All Gemini models failed. Last error: ${err.message}`);
        }
      }
    }
    
    // Parse the JSON. Remove markdown backticks if they are present.
    const cleanedText = text.replace(/```json\n?|```/g, '').trim();
    const generatedData = JSON.parse(cleanedText);

    const { topic, script } = generatedData;
    let dataPayload = { ...generatedData, type: videoFormat };

    if (!topic || !script) {
      throw new Error('Invalid data format returned from Gemini.');
    }

    // Fetch images based on format
    if (videoFormat === 'Would You Rather') {
      if (dataPayload.image_keyword_a) dataPayload.image_url_a = await getWikiImageUrl(dataPayload.image_keyword_a);
      if (dataPayload.image_keyword_b) dataPayload.image_url_b = await getWikiImageUrl(dataPayload.image_keyword_b);
    } else if (videoFormat === 'Quiz') {
      if (dataPayload.image_keyword) dataPayload.image_url = await getWikiImageUrl(dataPayload.image_keyword);
    } else {
      // Data Comparison
      if (dataPayload.items && Array.isArray(dataPayload.items)) {
        for (const item of dataPayload.items) {
          if (item.image_keyword) {
            item.image_url = await getWikiImageUrl(item.image_keyword);
          }
        }
      }
    }

    // Generate TTS Audio
    let tts_url = null;
    let tts_urls = [];
    const voiceId = 'pNInz6obpgDQGcFmaJgB'; // Adam
    try {
      if ((videoFormat === 'Quiz' || Array.isArray(dataPayload.questions)) && dataPayload.questions) {
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

        for (const q of dataPayload.questions) {
          const text = `${q.question} A, ${q.options[0]}, B, ${q.options[1]}, C, ${q.options[2]}.`;
          const url = await generateTTSForText(text);
          tts_urls.push(url);
        }
      } else {
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
            ...dataPayload,
            tts_url: tts_url,
            tts_urls: tts_urls,
            show_subtitles: true,
            duration_seconds: duration
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
