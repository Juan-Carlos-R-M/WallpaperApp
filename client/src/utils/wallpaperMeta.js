import { toPlayableUrl } from './mediaUrl';
import wallpaperDetails from '../data/wallpaperDetails.json';

export const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|avi|mkv)(\?|#|$)/i;

export const getWallpaperId = (wallpaper = {}) => String(
  wallpaper.publishedFileId
  || wallpaper._id
  || wallpaper.id
  || wallpaper.localPath
  || wallpaper.mediaUrl
  || ''
);

export const getAuthorName = (wallpaper = {}) => (
  wallpaper.author
  || wallpaper.publisher
  || wallpaper.creatorName
  || wallpaper.authorName
  || wallpaper.creator
  || wallpaper.authorId
  || 'Autor'
);

const normalizeKey = (value = '') => String(value || '').trim().toLowerCase();

export const getAuthorKey = (wallpaper = {}) => String(
  wallpaper.authorId
  || wallpaper.creator
  || wallpaper.creatorId
  || wallpaper.author
  || wallpaper.publisher
  || wallpaper.authorInfo?.id
  || wallpaper.authorInfo?.name
  || ''
).trim().toLowerCase();

export const isDownloadedWallpaper = (wallpaper = {}) => Boolean(
  wallpaper.localPath
  || wallpaper.installed
  || wallpaper.downloaded
);

export const isVideoWallpaper = (wallpaper = {}) => {
  const mediaUrl = [
    wallpaper.playbackUrl,
    wallpaper.mediaUrl,
    wallpaper.localPath
  ].filter(Boolean).join(' ');

  return String(wallpaper.mediaType || '').toLowerCase() === 'video'
    || VIDEO_EXTENSIONS.test(mediaUrl);
};

export const isSceneWallpaper = (wallpaper = {}) => (
  ['scene', 'web', 'application'].includes(String(wallpaper.mediaType || '').toLowerCase())
);

export const getPreviewUrl = (wallpaper = {}) => toPlayableUrl(
  wallpaper.previewUrl
  || wallpaper.preview?.url
  || wallpaper.image?.url
  || wallpaper.thumbnailUrl
  || wallpaper.imageUrl
  || wallpaper.playbackUrl
  || wallpaper.mediaUrl
  || wallpaper.localPath
  || ''
);

export const getVideoPlaybackUrl = (wallpaper = {}) => {
  if (!isVideoWallpaper(wallpaper)) return '';

  const source = wallpaper.playbackUrl || wallpaper.mediaUrl || wallpaper.localPath || '';
  if (!source || source === wallpaper.previewUrl) return '';

  return toPlayableUrl(source);
};

export const getWallpaperMetadata = (wallpaper = {}) => {
  const ids = [
    wallpaper.publishedFileId,
    wallpaper._id,
    wallpaper.id
  ].map(String).filter(Boolean);

  const exactId = ids.find(id => wallpaperDetails.wallpapers[id]);
  if (exactId) return wallpaperDetails.wallpapers[exactId];

  const title = normalizeKey(wallpaper.title);
  const author = normalizeKey(getAuthorName(wallpaper));

  return Object.values(wallpaperDetails.wallpapers).find(item => (
    normalizeKey(item.title) === title
    && (!author || normalizeKey(item.author) === author)
  )) || null;
};

export const getAuthorInfo = (authorIdOrWallpaper = '') => {
  if (typeof authorIdOrWallpaper === 'object' && authorIdOrWallpaper !== null) {
    const metadata = getWallpaperMetadata(authorIdOrWallpaper);
    const authorId = authorIdOrWallpaper.authorId || metadata?.authorId;
    const author = authorId ? wallpaperDetails.authors[authorId] : null;
    if (author) return author;

    const authorName = normalizeKey(getAuthorName(authorIdOrWallpaper));
    return Object.values(wallpaperDetails.authors).find(item => normalizeKey(item.name) === authorName) || null;
  }

  const key = String(authorIdOrWallpaper || '');
  return wallpaperDetails.authors[key]
    || Object.values(wallpaperDetails.authors).find(item => normalizeKey(item.name) === normalizeKey(key))
    || null;
};

export const enrichWallpaperMetadata = (wallpaper = {}) => {
  const metadata = getWallpaperMetadata(wallpaper) || {};
  const authorInfo = getAuthorInfo({ ...metadata, ...wallpaper }) || wallpaper.authorInfo || null;
  const tags = Array.isArray(wallpaper.tags) && wallpaper.tags.length ? wallpaper.tags : metadata.tags || [];
  const inferredMediaType = isVideoWallpaper(wallpaper)
    ? 'video'
    : (wallpaper.mediaType || metadata.mediaType || 'image');

  return {
    ...metadata,
    ...wallpaper,
    authorId: wallpaper.authorId || wallpaper.creator || wallpaper.creatorId || metadata.authorId || authorInfo?.id,
    author: wallpaper.author || metadata.author || authorInfo?.name || getAuthorName(wallpaper),
    description: wallpaper.description || metadata.description || '',
    category: wallpaper.category || metadata.category || '',
    mediaType: inferredMediaType,
    tags,
    resolution: wallpaper.resolution || metadata.resolution,
    fileSize: wallpaper.fileSize || metadata.fileSize,
    views: wallpaper.views || metadata.views || 0,
    downloads: wallpaper.downloads ?? wallpaper.subscriptions ?? metadata.downloads ?? 0,
    subscriptions: wallpaper.subscriptions ?? wallpaper.downloads ?? metadata.downloads ?? 0,
    likes: wallpaper.likes ?? wallpaper.favorited ?? metadata.likes ?? 0,
    favorited: wallpaper.favorited ?? wallpaper.likes ?? metadata.likes ?? 0,
    score: wallpaper.score ?? wallpaper.rating?.average ?? metadata.score ?? 0,
    timeCreated: wallpaper.timeCreated || wallpaper.uploadDate || metadata.timeCreated,
    timeUpdated: wallpaper.timeUpdated || wallpaper.updatedDate || metadata.timeUpdated,
    authorInfo: authorInfo
      ? { ...authorInfo, ...wallpaper.authorInfo }
      : wallpaper.authorInfo
  };
};

export const normalizeTags = (wallpaper = {}, limit = 6) => {
  if (Array.isArray(wallpaper.tags) && wallpaper.tags.length) {
    return wallpaper.tags.filter(Boolean).slice(0, limit);
  }

  if (wallpaper.mediaType) {
    return [wallpaper.mediaType, isDownloadedWallpaper(wallpaper) ? 'Local' : 'Wallpaper'];
  }

  return ['Wallpaper'];
};

export const formatCompact = (value = 0) => {
  const number = Number(value || 0);
  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(1)}K`;
  return number.toLocaleString();
};

export const formatFileSize = (value) => {
  const bytes = Number(value || 0);
  if (!bytes) return 'Desconocido';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export const formatDate = (value) => {
  if (!value) return 'Desconocido';

  const date = typeof value === 'number'
    ? new Date(value < 10000000000 ? value * 1000 : value)
    : new Date(value);

  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
};

export const formatPlaybackTime = (seconds = 0) => {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const rest = Math.floor(safeSeconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
};

export const sameAuthor = (left = {}, right = {}) => {
  const leftKey = getAuthorKey(left);
  const rightKey = getAuthorKey(right);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
};

export const uniqueWallpapers = (items = []) => {
  const seen = new Set();

  return items.filter(item => {
    const id = getWallpaperId(item);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

export const sortSimilarWallpapers = (currentWallpaper = {}, items = []) => {
  const currentId = getWallpaperId(currentWallpaper);
  const currentTags = new Set(normalizeTags(currentWallpaper, 20).map(tag => String(tag).toLowerCase()));
  const currentType = String(currentWallpaper.mediaType || '').toLowerCase();
  const currentCategory = normalizeKey(currentWallpaper.category);
  const currentTitleWords = new Set(
    String(currentWallpaper.title || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter(word => word.length > 3)
  );

  return uniqueWallpapers(items)
    .filter(item => getWallpaperId(item) !== currentId)
    .map(item => {
      const itemTags = normalizeTags(item, 20).map(tag => String(tag).toLowerCase());
      const sharedTags = itemTags.filter(tag => currentTags.has(tag)).length;
      const sameType = currentType && currentType === String(item.mediaType || '').toLowerCase();
      const sameCategory = currentCategory && currentCategory === normalizeKey(item.category);
      const authorMatch = sameAuthor(currentWallpaper, item);
      const titleWords = String(item.title || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .filter(word => word.length > 3);
      const sharedTitleWords = titleWords.filter(word => currentTitleWords.has(word)).length;
      const hasRealRelation = sharedTags > 0 || sameCategory || authorMatch || sharedTitleWords > 0;

      return {
        item,
        hasRealRelation,
        score: sharedTags * 8
          + (sameCategory ? 5 : 0)
          + sharedTitleWords * 3
          + (authorMatch ? 2 : 0)
          + (sameType ? 1 : 0)
      };
    })
    .filter(entry => entry.hasRealRelation)
    .sort((left, right) => right.score - left.score)
    .map(entry => entry.item);
};

export const getAuthorWallpapers = (currentWallpaper = {}, items = []) => {
  const currentId = getWallpaperId(currentWallpaper);

  return uniqueWallpapers(items)
    .filter(item => getWallpaperId(item) !== currentId && sameAuthor(currentWallpaper, item));
};
