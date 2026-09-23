import { NextResponse } from 'next/server';
import { findVideoAcrossProjects, supabase } from '@/lib/supabase';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const found = await findVideoAcrossProjects(id);
    const client = found ? found.client : supabase;

    // 1. Fetch lightweight file reference (best effort)
    const { data: video } = await client
      .from('shorts_queue')
      .select('video_url, data_json->tts_url')
      .eq('id', id)
      .maybeSingle();

    const filesToDelete = [`${id}.mp4`];
    
    // Add TTS to deletion list if exists
    const ttsUrl = (video as any)?.tts_url;
    if (ttsUrl && typeof ttsUrl === 'string') {
      const parts = ttsUrl.split('/');
      const fileName = parts[parts.length - 1];
      if (fileName) {
        filesToDelete.push(fileName);
      }
    }

    // 2. Delete files from Storage (best effort)
    try {
      await client.storage
        .from('shorts')
        .remove(filesToDelete);
    } catch (storageError) {
      console.error('Storage deletion error:', storageError);
    }

    // 3. Delete row from Database
    const { error: dbError } = await client
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
