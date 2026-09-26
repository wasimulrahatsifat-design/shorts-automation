import { NextResponse } from 'next/server';
import { Octokit } from 'octokit';
import { generateGeminiJson } from '@/lib/gemini';
import { fetchElevenLabsTTS } from '@/lib/elevenlabs';
import { uploadToStorageWithFailover, executeWithSupabaseFailover } from '@/lib/supabase';
import { generateArenaSimulation } from '@/lib/arena-physics';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

// No image generation logic here anymore

export async function POST(request: Request) {
  try {
    let showSubtitles = true;
    let videoFormat = 'Data Comparison';
    let endTitle = '';
    let partTitle = '';
    try {
      const body = await request.json();
      if (typeof body.showSubtitles === 'boolean') {
        showSubtitles = body.showSubtitles;
      }
      if (body.videoFormat) {
        videoFormat = body.videoFormat;
      }
      if (body.endTitle) {
        endTitle = body.endTitle;
      }
      if (body.partTitle || body.part_title) {
        partTitle = body.partTitle || body.part_title;
      }
    } catch (e) {
      // Ignored if no body is passed
    }

    const randomSeed = Math.floor(Math.random() * 10000000) + '-' + Date.now();
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
    if (videoFormat === 'Would You Rather') {
      prompt = `${viralPersona}
      Generate a unique, highly viral, searchable "Would You Rather" topic.
      
      VIRAL RETENTION & ENGAGEMENT DIRECTIVES:
      - Create 4 jaw-dropping, heart-pounding "Would You Rather" dilemmas.
      - Make the choices so fiercely debatable that viewers CANNOT resist commenting which one they chose!
      - Angle to explore for this generation: ${randomWyrAngle}.
      - CRITICAL DIVERSITY REQUIREMENT: Never repeat standard clichés (like fly vs invisible, rich vs famous).
      - Entropy seed: ${randomSeed}.

      Return a structured JSON object with EXACTLY these fields:
      - "topic": The generated punchy topic as a string.
      - "format": "Would You Rather".
      - "scenarios": An array of EXACTLY 4 objects. Each object MUST have:
        - "option_a": String. KEEP THIS EXTREMELY SHORT & PUNCHY (e.g. "never feel pain again", "unlimited money"). Do NOT include "Would you rather" in this string.
        - "option_b": String. KEEP THIS EXTREMELY SHORT & PUNCHY (e.g. "never feel sadness again", "unlimited time"). Do NOT include "or" in this string.
        - "image_keyword_a": A VERY SPECIFIC search keyword for Wikipedia to find an image for option A.
        - "image_keyword_b": A VERY SPECIFIC search keyword for Wikipedia to find an image for option B.
        - "percent_a": Number between 10 and 90 representing the percentage of people who would choose option A.
        - "percent_b": Number (percent_a + percent_b MUST equal 100).
      Do not wrap the response in markdown blocks like \`\`\`json, just return the raw JSON object.`;
    } else if (videoFormat === 'Quiz') {
      prompt = `${viralPersona}
      Generate a unique, highly viral, searchable "Trivia Quiz" topic.
      
      VIRAL RETENTION & ENGAGEMENT DIRECTIVES:
      - HOOK: The voiceover script MUST start with a legendary 1-2 sentence viral hook that triggers instant FOMO or competition (e.g., "Only 2% of people can get Question 4 right!", "Bet you $100 you fail the 3rd question!").
      - QUESTIONS: Generate 5 ENTIRELY FRESH, FASCINATING questions. 
        - The first 2 questions should be accessible & satisfying so viewers feel smart and stay hooked.
        - Question 3 & 4 should be intriguing and surprising (facts that sound fake but are real).
        - Question 5 should be a clever mind-bender or shocking fact that viewers want to discuss in the comments.
      - STRICT BAN ON DRY CLICHÉS: Do NOT ask elementary school textbook questions like "Capital of France?", "Largest planet?", "Who wrote Hamlet?". Instead, ask captivating, counter-intuitive facts.
      - Angle to explore: ${randomQuizAngle}.
      - Unique generation entropy seed: ${randomSeed}.

      Return a structured JSON object with EXACTLY these fields:
      - "topic": The generated punchy topic as a string.
      - "script": The fast-paced, high-energy viral voiceover hook script.
      - "questions": An array of exactly 5 objects. The first 3 questions MUST be accessible (easy-to-medium) so viewers engage immediately. The last 2 can be clever, tricky, or astonishing. Ensure all questions and options are very short so they can be read aloud in under 8 seconds. Each object MUST have "question" (string), "options" (array of exactly 3 strings), "correct_answer" (the exact string from options), and "image_keyword" (A VERY SPECIFIC search keyword for Wikipedia to find an image related to the question).
      Do not wrap the response in markdown blocks like \`\`\`json, just return the raw JSON object.`;
    } else {
      prompt = `${viralPersona}
      Generate a unique "Animated Racing Line Chart" topic. The current year is 2026. Make sure to include up-to-date statistical data and projections up to 2026 if applicable.
      
      VIRAL RETENTION & ENGAGEMENT DIRECTIVES:
      - HOOK: The voiceover script MUST open with a gripping pattern interrupt (e.g., "Watch how the number one leader gets completely dethroned in 2026!", "In 2018 they were dead last... wait until you see where they are now!").
      - Focus on dramatic competition, rapid surges, and shocking underdogs.
      - Angle: ${randomCompAngle}.
      - Unique seed: ${randomSeed}.

      Return a structured JSON object with EXACTLY these fields:
      - "topic": The generated topic as a string.
      - "script": A short, fast-paced, highly engaging 10-15 second voiceover hook script for a YouTube Short.
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

    if (endTitle && endTitle.trim()) {
      dataPayload.end_title = endTitle.trim();
    }

    if (partTitle && partTitle.trim()) {
      dataPayload.part_title = partTitle.trim();
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
          const { publicUrl } = await uploadToStorageWithFailover('shorts', ttsFileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true });
          return publicUrl;
        };

        for (const q of dataPayload.questions) {
          const text = `${q.question} A, ${q.options[0]}, B, ${q.options[1]}, C, ${q.options[2]}.`;
          const url = await generateTTSForText(text);
          tts_urls.push(url);
        }
        
        // Add custom end_title outro TTS only if provided
        const outroText = (dataPayload.end_title || '').trim();
        if (outroText) {
          const outroUrl = await generateTTSForText(outroText);
          tts_urls.push(outroUrl);
        }
      } else if (videoFormat === 'Would You Rather' && dataPayload.scenarios) {
        const generateTTSForText = async (text: string) => {
          const elResponse = await fetchElevenLabs(text);
          const audioBuffer = Buffer.from(await elResponse.arrayBuffer());
          const ttsFileName = `tts_${crypto.randomUUID()}.mp3`;
          const { publicUrl } = await uploadToStorageWithFailover('shorts', ttsFileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true });
          return publicUrl;
        };

        for (let i = 0; i < dataPayload.scenarios.length; i++) {
          const s = dataPayload.scenarios[i];
          const cleanA = (s.option_a || '').replace(/^would you rather\s+/i, '').trim();
          const cleanB = (s.option_b || '').replace(/^would you rather\s+/i, '').trim();
          const text = i === 0
            ? `Would you rather ${cleanA} or ${cleanB}?`
            : `${cleanA.charAt(0).toUpperCase() + cleanA.slice(1)} or ${cleanB}?`;
          const url = await generateTTSForText(text);
          tts_urls.push(url);
        }
        
        // Add custom end_title outro TTS only if provided
        const outroText = (dataPayload.end_title || '').trim();
        if (outroText) {
          const outroUrl = await generateTTSForText(outroText);
          tts_urls.push(outroUrl);
        }
      } else {
        let fullScript = script;
        if (dataPayload.end_title && typeof dataPayload.end_title === 'string' && dataPayload.end_title.trim() && !script.includes(dataPayload.end_title.trim())) {
          fullScript = `${script.trim()} ... ${dataPayload.end_title.trim()}`;
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

    let finalDuration = 15;
    const hasOutro = Boolean(dataPayload.end_title && dataPayload.end_title.trim());
    if (videoFormat === 'Would You Rather' && dataPayload.scenarios) {
      let totalSeconds = 0;
      for (let i = 0; i < dataPayload.scenarios.length; i++) {
        const s = dataPayload.scenarios[i];
        const prefixLength = i === 0 ? 17 : 0;
        const cleanA = (s.option_a || '').replace(/^would you rather\s+/i, '').trim();
        const cleanB = (s.option_b || '').replace(/^would you rather\s+/i, '').trim();
        const textLength = cleanA.length + cleanB.length + prefixLength + 4;
        const readingSeconds = Math.max(1.5, textLength / 21);
        totalSeconds += readingSeconds + 5; // timer 3s + reveal 2s
      }
      finalDuration = Math.round(totalSeconds + (hasOutro ? 2.8 : 0));
    } else if (videoFormat === 'Quiz' && dataPayload.questions) {
      let totalSeconds = 0;
      for (const q of dataPayload.questions) {
        const textLength = q.question.length + q.options.join('').length + 10;
        const readingSeconds = Math.max(1.8, textLength / 18);
        totalSeconds += readingSeconds + 5;
      }
      finalDuration = Math.round(totalSeconds + (hasOutro ? 2.8 : 0));
    } else if (videoFormat === 'Arena Clash' && dataPayload.contestants) {
      const sim = generateArenaSimulation(dataPayload.contestants, 3600, dataPayload.seed || 42);
      finalDuration = sim.totalSeconds;
    }

    // Insert into Supabase with failover
    const { data: dbData, error } = await executeWithSupabaseFailover((client) =>
      client
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
        .select()
    );

    if (error || !dbData || dbData.length === 0) {
      throw error || new Error('Failed to insert into shorts_queue');
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
