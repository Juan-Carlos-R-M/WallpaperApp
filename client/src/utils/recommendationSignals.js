import { isMatureWallpaper } from './contentPreferences';
import { getAuthorInfo, getPreviewUrl, getWallpaperId } from './wallpaperMeta';
import { safeSetItem, safeGetItem } from './storageHelper';

export const FAVORITES_STORAGE_KEY = 'wallpaperApp.workshopFavorites';
export const SUBSCRIPTIONS_STORAGE_KEY = 'wallpaperApp.subscriptions';
export const WALLPAPER_INTERACTIONS_STORAGE_KEY = 'wallpaperApp.wallpaperInteractions';
export const RECOMMENDATION_SIGNAL_EVENT = 'wallpaperApp.recommendationSignalsChanged';

const readJson = (key, fallback) => {
  const value = safeGetItem(key, fallback);
  return value !== null ? value : fallback;
};

const writeJson = (key, value) => {
  const success = safeSetItem(key, value);
  if (success) {
    window.dispatchEvent(new CustomEvent(RECOMMENDATION_SIGNAL_EVENT, {
      detail: { key, value }
    }));
  }
  return success;
};

export const loadFavoriteWallpapers = () => readJson(FAVORITES_STORAGE_KEY, []);

export const loadAuthorSubscriptions = () => readJson(SUBSCRIPTIONS_STORAGE_KEY, {});

export const saveAuthorSubscriptions = (subscriptions) => {
  return writeJson(SUBSCRIPTIONS_STORAGE_KEY, subscriptions || {});
};

export const loadWallpaperInteractions = () => readJson(WALLPAPER_INTERACTIONS_STORAGE_KEY, {});

export const getWallpaperAuthorId = (wallpaper = {}) => (
  wallpaper.authorId || wallpaper.creator || wallpaper.author || ''
);

export const getContentBucket = (wallpaper = {}) => (
  isMatureWallpaper(wallpaper) ? 'mature' : 'standard'
);

export const isAuthorSubscribed = (subscription) => (
  subscription === true || Boolean(subscription?.following)
);

export const getSubscribedAuthorIds = (subscriptions = {}) => (
  new Set(Object.entries(subscriptions)
    .filter(([, subscription]) => isAuthorSubscribed(subscription))
    .map(([authorId]) => authorId))
);

const sanitizeWallpaperForStorage = (wp) => {
  if (!wp || typeof wp !== 'object') return wp;
  const copy = { ...wp };
  const keysToClean = ['previewUrl', 'mediaUrl', 'playbackUrl', 'localPath', 'url', 'path', 'thumbnailUrl', 'imageUrl'];
  for (const key of keysToClean) {
    if (typeof copy[key] === 'string' && copy[key].startsWith('data:')) {
      copy[key] = '';
    }
  }
  return copy;
};

export const buildAuthorSubscriptionRecord = (wallpaper = {}, source = 'manual') => {
  const authorId = getWallpaperAuthorId(wallpaper);
  const authorInfo = getAuthorInfo(wallpaper);
  const preview = getPreviewUrl(wallpaper);
  const safePreview = typeof preview === 'string' && preview.startsWith('data:') ? '' : preview;
  const avatar = authorInfo?.avatar || '';
  const safeAvatar = typeof avatar === 'string' && avatar.startsWith('data:') ? '' : avatar;

  return {
    following: true,
    followedAt: Date.now(),
    source,
    name: authorInfo?.name || wallpaper.author || authorId,
    handle: authorInfo?.handle || (authorId ? `@${String(authorId).slice(0, 12)}` : ''),
    avatar: safeAvatar,
    preview: safePreview,
    contentTypes: [getContentBucket(wallpaper)]
  };
};

export const updateAuthorSubscription = (subscriptions = {}, authorId, following, metadata = {}) => {
  if (!authorId) return subscriptions;

  const previous = subscriptions[authorId];
  const previousRecord = previous && typeof previous === 'object' ? previous : {};
  const previousTypes = Array.isArray(previousRecord.contentTypes) ? previousRecord.contentTypes : [];
  const nextTypes = Array.isArray(metadata.contentTypes) ? metadata.contentTypes : [];

  return {
    ...subscriptions,
    [authorId]: {
      ...previousRecord,
      ...metadata,
      following: Boolean(following),
      followedAt: following ? previousRecord.followedAt || Date.now() : previousRecord.followedAt,
      unfollowedAt: following ? undefined : Date.now(),
      contentTypes: Array.from(new Set([...previousTypes, ...nextTypes].filter(Boolean)))
    }
  };
};

