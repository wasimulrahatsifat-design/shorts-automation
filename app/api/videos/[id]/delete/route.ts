import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Fetch the row to get URLs
    const { data: video, error: fetchError } = await supabase
      .from('shorts_queue')
      .select('video_url, data_json')
      .eq('id', id)
      .single();

    if (fetchError || !video) {
      return NextResponse.json({ success: false, error: 'Video not found' }, { status: 404 });
    }

    const filesToDelete = [];
    
    // Add MP4 to deletion list
    filesToDelete.push(`${id}.mp4`);

    // Add TTS to deletion list if exists
    if (video.data_json?.tts_url) {
      const ttsUrlParts = video.data_json.tts_url.split('/');
      const ttsFileName = ttsUrlParts[ttsUrlParts.length - 1];
      if (ttsFileName) {
        filesToDelete.push(ttsFileName);
      }
    }

    // 2. Delete files from Storage
    if (filesToDelete.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('shorts')
        .remove(filesToDelete);
        
      if (storageError) {
        console.error('Storage deletion error:', storageError);
      }
    }

    // 3. Delete row from Database
    const { error: dbError } = await supabase
      .from('shorts_queue')
      .delete()
      .eq('id', id);

    if (dbError) {
      throw dbError;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting video:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
