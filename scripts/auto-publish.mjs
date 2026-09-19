import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

/**
 * Automatically resolves a Page Access Token if a User Access Token is provided
 */
async function resolvePageAccessToken(inputToken, pageId) {
  if (!inputToken || !pageId) return inputToken;
  try {
    const meRes = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${inputToken}`);
    const meData = await meRes.json();
    if (meData.id === pageId) {
      return inputToken; // Already a page token
    }
    console.log(`Input token belongs to: ${meData.name || 'User'} (${meData.id}). Resolving Page Access Token...`);
    const accountsRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${inputToken}`);
    const accountsData = await accountsRes.json();
    if (accountsData.data && Array.isArray(accountsData.data)) {
      const match = accountsData.data.find(acc => acc.id === pageId);
      if (match && match.access_token) {
        console.log(`Successfully auto-resolved Page Access Token for "${match.name}" (${match.id})`);
        return match.access_token;
      }
    }
  } catch (err) {
    console.warn('Could not auto-resolve Page Access Token:', err.message);
  }
  return inputToken;
}

/**
 * Uploads a video file to a Facebook Page via Meta Graph API
 */
async function uploadToFacebook(video, localFilePath) {
  const pageId = process.env.FB_PAGE_ID;
  const rawToken = process.env.FB_PAGE_ACCESS_TOKEN;

  if (!pageId || !rawToken) {
    console.log('Skipping Facebook: FB_PAGE_ID or FB_PAGE_ACCESS_TOKEN not configured.');
    return null;
  }

  const accessToken = await resolvePageAccessToken(rawToken, pageId);

  console.log('Uploading to Facebook Page...');

  // 1. Try URL-based upload first if video has a public Supabase URL
  if (video.video_url) {
    try {
      console.log('Attempting Facebook upload via public video_url...');
      const params = new URLSearchParams({
        access_token: accessToken,
        file_url: video.video_url,
        title: video.topic,
        description: video.data_json?.description || `${video.topic}\n\n#shorts #reels #viral #trending`,
        published: 'true',
      });

      const response = await fetch(`https://graph.facebook.com/v19.0/${pageId}/videos`, {
        method: 'POST',
        body: params,
      });

      const data = await response.json();
      if (response.ok && data.id && !data.error) {
        console.log(`Facebook Upload successful via URL! Video ID: ${data.id}`);
        return data.id;
      }
      console.warn('URL-based Facebook upload did not succeed, trying multipart file upload:', data.error?.message || data);
    } catch (urlErr) {
      console.warn('URL-based Facebook upload error, falling back to multipart:', urlErr.message);
    }
  }

  // 2. Fallback: Multipart/form-data upload with local file
  console.log('Uploading video file to Facebook via multipart/form-data...');
  const formData = new FormData();
  formData.append('access_token', accessToken);
  formData.append('title', video.topic);
  formData.append('description', video.data_json?.description || `${video.topic}\n\n#shorts #reels #viral #trending`);
  formData.append('published', 'true');

  const fileBuffer = fs.readFileSync(localFilePath);
  const fileBlob = new Blob([fileBuffer], { type: 'video/mp4' });
  formData.append('source', fileBlob, path.basename(localFilePath));

  const fbUrl = `https://graph.facebook.com/v19.0/${pageId}/videos`;
  const response = await fetch(fbUrl, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    const errorMsg = data.error?.message || `Status ${response.status}: ${JSON.stringify(data)}`;
    throw new Error(`Facebook API Error: ${errorMsg}`);
  }

  console.log(`Facebook Upload successful! Video ID: ${data.id}`);
  return data.id;
}

/**
 * Uploads and publishes a video as an Instagram Reel via Meta Graph API
 */
