import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// No image generation logic here anymore

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
      - "script": The voiceover script. DO NOT add any conversational fluff.
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

    // No image generation is done here anymore. The frontend handles image uploads.

    return NextResponse.json({ success: true, data: dataPayload });
  } catch (error: any) {
    console.error('Error generating draft script:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
