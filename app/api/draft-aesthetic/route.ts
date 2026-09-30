import { NextResponse } from 'next/server';
import { generateGeminiJson } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userTopic = body.topic || 'Liminal Dreamcore cherry blossom field';

    const prompt = `You are a master cinematic director specializing in viral Liminal Space and Dreamcore aesthetic YouTube Shorts and TikToks (similar to ethereal surreal dream loops, nostalgic liminal pool rooms, glowing cherry blossom meadows, and nostalgic backrooms).

The user wants an aesthetic video on the theme: "${userTopic}".
Total duration must be 16 to 18 seconds (around 4 scenes of ~120 to 135 frames each at 30fps).

CRITICAL REQUIREMENT:
DO NOT generate 4 or 5 completely different locations or unrelated places!
All scenes MUST depict the EXACT SAME place, environment, and core subject (just like public/video.mp4 where all 4 shots explore the same cherry blossom meadow from different camera perspectives).
Maintain strict visual consistency across all prompts: same time of day, same lighting, same color palette, same architectural or natural elements, same surreal dreamcore/liminal atmosphere.

Generate EXACTLY 4 cinematic camera shots of this SAME environment:
- Scene 1: "Wide Establishing View" - Camera establishing the overall surreal scale and dreamcore mood.
- Scene 2: "Dramatic Low-Angle Shot" - Camera looking upward from the ground toward the canopy/ceiling/sky with volumetric lighting.
- Scene 3: "Medium Eye-Level Tracking Shot" - Camera at eye-level gliding alongside the main subject, highlighting fine textures and gentle mist/shadows.
- Scene 4: "High-Angle Overhead / Bird's Eye View" - Camera looking down from above, capturing ground patterns, reflections, or fallen petals.

Return a structured JSON object with EXACTLY these fields:
{
  "topic": "Clean descriptive title for this aesthetic video",
  "format": "AestheticVideo",
  "duration_seconds": 17,
  "location_description": "A short 1-sentence description of the single shared environment",
  "scenes": [
    {
      "camera_angle": "Wide Establishing View",
      "camera_motion": "zoom-in",
      "image_keyword": "A hyper-detailed, photorealistic 9:16 vertical prompt optimized for Midjourney / Imagen 3 depicting the wide establishing view of the scene with 35mm film grain, soft volumetric light, dreamcore atmosphere, pastel colors --ar 9:16",
      "duration": 125
    },
    {
      "camera_angle": "Dramatic Low-Angle Shot",
      "camera_motion": "tilt-up",
      "image_keyword": "In the EXACT SAME environment, a dramatic ground-level low-angle shot looking upward..., matching the exact lighting and colors --ar 9:16",
      "duration": 125
    },
    {
      "camera_angle": "Medium Eye-Level Tracking Shot",
      "camera_motion": "pan-right",
      "image_keyword": "In the EXACT SAME environment, a medium tracking shot at eye level gliding past..., maintaining identical textures and mood --ar 9:16",
      "duration": 125
    },
    {
      "camera_angle": "High-Angle Overhead View",
      "camera_motion": "zoom-out",
      "image_keyword": "In the EXACT SAME environment, a high-angle overhead view looking down upon..., showing the same location from above --ar 9:16",
      "duration": 125
    }
  ]
}

Camera motion for each scene must be one of: "zoom-in", "zoom-out", "pan-left", "pan-right", "tilt-up", "tilt-down".
Do not wrap the response in markdown blocks like \`\`\`json, just return the raw JSON object.`;

    const generatedData = await generateGeminiJson(prompt);

    if (!generatedData.topic || !Array.isArray(generatedData.scenes)) {
      throw new Error('Invalid data format returned from Gemini: missing topic or scenes.');
    }

    return NextResponse.json({ success: true, data: generatedData });
  } catch (error: any) {
    console.error('Error generating aesthetic draft script:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