async function uploadToInstagram(video, localFilePath) {
  const igUserId = process.env.IG_USER_ID;
  const accessToken = process.env.IG_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN;

  if (!igUserId || !accessToken) {
    console.log('Skipping Instagram: IG_USER_ID or IG_ACCESS_TOKEN/FB_PAGE_ACCESS_TOKEN not configured.');
    return null;
  }

  if (!video.video_url) {
    console.log('Skipping Instagram: Video does not have a public video_url for container creation.');
    return null;
  }

  console.log('Uploading to Instagram Reels...');

  // Step 1: Create Media Container
  console.log('Creating Instagram media container...');
  const containerUrl = `https://graph.facebook.com/v19.0/${igUserId}/media`;
  const containerParams = new URLSearchParams({
    media_type: 'REELS',
    video_url: video.video_url,
    caption: video.data_json?.description || `${video.topic}\n\n#reels #shorts #viral #trending`,
    access_token: accessToken,
  });

  const createRes = await fetch(`${containerUrl}?${containerParams.toString()}`, {
    method: 'POST',
  });
  const createData = await createRes.json();

  if (!createRes.ok || createData.error || !createData.id) {
    const errorMsg = createData.error?.message || `Status ${createRes.status}: ${JSON.stringify(createData)}`;
    throw new Error(`Instagram Container Creation Failed: ${errorMsg}`);
  }

  const creationId = createData.id;
  console.log(`Instagram media container created! ID: ${creationId}`);

  // Step 2: Poll container status until FINISHED
  console.log('Waiting for Instagram to process the video...');
  let isReady = false;
  const maxAttempts = 24; // 24 * 5s = 120 seconds max
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const statusUrl = `https://graph.facebook.com/v19.0/${creationId}?fields=status_code,status&access_token=${accessToken}`;
    const statusRes = await fetch(statusUrl);
    const statusData = await statusRes.json();

    const statusCode = statusData.status_code;
    console.log(`[Attempt ${attempt}/${maxAttempts}] Instagram processing status: ${statusCode || 'UNKNOWN'}`);

    if (statusCode === 'FINISHED') {
      isReady = true;
      break;
    } else if (statusCode === 'ERROR') {
      throw new Error(`Instagram video processing encountered an error: ${JSON.stringify(statusData)}`);
    }
  }

  if (!isReady) {
    throw new Error('Timed out waiting for Instagram video processing to complete.');
  }

  // Step 3: Publish the container
  console.log('Publishing Instagram Reel...');
  const publishUrl = `https://graph.facebook.com/v19.0/${igUserId}/media_publish`;
  const publishParams = new URLSearchParams({
    creation_id: creationId,
    access_token: accessToken,
  });

  const publishRes = await fetch(`${publishUrl}?${publishParams.toString()}`, {
    method: 'POST',
  });
  const publishData = await publishRes.json();

  if (!publishRes.ok || publishData.error || !publishData.id) {
    const errorMsg = publishData.error?.message || `Status ${publishRes.status}: ${JSON.stringify(publishData)}`;
    throw new Error(`Instagram Publish Failed: ${errorMsg}`);
  }

  console.log(`Instagram Reel published successfully! Media ID: ${publishData.id}`);
  return publishData.id;
}

/**
 * Uploads a video file to YouTube Shorts via YouTube Data API v3
 */
