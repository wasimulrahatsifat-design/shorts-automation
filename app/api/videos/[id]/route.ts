import { NextResponse } from 'next/server';
import { findVideoAcrossProjects } from '@/lib/supabase';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { topic, description } = body;

    // Fetch existing row across configured projects
    const found = await findVideoAcrossProjects(id);
    if (!found || !found.video) {
      return NextResponse.json(
        { success: false, error: 'Video not found' },
        { status: 404 }
      );
    }
    const { video: existing, client: videoClient } = found;

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

    const { data: updated, error: updateErr } = await videoClient
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
