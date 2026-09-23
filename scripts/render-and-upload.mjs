import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { findVideoAcrossProjects, uploadToStorageWithFailover, getActiveSupabase } from './supabase-helper.mjs';

async function main() {
  const videoId = process.env.VIDEO_ID;

  if (!videoId) {
    console.error('Missing required VIDEO_ID environment variable.');
    process.exit(1);
  }

  // 1. Fetch data from Supabase across configured projects
  console.log(`Fetching data for video ID: ${videoId}`);
  const found = await findVideoAcrossProjects(videoId);

  if (!found || !found.video) {
    console.error(`Error: Video [${videoId}] not found across configured Supabase projects.`);
    process.exit(1);
  }

  const { video: row, client: videoClient } = found;

  // 2. Prepare props for Remotion
  const props = {
    topic: row.topic,
    data_json: row.data_json
  };
  const propsPath = path.join(process.cwd(), 'props.json');
  fs.writeFileSync(propsPath, JSON.stringify(props));

  // 3. Render Video via Remotion CLI
  const outPath = path.join(process.cwd(), 'out.mp4');
  console.log('Rendering video...');
  
  const durationSeconds = row.data_json.duration_seconds || 15;
  const frames = durationSeconds * 30;

  // Determine which composition to render based on format type
  const formatType = 
    row.data_json.format || 
    row.data_json.type || 
    (row.data_json.scenes ? 'AestheticVideo' :
     row.data_json.questions ? 'Quiz' :
     row.data_json.scenarios ? 'Would You Rather' :
     row.data_json.contestants ? 'Arena Clash' : 'Data Comparison');

  let compName = 'DataComparison';
  if (formatType === 'Would You Rather') compName = 'WouldYouRather';
  else if (formatType === 'Quiz') compName = 'Quiz';
  else if (formatType === 'Arena Clash') compName = 'ArenaClash';
  else if (formatType === 'AestheticVideo') compName = 'AestheticVideo';

  try {
    execSync(`npx remotion render remotion/index.ts ${compName} ${outPath} --props=${propsPath}`, { stdio: 'inherit' });
  } catch (error) {
    console.error('Failed to render video:', error);
    process.exit(1);
  }

  // 4. Upload to Supabase Storage with failover
  console.log('Uploading to Supabase Storage...');
  const fileBuffer = fs.readFileSync(outPath);
  const fileName = `${videoId}.mp4`;
  
  const { publicUrl, client: storageClient } = await uploadToStorageWithFailover(
    'shorts',
    fileName,
    fileBuffer,
    { contentType: 'video/mp4', upsert: true }
  );

  console.log(`Video uploaded successfully to Supabase Storage: ${publicUrl}`);

  // 5. Update Supabase Row
  console.log('Updating database row...');
  // Update on the database where the video belongs
  const { error: updateError } = await videoClient
    .from('shorts_queue')
    .update({
      video_url: publicUrl,
      status: 'Needs_Approval'
    })
    .eq('id', videoId);

  if (updateError) {
    console.error('Failed to update row:', updateError);
    process.exit(1);
  }

  console.log('Successfully rendered and uploaded video!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
