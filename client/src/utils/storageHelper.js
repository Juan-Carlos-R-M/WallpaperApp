/**
 * Helpers para manejar localStorage de manera segura
 */

/**
 * Intenta guardar en localStorage, si excede cuota limpia y reintenta
 * @param {string} key - Clave de almacenamiento
 * @param {any} value - Valor a guardar (se serializa a JSON)
 * @returns {boolean} - true si se guardó exitosamente, false si falló
 */
export const safeSetItem = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    if (err.name === 'QuotaExceededError' || err.message.includes('exceeded the quota')) {
      console.warn(`localStorage quota exceeded for key: ${key}`);

      // Intentar limpiar datos no esenciales (incluye favoritos/interacciones)
      cleanupOldStorage();

      // Además, si seguimos sin espacio, eliminar específicamente la key objetivo
      try {
        localStorage.removeItem(key);
      } catch {}

      // Reintentar una sola vez
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (retryErr) {
        console.error(`Failed to save ${key} even after cleanup:`, retryErr);
        return false;
      }
    }
    console.error(`Error saving to localStorage:`, err);
    return false;
  }
};

/**
 * Limpia datos antiguos o innecesarios de localStorage
 */
export const cleanupOldStorage = () => {
  const keysToClean = [
    'wallpaperApp.subscriptions', // Puede crecer mucho
    'wallpaperApp.workshopCache', // Cache que puede limpiarse
    'wallpaperApp.steamWallpapersCache', // Cache de wallpapers de Steam
    'wallpaperApp.recommendationSignals' // Datos históricos
  ];

  // IMPORTANTE: NO tocar favoritos/interacciones para no perder wallpapers guardados.
  // 'wallpaperApp.wallpaperInteractions',
  // 'wallpaperApp.workshopFavorites'

  for (const key of keysToClean) {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const data = JSON.parse(stored);
        
        // Para subscripciones, limitar a últimas 50 items
        if (key === 'wallpaperApp.subscriptions' && typeof data === 'object') {
          const keys = Object.keys(data);
          if (keys.length > 50) {
            const cleaned = {};
            keys.slice(-50).forEach(k => {
              cleaned[k] = data[k];
            });
            localStorage.setItem(key, JSON.stringify(cleaned));
          }
        } else {
          // Para otros, simplemente remover
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.log(`Could not clean ${key}:`, e);
    }
  }
};

/**
 * Obtiene un item de localStorage de manera segura
 * @param {string} key - Clave a obtener
 * @param {any} defaultValue - Valor por defecto si no existe
 * @returns {any} - El valor parseado o el por defecto
 */
export const safeGetItem = (key, defaultValue = null) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (err) {
    console.error(`Error reading from localStorage:`, err);
    return defaultValue;
  }
};

/**
 * Limpia completamente la clave de localStorage
 * @param {string} key - Clave a limpiar
 */
export const safeClearItem = (key) => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (err) {
    console.error(`Error clearing localStorage:`, err);
    return false;
  }
};

export default {
  safeSetItem,
  safeGetItem,
  safeClearItem,
  cleanupOldStorage
};
