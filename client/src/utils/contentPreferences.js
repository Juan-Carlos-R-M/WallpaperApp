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

export const canShowWallpaper = (wallpaper = {}, showMatureContent = false) => (
  showMatureContent || !isMatureWallpaper(wallpaper)
);
