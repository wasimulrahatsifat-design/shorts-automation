import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // 1. Delete video file from Storage (best effort)
    try {
      await supabase.storage.from('shorts').remove([`${id}.mp4`]);
    } catch (e) {}

    // 2. Delete the video row from Supabase
    const { error } = await supabase
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
