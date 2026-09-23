import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  index: number;
}

// Track indices of projects that are known to be exhausted (e.g. exceed_egress_quota)
const exhaustedIndices = new Set<number>();
let activeProjectIndex = 0;

/**
 * Returns all configured Supabase (URL, Key) pairs from environment variables.
 * Supports:
 * - NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_URL_1 / SUPABASE_ANON_KEY_1)
 * - SUPABASE_URL_2 / SUPABASE_ANON_KEY_2
 * - SUPABASE_URL_3 / SUPABASE_ANON_KEY_3
 * ... up to SUPABASE_URL_10 / SUPABASE_ANON_KEY_10
 */
export function getSupabaseConfigs(): SupabaseConfig[] {
  const configs: SupabaseConfig[] = [];
  const seenUrls = new Set<string>();

  const addConfig = (url?: string, key?: string) => {
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

  // 1. Primary from NEXT_PUBLIC_ or SUPABASE_URL_1
  addConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL_1,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY_1
  );

  // 2. Extra configured projects: SUPABASE_URL_2 through SUPABASE_URL_10
  for (let i = 2; i <= 10; i++) {
    addConfig(
      process.env[`SUPABASE_URL_${i}`],
      process.env[`SUPABASE_ANON_KEY_${i}`]
    );
  }

  // Also check if SUPABASE_URL_1 was set differently
  addConfig(process.env.SUPABASE_URL_1, process.env.SUPABASE_ANON_KEY_1);

  return configs;
}

// Cache clients by URL
const clientCache = new Map<string, SupabaseClient>();

export function getClientForConfig(config: SupabaseConfig): SupabaseClient {
  if (!clientCache.has(config.url)) {
    clientCache.set(config.url, createClient(config.url, config.anonKey));
  }
  return clientCache.get(config.url)!;
}

/**
 * Checks if an error represents a quota limit, egress violation, or 402 Payment Required
 */
export function isQuotaOrRestrictedError(error: any): boolean {
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

/**
 * Returns the current active healthy Supabase client and config.
 */
export function getActiveSupabase(): { client: SupabaseClient; config: SupabaseConfig } {
  const configs = getSupabaseConfigs();
  if (configs.length === 0) {
    throw new Error('No Supabase credentials configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  // Find the first non-exhausted configuration
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

  // If all are exhausted, fallback to first one anyway and log a warning
  console.warn('[Supabase Fallback] All configured Supabase projects have exceeded quotas! Trying primary project again.');
  return {
    client: getClientForConfig(configs[0]),
    config: configs[0],
  };
}

/**
 * Marks a Supabase project index as exhausted and rotates to the next available one.
 */
export function markProjectExhausted(index: number, reason?: string) {
  exhaustedIndices.add(index);
  const configs = getSupabaseConfigs();
  const failedUrl = configs[index]?.url || `index ${index}`;
  console.warn(`[Supabase Failover] Project [${failedUrl}] marked as exhausted (${reason || 'quota limit'}).`);

  for (let i = 0; i < configs.length; i++) {
    if (!exhaustedIndices.has(i)) {
      activeProjectIndex = i;
      console.log(`[Supabase Failover] Successfully switched active project to: [${configs[i].url}]`);
      return;
    }
  }
}

/**
 * Executes a Supabase operation with automatic failover to backup projects if a quota/egress error occurs.
 */
export async function executeWithSupabaseFailover<T = any>(
  operation: (client: SupabaseClient, config: SupabaseConfig) => PromiseLike<any> | Promise<any>
): Promise<{ data: T; error: any }> {
  const configs = getSupabaseConfigs();
  if (configs.length === 0) {
    throw new Error('No Supabase credentials configured.');
  }

  let lastError: any = null;

  for (let attempt = 0; attempt < configs.length; attempt++) {
    const { client, config } = getActiveSupabase();
    try {
      const result = await operation(client, config);
      if (result.error && isQuotaOrRestrictedError(result.error)) {
        console.warn(`[Supabase Failover] Operation on [${config.url}] failed with quota error:`, result.error.message || result.error);
        markProjectExhausted(config.index, result.error.message || 'quota exceeded');
        lastError = result.error;
        continue; // Try next project
      }
      return result;
    } catch (err: any) {
      if (isQuotaOrRestrictedError(err)) {
        console.warn(`[Supabase Failover] Caught quota error on [${config.url}]:`, err.message || err);
        markProjectExhausted(config.index, err.message || 'quota exceeded');
        lastError = err;
        continue; // Try next project
      }
      throw err;
    }
  }

  return { data: null as any, error: lastError || new Error('All Supabase projects failed or exceeded quotas.') };
}

/**
 * Uploads a file (Buffer or Uint8Array) to Supabase Storage with automatic failover to backup projects.
 */
export async function uploadToStorageWithFailover(
  bucket: string,
  path: string,
  body: Buffer | Uint8Array | ArrayBuffer,
  options?: { contentType?: string; upsert?: boolean }
): Promise<{ publicUrl: string; client: SupabaseClient; config: SupabaseConfig }> {
  const configs = getSupabaseConfigs();
  let lastError: any = null;

  for (let attempt = 0; attempt < configs.length; attempt++) {
    const { client, config } = getActiveSupabase();
    try {
      const { error } = await client.storage
        .from(bucket)
        .upload(path, body, {
          contentType: options?.contentType || 'application/octet-stream',
          upsert: options?.upsert ?? true,
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
    } catch (err: any) {
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

/**
 * Looks up a video across all configured Supabase projects.
 * Useful when a video was created on project A, but project B is currently active.
 */
export async function findVideoAcrossProjects(videoId: string): Promise<{
  video: any;
  client: SupabaseClient;
  config: SupabaseConfig;
} | null> {
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
      // Continue checking next project
    }
  }
  return null;
}

/**
 * Queries videos across all healthy projects and merges them (sorted newest first).
 */
export async function queryAllProjectsVideos(
  queryBuilder: (client: SupabaseClient) => any
): Promise<any[]> {
  const configs = getSupabaseConfigs();
  const allResults: any[] = [];
  const seenIds = new Set<string>();

  for (const config of configs) {
    if (exhaustedIndices.has(config.index)) continue;
    try {
      const client = getClientForConfig(config);
      const query = queryBuilder(client);
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        for (const item of data) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            allResults.push(item);
          }
        }
      }
    } catch (e) {
      // Ignore and continue with other projects
    }
  }

  // Sort newest first by created_at if present
  allResults.sort((a, b) => {
    const tA = new Date(a.created_at || 0).getTime();
    const tB = new Date(b.created_at || 0).getTime();
    return tB - tA;
  });

  return allResults;
}

/**
 * Proxy object representing the active Supabase client.
 * Automatically delegates calls to whichever project is currently active and healthy.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const { client } = getActiveSupabase();
    const val = (client as any)[prop];
    if (typeof val === 'function') {
      return val.bind(client);
    }
    return val;
  },
});
