import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
    const body = await request.json();
    const videoFormat = body.videoFormat || 'Data Comparison';
    const userTopic = body.topic || '';

    let prompt = '';
    const topicInstruction = userTopic ? `The topic MUST be about: "${userTopic}".` : 'Generate a unique topic.';

    if (videoFormat === 'Would You Rather') {
      prompt = `${topicInstruction} (e.g., Superpowers, Tech, Food). 
      Return a structured JSON object with EXACTLY these fields:
      - "topic": The generated topic as a string.
      - "script": A short, fast-paced, highly engaging 10-15 second voiceover hook script for a YouTube Short reading the scenario.
      - "scenario_a": String describing option A.
      - "scenario_b": String describing option B.
      - "image_keyword_a": A VERY SPECIFIC search keyword for Wikipedia to find an image for option A.
      - "image_keyword_b": A VERY SPECIFIC search keyword for Wikipedia to find an image for option B.
      Do not wrap the response in markdown blocks like \`\`\`json, just return the raw JSON object.`;
    } else if (videoFormat === 'Quiz') {
      prompt = `${topicInstruction}
      Return a structured JSON object with EXACTLY these fields:
      - "topic": The generated topic as a string.
      - "script": The voiceover script. DO NOT add any conversational fluff. The script MUST ONLY consist of reading the question followed by its options, for each of the 5 questions in order. CRITICAL: You MUST insert an SSML break tag <break time='5s'/> (USE SINGLE QUOTES FOR 5s) immediately after reading the options for each question to allow time for the timer.
      - "questions": An array of exactly 5 objects. The first 3 questions MUST be general knowledge (easy level) so most people can answer them. The last 2 can be of moderate difficulty. Ensure all questions and options are very short so they can be read aloud in under 8 seconds. Each object MUST have "question" (string), "options" (array of exactly 3 strings), "correct_answer" (the exact string from options), and "image_keyword" (A VERY SPECIFIC search keyword for Wikipedia to find an image related to the question).
      Do not wrap the response in markdown blocks like \`\`\`json, just return the raw JSON object.`;
    } else if (videoFormat === 'Arena Clash') {
      prompt = `${topicInstruction}
      Return a structured JSON object for a 2D circular arena battle royale animation with EXACTLY these fields:
      - "topic": The generated topic as a string.
      - "format": "Arena Clash".
      - "script": A short, intense 10-15 second voiceover hook script for a YouTube Short narrating the battle.
      - "contestants": An array of exactly 4 objects representing the fighters. Each object MUST have "id" (string), "name" (string), "color" (hex string like "#FF0000"), "image_keyword" (A VERY SPECIFIC search keyword for Wikipedia to find an image for this contestant), and "starting_health" (number, typically 100).
      - "events": An array of battle events. Each object MUST have "frame" (number, between 50 and 350), "attacker" (string id), "defender" (string id), "damage" (number), and "item_used" (string, e.g., "Sword", "Magic").
      - "winner_id": The id string of the last standing contestant.
      Do not wrap the response in markdown blocks like \`\`\`json, just return the raw JSON object.`;
    } else {
      prompt = `${topicInstruction} The current year is 2026. Make sure to include up-to-date statistical data and projections up to 2026 if applicable.
      Return a structured JSON object with EXACTLY these fields:
      - "topic": The generated topic as a string.
      - "script": A short, fast-paced, highly engaging 10-15 second voiceover hook script for a YouTube Short.
      - "x_axis_label": Label for the X-axis (e.g. "Year", "Month").
      - "y_axis_label": Label for the Y-axis (e.g. "Monthly Players", "Revenue").
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
        break;
      } catch (err: any) {
        console.warn(`Model ${fallbackModels[i]} failed: ${err.message}`);
        if (i === fallbackModels.length - 1) {
          throw new Error(`All Gemini models failed. Last error: ${err.message}`);
        }
      }
    }
    
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
      if (dataPayload.questions && Array.isArray(dataPayload.questions)) {
        for (const q of dataPayload.questions) {
          if (q.image_keyword) {
            q.image_url = await getWikiImageUrl(q.image_keyword);
          }
        }
      }
    } else if (videoFormat === 'Arena Clash') {
      if (dataPayload.contestants && Array.isArray(dataPayload.contestants)) {
        for (const contestant of dataPayload.contestants) {
          if (contestant.image_keyword) {
            contestant.image_url = await getWikiImageUrl(contestant.image_keyword);
          }
        }
      }
    } else {
      if (dataPayload.items && Array.isArray(dataPayload.items)) {
        for (const item of dataPayload.items) {
          if (item.image_keyword) {
            item.image_url = await getWikiImageUrl(item.image_keyword);
          }
        }
      }
    }

    return NextResponse.json({ success: true, data: dataPayload });
  } catch (error: any) {
    console.error('Error generating draft script:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
