import { DOWNLOAD_CONFIRMATION_STORAGE_KEY } from './workshopConfig';

export const shouldShowDownloadConfirmation = () => (
  localStorage.getItem(DOWNLOAD_CONFIRMATION_STORAGE_KEY) !== 'false'
);

export const getWallpaperId = (wallpaper = {}) => String(wallpaper.publishedFileId || '');

export const getRequiredWorkshopTags = (filters = {}) => [
  filters.type,
  filters.genre,
  filters.assetType,
  filters.assetGenre,
  filters.scriptType,
  filters.ageRating
].filter(Boolean);

export const isDownloaderStatusReady = (status = {}) => Boolean(
  status?.hasDownloader
  || status?.downloader
  || status?.steamcmd
  || status?.depotDownloader
);

export const getDownloaderStatusPath = (status = {}) => (
  status?.downloader
  || status?.steamcmd
  || status?.depotDownloader
  || ''
);

export const getDownloaderStatusName = (status = {}) => (
  status?.downloaderName
  || (status?.steamcmd ? 'SteamCMD' : '')
  || (status?.depotDownloader ? 'DepotDownloader' : '')
  || (status?.downloader ? 'Descargador' : '')
);

export const mergeUniqueWorkshopWallpapers = (currentItems = [], nextItems = []) => {
  const seen = new Set();

  return [...currentItems, ...nextItems].filter(item => {
    const id = getWallpaperId(item);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

export const mergeDownloadedWallpaper = (workshopWallpaper = {}, downloadedWallpaper = null) => {
  if (!downloadedWallpaper) return workshopWallpaper;

  return {
    ...workshopWallpaper,
    ...downloadedWallpaper,
    publishedFileId: getWallpaperId(workshopWallpaper) || getWallpaperId(downloadedWallpaper),
    title: workshopWallpaper.title || downloadedWallpaper.title,
    authorId: workshopWallpaper.authorId || workshopWallpaper.creator || downloadedWallpaper.authorId || downloadedWallpaper.creator,
    author: workshopWallpaper.author || downloadedWallpaper.author,
    creator: workshopWallpaper.creator || workshopWallpaper.authorId || downloadedWallpaper.creator,
    description: workshopWallpaper.description || downloadedWallpaper.description,
    tags: workshopWallpaper.tags?.length ? workshopWallpaper.tags : downloadedWallpaper.tags,
    previewUrl: downloadedWallpaper.previewUrl || workshopWallpaper.previewUrl,
    fileSize: workshopWallpaper.fileSize || downloadedWallpaper.fileSize,
    subscriptions: workshopWallpaper.subscriptions,
    favorited: workshopWallpaper.favorited,
    score: workshopWallpaper.score,
    url: workshopWallpaper.url
  };
};

export const isVideoWallpaper = (wallpaper = {}) => {
  const mediaUrl = [
    wallpaper.playbackUrl,
    wallpaper.mediaUrl,
    wallpaper.localPath,
    wallpaper.downloadUrl,
    wallpaper.url,
    wallpaper.path,
    wallpaper.previewUrl
  ].filter(Boolean).join(' ');

  return String(wallpaper.mediaType || '').toLowerCase() === 'video'
    || /\.(mp4|webm|mov|m4v|avi|mkv)(\?|#|$)/i.test(mediaUrl);
};

export const isSceneWallpaper = (wallpaper = {}) => (
  ['scene', 'web', 'application'].includes(String(wallpaper.mediaType || '').toLowerCase())
);

const getFavoriteRecentTime = (wallpaper = {}, index = 0) => {
  const values = [
    wallpaper.favoriteAddedAt,
    wallpaper.likedAt,
    wallpaper.addedAt,
    wallpaper.timeUpdated ? Number(wallpaper.timeUpdated) * 1000 : 0,
    wallpaper.timeCreated ? Number(wallpaper.timeCreated) * 1000 : 0
  ];
  const parsed = values
    .map(value => (typeof value === 'number' ? value : Date.parse(value)))
    .find(value => Number.isFinite(value) && value > 0);

  return parsed || (Date.now() - index);
};

const getFavoritePopularityScore = (wallpaper = {}) => (
  Number(wallpaper.favorited || 0) + Number(wallpaper.score || 0) * 1000
);

export const sortFavoriteWallpapers = (items = [], sort = 'recent') => (
  [...items].sort((a, b) => {
    if (sort === 'downloads') {
      return Number(b.subscriptions || 0) - Number(a.subscriptions || 0);
    }

    if (sort === 'popular') {
      return getFavoritePopularityScore(b) - getFavoritePopularityScore(a);
    }

    return getFavoriteRecentTime(b) - getFavoriteRecentTime(a);
  })
);
