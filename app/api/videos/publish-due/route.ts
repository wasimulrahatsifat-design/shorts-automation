import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Octokit } from 'octokit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
    // Fetch all videos that might have due schedules
    const { data: videos, error } = await supabase
      .from('shorts_queue')
      .select('*')
      .not('video_url', 'is', null)
      .in('status', ['Scheduled', 'Needs_Approval']);

    if (error || !videos) {
      return NextResponse.json({ success: true, triggered: 0 });
    }

    let triggeredCount = 0;

    for (const v of videos) {
      const dataJson = v.data_json || {};
      const ytStatus = dataJson.youtube_status;
      const ytTime = dataJson.youtube_scheduled_time || v.scheduled_time;
      const isYtDue = ytStatus === 'Scheduled' && ytTime && new Date(ytTime).getTime() <= (now.getTime() + 60000);

      const metaStatus = dataJson.meta_status;
      const metaTime = dataJson.meta_scheduled_time || v.scheduled_time;
      const isMetaDue = metaStatus === 'Scheduled' && metaTime && new Date(metaTime).getTime() <= (now.getTime() + 60000);

      if (isYtDue) {
        try {
          // Lock so we don't dispatch multiple times
          const updated = {
            ...dataJson,
            youtube_status: 'Uploading',
            youtube_uploading_at: now.toISOString(),
          };
          await supabase
            .from('shorts_queue')
            .update({ data_json: updated })
            .eq('id', v.id);

          await octokit.rest.actions.createWorkflowDispatch({
            owner,
            repo,
            workflow_id: 'auto-publisher.yml',
            ref: 'main',
            inputs: {
              video_id: v.id,
              target: 'youtube',
              force: 'true',
            },
          });
          triggeredCount++;
          console.log(`[Publish Due Scheduler] Dispatched YouTube auto-publisher for video ${v.id}`);
        } catch (err: any) {
          console.error(`Failed to dispatch due YouTube publish for ${v.id}:`, err.message);
        }
      }

      if (isMetaDue) {
        try {
          const updated = {
            ...dataJson,
            meta_status: 'Uploading',
            meta_uploading_at: now.toISOString(),
          };
          await supabase
            .from('shorts_queue')
            .update({ data_json: updated })
            .eq('id', v.id);

          await octokit.rest.actions.createWorkflowDispatch({
            owner,
            repo,
            workflow_id: 'auto-publisher.yml',
            ref: 'main',
            inputs: {
              video_id: v.id,
              target: 'meta',
              force: 'true',
            },
          });
          triggeredCount++;
          console.log(`[Publish Due Scheduler] Dispatched Meta auto-publisher for video ${v.id}`);
        } catch (err: any) {
          console.error(`Failed to dispatch due Meta publish for ${v.id}:`, err.message);
        }
      }
    }

    return NextResponse.json({ success: true, triggered: triggeredCount });
  } catch (error: any) {
    console.error('Error in publish-due route:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
