import { NextResponse } from 'next/server';
import { uploadToStorageWithFailover, executeWithSupabaseFailover } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const videoFile = formData.get('video') as File | null;
    const topic = (formData.get('topic') as string) || 'Ben 10 Alien Arena Clash';
    const dataJsonRaw = formData.get('data_json') as string | null;
    const duration = parseFloat((formData.get('duration') as string) || '0');

    if (!videoFile) {
      return NextResponse.json(
        { success: false, error: 'No video file provided.' },
        { status: 400 }
      );
    }

    let parsedData: Record<string, any> = {};
    if (dataJsonRaw) {
      try {
        parsedData = JSON.parse(dataJsonRaw);
      } catch (e) {
        parsedData = {};
      }
    }

    const bytes = await videoFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = videoFile.type?.includes('mp4') ? 'mp4' : 'webm';
    const fileName = `arena_recorded_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;

    const { publicUrl } = await uploadToStorageWithFailover(
      'shorts',
      fileName,
      buffer,
      { contentType: videoFile.type || 'video/webm', upsert: true }
    );

    const { data: dbData, error } = await executeWithSupabaseFailover((client) =>
      client
        .from('shorts_queue')
        .insert([
          {
            topic: topic,
            status: 'Completed',
            video_url: publicUrl,
            data_json: {
              ...parsedData,
              format: 'Arena Clash',
              video_url: publicUrl,
              topic: topic,
              description:
                parsedData.description ||
                `Epic Ben 10 Alien Arena battle! Watch the clash and see who claims victory! #Ben10 #Shorts #ArenaClash`,
              duration_seconds: duration || parsedData.duration_seconds || 60,
            },
          },
        ])
        .select()
    );

    if (error || !dbData || dbData.length === 0) {
      throw error || new Error('Failed to insert completed video into dashboard queue.');
    }

    return NextResponse.json({
      success: true,
      video: dbData[0],
      publicUrl,
    });
  } catch (error: any) {
    console.error('Error uploading game video to dashboard:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
