import { canShowWallpaper, isMatureWallpaper } from './contentPreferences';
import {
  enrichWallpaperMetadata,
  getWallpaperId,
  normalizeTags,
  sortSimilarWallpapers
} from './wallpaperMeta';

const GENERIC_TAGS = new Set([
  'steam',
  'workshop',
  'wallpaper',
  'wallpaper-engine',
  'local',
  'image',
  'imagen',
  'video',
  'scene',
  'web',
  'application',
  'gif',
  '4k',
  '2k',
  '1080p'
]);

const cleanTag = (tag = '') => String(tag || '').trim();

const getSpecificTags = (wallpaper = {}) => (
  normalizeTags(wallpaper, 24)
    .map(cleanTag)
    .filter(tag => tag && !GENERIC_TAGS.has(tag.toLowerCase()))
);

const buildQuery = (wallpaper = {}) => {
  const titleWords = String(wallpaper.title || '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !/^\d+$/.test(word))
    .slice(0, 3);

  if (titleWords.length > 0) return titleWords.join(' ');
  return String(wallpaper.category || '').trim();
};

const REC_CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutos
const recCache = new Map(); // key -> { t: number, v: any[] }
const recInflight = new Map(); // key -> Promise<any[]>

export const fetchOnlineRecommendations = async ({
  wallpaper,
  limit = 12,
  showMatureContent = false
} = {}) => {
  if (
    typeof window === 'undefined'
    || !window.electronAPI
    || typeof window.electronAPI.searchWorkshopWallpapers !== 'function'
    || !wallpaper
  ) {
    return [];
  }

  const current = enrichWallpaperMetadata(wallpaper);
  const currentId = getWallpaperId(current);

  const cacheKey = `${currentId || 'unknown'}|limit:${limit}|mature:${showMatureContent}`;
  const now = Date.now();

  const cached = recCache.get(cacheKey);
  if (cached && now - cached.t < REC_CACHE_TTL_MS && Array.isArray(cached.v)) {
    return cached.v;
  }

  const inflight = recInflight.get(cacheKey);
  if (inflight) return inflight;

  const computePromise = (async () => {
    const tags = getSpecificTags(current);
    const query = buildQuery(current);
    const attempts = [
      { query: '', requiredTags: tags.slice(0, 4), matchAllTags: false },
      { query, requiredTags: tags.slice(0, 2), matchAllTags: false },
      { query: tags[0] || query, requiredTags: [], matchAllTags: true }
    ].filter(attempt => attempt.query || attempt.requiredTags.length > 0);

    if (isMatureWallpaper(current) && showMatureContent) {
      attempts.unshift({ query: '', requiredTags: ['Mature', ...tags.slice(0, 3)], matchAllTags: false });
    }

    const seen = new Set([getWallpaperId(current)]);
    const candidates = [];

    for (const attempt of attempts) {
      try {
        const result = await window.electronAPI.searchWorkshopWallpapers({
          page: 1,
          limit: Math.max(24, limit * 2),
          sort: 'trend',
          time: 'all',
          ...attempt
        });

        if (!result?.success) continue;

        const items = Array.isArray(result.data?.data) ? result.data.data : [];
        items
          .map(item => enrichWallpaperMetadata({
            ...item,
            fromSteam: true,
            category: item.category || 'workshop'
          }))
          .filter(item => canShowWallpaper(item, showMatureContent))
          .forEach(item => {
            const id = getWallpaperId(item);
            if (!id || seen.has(id)) return;
            seen.add(id);
            candidates.push(item);
          });

        if (candidates.length >= limit) break;
      } catch {
        // Recommendation attempts are best-effort; the caller can render no strip.
      }
    }

    const sorted = sortSimilarWallpapers(current, candidates);
    return (sorted.length > 0 ? sorted : candidates).slice(0, limit);
  })();

  recInflight.set(cacheKey, computePromise);

  try {
    const value = await computePromise;
    recCache.set(cacheKey, { t: Date.now(), v: value });
    return value;
  } finally {
    recInflight.delete(cacheKey);
  }
};
