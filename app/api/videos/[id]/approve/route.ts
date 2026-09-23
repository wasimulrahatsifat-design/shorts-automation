import { NextResponse } from 'next/server';
import { Octokit } from 'octokit';
import { findVideoAcrossProjects } from '@/lib/supabase';

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

    // Fetch existing row across configured projects
    const found = await findVideoAcrossProjects(id);
    if (!found || !found.video) {
      throw new Error('Video not found');
    }
    const { video: existing, client: videoClient } = found;

    const currentDataJson = existing.data_json || {};
    const updatedDataJson = { ...currentDataJson };

    if (platform === 'youtube') {
      if (currentDataJson.youtube_status === 'Published') {
        return NextResponse.json({ success: false, error: 'Video is already uploaded to YouTube.' }, { status: 400 });
      }
      const isYtUploading = currentDataJson.youtube_status === 'Uploading' && (
        currentDataJson.youtube_uploading_at && (Date.now() - new Date(currentDataJson.youtube_uploading_at).getTime() < 45 * 1000)
      );
      if (!publish_now && isYtUploading) {
        return NextResponse.json({ success: false, error: 'Video is currently uploading to YouTube. Please wait a minute.' }, { status: 400 });
      }
      updatedDataJson.youtube_status = publish_now ? 'Uploading' : 'Scheduled';
      if (publish_now) {
        const nowIso = new Date().toISOString();
        updatedDataJson.youtube_uploading_at = nowIso;
        updatedDataJson.youtube_dispatched_at = nowIso;
      }
      updatedDataJson.youtube_scheduled_time = finalScheduledTime;
    } else if (platform === 'meta') {
      if (currentDataJson.meta_status === 'Published') {
        return NextResponse.json({ success: false, error: 'Video is already published to Facebook and Instagram.' }, { status: 400 });
      }
      const isMetaUploading = currentDataJson.meta_status === 'Uploading' && (
        currentDataJson.meta_uploading_at && (Date.now() - new Date(currentDataJson.meta_uploading_at).getTime() < 45 * 1000)
      );
      if (!publish_now && isMetaUploading) {
        return NextResponse.json({ success: false, error: 'Video is currently being published to Facebook and Instagram. Please wait a minute.' }, { status: 400 });
      }
      updatedDataJson.meta_status = publish_now ? 'Uploading' : 'Scheduled';
      if (publish_now) {
        const nowIso = new Date().toISOString();
        updatedDataJson.meta_uploading_at = nowIso;
        updatedDataJson.meta_dispatched_at = nowIso;
      }
      updatedDataJson.meta_scheduled_time = finalScheduledTime;
    } else {
      updatedDataJson.youtube_status = publish_now ? 'Uploading' : 'Scheduled';
      updatedDataJson.meta_status = publish_now ? 'Uploading' : 'Scheduled';
      if (publish_now) {
        const nowIso = new Date().toISOString();
        updatedDataJson.youtube_uploading_at = nowIso;
        updatedDataJson.youtube_dispatched_at = nowIso;
        updatedDataJson.meta_uploading_at = nowIso;
        updatedDataJson.meta_dispatched_at = nowIso;
      }
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
    const { error: updateError } = await videoClient
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

    // Only trigger immediate auto-publisher workflow if publish_now is true.
    // If scheduled for later, do NOT trigger here; the publish-due scheduler will trigger it cleanly at due time.
    const shouldDispatchImmediately = Boolean(publish_now);

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    if (shouldDispatchImmediately && owner && repo) {
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
    } else if (!shouldDispatchImmediately) {
      console.log(`Video ${id} scheduled for future time: ${finalScheduledTime}. Immediate dispatch skipped; will be published when scheduled time arrives.`);
    }

    return NextResponse.json({ 
      success: true, 
      platform, 
      scheduled_time: finalScheduledTime,
      is_due_now: shouldDispatchImmediately 
    });
  } catch (error: any) {
    console.error('Error approving video:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
