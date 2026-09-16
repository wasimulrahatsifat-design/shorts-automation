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

    // Trigger auto-publisher workflow so it can check if the video should be published immediately
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    if (owner && repo) {
      try {
        await octokit.rest.actions.createWorkflowDispatch({
          owner,
          repo,
          workflow_id: 'auto-publisher.yml',
          ref: 'main',
        });
        console.log(`Successfully triggered auto-publisher.yml`);
      } catch (ghError) {
        console.error('Failed to trigger auto-publisher GitHub Action:', ghError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error approving video:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
