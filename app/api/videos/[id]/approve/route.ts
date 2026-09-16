import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { scheduled_time } = body;

    if (!scheduled_time) {
      return NextResponse.json({ success: false, error: 'scheduled_time is required' }, { status: 400 });
    }

    // Update the video row in Supabase
    const { error } = await supabase
      .from('shorts_queue')
      .update({
        status: 'Scheduled',
        scheduled_time: scheduled_time
      })
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error approving video:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
