import { NextResponse } from 'next/server';
import { generateGeminiJson } from '@/lib/gemini';

// No image generation logic here anymore

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const videoFormat = body.videoFormat || 'Data Comparison';
    const userTopic = body.topic || '';

    const randomSeed = Math.floor(Math.random() * 1000000);
    const quizAngles = [
      "mind-blowing unexpected facts and lesser-known historical/scientific trivia",
      "curious paradoxes, surprising world records, and astonishing facts",
      "popular myths vs real truth and counter-intuitive discoveries",
      "modern discoveries up to 2026, culture mysteries, and fascinating trivia",
      "clever riddle-style facts and shocking comparisons",
      "deep-cut questions that even enthusiasts get wrong"
    ];
    const wyrAngles = [
      "extreme moral dilemmas and surreal superpower trade-offs",
      "hilarious lifestyle consequences and mind-bending future tech scenarios",
      "wild survival choices and intense impossible sacrifices",
      "bizarre daily rules and luxury vs sanity trade-offs",
      "deep psychological dilemmas that trigger fierce debate in the comments",
      "unexpected abilities paired with chaotic side-effects"
    ];
    const randomQuizAngle = quizAngles[Math.floor(Math.random() * quizAngles.length)];
    const randomWyrAngle = wyrAngles[Math.floor(Math.random() * wyrAngles.length)];

    let prompt = '';
    const topicInstruction = userTopic ? `The topic MUST be about: "${userTopic}".` : 'Generate a unique topic.';

    if (videoFormat === 'Would You Rather') {
      prompt = `${topicInstruction} (e.g., Superpowers, Tech, Food, Survival, Lifestyle). 
      CRITICAL NOVELTY & VARIETY REQUIREMENT:
      Even if this topic is requested multiple times, you MUST generate 4 COMPLETELY FRESH, BRAND-NEW, and UNPREDICTABLE scenarios every time.
      Angle to explore for this generation: ${randomWyrAngle}.
      STRICTLY AVOID repeating common or cliché dilemmas (such as fly vs invisible, sweet vs salty, rich vs famous).
      Unique generation entropy seed: ${randomSeed}.

      Return a structured JSON object with EXACTLY these fields:
      - "topic": The generated topic as a string.
      - "format": "Would You Rather".
      - "scenarios": An array of EXACTLY 4 objects. Each object MUST have:
        - "option_a": String. KEEP THIS EXTREMELY SHORT (e.g., "never feel pain again", "unlimited money", "be able to fly"). Do NOT include "Would you rather" in this string.
        - "option_b": String. KEEP THIS EXTREMELY SHORT (e.g., "never feel sadness again", "unlimited time", "breathe underwater"). Do NOT include "or" in this string.
        - "image_keyword_a": A VERY SPECIFIC search keyword for option A.
        - "image_keyword_b": A VERY SPECIFIC search keyword for option B.
        - "percent_a": Number between 1 and 99 representing the percentage of people who would choose option A.
        - "percent_b": Number between 1 and 99 representing the percentage of people who would choose option B. (percent_a + percent_b MUST equal 100).
      Do not wrap the response in markdown blocks like \`\`\`json, just return the raw JSON object.`;
    } else if (videoFormat === 'Quiz') {
      prompt = `${topicInstruction}
      CRITICAL NOVELTY & VARIETY REQUIREMENT:
      Even if this topic is requested multiple times (e.g., "${userTopic}"), you MUST generate 5 ENTIRELY NEW, DISTINCT, and SURPRISING questions.
      Angle to explore for this generation: ${randomQuizAngle}.
      STRICTLY AVOID repeating beginner textbook clichés (e.g., do NOT ask "Capital of France?", "Largest planet?", "Who wrote Hamlet?").
      Instead, ask fresh, captivating questions with fascinating facts that make people genuinely curious.
      Unique generation entropy seed: ${randomSeed}.

      Return a structured JSON object with EXACTLY these fields:
      - "topic": The generated topic as a string.
      - "script": The voiceover script. DO NOT add any conversational fluff.
      - "questions": An array of exactly 5 objects. The first 3 questions MUST be accessible (easy-to-medium) so viewers engage immediately. The last 2 can be clever, tricky, or astonishing. Ensure all questions and options are very short so they can be read aloud in under 8 seconds. Each object MUST have "question" (string), "options" (array of exactly 3 strings), "correct_answer" (the exact string from options), and "image_keyword" (A VERY SPECIFIC search keyword for Wikipedia to find an image related to the question).
      Do not wrap the response in markdown blocks like \`\`\`json, just return the raw JSON object.`;
    } else if (videoFormat === 'Arena Clash') {
      prompt = `${topicInstruction}
      CRITICAL NOVELTY REQUIREMENT:
      Create 4 distinct, creative fighters and an unpredictable battle sequence. Unique seed: ${randomSeed}.
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
      CRITICAL NOVELTY REQUIREMENT:
      Explore interesting underdogs, rapid surges, or fresh comparison metrics for this topic. Unique seed: ${randomSeed}.
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

    const generatedData = await generateGeminiJson(prompt, { temperature: 0.95 });

    const { topic, script } = generatedData;
    let dataPayload = { ...generatedData, type: videoFormat };

    if (!topic) {
      throw new Error('Invalid data format returned from Gemini: missing topic.');
    }
    if (videoFormat !== 'Would You Rather' && !script) {
      throw new Error('Invalid data format returned from Gemini: missing script.');
    }

    if (body.endTitle && typeof body.endTitle === 'string' && body.endTitle.trim()) {
      dataPayload.end_title = body.endTitle.trim();
    } else if (!dataPayload.end_title) {
      dataPayload.end_title = videoFormat === 'Would You Rather' 
        ? 'Write down in the comment section.' 
        : 'Subscribe for more!';
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
