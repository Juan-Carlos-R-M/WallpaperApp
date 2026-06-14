export const MATURE_CONTENT_STORAGE_KEY = 'wallpaperApp.showMatureContent';
export const CONTENT_PREFERENCES_EVENT = 'wallpaperApp.contentPreferencesChanged';

export const loadShowMatureContent = () => (
  localStorage.getItem(MATURE_CONTENT_STORAGE_KEY) === 'true'
);

export const saveShowMatureContent = (enabled) => {
  localStorage.setItem(MATURE_CONTENT_STORAGE_KEY, String(Boolean(enabled)));
  window.dispatchEvent(new CustomEvent(CONTENT_PREFERENCES_EVENT, {
    detail: { showMatureContent: Boolean(enabled) }
  }));
};

export const getWallpaperAgeRating = (wallpaper = {}) => {
  const directValue = wallpaper.ageRating
    || wallpaper.contentRating
    || wallpaper.ratingLabel
    || wallpaper.maturityRating
    || wallpaper.age_rating
    || '';

  if (directValue) return String(directValue).trim();

  const tags = Array.isArray(wallpaper.tags) ? wallpaper.tags : [];
  const ageTag = tags.find(tag => (
    ['everyone', 'questionable', 'mature'].includes(String(tag || '').trim().toLowerCase())
  ));

  return ageTag ? String(ageTag).trim() : '';
};

export const isMatureWallpaper = (wallpaper = {}) => (
  getWallpaperAgeRating(wallpaper).toLowerCase() === 'mature'
);

export const isValidWallpaper = (wallpaper = {}) => {
  // Un wallpaper es válido si tiene al menos título y un ID.
  // Aceptamos varios formatos (Workshop/Web/Electron payloads distintos).
  const hasId = Boolean(
    wallpaper.publishedFileId
    || wallpaper.publishedfileid
    || wallpaper.id
    || wallpaper.fileId
    || wallpaper.fileid
    || wallpaper.wallpaperId
    || wallpaper.steamId
    || wallpaper.localPath
    || wallpaper.mediaUrl
    || wallpaper.url
    || wallpaper.downloadUrl
  );

  const titleCandidate = wallpaper.title
    || wallpaper.name
    || wallpaper.displayName
    || wallpaper.wallpaperName
    || wallpaper.filename
    || '';

  const hasTitle = Boolean(String(titleCandidate).trim());

  const isValid = hasId && hasTitle;

  // Solo loguear si el wallpaper es realmente inválido (falta ID o título)
  if (!isValid && Object.keys(wallpaper).length > 0) {
    console.warn('[ContentPreferences] Wallpaper inválido (falta ID o título):', {
      title: wallpaper.title,
      titleCandidate,
      hasId,
      hasTitle
    });
  }

  return isValid;
};

export const canShowWallpaper = (wallpaper = {}, showMatureContent = false) => {
  // Primero, validar que sea un wallpaper válido
  if (!isValidWallpaper(wallpaper)) {
    return false;
  }

  // Luego, validar contenido maduro
  return showMatureContent || !isMatureWallpaper(wallpaper);
};
