/**
 * Centralización de storage keys para evitar duplicaciones
 * Única fuente de verdad para todas las claves de localStorage
 */

export const STORAGE_KEYS = {
  // Workshop y filtros
  WORKSHOP_FILTERS: 'wallpaperApp.workshopFilters',
  WORKSHOP_FAVORITES: 'wallpaperApp.workshopFavorites',
  
  // Suscripciones y seguimientos
  SUBSCRIPTIONS: 'wallpaperApp.subscriptions',
  AUTHOR_SUBSCRIPTIONS: 'wallpaperApp.authorSubscriptions',
  
  // Steam
  STEAM_USERNAME: 'wallpaperApp.steamUsername',
  STEAM_ACCOUNTS: 'wallpaperApp.steamAccounts',
  
  // UI
  DOWNLOAD_CONFIRMATION: 'wallpaperApp.showDownloadConfirmation',
  VIEW_MODE: 'wallpaperApp.viewMode',
  
  // Content preferences
  MATURE_CONTENT: 'wallpaperApp.showMatureContent',
  CONTENT_PREFERENCES: 'wallpaperApp.contentPreferences',
  
  // Recomendaciones
  RECOMMENDATION_SIGNALS: 'wallpaperApp.recommendationSignals',
  INTERACTION_LOG: 'wallpaperApp.interactionLog'
};

/**
 * Obtener valor del localStorage de forma segura
 * @param {string} key - Clave de almacenamiento
 * @param {any} defaultValue - Valor por defecto si no existe
 * @returns {any}
 */
export const getStorageItem = (key, defaultValue = null) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Error reading storage key "${key}":`, error);
    return defaultValue;
  }
};

/**
 * Guardar valor en localStorage de forma segura
 * @param {string} key - Clave de almacenamiento
 * @param {any} value - Valor a guardar
 * @returns {boolean}
 */
export const setStorageItem = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Error saving to storage key "${key}":`, error);
    return false;
  }
};

/**
 * Remover valor del localStorage
 * @param {string} key - Clave de almacenamiento
 * @returns {boolean}
 */
export const removeStorageItem = (key) => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Error removing storage key "${key}":`, error);
    return false;
  }
};