export const saveAuthorProfileInfo = (authorId, profileData = {}) => {
  if (!authorId) return loadAuthorSubscriptions();

  const subscriptions = loadAuthorSubscriptions();
  const previous = subscriptions[authorId] || {};
  
  const avatar = profileData.avatar || profileData.avatarUrl || previous.avatar || '';
  const avatarUrl = profileData.avatarUrl || profileData.avatar || previous.avatarUrl || '';
  const safeAvatar = typeof avatar === 'string' && avatar.startsWith('data:') ? '' : avatar;
  const safeAvatarUrl = typeof avatarUrl === 'string' && avatarUrl.startsWith('data:') ? '' : avatarUrl;

  // Guardar información del perfil del autor
  subscriptions[authorId] = {
    ...previous,
    following: Boolean(previous.following),
    followedAt: previous.followedAt || Date.now(),
    source: previous.source || 'steam',
    // Información enriquecida del perfil
    name: profileData.name || previous.name || String(authorId).slice(-6),
    handle: profileData.handle || previous.handle || `@${String(authorId).slice(0, 12)}`,
    avatar: safeAvatar,
    avatarUrl: safeAvatarUrl,
    description: profileData.description || previous.description || '',
    bio: profileData.bio || previous.bio || '',
    followers: Number(profileData.followers) || Number(previous.followers) || 0,
    url: profileData.url || previous.url || (authorId ? `https://steamcommunity.com/profiles/${encodeURIComponent(authorId)}` : '')
  };

  saveAuthorSubscriptions(subscriptions);
  return subscriptions;
};

export const followAuthorFromWallpaper = (wallpaper = {}, source = 'download') => {
  const authorId = getWallpaperAuthorId(wallpaper);
  if (!authorId) return loadAuthorSubscriptions();

  const next = updateAuthorSubscription(
    loadAuthorSubscriptions(),
    authorId,
    true,
    buildAuthorSubscriptionRecord(wallpaper, source)
  );
  saveAuthorSubscriptions(next);
  return next;
};

export const recordWallpaperInteraction = (wallpaper = {}, type = 'view') => {
  const wallpaperId = getWallpaperId(wallpaper) || wallpaper.id || wallpaper._id;
  if (!wallpaperId) return loadWallpaperInteractions();

  const current = loadWallpaperInteractions();
  const previous = current[wallpaperId] || {};
  const nextTypes = Array.from(new Set([...(previous.types || []), type]));
  const next = {
    ...current,
    [wallpaperId]: {
      ...previous,
      id: wallpaperId,
      types: nextTypes,
      lastType: type,
      lastAt: Date.now(),
      wallpaper: sanitizeWallpaperForStorage({
        ...previous.wallpaper,
        ...wallpaper
      })
    }
  };

  // Evitar que una cuota de localStorage rompa el flujo del UI
  try {
    writeJson(WALLPAPER_INTERACTIONS_STORAGE_KEY, next);
  } catch (err) {
    // writeJson/safeSetItem ya intenta cleanup; aquí solo evitamos crash
    console.warn('[recommendationSignals] No se pudieron guardar interacciones (quota o error):', err);
  }
  return next;
};


const collectTags = (wallpapers = [], weight = 1) => {
  const tags = new Map();

  wallpapers.forEach(wallpaper => {
    (Array.isArray(wallpaper.tags) ? wallpaper.tags : [])
      .map(tag => String(tag || '').trim().toLowerCase())
      .filter(Boolean)
      .forEach(tag => tags.set(tag, (tags.get(tag) || 0) + weight));
  });

  return tags;
};

export const buildPreferenceProfile = ({
  favorites = loadFavoriteWallpapers(),
  subscriptions = loadAuthorSubscriptions(),
  interactions = loadWallpaperInteractions()
} = {}) => {
  const interactionWallpapers = Object.values(interactions)
    .map(interaction => interaction.wallpaper)
    .filter(Boolean);
  const likedTags = collectTags(favorites, 3);
  const interactedTags = collectTags(interactionWallpapers, 2);
  const subscribedAuthors = getSubscribedAuthorIds(subscriptions);
  const likedAuthors = new Set(favorites.map(getWallpaperAuthorId).filter(Boolean));
  const interactedAuthors = new Set(interactionWallpapers.map(getWallpaperAuthorId).filter(Boolean));
  const matureLikes = favorites.filter(wallpaper => getContentBucket(wallpaper) === 'mature').length;
  const standardLikes = Math.max(1, favorites.length - matureLikes);

  return {
    favorites,
    subscriptions,
    interactions,
    subscribedAuthors,
    likedAuthors,
    interactedAuthors,
    likedTags,
    interactedTags,
    prefersMature: matureLikes > standardLikes
  };
};

export const scoreWallpaperForProfile = (wallpaper = {}, profile = buildPreferenceProfile()) => {
  const authorId = getWallpaperAuthorId(wallpaper);
  let score = 0;

  if (profile.subscribedAuthors.has(authorId)) score += 90;
  if (profile.likedAuthors.has(authorId)) score += 45;
  if (profile.interactedAuthors.has(authorId)) score += 32;
  if (profile.prefersMature && getContentBucket(wallpaper) === 'mature') score += 16;

  (Array.isArray(wallpaper.tags) ? wallpaper.tags : []).forEach(tag => {
    const normalizedTag = String(tag || '').trim().toLowerCase();
    score += profile.likedTags.get(normalizedTag) || 0;
    score += profile.interactedTags.get(normalizedTag) || 0;
  });

  score += Number(wallpaper.likes || wallpaper.favorited || 0) / 2500;
  score += Number(wallpaper.downloads || wallpaper.subscriptions || 0) / 8000;

  return score;
};
