import { useCallback, useEffect, useRef, useState } from 'react';
import { steamService } from '../services/steamService';
import { recordWallpaperInteraction } from '../utils/recommendationSignals';
import { WORKSHOP_PAGE_SIZE } from '../features/steamWorkshop/workshopConfig';
import {
  getRequiredWorkshopTags,
  getWallpaperId,
  isDownloaderStatusReady,
} from '../features/steamWorkshop/workshopUtils';
import { markBrokenWallpapers, getBrokenWallpapers } from '../utils/wallpaperValidator';

const USERNAME_STORAGE_KEY = 'wallpaperApp.steamUsername';
const ACCOUNTS_STORAGE_KEY = 'wallpaperApp.steamAccounts';
const WORKSHOP_CACHE_KEY = 'wallpaperApp.workshopCache';
const STEAM_WALLPAPERS_CACHE_KEY = 'wallpaperApp.steamWallpapersCache';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 horas
const DEFAULT_STEAM_USERNAME = 'adgjl1182';

// Validar que un wallpaper tiene estructura válida (menos restrictivo)
const isValidWallpaper = (wallpaper) => {
  if (!wallpaper || typeof wallpaper !== 'object') return false;
  
  // Obtener el ID (puede ser string o number)
  const id = wallpaper.publishedFileId || wallpaper.id;
  if (!id) return false;
  
  // Convertir a string si es número
  const idStr = String(id).trim();
  if (idStr === '' || idStr === '0' || idStr === 'undefined') return false;
  
  // El wallpaper debe tener al menos título o descripción
  const title = wallpaper.title || wallpaper.name || '';
  const desc = wallpaper.description || '';
  
  // Acepta si tiene título O descripción (menos restrictivo)
  if (!title.trim() && !desc.trim()) {
    console.warn('[Wallpaper] Sin título ni descripción:', wallpaper);
    return false;
  }
  
  return true;
};

// Normalizar wallpapers: asegurar que tengan los campos básicos
const normalizeWallpaper = (wallpaper = {}) => {
  const normalized = {
    ...wallpaper,
    publishedFileId: wallpaper.publishedFileId || wallpaper.id || '',
    title: wallpaper.title || 'Sin título',
    author: wallpaper.author || wallpaper.authorName || wallpaper.creator || 'Desconocido',
    description: wallpaper.description || '',
    tags: Array.isArray(wallpaper.tags) ? wallpaper.tags : [],
    mediaType: wallpaper.mediaType || wallpaper.type || 'Unknown',
    previewUrl: wallpaper.previewUrl || wallpaper.image || wallpaper.thumbnail || '',
  };
  
  // Logs si faltan datos críticos
  if (!normalized.publishedFileId) {
    console.warn('[Wallpaper] Sin ID:', wallpaper);
  }
  
  return normalized;
};

const loadSteamAccounts = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(ACCOUNTS_STORAGE_KEY) || '[]');
    const selected = localStorage.getItem(USERNAME_STORAGE_KEY) || DEFAULT_STEAM_USERNAME;
    return Array.from(new Set([selected, DEFAULT_STEAM_USERNAME, ...saved].filter(Boolean)))
      .map(username => ({ username, displayName: username, hasPassword: false }));
  } catch {
    return [{ username: DEFAULT_STEAM_USERNAME, displayName: DEFAULT_STEAM_USERNAME, hasPassword: false }];
  }
};

const saveSteamAccounts = (accounts) => {
  localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
};

const minimizeWallpaperForCache = (w) => {
  if (!w) return null;
  return {
    publishedFileId: w.publishedFileId || w.id || '',
    title: w.title || '',
    description: typeof w.description === 'string' ? w.description.slice(0, 150) : '',
    author: w.author || '',
    authorId: w.authorId || '',
    mediaType: w.mediaType || 'image',
    mediaUrl: w.mediaUrl || '',
    playbackUrl: w.playbackUrl || '',
    previewUrl: w.previewUrl || '',
    localPath: w.localPath || '',
    fromSteam: Boolean(w.fromSteam),
    category: w.category || '',
    tags: Array.isArray(w.tags) ? w.tags.slice(0, 5) : [],
    fileSize: w.fileSize || 0,
    resolution: w.resolution || '',
    views: w.views || 0,
    downloads: w.downloads || 0,
    subscriptions: w.subscriptions || 0,
    likes: w.likes || 0,
    favorited: w.favorited || 0,
    needsRepair: Boolean(w.needsRepair),
    isBroken: Boolean(w.isBroken)
  };
};

// Funciones para cache de wallpapers
const saveWorkshopCache = (wallpapers, page = 1) => {
  try {
    // Validar que los wallpapers son válidos antes de guardar
    const validWallpapers = Array.isArray(wallpapers)
      ? wallpapers.filter(w => isValidWallpaper(w))
      : [];
    
    if (validWallpapers.length === 0) {
      console.warn('[Cache] No hay wallpapers válidos para guardar');
      return;
    }
    
    const minimized = validWallpapers.map(minimizeWallpaperForCache).filter(Boolean);

    const cache = {
      data: minimized,
      page,
      timestamp: Date.now(),
      version: 1 // Para futuras migraciones
    };
    localStorage.setItem(WORKSHOP_CACHE_KEY, JSON.stringify(cache));
    console.log(`[Cache] 💾 Guardados ${minimized.length} wallpapers válidos (minimizados)`);
  } catch (e) {
    console.warn('Error saving workshop cache:', e);
    // Si hay error guardando, limpiar el cache corrupto
    try {
      localStorage.removeItem(WORKSHOP_CACHE_KEY);
    } catch {}
  }
};

