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
  // Un wallpaper es válido si tiene al menos título y un ID
  // Aceptamos varios formatos de ID para mayor compatibilidad
  const hasId = wallpaper.publishedFileId || wallpaper.id || wallpaper.fileId || wallpaper.localPath || wallpaper.mediaUrl;
  const hasTitle = wallpaper.title && String(wallpaper.title).trim();
  
  const isValid = Boolean(hasId && hasTitle);
  
  // Solo loguear si el wallpaper es realmente inválido (falta ID o título)
  if (!isValid && Object.keys(wallpaper).length > 0) {
    console.warn('[ContentPreferences] Wallpaper inválido (falta ID o título):', {
      title: wallpaper.title,
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
