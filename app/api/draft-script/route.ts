import { NextResponse } from 'next/server';
import { generateGeminiJson } from '@/lib/gemini';

// No image generation logic here anymore

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const videoFormat = body.videoFormat || 'Data Comparison';
    const userTopic = body.topic || '';

    const randomSeed = Math.floor(Math.random() * 10000000) + '-' + Date.now();
    
    // Extensive dynamic angle pools to guarantee 100% freshness even on identical topics like "general knowledge"
    const quizAnglePool = [
      "mind-blowing nature & animal kingdom anomalies that sound fake but are 100% true",
      "bizarre historical paradoxes, unexpected secrets of ancient civilizations, and hidden discoveries",
      "shocking science, human body psychology, and counter-intuitive facts that defy common sense",
      "astonishing Guinness world records, astronomical anomalies, and deep ocean mysteries",
      "clever trick questions and popular myths that 99% of people get wrong",
      "modern world marvels, 2026 tech breakthroughs, and jaw-dropping geography secrets",
      "unbelievable culinary, biological, and everyday phenomena nobody ever noticed",
      "extreme survival oddities, bizarre laws, and unbelievable historical coincidences",
      "brain-melting riddles and high-IQ trivia that ignite instant debate in the comments"
    ];
    const wyrAnglePool = [
      "extreme psychological sacrifices and high-stakes moral dilemmas",
      "unbelievable superpower trade-offs paired with chaotic, hilarious side-effects",
      "luxury lifestyle vs sanity trade-offs that split the audience 50/50",
      "intense apocalyptic survival scenarios and impossible choices",
      "mind-bending time-travel and future sci-fi consequences",
      "embarrassing daily rules vs unlimited money dilemmas that trigger fierce comment debate",
      "bizarre physical abilities vs infinite knowledge trade-offs"
    ];
    const comparisonAnglePool = [
      "shocking underdog surges and sudden dethroning of historical champions",
      "rapid meteoric rises and dramatic sudden collapses over the years",
      "high-stakes revenue and market dominance battles up to 2026",
      "unforeseen shifts in global culture, technology adoption, and power rankings"
    ];

    const randomQuizAngle = quizAnglePool[Math.floor(Math.random() * quizAnglePool.length)];
    const randomWyrAngle = wyrAnglePool[Math.floor(Math.random() * wyrAnglePool.length)];
    const randomCompAngle = comparisonAnglePool[Math.floor(Math.random() * comparisonAnglePool.length)];

    const viralPersona = `You are an elite, world-class YouTube Shorts & TikTok Viral Video Manager with over 10 billion total views. 
You are a master of audience psychology, viewer retention, curiosity gaps, pattern interrupts, and comment triggers.
Your scripts ALWAYS hook viewers in the first 2 seconds, keep them glued until the final frame, and compel them to like, comment, and subscribe.`;

    let prompt = '';
    const topicInstruction = userTopic 
      ? `The topic requested by the user is: "${userTopic}".` 
      : 'Generate an extremely viral, high-trending, searchable topic for Shorts.';

    if (videoFormat === 'Would You Rather') {
      prompt = `${viralPersona}
      ${topicInstruction}
      
      VIRAL RETENTION & ENGAGEMENT DIRECTIVES:
      - Create 4 jaw-dropping, heart-pounding "Would You Rather" dilemmas.
      - Make the choices so fiercely debatable that viewers CANNOT resist commenting which one they chose!
      - Angle to explore for this generation: ${randomWyrAngle}.
      - CRITICAL DIVERSITY REQUIREMENT: Never repeat standard clichés (like fly vs invisible, rich vs famous).
      - Entropy seed: ${randomSeed}. Every single request MUST produce 4 brand-new, unique scenarios.

      Return a structured JSON object with EXACTLY these fields:
      - "topic": The generated punchy topic title as a string.
      - "format": "Would You Rather".
      - "scenarios": An array of EXACTLY 4 objects. Each object MUST have:
        - "option_a": String. KEEP THIS EXTREMELY SHORT & PUNCHY (e.g. "never feel pain again", "unlimited money", "speak every language"). Do NOT include "Would you rather" in this string.
        - "option_b": String. KEEP THIS EXTREMELY SHORT & PUNCHY (e.g. "never feel sadness again", "unlimited time", "read minds"). Do NOT include "or" in this string.
        - "image_keyword_a": A VERY SPECIFIC single search keyword for option A (e.g. "cash", "brain", "superhero").
        - "image_keyword_b": A VERY SPECIFIC single search keyword for option B.
        - "percent_a": Realistic percentage integer between 10 and 90 of people who would choose option A.
        - "percent_b": Percentage integer (percent_a + percent_b MUST equal 100).
      Do not wrap the response in markdown blocks like \`\`\`json, just return the raw JSON object.`;
    } else if (videoFormat === 'Quiz') {
      prompt = `${viralPersona}
      ${topicInstruction}

      VIRAL RETENTION & ENGAGEMENT DIRECTIVES:
      - HOOK: The voiceover script MUST start with a legendary 1-2 sentence viral hook that triggers instant FOMO or competition (e.g., "Only 2% of people can get Question 4 right!", "Bet you $100 you fail the 3rd question!", "Can you score 5 out of 5 on this ultimate brain test?").
      - QUESTIONS: Generate 5 ENTIRELY FRESH, FASCINATING questions. 
        - The first 2 questions should be accessible & satisfying so viewers feel smart and stay hooked.
        - Question 3 & 4 should be intriguing and surprising (facts that sound fake but are real).
        - Question 5 should be a clever mind-bender or shocking fact that viewers want to discuss in the comments.
      - STRICT BAN ON DRY CLICHÉS: Do NOT ask elementary school textbook questions like "Capital of France?", "Largest planet?", "Who wrote Hamlet?". Instead, ask captivating, counter-intuitive facts (e.g. "Which animal can sleep for 3 years?", "What color is a polar bear's skin under its fur?", "Which fruit has seeds on the outside?").
      - NOVELTY & VARIETY REQUIREMENT: Angle to explore for this generation: ${randomQuizAngle}. Even if the user requests "${userTopic || 'General Knowledge'}" multiple times, you MUST generate 5 completely distinct, never-before-seen questions every single time.
      - Entropy seed: ${randomSeed}.

      Return a structured JSON object with EXACTLY these fields:
      - "topic": The generated punchy topic as a string.
      - "format": "Quiz"
      - "show_image_first": Optional boolean (set to true if this is an image-guessing quiz like "Guess the Character", "Guess the Flag", "Guess the Logo", "Identify this picture").
      - "script": The fast-paced, high-energy viral voiceover hook script (under 12 seconds read time).
      - "questions": An array of exactly 5 objects. Each object MUST have:
        - "question": Short, punchy question string.
        - "options": Array of exactly 3 concise strings (e.g., ["Cheetah", "Falcon", "Sailfish"]).
        - "correct_answer": The exact string from options that is correct.
        - "image_keyword": A VERY SPECIFIC search keyword for Wikipedia to find an image related to this question (e.g., "Falcon").
        - "show_image_first": Optional boolean (set to true if the question requires looking at the image to answer, e.g. "What is this image?").
      Do not wrap the response in markdown blocks like \`\`\`json, just return the raw JSON object.`;
    } else if (videoFormat === 'Arena Clash') {
      prompt = `${viralPersona}
      ${topicInstruction}
      
      VIRAL RETENTION & ENGAGEMENT DIRECTIVES:
      - HOOK: Create an intense, high-octane 10-15 second voiceover hook that demands viewers pick a champion and bet in the comments!
      - Create 4 distinct, awesome fighters and an unpredictable, shocking battle royale climax.
      - Unique entropy seed: ${randomSeed}.

      Return a structured JSON object for a 2D square arena battle royale animation with Ben 10 / viral ball battle aesthetics with EXACTLY these fields:
      - "topic": The generated battle topic as a string (e.g., "Ben 10 Omnitrix Clash", "Heatblast VS Diamondhead", "Alien Overdrive").
      - "format": "Arena Clash".
      - "script": A short, intense 10-15 second voiceover hook script for a YouTube Short narrating the battle.
      - "contestants": An array of 4 distinct, awesome fighters (e.g. Ben 10 aliens like Four Arms, Heatblast, XLR8, Diamondhead, Cannonbolt). Each object MUST have:
        * "id" (string)
        * "name" (string)
        * "color" (distinct hex string like "#dc2626", "#ea580c", "#0284c7", "#10b981", "#f59e0b", "#8b5cf6")
        * "image_keyword" (A VERY SPECIFIC search keyword for Wikipedia to find an image for this contestant)
        * "starting_health" (number, typically 100)
        * "damage" (number, between 20 and 32)
        * "speed" (number, between 6.0 and 7.5)
        * "special_ability": An object with:
            "name" (string, creative thematic ability name like "Sonic Clap", "Supernova Inferno", "Turbo Blitz", "Crystal Wall", "Wrecking Roll"),
            "icon" (string, a single emoji like "⚡", "🔥", "🛡️", "❄️", "🩸", "☄️"),
            "type" (string, exactly one of: "damage", "shield", "heal", "freeze", "speed"),
            "trigger_type" (string, one of: "charge", "hp_threshold", "hit_combo", "cooldown"),
            "trigger_value" (number, e.g. 100 for charge, 50 for hp_threshold, 4 for hit_combo, 5 for cooldown),
            "weapon_icon" (string, emoji like "🥊", "🔥", "💎", "🗡️", "⚡", "⚙️"),
            "cooldown_seconds" (number, 4 to 8),
            "power_value" (number, if damage: 25-45, if shield: 30-50, if heal: 20-35, if freeze: 1.8-2.5, if speed: 2-3),
            "description" (short string explaining the effect)
      - "events": An array of battle events. Each object MUST have "frame" (number, between 50 and 350), "attacker" (string id), "defender" (string id), "damage" (number), and "item_used" (string, e.g., "Sword", "Lightning").
      - "winner_id": The id string of the last standing contestant.
      Do not wrap the response in markdown blocks like \`\`\`json, just return the raw JSON object.`;
    } else {
      prompt = `${viralPersona}
      ${topicInstruction} The current year is 2026. Make sure to include up-to-date statistical data and projections up to 2026 if applicable.
      
      VIRAL RETENTION & ENGAGEMENT DIRECTIVES:
      - HOOK: The voiceover script MUST open with a gripping pattern interrupt (e.g., "Watch how the number one leader gets completely dethroned in 2026!", "In 2018 they were dead last... wait until you see where they are now!").
      - Focus on dramatic competition, rapid surges, and shocking underdogs.
      - Angle: ${randomCompAngle}.
      - Unique entropy seed: ${randomSeed}.

      Return a structured JSON object with EXACTLY these fields:
      - "topic": The generated topic as a string.
      - "script": A short, fast-paced, highly engaging 10-15 second voiceover hook script for a YouTube Short.
      - "x_axis_label": Label for the X-axis (e.g. "Year", "Timeline").
      - "y_axis_label": Label for the Y-axis (e.g. "Subscribers (M)", "Market Cap ($B)").
      - "timeline_labels": An array of strings representing the time steps (e.g., ["2018", "2019", "2020", "2021", "2022", "2024", "2026"]). MUST have at least 5 items.
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

    if (typeof body.endTitle === 'string') {
      dataPayload.end_title = body.endTitle.trim();
    } else if (!dataPayload.end_title) {
      dataPayload.end_title = '';
    }

    if (body.partTitle && typeof body.partTitle === 'string' && body.partTitle.trim()) {
      dataPayload.part_title = body.partTitle.trim();
    } else if (body.part_title && typeof body.part_title === 'string' && body.part_title.trim()) {
      dataPayload.part_title = body.part_title.trim();
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
