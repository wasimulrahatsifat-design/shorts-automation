import { NextResponse } from 'next/server';
import { queryAllProjectsVideos } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') || 'all';

    // Fetch videos that have a rendered video_url across all configured projects
    const allVideos = await queryAllProjectsVideos((client) =>
      client
        .from('shorts_queue')
        .select('id, topic, status, video_url, created_at, scheduled_time, data_json')
        .not('video_url', 'is', null)
        .order('created_at', { ascending: false })
    );

    // Helper to determine if a video needs approval for YouTube
    const isYouTubePending = (v: any) => {
      if (v.status === 'Pending') return false;
      const ytStatus = v.data_json?.youtube_status;
      if (ytStatus === 'Published') return false;
      if (v.status === 'Published' && ytStatus === undefined && v.data_json?.meta_status === undefined) {
        return false; // Legacy published item
      }
      return true;
    };

    // Helper to determine if a video needs approval for Meta (Facebook & Instagram)
    const isMetaPending = (v: any) => {
      if (v.status === 'Pending') return false;
      const metaStatus = v.data_json?.meta_status;
      if (metaStatus === 'Published') return false;
      if (v.status === 'Published' && metaStatus === undefined && v.data_json?.youtube_status === undefined) {
        return false; // Legacy published item
      }
      return true;
    };

    let filtered = allVideos;
    if (platform === 'youtube') {
      filtered = allVideos.filter(isYouTubePending);
    } else if (platform === 'meta') {
      filtered = allVideos.filter(isMetaPending);
    } else {
      filtered = allVideos.filter(v => isYouTubePending(v) || isMetaPending(v));
    }

    const youtubeCount = allVideos.filter(isYouTubePending).length;
    const metaCount = allVideos.filter(isMetaPending).length;

    return NextResponse.json({ 
      success: true, 
      data: filtered,
      counts: {
        youtube: youtubeCount,
        meta: metaCount,
      }
    });
  } catch (error: any) {
    console.error('Error fetching videos:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
