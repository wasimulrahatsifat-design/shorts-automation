import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { topic, description } = body;

    // Fetch existing row to preserve existing data_json fields
    const { data: existing, error: fetchErr } = await supabase
      .from('shorts_queue')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json(
        { success: false, error: fetchErr?.message || 'Video not found' },
        { status: 404 }
      );
    }

    const currentDataJson = existing.data_json || {};
    const updatedDataJson = {
      ...currentDataJson,
      ...(topic !== undefined ? { topic: topic.trim() } : {}),
      ...(description !== undefined ? { description: description.trim() } : {}),
    };

    const updatePayload: Record<string, any> = {
      data_json: updatedDataJson,
    };

    if (topic !== undefined) {
      updatePayload.topic = topic.trim();
    }

    const { data: updated, error: updateErr } = await supabase
      .from('shorts_queue')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      throw updateErr;
    }

    return NextResponse.json({
      success: true,
      message: 'Video updated successfully',
      data: updated,
    });
  } catch (error: any) {
    console.error('Error updating video:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update video' },
      { status: 500 }
    );
  }
}
