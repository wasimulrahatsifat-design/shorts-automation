import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { Octokit } from 'octokit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const getWikiImageUrl = async (keyword: string) => {
  const generateSvgAvatar = (kw: string) => {
    const letter = kw ? kw.charAt(0).toUpperCase() : '?';
    let hash = 0;
    for (let i = 0; i < kw.length; i++) {
      hash = kw.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = `hsl(${Math.abs(hash) % 360}, 70%, 40%)`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="${color}"/><text x="50" y="50" text-anchor="middle" dominant-baseline="central" fill="white" font-family="sans-serif" font-size="50" font-weight="bold">${letter}</text></svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  };

  try {
    // Tier 1: Wikipedia API
    const searchRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(keyword)}&utf8=&format=json&origin=*`);
    const searchData = await searchRes.json();
    
    if (searchData.query?.search?.length) {
      const title = searchData.query.search[0].title;
      const imgRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=500&origin=*`);
      const imgData = await imgRes.json();
      const pages = imgData.query?.pages;
      if (pages) {
        const pageId = Object.keys(pages)[0];
        if (pages[pageId]?.thumbnail?.source) {
          return pages[pageId].thumbnail.source;
        }
      }
    }

    // Tier 2: Google Custom Search API
    const googleRes = await fetch(`https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(keyword)}&cx=${process.env.GOOGLE_CX}&key=${process.env.GOOGLE_API_KEY}&searchType=image&num=1`);
    const googleData = await googleRes.json();
    if (googleData.items && googleData.items.length > 0) {
      return googleData.items[0].link;
    }

    // Tier 3: Imagen 3 (Dedicated API Key)
    if (process.env.GEMINI_IMAGE_API_KEY) {
      try {
        const aiImage = new GoogleGenAI({ apiKey: process.env.GEMINI_IMAGE_API_KEY });
        const imageResp = await aiImage.models.generateImages({
          model: 'imagen-3.0-generate-001',
          prompt: `${keyword} 3d icon isolated on solid background`,
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
        });
        if (imageResp.generatedImages && imageResp.generatedImages.length > 0) {
          return `data:image/jpeg;base64,${imageResp.generatedImages[0].image.imageBytes}`;
        }
      } catch (err: any) {
        console.error("Imagen 3 Failed for keyword:", keyword, err.message);
      }
    }

    return generateSvgAvatar(keyword);
  } catch (e) {
    return generateSvgAvatar(keyword);
  }
};

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
    The current year is 2026. Make sure to include up-to-date statistical data and projections up to 2026 if applicable.
    
    You MUST return a JSON object with EXACTLY these fields:
    - "script": The rewritten voiceover script.
    - "x_axis_label": Label for the X-axis (e.g. "Year", "Month").
    - "y_axis_label": Label for the Y-axis (e.g. "Monthly Players", "Revenue").
    - "timeline_labels": An array of strings representing the time steps (e.g., ["2018", "2019", "2020", "2021", "2022"]). MUST have at least 5 items.
    - "items": Keep this exact data array, or update the labels/values to match the new script: ${currentItems}
    CRITICAL: The length of the "values" array for EACH item MUST perfectly match the length of the "timeline_labels" array.
    
    Do not wrap the response in markdown blocks like \`\`\`json, just return the raw JSON object.`;

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

    // Fetch images for items if they have an image_keyword but no image_url, or if it changed
    for (const item of newItems) {
      if (item.image_keyword && !item.image_url) {
        const imgUrl = await getWikiImageUrl(item.image_keyword);
        item.image_url = imgUrl; 
      }
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
