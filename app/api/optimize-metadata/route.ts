import { NextResponse } from 'next/server';
import { generateGeminiJson } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { topic, niche } = body;

    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return NextResponse.json(
        { success: false, error: 'Video topic/title is required for optimization.' },
        { status: 400 }
      );
    }

    const validNiches = [
      'Quiz',
      'Would You Rather',
      'Data Comparison Chart',
      'Arena 2D Battle'
    ];

    const selectedNiche = validNiches.includes(niche) ? niche : (niche || 'Data Comparison Chart');

    const prompt = `You are a world-class social media strategist and viral hook expert for YouTube Shorts, Instagram Reels, and Facebook Reels.
Optimize the Title and Description for a short-form vertical video based on the following input:

- Current Topic / Title: "${topic.trim()}"
- Target Niche: "${selectedNiche}"

Strict Requirements:
1. "title":
   - A short, high-energy, viral, click-worthy hook title with emoji.
   - Tailored specifically for the "${selectedNiche}" niche:
     * For Quiz: question that challenges viewer knowledge or creates FOMO (e.g. "🧠 99% Fail This Quiz! Can You? 😱").
     * For Would You Rather: an impossible choice or extreme dilemma (e.g. "🚨 Impossible Choices: Pick ONE! 🤯").
     * For Data Comparison Chart: highlighting rapid growth or crazy stats (e.g. "📈 Richest Companies in History! 💰").
     * For Arena 2D Battle: intense battle hype (e.g. "⚔️ Who Will Survive The Ultimate Arena? 💥").
   - CRITICAL CONSTRAINT: The title MUST be UNDER 60 characters total.

2. "description":
   - Exactly ONE moderate, all-in-one description that works seamlessly across YouTube Shorts, Instagram Reels, and Facebook Reels.
   - Format:
     * First paragraph: A 2-sentence curiosity hook that pulls the viewer in.
     * Second paragraph: A clear Call-to-Action (CTA) encouraging viewers to comment their pick/score and share.
     * Third paragraph: Exactly 4 to 6 clean, relevant, trending hashtags (e.g., #shorts #reels #viral and niche-specific tags).

Return a strict JSON object with EXACTLY these two keys:
{
  "title": "Short viral hook title with emoji (under 60 chars)",
  "description": "Sentence 1 hook. Sentence 2 hook.\n\nCall to action.\n\n#tag1 #tag2 #tag3 #tag4 #tag5"
}

Do not wrap in markdown or backticks, return raw JSON only.`;

    const result = await generateGeminiJson(prompt);

    if (!result || typeof result !== 'object') {
      throw new Error('Invalid response from AI.');
    }

    let optimizedTitle = (result.title || topic).trim();
    if (optimizedTitle.length > 60) {
      optimizedTitle = optimizedTitle.slice(0, 58).trim() + '…';
    }

    const optimizedDescription = (result.description || '').trim();

    return NextResponse.json({
      success: true,
      title: optimizedTitle,
      description: optimizedDescription,
      niche: selectedNiche
    });
  } catch (error: any) {
    console.error('Error optimizing metadata:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to optimize title and description.' },
      { status: 500 }
    );
  }
}
