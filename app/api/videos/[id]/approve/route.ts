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
      if (currentDataJson.youtube_status === 'Published') {
        return NextResponse.json({ success: false, error: 'Video is already uploaded to YouTube.' }, { status: 400 });
      }
      const isYtUploading = currentDataJson.youtube_status === 'Uploading' && (
        currentDataJson.youtube_uploading_at && (Date.now() - new Date(currentDataJson.youtube_uploading_at).getTime() < 3 * 60 * 1000)
      );
      if (isYtUploading) {
        return NextResponse.json({ success: false, error: 'Video is currently uploading to YouTube. Please wait a minute.' }, { status: 400 });
      }
      updatedDataJson.youtube_status = 'Scheduled';
      updatedDataJson.youtube_scheduled_time = finalScheduledTime;
    } else if (platform === 'meta') {
      if (currentDataJson.meta_status === 'Published') {
        return NextResponse.json({ success: false, error: 'Video is already published to Facebook and Instagram.' }, { status: 400 });
      }
      const isMetaUploading = currentDataJson.meta_status === 'Uploading' && (
        currentDataJson.meta_uploading_at && (Date.now() - new Date(currentDataJson.meta_uploading_at).getTime() < 3 * 60 * 1000)
      );
      if (isMetaUploading) {
        return NextResponse.json({ success: false, error: 'Video is currently being published to Facebook and Instagram. Please wait a minute.' }, { status: 400 });
      }
      updatedDataJson.meta_status = 'Scheduled';
      updatedDataJson.meta_scheduled_time = finalScheduledTime;
    } else {
      updatedDataJson.youtube_status = 'Scheduled';
      updatedDataJson.meta_status = 'Scheduled';
      updatedDataJson.youtube_scheduled_time = finalScheduledTime;
      updatedDataJson.meta_scheduled_time = finalScheduledTime;
    }

    // Determine row status
    const isYtDone = updatedDataJson.youtube_status === 'Published';
    const isMetaDone = updatedDataJson.meta_status === 'Published';
    const rowStatus = (isYtDone && isMetaDone) 
      ? 'Published' 
      : 'Scheduled';

    // Update the video row in Supabase
    const { error: updateError } = await supabase
      .from('shorts_queue')
      .update({
        status: rowStatus,
        scheduled_time: finalScheduledTime,
        data_json: updatedDataJson,
      })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    // Only trigger immediate auto-publisher workflow if publish_now is true OR scheduled_time has already arrived
    const isDueNow = publish_now || new Date(finalScheduledTime).getTime() <= (Date.now() + 60000); // 1 min margin

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    if (isDueNow && owner && repo) {
      try {
        await octokit.rest.actions.createWorkflowDispatch({
          owner,
          repo,
          workflow_id: 'auto-publisher.yml',
          ref: 'main',
          inputs: {
            video_id: id,
            target: platform,
            force: 'true',
          },
        });
        console.log(`Successfully triggered immediate auto-publisher.yml for video ${id} on platform ${platform}`);
      } catch (ghError: any) {
        console.error('Failed to trigger auto-publisher GitHub Action:', ghError.message || ghError);
      }
    } else if (!isDueNow) {
      console.log(`Video ${id} scheduled for future time: ${finalScheduledTime}. Immediate upload skipped; will be published when scheduled time arrives.`);
    }

    return NextResponse.json({ 
      success: true, 
      platform, 
      scheduled_time: finalScheduledTime,
      is_due_now: isDueNow 
    });
  } catch (error: any) {
    console.error('Error approving video:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