const loadWorkshopCache = () => {
  try {
    const cached = localStorage.getItem(WORKSHOP_CACHE_KEY);
    if (!cached) {
      console.log('[Cache] No hay cache del workshop');
      return null;
    }
    
    const data = JSON.parse(cached);
    
    // Validar estructura del cache
    if (!data || !Array.isArray(data.data)) {
      console.warn('[Cache] Estructura de cache inválida, eliminando...');
      localStorage.removeItem(WORKSHOP_CACHE_KEY);
      return null;
    }
    
    const age = Date.now() - (data.timestamp || 0);
    
    // Cache expira después de 24 horas
    if (age > CACHE_EXPIRY_MS) {
      console.log('[Cache] Cache expirado, eliminando...');
      localStorage.removeItem(WORKSHOP_CACHE_KEY);
      return null;
    }
    
    // Validar que hay al menos wallpapers válidos
    const validWallpapers = data.data.filter(w => isValidWallpaper(w));
    
    if (validWallpapers.length === 0) {
      console.warn('[Cache] No hay wallpapers válidos en cache, eliminando...');
      localStorage.removeItem(WORKSHOP_CACHE_KEY);
      return null;
    }
    
    console.log(`[Cache] ✅ Cargados ${validWallpapers.length} wallpapers válidos desde cache (edad: ${Math.round(age / 1000)}s)`);
    return validWallpapers;
  } catch (e) {
    console.warn('Error loading workshop cache:', e);
    // Si hay error parseando, limpiar el cache corrupto
    try {
      localStorage.removeItem(WORKSHOP_CACHE_KEY);
      console.log('[Cache] Cache corrupto eliminado');
    } catch {}
    return null;
  }
};

const saveSteamWallpapersCache = (wallpapers) => {
  try {
    // Validar que los wallpapers son válidos antes de guardar
    const validWallpapers = Array.isArray(wallpapers)
      ? wallpapers.filter(w => isValidWallpaper(w))
      : [];
    
    if (validWallpapers.length === 0) {
      console.warn('[Cache] No hay wallpapers Steam válidos para guardar');
      return;
    }
    
    const minimized = validWallpapers.map(minimizeWallpaperForCache).filter(Boolean);

    const cache = {
      data: minimized,
      timestamp: Date.now(),
      version: 1
    };
    localStorage.setItem(STEAM_WALLPAPERS_CACHE_KEY, JSON.stringify(cache));
    console.log(`[Cache] 💾 Guardados ${minimized.length} wallpapers Steam válidos (minimizados)`);
  } catch (e) {
    console.warn('Error saving steam wallpapers cache:', e);
    // Si hay error guardando, limpiar el cache corrupto
    try {
      localStorage.removeItem(STEAM_WALLPAPERS_CACHE_KEY);
    } catch {}
  }
};

const loadSteamWallpapersCache = () => {
  try {
    const cached = localStorage.getItem(STEAM_WALLPAPERS_CACHE_KEY);
    if (!cached) {
      console.log('[Cache] No hay cache de wallpapers Steam');
      return null;
    }
    
    const data = JSON.parse(cached);
    
    // Validar estructura del cache
    if (!data || !Array.isArray(data.data)) {
      console.warn('[Cache] Estructura de cache Steam inválida, eliminando...');
      localStorage.removeItem(STEAM_WALLPAPERS_CACHE_KEY);
      return null;
    }
    
    const age = Date.now() - (data.timestamp || 0);
    
    if (age > CACHE_EXPIRY_MS) {
      console.log('[Cache] Cache Steam expirado, eliminando...');
      localStorage.removeItem(STEAM_WALLPAPERS_CACHE_KEY);
      return null;
    }
    
    // Validar que hay al menos wallpapers válidos
    const validWallpapers = data.data.filter(w => isValidWallpaper(w));
    
    if (validWallpapers.length === 0) {
      console.warn('[Cache] No hay wallpapers Steam válidos en cache, eliminando...');
      localStorage.removeItem(STEAM_WALLPAPERS_CACHE_KEY);
      return null;
    }
    
    console.log(`[Cache] ✅ Cargados ${validWallpapers.length} wallpapers Steam válidos desde cache (edad: ${Math.round(age / 1000)}s)`);
    return validWallpapers;
  } catch (e) {
    console.warn('Error loading steam wallpapers cache:', e);
    // Si hay error parseando, limpiar el cache corrupto
    try {
      localStorage.removeItem(STEAM_WALLPAPERS_CACHE_KEY);
      console.log('[Cache] Cache Steam corrupto eliminado');
    } catch {}
    return null;
  }
};

