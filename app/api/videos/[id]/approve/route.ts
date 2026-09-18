import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Octokit } from 'octokit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { scheduled_time, platform = 'all', publish_now = false } = body;

    const finalScheduledTime = publish_now || !scheduled_time 
      ? new Date().toISOString() 
      : scheduled_time;

    // Fetch existing row to preserve existing platform statuses
    const { data: existing, error: fetchErr } = await supabase
      .from('shorts_queue')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      throw new Error(fetchErr?.message || 'Video not found');
    }

    const currentDataJson = existing.data_json || {};
    const updatedDataJson = { ...currentDataJson };

    if (platform === 'youtube') {
      updatedDataJson.youtube_status = publish_now ? 'Scheduled' : 'Scheduled';
      updatedDataJson.youtube_scheduled_time = finalScheduledTime;
    } else if (platform === 'meta') {
      updatedDataJson.meta_status = publish_now ? 'Scheduled' : 'Scheduled';
      updatedDataJson.meta_scheduled_time = finalScheduledTime;
    } else {
      updatedDataJson.youtube_status = 'Scheduled';
      updatedDataJson.meta_status = 'Scheduled';
      updatedDataJson.youtube_scheduled_time = finalScheduledTime;
      updatedDataJson.meta_scheduled_time = finalScheduledTime;
    }

    // Update the video row in Supabase
    const { error: updateError } = await supabase
      .from('shorts_queue')
      .update({
        status: 'Scheduled',
        scheduled_time: finalScheduledTime,
        data_json: updatedDataJson,
      })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    // Trigger auto-publisher workflow with target platform and video_id
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    if (owner && repo) {
      try {
        await octokit.rest.actions.createWorkflowDispatch({
          owner,
          repo,
          workflow_id: 'auto-publisher.yml',
          ref: 'main',
          inputs: {
            video_id: id,
            target: platform,
          },
        });
        console.log(`Successfully triggered auto-publisher.yml for video ${id} on platform ${platform}`);
      } catch (ghError: any) {
        console.error('Failed to trigger auto-publisher GitHub Action:', ghError.message || ghError);
      }
    }

    return NextResponse.json({ success: true, platform, scheduled_time: finalScheduledTime });
  } catch (error: any) {
    console.error('Error approving video:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
