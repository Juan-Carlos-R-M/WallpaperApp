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
import '../styles/steam-integration.css';
// Importar Bootstrap Icons (asegúrate de tener instalado: npm install bootstrap-icons)
import 'bootstrap-icons/font/bootstrap-icons.css';
import WallpaperDetails from './WallpaperDetails';
import AuthorProfile from './AuthorProfile';
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
  mergeDownloadedWallpaper,
  shouldShowDownloadConfirmation,
  sortFavoriteWallpapers
} from '../features/steamWorkshop/workshopUtils';

export { DEFAULT_WORKSHOP_FILTERS, DOWNLOAD_CONFIRMATION_STORAGE_KEY };

const loadFavorites = () => {
  return loadFavoriteWallpapers();
};

const saveFavorites = (favorites) => {
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
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
  const loadMoreRef = useRef(null);
  const listScrollYRef = useRef(0);

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
    deleteWorkshopWallpaper
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

  const openDetailWallpaper = useCallback((wallpaper) => {
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

  useEffect(() => {
    saveFavorites(favorites);
  }, [favorites]);

  useEffect(() => {
    saveAuthorSubscriptions(subscriptions);
  }, [subscriptions]);

  useEffect(() => {
    if (!showMatureContent && favoriteContentTab === 'mature') {
      setFavoriteContentTab('normal');
    }
  }, [favoriteContentTab, showMatureContent]);

  const requestNextPageRef = useRef(() => {});
  requestNextPageRef.current = () => {
    if (
      favoritesOnly
      || !hasMoreWorkshop
      || workshopLoading
      || loadingMoreWorkshopRef.current
    ) {
      return;
    }
    loadingMoreWorkshopRef.current = true;
    searchWorkshop(null, { page: workshopPage + 1, append: true });
  };

  useEffect(() => {
    if (favoritesOnly) return undefined;

    let scrollFrame = 0;
    const handleWindowScroll = () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = 0;
        const scrollElement = document.scrollingElement || document.documentElement;
        const remaining = scrollElement.scrollHeight - window.innerHeight - window.scrollY;
        if (remaining <= 1200) {
          requestNextPageRef.current();
        }
      });
    };

    const observer = new IntersectionObserver(() => {
      requestNextPageRef.current();
    }, { rootMargin: '1000px 0px' });

    const node = loadMoreRef.current;
    if (node) {
      observer.observe(node);
    }
    window.addEventListener('scroll', handleWindowScroll, { passive: true });

    return () => {
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      observer.disconnect();
      window.removeEventListener('scroll', handleWindowScroll);
    };
  }, [favoritesOnly, searchQuery, JSON.stringify(workshopFilters), showMatureContent]);

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
    const tags = Array.isArray(wallpaper.tags) ? wallpaper.tags.map(tag => String(tag).toLowerCase()) : [];
    const wallpaperType = String(wallpaper.mediaType || wallpaper.type || '').toLowerCase();
    const requiredFilters = [
      workshopFilters.type,
      workshopFilters.genre,
      workshopFilters.assetType,
      workshopFilters.assetGenre,
      workshopFilters.scriptType,
      workshopFilters.ageRating
    ].filter(Boolean).map(value => String(value).toLowerCase());

    if (requiredFilters.length > 0) {
      const tagMatches = requiredFilters.map(filterValue => (
        wallpaperType === filterValue || tags.includes(filterValue)
      ));
      const matchesTags = workshopFilters.matchAllTags === false
        ? tagMatches.some(Boolean)
        : tagMatches.every(Boolean);

      if (!matchesTags) return false;
    }

    if (!normalizedQuery) return true;

    const searchableText = [
      wallpaper.title,
      wallpaper.author,
      wallpaper.authorName,
      wallpaper.description,
      ...(Array.isArray(wallpaper.tags) ? wallpaper.tags : [])
    ].filter(Boolean).join(' ').toLowerCase();

    return searchableText.includes(normalizedQuery);
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

  const visibleWorkshopWallpapers = favoritesOnly
    ? activeFavoriteWallpapers
    : workshopWallpapers.filter(wallpaper => (
      !downloadedById.has(getWallpaperId(wallpaper))
      && matchesHeaderSearch(wallpaper)
      && canShowWallpaper(wallpaper, showMatureContent)
    ));

  const toggleFavorite = useCallback((wallpaper) => {
    setFavorites(current => {
      if (current.some(item => item.publishedFileId === wallpaper.publishedFileId)) {
        return current.filter(item => item.publishedFileId !== wallpaper.publishedFileId);
      }

      recordWallpaperInteraction(wallpaper, 'like');
      return [{ ...wallpaper, favoriteAddedAt: Date.now() }, ...current];
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

  if (!window.electronAPI) {
    return (
      <div className="steam-integration-message">
        <i className="bi bi-pc-display"></i>
        <p>ℹ️ Esta sección requiere la versión de escritorio (.exe) de Wallpaper App</p>
        <p>Descarga la versión de escritorio para acceder a tus wallpapers de Steam</p>
      </div>
    );
  }

if (detailWallpaper) {
  const downloadedDetailWallpaper = getDownloadedWallpaper(detailWallpaper);
  const activeDetailWallpaper = mergeDownloadedWallpaper(detailWallpaper, downloadedDetailWallpaper);
  const detailPool = [
    ...workshopWallpapers,
    ...steamWallpapers,
    ...favorites
  ]
    .map((wallpaper) => enrichWallpaperMetadata(
      mergeDownloadedWallpaper(wallpaper, getDownloadedWallpaper(wallpaper)) || wallpaper
    ))
    .filter(wallpaper => canShowWallpaper(wallpaper, showMatureContent));
  const relatedWallpapers = sortSimilarWallpapers(activeDetailWallpaper, detailPool).slice(0, 12);
  const directAuthorWallpapers = getAuthorWallpapers(activeDetailWallpaper, detailPool).slice(0, 12);
  const authorWallpapers = directAuthorWallpapers.length > 0
    ? directAuthorWallpapers
    : relatedWallpapers.slice(0, 8);

  return (
    <div className="steam-integration">
        <WallpaperDetails
        wallpaper={activeDetailWallpaper}
        onClose={closeDetailWallpaper}
        onNavigate={navigateFromDetail}
        onDownload={downloadWorkshopWallpaper}
        onDelete={deleteWorkshopWallpaper}
        onToggleFavorite={toggleFavorite}
        onOpenAuthor={setSelectedAuthorId}
        onSubscribe={handleSubscribe}
        isDownloaded={Boolean(downloadedDetailWallpaper)}
        isFavorite={favoriteIds.has(getWallpaperId(detailWallpaper))}
        isSubscribed={Boolean(subscriptions[activeDetailWallpaper.authorId || activeDetailWallpaper.author])}
        repairing={downloadingId === getWallpaperId(detailWallpaper)}
        deleting={deletingId === getWallpaperId(detailWallpaper)}
        downloaderReady={Boolean(downloaderStatus?.hasDownloader)}
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
  );
}
  const renderWallpaperGrid = (items) => (
    <WorkshopGrid
      items={items}
      downloadedById={downloadedById}
      favoriteIds={favoriteIds}
      downloadingId={downloadingId}
      deletingId={deletingId}
      downloaderReady={Boolean(downloaderStatus?.hasDownloader)}
      onOpen={openDetailWallpaper}
      onDownload={downloadWorkshopWallpaper}
      onDelete={deleteWorkshopWallpaper}
      onToggleFavorite={toggleFavorite}
    />
  );

  return (
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

          {!downloaderStatus?.hasDownloader && (
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
              {!favoritesOnly && hasMoreWorkshop && (
                <div ref={loadMoreRef} className="gallery-loader workshop-loader">
                  <i className="bi bi-arrow-repeat spin-icon"></i>
                  {workshopLoading ? 'Cargando más wallpapers...' : 'Desplázate para cargar más wallpapers'}
                </div>
              )}
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

      {!favoritesOnly && loading && (
        <div className="steam-loading">
          <i className="bi bi-arrow-repeat spin-icon"></i>
          <p>Cargando wallpapers...</p>
        </div>
      )}

      {!favoritesOnly && !loading && steamWallpapers.length === 0 && !error && (
        <div className="steam-empty">
          <i className="bi bi-steam"></i>
          <p>No se encontraron wallpapers de Steam Wallpaper Engine</p>
          <small>Instala Wallpaper Engine desde Steam para ver tus wallpapers aquí</small>
        </div>
      )}

    </div>
  );
};

export default SteamIntegration;
