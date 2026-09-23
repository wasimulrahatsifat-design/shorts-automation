import { getSupabaseConfigs, getClientForConfig, findVideoAcrossProjects, getActiveSupabase } from './supabase-helper.mjs';
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
  const rawToken = process.env.IG_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FB_PAGE_ID;

  if (!igUserId || !rawToken) {
    console.log('Skipping Instagram: IG_USER_ID or IG_ACCESS_TOKEN/FB_PAGE_ACCESS_TOKEN not configured.');
    return null;
  }

  const accessToken = await resolvePageAccessToken(rawToken, pageId);

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
async function uploadToYouTube(video, localFilePath, youtube, youtubeAuthError) {
  if (!youtube) {
    const reason = youtubeAuthError ? `YouTube authentication failed: ${youtubeAuthError}` : 'YouTube client not authenticated.';
    console.error(`Skipping YouTube: ${reason}`);
    throw new Error(reason);
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
        privacyStatus: video.data_json?.youtube_privacy || 'private', // Uploaded as private as preferred by user
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
  const activeObj = getActiveSupabase();
  const defaultSupabase = activeObj.client;

  const targetVideoId = (process.env.TARGET_VIDEO_ID || '').trim() || null;
  const rawTargetPlatform = (process.env.TARGET_PLATFORM || '').toLowerCase().trim();
  const targetPlatform = rawTargetPlatform || 'all';
  const forcePublish = process.env.FORCE_PUBLISH === 'true';
  const now = new Date();
  console.log(`Auto-Publish Config: targetVideoId=${targetVideoId || 'any scheduled'}, targetPlatform=${targetPlatform}, forcePublish=${forcePublish}`);

  // 1. Fetch videos to process across configured Supabase projects
  let videos = [];
  if (targetVideoId) {
    console.log(`Fetching specific video [${targetVideoId}] across configured projects...`);
    const found = await findVideoAcrossProjects(targetVideoId);
    if (!found || !found.video) {
      console.log(`Target video [${targetVideoId}] not found. Exiting gracefully.`);
      process.exit(0);
    }
    const v = found.video;
    v._client = found.client;
    videos = [v];
  } else {
    // Scheduled Cron Job Mode: Find videos across all configured projects
    console.log(`Checking for scheduled videos due to be published at or before ${now.toISOString()} across all configured projects...`);
    const configs = getSupabaseConfigs();
    for (const cfg of configs) {
      try {
        const cl = getClientForConfig(cfg);
        const { data, error } = await cl
          .from('shorts_queue')
          .select('*')
          .not('video_url', 'is', null)
          .in('status', ['Scheduled', 'Needs_Approval']);

        if (!error && Array.isArray(data)) {
          for (const item of data) {
            item._client = cl;
            videos.push(item);
          }
        }
      } catch (e) {
        // Skip failed project
      }
    }
  }

  if (!videos || videos.length === 0) {
    console.log('No videos found for publishing right now. Exiting gracefully.');
    process.exit(0);
  }

  // Initialize YouTube OAuth2 Client if credentials exist and YouTube could be targeted
  let youtube = null;
  let youtubeAuthError = null;
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
        youtubeAuthError = authError.message || String(authError);
        console.error('YouTube authentication failed:', youtubeAuthError);
        console.warn('Continuing without YouTube integration.');
      }
    } else {
      youtubeAuthError = 'Missing YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, or YOUTUBE_REFRESH_TOKEN in GitHub repository secrets.';
      console.log('YouTube credentials not configured in GitHub Secrets.');
    }
  }

  console.log(`Processing ${videos.length} candidate video(s)...`);

  async function getFreshVideoRecord(id) {
    try {
      return await findVideoAcrossProjects(id);
    } catch (e) {
      return null;
    }
  }

  async function getFreshVideoData(id) {
    const record = await getFreshVideoRecord(id);
    return record ? record.video : null;
  }

  for (const rawVideo of videos) {
    const freshRecord = await getFreshVideoRecord(rawVideo.id);
    const video = freshRecord?.video || rawVideo;
    const videoClient = freshRecord?.client || rawVideo._client || defaultSupabase;

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
    const isYtScheduled = currentYtStatus === 'Scheduled' || (video.status === 'Scheduled' && currentYtStatus !== 'Published');
    const isYtTimeDue = ytScheduledTime && new Date(ytScheduledTime).getTime() <= (now.getTime() + 60000); // 1 min buffer
    const isYtAlreadyPublished = currentYtStatus === 'Published' || Boolean(video.data_json?.youtube_id);
    const isYtStuckUploading = currentYtStatus === 'Uploading' && video.data_json?.youtube_uploading_at && (now.getTime() - new Date(video.data_json.youtube_uploading_at).getTime() >= 5 * 60 * 1000);
    const isYtActiveUploading = currentYtStatus === 'Uploading' && !isYtStuckUploading;

    // Check Meta schedule
    const metaScheduledTime = video.data_json?.meta_scheduled_time || video.scheduled_time;
    const isMetaScheduled = currentMetaStatus === 'Scheduled' || (video.status === 'Scheduled' && currentMetaStatus !== 'Published');
    const isMetaTimeDue = metaScheduledTime && new Date(metaScheduledTime).getTime() <= (now.getTime() + 60000);
    // Meta is considered already published if status is Published OR both Facebook & Instagram IDs exist
    const isMetaAlreadyPublished = currentMetaStatus === 'Published' || (Boolean(video.data_json?.facebook_id) && Boolean(video.data_json?.instagram_id));
    const isMetaStuckUploading = currentMetaStatus === 'Uploading' && video.data_json?.meta_uploading_at && (now.getTime() - new Date(video.data_json.meta_uploading_at).getTime() >= 5 * 60 * 1000);
    const isMetaActiveUploading = currentMetaStatus === 'Uploading' && !isMetaStuckUploading;

    // STRICT PLATFORM ISOLATION & CONCURRENCY GUARDS:
    const isSpecificVideoTarget = Boolean(targetVideoId && targetVideoId === video.id);
    const isTargetingYouTube = targetPlatform === 'youtube' || targetPlatform === 'all';
    const isTargetingMeta = targetPlatform === 'meta' || targetPlatform === 'all' || targetPlatform === 'facebook-instagram';

    // YouTube can ONLY be published if:
    // 1. YouTube credentials are provided.
    // 2. YouTube is NOT already published.
    // 3. EITHER forcePublish OR specifically targeted OR scheduled and due.
    const shouldPublishYouTube = allowsYouTubeGlobal && !isYtAlreadyPublished && (
      forcePublish
        ? isTargetingYouTube
        : (isSpecificVideoTarget
            ? isTargetingYouTube
            : (isTargetingYouTube && isYtScheduled && isYtTimeDue && !isYtActiveUploading))
    );

    // Meta can ONLY be published if:
    // 1. Meta credentials are provided.
    // 2. Meta is NOT already fully published.
    // 3. EITHER forcePublish OR specifically targeted OR scheduled and due.
    const shouldPublishMeta = allowsMetaGlobal && !isMetaAlreadyPublished && (
      forcePublish
        ? isTargetingMeta
        : (isSpecificVideoTarget
            ? isTargetingMeta
            : (isTargetingMeta && isMetaScheduled && isMetaTimeDue && !isMetaActiveUploading))
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

    await videoClient
      .from('shorts_queue')
      .update({ data_json: lockDataJson })
      .eq('id', video.id);

    // Download the MP4 from Supabase Storage
    console.log('Downloading video file from Supabase Storage...');
    const fileName = `${video.id}.mp4`;
    let fileBuffer = null;

    try {
      const { data: fileData, error: downloadError } = await videoClient.storage
        .from('shorts')
        .download(fileName);

      if (!downloadError && fileData) {
        fileBuffer = Buffer.from(await fileData.arrayBuffer());
      } else if (downloadError) {
        console.warn('Storage download error:', downloadError.message || downloadError);
      }
    } catch (err) {
      console.warn('Storage download threw exception:', err.message);
    }

    if (!fileBuffer && video.video_url) {
      try {
        console.log(`Fallback: downloading video directly from video_url: ${video.video_url}`);
        const res = await fetch(video.video_url);
        if (res.ok) {
          fileBuffer = Buffer.from(await res.arrayBuffer());
        }
      } catch (fetchErr) {
        console.error('Failed to fetch from video_url:', fetchErr.message);
      }
    }

    if (!fileBuffer) {
      console.error('Failed to download video from Supabase.');
      // Revert locks on download error
      await videoClient
        .from('shorts_queue')
        .update({ data_json: video.data_json })
        .eq('id', video.id);
      continue;
    }

    const localFilePath = path.join(process.cwd(), fileName);
    fs.writeFileSync(localFilePath, fileBuffer);
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
        const freshRow = await getFreshVideoData(video.id);
        const freshData = freshRow?.data_json || video.data_json || {};
        let lastYtError = null;
        if (freshData.youtube_id || freshData.youtube_status === 'Published') {
          console.log(`[CONCURRENCY GUARD] YouTube already published for video [${video.id}] (ID: ${freshData.youtube_id}). Skipping duplicate upload.`);
          uploadResults.youtube = true;
          uploadedIds.youtube_id = freshData.youtube_id;
        } else {
          try {
            const ytId = await uploadToYouTube(video, localFilePath, youtube, youtubeAuthError);
            if (ytId) {
              uploadResults.youtube = true;
              uploadedIds.youtube_id = ytId;
              // Immediate DB update to prevent any concurrent runner from uploading YouTube again
              const currentFresh = await getFreshVideoData(video.id);
              const curData = currentFresh?.data_json || {};
              await videoClient
                .from('shorts_queue')
                .update({
                  data_json: {
                    ...curData,
                    youtube_id: ytId,
                    youtube_status: 'Published',
                    youtube_uploaded_at: new Date().toISOString(),
                    youtube_error: null,
                  },
                })
                .eq('id', video.id);
              console.log(`[IMMEDIATE DB PERSISTENCE] YouTube ID ${ytId} saved to database.`);
            }
          } catch (ytError) {
            lastYtError = ytError.message || String(ytError);
            console.error('YouTube upload encountered an error:', lastYtError);
          }
        }
      }

      // 2. Facebook Page Upload (ONLY if shouldPublishMeta is true)
      if (shouldPublishMeta) {
        const freshRow = await getFreshVideoData(video.id);
        const freshData = freshRow?.data_json || video.data_json || {};
        if (freshData.facebook_id) {
          console.log(`[CONCURRENCY GUARD] Facebook already published for video [${video.id}] (ID: ${freshData.facebook_id}). Skipping duplicate upload.`);
          uploadResults.facebook = true;
          uploadedIds.facebook_id = freshData.facebook_id;
        } else {
          try {
            const fbId = await uploadToFacebook(video, localFilePath);
            if (fbId) {
              uploadResults.facebook = true;
              uploadedIds.facebook_id = fbId;
              // Immediate DB update to prevent any concurrent runner from uploading to Facebook again!
              const currentFresh = await getFreshVideoData(video.id);
              const curData = currentFresh?.data_json || {};
              await videoClient
                .from('shorts_queue')
                .update({
                  data_json: {
                    ...curData,
                    facebook_id: fbId,
                    facebook_uploaded_at: new Date().toISOString(),
                  },
                })
                .eq('id', video.id);
              console.log(`[IMMEDIATE DB PERSISTENCE] Facebook ID ${fbId} saved to database immediately.`);
            }
          } catch (fbError) {
            console.error('Facebook upload encountered an error:', fbError.message || fbError);
          }
        }
      }

      // 3. Instagram Reels Upload (ONLY if shouldPublishMeta is true)
      if (shouldPublishMeta) {
        const freshRow = await getFreshVideoData(video.id);
        const freshData = freshRow?.data_json || video.data_json || {};
        if (freshData.instagram_id) {
          console.log(`[CONCURRENCY GUARD] Instagram already published for video [${video.id}] (ID: ${freshData.instagram_id}). Skipping duplicate upload.`);
          uploadResults.instagram = true;
          uploadedIds.instagram_id = freshData.instagram_id;
        } else {
          try {
            const igId = await uploadToInstagram(video, localFilePath);
            if (igId) {
              uploadResults.instagram = true;
              uploadedIds.instagram_id = igId;
              // Immediate DB update to prevent any concurrent runner from uploading to Instagram again!
              const currentFresh = await getFreshVideoData(video.id);
              const curData = currentFresh?.data_json || {};
              await videoClient
                .from('shorts_queue')
                .update({
                  data_json: {
                    ...curData,
                    instagram_id: igId,
                    instagram_uploaded_at: new Date().toISOString(),
                  },
                })
                .eq('id', video.id);
              console.log(`[IMMEDIATE DB PERSISTENCE] Instagram ID ${igId} saved to database immediately.`);
            }
          } catch (igError) {
            console.error('Instagram Reels upload encountered an error:', igError.message || igError);
          }
        }
      }

      // 4. Update Database Status & Platform Tracking
      const finalFresh = await getFreshVideoData(video.id);
      const updatedDataJson = { ...(finalFresh?.data_json || video.data_json || {}) };
      if (shouldPublishYouTube) {
        if (uploadResults.youtube || updatedDataJson.youtube_id) {
          updatedDataJson.youtube_status = 'Published';
          delete updatedDataJson.youtube_error;
          if (uploadedIds.youtube_id) updatedDataJson.youtube_id = uploadedIds.youtube_id;
        } else {
          updatedDataJson.youtube_status = 'Failed';
          updatedDataJson.youtube_error = lastYtError || youtubeAuthError || 'YouTube upload failed or client not authenticated';
        }
      }

      if (shouldPublishMeta) {
        if (uploadResults.facebook || uploadResults.instagram || updatedDataJson.facebook_id || updatedDataJson.instagram_id) {
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

      const { error: updateError } = await videoClient
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

  // If a specific target platform was requested and failed, exit with code 1 so GitHub Actions accurately reports failure
  if (targetVideoId || targetPlatform === 'youtube' || targetPlatform === 'meta') {
    for (const v of videos) {
      const fresh = await getFreshVideoData(v.id);
      const d = fresh?.data_json || {};
      if (targetPlatform === 'youtube' && d.youtube_status === 'Failed') {
        console.error(`\nAuto-publish failure: YouTube upload failed for video [${v.id}]: ${d.youtube_error || 'Unknown error'}`);
        process.exit(1);
      }
      if (targetPlatform === 'meta' && d.meta_status === 'Failed') {
        console.error(`\nAuto-publish failure: Meta publish failed for video [${v.id}]`);
        process.exit(1);
      }
    }
  }

  console.log('\nAuto-publish workflow completed successfully!');
}

main().catch((err) => {
  console.error('Fatal error in auto-publish workflow:', err);
  process.exit(1);
});
