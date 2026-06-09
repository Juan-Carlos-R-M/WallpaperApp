/**
 * Gestor de cache para wallpapers de Steam Workshop
 * Proporciona funciones para limpiar, validar y diagnosticar el cache
 */

const WORKSHOP_CACHE_KEY = 'wallpaperApp.workshopCache';
const STEAM_WALLPAPERS_CACHE_KEY = 'wallpaperApp.steamWallpapersCache';

/**
 * Limpia todos los caches de wallpapers
 */
export const clearAllCache = () => {
  console.log('[CacheManager] 🧹 Limpiando todos los caches...');
  try {
    localStorage.removeItem(WORKSHOP_CACHE_KEY);
    localStorage.removeItem(STEAM_WALLPAPERS_CACHE_KEY);
    console.log('[CacheManager] ✅ Todos los caches fueron limpiados');
    return true;
  } catch (e) {
    console.error('[CacheManager] Error limpiando cache:', e);
    return false;
  }
};

/**
 * Limpia solo el cache del workshop
 */
export const clearWorkshopCache = () => {
  console.log('[CacheManager] 🧹 Limpiando cache del workshop...');
  try {
    localStorage.removeItem(WORKSHOP_CACHE_KEY);
    console.log('[CacheManager] ✅ Cache del workshop limpiado');
    return true;
  } catch (e) {
    console.error('[CacheManager] Error limpiando cache del workshop:', e);
    return false;
  }
};

/**
 * Limpia solo el cache de wallpapers de Steam
 */
export const clearSteamCache = () => {
  console.log('[CacheManager] 🧹 Limpiando cache de Steam...');
  try {
    localStorage.removeItem(STEAM_WALLPAPERS_CACHE_KEY);
    console.log('[CacheManager] ✅ Cache de Steam limpiado');
    return true;
  } catch (e) {
    console.error('[CacheManager] Error limpiando cache de Steam:', e);
    return false;
  }
};

/**
 * Obtiene diagnóstico del estado del cache
 */
export const getCacheDiagnostics = () => {
  try {
    const workshop = localStorage.getItem(WORKSHOP_CACHE_KEY);
    const steam = localStorage.getItem(STEAM_WALLPAPERS_CACHE_KEY);

    const diagnostics = {
      timestamp: new Date().toISOString(),
      workshop: {
        exists: !!workshop,
        size: workshop ? workshop.length : 0,
        valid: false,
        itemCount: 0
      },
      steam: {
        exists: !!steam,
        size: steam ? steam.length : 0,
        valid: false,
        itemCount: 0
      }
    };

    // Validar workshop cache
    if (workshop) {
      try {
        const data = JSON.parse(workshop);
        diagnostics.workshop.valid = Array.isArray(data.data);
        diagnostics.workshop.itemCount = data.data ? data.data.length : 0;
      } catch (e) {
        diagnostics.workshop.valid = false;
        diagnostics.workshop.error = e.message;
      }
    }

    // Validar steam cache
    if (steam) {
      try {
        const data = JSON.parse(steam);
        diagnostics.steam.valid = Array.isArray(data.data);
        diagnostics.steam.itemCount = data.data ? data.data.length : 0;
      } catch (e) {
        diagnostics.steam.valid = false;
        diagnostics.steam.error = e.message;
      }
    }

    return diagnostics;
  } catch (e) {
    console.error('[CacheManager] Error obteniendo diagnósticos:', e);
    return {
      timestamp: new Date().toISOString(),
      error: e.message
    };
  }
};

/**
 * Repara automáticamente cualquier cache corrupto
 */
export const repairCorruptedCache = () => {
  console.log('[CacheManager] 🔧 Intentando reparar cache corrupto...');
  const diagnostics = getCacheDiagnostics();
  let repaired = false;

  if (diagnostics.workshop && !diagnostics.workshop.valid) {
    console.log('[CacheManager] Workshop cache corrupto, eliminando...');
    clearWorkshopCache();
    repaired = true;
  }

  if (diagnostics.steam && !diagnostics.steam.valid) {
    console.log('[CacheManager] Steam cache corrupto, eliminando...');
    clearSteamCache();
    repaired = true;
  }

  if (repaired) {
    console.log('[CacheManager] ✅ Cache corrupto reparado');
  } else {
    console.log('[CacheManager] ℹ️ No se encontró cache corrupto');
  }

  return repaired;
};

/**
 * Log completo del estado del cache
 */
export const debugCache = () => {
  const diagnostics = getCacheDiagnostics();
  console.group('[CacheManager] 📊 Diagnóstico completo del cache');
  console.table(diagnostics);
  console.groupEnd();
  return diagnostics;
};

export default {
  clearAllCache,
  clearWorkshopCache,
  clearSteamCache,
  getCacheDiagnostics,
  repairCorruptedCache,
  debugCache
};