async function uploadToYouTube(video, localFilePath, youtube) {
  if (!youtube) {
    console.log('Skipping YouTube: YouTube client not authenticated.');
    return null;
  }

  console.log('Uploading to YouTube...');
  const res = await youtube.videos.insert({
    part: 'snippet,status',
    requestBody: {
      snippet: {
        title: video.topic,
        description: video.data_json?.description || `${video.topic}\n\n#shorts #viral #trending`,
        tags: ['shorts', 'viral', 'trending'],
        categoryId: '24', // Entertainment
      },
      status: {
        privacyStatus: 'private', // Set to 'public' when ready
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: fs.createReadStream(localFilePath),
    },
  });

  console.log(`YouTube Upload successful! Video ID: ${res.data.id}`);
  return res.data.id;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing required Supabase environment variables.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const targetVideoId = (process.env.TARGET_VIDEO_ID || '').trim() || null;
  const rawTargetPlatform = (process.env.TARGET_PLATFORM || '').toLowerCase().trim();
  const targetPlatform = rawTargetPlatform || 'all';
  const forcePublish = process.env.FORCE_PUBLISH === 'true';
  const now = new Date();
  console.log(`Auto-Publish Config: targetVideoId=${targetVideoId || 'any scheduled'}, targetPlatform=${targetPlatform}, forcePublish=${forcePublish}`);

  // 1. Fetch videos to process
  let videos = [];
  if (targetVideoId) {
    console.log(`Fetching specific video [${targetVideoId}]...`);
    const { data, error } = await supabase
      .from('shorts_queue')
      .select('*')
      .eq('id', targetVideoId);

    if (error) {
      console.error('Error fetching target video:', error);
      process.exit(1);
    }
    const found = data && data[0];
    if (!found) {
      console.log(`Target video [${targetVideoId}] not found. Exiting gracefully.`);
      process.exit(0);
    }

    videos = [found];
  } else {
    // Scheduled Cron Job Mode: Find videos that are in a scheduled state
    console.log(`Checking for scheduled videos due to be published at or before ${now.toISOString()}...`);
    const { data, error } = await supabase
      .from('shorts_queue')
      .select('*')
      .not('video_url', 'is', null)
      .in('status', ['Scheduled', 'Partially_Published', 'Needs_Approval']);

    if (error) {
      console.error('Error fetching scheduled videos:', error);
      process.exit(1);
    }
    videos = data || [];
  }

  if (!videos || videos.length === 0) {
    console.log('No videos found for publishing right now. Exiting gracefully.');
    process.exit(0);
  }

  // Initialize YouTube OAuth2 Client if credentials exist and YouTube could be targeted
  let youtube = null;
  const allowsYouTubeGlobal = targetPlatform === 'all' || targetPlatform === 'youtube';
  const allowsMetaGlobal = targetPlatform === 'all' || targetPlatform === 'meta' || targetPlatform === 'facebook-instagram';

  if (allowsYouTubeGlobal) {
    const ytClientId = process.env.YOUTUBE_CLIENT_ID;
    const ytClientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const ytRefreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

    if (ytClientId && ytClientSecret && ytRefreshToken) {
      console.log('Authenticating with YouTube API...');
      try {
        const oauth2Client = new google.auth.OAuth2(
          ytClientId,
          ytClientSecret,
          'https://developers.google.com/oauthplayground'
        );
        oauth2Client.setCredentials({ refresh_token: ytRefreshToken });

        const { token } = await oauth2Client.getAccessToken();
        if (!token) throw new Error('OAuth client returned an empty access token.');
        
        youtube = google.youtube({ version: 'v3', auth: oauth2Client });
        console.log('Successfully authenticated with YouTube API.');
      } catch (authError) {
        console.warn('YouTube authentication failed:', authError.message || authError);
        console.warn('Continuing without YouTube integration.');
      }
    } else {
      console.log('YouTube credentials not provided. Skipping YouTube.');
    }
  }

  console.log(`Processing ${videos.length} candidate video(s)...`);

  for (const video of videos) {
    console.log(`\n======================================================`);
    console.log(`Processing video: [${video.id}] "${video.topic}"`);
    console.log(`Target platform filter: "${targetPlatform}", Force: ${forcePublish}`);
    console.log(`======================================================`);

    if (!video.video_url) {
      console.error('Video does not have a video_url. Skipping.');
      continue;
    }

    const currentYtStatus = video.data_json?.youtube_status;
    const currentMetaStatus = video.data_json?.meta_status;

    // Check YouTube schedule
    const ytScheduledTime = video.data_json?.youtube_scheduled_time || video.scheduled_time;
    const isYtScheduled = currentYtStatus === 'Scheduled';
    const isYtTimeDue = ytScheduledTime && new Date(ytScheduledTime).getTime() <= (now.getTime() + 60000); // 1 min buffer
    const isYtAlreadyPublished = currentYtStatus === 'Published';
    const isYtUploading = currentYtStatus === 'Uploading' && (
      video.data_json?.youtube_uploading_at && (now.getTime() - new Date(video.data_json.youtube_uploading_at).getTime() < 10 * 60 * 1000)
    );

    // Check Meta schedule
    const metaScheduledTime = video.data_json?.meta_scheduled_time || video.scheduled_time;
    const isMetaScheduled = currentMetaStatus === 'Scheduled';
    const isMetaTimeDue = metaScheduledTime && new Date(metaScheduledTime).getTime() <= (now.getTime() + 60000);
    const isMetaAlreadyPublished = currentMetaStatus === 'Published';
    const isMetaUploading = currentMetaStatus === 'Uploading' && (
      video.data_json?.meta_uploading_at && (now.getTime() - new Date(video.data_json.meta_uploading_at).getTime() < 10 * 60 * 1000)
    );

    // STRICT PLATFORM ISOLATION:
    // YouTube can ONLY be published if:
    // 1. YouTube is targeted (all or youtube).
    // 2. YouTube is NOT already published and NOT currently uploading.
    // 3. EITHER forcePublish is true (from direct user 1-click publish)
    //    OR (video was approved/scheduled for YouTube AND scheduled time has arrived).
    const shouldPublishYouTube = allowsYouTubeGlobal && !isYtAlreadyPublished && !isYtUploading && (
      (forcePublish && (targetPlatform === 'youtube' || targetPlatform === 'all')) ||
      (isYtScheduled && isYtTimeDue)
    );

    // Meta can ONLY be published if:
    // 1. Meta is targeted (all or meta).
    // 2. Meta is NOT already published and NOT currently uploading.
    // 3. EITHER forcePublish is true (from direct user 1-click publish)
    //    OR (video was approved/scheduled for Meta AND scheduled time has arrived).
    const shouldPublishMeta = allowsMetaGlobal && !isMetaAlreadyPublished && !isMetaUploading && (
      (forcePublish && (targetPlatform === 'meta' || targetPlatform === 'all')) ||
      (isMetaScheduled && isMetaTimeDue)
    );

    console.log(`Platform evaluation for [${video.id}]:`);
    console.log(`- YouTube: shouldPublish=${shouldPublishYouTube} (status=${currentYtStatus}, scheduled=${ytScheduledTime || 'none'}, isDue=${isYtTimeDue})`);
    console.log(`- Meta:    shouldPublish=${shouldPublishMeta} (status=${currentMetaStatus}, scheduled=${metaScheduledTime || 'none'}, isDue=${isMetaTimeDue})`);

    if (!shouldPublishYouTube && !shouldPublishMeta) {
      console.log(`Video [${video.id}] has no pending due actions for platform "${targetPlatform}". Skipping.`);
      continue;
    }

    // Acquire in-progress lock before downloading & uploading to prevent duplicate uploads
    const lockDataJson = { ...(video.data_json || {}) };
    if (shouldPublishYouTube) {
      lockDataJson.youtube_status = 'Uploading';
      lockDataJson.youtube_uploading_at = new Date().toISOString();
    }
    if (shouldPublishMeta) {
      lockDataJson.meta_status = 'Uploading';
      lockDataJson.meta_uploading_at = new Date().toISOString();
    }

    await supabase
      .from('shorts_queue')
      .update({ data_json: lockDataJson })
      .eq('id', video.id);

    // Download the MP4 from Supabase Storage
    console.log('Downloading video file from Supabase Storage...');
    const fileName = `${video.id}.mp4`;
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('shorts')
      .download(fileName);

    if (downloadError) {
      console.error('Failed to download video from Supabase:', downloadError);
      // Revert locks on download error
      await supabase
        .from('shorts_queue')
        .update({ data_json: video.data_json })
        .eq('id', video.id);
      continue;
    }

    const localFilePath = path.join(process.cwd(), fileName);
    fs.writeFileSync(localFilePath, Buffer.from(await fileData.arrayBuffer()));
    console.log(`Video downloaded locally to: ${localFilePath}`);

    const uploadResults = {
      youtube: false,
      facebook: false,
      instagram: false,
    };
    const uploadedIds = {};

    try {
      // 1. YouTube Upload (ONLY if shouldPublishYouTube is true)
      if (shouldPublishYouTube) {
        try {
          const ytId = await uploadToYouTube(video, localFilePath, youtube);
          if (ytId) {
            uploadResults.youtube = true;
            uploadedIds.youtube_id = ytId;
          }
        } catch (ytError) {
          console.error('YouTube upload encountered an error:', ytError.message || ytError);
        }
      }

      // 2. Facebook Page Upload (ONLY if shouldPublishMeta is true)
      if (shouldPublishMeta) {
        try {
          const fbId = await uploadToFacebook(video, localFilePath);
          if (fbId) {
            uploadResults.facebook = true;
            uploadedIds.facebook_id = fbId;
          }
        } catch (fbError) {
          console.error('Facebook upload encountered an error:', fbError.message || fbError);
        }
      }

      // 3. Instagram Reels Upload (ONLY if shouldPublishMeta is true)
      if (shouldPublishMeta) {
        try {
          const igId = await uploadToInstagram(video, localFilePath);
          if (igId) {
            uploadResults.instagram = true;
            uploadedIds.instagram_id = igId;
          }
        } catch (igError) {
          console.error('Instagram Reels upload encountered an error:', igError.message || igError);
        }
      }

      // 4. Update Database Status & Platform Tracking
      const updatedDataJson = { ...(video.data_json || {}), ...(lockDataJson || {}) };
      if (shouldPublishYouTube) {
        if (uploadResults.youtube) {
          updatedDataJson.youtube_status = 'Published';
          if (uploadedIds.youtube_id) updatedDataJson.youtube_id = uploadedIds.youtube_id;
        } else {
          updatedDataJson.youtube_status = 'Failed';
        }
      }

      if (shouldPublishMeta) {
        if (uploadResults.facebook || uploadResults.instagram) {
          updatedDataJson.meta_status = 'Published';
          if (uploadedIds.facebook_id) updatedDataJson.facebook_id = uploadedIds.facebook_id;
          if (uploadedIds.instagram_id) updatedDataJson.instagram_id = uploadedIds.instagram_id;
        } else {
          updatedDataJson.meta_status = 'Failed';
        }
      }

      const isYtDone = updatedDataJson.youtube_status === 'Published';
      const isMetaDone = updatedDataJson.meta_status === 'Published';
      const isStillScheduled = updatedDataJson.youtube_status === 'Scheduled' || updatedDataJson.meta_status === 'Scheduled';

      let overallStatus = 'Scheduled';
      if (isYtDone && isMetaDone) {
        overallStatus = 'Published';
      } else if (isYtDone || isMetaDone) {
        overallStatus = isStillScheduled ? 'Scheduled' : 'Published';
      } else if (isStillScheduled) {
        overallStatus = 'Scheduled';
      } else {
        overallStatus = 'Needs_Approval';
      }

      console.log(`\nUpload summary for [${video.id}]:`, uploadResults);
      console.log(`New platform statuses: YouTube=${updatedDataJson.youtube_status || 'Pending'}, Meta=${updatedDataJson.meta_status || 'Pending'}, Overall=${overallStatus}`);

      const { error: updateError } = await supabase
        .from('shorts_queue')
        .update({
          status: overallStatus,
          data_json: updatedDataJson,
        })
        .eq('id', video.id);

      if (updateError) {
        console.error('Failed to update status in database:', updateError);
      } else {
        console.log(`Successfully updated database status for video: ${video.id}`);
      }
    } finally {
      // Clean up downloaded file
      if (fs.existsSync(localFilePath)) {
        try {
          fs.unlinkSync(localFilePath);
          console.log(`Cleaned up temporary file: ${localFilePath}`);
        } catch (cleanupErr) {
          console.warn('Failed to remove temp video file:', cleanupErr);
        }
      }
    }
  }

  console.log('\nAuto-publish workflow completed successfully!');
}

main().catch((err) => {
  console.error('Fatal error in auto-publish workflow:', err);
  process.exit(1);
});