export const useSteamWorkshop = ({
  favoritesOnly = false,
  searchQuery = '',
  workshopFilters = {},
  showMatureContent = false,
  shouldShowDownloadConfirmation = () => true,
  onNotify = () => {},
  onWorkshopError = () => {},
  onDownloadCompleted = () => {},
  onDeleteCompleted = () => {}
} = {}) => {
  const [steamWallpapers, setSteamWallpapers] = useState(() => {
    const cached = loadSteamWallpapersCache();
    console.log('[Hook Init] Steam wallpapers cache:', cached ? `${cached.length} items` : 'empty');
    return cached || [];
  });
  const [workshopWallpapers, setWorkshopWallpapers] = useState(() => {
    const cached = loadWorkshopCache();
    console.log('[Hook Init] Workshop cache:', cached ? `${cached.length} items` : 'empty');
    return cached || [];
  });
  const [workshopTotal, setWorkshopTotal] = useState(0);
  const [workshopPage, setWorkshopPage] = useState(1);
  const [hasMoreWorkshop, setHasMoreWorkshop] = useState(true);

  const [loading, setLoading] = useState(false);
  const [workshopLoading, setWorkshopLoading] = useState(false);
  const [error, setError] = useState(null);
  const [workshopError, setWorkshopError] = useState(null);
  const [steamPath, setSteamPath] = useState('');
  const [downloaderStatus, setDownloaderStatus] = useState(null);
  const [steamAccounts, setSteamAccounts] = useState(loadSteamAccounts);
  const [credentials, setCredentials] = useState({
    username: localStorage.getItem(USERNAME_STORAGE_KEY) || DEFAULT_STEAM_USERNAME,
    password: ''
  });
  const [downloadingId, setDownloadingId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [filterRefreshKey, setFilterRefreshKey] = useState(0);
  const loadingMoreWorkshopRef = useRef(false);
  const retryCountRef = useRef(0);
  const maxRetriesRef = useRef(3);
  const isMountedRef = useRef(true);
  const loadRequestIdRef = useRef(0);
  const searchRequestIdRef = useRef(0);
  const loadInFlightRef = useRef(false);
  const loadRetryTimeoutRef = useRef(null);
  const searchRetryTimeoutRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const workshopIdsRef = useRef(new Set()); // Track seen IDs for O(1) deduplication
  const prefetchNextPageRef = useRef(null); // Prefetch next page automatically

  const pushNotification = useCallback((message, type = 'error', extra = {}) => {
    const payload = typeof message === 'object'
      ? { type, ...message }
      : { ...extra, type, message };

    onNotify(payload);
  }, [onNotify]);

  const showWorkshopError = useCallback((message) => {
    setWorkshopError(message);
    onWorkshopError(message);
    pushNotification(message, 'error');
  }, [onWorkshopError, pushNotification]);

  const loadSteamWallpapers = useCallback(async () => {
    if (loadInFlightRef.current) {
      return;
    }

    loadInFlightRef.current = true;
    const requestId = ++loadRequestIdRef.current;
    const maxRetries = 3;
    let retries = 0;
    let lastError;
    // Safety timeout: if loading gets stuck for >30s, force-clear it
    let safetyTimeoutId = null;

    if (loadRetryTimeoutRef.current) {
      clearTimeout(loadRetryTimeoutRef.current);
      loadRetryTimeoutRef.current = null;
    }

    const attemptLoad = async () => {
      try {
        if (!steamService.hasElectronApi()) {
          console.log('[Steam] Sin Electron API, skip carga de wallpapers locales.');
          // Cargar desde cache como fallback sin mostrar error
          const cached = loadSteamWallpapersCache();
          if (cached && cached.length > 0) {
            if (!isMountedRef.current || loadRequestIdRef.current !== requestId) return;
            console.log('[Steam] Cargando desde cache (Electron no disponible)');
            setSteamWallpapers(cached);
          }
          return;
        }

        if (!isMountedRef.current || loadRequestIdRef.current !== requestId) return;
        setLoading(true);
        setError(null);

        // Safety timeout: force-clear loading after 30s no matter what
        safetyTimeoutId = setTimeout(() => {
          safetyTimeoutId = null;
          if (isMountedRef.current && loadRequestIdRef.current === requestId) {
            console.warn('[Steam] ⚠️ Safety timeout: forzando fin de loading (30s)');
            setLoading(false);
            loadInFlightRef.current = false;
          }
        }, 30000);
        
        console.log(`[Steam] Intentando cargar wallpapers (intento ${retries + 1}/${maxRetries})`);
        
        let timeoutTimer;
        const loadPromise = steamService.getSteamWallpapers();
        const timeoutPromise = new Promise((_, reject) => {
          timeoutTimer = setTimeout(() => {
            reject(new Error('Límite de tiempo de espera de Steam excedido (8s)'));
          }, 8000);
        });

        const wallpapers = await Promise.race([loadPromise, timeoutPromise]);
        clearTimeout(timeoutTimer);
        
        // Normalizar wallpapers descargados también
        const normalized = (Array.isArray(wallpapers) ? wallpapers : [])
          .map(normalizeWallpaper)
          .filter(w => Boolean(w.publishedFileId));
        
        // Validar que obtuvimos datos
        if (!Array.isArray(normalized)) {
          throw new Error('Respuesta inválida del servicio de Steam');
        }
        
        // Marcar wallpapers rotos/incompletos para reparación
        const withValidation = markBrokenWallpapers(normalized);
        const brokenCount = getBrokenWallpapers(withValidation).length;
        
        if (!isMountedRef.current || loadRequestIdRef.current !== requestId) return;
        setSteamWallpapers(withValidation);
        saveSteamWallpapersCache(withValidation);
        console.log(`[Steam] ✅ ${normalized.length} wallpapers cargados (${brokenCount} necesitan reparación)`);
        
        // Notificar si hay wallpapers rotos
        if (brokenCount > 0) {
          pushNotification({
            type: 'warning',
            persistent: false,
            title: '⚠️ Wallpapers incompletos detectados',
            message: `Se encontraron ${brokenCount} wallpaper(s) incompleto(s). Puedes repararlos desde la galería.`,
            status: 'Detección'
          });
        }
        
      } catch (err) {
        lastError = err;
        retries++;
        
        console.error(`[Steam] Error en intento ${retries}:`, err.message);
        
        if (retries < maxRetries) {
          // Esperar progresivamente más tiempo entre reintentos
          const delayMs = 800 * retries; // 0.8s, 1.6s
          console.log(`[Steam] Reintentando en ${delayMs}ms...`);
          await new Promise(resolve => {
            loadRetryTimeoutRef.current = setTimeout(() => {
              loadRetryTimeoutRef.current = null;
              resolve();
            }, delayMs);
          });
          if (!isMountedRef.current || loadRequestIdRef.current !== requestId) return;
          return attemptLoad(); // Reintentar recursivamente
        } else {
          // Agotamos reintentos, intentar cargar desde cache
          console.warn(`[Steam] Agotados ${maxRetries} intentos, cargando desde cache...`);
          const cached = loadSteamWallpapersCache();
          
          if (cached && cached.length > 0) {
            if (!isMountedRef.current || loadRequestIdRef.current !== requestId) return;
            console.log(`[Steam] ✅ Recuperados ${cached.length} wallpapers desde cache`);
            setSteamWallpapers(cached);
            setError('Usando datos en caché (conexión no disponible)');
          } else {
            const message = `Error cargando Steam: ${err.message}. No hay datos en caché.`;
            if (!isMountedRef.current || loadRequestIdRef.current !== requestId) return;
            setError(message);
            setSteamWallpapers([]);
          }
        }
      } finally {
        // Always cancel the safety timeout if we reach here normally
        if (safetyTimeoutId !== null) {
          clearTimeout(safetyTimeoutId);
          safetyTimeoutId = null;
        }
        if (isMountedRef.current && loadRequestIdRef.current === requestId) {
          setLoading(false);
        }
        if (loadRequestIdRef.current === requestId) {
          loadInFlightRef.current = false;
        }
      }
    };

    return attemptLoad();
  }, [pushNotification]);

  const checkSteamPath = useCallback(async () => {
    try {
      if (!steamService.hasElectronApi()) return;
      const path = await steamService.getSteamPath();
      if (isMountedRef.current) {
        setSteamPath(path);
      }
    } catch (err) {
      console.error('Error checking Steam path:', err);
    }
  }, []);

  const checkDownloaderStatus = useCallback(async () => {
    try {
      if (!steamService.hasElectronApi()) return;

      const status = await steamService.getWorkshopDownloaderStatus();
      if (isMountedRef.current) {
        setDownloaderStatus(status);
      }
      if (!isDownloaderStatusReady(status)) {
        pushNotification('No encontre SteamCMD ni DepotDownloader para descargar wallpapers. Revisa Configuracion.', 'error');
      }
    } catch (err) {
      pushNotification('Error revisando el descargador: ' + err.message, 'error');
      console.error('Error checking downloader status:', err);
    }
  }, [pushNotification]);

  const loadVaultAccounts = useCallback(async () => {
    try {
      if (!window.electronAPI?.listSteamAccounts) return;

      const data = await steamService.listSteamAccounts();
      if (isMountedRef.current) {
        setSteamAccounts(data.accounts);
        setCredentials(current => ({
          ...current,
          username: data.selectedUsername || current.username || DEFAULT_STEAM_USERNAME,
          password: ''
        }));
      }
    } catch (err) {
      console.error('Error loading Steam accounts:', err);
    }
  }, []);

  const searchWorkshop = useCallback(async (event, overrides = {}) => {
    const requestId = ++searchRequestIdRef.current;
    event?.preventDefault();

    if (searchRetryTimeoutRef.current) {
      clearTimeout(searchRetryTimeoutRef.current);
      searchRetryTimeoutRef.current = null;
    }
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    try {
      if (!steamService.hasElectronApi()) {
        console.error('[Workshop] ❌ Sin Electron API disponible');
        if (!isMountedRef.current || searchRequestIdRef.current !== requestId) return;
        setWorkshopLoading(false);
        showWorkshopError('Electron API no disponible. Necesitas versión de escritorio.');
        return;
      }

      if (!isMountedRef.current || searchRequestIdRef.current !== requestId) return;
      setWorkshopLoading(true);
      setWorkshopError(null);
      const nextQuery = overrides.query ?? searchQuery;
      const nextFilters = overrides.filters ?? workshopFilters;
      const nextPage = overrides.page ?? 1;
      const append = Boolean(overrides.append);
      const requiredTags = getRequiredWorkshopTags(nextFilters);

      if (!append) {
        setFilterRefreshKey(current => current + 1);
        retryCountRef.current = 0;
      }

      console.log(`[Workshop] 🔍 Buscando página ${nextPage}... append=${append}, query="${nextQuery}"`);
      console.log('[Workshop] 🔧 Params backend:', {
        query: nextQuery,
        page: nextPage,
        limit: WORKSHOP_PAGE_SIZE,
        sort: nextFilters.sort,
        time: nextFilters.time,
        requiredTags,
        matchAllTags: nextFilters.matchAllTags !== false
      });

      const searchPromise = steamService.searchWorkshopWallpapers({
        query: nextQuery,
        page: nextPage,
        limit: WORKSHOP_PAGE_SIZE,
        sort: nextFilters.sort,
        time: nextFilters.time,
        requiredTags,
        filters: nextFilters,
        matchAllTags: nextFilters.matchAllTags !== false,
        showMatureContent
      });

      // Timeout para esperar a la Steam API (puede ser lento).
      // Backend tiene 25s, así que damos 30s aquí para que el backend responda primero.
      const timeoutPromise = new Promise((_, reject) => {
        const timeoutMs = append ? 35000 : 30000;
        searchTimeoutRef.current = setTimeout(() => {
          searchTimeoutRef.current = null;
          reject(new Error(`Timeout: la búsqueda tardó demasiado (>${Math.round(timeoutMs / 1000)}s)`));
        }, timeoutMs);
      });


      console.log(`[Workshop] Esperando respuesta de IPC para página ${nextPage}...`);
      const data = await Promise.race([searchPromise, timeoutPromise]).catch(err => {
        console.error('[Workshop] ❌ Promise.race REJECTED:', err);
        throw err;
      });
      console.log(`[Workshop] ✅ Promise.race RESOLVED con datos:`, data ? Object.keys(data) : 'null');

      if (!isMountedRef.current || searchRequestIdRef.current !== requestId) {
        return;
      }

      console.log('[Workshop] 📥 Respuesta backend recibida (raw keys):', data ? Object.keys(data) : 'null');
      // Validar respuesta
      if (!data || typeof data !== 'object') {
        // Reset defensivo para que scroll/loader no se quede bloqueado
        setWorkshopLoading(false);
        loadingMoreWorkshopRef.current = false;
        setHasMoreWorkshop(true);
        throw new Error('Respuesta inválida del servidor (no es un objeto)');
      }


      // Data is already normalized by backend, only filter by ID
      const nextItems = (data.data || []).filter(wallpaper => {
        const hasId = Boolean(wallpaper.publishedFileId || wallpaper.publishedfileid);
        if (!hasId) {
          console.warn('[Workshop] Wallpaper sin ID ignorado:', wallpaper);
        }
        return hasId;
      }).map(item => ({
        ...item,
        publishedFileId: item.publishedFileId || item.publishedfileid || ''
      }));
      
      // Validación: Si no tenemos items y es página 1, es un error real
      if (nextItems.length === 0 && nextPage === 1) {
        const message = 'No se recibieron resultados. Verifica que Wallpaper Engine esté instalado.';
        console.warn('[Workshop] ' + message);
        showWorkshopError(message);
        if (isMountedRef.current && searchRequestIdRef.current === requestId) {
          setWorkshopWallpapers([]);
        }
        return;
      }
      
      console.log(`[Workshop] ✅ Obtenidos ${nextItems.length} items. hasMore=${data.hasMore}, total=${data.total}`);
      
      setWorkshopWallpapers(current => {
        if (!isMountedRef.current || searchRequestIdRef.current !== requestId) {
          return current;
        }
        let merged;
        
        console.log(`[Workshop] Mergeando: append=${append}, current=${current?.length || 0}, new=${nextItems.length}`);
        
        if (append) {
          // O(1) deduplication using Set
          const uniqueNextItems = nextItems.filter(item => {
            const id = getWallpaperId(item);
            if (workshopIdsRef.current.has(id)) return false;
            workshopIdsRef.current.add(id);
            return true;
          });
          console.log(`[Workshop] APPEND: ${uniqueNextItems.length}/${nextItems.length} únicos agregados`);

          // Si el backend devolvió solo repetidos (dedupe = 0), cortar el infinite scroll.
          // Esto evita el caso donde hasMore=true sigue solicitando páginas pero no se agregan nuevos.
          if (uniqueNextItems.length === 0) {
            // Backend devolvió sólo repetidos por dedupe.
            // Backend devolvió sólo repetidos (plateau por dedupe).
            // En vez de cortar definitivo el hasMore (que puede matar reintentos),
            setWorkshopLoading(false);
            loadingMoreWorkshopRef.current = false;
            // permitimos que el UI reintente con una carga extra, pero evitamos
            // que el loader/flags queden en estado incorrecto.
            setWorkshopLoading(false);
            loadingMoreWorkshopRef.current = false;
            // No forzamos hasMore aquí: el fin del scroll lo decide data.hasMore.
            // Solo cortamos el loader/flags para evitar estado enganchado.

          }

          merged = [...current, ...uniqueNextItems];
        } else {
          // Reset on new search
          workshopIdsRef.current.clear();
          nextItems.forEach(item => {
            const id = getWallpaperId(item);
            if (id) workshopIdsRef.current.add(id);
          });
          console.log(`[Workshop] RESET: ${nextItems.length} items nuevos`);
          merged = nextItems;
        }
        
        // Prevent memory bloat: keep only newest 500 items
        const MAX_ITEMS = 500;
        const result = merged.length > MAX_ITEMS ? merged.slice(-MAX_ITEMS) : merged;
        console.log(`[Workshop] Final: ${result.length} items en lista`);
        return result;
      });
      if (isMountedRef.current && searchRequestIdRef.current === requestId) {
        setWorkshopTotal(current => append
          ? Math.max(current, Number(data.total || 0), (nextPage - 1) * WORKSHOP_PAGE_SIZE + nextItems.length)
          : Math.max(Number(data.total || 0), nextItems.length)
        );
      }
      if (isMountedRef.current && searchRequestIdRef.current === requestId) {
        setWorkshopPage(nextPage);
      }
      
      // LÓGICA MEJORADA: Solo marcar como "sin más" si obtuvimos menos items del esperado
      let finalHasMore = false;
      if (data.hasMore !== undefined) {
        finalHasMore = data.hasMore;
      } else if (nextItems.length > 0) {
        // Si no obtuvo exactamente el límite, alcanzó el final
        finalHasMore = nextItems.length === WORKSHOP_PAGE_SIZE;
      }
      
      console.log(`[Workshop] hasMore=${finalHasMore} (nextPage=${nextPage}, limit=${WORKSHOP_PAGE_SIZE}, nextItems.length=${nextItems.length}, append=${append})`);
      if (isMountedRef.current && searchRequestIdRef.current === requestId) {
        setHasMoreWorkshop(finalHasMore);
        console.log('[Workshop] setHasMoreWorkshop:', finalHasMore, 'workshopWallpapers(next) pending');
      }
      retryCountRef.current = 0; // Reset reintentos en caso de éxito
      
      // Guardar en cache si es la primera página (búsqueda nueva)
      if (!append && nextItems.length > 0) {
        saveWorkshopCache(nextItems, nextPage);
        console.log(`[Workshop] 💾 Cache guardado: ${nextItems.length} items`);
      }
      
      // ⚠️ DESHABILITADO: Auto-prefetch causaba bucle infinito
      // Solo cargar cuando el usuario haga scroll al final
      // if (finalHasMore && append && nextItems.length === WORKSHOP_PAGE_SIZE) {
      //   console.log(`[Workshop] 🚀 Auto-prefetching página ${nextPage + 1}...`);
      //   prefetchNextPageRef.current = setTimeout(() => {
      //     if (!loadingMoreWorkshopRef.current && !workshopLoading) {
      //       loadingMoreWorkshopRef.current = true;
      //       searchWorkshop(null, { page: nextPage + 1, append: true });
      //     }
      //   }, 800);
      // }
    } catch (err) {
      console.error(`[Workshop] ❌ Error en búsqueda:`, err.message);

      console.error('[Workshop] 🧷 Contexto del error:', {
        page: overrides.page ?? 1,
        append: Boolean(overrides.append),
        query: overrides.query ?? searchQuery,
        filters: overrides.filters ?? workshopFilters
      });

      const isTemporaryError =
        err.message.includes('Timeout') ||
        err.message.includes('ECONNREFUSED') ||
        err.message.includes('ENOTFOUND') ||
        err.message.includes('ERR_');

      const isAppend = Boolean(overrides.append);
      const shouldRetry = isTemporaryError && retryCountRef.current < maxRetriesRef.current && isAppend;

      // Para que el infinite scroll no se “cierre” por un fallo temporal:
      // si es append y falló, dejamos hasMore=true para que intente de nuevo en el siguiente scroll.
      if (isAppend && isMountedRef.current && searchRequestIdRef.current === requestId) {
        setHasMoreWorkshop(true);
        loadingMoreWorkshopRef.current = false;
      }

      if (shouldRetry) {
        retryCountRef.current += 1;
        console.log(`[Workshop] ⚠️ Error temporal, reintentando ${retryCountRef.current}/${maxRetriesRef.current}...`);

        searchRetryTimeoutRef.current = setTimeout(() => {
          searchRetryTimeoutRef.current = null;
          if (isMountedRef.current && searchRequestIdRef.current === requestId) {
            searchWorkshop(null, overrides);
          }
        }, 800);
      } else {
        // Si es la primera búsqueda (página 1) y falló, intentar cargar desde cache
        if (!isAppend) {
          const cached = loadWorkshopCache();
          if (cached && cached.length > 0) {
            console.log(`[Workshop] 📦 Usando cache: ${cached.length} items`);
            setWorkshopWallpapers(cached);
            cached.forEach(item => {
              const id = getWallpaperId(item);
              if (id) workshopIdsRef.current.add(id);
            });
            setWorkshopError('Usando resultados en caché (conexión falló)');
          } else {
            const message = err.message || 'Error al consultar Workshop';
            showWorkshopError(message);
            console.log(`[Workshop] ❌ Error final sin cache: ${message}`);
          }
        } else {
          const message = err.message || 'Error al cargar más resultados';
          showWorkshopError(message);
        }
      }
    } finally {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
      if (isMountedRef.current && searchRequestIdRef.current === requestId) {
        setWorkshopLoading(false);
        loadingMoreWorkshopRef.current = false;
      }
    }
  }, [searchQuery, showMatureContent, showWorkshopError, workshopFilters]);

  const loadMoreWorkshopWallpapers = useCallback(() => {
    if (favoritesOnly || workshopLoading || loadingMoreWorkshopRef.current) return;

    console.log('[Workshop] loadMoreWorkshopWallpapers called', {
      hasMoreWorkshop,
      workshopPage,
      workshopLoading,
    });

    // En algunos casos el backend/filtro puede marcar hasMore=false prematuramente.
    // Para que el scroll infinito funcione mejor, permitimos intentar una carga
    // adicional aunque hasMoreWorkshop venga falso, siempre que no estemos cargando.
    if (!hasMoreWorkshop) {
      console.log('[Workshop] hasMoreWorkshop=false pero forzando intento de carga de una página adicional');
    }

    loadingMoreWorkshopRef.current = true;
    searchWorkshop(null, { page: workshopPage + 1, append: true });
  }, [favoritesOnly, hasMoreWorkshop, searchWorkshop, workshopLoading, workshopPage]);

  const showDownloadResultPopup = useCallback(async ({
    success = true,
    title = '',
    message = '',
    wallpaper = null,
    path = '',
    error: popupError = ''
  } = {}) => {
    if (success && !shouldShowDownloadConfirmation()) {
      return;
    }

    try {
      await steamService.showDownloadResult({
        success,
        title,
        message,
        wallpaperTitle: wallpaper?.title || '',
        wallpaper,
        author: wallpaper?.author || wallpaper?.authorName || wallpaper?.creator || '',
        tags: Array.isArray(wallpaper?.tags) ? wallpaper.tags : [],
        previewUrl: wallpaper?.previewUrl || wallpaper?.image || wallpaper?.thumbnail || '',
        resolution: wallpaper?.resolution || wallpaper?.dimensions || '',
        fileSize: wallpaper?.fileSize || wallpaper?.size || '',
        mediaType: wallpaper?.mediaType || wallpaper?.type || '',
        path,
        error: popupError
      });
    } catch (err) {
      pushNotification(`No se pudo mostrar o abrir el contenido: ${err.message}`, 'error');
    }
  }, [pushNotification, shouldShowDownloadConfirmation]);

  const downloadWorkshopWallpaper = useCallback(async (wallpaper) => {
    try {
      if (!steamService.hasElectronApi()) return;
      const wallpaperId = getWallpaperId(wallpaper);

      if (!wallpaperId) {
        showWorkshopError('Este wallpaper no tiene ID de Workshop y no se puede descargar.');
        return;
      }

      // Evitar descargar el mismo wallpaper si ya está descargándose
      if (downloadingId && downloadingId === wallpaperId) {
        console.log('[Download] Ya está descargando este wallpaper');
        return;
      }

      if (!credentials.username.trim()) {
        showWorkshopError('Configura una cuenta Steam en Configuracion antes de descargar.');
        return;
      }

      // Evitar desync: decidir usando un refresh directo del backend
      const refreshed = await steamService.getWorkshopDownloaderStatus().catch(() => null);
      const hasDownloader = isDownloaderStatusReady(refreshed?.data || refreshed);

      if (!hasDownloader) {
        // Si el diagnóstico aún no terminó, evita mostrar un “falta” falso.
        if (!refreshed || !refreshed?.data) {
          showWorkshopError('Todavía revisando el descargador. Intenta de nuevo en unos segundos.');
        } else {
          showWorkshopError('No encontre SteamCMD ni DepotDownloader. Abre Configuracion para revisar el diagnostico de descarga.');
        }
        return;
      }


      setDownloadingId(wallpaperId);
      setWorkshopError(null);

      // Normalizar wallpaper con publishedFileId consistente para notificaciones
      const notificationWallpaper = {
        ...wallpaper,
        publishedFileId: wallpaperId
      };

      // Mostrar notificación de progreso mientras descarga
      pushNotification({
        type: 'progress',
        persistent: true,
        title: '⏳ Descargando...',
        message: `Descargando: "${wallpaper.title || 'Wallpaper'}"`,
        status: 'Descargando',
        wallpaper: notificationWallpaper,
        progress: 0
      });

      // Simular progreso mientras se descarga
      let currentProgress = 0;
      const progressInterval = window.setInterval(() => {
        if (currentProgress < 90) {
          // Incrementar con velocidad aleatoria (0-15% por intervalo)
          currentProgress += Math.random() * 15;
          if (currentProgress > 90) currentProgress = 90;
          
          // Actualizar notificación con nuevo progreso
          pushNotification({
            type: 'progress',
            persistent: true,
            title: '⏳ Descargando...',
            message: `Descargando: "${wallpaper.title || 'Wallpaper'}"`,
            status: 'Descargando',
            wallpaper: notificationWallpaper,
            progress: currentProgress
          });
        }
      }, 500);

      let data;
      try {
        data = await steamService.downloadWorkshopWallpaper({
          publishedFileId: wallpaperId,
          username: credentials.username,
          password: credentials.password
        });
        clearInterval(progressInterval);
      } catch (downloadErr) {
        clearInterval(progressInterval);
        // Capturar error de descarga y relanzar con contexto
        const enhancedError = new Error(`Fallo al descargar: ${downloadErr.message || 'Error desconocido'}`);
        enhancedError.originalError = downloadErr;
        throw enhancedError;
      }

      if (!data || typeof data !== 'object') {
        throw new Error('Respuesta inválida del servicio de descarga');
      }

      const downloadedNotificationWallpaper = {
        ...wallpaper,
        ...data.wallpaper,
        publishedFileId: wallpaperId || data.wallpaper?.publishedFileId
      };

      if (data.wallpaper) {
        const nextWallpaper = {
          ...data.wallpaper,
          publishedFileId: wallpaperId || data.wallpaper.publishedFileId
        };
        setSteamWallpapers(prev => [
          nextWallpaper,
          ...prev.filter(item => getWallpaperId(item) !== getWallpaperId(nextWallpaper))
        ]);
        onDownloadCompleted(downloadedNotificationWallpaper, nextWallpaper);
      }

      const downloadPath = data.path || data.wallpaper?.localPath || '';
      
      // Actualizar a 100% de progreso (usar notificationWallpaper para consistencia)
      pushNotification({
        type: 'progress',
        persistent: true,
        title: '⏳ Finalizando...',
        message: `Descargando: "${wallpaper.title || 'Wallpaper'}"`,
        status: 'Descargando',
        wallpaper: notificationWallpaper,
        progress: 100
      });

      void showDownloadResultPopup({
        success: true,
        title: data.wallpaper?.title || wallpaper.title || 'Wallpaper descargado',
        message: 'La descarga termino correctamente. Puedes abrir la carpeta del contenido.',
        wallpaper: downloadedNotificationWallpaper,
        path: downloadPath
      });
      
      // Notificación de éxito al completar (usar notificationWallpaper para consistencia)
      pushNotification({
        type: 'success',
        persistent: true,
        title: '✅ Descarga completada',
        message: `"${downloadedNotificationWallpaper.title || wallpaper.title || 'Wallpaper'}" descargado correctamente`,
        status: 'Completada',
        wallpaper: notificationWallpaper,
        path: downloadPath
      });
      
      recordWallpaperInteraction(downloadedNotificationWallpaper, 'download');
    } catch (err) {
      console.error('Error downloading Workshop wallpaper:', err);
      
      try {
        // Remover el wallpaper fallido del estado local para permitir reintentar
        setSteamWallpapers(prev => 
          prev.filter(item => getWallpaperId(item) !== wallpaperId)
        );
      } catch (stateErr) {
        console.error('Error removiendo wallpaper del estado:', stateErr);
      }
      
      // Mapear errores técnicos a mensajes simples
      let userMessage = 'No se pudo completar la descarga.';
      const errorStr = String(err?.message || err?.toString() || '').toLowerCase();
      
      if (errorStr.includes('exceeded the quota') || errorStr.includes('quota')) {
        userMessage = 'Almacenamiento lleno. Limpia datos innecesarios.';
        // Intentar limpiar subscripciones viejas
        try {
          localStorage.removeItem('wallpaperApp.subscriptions');
        } catch (e) {
          console.log('No se pudo limpiar localStorage:', e);
        }
      } else if (errorStr.includes('network') || errorStr.includes('conexion') || errorStr.includes('connection')) {
        userMessage = 'Error de conexión. Verifica tu internet.';
      } else if (errorStr.includes('timeout') || errorStr.includes('tardo')) {
        userMessage = 'La descarga tardó demasiado. Intenta de nuevo.';
      } else if (errorStr.includes('not found') || errorStr.includes('404') || errorStr.includes('no existe')) {
        userMessage = 'El archivo no existe o fue eliminado.';
      } else if (errorStr.includes('permission') || errorStr.includes('permisos')) {
        userMessage = 'No tienes permisos para descargar esto.';
      } else if (errorStr.includes('steam')) {
        userMessage = 'Problemas con Steam. Verifica tus credenciales.';
      }
      
      try {
        // Enviar notificación de error (reemplaza la de progreso, usar notificationWallpaper para consistencia)
        pushNotification({
          type: 'error',
          persistent: true,
          title: '❌ Descarga fallida',
          message: userMessage,
          status: 'Error',
          wallpaper: {
            ...wallpaper,
            publishedFileId: wallpaperId
          }
        });
      } catch (notifErr) {
        console.error('Error mostrando notificación de error:', notifErr);
      }
      
      try {
        // Mostrar popup con detalles
        void showDownloadResultPopup({
          success: false,
          title: 'Descarga fallida',
          message: userMessage,
          wallpaper,
          error: userMessage,
          retryable: true
        });
      } catch (popupErr) {
        console.error('Error mostrando popup de error:', popupErr);
      }
    } finally {
      try {
        setDownloadingId('');
        checkDownloaderStatus();
      } catch (finalErr) {
        console.error('Error en finally de descarga:', finalErr);
      }
    }
  }, [
    checkDownloaderStatus,
    credentials.password,
    credentials.username,
    downloaderStatus?.hasDownloader,
    onDownloadCompleted,
    pushNotification,
    showDownloadResultPopup,
    showWorkshopError
  ]);

  const deleteWorkshopWallpaper = useCallback(async (wallpaper) => {
    try {
      if (!steamService.hasElectronApi()) return;

      const wallpaperId = getWallpaperId(wallpaper);
      if (!wallpaperId) return;

      const confirmed = window.confirm(`Eliminar "${wallpaper.title}" de Wallpaper Engine?`);
      if (!confirmed) return;

      setDeletingId(wallpaperId);
      setWorkshopError(null);

      await steamService.deleteWorkshopWallpaper({ publishedFileId: wallpaperId });
      setSteamWallpapers(prev => prev.filter(item => getWallpaperId(item) !== wallpaperId));
      onDeleteCompleted(wallpaperId);
    } catch (err) {
      showWorkshopError('Error al eliminar: ' + err.message);
      console.error('Error deleting Workshop wallpaper:', err);
    } finally {
      setDeletingId('');
    }
  }, [onDeleteCompleted, showWorkshopError]);

  // Reparar wallpaper incompleto: eliminar y descargar de nuevo
  const repairWorkshopWallpaper = useCallback(async (wallpaper) => {
    try {
      if (!steamService.hasElectronApi()) return;

      const wallpaperId = getWallpaperId(wallpaper);
      if (!wallpaperId) return;

      // Confirmar reparación
      const confirmed = window.confirm(
        `Reparar "${wallpaper.title}"?\n\nSe eliminará y descargará de nuevo.`
      );
      if (!confirmed) return;

      // Limpiar primero
      console.log(`[Repair] Eliminando wallpaper incompleto ${wallpaperId}...`);
      await steamService.deleteWorkshopWallpaper({ publishedFileId: wallpaperId });
      
      // Quitar de la lista temporalmente
      setSteamWallpapers(prev => prev.filter(item => getWallpaperId(item) !== wallpaperId));

      // Mostrar notificación de reparación en progreso
      pushNotification({
        type: 'progress',
        persistent: true,
        title: '🔧 Reparando...',
        message: `Reparando: "${wallpaper.title}"`,
        status: 'Reparación',
        wallpaper
      });

      // Descargar de nuevo con el mismo wallpaper
      console.log(`[Repair] Descargando nuevamente ${wallpaperId}...`);
      await downloadWorkshopWallpaper(wallpaper);

    } catch (err) {
      pushNotification({
        type: 'error',
        persistent: true,
        title: '❌ Reparación fallida',
        message: `No se pudo reparar "${wallpaper.title}": ${err.message}`,
        status: 'Error',
        wallpaper
      });
      console.error('Error repairing Workshop wallpaper:', err);
    }
  }, [downloadWorkshopWallpaper, pushNotification]);

  useEffect(() => {
    loadSteamWallpapers();
    checkSteamPath();
    checkDownloaderStatus();
    loadVaultAccounts();
  }, [checkDownloaderStatus, checkSteamPath, loadSteamWallpapers, loadVaultAccounts]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;

      if (loadRetryTimeoutRef.current) {
      clearTimeout(loadRetryTimeoutRef.current);
      loadRetryTimeoutRef.current = null;
    }

    if (searchRetryTimeoutRef.current) {
      clearTimeout(searchRetryTimeoutRef.current);
      searchRetryTimeoutRef.current = null;
    }

    if (prefetchNextPageRef.current) {
      clearTimeout(prefetchNextPageRef.current);
      prefetchNextPageRef.current = null;
    }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(USERNAME_STORAGE_KEY, credentials.username);
  }, [credentials.username]);

  useEffect(() => {
    saveSteamAccounts(steamAccounts.map(account => account.username || account));
  }, [steamAccounts]);

  // Mantener referencias a los valores actuales para que el effect de filtros
  // solo se ejecute cuando cambian los filtros o la query, y no cuando
  // searchWorkshop se recrea por cierres nuevos.
  const searchQueryRef = useRef(searchQuery);
  const workshopFiltersRef = useRef(workshopFilters);
  const showMatureContentRef = useRef(showMatureContent);
  const searchWorkshopRef = useRef(searchWorkshop);

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    workshopFiltersRef.current = workshopFilters;
  }, [workshopFilters]);

  useEffect(() => {
    showMatureContentRef.current = showMatureContent;
  }, [showMatureContent]);

  useEffect(() => {
    searchWorkshopRef.current = searchWorkshop;
  }, [searchWorkshop]);

  useEffect(() => {
    if (favoritesOnly) return undefined;

    // Limpiar prefetch cuando cambian filtros
    if (prefetchNextPageRef.current) {
      clearTimeout(prefetchNextPageRef.current);
      prefetchNextPageRef.current = null;
    }

    const searchDelay = window.setTimeout(() => {
      loadingMoreWorkshopRef.current = false;
      searchWorkshopRef.current(null, {
        query: searchQueryRef.current,
        filters: workshopFiltersRef.current,
        page: 1,
        append: false
      });
    }, 320);

    return () => {
      window.clearTimeout(searchDelay);
      if (prefetchNextPageRef.current) {
        clearTimeout(prefetchNextPageRef.current);
        prefetchNextPageRef.current = null;
      }
    };
  }, [
    favoritesOnly,
    searchQuery,
    workshopFilters.sort,
    workshopFilters.time,
    workshopFilters.type,
    workshopFilters.genre,
    workshopFilters.assetType,
    workshopFilters.assetGenre,
    workshopFilters.scriptType,
    workshopFilters.ageRating,
    workshopFilters.matchAllTags,
    showMatureContent
  ]);

  // CLEANUP: Limpiar prefetch timer cuando se desmonta el hook
  useEffect(() => {
    return () => {
      if (prefetchNextPageRef.current) {
        clearTimeout(prefetchNextPageRef.current);
        prefetchNextPageRef.current = null;
      }

      if (searchRetryTimeoutRef.current) {
        clearTimeout(searchRetryTimeoutRef.current);
        searchRetryTimeoutRef.current = null;
      }

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
    };
  }, []);

  return {
    steamWallpapers,
    setSteamWallpapers,
    workshopWallpapers,
    workshopTotal,
    workshopPage,
    hasMoreWorkshop,
    loading,
    workshopLoading,
    error,
    workshopError,
    steamPath,
    downloaderStatus,
    steamAccounts,
    credentials,
    setCredentials,
    downloadingId,
    deletingId,
    filterRefreshKey,
    loadingMoreWorkshopRef,
    loadSteamWallpapers,
    checkDownloaderStatus,
    searchWorkshop,
    loadMoreWorkshopWallpapers,
    downloadWorkshopWallpaper,
    deleteWorkshopWallpaper,
    repairWorkshopWallpaper
  };
};

export default useSteamWorkshop;
