import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const videoId = process.env.VIDEO_ID;

  if (!supabaseUrl || !supabaseAnonKey || !videoId) {
    console.error('Missing required environment variables.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // 1. Fetch data from Supabase
  console.log(`Fetching data for video ID: ${videoId}`);
  const { data: row, error: fetchError } = await supabase
    .from('shorts_queue')
    .select('topic, data_json')
    .eq('id', videoId)
    .single();

  if (fetchError || !row) {
    console.error('Error fetching data:', fetchError);
    process.exit(1);
  }

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
  try {
    execSync(`npx remotion render remotion/Root.tsx DataComparison ${outPath} --props=${propsPath}`, { stdio: 'inherit' });
  } catch (error) {
    console.error('Failed to render video:', error);
    process.exit(1);
  }

  // 4. Upload to Supabase Storage
  console.log('Uploading to Supabase Storage...');
  const fileBuffer = fs.readFileSync(outPath);
  const fileName = `${videoId}.mp4`;
  
  const { error: uploadError } = await supabase.storage
    .from('shorts')
    .upload(fileName, fileBuffer, {
      contentType: 'video/mp4',
      upsert: true,
    });

  if (uploadError) {
    console.error('Failed to upload video:', uploadError);
    process.exit(1);
  }

  // 5. Update Supabase Row
  const { data: publicUrlData } = supabase.storage.from('shorts').getPublicUrl(fileName);
  const publicUrl = publicUrlData.publicUrl;

  console.log('Updating database row...');
  const { error: updateError } = await supabase
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
