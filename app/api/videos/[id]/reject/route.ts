import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // 1. Delete the video row from Supabase
    const { error } = await supabase
      .from('shorts_queue')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    // 2. Automatically generate a replacement topic
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.url.split('/api/')[0];
    const generateUrl = `${baseUrl}/api/generate-topic`;
    
    // Fire and forget (don't block the response waiting for generation)
    fetch(generateUrl, { method: 'POST' }).catch(err => console.error('Failed to trigger replacement generation:', err));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error rejecting video:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
