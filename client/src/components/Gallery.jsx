import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import WallpaperCard from './WallpaperCard';
import WallpaperDetails from './WallpaperDetails';
import AuthorProfile from './AuthorProfile';
import { wallpapersUrl } from '../services/api';
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

  useEffect(() => {
    try {
      const savedSubscriptions = safeGetItem('wallpaperApp.subscriptions', {});
      const savedFavorites = safeGetItem('wallpaperApp.workshopFavorites', []);
      setSubscriptions(savedSubscriptions);
      setFavorites(savedFavorites);
    } catch {
      setSubscriptions({});
      setFavorites([]);
    }
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
    setFavorites(prev => {
      const exists = prev.some(item => getWallpaperId(item) === getWallpaperId(wallpaper));
      const nextFavorites = exists
        ? prev.filter(item => getWallpaperId(item) !== getWallpaperId(wallpaper))
        : [wallpaper, ...prev];

      localStorage.setItem('wallpaperApp.workshopFavorites', JSON.stringify(nextFavorites));
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

        setWallpapers(current => reset ? nextPage : [...current, ...nextPage]);
        setHasMore(start + PAGE_SIZE < filtered.length);
        setPage(pageNum);
        setError(null);
        return;
      }

      const params = new URLSearchParams({ page: pageNum, limit: PAGE_SIZE });
      if (category) params.append('category', category);
      if (search) params.append('search', search);

      const response = await axios.get(wallpapersUrl(`?${params}`));
      const nextItems = (response.data.data || [])
        .map(enrichWallpaperMetadata)
        .filter(wallpaper => canShowWallpaper(wallpaper, showMatureContent));

      setWallpapers(current => reset ? nextItems : [...current, ...nextItems]);
      setHasMore(response.data.pagination.page < response.data.pagination.pages);
      setPage(pageNum);
      setError(null);
    } catch (err) {
      console.error('Error fetching wallpapers:', err);
      const fallback = getLocalWallpapers({ page: pageNum, limit: PAGE_SIZE, category, search });
      const nextItems = fallback.data
        .map(enrichWallpaperMetadata)
        .filter(wallpaper => canShowWallpaper(wallpaper, showMatureContent));

      setWallpapers(current => reset ? nextItems : [...current, ...nextItems]);
      setHasMore(fallback.pagination.page < fallback.pagination.pages);
      setPage(pageNum);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [category, search, filterDesktopWallpapers, showMatureContent]);

  useEffect(() => {
    setPage(1);
    nextPageRef.current = 2;
    setWallpapers([]);
    fetchWallpapers(1, true);
  }, [category, search, fetchWallpapers]);

  useEffect(() => {
    nextPageRef.current = page + 1;
  }, [page]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          // Usar nextPageRef.current directamente en lugar de fetchWallpapers
          const currentFetch = fetchWallpapers;
          if (currentFetch && nextPageRef.current) {
            currentFetch(nextPageRef.current);
          }
        }
      },
      { threshold: 0.1, rootMargin: '1500px' }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
      observer.disconnect();
    };
  }, [hasMore, loading, fetchWallpapers]);

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
