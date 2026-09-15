import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { Octokit } from 'octokit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

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
    try {
      const body = await request.json();
      if (typeof body.showSubtitles === 'boolean') {
        showSubtitles = body.showSubtitles;
      }
    } catch (e) {}

    const prompt = `Generate a unique "Data Comparison" topic suitable for a 3D visualization (e.g., Tallest Buildings, Most Expensive Cars, Largest Planets). 
    Return a structured JSON object with EXACTLY three fields:
    - "topic": The generated topic as a string.
    - "script": A short, fast-paced, highly engaging 10-15 second voiceover hook script for a YouTube Short.
    - "items": A REQUIRED array of at least 3 objects where each object MUST have "label" (string), "value" (number), and "image_keyword" (string). Make "image_keyword" very specific so Wikipedia can easily find an image for it (e.g., "Burj Khalifa", "Bugatti Veyron").
    Do not wrap the response in markdown blocks like \`\`\`json, just return the raw JSON object.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });

    const text = response.text;
    const cleanedText = text.replace(/```json\n?|```/g, '').trim();
    const generatedData = JSON.parse(cleanedText);
    const { topic, script, items } = generatedData;

    if (!topic || !script || !items || !Array.isArray(items)) {
      throw new Error('Invalid data format returned from Gemini.');
    }

    // Fetch images for all items
    for (const item of items) {
      const imgUrl = await getWikiImageUrl(item.image_keyword);
      item.image_url = imgUrl; // Append resolved image URL
    }

    // Generate TTS Audio
    let tts_url = null;
    try {
      const voiceId = 'pNInz6obpgDQGcFmaJgB'; // Adam
      const elResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY || '',
        },
        body: JSON.stringify({
          text: script,
          model_id: 'eleven_multilingual_v2',
        }),
      });

      if (elResponse.ok) {
        const audioBuffer = Buffer.from(await elResponse.arrayBuffer());
        const ttsFileName = `tts_3d_${crypto.randomUUID()}.mp3`;

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
            type: '3d',
            script: script,
            items: items,
            tts_url: tts_url,
            show_subtitles: showSubtitles
          },
          status: 'Pending',
        },
      ])
      .select();

    if (error) throw error;

    const videoId = dbData[0].id;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;

    if (owner && repo) {
      try {
        await octokit.rest.actions.createWorkflowDispatch({
          owner,
          repo,
          workflow_id: 'render-video.yml',
          ref: 'main',
          inputs: { video_id: videoId },
        });
      } catch (ghError) {
        console.error('Failed to trigger GitHub Action:', ghError);
      }
    }

    return NextResponse.json({ success: true, data: dbData });
  } catch (error: any) {
    console.error('Error generating 3D topic:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
