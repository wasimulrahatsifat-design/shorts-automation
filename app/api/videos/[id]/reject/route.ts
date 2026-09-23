import { NextResponse } from 'next/server';
import { findVideoAcrossProjects, supabase } from '@/lib/supabase';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const found = await findVideoAcrossProjects(id);
    const client = found ? found.client : supabase;

    // 1. Delete video file from Storage (best effort)
    try {
      await client.storage.from('shorts').remove([`${id}.mp4`]);
    } catch (e) {}

    // 2. Delete the video row from Supabase
    const { error } = await client
      .from('shorts_queue')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error rejecting video:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
