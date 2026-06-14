import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  enrichWallpaperMetadata,
  getAuthorWallpapers,
  sortSimilarWallpapers
} from '../utils/wallpaperMeta';
import { canShowWallpaper, isMatureWallpaper } from '../utils/contentPreferences';
import {
  FAVORITES_STORAGE_KEY,
  buildAuthorSubscriptionRecord,
  followAuthorFromWallpaper,
  loadAuthorSubscriptions,
  loadFavoriteWallpapers,
  recordWallpaperInteraction,
  saveAuthorSubscriptions,
  updateAuthorSubscription
} from '../utils/recommendationSignals';
import { clearAllCache } from '../utils/cacheManager';
import '../styles/steam-integration.css';
// bootstrap-icons se carga desde index.html (CDN) para evitar dependencia del paquete

import WallpaperDetails from './WallpaperDetails';
import AuthorProfile from './AuthorProfile';
import LoadingScreen from './LoadingScreen';
import { useSteamWorkshop } from '../hooks/useSteamWorkshop';
import {
  DEFAULT_WORKSHOP_FILTERS,
  DOWNLOAD_CONFIRMATION_STORAGE_KEY,
  FAVORITE_CONTENT_TABS,
  FAVORITE_SORT_TABS,
  getActiveWorkshopFilterChips
} from '../features/steamWorkshop/workshopConfig';
import { WorkshopGrid } from '../features/steamWorkshop/WorkshopCard';
import {
  getWallpaperId,
  isDownloaderStatusReady,
  mergeDownloadedWallpaper,
  shouldShowDownloadConfirmation,
  sortFavoriteWallpapers
} from '../features/steamWorkshop/workshopUtils';

export { DEFAULT_WORKSHOP_FILTERS, DOWNLOAD_CONFIRMATION_STORAGE_KEY };

const normalizeFavorite = (favorite = {}) => ({
  ...favorite,
  publishedFileId: favorite.publishedFileId || favorite.id || '',
  title: favorite.title || 'Sin título',
  author: favorite.author || favorite.authorName || favorite.creator || 'Desconocido'
});

// Limpiar cache de localStorage si está corrupto
const clearCorruptedCache = () => {
  console.log('[SteamIntegration] 🧹 Limpiando cache corrupto...');
  clearAllCache();
  console.log('[SteamIntegration] ✅ Cache limpiado correctamente');
};

const loadFavorites = () => {
  const fav = loadFavoriteWallpapers();
  // Normalizar favoritos al cargar
  return (Array.isArray(fav) ? fav : [])
    .map(normalizeFavorite)
    .filter(f => Boolean(f.publishedFileId));
};

const saveFavorites = (favorites) => {
  // Evitar crash/reload por quota excedida
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  } catch (err) {
    console.warn('[SteamIntegration] localStorage quota excedida al guardar favoritos, ignorando persistencia.', err);
  }
};


const loadSubscriptions = () => {
  return loadAuthorSubscriptions();
};

