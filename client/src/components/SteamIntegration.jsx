import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toPlayableUrl } from '../utils/mediaUrl';
import {
  enrichWallpaperMetadata,
  getAuthorWallpapers,
  sortSimilarWallpapers
} from '../utils/wallpaperMeta';
import '../styles/steam-integration.css';
// Importar Bootstrap Icons (asegúrate de tener instalado: npm install bootstrap-icons)
import 'bootstrap-icons/font/bootstrap-icons.css';
import WallpaperDetails from './WallpaperDetails';
import AuthorProfile from './AuthorProfile';


const FILTER_STORAGE_KEY = 'wallpaperApp.workshopFilters';
export const FAVORITES_STORAGE_KEY = 'wallpaperApp.workshopFavorites';
export const DOWNLOAD_CONFIRMATION_STORAGE_KEY = 'wallpaperApp.showDownloadConfirmation';
const USERNAME_STORAGE_KEY = 'wallpaperApp.steamUsername';
const ACCOUNTS_STORAGE_KEY = 'wallpaperApp.steamAccounts';
const SUBSCRIPTIONS_STORAGE_KEY = 'wallpaperApp.subscriptions';
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
  { value: '', label: 'Todos los tipos', icon: 'bi-grid' },
  { value: 'Scene', label: 'Escena', icon: 'bi-bezier2' },
  { value: 'Video', label: 'Video', icon: 'bi-camera-reels' },
  { value: 'Web', label: 'Web', icon: 'bi-browser-chrome' },
  { value: 'Application', label: 'Aplicacion', icon: 'bi-window' }
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

