import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

  if (!supabaseUrl || !supabaseAnonKey || !clientId || !clientSecret || !refreshToken) {
    console.error('Missing required environment variables.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // 1. Check for a scheduled video that's due
  console.log('Checking for scheduled videos due to be published...');
  const { data: videos, error: fetchError } = await supabase
    .from('shorts_queue')
    .select('*')
    .eq('status', 'Scheduled')
    .lte('scheduled_time', new Date().toISOString());

  if (fetchError) {
    console.error('Error fetching scheduled videos:', fetchError);
    process.exit(1);
  }

  if (!videos || videos.length === 0) {
    console.log('No videos scheduled for publishing right now. Exiting gracefully.');
    process.exit(0);
  }

  console.log(`Found ${videos.length} videos to publish.`);

  for (const video of videos) {
    console.log(`\n--- Processing video: [${video.id}] ${video.topic} ---`);

    if (!video.video_url) {
      console.error('Scheduled video does not have a video_url. Skipping.');
      continue;
    }

    // 2. Download the MP4 from Supabase Storage
    console.log('Downloading video file from Supabase...');
    const fileName = `${video.id}.mp4`;
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('shorts')
      .download(fileName);

    if (downloadError) {
      console.error('Failed to download video:', downloadError);
      continue;
    }

    const localFilePath = path.join(process.cwd(), fileName);
    fs.writeFileSync(localFilePath, Buffer.from(await fileData.arrayBuffer()));
    console.log(`Video downloaded to ${localFilePath}`);

    // 3. Upload to YouTube
    console.log('Uploading to YouTube...');
    try {
      const res = await youtube.videos.insert({
        part: 'snippet,status',
        requestBody: {
          snippet: {
            title: video.topic,
            description: `${video.topic}\n\n#shorts #data #comparison`,
            tags: ['shorts', 'data', 'comparison'],
            categoryId: '24' // Entertainment
          },
          status: {
            privacyStatus: 'private', // Set to 'public' when ready
            selfDeclaredMadeForKids: false
          }
        },
        media: {
          body: fs.createReadStream(localFilePath)
        }
      });

      console.log('YouTube Upload successful! Video ID:', res.data.id);
    } catch (error) {
      console.error('YouTube API upload failed:', error);
      continue;
    }

    // 4. Update Supabase Row to 'Published'
    console.log('Updating database status to Published...');
    const { error: updateError } = await supabase
      .from('shorts_queue')
      .update({ status: 'Published' })
      .eq('id', video.id);

    if (updateError) {
      console.error('Failed to update status in database:', updateError);
    } else {
      console.log(`Successfully published video: ${video.id}`);
    }
  }

  console.log('\nAuto-publish workflow completed successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
