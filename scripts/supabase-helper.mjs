import { createClient } from '@supabase/supabase-js';

const exhaustedIndices = new Set();
let activeProjectIndex = 0;

export function getSupabaseConfigs() {
  const configs = [];
  const seenUrls = new Set();

  const addConfig = (url, key) => {
    if (!url || !key) return;
    const cleanUrl = url.trim();
    const cleanKey = key.trim();
    if (!cleanUrl || !cleanKey || seenUrls.has(cleanUrl)) return;
    seenUrls.add(cleanUrl);
    configs.push({
      url: cleanUrl,
      anonKey: cleanKey,
      index: configs.length,
    });
  };

  addConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL_1,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY_1
  );

  for (let i = 2; i <= 10; i++) {
    addConfig(
      process.env[`SUPABASE_URL_${i}`],
      process.env[`SUPABASE_ANON_KEY_${i}`]
    );
  }

  addConfig(process.env.SUPABASE_URL_1, process.env.SUPABASE_ANON_KEY_1);

  return configs;
}

const clientCache = new Map();

export function getClientForConfig(config) {
  if (!clientCache.has(config.url)) {
    clientCache.set(config.url, createClient(config.url, config.anonKey));
  }
  return clientCache.get(config.url);
}

export function isQuotaOrRestrictedError(error) {
  if (!error) return false;
  const msg = (typeof error === 'string' ? error : error.message || error.details || error.hint || JSON.stringify(error)).toLowerCase();
  const status = error.status || error.code || error.statusCode;

  return (
    status === 402 ||
    status === '402' ||
    status === 429 ||
    status === '429' ||
    msg.includes('exceed_egress_quota') ||
    msg.includes('egress') ||
    msg.includes('quota') ||
    msg.includes('restricted') ||
    msg.includes('payment required') ||
    msg.includes('spend cap') ||
    msg.includes('billing')
  );
}

export function getActiveSupabase() {
  const configs = getSupabaseConfigs();
  if (configs.length === 0) {
    throw new Error('No Supabase credentials configured.');
  }

  for (let i = 0; i < configs.length; i++) {
    const idx = (activeProjectIndex + i) % configs.length;
    if (!exhaustedIndices.has(idx)) {
      activeProjectIndex = idx;
      return {
        client: getClientForConfig(configs[idx]),
        config: configs[idx],
      };
    }
  }

  console.warn('[Supabase Fallback] All configured Supabase projects have exceeded quotas! Falling back to primary project.');
  return {
    client: getClientForConfig(configs[0]),
    config: configs[0],
  };
}

export function markProjectExhausted(index, reason) {
  exhaustedIndices.add(index);
  const configs = getSupabaseConfigs();
  const failedUrl = configs[index]?.url || `index ${index}`;
  console.warn(`[Supabase Failover] Project [${failedUrl}] marked as exhausted (${reason || 'quota limit'}).`);

  for (let i = 0; i < configs.length; i++) {
    if (!exhaustedIndices.has(i)) {
      activeProjectIndex = i;
      console.log(`[Supabase Failover] Switched active project to: [${configs[i].url}]`);
      return;
    }
  }
}

export async function findVideoAcrossProjects(videoId) {
  const configs = getSupabaseConfigs();
  for (const config of configs) {
    try {
      const client = getClientForConfig(config);
      const { data, error } = await client
        .from('shorts_queue')
        .select('*')
        .eq('id', videoId)
        .single();

      if (!error && data) {
        return { video: data, client, config };
      }
    } catch (e) {
      // Continue searching
    }
  }
  return null;
}

export async function uploadToStorageWithFailover(bucket, path, body, options = {}) {
  const configs = getSupabaseConfigs();
  let lastError = null;

  for (let attempt = 0; attempt < configs.length; attempt++) {
    const { client, config } = getActiveSupabase();
    try {
      const { error } = await client.storage
        .from(bucket)
        .upload(path, body, {
          contentType: options.contentType || 'application/octet-stream',
          upsert: options.upsert ?? true,
        });

      if (error) {
        if (isQuotaOrRestrictedError(error)) {
          markProjectExhausted(config.index, error.message);
          lastError = error;
          continue;
        }
        throw error;
      }

      const { data: publicUrlData } = client.storage.from(bucket).getPublicUrl(path);
      return {
        publicUrl: publicUrlData.publicUrl,
        client,
        config,
      };
    } catch (err) {
      if (isQuotaOrRestrictedError(err)) {
        markProjectExhausted(config.index, err.message);
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('Failed to upload file: all Supabase projects exhausted.');
}
