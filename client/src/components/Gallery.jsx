import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import WallpaperCard from './WallpaperCard';
import WallpaperDetails from './WallpaperDetails';
import AuthorProfile from './AuthorProfile';
import { getLocalWallpapers } from '../data/sampleWallpapers';
import { toPlayableUrl } from '../utils/mediaUrl';
import { downloadWallpaperAsset } from '../utils/downloadWallpaper';
import {
  enrichWallpaperMetadata,
  formatCompact,
  getAuthorInfo,
  getAuthorWallpapers,
  getPreviewUrl,
  getWallpaperId,
  isDownloadedWallpaper
} from '../utils/wallpaperMeta';
import { canShowWallpaper } from '../utils/contentPreferences';
import { applyWallpaperAccent } from '../utils/dynamicAccent';
import {
  buildAuthorSubscriptionRecord,
  isAuthorSubscribed,
  updateAuthorSubscription
} from '../utils/recommendationSignals';
import { fetchOnlineRecommendations } from '../utils/workshopRecommendations';
import { safeSetItem, safeGetItem } from '../utils/storageHelper';
import SkeletonLoader from './SkeletonLoader';
import '../styles/gallery.css';

const PAGE_SIZE = 24;

const Gallery = ({
  category = '',
  search = '',
  initialFeed = 'recent',
  showMatureContent = false
}) => {
  const [wallpapers, setWallpapers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedWallpaper, setSelectedWallpaper] = useState(null);
  const [selectedAuthorId, setSelectedAuthorId] = useState(null);
  const [subscriptions, setSubscriptions] = useState({});
  const [favorites, setFavorites] = useState([]);
  const [activeFeed, setActiveFeed] = useState(initialFeed);
  const [viewMode, setViewMode] = useState('grid');
  const [onlineRelatedWallpapers, setOnlineRelatedWallpapers] = useState([]);
  const observerTarget = useRef(null);
  const nextPageRef = useRef(1);
  const lastRequestedPageRef = useRef(0);
  const fetchWallpapersRef = useRef(null);
  const isFetchingRef = useRef(false);

  // Reserva de página para que el observer no pueda "desfasarse" con updates de estado
  const reservedPageRef = useRef(1);

  useEffect(() => {
    const loadAndSyncFavorites = async () => {
      try {
        // Electron (source of truth): favorites.json via IPC
        if (window.electronAPI?.getFavorites) {
          const result = await window.electronAPI.getFavorites();
          if (result?.success) {
            setFavorites(Array.isArray(result.data) ? result.data : []);
            return;
          }
        }

        // Web fallback
        const savedFavorites = safeGetItem('wallpaperApp.workshopFavorites', []);
        setFavorites(savedFavorites);
      } catch {
        setFavorites([]);
      }
    };

    (async () => {
      try {
        const savedSubscriptions = safeGetItem('wallpaperApp.subscriptions', {});
        setSubscriptions(savedSubscriptions);
      } catch {
        setSubscriptions({});
      }
      await loadAndSyncFavorites();
    })();

    window.addEventListener('favorites-updated', loadAndSyncFavorites);
    return () => window.removeEventListener('favorites-updated', loadAndSyncFavorites);
  }, []);

  useEffect(() => {
    setActiveFeed(initialFeed || 'recent');
  }, [initialFeed]);

  const handleSubscribe = useCallback((authorId, isSubscribed, wallpaper = null) => {
    if (!authorId) return;
    setSubscriptions(prev => {
      const updated = updateAuthorSubscription(
        prev,
        authorId,
        isSubscribed,
        wallpaper ? buildAuthorSubscriptionRecord(wallpaper, 'manual') : { source: 'manual' }
      );
      safeSetItem('wallpaperApp.subscriptions', updated);
      return updated;
    });
  }, []);

  const toggleFavorite = useCallback((wallpaper) => {
    const wallpaperId = getWallpaperId(wallpaper);

    // Debug: log que nos dice qué objeto viaja a IPC.
    // (si id es undefined, LocalStore puede no escribir como esperas)
    console.log('[Favorites] toggleFavorite wallpaperId=', wallpaperId, 'wallpaper=', wallpaper);
    console.log('[Favorites] IPC exists:', {
      electron: Boolean(window?.electronAPI),
      addFavorite: Boolean(window?.electronAPI?.addFavorite),
      removeFavorite: Boolean(window?.electronAPI?.removeFavorite),
      getFavorites: Boolean(window?.electronAPI?.getFavorites)
    });


    setFavorites(prev => {
      const exists = prev.some(item => getWallpaperId(item) === wallpaperId);
      const nextFavorites = exists
        ? prev.filter(item => getWallpaperId(item) !== wallpaperId)
        : [wallpaper, ...prev];

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
            // Fallback: intenta recargar igualmente
            try {
              const result = await window.electronAPI.getFavorites?.();
              if (result?.success) setFavorites(Array.isArray(result.data) ? result.data : []);
            } catch {}
          }
        })();
      } else {
        // Web fallback
        localStorage.setItem('wallpaperApp.workshopFavorites', JSON.stringify(nextFavorites));
      }

      // Sincroniza UI con WallpaperCard (listener legacy)
      window.dispatchEvent(new CustomEvent('favorites-updated', {
        detail: { wallpaper, isFavorite: !exists }
      }));

      return nextFavorites;
    });
  }, []);


  const isFavorite = useCallback((wallpaper) => (
    favorites.some(item => getWallpaperId(item) === getWallpaperId(wallpaper))
  ), [favorites]);

  const normalizeDesktopWallpaper = useCallback((wallpaper, index) => {
    const enriched = enrichWallpaperMetadata(wallpaper);
    const downloadUrl = wallpaper.downloadUrl || wallpaper.mediaUrl || wallpaper.playbackUrl || wallpaper.previewUrl;
    const mediaUrl = toPlayableUrl(wallpaper.playbackUrl || wallpaper.mediaUrl || wallpaper.previewUrl);
    const previewUrl = toPlayableUrl(wallpaper.previewUrl || wallpaper.playbackUrl || wallpaper.mediaUrl);
    const wallpaperId = wallpaper.publishedFileId || wallpaper.localPath || wallpaper.mediaUrl || `wallpaper-engine-${index}`;

    return enrichWallpaperMetadata({
      ...enriched,
      _id: wallpaperId,
      id: wallpaper.publishedFileId || wallpaper.localPath || `wallpaper-${index}`,
      publishedFileId: wallpaper.publishedFileId || `local-${index}`,
      downloadUrl,
      mediaUrl,
      playbackUrl: mediaUrl,
      previewUrl,
      fileSystemPath: wallpaper.mediaUrl || wallpaper.localPath || wallpaper.path,
      preview: { url: previewUrl },
      image: { url: previewUrl },
      imageUrl: previewUrl,
      thumbnailUrl: previewUrl,
      downloads: wallpaper.subscriptions || wallpaper.downloads || enriched.downloads || 0,
      subscriptions: wallpaper.subscriptions || wallpaper.downloads || enriched.subscriptions || 0,
      favorited: wallpaper.favorited || wallpaper.likes || enriched.favorited || 0,
      likes: wallpaper.favorited || wallpaper.likes || enriched.likes || 0,
      isSubscribed: Boolean(subscriptions[enriched.authorId || wallpaper.authorId]),
      mediaType: wallpaper.mediaType || enriched.mediaType || (wallpaper.playbackUrl?.match(/\.(mp4|webm|mov)/i) ? 'video' : 'image'),
      authorId: enriched.authorId || wallpaper.authorId || wallpaper.author,
      author: enriched.author || wallpaper.author,
      tags: wallpaper.tags?.length ? wallpaper.tags : enriched.tags || [],
      score: wallpaper.score || wallpaper.rating?.average || enriched.score || 0,
      url: wallpaper.url || wallpaper.localPath || wallpaper.playbackUrl || wallpaper.mediaUrl,
      timeCreated: wallpaper.timeCreated || wallpaper.uploadDate || enriched.timeCreated,
      timeUpdated: wallpaper.timeUpdated || wallpaper.updatedDate || enriched.timeUpdated,
      fileSize: wallpaper.fileSize || enriched.fileSize
    });
  }, [subscriptions]);

  const filterDesktopWallpapers = useCallback((items) => {
    const normalizedSearch = search.trim().toLowerCase();

    return items
      .filter(wallpaper => {
        if (!normalizedSearch) return true;

        return [
          wallpaper.title,
          wallpaper.description,
          wallpaper.author,
          wallpaper.localPath,
          wallpaper.tags?.join(' ')
        ].some(value => String(value || '').toLowerCase().includes(normalizedSearch));
      })
      .map((wallpaper, index) => normalizeDesktopWallpaper(wallpaper, index))
      .filter(wallpaper => canShowWallpaper(wallpaper, showMatureContent));
  }, [search, showMatureContent, normalizeDesktopWallpaper]);

  const fetchWallpapers = useCallback(async (pageNum = 1, reset = false) => {
    // Evita estados inconsistentes cuando IntersectionObserver dispara rápido
    if (loading) return;

    try {
      setLoading(true);

      if (window.electronAPI?.getDownloadedWallpapers || window.electronAPI?.getSteamWallpapers) {
        const result = window.electronAPI.getDownloadedWallpapers
          ? await window.electronAPI.getDownloadedWallpapers()
          : await window.electronAPI.getSteamWallpapers();

        if (!result.success) {
          setError(result.error || 'No se pudo leer la carpeta de descargas locales');
          setHasMore(false);
          return;
        }

        const filtered = filterDesktopWallpapers(result.data || []);
        const start = (pageNum - 1) * PAGE_SIZE;
        const nextPage = filtered.slice(start, start + PAGE_SIZE);

        // Si no hay elementos, marca hasMore=false para cortar el loader
        if (!Array.isArray(nextPage) || nextPage.length === 0) {
          setHasMore(false);
          setPage(pageNum);
          return;
        }

        setWallpapers(current => reset ? nextPage : [...current, ...nextPage]);
        setHasMore(start + PAGE_SIZE < filtered.length);
        setPage(pageNum);
        setError(null);
        return;
      }

      // Fallback a mock data si no hay Electron API
      const filtered = filterDesktopWallpapers(getLocalWallpapers() || []);
      const start = (pageNum - 1) * PAGE_SIZE;
      const nextPage = filtered.slice(start, start + PAGE_SIZE);

      if (!Array.isArray(nextPage) || nextPage.length === 0) {
        setHasMore(false);
        setPage(pageNum);
        return;
      }

      setWallpapers(current => reset ? nextPage : [...current, ...nextPage]);
      setHasMore(start + PAGE_SIZE < filtered.length);
      setPage(pageNum);
    } catch (err) {
      setPage(pageNum);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [category, search, filterDesktopWallpapers, showMatureContent, loading]);

  useEffect(() => {
    setPage(1);
    nextPageRef.current = 2;
    reservedPageRef.current = 1;
    lastRequestedPageRef.current = 0;
    isFetchingRef.current = false;

    setWallpapers([]);
    setHasMore(true);

    // Evita bucle: no dependemos de `fetchWallpapers` (que cambia por `loading`)
    // solo disparamos una vez por cambios de inputs reales.
    Promise.resolve().then(() => {
      fetchWallpapersRef.current?.(1, true);
    });
  }, [category, search]);


  // NOTE: intencionalmente NO recalculamos nextPageRef con [page].
  // El cálculo de la siguiente página se hace de forma consistente con reservedPageRef
  // para evitar bucles cuando el sentinel permanece intersectando.

  useEffect(() => {
    fetchWallpapersRef.current = fetchWallpapers;
  }, [fetchWallpapers]);

  useEffect(() => {
    if (!hasMore) return undefined;

    let cancelled = false;

    const observer = new IntersectionObserver(
      entries => {
        if (cancelled) return;
        if (!entries?.[0]?.isIntersecting) return;
        if (loading) return;
        if (!hasMore) return;
        if (isFetchingRef.current) return;

        const nextPage = reservedPageRef.current;

        // Anti-bucle adicional:
        if (!nextPage || nextPage === lastRequestedPageRef.current) return;

        // Reservar inmediatamente para que, aunque el sentinel siga visible,
        // no volvamos a solicitar la misma página.
        const reservedBefore = reservedPageRef.current;
        reservedPageRef.current = nextPage + 1;
        lastRequestedPageRef.current = nextPage;

        if (typeof fetchWallpapersRef.current !== 'function') return;

        isFetchingRef.current = true;

        Promise.resolve(fetchWallpapersRef.current(nextPage))
          .catch(() => {
            // Si falla la carga, permitimos volver a intentar esa misma página
            reservedPageRef.current = reservedBefore;
          })
          .finally(() => {
            isFetchingRef.current = false;
          });
      },
      { threshold: 0.1, rootMargin: '300px' }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) observer.observe(currentTarget);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [hasMore, loading]);


  const handleOpenDetails = (wallpaper) => {
    const enriched = enrichWallpaperMetadata(wallpaper);
    applyWallpaperAccent(enriched);
    setSelectedWallpaper(enriched);
  };

  const handleOpenAuthor = (authorId) => {
    setSelectedAuthorId(authorId);
  };

  const handleRepair = async (wallpaper) => {
    try {
      const result = await downloadWallpaperAsset(wallpaper);
      alert(`Wallpaper "${wallpaper.title}" reparado correctamente${result.fileName ? `: ${result.fileName}` : ''}`);
    } catch (repairError) {
      alert(`Error al reparar: ${repairError.message}`);
    }
  };

  const handleDelete = (wallpaper) => {
    const wallpaperId = String(wallpaper.publishedFileId || '');

    if (window.electronAPI?.deleteWorkshopWallpaper && /^\d+$/.test(wallpaperId)) {
      if (!confirm(`Estas seguro de que deseas eliminar "${wallpaper.title}"?`)) return;

      window.electronAPI.deleteWorkshopWallpaper({ publishedFileId: wallpaperId }).then(result => {
        if (result.success) {
          setWallpapers(prev => prev.filter(w => getWallpaperId(w) !== getWallpaperId(wallpaper)));
          if (selectedWallpaper && getWallpaperId(selectedWallpaper) === getWallpaperId(wallpaper)) {
            setSelectedWallpaper(null);
          }
          alert(`Wallpaper "${wallpaper.title}" eliminado`);
        } else {
          alert(`Error al eliminar: ${result.error}`);
        }
      });
      return;
    }

    if (!window.electronAPI?.deleteWallpaperFile || !wallpaper.localPath) {
      alert(`No puedo eliminar "${wallpaper.title}" porque no tiene una ruta local valida.`);
      return;
    }

    if (!confirm(`Estas seguro de que deseas eliminar "${wallpaper.title}"?`)) return;

    window.electronAPI.deleteWallpaperFile(wallpaper).then(result => {
      if (result.success) {
        setWallpapers(prev => prev.filter(w => getWallpaperId(w) !== getWallpaperId(wallpaper)));
        if (selectedWallpaper && getWallpaperId(selectedWallpaper) === getWallpaperId(wallpaper)) {
          setSelectedWallpaper(null);
        }
        alert(`Wallpaper "${wallpaper.title}" eliminado`);
      } else {
        alert(`Error al eliminar: ${result.error}`);
      }
    });
  };

  const getMoreFromAuthor = useCallback((currentWallpaper) => (
    getAuthorWallpapers(currentWallpaper, wallpapers).slice(0, 12)
  ), [wallpapers]);

  useEffect(() => {
    if (!selectedWallpaper) {
      setOnlineRelatedWallpapers([]);
      return undefined;
    }

    let active = true;

    const loadOnlineRelated = async () => {
      const items = await fetchOnlineRecommendations({
        wallpaper: selectedWallpaper,
        limit: 12,
        showMatureContent
      });

      if (active) {
        setOnlineRelatedWallpapers(items);
      }
    };

    setOnlineRelatedWallpapers([]);
    loadOnlineRelated();

    return () => {
      active = false;
    };
  }, [selectedWallpaper, showMatureContent]);

  const galleryStats = useMemo(() => {
    const totals = wallpapers.reduce((acc, wallpaper) => ({
      downloads: acc.downloads + Number(wallpaper.downloads || wallpaper.subscriptions || 0),
      likes: acc.likes + Number(wallpaper.likes || wallpaper.favorited || 0)
    }), { downloads: 0, likes: 0 });

    const authors = new Set(wallpapers.map(wallpaper => wallpaper.authorId || wallpaper.author).filter(Boolean));

    return {
      wallpapers: wallpapers.length,
      authors: authors.size,
      downloads: totals.downloads,
      likes: totals.likes
    };
  }, [wallpapers]);

  const featuredAuthors = useMemo(() => {
    const authorMap = new Map();

    wallpapers.forEach(wallpaper => {
      const authorId = wallpaper.authorId || wallpaper.author || 'Autor';
      const authorInfo = getAuthorInfo(wallpaper);
      const current = authorMap.get(authorId) || {
        id: authorId,
        name: authorInfo?.name || wallpaper.author || authorId,
        handle: authorInfo?.handle || `@${String(authorId).slice(0, 14)}`,
        followers: authorInfo?.followers || 0,
        preview: getPreviewUrl(wallpaper),
        count: 0,
        likes: 0
      };

      current.count += 1;
      current.likes += Number(wallpaper.likes || wallpaper.favorited || 0);
      if (!current.preview) current.preview = getPreviewUrl(wallpaper);
      authorMap.set(authorId, current);
    });

    return [...authorMap.values()]
      .sort((left, right) => (right.followers + right.likes) - (left.followers + left.likes))
      .slice(0, 6);
  }, [wallpapers]);

  const sortedWallpapers = useMemo(() => {
    const sorted = [...wallpapers];

    if (activeFeed === 'popular') {
      sorted.sort((left, right) => Number(right.likes || right.favorited || 0) - Number(left.likes || left.favorited || 0));
    } else if (activeFeed === 'downloads') {
      sorted.sort((left, right) => Number(right.downloads || right.subscriptions || 0) - Number(left.downloads || left.subscriptions || 0));
    } else {
      sorted.sort((left, right) => Number(new Date(right.timeCreated || 0)) - Number(new Date(left.timeCreated || 0)));
    }

    return sorted;
  }, [activeFeed, wallpapers]);

  const heroWallpaper = sortedWallpapers[0] || wallpapers[0];
  const heroPreview = heroWallpaper ? getPreviewUrl(heroWallpaper) : '';

  if (error) {
    return (
      <div className="gallery-error">
        <i className="bi bi-exclamation-triangle-fill"></i>
        <p>{error}</p>
        <button onClick={() => fetchWallpapers(1, true)} className="retry-btn">
          <i className="bi bi-arrow-repeat"></i> Reintentar
        </button>
      </div>
    );
  }

  if (selectedWallpaper) {
    const relatedWallpapers = onlineRelatedWallpapers;
    const directAuthorWallpapers = getMoreFromAuthor(selectedWallpaper);
    const authorWallpapers = directAuthorWallpapers.length > 0
      ? directAuthorWallpapers
      : relatedWallpapers.slice(0, 8);
    const isWallpaperDownloaded = isDownloadedWallpaper(selectedWallpaper);
    const isWorkshopWallpaper = Boolean(
      selectedWallpaper.fromSteam
      || selectedWallpaper.installed
      || /^\d+$/.test(String(selectedWallpaper.publishedFileId || ''))
    );

    return (
      <div className="gallery">
        <WallpaperDetails
          wallpaper={selectedWallpaper}
          onClose={() => setSelectedWallpaper(null)}
          onDownload={handleRepair}
          onDelete={handleDelete}
          onToggleFavorite={toggleFavorite}
          onOpenAuthor={handleOpenAuthor}
          onSubscribe={handleSubscribe}
          isDownloaded={isWallpaperDownloaded}
          isFavorite={isFavorite(selectedWallpaper)}
          isSubscribed={isAuthorSubscribed(subscriptions[selectedWallpaper.authorId])}
          repairing={false}
          deleting={false}
          downloaderReady={true}
          relatedWallpapers={relatedWallpapers}
          authorWallpapers={authorWallpapers}
          onOpenRelated={handleOpenDetails}
          sourceName={isWorkshopWallpaper ? 'Workshop' : 'Galeria local'}
          sourceIcon={isWorkshopWallpaper ? 'steam' : 'hdd-stack'}
        />

        {selectedAuthorId && (
          <AuthorProfile
            authorId={selectedAuthorId}
            allWallpapers={wallpapers}
            subscriptions={subscriptions}
            onClose={() => setSelectedAuthorId(null)}
            onSubscribe={handleSubscribe}
            onOpenWallpaper={handleOpenDetails}
          />
        )}
      </div>
    );
  }

  return (
    <div className="gallery">
      {wallpapers.length === 0 && !loading ? (
        <div className="gallery-empty">
          <i className="bi bi-images"></i>
          <p>No hay wallpapers disponibles</p>
          {search && <small>Intenta con otra busqueda</small>}
        </div>
      ) : (
        <>
          <section
            className="gallery-hero"
            style={heroPreview ? { '--gallery-hero-image': `url("${heroPreview}")` } : undefined}
          >
            <div className="gallery-hero-content">
              <h2>Wallpaper Gallery</h2>
              <p>Descubre miles de wallpapers increibles</p>

              <div className="gallery-hero-stats">
                <span><i className="bi bi-image"></i><strong>{formatCompact(galleryStats.wallpapers)}</strong><small>Wallpapers</small></span>
                <span><i className="bi bi-people"></i><strong>{formatCompact(galleryStats.authors)}</strong><small>Autores</small></span>
                <span><i className="bi bi-download"></i><strong>{formatCompact(galleryStats.downloads)}</strong><small>Descargas</small></span>
                <span><i className="bi bi-heart"></i><strong>{formatCompact(galleryStats.likes)}</strong><small>Me gusta</small></span>
              </div>

              <div className="gallery-hero-actions">
                <button type="button" onClick={() => window.scrollTo({ top: 360, behavior: 'smooth' })}>
                  <i className="bi bi-compass"></i> Explorar
                </button>
                <button type="button" onClick={() => setActiveFeed('popular')}>
                  <i className="bi bi-fire"></i> Mas populares
                </button>
              </div>
            </div>
          </section>

          <div className="gallery-toolbar">
            <div className="gallery-feed-tabs" aria-label="Orden rapido">
              <button type="button" className={activeFeed === 'recent' ? 'active' : ''} onClick={() => setActiveFeed('recent')}>Mas recientes</button>
              <button type="button" className={activeFeed === 'popular' ? 'active' : ''} onClick={() => setActiveFeed('popular')}>Populares</button>
              <button type="button" className={activeFeed === 'downloads' ? 'active' : ''} onClick={() => setActiveFeed('downloads')}>Mas descargados</button>
            </div>

            <div className="gallery-filter-controls">
              <div className="gallery-view-toggle">
                <button type="button" className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} aria-label="Vista grid">
                  <i className="bi bi-grid-3x3-gap-fill"></i>
                </button>
                <button type="button" className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} aria-label="Vista lista">
                  <i className="bi bi-list-ul"></i>
                </button>
              </div>
            </div>
          </div>

          {search && (
            <div className="gallery-search-note">
              <i className="bi bi-search"></i>
              <span>Buscando: "{search}"</span>
            </div>
          )}

          {featuredAuthors.length > 0 && (
            <section className="featured-authors">
              <button
                type="button"
                className="featured-authors-title"
                onClick={() => document.querySelector('.featured-authors-row')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              >
                Autores destacados <i className="bi bi-chevron-right"></i>
              </button>
              <div className="featured-authors-row">
                {featuredAuthors.map(author => (
                  <button
                    key={author.id}
                    type="button"
                    className="featured-author-card"
                    onClick={() => handleOpenAuthor(author.id)}
                  >
                    <span className="featured-author-avatar">
                      {author.preview ? <img src={author.preview} alt={author.name} /> : author.name.slice(0, 2)}
                    </span>
                    <span>
                      <strong>{author.name}</strong>
                      <small>{author.handle}</small>
                      <em>{formatCompact(author.followers || author.likes || author.count)} seguidores</em>
                    </span>
                    <i className="bi bi-patch-check-fill"></i>
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className={`gallery-grid ${viewMode === 'list' ? 'list' : ''}`}>
            {sortedWallpapers.map(wallpaper => (
              <WallpaperCard
                key={wallpaper._id || wallpaper.id}
                wallpaper={wallpaper}
                onOpenDetails={handleOpenDetails}
                onOpenAuthor={handleOpenAuthor}
                onRepair={handleRepair}
                onDelete={handleDelete}
                onSubscribe={handleSubscribe}
                isFavorite={isFavorite(wallpaper)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>

          {hasMore && (
            <>
              {loading && (
                <div className="gallery-skeleton-loader">
                  <SkeletonLoader count={6} variant="card" />
                </div>
              )}
              <div ref={observerTarget} className="gallery-loader">
                {loading ? (
                  <>
                    <i className="bi bi-arrow-repeat spin-icon"></i>
                    <span>Cargando mas wallpapers...</span>
                  </>
                ) : (
                  <span>Desplazate para cargar mas</span>
                )}
              </div>
            </>
          )}

        </>
      )}

      {selectedAuthorId && (
        <AuthorProfile
          authorId={selectedAuthorId}
          allWallpapers={wallpapers}
          subscriptions={subscriptions}
          onClose={() => setSelectedAuthorId(null)}
          onSubscribe={handleSubscribe}
          onOpenWallpaper={handleOpenDetails}
        />
      )}
    </div>
  );
};

export default Gallery;
