import { NextResponse } from 'next/server';
import { Octokit } from 'octokit';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export async function POST(request: Request) {
  try {
    const { video_id } = await request.json();

    if (!video_id) {
      return NextResponse.json({ success: false, error: 'video_id is required' }, { status: 400 });
    }

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;

    if (!owner || !repo) {
       throw new Error('GITHUB_OWNER or GITHUB_REPO is not configured.');
    }

    // Trigger GitHub Action
    await octokit.rest.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: 'render-video.yml',
      ref: 'main', // Assuming the default branch is main
      inputs: {
        video_id: video_id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error triggering render:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
