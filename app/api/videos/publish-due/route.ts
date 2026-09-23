import { NextResponse } from 'next/server';
import { Octokit } from 'octokit';
import { queryAllProjectsVideos, findVideoAcrossProjects } from '@/lib/supabase';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export async function POST(request: Request) {
  try {
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    if (!owner || !repo) {
      return NextResponse.json({ success: false, message: 'GitHub credentials not configured' }, { status: 200 });
    }

    const now = new Date();
    // Fetch all videos that might have due schedules across all configured projects
    const videos = await queryAllProjectsVideos((client) =>
      client
        .from('shorts_queue')
        .select('*')
        .not('video_url', 'is', null)
        .in('status', ['Scheduled', 'Needs_Approval'])
    );

    if (!videos || videos.length === 0) {
      return NextResponse.json({ success: true, triggered: 0 });
    }

    let triggeredCount = 0;

    for (const v of videos) {
      // Re-fetch fresh state for this video to avoid race conditions between concurrent requests
      const found = await findVideoAcrossProjects(v.id);
      const currentV = found?.video || v;
      const videoClient = found?.client;
      const dataJson = currentV.data_json || {};

      const ytStatus = dataJson.youtube_status;
      const ytTime = dataJson.youtube_scheduled_time || currentV.scheduled_time;
      const isYtUploadingTimeout = ytStatus === 'Uploading' && dataJson.youtube_uploading_at && (now.getTime() - new Date(dataJson.youtube_uploading_at).getTime() >= 5 * 60 * 1000);
      const isYtDue = (ytStatus === 'Scheduled' || isYtUploadingTimeout) && ytTime && new Date(ytTime).getTime() <= (now.getTime() + 60000);
      const isYtRecentlyDispatched = dataJson.youtube_dispatched_at && (now.getTime() - new Date(dataJson.youtube_dispatched_at).getTime() < 3 * 60 * 1000);

      const metaStatus = dataJson.meta_status;
      const metaTime = dataJson.meta_scheduled_time || currentV.scheduled_time;
      const isMetaUploadingTimeout = metaStatus === 'Uploading' && dataJson.meta_uploading_at && (now.getTime() - new Date(dataJson.meta_uploading_at).getTime() >= 5 * 60 * 1000);
      const isMetaDue = (metaStatus === 'Scheduled' || isMetaUploadingTimeout) && metaTime && new Date(metaTime).getTime() <= (now.getTime() + 60000);
      const isMetaRecentlyDispatched = dataJson.meta_dispatched_at && (now.getTime() - new Date(dataJson.meta_dispatched_at).getTime() < 3 * 60 * 1000);

      if (isYtDue && !isYtRecentlyDispatched) {
        try {
          // Lock in database immediately so any concurrent or subsequent request ignores this video
          const updated = {
            ...dataJson,
            youtube_status: 'Uploading',
            youtube_uploading_at: now.toISOString(),
            youtube_dispatched_at: now.toISOString(),
          };
          if (videoClient) {
            await videoClient
              .from('shorts_queue')
              .update({ data_json: updated })
              .eq('id', currentV.id);
          }

          await octokit.rest.actions.createWorkflowDispatch({
            owner,
            repo,
            workflow_id: 'auto-publisher.yml',
            ref: 'main',
            inputs: {
              video_id: currentV.id,
              target: 'youtube',
              force: 'true',
            },
          });
          triggeredCount++;
          console.log(`[Publish Due Scheduler] Dispatched YouTube auto-publisher for video ${currentV.id}`);
        } catch (err: any) {
          console.error(`Failed to dispatch due YouTube publish for ${currentV.id}:`, err.message);
        }
      }

      if (isMetaDue && !isMetaRecentlyDispatched) {
        try {
          // Lock in database immediately so any concurrent or subsequent request ignores this video
          const updated = {
            ...dataJson,
            meta_status: 'Uploading',
            meta_uploading_at: now.toISOString(),
            meta_dispatched_at: now.toISOString(),
          };
          if (videoClient) {
            await videoClient
              .from('shorts_queue')
              .update({ data_json: updated })
              .eq('id', currentV.id);
          }

          await octokit.rest.actions.createWorkflowDispatch({
            owner,
            repo,
            workflow_id: 'auto-publisher.yml',
            ref: 'main',
            inputs: {
              video_id: currentV.id,
              target: 'meta',
              force: 'true',
            },
          });
          triggeredCount++;
          console.log(`[Publish Due Scheduler] Dispatched Meta auto-publisher for video ${currentV.id}`);
        } catch (err: any) {
          console.error(`Failed to dispatch due Meta publish for ${currentV.id}:`, err.message);
        }
      }
    }

    return NextResponse.json({ success: true, triggered: triggeredCount });
  } catch (error: any) {
    console.error('Error in publish-due route:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