const SteamIntegration = ({
  favoritesOnly = false,
  searchQuery = '',
  workshopFilters = DEFAULT_WORKSHOP_FILTERS,
  onNotify = () => {},
  onNavigate = () => {},
  showMatureContent = false
}) => {
  const [favorites, setFavorites] = useState(loadFavorites);
  const [subscriptions, setSubscriptions] = useState(loadSubscriptions);
  const [detailWallpaper, setDetailWallpaper] = useState(null);
  const [selectedAuthorId, setSelectedAuthorId] = useState(null);
  const [favoriteContentTab, setFavoriteContentTab] = useState('normal');
  const [favoriteSortTab, setFavoriteSortTab] = useState('recent');
  // Safety: force-dismiss loading screen after max 10s regardless of state
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const loadMoreRef = useRef(null);
  const listScrollYRef = useRef(0);
  const scrollStateRef = useRef({
    workshopPage: 1,
    hasMoreWorkshop: false,
    workshopLoading: false,

    loadingMoreRef: null,
    searchFunc: null,
    isLoadingMore: false,
    savedScrollPos: 0,
    wallpaperCountBeforeLoad: 0
  });
  const lastLoadedPageRef = useRef(0);
  const hasInitialSearchedRef = useRef(false);
  const cleanupTimeoutRef = useRef(null);
  const loadingTimeoutRef = useRef(null);
  const scrollLockRef = useRef(false);

  const pushNotification = useCallback((message, type = 'error', extra = {}) => {
    const payload = typeof message === 'object'
      ? { type, ...message }
      : { ...extra, type, message };

    onNotify(payload);
  }, [onNotify]);

  const handleDownloadCompleted = useCallback((downloadedWallpaper, installedWallpaper) => {
    setDetailWallpaper(current => (
      current && getWallpaperId(current) === getWallpaperId(installedWallpaper)
        ? mergeDownloadedWallpaper(current, installedWallpaper)
        : current
    ));
    setSubscriptions(followAuthorFromWallpaper(downloadedWallpaper, 'download'));
  }, []);

  const handleDeleteCompleted = useCallback((wallpaperId) => {
    setDetailWallpaper(current => (
      current && getWallpaperId(current) === wallpaperId ? null : current
    ));
  }, []);

  const {
    steamWallpapers,
    workshopWallpapers,
    workshopTotal,
    workshopPage,
    hasMoreWorkshop,
    loading,
    workshopLoading,
    error,
    workshopError,
    downloaderStatus,
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
  } = useSteamWorkshop({
    favoritesOnly,
    searchQuery,
    workshopFilters,
    showMatureContent,
    shouldShowDownloadConfirmation,
    onNotify,
    onDownloadCompleted: handleDownloadCompleted,
    onDeleteCompleted: handleDeleteCompleted
  });
  const downloaderStatusChecked = Boolean(downloaderStatus);
  const downloaderReady = !downloaderStatusChecked || isDownloaderStatusReady(downloaderStatus);

  const captureListScroll = useCallback(() => {
    const scrollElement = document.scrollingElement || document.documentElement;
    listScrollYRef.current = Math.max(
      window.scrollY || window.pageYOffset || 0,
      scrollElement?.scrollTop || 0
    );
  }, []);

  const restoreListScroll = useCallback(() => {
    const top = listScrollYRef.current || 0;
    const restore = () => {
      const scrollElement = document.scrollingElement || document.documentElement;
      window.scrollTo({ top, left: 0, behavior: 'auto' });
      if (scrollElement) {
        scrollElement.scrollTop = top;
      }
    };

    window.requestAnimationFrame(() => {
      restore();
      window.requestAnimationFrame(restore);
    });
    window.setTimeout(restore, 90);
    window.setTimeout(restore, 220);
  }, []);

  // Funciones para mantener scroll durante infinite scroll
  const lockScrollDuringLoad = useCallback(() => {
    scrollLockRef.current = true;
    const scrollElement = document.scrollingElement || document.documentElement;
    const currentPos = Math.max(
      window.scrollY || window.pageYOffset || 0,
      scrollElement?.scrollTop || 0
    );
    scrollStateRef.current.savedScrollPos = currentPos;
    // Guardar cuántos wallpapers hay antes de esta carga; lo usamos para saber
    // si la carga agregó items o falló silenciosamente.
    scrollStateRef.current.wallpaperCountBeforeLoad = workshopWallpapers.length;
    console.log(`[Scroll Lock] Bloqueando en posición: ${currentPos}px`);
  }, [workshopWallpapers.length]);

  const restoreScrollAfterLoad = useCallback(() => {
    if (!scrollLockRef.current) return;

    scrollLockRef.current = false;
    const targetPos = scrollStateRef.current.savedScrollPos || 0;

    // Doble rAF: esperar a que React haga commit y el browser pinte la nueva altura.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: targetPos, left: 0, behavior: 'auto' });
      });
    });

    // Fallback por si las imágenes de los nuevos items tardan en cargar altura.
    const fallback = window.setTimeout(() => {
      window.scrollTo({ top: targetPos, left: 0, behavior: 'auto' });
    }, 200);
    return () => window.clearTimeout(fallback);
  }, []);

  const openDetailWallpaper = useCallback((wallpaper) => {
    console.log('[SteamIntegration] 📖 Opening wallpaper details:', {
      title: wallpaper?.title,
      publishedFileId: wallpaper?.publishedFileId,
      hasDescription: Boolean(wallpaper?.description),
      hasTags: Array.isArray(wallpaper?.tags) && wallpaper.tags.length > 0
    });
    
    if (!detailWallpaper) {
      captureListScroll();
    }
    setDetailWallpaper(wallpaper);
  }, [captureListScroll, detailWallpaper]);

  const closeDetailWallpaper = useCallback(() => {
    setDetailWallpaper(null);
    restoreListScroll();
  }, [restoreListScroll]);

  const navigateFromDetail = useCallback((target) => {
    setDetailWallpaper(null);
    setSelectedAuthorId(null);
    onNavigate(target);
  }, [onNavigate]);

  // Cargar y sincronizar favoritos (tanto al montar como al recibir actualizaciones)
  useEffect(() => {
    const loadAndSyncFavorites = async () => {
      if (window.electronAPI?.getFavorites) {
        try {
          const result = await window.electronAPI.getFavorites();
          if (result?.success) {
            setFavorites(Array.isArray(result.data) ? result.data : []);
            return;
          }
        } catch (err) {
          console.error('[SteamIntegration] Error loading favorites via IPC:', err);
        }
      }
      setFavorites(loadFavorites());
    };

    loadAndSyncFavorites();

    window.addEventListener('favorites-updated', loadAndSyncFavorites);
    return () => window.removeEventListener('favorites-updated', loadAndSyncFavorites);
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.getFavorites) {
      saveFavorites(favorites);
    }
  }, [favorites]);

  useEffect(() => {
    saveAuthorSubscriptions(subscriptions);
  }, [subscriptions]);

  // Restaurar scroll después de que termina la carga (cuando workshopLoading pasa a false)
  useEffect(() => {
    // Cuando termina una carga, decidir si re-armar el dedup:
    // - Si la carga AGREGÓ items (éxito), dejamos la marca puesta para evitar duplicados.
    // - Si la carga NO agregó items (falló), permitimos que el siguiente scroll reintente.
    if (!workshopLoading) {
      const prevCount = scrollStateRef.current.wallpaperCountBeforeLoad;
      if (typeof prevCount === 'number' && workshopWallpapers.length > prevCount) {
        // Éxito: dedup ya armado por el listener/observer que disparó la carga.
        console.log(`[Scroll] ✅ Carga agregó items (${prevCount} → ${workshopWallpapers.length}), dedup armado`);
      } else {
        lastLoadedPageRef.current = 0;
        if (typeof prevCount === 'number') {
          console.log('[Scroll] ⚠️ Carga no agregó items, rearmando dedup para reintento');
        }
      }
    }

    // Solo restaurar si estamos en infinit scroll (no en búsqueda inicial)
    if (!scrollLockRef.current || workshopLoading) {
      return;
    }

    // Verificar que realmente se agregaron wallpapers
    const countNow = workshopWallpapers.length;
    if (countNow === 0) {
      return;
    }

    // La carga terminó (workshopLoading es false y teníamos lock activo)
    console.log(`[Scroll] ✅ Carga completada, restaurando scroll`);
    restoreScrollAfterLoad();
  }, [workshopLoading, workshopWallpapers.length, restoreScrollAfterLoad]);

  // LÓGICA SIMPLIFICADA: No hacer limpieza automática que cause bucles
  useEffect(() => {
    if (!workshopError || workshopWallpapers.length > 0) {
      return; // Sin error o hay datos, no hacer nada
    }
    console.warn('[SteamIntegration] ⚠️ Error persistente: el usuario puede usar "Limpiar Cache"');
  }, [workshopError, workshopWallpapers.length]);

  useEffect(() => {
    if (!showMatureContent && favoriteContentTab === 'mature') {
      setFavoriteContentTab('normal');
    }
  }, [favoriteContentTab, showMatureContent]);

  // INIT LOAD: Si no hay wallpapers en workshop, ejecuta búsqueda inicial (UNA SOLA VEZ)
  useEffect(() => {
    const logPrefix = '[SteamIntegration Init]';

    // No hacer nada si ya hemos hecho búsqueda inicial
    if (hasInitialSearchedRef.current) {
      console.log(`${logPrefix} ⏭️ Ya se hizo búsqueda inicial, skip`);
      return;
    }

    // No hacer nada si estamos en modo favoritos
    if (favoritesOnly) {
      console.log(`${logPrefix} ⏭️ Modo favoritos, skip`);
      return;
    }

    // No hacer búsqueda si no hay Electron API
    if (!window.electronAPI) {
      console.log(`${logPrefix} ⚠️ Sin Electron API, skip`);
      return;
    }
    
    // No hacer búsqueda si ya hay wallpapers
    if (workshopWallpapers.length > 0) {
      console.log(`${logPrefix} ✅ Ya hay ${workshopWallpapers.length} wallpapers, skip`);
      return;
    }

    // Marcar que ya intentamos búsqueda inicial
    hasInitialSearchedRef.current = true;

    console.log(`${logPrefix} 🚀 Iniciando búsqueda inicial (una sola vez)...`);
    lastLoadedPageRef.current = 0;
    
    // Hacer búsqueda sin delay
    searchWorkshop(null, {
      query: searchQuery || '',
      filters: workshopFilters,
      page: 1,
      append: false
    });
  }, [favoritesOnly, workshopWallpapers.length, searchWorkshop, workshopFilters]);

  // Actualizar estado en ref para que el listener siempre tenga valores frescos
  useEffect(() => {
    scrollStateRef.current = {
      workshopPage,
      hasMoreWorkshop,
      workshopLoading,
      loadingMoreRef: loadingMoreWorkshopRef,
      searchFunc: searchWorkshop
    };
  }, [workshopPage, hasMoreWorkshop, workshopLoading, searchWorkshop]);

  // Scroll listener mejorado con detección de fin de página
  useEffect(() => {
    if (favoritesOnly) {
      return undefined;
    }

    let scrollFrame = 0;
    let lastScrollTime = Date.now();
    let lastLoadTime = 0;
    const THROTTLE_MS = 150;
    const DEBOUNCE_LOAD_MS = 1500;
    let consecutiveSkips = 0;
    
    const checkShouldLoadMore = () => {
      const state = scrollStateRef.current;
      
      if (!state || !state.searchFunc) {
        console.warn('[Scroll] ⚠️ State o searchFunc no disponible');
        return false;
      }
      
      if (state.workshopLoading) {
        console.log('[Scroll] ⏳ Ya estamos cargando, skip');
        return false;
      }
      
      if (!state.hasMoreWorkshop) {
        console.log('[Scroll] ✅ No hay más wallpapers para cargar');
        return false;
      }
      
      if (state.loadingMoreRef?.current) {
        console.log('[Scroll] 🔄 Ya estamos cargando más, skip');
        return false;
      }
      
      // Detectar scroll al final
      const scrollElement = document.scrollingElement || document.documentElement;
      const scrollHeight = scrollElement.scrollHeight;
      const clientHeight = window.innerHeight;
      const scrollPosition = window.scrollY;
      const remainingHeight = scrollHeight - (scrollPosition + clientHeight);
      
      const shouldLoad = remainingHeight <= 1000;
      if (shouldLoad) {
        console.log(`[Scroll] 📍 Altura restante: ${remainingHeight}px (threshold: 1000px) → Cargando`);
        consecutiveSkips = 0;
      } else {
        consecutiveSkips++;
        if (consecutiveSkips % 5 === 0) { // Log cada 5 checks
          console.log(`[Scroll] 📏 Altura: ${remainingHeight}px (no cargar aún), checks sin cargar: ${consecutiveSkips}`);
        }
      }
      
      return shouldLoad;
    };
    
    const loadMore = () => {
      const now = Date.now();
      
      // Debounce: no cargar si hace menos de 1.5s que se hizo la última carga
      if (now - lastLoadTime < DEBOUNCE_LOAD_MS) {
        return;
      }
      
      if (!checkShouldLoadMore()) return;
      
      const state = scrollStateRef.current;
      if (!state || !state.searchFunc) {
        console.error('[Scroll] ERROR: No hay state o searchFunc!');
        return;
      }
      
      const nextPage = state.workshopPage + 1;
      
      // Evitar cargas duplicadas: si ya estamos cargando esta página, ignorar
      if (lastLoadedPageRef.current === nextPage) {
        console.log(`[Scroll] ⏭️ Página ${nextPage} ya fue solicitada, ignorando`);
        return;
      }

      // ANTES de cargar, guardar la posición del scroll
      lockScrollDuringLoad();
      
      lastLoadTime = now;
      lastLoadedPageRef.current = nextPage;
      console.log(`[Scroll] 📥 Cargando página ${nextPage}...`);
      state.loadingMoreRef.current = true;
      state.searchFunc(null, { page: nextPage, append: true });
    };
    
    const handleWindowScroll = () => {
      const now = Date.now();
      if (now - lastScrollTime < THROTTLE_MS) return;
      if (scrollFrame) return;
      
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = 0;
        lastScrollTime = Date.now();
        loadMore();
      });
    };

    // Log que el listener está activo
    console.log('[Scroll] ✅ Scroll listener agregado');
    window.addEventListener('scroll', handleWindowScroll, { passive: true });

    return () => {
      console.log('[Scroll] ❌ Scroll listener removido');
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      window.removeEventListener('scroll', handleWindowScroll);
    };
  }, [favoritesOnly]);

  // Intersection Observer fallback para detección de fin de página
  // Dep incluye visibleWorkshopWallpapers.length para que el observer se vuelva a
  // configurar cuando aparece el <div ref={loadMoreRef}> (que solo se monta
  // cuando hay items renderizados).
  useEffect(() => {
    if (favoritesOnly) {
      return undefined;
    }

    let observer = null;
    let cancelled = false;
    let retryRaf = 0;

    const setup = () => {
      if (cancelled || !loadMoreRef.current) return;
      console.log('[IntersectionObserver] ✅ Configurando observer (respaldo)');

      observer = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const state = scrollStateRef.current;

            if (!state?.hasMoreWorkshop || state?.workshopLoading || state?.loadingMoreRef?.current) {
              return;
            }

            const nextPage = state.workshopPage + 1;

            if (lastLoadedPageRef.current === nextPage) {
              console.log(`[IntersectionObserver] ⏭️ Página ${nextPage} ya fue solicitada`);
              return;
            }

            lockScrollDuringLoad();

            console.log(`[IntersectionObserver] 👁️ Usuario scrolleó al final, cargando página ${nextPage}...`);
            lastLoadedPageRef.current = nextPage;
            state.loadingMoreRef.current = true;
            state.searchFunc(null, { page: nextPage, append: true });
          });
        },
        {
          rootMargin: '500px',
          threshold: 0.1
        }
      );

      observer.observe(loadMoreRef.current);
    };

    if (!loadMoreRef.current) {
      // El <div ref={loadMoreRef}> aún no se montó; reintentar en el siguiente frame.
      retryRaf = window.requestAnimationFrame(setup);
      return () => {
        cancelled = true;
        window.cancelAnimationFrame(retryRaf);
      };
    }

    setup();

    return () => {
      console.log('[IntersectionObserver] ❌ Removiendo observer');
      cancelled = true;
      observer?.disconnect();
    };
  }, [favoritesOnly, workshopWallpapers.length]);

  const favoriteIds = useMemo(
    () => new Set(favorites.map(item => item.publishedFileId)),
    [favorites]
  );

  const downloadedById = useMemo(() => {
    const items = new Map();
    steamWallpapers.forEach(wallpaper => {
      const id = getWallpaperId(wallpaper);
      if (id) items.set(id, wallpaper);
    });
    return items;
  }, [steamWallpapers]);

  const getDownloadedWallpaper = useCallback(
    (wallpaper) => downloadedById.get(getWallpaperId(wallpaper)) || null,
    [downloadedById]
  );

  const matchesHeaderSearch = useCallback((wallpaper = {}) => {
    const normalizedQuery = String(searchQuery || '').trim().toLowerCase();
    
    // Búsqueda por texto (siempre tiene prioridad)
    if (normalizedQuery) {
      const searchableText = [
        wallpaper.title,
        wallpaper.author,
        wallpaper.authorName,
        wallpaper.creator,
        wallpaper.description,
        ...(Array.isArray(wallpaper.tags) ? wallpaper.tags : [])
      ].filter(Boolean).join(' ').toLowerCase();

      return searchableText.includes(normalizedQuery);
    }

    // Si no hay búsqueda de texto, aplicar filtros
    const tags = Array.isArray(wallpaper.tags) ? wallpaper.tags.map(tag => String(tag).toLowerCase()) : [];
    const wallpaperType = String(wallpaper.mediaType || wallpaper.type || '').toLowerCase();
    
    // Construir filtros requeridos (solo los que están activos)
    const requiredFilters = [
      workshopFilters.type,
      workshopFilters.genre,
      workshopFilters.assetType,
      workshopFilters.assetGenre,
      workshopFilters.scriptType,
      workshopFilters.ageRating
    ].filter(Boolean).map(value => String(value).toLowerCase());

    // Si hay filtros, aplicarlos
    if (requiredFilters.length > 0) {
      const tagMatches = requiredFilters.map(filterValue => (
        wallpaperType === filterValue || tags.includes(filterValue)
      ));
      
      // Usar OR (some) en lugar de AND (every) para ser más permisivo
      // Así mostramos wallpapers que coincidan con al menos UN filtro
      // en lugar de requerir que coincidan con TODOS
      const matchesTags = workshopFilters.matchAllTags === true
        ? tagMatches.every(Boolean)  // Requiere TODOS los filtros
        : tagMatches.some(Boolean);  // Requiere AL MENOS UN filtro

      // Si ningún tag coincide, mostrar el wallpaper de todas formas
      // (podría tener los metadatos mal configurados)
      if (!matchesTags && wallpaperType) {
        // Si tiene tipo pero no coincide, filtrar
        return false;
      }
    }

    return true;
  }, [
    searchQuery,
    workshopFilters.type,
    workshopFilters.genre,
    workshopFilters.assetType,
    workshopFilters.assetGenre,
    workshopFilters.scriptType,
    workshopFilters.ageRating,
    workshopFilters.matchAllTags
  ]);

  const activeFilterChips = useMemo(() => {
    const chips = getActiveWorkshopFilterChips(workshopFilters);
    const normalizedQuery = String(searchQuery || '').trim();

    if (normalizedQuery) {
      return [{ key: 'query', value: `Busqueda: ${normalizedQuery}` }, ...chips];
    }

    return chips;
  }, [
    searchQuery,
    workshopFilters.sort,
    workshopFilters.time,
    workshopFilters.type,
    workshopFilters.genre,
    workshopFilters.assetType,
    workshopFilters.assetGenre,
    workshopFilters.scriptType,
    workshopFilters.ageRating,
    workshopFilters.matchAllTags
  ]);

  // Filtrar wallpapers ya descargados de la lista del workshop
  const visibleFavoriteWallpapers = useMemo(() => (
    favorites.filter(wallpaper => matchesHeaderSearch(wallpaper))
  ), [favorites, matchesHeaderSearch]);

  const standardFavoriteCount = useMemo(() => (
    visibleFavoriteWallpapers.filter(wallpaper => !isMatureWallpaper(wallpaper)).length
  ), [visibleFavoriteWallpapers]);

  const matureFavoriteCount = useMemo(() => (
    visibleFavoriteWallpapers.filter(wallpaper => isMatureWallpaper(wallpaper)).length
  ), [visibleFavoriteWallpapers]);

  const activeFavoriteWallpapers = useMemo(() => {
    const filtered = visibleFavoriteWallpapers.filter(wallpaper => (
      favoriteContentTab === 'mature'
        ? showMatureContent && isMatureWallpaper(wallpaper)
        : !isMatureWallpaper(wallpaper)
    ));

    return sortFavoriteWallpapers(filtered, favoriteSortTab);
  }, [favoriteContentTab, favoriteSortTab, showMatureContent, visibleFavoriteWallpapers]);

  const visibleWorkshopWallpapers = useMemo(() => (
    favoritesOnly
      ? activeFavoriteWallpapers
      : workshopWallpapers.filter(wallpaper => (
        !downloadedById.has(getWallpaperId(wallpaper))
        && matchesHeaderSearch(wallpaper)
        && canShowWallpaper(wallpaper, showMatureContent)
      ))
  ), [favoritesOnly, activeFavoriteWallpapers, workshopWallpapers, downloadedById, matchesHeaderSearch, showMatureContent]);

  const toggleFavorite = useCallback((wallpaper) => {
    const wallpaperId = getWallpaperId(wallpaper) || wallpaper.publishedFileId || wallpaper.id;
    if (!wallpaperId) return;

    setFavorites(prev => {
      const exists = prev.some(item => (getWallpaperId(item) || item.publishedFileId || item.id) === wallpaperId);
      const nextFavorites = exists
        ? prev.filter(item => (getWallpaperId(item) || item.publishedFileId || item.id) !== wallpaperId)
        : [{ ...wallpaper, favoriteAddedAt: Date.now() }, ...prev];

      // Electron: persist via IPC (do NOT use localStorage as source of truth)
      if (window.electronAPI?.addFavorite && window.electronAPI?.removeFavorite) {
        (async () => {
          try {
            if (exists) {
              await window.electronAPI.removeFavorite(wallpaperId);
            } else {
              await window.electronAPI.addFavorite(wallpaper);
            }

            // Re-sincroniza SIEMPRE desde IPC para evitar cualquier desincronización.
            const result = await window.electronAPI.getFavorites?.();
            if (result?.success) setFavorites(Array.isArray(result.data) ? result.data : []);
          } catch (e) {
            console.error('[SteamIntegration] Error persisting favorite via IPC:', e);
          }
        })();
      } else {
        // Web fallback
        saveFavorites(nextFavorites);
      }

      // Sincroniza UI con otros componentes
      window.dispatchEvent(new CustomEvent('favorites-updated', {
        detail: { wallpaper, isFavorite: !exists }
      }));

      return nextFavorites;
    });
  }, []);

  const handleSubscribe = useCallback((authorId, isSubscribed, wallpaper = null) => {
    if (!authorId) return;
    setSubscriptions(current => updateAuthorSubscription(
      current,
      authorId,
      isSubscribed,
      wallpaper ? buildAuthorSubscriptionRecord(wallpaper, 'manual') : { source: 'manual' }
    ));
  }, []);

  const handleRefresh = useCallback(() => {
    loadSteamWallpapers();
    checkDownloaderStatus();
  }, []);

  const handleRetryWorkshop = useCallback(() => {
    console.log('[Workshop] Reintentando búsqueda manual...');
    searchWorkshop(null, { page: workshopPage, append: true });
  }, [workshopPage, searchWorkshop]);

  const handleClearCache = useCallback(() => {
    console.log('[SteamIntegration] Usuario solicita limpiar cache');
    clearCorruptedCache();
    
    // Reintentar búsqueda después de limpiar
    setTimeout(() => {
      console.log('[SteamIntegration] Reintentando después de limpiar cache');
      lastLoadedPageRef.current = 0; // Reset tracking para nueva búsqueda
      searchWorkshop(null, {
        query: searchQuery || '',
        filters: workshopFilters,
        page: 1,
        append: false
      });
    }, 500);
  }, [searchWorkshop, searchQuery, workshopFilters]);

  // Calcular datos para detalle si está abierto
  const downloadedDetailWallpaper = detailWallpaper ? getDownloadedWallpaper(detailWallpaper) : null;
  const activeDetailWallpaper = detailWallpaper ? mergeDownloadedWallpaper(detailWallpaper, downloadedDetailWallpaper) : null;
  const detailPool = detailWallpaper ? [
    ...workshopWallpapers,
    ...steamWallpapers,
    ...favorites
  ]
    .map((wallpaper) => enrichWallpaperMetadata(
      mergeDownloadedWallpaper(wallpaper, getDownloadedWallpaper(wallpaper)) || wallpaper
    ))
    .filter(wallpaper => canShowWallpaper(wallpaper, showMatureContent)) : [];
  
  const relatedWallpapers = activeDetailWallpaper ? sortSimilarWallpapers(activeDetailWallpaper, detailPool).slice(0, 12) : [];
  const directAuthorWallpapers = activeDetailWallpaper ? getAuthorWallpapers(activeDetailWallpaper, detailPool).slice(0, 12) : [];
  const authorWallpapers = directAuthorWallpapers && directAuthorWallpapers.length > 0
    ? directAuthorWallpapers
    : relatedWallpapers.slice(0, 8);

  // LIMPIEZA: Cancelar timers cuando el componente se desmonta
  useEffect(() => {
    return () => {
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
        cleanupTimeoutRef.current = null;
      }
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, []);

  const renderWallpaperGrid = useCallback((items) => (
    <WorkshopGrid
      items={items}
      downloadedById={downloadedById}
      favoriteIds={favoriteIds}
      downloadingId={downloadingId}
      deletingId={deletingId}
      downloaderReady={downloaderReady}
      onOpen={openDetailWallpaper}
      onDownload={downloadWorkshopWallpaper}
      onDelete={deleteWorkshopWallpaper}
      onRepair={repairWorkshopWallpaper}
      onToggleFavorite={toggleFavorite}
      isLoading={workshopLoading}
    />
  ), [downloadedById, favoriteIds, downloadingId, deletingId, downloaderReady, openDetailWallpaper, downloadWorkshopWallpaper, deleteWorkshopWallpaper, repairWorkshopWallpaper, toggleFavorite, workshopLoading]);

  // Auto-dismiss the loading screen after 10s to prevent infinite loading
  useEffect(() => {
    if (favoritesOnly) return undefined;
    // Start timeout when loading begins
    const isCurrentlyLoading = loading || workshopLoading;
    if (!isCurrentlyLoading) {
      // Loading finished, clear any pending timeout and reset
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      setLoadingTimedOut(false);
      return undefined;
    }

    if (loadingTimeoutRef.current) return undefined; // already counting

    loadingTimeoutRef.current = setTimeout(() => {
      loadingTimeoutRef.current = null;
      console.warn('[SteamIntegration] ⚠️ Loading screen auto-dismissed after 35s (safety)');
      setLoadingTimedOut(true);
    }, 35000);

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [favoritesOnly, loading, workshopLoading]);

  return (
    <>
      {!window.electronAPI ? (
        <div className="steam-integration-message">
          <i className="bi bi-pc-display"></i>
          <p>ℹ️ Esta sección requiere la versión de escritorio (.exe) de Wallpaper App</p>
          <p>Descarga la versión de escritorio para acceder a tus wallpapers de Steam</p>
        </div>
      ) : detailWallpaper ? (
        <div className="steam-integration">
          <WallpaperDetails
            wallpaper={activeDetailWallpaper}
            onClose={closeDetailWallpaper}
            onNavigate={navigateFromDetail}
            onDownload={downloadWorkshopWallpaper}
            onDelete={deleteWorkshopWallpaper}
            onRepair={repairWorkshopWallpaper}
            onToggleFavorite={toggleFavorite}
            onOpenAuthor={setSelectedAuthorId}
            onSubscribe={handleSubscribe}
            isDownloaded={Boolean(downloadedDetailWallpaper)}
            isFavorite={favoriteIds.has(getWallpaperId(detailWallpaper))}
            isSubscribed={Boolean(subscriptions[activeDetailWallpaper?.authorId || activeDetailWallpaper?.author])}
            isIncomplete={activeDetailWallpaper?.needsRepair === true}
            repairing={downloadingId === getWallpaperId(detailWallpaper)}
            deleting={deletingId === getWallpaperId(detailWallpaper)}
            downloaderReady={downloaderReady}
            relatedWallpapers={relatedWallpapers}
            authorWallpapers={authorWallpapers}
            onOpenRelated={openDetailWallpaper}
            sourceName={favoritesOnly ? 'Me gusta' : 'Workshop'}
            sourceIcon="steam"
            sourceTarget={favoritesOnly ? 'favorites' : 'steam'}
            showComments={true}
          />
          {selectedAuthorId && (
            <AuthorProfile
              authorId={selectedAuthorId}
              allWallpapers={[...steamWallpapers, ...workshopWallpapers, ...favorites].filter(wallpaper => canShowWallpaper(wallpaper, showMatureContent))}
              subscriptions={subscriptions}
              onClose={() => setSelectedAuthorId(null)}
              onSubscribe={handleSubscribe}
              onOpenWallpaper={openDetailWallpaper}
            />
          )}
        </div>
      ) : (
        <div className="steam-integration">
      <div className="steam-header">
        <div>
          <h2>
            {favoritesOnly ? (
              <>
                <i className="bi bi-heart-fill text-danger"></i>
                Wallpapers que te gustan
              </>
            ) : (
              <>
                <i className="bi bi-steam"></i>
                Wallapers de Steam Workshop
              </>
            )}
          </h2>
          {!favoritesOnly && (
            <p>
              <i className="bi bi-magic"></i>
                Aqui puedes explorar y descargar tus wallpapers de Steam Workshop sin salir de esta app.
            </p>
          )}
        </div>
        <div className="steam-controls">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="refresh-btn"
          >
            <i className={`bi ${loading ? 'bi-arrow-repeat spin-icon' : 'bi-arrow-clockwise'}`}></i>
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="steam-error">
          <i className="bi bi-exclamation-triangle-fill"></i>
          <div>
            <p>⚠️ {error}</p>
            <small>Asegúrate que Wallpaper Engine esté instalado en Steam</small>
          </div>
        </div>
      )}

      {!favoritesOnly && (
        <section className="workshop-panel">
          <div className="workshop-panel-header">
           
            {/* <span className={`downloader-status ${downloaderStatus?.hasDownloader ? 'ready' : 'missing'}`}>
              <i className={`bi bi-${downloaderStatus?.hasDownloader ? 'check-circle-fill' : 'exclamation-circle-fill'}`}></i>
              {downloaderStatus?.hasDownloader ? 'Listo para descargar' : 'Descarga no configurada'}
            </span> */}
          </div>

          {downloaderStatusChecked && !downloaderReady && (
            <div className="steam-error">
              <i className="bi bi-tools"></i>
              <div>
                <p>No encontré SteamCMD ni DepotDownloader para descargar wallpapers.</p>
                <small>Abre Configuración para revisar el diagnóstico.</small>
              </div>
            </div>
          )}

          {workshopError && (
            <div className="steam-error">
              <i className="bi bi-bug-fill"></i>
              <div>
                <p>{workshopError}</p>
                <small>Revisa Configuración para ver el log de diagnóstico.</small>
                <div style={{ marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button 
                    onClick={handleRetryWorkshop}
                    className="retry-btn"
                    style={{ padding: '8px 16px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    <i className="bi bi-arrow-clockwise"></i> Reintentar
                  </button>
                  <button 
                    onClick={handleClearCache}
                    className="retry-btn"
                    style={{ padding: '8px 16px', fontSize: '12px', cursor: 'pointer', background: '#ff6b6b' }}
                    title="Limpia el cache corrupto y reintenta"
                  >
                    <i className="bi bi-trash"></i> Limpiar Cache
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeFilterChips.length > 0 && (
            <div className={`workshop-active-filters ${workshopLoading ? 'refreshing' : ''}`} key={filterRefreshKey}>
              <span>
                <i className={`bi bi-${workshopLoading ? 'arrow-repeat spin-icon' : 'funnel-fill'}`}></i>
                {workshopLoading ? 'Actualizando resultados' : 'Filtros aplicados'}
              </span>
              <div>
                {activeFilterChips.map(chip => (
                  <em key={chip.key}>{chip.value}</em>
                ))}
              </div>
            </div>
          )}

          {!workshopLoading && !workshopError && visibleWorkshopWallpapers.length === 0 && (
            <div className="steam-empty workshop-empty">
              <i className="bi bi-inbox"></i>
              <p>No hay resultados con estos filtros</p>
              <small>{showMatureContent ? 'Prueba otro tipo, periodo u orden.' : 'Activa contenido maduro en Configuracion si quieres incluir resultados Mature.'}</small>
            </div>
          )}

          {visibleWorkshopWallpapers.length > 0 && (
            <>
              <div className="steam-stats workshop-stats">
                <div className="stats-left">
                  <i className={`bi bi-${workshopLoading ? 'arrow-repeat spin-icon' : 'grid-3x3-gap-fill'}`}></i>
                  <h3>Resultados</h3>
                </div>
                <div className="stats-right">
                  <i className="bi bi-database"></i>
                  <p>{workshopTotal.toLocaleString()} resultados encontrados</p>
                </div>
              </div>
              {renderWallpaperGrid(visibleWorkshopWallpapers)}
              {/* El ref debe estar siempre presente para que el observer pueda detectarlo */}
              <div ref={loadMoreRef} className="gallery-loader workshop-loader" style={{ visibility: hasMoreWorkshop ? 'visible' : 'hidden', height: hasMoreWorkshop ? 'auto' : '0' }}>
                {workshopLoading && (
                  <div style={{ padding: '20px', textAlign: 'center' }}>
                    <i className="bi bi-arrow-repeat spin-icon" style={{ fontSize: '24px', color: '#ff6b9d', marginRight: '10px' }}></i>
                    <span style={{ color: '#b0b0b0', fontSize: '14px' }}>Cargando más wallpapers...</span>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {favoritesOnly && (
        <section className="workshop-panel">
          {workshopError && (
            <div className="steam-error">
              <i className="bi bi-bug-fill"></i>
              <div>
                <p>{workshopError}</p>
                <small>Revisa Configuración para ver el log de diagnóstico.</small>
                <div style={{ marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button 
                    onClick={handleRetryWorkshop}
                    className="retry-btn"
                    style={{ padding: '8px 16px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    <i className="bi bi-arrow-clockwise"></i> Reintentar
                  </button>
                  <button 
                    onClick={handleClearCache}
                    className="retry-btn"
                    style={{ padding: '8px 16px', fontSize: '12px', cursor: 'pointer', background: '#ff6b6b' }}
                    title="Limpia el cache corrupto y reintenta"
                  >
                    <i className="bi bi-trash"></i> Limpiar Cache
                  </button>
                </div>
              </div>
            </div>
          )}
          {activeFilterChips.length > 0 && (
            <div className={`workshop-active-filters ${workshopLoading ? 'refreshing' : ''}`} key={filterRefreshKey}>
              <span>
                <i className={`bi bi-${workshopLoading ? 'arrow-repeat spin-icon' : 'funnel-fill'}`}></i>
                {workshopLoading ? 'Actualizando favoritos' : 'Filtros aplicados'}
              </span>
              <div>
                {activeFilterChips.map(chip => (
                  <em key={chip.key}>{chip.value}</em>
                ))}
              </div>
            </div>
          )}
          {visibleFavoriteWallpapers.length === 0 ? (
            <div className="steam-empty workshop-empty">
              <i className="bi bi-heart"></i>
              <p>{favorites.length === 0 ? 'No tienes wallpapers marcados con me gusta' : 'No hay favoritos con estos filtros'}</p>
              <small>{showMatureContent ? 'Marca wallpapers desde Steam Workshop para verlos aqui.' : 'El contenido Mature esta oculto desde Configuracion.'}</small>
            </div>
          ) : (
            <>
              <div className="steam-stats workshop-stats">
                <div className="stats-left">
                  <i className="bi bi-heart-fill text-danger"></i>
                  <h3>Me gusta</h3>
                </div>
                <div className="stats-right">
                  <i className="bi bi-collection"></i>
                  <p>{visibleFavoriteWallpapers.length} wallpapers marcados</p>
                </div>
              </div>
              <div className="favorites-toolbar">
                <div className="favorites-tabs content-tabs" role="tablist" aria-label="Tipo de contenido en Me gusta">
                  {FAVORITE_CONTENT_TABS.map(tab => {
                    const count = tab.value === 'mature' ? matureFavoriteCount : standardFavoriteCount;
                    const disabled = tab.value === 'mature' && !showMatureContent;

                    return (
                      <button
                        key={tab.value}
                        type="button"
                        className={favoriteContentTab === tab.value ? 'active' : ''}
                        onClick={() => setFavoriteContentTab(tab.value)}
                        disabled={disabled}
                      >
                        <i className={`bi ${tab.icon}`}></i>
                        <span>{tab.label}</span>
                        <em>{count}</em>
                      </button>
                    );
                  })}
                </div>

                <div className="favorites-tabs sort-tabs" role="tablist" aria-label="Ordenar Me gusta">
                  {FAVORITE_SORT_TABS.map(tab => (
                    <button
                      key={tab.value}
                      type="button"
                      className={favoriteSortTab === tab.value ? 'active' : ''}
                      onClick={() => setFavoriteSortTab(tab.value)}
                    >
                      <i className={`bi ${tab.icon}`}></i>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {visibleWorkshopWallpapers.length > 0 ? (
                renderWallpaperGrid(visibleWorkshopWallpapers)
              ) : (
                <div className="steam-empty workshop-empty favorites-tab-empty">
                  <i className={`bi bi-${favoriteContentTab === 'mature' ? 'shield-lock' : 'heart'}`}></i>
                  <p>No hay wallpapers en esta pestaña</p>
                  <small>{favoriteContentTab === 'mature' ? 'Activa o marca contenido maduro para verlo aqui.' : 'Tus me gusta normales apareceran ordenados por los mas recientes.'}</small>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {!favoritesOnly && !loading && steamWallpapers.length === 0 && !error && (
        <div className="steam-empty">
          <i className="bi bi-steam"></i>
          <p>No se encontraron wallpapers de Steam Wallpaper Engine</p>
          <small>Instala Wallpaper Engine desde Steam para ver tus wallpapers aquí</small>
        </div>
      )}

        </div>
      )}
    </>
  );
};

export default SteamIntegration;