const loadSubscriptions = () => {
  try {
    return JSON.parse(localStorage.getItem(SUBSCRIPTIONS_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
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
    authorId: workshopWallpaper.authorId || workshopWallpaper.creator || downloadedWallpaper.authorId || downloadedWallpaper.creator,
    author: workshopWallpaper.author || downloadedWallpaper.author,
    creator: workshopWallpaper.creator || workshopWallpaper.authorId || downloadedWallpaper.creator,
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
          <div className="download-confirmation-icon">
            <i className="bi bi-check-circle-fill"></i>
          </div>
          <div>
            <h2 id="download-confirmation-title">Wallpaper descargado</h2>
            <p>El wallpaper se ha descargado correctamente.</p>
          </div>
          <button type="button" className="download-confirmation-close" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </header>

        <div className="download-confirmation-body">
          <div className="download-confirmation-preview">
            {videoUrl ? (
              <video src={videoUrl} poster={previewUrl} controls muted loop playsInline preload="metadata" />
            ) : previewUrl ? (
              <img src={previewUrl} alt={wallpaper.title} />
            ) : (
              <div><i className="bi bi-image-slash"></i> Sin preview</div>
            )}
          </div>

          <aside>
            <span className="download-confirmation-badge">
              <i className="bi bi-steam"></i> Workshop
            </span>
            <h3>{wallpaper.title}</h3>
            <p className="download-confirmation-author">
              <i className="bi bi-person"></i> by {wallpaper.author || 'Wallpaper Engine'}
            </p>
            {tags.length > 0 && (
              <div className="download-confirmation-tags">
                {tags.map(tag => <span key={tag}><i className="bi bi-tag"></i> {tag}</span>)}
              </div>
            )}

            <dl>
              <div>
                <dt><i className="bi bi-folder"></i> Ubicacion</dt>
                <dd>{location || 'No disponible'}</dd>
              </div>
              <div>
                <dt><i className="bi bi-filetype-mp4"></i> Tipo</dt>
                <dd>{wallpaper.mediaType || 'Wallpaper'}</dd>
              </div>
              <div>
                <dt><i className="bi bi-hdd-stack"></i> Tamano</dt>
                <dd>{size}</dd>
              </div>
              <div>
                <dt><i className="bi bi-calendar-check"></i> Descargado el</dt>
                <dd>{downloadedAt}</dd>
              </div>
            </dl>
          </aside>
        </div>

        <footer>
          <button type="button" className="download-confirmation-secondary" onClick={() => onOpenLocation(location)} disabled={!location}>
            <i className="bi bi-folder2-open"></i> Abrir ubicacion
          </button>
          <button type="button" className="download-confirmation-primary" onClick={onClose}>
            <i className="bi bi-check-lg"></i> Aceptar
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
            <span className="steam-badge">
              <i className={`bi bi-${isDownloaded ? 'check-circle' : (typeLabel === 'Video' ? 'camera-reels' : 'image')}`}></i>
              {isDownloaded ? 'Instalado' : typeLabel}
            </span>
          </div>
        </div>
        <div className="steam-card-info">
          <h4>{displayWallpaper.title}</h4>
          {/* <p className="author"><i className="bi bi-upc-scan"></i> ID: {displayWallpaper.publishedFileId}</p> */}
          {displayWallpaper.description && (
            <p className="description">{displayWallpaper.description}</p>
          )}
          <div className="workshop-meta">
            <span><i className="bi bi-download"></i> {Number(displayWallpaper.subscriptions || 0).toLocaleString()}</span>
            <span><i className="bi bi-heart"></i> {Number(displayWallpaper.favorited || 0).toLocaleString()}</span>
          </div>
        </div>
      </button>
      <div className="workshop-actions">
        <button type="button" className={`icon-action ${isFavorite ? 'liked' : ''}`} onClick={() => onToggleFavorite(wallpaper)}>
          {/* <i className={`bi bi-heart${isFavorite ? '-fill' : ''}`}></i> */}
          <span>Favorito</span>
        </button>
        {isDownloaded ? (
          <>
            <button
              type="button"
              onClick={() => onDownload(displayWallpaper)}
              disabled={isDownloading || !downloaderReady}
              className="repair-wallpaper-btn"
            >
              <i className={`bi bi-arrow-repeat ${isDownloading ? 'spin-icon' : ''}`}></i>
              {isDownloading ? 'Reparando...' : 'Reparar'}
            </button>
            <button
              type="button"
              onClick={() => onDelete(displayWallpaper)}
              disabled={isDeleting}
              className="delete-wallpaper-btn"
            >
              <i className="bi bi-trash"></i>
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </>
        ) : (
          <button
            onClick={() => onDownload(wallpaper)}
            disabled={isDownloading || !downloaderReady}
            className="set-wallpaper-btn"
          >
            <i className={`bi bi-download ${isDownloading ? 'spin-icon' : ''}`}></i>
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
  const [subscriptions, setSubscriptions] = useState(loadSubscriptions);
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
  const [selectedAuthorId, setSelectedAuthorId] = useState(null);
  const [isSettingWallpaper, setIsSettingWallpaper] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const loadMoreRef = useRef(null);
  const loadingMoreWorkshopRef = useRef(false);

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
    localStorage.setItem(SUBSCRIPTIONS_STORAGE_KEY, JSON.stringify(subscriptions));
  }, [subscriptions]);

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
      if (entry.isIntersecting && !loadingMoreWorkshopRef.current) {
        loadingMoreWorkshopRef.current = true;
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
      loadingMoreWorkshopRef.current = false;
    }
  };

  const loadMoreWorkshopWallpapers = () => {
    if (favoritesOnly || workshopLoading || !hasMoreWorkshop || loadingMoreWorkshopRef.current) return;
    loadingMoreWorkshopRef.current = true;
    searchWorkshop(null, { page: workshopPage + 1, append: true });
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

  const handleSubscribe = useCallback((authorId, isSubscribed) => {
    if (!authorId) return;
    setSubscriptions(current => ({ ...current, [authorId]: isSubscribed }));
  }, []);

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
        const authorId = wallpaper.authorId || wallpaper.author;
        if (authorId) {
          handleSubscribe(authorId, true);
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
  ].map((wallpaper) => enrichWallpaperMetadata(
    mergeDownloadedWallpaper(wallpaper, getDownloadedWallpaper(wallpaper)) || wallpaper
  ));
  const relatedWallpapers = sortSimilarWallpapers(activeDetailWallpaper, detailPool).slice(0, 12);
  const directAuthorWallpapers = getAuthorWallpapers(activeDetailWallpaper, detailPool).slice(0, 12);
  const authorWallpapers = directAuthorWallpapers.length > 0
    ? directAuthorWallpapers
    : relatedWallpapers.slice(0, 8);

  return (
    <div className="steam-integration">
      <WallpaperDetails
        wallpaper={activeDetailWallpaper}
        onClose={() => setDetailWallpaper(null)}
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
        onOpenRelated={setDetailWallpaper}
        sourceName="Workshop"
        sourceIcon="steam"
        showComments={true}
      />
      {selectedAuthorId && (
        <AuthorProfile
          authorId={selectedAuthorId}
          allWallpapers={[...steamWallpapers, ...workshopWallpapers, ...favorites]}
          subscriptions={subscriptions}
          onClose={() => setSelectedAuthorId(null)}
          onSubscribe={handleSubscribe}
          onOpenWallpaper={setDetailWallpaper}
        />
      )}
      {downloadConfirmationDialog}
    </div>
  );
}
  // Componentes de UI mejorados
  const SearchBar = () => (
    <div className={`workshop-search-container ${isSearchFocused ? 'focused' : ''}`}>
      <div className="search-input-wrapper">
        <i className="bi bi-search search-icon"></i>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          placeholder="Buscar wallpapers por nombre, etiquetas o autor..."
          className="workshop-search-input"
          onKeyPress={(e) => e.key === 'Enter' && searchWorkshop(e)}
        />
        {query && (
          <button
            className="search-clear-btn"
            onClick={() => setQuery('')}
            title="Limpiar búsqueda"
          >
            <i className="bi bi-x-circle-fill"></i>
          </button>
        )}
        <button
          type="submit"
          className="search-submit-btn"
          onClick={(e) => searchWorkshop(e)}
          disabled={workshopLoading}
        >
          {workshopLoading ? (
            <i className="bi bi-arrow-repeat spin-icon"></i>
          ) : (
            <i className="bi bi-arrow-right"></i>
          )}
        </button>
      </div>

      <button
        type="button"
        className={`filter-toggle-btn ${showFilters ? 'active' : ''}`}
        onClick={() => setShowFilters(current => !current)}
      >
        <i className={`bi bi-funnel${showFilters ? '-fill' : ''}`}></i>
        <span>Filtros</span>
        <i className={`bi bi-chevron-${showFilters ? 'up' : 'down'}`}></i>
      </button>
    </div>
  );

  const FiltersPanel = () => (
    <div className="workshop-filters-panel">
      <div className="filters-header">
        <h4>
          <i className="bi bi-sliders2"></i>
          Filtros de búsqueda
        </h4>
        <button type="button" onClick={resetFilters} disabled={workshopLoading} className="reset-filters-btn">
          <i className="bi bi-arrow-counterclockwise"></i>
          Limpiar filtros
        </button>
      </div>

      <div className="filters-grid">
        <div className="filter-group">
          <label>
            <i className="bi bi-sort-down"></i>
            Ordenar por
          </label>
          <select value={filters.sort} onChange={(event) => updateFilter('sort', event.target.value)} className="filter-select">
            <option value="trend"><i className="bi bi-graph-up"></i> Tendencia</option>
            <option value="popular"><i className="bi bi-star-fill"></i> Más populares</option>
            <option value="favorites"><i className="bi bi-heart-fill"></i> Más favoritos</option>
            <option value="recent"><i className="bi bi-clock-history"></i> Recientes</option>
            <option value="updated"><i className="bi bi-arrow-repeat"></i> Actualizados</option>
          </select>
        </div>

        <div className="filter-group">
          <label>
            <i className="bi bi-calendar"></i>
            Periodo
          </label>
          <select value={filters.time} onChange={(event) => updateFilter('time', event.target.value)} className="filter-select">
            <option value="all"><i className="bi bi-infinity"></i> Todo el tiempo</option>
            <option value="week"><i className="bi bi-calendar-week"></i> Última semana</option>
            <option value="month"><i className="bi bi-calendar-month"></i> Último mes</option>
            <option value="quarter"><i className="bi bi-calendar-range"></i> Últimos 3 meses</option>
            <option value="year"><i className="bi bi-calendar-year"></i> Último año</option>
          </select>
        </div>

        <div className="filter-group">
          <label>
            <i className="bi bi-tag"></i>
            Tipo de wallpaper
          </label>
          <select value={filters.type} onChange={(event) => updateFilter('type', event.target.value)} className="filter-select">
            {TYPE_TAGS.map(tag => (
              <option key={tag.value} value={tag.value}>
                <i className={`bi ${tag.icon}`}></i> {tag.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-quick-suggestions">
          <span className="suggestions-label">
            <i className="bi bi-lightbulb"></i>
            Búsquedas populares:
          </span>
          <div className="suggestions-tags">
            {['anime', 'nature', 'cyberpunk', 'abstract', 'game', 'space', 'city', 'fantasy'].map(suggestion => (
              <button
                key={suggestion}
                className="suggestion-tag"
                onClick={() => {
                  setQuery(suggestion);
                  searchWorkshop(null, { query: suggestion });
                }}
              >
                <i className="bi bi-search"></i>
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
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
                Steam Wallpaper Engine
              </>
            )}
          </h2>
          {!favoritesOnly && (
            <p>
              <i className="bi bi-magic"></i>
              Descubre, previsualiza y descarga los mejores wallpapers animados de la comunidad de Wallpaper Engine.
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
            <div>
              <h3>
                <i className="bi bi-shop"></i>
                Explorar Workshop
              </h3>
              <p>Busca wallpapers increíbles creados por la comunidad de Wallpaper Engine.</p>
            </div>
            {/* <span className={`downloader-status ${downloaderStatus?.hasDownloader ? 'ready' : 'missing'}`}>
              <i className={`bi bi-${downloaderStatus?.hasDownloader ? 'check-circle-fill' : 'exclamation-circle-fill'}`}></i>
              {downloaderStatus?.hasDownloader ? 'Listo para descargar' : 'Descarga no configurada'}
            </span> */}
          </div>

          {!downloaderStatus?.hasDownloader && (
            <div className="steam-error">
              <i className="bi bi-tools"></i>
              <div>
                <p>No encontré una herramienta de descarga compatible.</p>
                <small>Abre Configuración para revisar el diagnóstico.</small>
              </div>
            </div>
          )}

          <form className="workshop-search-form" onSubmit={searchWorkshop}>
            <SearchBar />
            {showFilters && <FiltersPanel />}
          </form>

          {workshopError && (
            <div className="steam-error">
              <i className="bi bi-bug-fill"></i>
              <div>
                <p>{workshopError}</p>
                <small>Revisa Configuración para ver el log de diagnóstico.</small>
              </div>
            </div>
          )}

          {!workshopLoading && !workshopError && workshopWallpapers.length === 0 && (
            <div className="steam-empty workshop-empty">
              <i className="bi bi-inbox"></i>
              <p>No hay resultados con estos filtros</p>
              <small>Prueba otro tipo, período u orden.</small>
            </div>
          )}

          {visibleWorkshopWallpapers.length > 0 && (
            <>
              <div className="steam-stats workshop-stats">
                <div className="stats-left">
                  <i className="bi bi-grid-3x3-gap-fill"></i>
                  <h3>Resultados</h3>
                </div>
                <div className="stats-right">
                  <i className="bi bi-database"></i>
                  <p>{workshopTotal.toLocaleString()} resultados encontrados</p>
                </div>
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
  onOpen={(wallpaperItem) => {
    // wallpaperItem ya viene mergeado de WorkshopCard
    setDetailWallpaper(wallpaperItem);
  }}
  onDownload={downloadWorkshopWallpaper}
  onDelete={deleteWorkshopWallpaper}
  onToggleFavorite={toggleFavorite}
/>
                ))}
              </div>
              {!favoritesOnly && hasMoreWorkshop && (
                <div ref={loadMoreRef} className="gallery-loader workshop-loader">
                  {workshopLoading ? (
                    <>
                      <i className="bi bi-arrow-repeat spin-icon"></i>
                      Cargando más wallpapers...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-chevron-double-down"></i>
                      Desplázate para más resultados
                    </>
                  )}
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
          {favorites.length === 0 ? (
            <div className="steam-empty workshop-empty">
              <i className="bi bi-heart"></i>
              <p>No tienes wallpapers marcados con me gusta</p>
              <small>Marca wallpapers desde Steam Workshop para verlos aquí.</small>
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
                  <p>{favorites.length} wallpapers marcados</p>
                </div>
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

      {downloadConfirmationDialog}
    </div>
  );
};

export default SteamIntegration;
