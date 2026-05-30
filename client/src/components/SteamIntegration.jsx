import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toPlayableUrl } from '../utils/mediaUrl';
import '../styles/steam-integration.css';

const FILTER_STORAGE_KEY = 'wallpaperApp.workshopFilters';
export const FAVORITES_STORAGE_KEY = 'wallpaperApp.workshopFavorites';
export const DOWNLOAD_CONFIRMATION_STORAGE_KEY = 'wallpaperApp.showDownloadConfirmation';
const USERNAME_STORAGE_KEY = 'wallpaperApp.steamUsername';
const ACCOUNTS_STORAGE_KEY = 'wallpaperApp.steamAccounts';
const DEFAULT_STEAM_USERNAME = 'adgjl1182';
const DEFAULT_FILTERS = {
  sort: 'trend',
  time: 'all',
  type: ''
};
const PAGE_SIZE = 18;

const loadSavedFilters = () => {
  try {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY);
    return saved ? { ...DEFAULT_FILTERS, ...JSON.parse(saved) } : DEFAULT_FILTERS;
  } catch {
    return DEFAULT_FILTERS;
  }
};

const TYPE_TAGS = [
  { value: '', label: 'Todos los tipos' },
  { value: 'Scene', label: 'Escena' },
  { value: 'Video', label: 'Video' },
  { value: 'Web', label: 'Web' },
  { value: 'Application', label: 'Aplicacion' }
];

