import { NextResponse } from 'next/server';
import { queryAllProjectsVideos } from '@/lib/supabase';

export async function GET() {
  try {
    const videos = await queryAllProjectsVideos((client) =>
      client
        .from('shorts_queue')
        .select('id, topic, status, video_url, created_at, scheduled_time, data_json')
        .order('created_at', { ascending: false })
    );

    return NextResponse.json({
      success: true,
      data: videos || [],
    });
  } catch (error: any) {
    console.error('Error fetching videos across projects:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
