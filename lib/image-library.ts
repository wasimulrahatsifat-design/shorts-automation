// Image Library Utility: Persistent Cache & Automatic Keyword Matcher

const STORAGE_KEY = 'shorts_automation_image_library_v1';

export interface ImageRecord {
  keyword: string;
  url: string;
  updatedAt: number;
}

// Normalizes keywords for matching: trims, lowercases, removes punctuation
export function normalizeKeyword(kw: string): string {
  if (!kw) return '';
  return kw.trim().toLowerCase().replace(/[^a-z0-9\u0980-\u09FF]/g, '');
}

// Check if two keywords match or are aliases (e.g. 'giraffe' and 'giraffa', 'bat' and 'chiroptera')
export function isKeywordMatch(kw1: string, kw2: string): boolean {
  const k1 = normalizeKeyword(kw1);
  const k2 = normalizeKeyword(kw2);
  if (!k1 || !k2) return false;
  if (k1 === k2) return true;

  // Common aliases / scientific names / translations
  const aliasGroups = [
    ['giraffe', 'giraffa', 'জিরাফ'],
    ['bat', 'chiroptera', 'বাদুর', 'বাদুড়'],
    ['lion', 'pantheraleo', 'সিংহ'],
    ['elephant', 'africanbushelephant', 'হাতি'],
    ['cheetah', 'acinonyxjubatus', 'চিতাবাঘ'],
    ['panda', 'giantpanda', 'ailuropodamelanoleuca', 'পান্ডা'],
    ['bluewhale', 'balaenopteramusculus', 'তিমি', 'নীলতিমি'],
    ['octopus', 'অক্টোপাস'],
    ['ironman', 'আয়রনম্যান'],
    ['batman', 'ব্যাটম্যান'],
    ['superman', 'সুপারম্যান'],
    ['spiderman', 'স্পাইডারম্যান'],
  ];

  for (const group of aliasGroups) {
    const hasK1 = group.some((g) => normalizeKeyword(g) === k1 || k1.includes(normalizeKeyword(g)) || normalizeKeyword(g).includes(k1));
    const hasK2 = group.some((g) => normalizeKeyword(g) === k2 || k2.includes(normalizeKeyword(g)) || normalizeKeyword(g).includes(k2));
    if (hasK1 && hasK2) return true;
  }

  // Substring match if length >= 4
  if (k1.length >= 4 && k2.length >= 4 && (k1.includes(k2) || k2.includes(k1))) {
    return true;
  }

  return false;
}

// Get all stored images from localStorage
export function getStoredImageLibrary(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

// Look up an image by keyword (exact or alias)
export function findImageInLibrary(keyword: string, library?: Record<string, string>): string | null {
  const lib = library || getStoredImageLibrary();
  const targetNorm = normalizeKeyword(keyword);
  if (!targetNorm) return null;

  // 1. Exact normalized match
  for (const [key, url] of Object.entries(lib)) {
    if (normalizeKeyword(key) === targetNorm && url) {
      return url;
    }
  }

  // 2. Alias / fuzzy match
  for (const [key, url] of Object.entries(lib)) {
    if (isKeywordMatch(key, keyword) && url) {
      return url;
    }
  }

  return null;
}

// Save an image to the library
export function saveImageToLibrary(keyword: string, url: string): void {
  if (typeof window === 'undefined' || !keyword || !url) return;
  try {
    const lib = getStoredImageLibrary();
    lib[keyword.trim()] = url;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lib));
  } catch (e) {
    console.warn('Failed to save to localStorage image library:', e);
  }
}

// Sync past uploaded images from Supabase shorts_queue into the local library
export async function syncImagesFromSupabase(supabaseClient: any): Promise<Record<string, string>> {
  const currentLib = getStoredImageLibrary();
  if (!supabaseClient) return currentLib;

  try {
    const { data: rows, error } = await supabaseClient
      .from('shorts_queue')
      .select('topic, data_json')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error || !rows) return currentLib;

    let updated = false;

    for (const row of rows) {
      const dj = row.data_json;
      if (!dj) continue;

      const checkItem = (kw?: string, url?: string | null) => {
        if (kw && url && typeof url === 'string' && url.length > 20) {
          const trimmedKw = kw.trim();
          if (!currentLib[trimmedKw]) {
            currentLib[trimmedKw] = url;
            updated = true;
          }
        }
      };

      if (Array.isArray(dj.questions)) {
        dj.questions.forEach((q: any) => checkItem(q.image_keyword, q.image_url));
      }
      if (Array.isArray(dj.items)) {
        dj.items.forEach((it: any) => checkItem(it.image_keyword, it.image_url));
      }
      if (Array.isArray(dj.contestants)) {
        dj.contestants.forEach((c: any) => checkItem(c.image_keyword || c.name, c.image_url));
      }
      if (Array.isArray(dj.scenarios)) {
        dj.scenarios.forEach((s: any) => {
          checkItem(s.image_keyword_a, s.image_url_a);
          checkItem(s.image_keyword_b, s.image_url_b);
        });
      }
    }

    if (updated && typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentLib));
      } catch (e) {}
    }
  } catch (err) {
    console.warn('Error syncing images from Supabase:', err);
  }

  return currentLib;
}