const loadFavorites = () => {
  try {
    const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const saveFavorites = (favorites) => {
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
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

const getRequiredTags = (nextFilters) => nextFilters.type ? [nextFilters.type] : [];

const shouldShowDownloadConfirmation = () => (
  localStorage.getItem(DOWNLOAD_CONFIRMATION_STORAGE_KEY) !== 'false'
);

const formatCompact = (value = 0) => {
  const number = Number(value || 0);
  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(1)}K`;
  return number.toLocaleString();
};

const formatDate = (timestamp) => {
  if (!timestamp) return 'Sin dato';
  return new Date(timestamp * 1000).toLocaleDateString();
};

const isVideoWallpaper = (wallpaper = {}) => {
  const mediaUrl = [wallpaper.playbackUrl, wallpaper.mediaUrl, wallpaper.localPath].filter(Boolean).join(' ');
  return String(wallpaper.mediaType || '').toLowerCase() === 'video' || /\.(mp4|webm|mov|m4v|avi|mkv)(\?|#|$)/i.test(mediaUrl);
};

const isSceneWallpaper = (wallpaper = {}) => (
  ['scene', 'web', 'application'].includes(String(wallpaper.mediaType || '').toLowerCase())
);

const getWallpaperId = (wallpaper = {}) => String(wallpaper.publishedFileId || '');

const mergeDownloadedWallpaper = (workshopWallpaper = {}, downloadedWallpaper = null) => {
  if (!downloadedWallpaper) return workshopWallpaper;

  return {
    ...workshopWallpaper,
    ...downloadedWallpaper,
    publishedFileId: getWallpaperId(workshopWallpaper) || getWallpaperId(downloadedWallpaper),
    title: workshopWallpaper.title || downloadedWallpaper.title,
    author: workshopWallpaper.author || downloadedWallpaper.author,
    description: workshopWallpaper.description || downloadedWallpaper.description,
    tags: workshopWallpaper.tags?.length ? workshopWallpaper.tags : downloadedWallpaper.tags,
    previewUrl: downloadedWallpaper.previewUrl || workshopWallpaper.previewUrl,
    fileSize: workshopWallpaper.fileSize || downloadedWallpaper.fileSize,
    subscriptions: workshopWallpaper.subscriptions,
    favorited: workshopWallpaper.favorited,
    score: workshopWallpaper.score,
    url: workshopWallpaper.url
  };
};

const formatPlaybackTime = (seconds = 0) => {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const rest = Math.floor(safeSeconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
};

const WorkshopDetailScreen = ({
  wallpaper,
  relatedWallpapers,
  isFavorite,
  isDownloaded,
  downloadingId,
  deletingId,
  downloaderReady,
  onBack,
  onOpen,
  onDownload,
  onDelete,
  onToggleFavorite
}) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const tags = wallpaper.tags?.length ? wallpaper.tags.slice(0, 6) : ['Workshop', 'Wallpaper Engine'];
  const wallpaperId = getWallpaperId(wallpaper);
  const videoUrl = wallpaper.mediaType === 'video' && (wallpaper.playbackUrl || wallpaper.mediaUrl)
    ? toPlayableUrl(wallpaper.playbackUrl || wallpaper.mediaUrl)
    : '';
  const progress = duration ? Math.min(100, (currentTime / duration) * 100) : 0;
  const details = [
    ['Tipo', tags[0] || 'Workshop'],
    ['Workshop ID', wallpaper.publishedFileId],
    ['Tamano', wallpaper.fileSize ? `${(Number(wallpaper.fileSize) / 1024 / 1024).toFixed(1)} MB` : 'Sin dato'],
    ['Publicado', formatDate(wallpaper.timeCreated)],
    ['Actualizado', formatDate(wallpaper.timeUpdated)],
    ['Etiquetas', tags.join(', ')]
  ];

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      await video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const seekVideo = (event) => {
    const video = videoRef.current;
    if (!video || !duration) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    video.currentTime = ratio * duration;
  };

  return (
    <section className="wallpaper-detail-screen">
      <nav className="detail-breadcrumb">
        <button type="button" onClick={onBack}>Inicio</button>
        <span>/</span>
        <button type="button" onClick={onBack}>Steam Wallpaper Engine</button>
        <span>/</span>
        <strong>{wallpaper.title}</strong>
      </nav>

      <div className="detail-page-grid">
        <main className="detail-preview-column">
          <div className="detail-preview-frame">
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                poster={wallpaper.previewUrl}
                preload="metadata"
                playsInline
                onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
                onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />
            ) : wallpaper.previewUrl ? (
              <img src={wallpaper.previewUrl} alt={wallpaper.title} />
            ) : (
              <div className="detail-preview-empty">Sin preview</div>
            )}
            <div className="detail-player-bar">
              <span />
            </div>
            <div className="detail-player-controls">
              <span>||</span>
              <span>&gt;</span>
              <span>0:00 / 0:30</span>
              <span>□</span>
            </div>
          </div>

          <div className="detail-thumbnails">
            {[wallpaper, ...relatedWallpapers.slice(0, 4)].map((item, index) => (
              <button
                key={`${item.publishedFileId}-${index}`}
                type="button"
                className={index === 0 ? 'active' : ''}
                onClick={() => index > 0 && onOpen(item)}
              >
                {item.previewUrl && <img src={item.previewUrl} alt={item.title} />}
              </button>
            ))}
          </div>

          <section className="detail-comments">
            <h3>Comentarios <span>(128)</span></h3>
            <div className="detail-comment-box">Escribe un comentario...</div>
            <article>
              <strong>KuroNeko</strong>
              <small>hace 2 dias</small>
              <p>Increible ambiente, me encanta para estudiar, gracias por compartirlo.</p>
            </article>
          </section>
        </main>

        <aside className="detail-side-panel">
          <div className="detail-title-row">
            <h2>{wallpaper.title}</h2>
            <span>Workshop</span>
          </div>
          <div className="detail-author">
            <div>{String(wallpaper.author || wallpaper.publishedFileId || 'WE').slice(0, 2).toUpperCase()}</div>
            <p>
              <strong>{wallpaper.author || 'Autor de Workshop'}</strong>
              <small>Ver todos los wallpapers</small>
            </p>
          </div>

          <div className="detail-metrics">
            <div><strong>{formatCompact(wallpaper.subscriptions)}</strong><span>Descargas</span></div>
            <div><strong>{formatCompact(wallpaper.favorited)}</strong><span>Me gusta</span></div>
            <div><strong>{formatCompact(Math.max(Number(wallpaper.subscriptions || 0) * 3, 0))}</strong><span>Vistas</span></div>
            <div><strong>{Number(wallpaper.score || 0).toFixed(1)}</strong><span>Valoracion</span></div>
          </div>

          <div className={`detail-primary-actions ${isDownloaded ? 'downloaded' : ''}`}>
            <button
              type="button"
              className="detail-download"
              disabled={Boolean(downloadingId) || !downloaderReady}
              onClick={() => onDownload(wallpaper)}
            >
              {downloadingId === wallpaperId
                ? (isDownloaded ? 'Reparando...' : 'Descargando...')
                : (isDownloaded ? 'Reparar wallpaper' : 'Descargar Wallpaper')}
            </button>
            {isDownloaded && (
              <button
                type="button"
                className="detail-delete"
                disabled={deletingId === wallpaperId}
                onClick={() => onDelete(wallpaper)}
              >
                {deletingId === wallpaperId ? 'Eliminando...' : 'Eliminar'}
              </button>
            )}
            <button type="button" className={`detail-like ${isFavorite ? 'liked' : ''}`} onClick={() => onToggleFavorite(wallpaper)}>
              {isFavorite ? 'Me gusta' : 'Me gusta'}
            </button>
            <a className="detail-share" href={wallpaper.url} target="_blank" rel="noreferrer">Abrir</a>
          </div>

          <div className="detail-tags">
            {tags.map(tag => <span key={tag}>{tag}</span>)}
          </div>

          <dl className="detail-specs">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <div className="detail-trust">
            <strong>Verificado por Wallpaper Engine</strong>
            <span>Este wallpaper fue revisado antes de mostrarse en la app.</span>
          </div>

          {relatedWallpapers.length > 0 && (
            <section className="detail-related">
              <div>
                <h3>Mas del autor</h3>
                <button type="button" onClick={onBack}>Ver todo</button>
              </div>
              <div>
                {relatedWallpapers.slice(0, 4).map(item => (
                  <button key={item.publishedFileId} type="button" onClick={() => onOpen(item)}>
                    {item.previewUrl && <img src={item.previewUrl} alt={item.title} />}
                    <span>{formatCompact(item.subscriptions)} vistas</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </section>
  );
};

const DownloadConfirmation = ({ wallpaper, onClose, onOpenLocation }) => {
  if (!wallpaper) return null;

  const tags = wallpaper.tags?.filter(tag => !['steam', 'wallpaper-engine'].includes(tag)).slice(0, 4) || [];
  const location = wallpaper.localPath || wallpaper.path || '';
  const size = wallpaper.fileSize ? `${(Number(wallpaper.fileSize) / 1024 / 1024).toFixed(1)} MB` : 'Listo para usar';
  const downloadedAt = new Date().toLocaleString();
  const videoUrl = isVideoWallpaper(wallpaper) ? toPlayableUrl(wallpaper.playbackUrl || wallpaper.mediaUrl) : '';
  const previewUrl = toPlayableUrl(wallpaper.previewUrl || (!videoUrl ? wallpaper.playbackUrl || wallpaper.mediaUrl : ''));

  return (
    <div className="download-confirmation-backdrop">
      <section className="download-confirmation" role="dialog" aria-modal="true" aria-labelledby="download-confirmation-title">
        <header>
          <div className="download-confirmation-icon">↓</div>
          <div>
            <h2 id="download-confirmation-title">Wallpaper descargado</h2>
            <p>El wallpaper se ha descargado correctamente.</p>
          </div>
          <button type="button" className="download-confirmation-close" onClick={onClose}>x</button>
        </header>

        <div className="download-confirmation-body">
          <div className="download-confirmation-preview">
            {videoUrl ? (
              <video src={videoUrl} poster={previewUrl} controls muted loop playsInline preload="metadata" />
            ) : previewUrl ? (
              <img src={previewUrl} alt={wallpaper.title} />
            ) : (
              <div>Sin preview</div>
            )}
          </div>

          <aside>
            <span className="download-confirmation-badge">Workshop</span>
            <h3>{wallpaper.title}</h3>
            <p className="download-confirmation-author">by {wallpaper.author || 'Wallpaper Engine'}</p>
            {tags.length > 0 && (
              <div className="download-confirmation-tags">
                {tags.map(tag => <span key={tag}>{tag}</span>)}
              </div>
            )}

            <dl>
              <div>
                <dt>Ubicacion</dt>
                <dd>{location || 'No disponible'}</dd>
              </div>
              <div>
                <dt>Tipo</dt>
                <dd>{wallpaper.mediaType || 'Wallpaper'}</dd>
              </div>
              <div>
                <dt>Tamano</dt>
                <dd>{size}</dd>
              </div>
              <div>
                <dt>Descargado el</dt>
                <dd>{downloadedAt}</dd>
              </div>
            </dl>
          </aside>
        </div>

        <footer>
          <button type="button" className="download-confirmation-secondary" onClick={() => onOpenLocation(location)} disabled={!location}>
            Abrir ubicacion
          </button>
          <button type="button" className="download-confirmation-primary" onClick={onClose}>
            Aceptar
          </button>
        </footer>
      </section>
    </div>
  );
};

const WorkshopCard = ({
  wallpaper,
  downloadedWallpaper,
  isFavorite,
  isDownloading,
  isDeleting,
  downloaderReady,
  onOpen,
  onDownload,
  onDelete,
  onToggleFavorite
}) => {
  const [isNearViewport, setIsNearViewport] = useState(false);
  const cardRef = useRef(null);
  const isDownloaded = Boolean(downloadedWallpaper);
  const displayWallpaper = mergeDownloadedWallpaper(wallpaper, downloadedWallpaper);
  const previewUrl = toPlayableUrl(displayWallpaper.previewUrl || displayWallpaper.playbackUrl || displayWallpaper.mediaUrl || wallpaper.previewUrl);
  const videoUrl = isVideoWallpaper(displayWallpaper) && (displayWallpaper.playbackUrl || displayWallpaper.mediaUrl)
    ? toPlayableUrl(displayWallpaper.playbackUrl || displayWallpaper.mediaUrl)
    : '';
  const typeLabel = isDownloaded ? displayWallpaper.mediaType || 'instalado' : displayWallpaper.mediaType || 'workshop';

  useEffect(() => {
    const node = cardRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setIsNearViewport(entry.isIntersecting),
      { rootMargin: '900px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`steam-card workshop-card gallery-workshop-card ${isDownloaded ? 'downloaded' : ''}`} ref={cardRef}>
      <button className="steam-card-click" onClick={() => onOpen(displayWallpaper)}>
        <div className="steam-card-image">
          {isNearViewport && videoUrl ? (
            <video
              src={videoUrl}
              poster={previewUrl}
              muted
              loop
              playsInline
              preload="metadata"
            />
          ) : isNearViewport && previewUrl && (
            <img
              src={previewUrl}
              alt={displayWallpaper.title}
              loading="lazy"
              decoding="async"
              onError={(event) => {
                event.target.style.display = 'none';
              }}
            />
          )}
          <div className="steam-card-overlay">
            <span className="steam-badge">{isDownloaded ? 'Instalado' : typeLabel}</span>
          </div>
        </div>
        <div className="steam-card-info">
          <h4>{displayWallpaper.title}</h4>
          <p className="author">ID: {displayWallpaper.publishedFileId}</p>
          {displayWallpaper.description && (
            <p className="description">{displayWallpaper.description}</p>
          )}
          <div className="workshop-meta">
            <span>{Number(displayWallpaper.subscriptions || 0).toLocaleString()} subs</span>
            <span>{Number(displayWallpaper.favorited || 0).toLocaleString()} favs</span>
          </div>
        </div>
      </button>
      <div className="workshop-actions">
        <button type="button" className={`icon-action ${isFavorite ? 'liked' : ''}`} onClick={() => onToggleFavorite(wallpaper)}>
          {isFavorite ? 'Me gusta' : 'Me gusta'}
        </button>
        {isDownloaded ? (
          <>
            <button
              type="button"
              onClick={() => onDownload(displayWallpaper)}
              disabled={isDownloading || !downloaderReady}
              className="repair-wallpaper-btn"
            >
              {isDownloading ? 'Reparando...' : 'Reparar'}
            </button>
            <button
              type="button"
              onClick={() => onDelete(displayWallpaper)}
              disabled={isDeleting}
              className="delete-wallpaper-btn"
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </>
        ) : (
          <button
            onClick={() => onDownload(wallpaper)}
            disabled={isDownloading || !downloaderReady}
            className="set-wallpaper-btn"
          >
            {isDownloading ? 'Descargando...' : 'Descargar'}
          </button>
        )}
      </div>
    </div>
  );
};

const SteamIntegration = ({ favoritesOnly = false }) => {
  const [steamWallpapers, setSteamWallpapers] = useState([]);
  const [workshopWallpapers, setWorkshopWallpapers] = useState([]);
  const [workshopTotal, setWorkshopTotal] = useState(0);
  const [workshopPage, setWorkshopPage] = useState(1);
  const [hasMoreWorkshop, setHasMoreWorkshop] = useState(true);
  const [loading, setLoading] = useState(false);
  const [workshopLoading, setWorkshopLoading] = useState(false);
  const [error, setError] = useState(null);
  const [workshopError, setWorkshopError] = useState(null);
  const [steamPath, setSteamPath] = useState('');
  const [downloaderStatus, setDownloaderStatus] = useState(null);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(loadSavedFilters);
  const [favorites, setFavorites] = useState(loadFavorites);
  const [steamAccounts, setSteamAccounts] = useState(loadSteamAccounts);
  const [credentials, setCredentials] = useState({
    username: localStorage.getItem(USERNAME_STORAGE_KEY) || DEFAULT_STEAM_USERNAME,
    password: ''
  });
  const [downloadingId, setDownloadingId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [detailWallpaper, setDetailWallpaper] = useState(null);
  const [downloadConfirmation, setDownloadConfirmation] = useState(null);
  const [showFilters, setShowFilters] = useState(true);
  const [selectedWallpaper, setSelectedWallpaper] = useState(null);
  const [isSettingWallpaper, setIsSettingWallpaper] = useState(false);
  const loadMoreRef = useRef(null);

  // Cargar wallpapers de Steam al montar el componente
  useEffect(() => {
    loadSteamWallpapers();
    checkSteamPath();
    checkDownloaderStatus();
    loadVaultAccounts();
    if (!favoritesOnly) {
      searchWorkshop(null, { page: 1, append: false });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    saveFavorites(favorites);
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(USERNAME_STORAGE_KEY, credentials.username);
  }, [credentials.username]);

  useEffect(() => {
    saveSteamAccounts(steamAccounts.map(account => account.username || account));
  }, [steamAccounts]);

  useEffect(() => {
    if (!downloadConfirmation) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [downloadConfirmation]);

  useEffect(() => {
    if (favoritesOnly || !hasMoreWorkshop || workshopLoading) return undefined;

    const node = loadMoreRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        searchWorkshop(null, { page: workshopPage + 1, append: true });
      }
    }, { rootMargin: '1000px 0px' });

    observer.observe(node);
    return () => observer.disconnect();
  }, [favoritesOnly, hasMoreWorkshop, workshopLoading, workshopPage, query, filters]);

  const loadSteamWallpapers = async () => {
    try {
      if (!window.electronAPI) {
        setError('No estás en versión de escritorio. Algunos features no disponibles.');
        return;
      }

      setLoading(true);
      setError(null);
      
      const result = await window.electronAPI.getSteamWallpapers();
      
      if (result.success) {
        setSteamWallpapers(result.data);
      } else {
        setError(result.error || 'Error al cargar wallpapers de Steam');
      }
    } catch (err) {
      setError('Error: ' + err.message);
      console.error('Error loading Steam wallpapers:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkSteamPath = async () => {
    try {
      if (!window.electronAPI) return;
      
      const result = await window.electronAPI.getSteamPath();
      if (result.success) {
        setSteamPath(result.path);
      }
    } catch (err) {
      console.error('Error checking Steam path:', err);
    }
  };

  const checkDownloaderStatus = async () => {
    try {
      if (!window.electronAPI) return;

      const result = await window.electronAPI.getWorkshopDownloaderStatus();
      if (result.success) {
        setDownloaderStatus(result.data);
      }
    } catch (err) {
      console.error('Error checking downloader status:', err);
    }
  };

  const loadVaultAccounts = async () => {
    try {
      if (!window.electronAPI?.listSteamAccounts) return;

      const result = await window.electronAPI.listSteamAccounts();
      if (!result.success) return;

      setSteamAccounts(result.data.accounts);
      setCredentials(current => ({
        ...current,
        username: result.data.selectedUsername || current.username || DEFAULT_STEAM_USERNAME,
        password: ''
      }));
    } catch (err) {
      console.error('Error loading Steam accounts:', err);
    }
  };

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

  // Filtrar wallpapers ya descargados de la lista del workshop
  const visibleWorkshopWallpapers = favoritesOnly 
    ? favorites 
    : workshopWallpapers.filter(wallpaper => !downloadedById.has(getWallpaperId(wallpaper)));

  const searchWorkshop = async (event, overrides = {}) => {
    event?.preventDefault();

    try {
      if (!window.electronAPI) return;

      setWorkshopLoading(true);
      setWorkshopError(null);
      const nextQuery = overrides.query ?? query;
      const nextFilters = overrides.filters ?? filters;
      const nextPage = overrides.page ?? 1;
      const append = Boolean(overrides.append);
      const requiredTags = getRequiredTags(nextFilters);

      const result = await window.electronAPI.searchWorkshopWallpapers({
        query: nextQuery,
        page: nextPage,
        limit: PAGE_SIZE,
        sort: nextFilters.sort,
        time: nextFilters.time,
        requiredTags
      });

      if (result.success) {
        setWorkshopWallpapers(current => append ? [...current, ...result.data.data] : result.data.data);
        setWorkshopTotal(result.data.total);
        setWorkshopPage(nextPage);
        setHasMoreWorkshop(result.data.data.length === PAGE_SIZE);
      } else {
        setWorkshopError(result.error || 'Error al consultar Steam Workshop');
      }
    } catch (err) {
      setWorkshopError('Error al consultar Workshop: ' + err.message);
      console.error('Error searching Workshop:', err);
    } finally {
      setWorkshopLoading(false);
    }
  };

  const updateFilter = (name, value) => {
    const nextFilters = { ...filters, [name]: value };
    setFilters(nextFilters);
    searchWorkshop(null, { filters: nextFilters, page: 1, append: false });
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setQuery('');
    searchWorkshop(null, { query: '', filters: DEFAULT_FILTERS, page: 1, append: false });
  };

  const toggleFavorite = (wallpaper) => {
    setFavorites(current => {
      if (current.some(item => item.publishedFileId === wallpaper.publishedFileId)) {
        return current.filter(item => item.publishedFileId !== wallpaper.publishedFileId);
      }

      return [wallpaper, ...current];
    });
  };

  const selectedSteamAccount = steamAccounts.find(account => account.username === credentials.username);

  const downloadWorkshopWallpaper = async (wallpaper) => {
    try {
      if (!window.electronAPI) return;
      const wallpaperId = getWallpaperId(wallpaper);

      if (!credentials.username.trim()) {
        setWorkshopError('Configura una cuenta Steam en Configuracion antes de descargar.');
        return;
      }

      setDownloadingId(wallpaperId);
      setWorkshopError(null);

      const result = await window.electronAPI.downloadWorkshopWallpaper({
        publishedFileId: wallpaperId,
        username: credentials.username,
        password: credentials.password
      });

      if (result.success) {
        if (result.data.wallpaper) {
          const nextWallpaper = {
            ...result.data.wallpaper,
            publishedFileId: wallpaperId || result.data.wallpaper.publishedFileId
          };
          setSteamWallpapers(prev => [
            nextWallpaper,
            ...prev.filter(item => getWallpaperId(item) !== getWallpaperId(nextWallpaper))
          ]);
          setDetailWallpaper(current => (
            current && getWallpaperId(current) === getWallpaperId(nextWallpaper)
              ? mergeDownloadedWallpaper(current, nextWallpaper)
              : current
          ));
        }
        if (shouldShowDownloadConfirmation()) {
          setDownloadConfirmation({
            ...wallpaper,
            ...result.data.wallpaper,
            title: result.data.wallpaper?.title || wallpaper.title,
            author: result.data.wallpaper?.author || wallpaper.author,
            tags: result.data.wallpaper?.tags || wallpaper.tags,
            previewUrl: result.data.wallpaper?.previewUrl || wallpaper.previewUrl,
            fileSize: wallpaper.fileSize,
            path: result.data.path,
            localPath: result.data.wallpaper?.localPath || result.data.path
          });
        }
        loadSteamWallpapers();
      } else {
        setWorkshopError(result.error || 'No se pudo descargar el wallpaper');
      }
    } catch (err) {
      setWorkshopError('Error al descargar: ' + err.message);
      console.error('Error downloading Workshop wallpaper:', err);
    } finally {
      setDownloadingId('');
      checkDownloaderStatus();
    }
  };

  const deleteWorkshopWallpaper = async (wallpaper) => {
    try {
      if (!window.electronAPI?.deleteWorkshopWallpaper) return;

      const wallpaperId = getWallpaperId(wallpaper);
      if (!wallpaperId) return;

      const confirmed = window.confirm(`Eliminar "${wallpaper.title}" de Wallpaper Engine?`);
      if (!confirmed) return;

      setDeletingId(wallpaperId);
      setWorkshopError(null);

      const result = await window.electronAPI.deleteWorkshopWallpaper({
        publishedFileId: wallpaperId
      });

      if (result.success) {
        setSteamWallpapers(prev => prev.filter(item => getWallpaperId(item) !== wallpaperId));
        setDetailWallpaper(current => (
          current && getWallpaperId(current) === wallpaperId ? null : current
        ));
        loadSteamWallpapers();
      } else {
        setWorkshopError(result.error || 'No se pudo eliminar el wallpaper');
      }
    } catch (err) {
      setWorkshopError('Error al eliminar: ' + err.message);
      console.error('Error deleting Workshop wallpaper:', err);
    } finally {
      setDeletingId('');
    }
  };

  const handleSetAsWallpaper = useCallback(async (wallpaper) => {
    try {
      if (!window.electronAPI) {
        alert('Esta función solo está disponible en la versión de escritorio');
        return;
      }

      if (isSceneWallpaper(wallpaper)) {
        alert([
          'Este wallpaper es una escena de Wallpaper Engine.',
          'Las escenas no se pueden establecer como fondo desde Windows ni desde esta app.',
          'Si Wallpaper Engine dice que requiere una version mas nueva, actualiza Wallpaper Engine desde Steam.'
        ].join('\n'));
        return;
      }

      setIsSettingWallpaper(true);
      const result = await window.electronAPI.setWallpaper(wallpaper.mediaUrl);
      
      if (result.success) {
        setSelectedWallpaper(wallpaper);
        alert(`✓ Wallpaper "${wallpaper.title}" establecido correctamente`);
      } else {
        alert(`✗ Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error setting wallpaper:', error);
      alert('Error al establecer wallpaper: ' + error.message);
    } finally {
      setIsSettingWallpaper(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    loadSteamWallpapers();
    checkDownloaderStatus();
  }, []);

  const openDownloadLocation = async (targetPath) => {
    try {
      if (!window.electronAPI?.openPath || !targetPath) return;
      await window.electronAPI.openPath(targetPath);
    } catch (err) {
      setWorkshopError('No se pudo abrir la ubicacion: ' + err.message);
    }
  };

  const downloadConfirmationDialog = (
    <DownloadConfirmation
      wallpaper={downloadConfirmation}
      onClose={() => setDownloadConfirmation(null)}
      onOpenLocation={openDownloadLocation}
    />
  );

  if (!window.electronAPI) {
    return (
      <div className="steam-integration-message">
        <p>ℹ️ Esta sección requiere la versión de escritorio (.exe) de Wallpaper App</p>
        <p>Descarga la versión de escritorio para acceder a tus wallpapers de Steam</p>
      </div>
    );
  }

  if (detailWallpaper) {
    const downloadedDetailWallpaper = getDownloadedWallpaper(detailWallpaper);
    const activeDetailWallpaper = mergeDownloadedWallpaper(detailWallpaper, downloadedDetailWallpaper);
    const relatedWallpapers = visibleWorkshopWallpapers.filter(
      wallpaper => wallpaper.publishedFileId !== detailWallpaper.publishedFileId
    );

    return (
      <div className="steam-integration">
        <WorkshopDetailScreen
          wallpaper={activeDetailWallpaper}
          relatedWallpapers={relatedWallpapers}
          isFavorite={favoriteIds.has(getWallpaperId(detailWallpaper))}
          isDownloaded={Boolean(downloadedDetailWallpaper)}
          downloadingId={downloadingId}
          deletingId={deletingId}
          downloaderReady={Boolean(downloaderStatus?.hasDownloader)}
          onBack={() => setDetailWallpaper(null)}
          onOpen={setDetailWallpaper}
          onDownload={downloadWorkshopWallpaper}
          onDelete={deleteWorkshopWallpaper}
          onToggleFavorite={toggleFavorite}
        />
        {downloadConfirmationDialog}
      </div>
    );
  }

  return (
    <div className="steam-integration">
      <div className="steam-header">
        <div>
          <h2>{favoritesOnly ? 'Wallpapers que te gustan' : 'Steam Wallpaper Engine'}</h2>
          {!favoritesOnly && (
            <p>Descubre, previsualiza y descarga los mejores wallpapers animados de la comunidad de Wallpaper Engine.</p>
          )}
        </div>
        <div className="steam-controls">
          <button 
            onClick={handleRefresh}
            disabled={loading}
            className="refresh-btn"
          >
            🔄 Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="steam-error">
          <p>⚠️ {error}</p>
          <small>Asegúrate que Wallpaper Engine esté instalado en Steam</small>
        </div>
      )}

      {!favoritesOnly && (
      <section className="workshop-panel">
        <div className="workshop-panel-header">
          <div>
            <h3>Explorar Workshop</h3>
            <p>Busca wallpapers increibles creados por la comunidad de Wallpaper Engine.</p>
          </div>
          <span className={`downloader-status ${downloaderStatus?.hasDownloader ? 'ready' : 'missing'}`}>
            {downloaderStatus?.hasDownloader ? 'Listo para descargar' : 'Descarga no configurada'}
          </span>
        </div>

        {!downloaderStatus?.hasDownloader && (
          <div className="steam-error">
            <p>No encontre una herramienta de descarga compatible.</p>
            <small>Abre Configuracion para revisar el diagnostico.</small>
          </div>
        )}

        <form className="workshop-search" onSubmit={searchWorkshop}>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busca por nombre, etiquetas, autor..."
          />
          <button type="button" className="filter-toggle-btn" onClick={() => setShowFilters(current => !current)}>
            Filtros
          </button>
        </form>

        {showFilters && (
        <div className="workshop-filters">
          <label>
            Ordenar por
            <select value={filters.sort} onChange={(event) => updateFilter('sort', event.target.value)}>
              <option value="trend">Tendencia</option>
              <option value="popular">Mas populares</option>
              <option value="favorites">Mas favoritos</option>
              <option value="recent">Recientes</option>
              <option value="updated">Actualizados</option>
            </select>
          </label>

          <label>
            Periodo
            <select value={filters.time} onChange={(event) => updateFilter('time', event.target.value)}>
              <option value="all">Todo el tiempo</option>
              <option value="week">Ultima semana</option>
              <option value="month">Ultimo mes</option>
              <option value="quarter">Ultimos 3 meses</option>
              <option value="year">Ultimo ano</option>
            </select>
          </label>

          <label>
            Tipo
            <select value={filters.type} onChange={(event) => updateFilter('type', event.target.value)}>
              {TYPE_TAGS.map(tag => (
                <option key={tag.value} value={tag.value}>{tag.label}</option>
              ))}
            </select>
          </label>

          <div className="workshop-filter-actions">
            <button type="button" onClick={resetFilters} disabled={workshopLoading}>Limpiar</button>
          </div>
        </div>
        )}

        <button type="button" className="workshop-submit" onClick={searchWorkshop} disabled={workshopLoading}>
          {workshopLoading ? 'Buscando...' : 'Buscar'}
        </button>

        {workshopError && (
          <div className="steam-error">
            <p>{workshopError}</p>
            <small>Revisa Configuracion para ver el log de diagnostico.</small>
          </div>
        )}

        {!workshopLoading && !workshopError && workshopWallpapers.length === 0 && (
          <div className="steam-empty workshop-empty">
            <p>No hay resultados con estos filtros</p>
            <small>Prueba otro tipo, periodo u orden.</small>
          </div>
        )}

        {visibleWorkshopWallpapers.length > 0 && (
          <>
          <div className="steam-stats workshop-stats">
            <h3>Resultados</h3>
            <p>{workshopTotal.toLocaleString()} resultados encontrados</p>
          </div>
          <div className="steam-grid workshop-grid virtual-grid">
            {visibleWorkshopWallpapers.map(wallpaper => (
              <WorkshopCard
                key={wallpaper.publishedFileId}
                wallpaper={wallpaper}
                downloadedWallpaper={getDownloadedWallpaper(wallpaper)}
                isFavorite={favoriteIds.has(getWallpaperId(wallpaper))}
                isDownloading={downloadingId === getWallpaperId(wallpaper)}
                isDeleting={deletingId === getWallpaperId(wallpaper)}
                downloaderReady={Boolean(downloaderStatus?.hasDownloader)}
                onOpen={setDetailWallpaper}
                onDownload={downloadWorkshopWallpaper}
                onDelete={deleteWorkshopWallpaper}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
          {!favoritesOnly && hasMoreWorkshop && (
            <div ref={loadMoreRef} className="gallery-loader workshop-loader">
              {workshopLoading ? 'Cargando mas wallpapers...' : 'Preparando mas resultados...'}
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
              <p>{workshopError}</p>
              <small>Revisa Configuracion para ver el log de diagnostico.</small>
            </div>
          )}
          {favorites.length === 0 ? (
            <div className="steam-empty workshop-empty">
              <p>No tienes wallpapers marcados con me gusta</p>
              <small>Marca wallpapers desde Steam Workshop para verlos aqui.</small>
            </div>
          ) : (
            <>
              <div className="steam-stats workshop-stats">
                <h3>Me gusta</h3>
                <p>{favorites.length} wallpapers marcados</p>
              </div>
              <div className="steam-grid workshop-grid virtual-grid">
                {favorites.map(wallpaper => (
                  <WorkshopCard
                    key={wallpaper.publishedFileId}
                    wallpaper={wallpaper}
                    downloadedWallpaper={getDownloadedWallpaper(wallpaper)}
                    isFavorite={favoriteIds.has(getWallpaperId(wallpaper))}
                    isDownloading={downloadingId === getWallpaperId(wallpaper)}
                    isDeleting={deletingId === getWallpaperId(wallpaper)}
                    downloaderReady={Boolean(downloaderStatus?.hasDownloader)}
                    onOpen={setDetailWallpaper}
                    onDownload={downloadWorkshopWallpaper}
                    onDelete={deleteWorkshopWallpaper}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {!favoritesOnly && loading && (
        <div className="steam-loading">
          <p>Cargando wallpapers...</p>
        </div>
      )}

      {!favoritesOnly && !loading && steamWallpapers.length === 0 && !error && (
        <div className="steam-empty">
          <p>No se encontraron wallpapers de Steam Wallpaper Engine</p>
          <small>Instala Wallpaper Engine desde Steam para ver tus wallpapers aquí</small>
        </div>
      )}

      {!favoritesOnly && steamWallpapers.length > 0 && (
        <>
          <div className="steam-stats">
            <p>{steamWallpapers.length} wallpapers encontrados</p>
          </div>
          <div className="steam-grid">
            {steamWallpapers.map((wallpaper, index) => (
              <div 
                key={index}
                className={`steam-card ${selectedWallpaper?.mediaUrl === wallpaper.mediaUrl ? 'active' : ''}`}
              >
                <div className="steam-card-image">
                  {isVideoWallpaper(wallpaper) && (wallpaper.playbackUrl || wallpaper.mediaUrl) ? (
                    <video
                      src={toPlayableUrl(wallpaper.playbackUrl || wallpaper.mediaUrl)}
                      poster={toPlayableUrl(wallpaper.previewUrl)}
                      controls
                      muted
                      loop
                      playsInline
                      preload="metadata"
                    />
                  ) : (wallpaper.previewUrl || wallpaper.playbackUrl || wallpaper.mediaUrl) && (
                    <img 
                      src={toPlayableUrl(wallpaper.previewUrl || wallpaper.playbackUrl || wallpaper.mediaUrl)}
                      alt={wallpaper.title}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  )}
                  <div className="steam-card-overlay">
                    <span className="steam-badge">{wallpaper.mediaType}</span>
                  </div>
                </div>
                <div className="steam-card-info">
                  <h4>{wallpaper.title}</h4>
                  {wallpaper.author && (
                    <p className="author">por {wallpaper.author}</p>
                  )}
                  {wallpaper.description && (
                    <p className="description">{wallpaper.description}</p>
                  )}
                </div>
                <button
                  onClick={() => handleSetAsWallpaper(wallpaper)}
                  disabled={isSettingWallpaper}
                  className="set-wallpaper-btn"
                >
                  {isSettingWallpaper ? '⏳ Estableciendo...' : '✓ Establecer como Fondo'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      {downloadConfirmationDialog}
    </div>
  );
};

export default SteamIntegration;
