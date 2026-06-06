import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toPlayableUrl } from '../utils/mediaUrl';
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


const FILTER_STORAGE_KEY = 'wallpaperApp.workshopFilters';
export const DOWNLOAD_CONFIRMATION_STORAGE_KEY = 'wallpaperApp.showDownloadConfirmation';
const USERNAME_STORAGE_KEY = 'wallpaperApp.steamUsername';
const ACCOUNTS_STORAGE_KEY = 'wallpaperApp.steamAccounts';
const DEFAULT_STEAM_USERNAME = 'adgjl1182';
export const DEFAULT_WORKSHOP_FILTERS = {
  sort: 'trend',
  time: 'all',
  type: '',
  genre: '',
  assetType: '',
  assetGenre: '',
  scriptType: '',
  ageRating: '',
  matchAllTags: true
};
const DEFAULT_FILTERS = DEFAULT_WORKSHOP_FILTERS;
const PAGE_SIZE = 18;

const FAVORITE_CONTENT_TABS = [
  { value: 'normal', label: 'Contenido normal', icon: 'bi-heart' },
  { value: 'mature', label: 'Contenido maduro', icon: 'bi-shield-lock' }
];

const FAVORITE_SORT_TABS = [
  { value: 'recent', label: 'Mas recientes', icon: 'bi-clock-history' },
  { value: 'popular', label: 'Populares', icon: 'bi-star-fill' },
  { value: 'downloads', label: 'Mas descargados', icon: 'bi-download' }
];

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

const WORKSHOP_FILTER_LABELS = {
  sort: {
    trend: 'Tendencia',
    popular: 'Mas populares',
    favorites: 'Mas favoritos',
    recent: 'Recientes',
    updated: 'Actualizados'
  },
  time: {
    all: 'Todo el tiempo',
    week: 'Ultima semana',
    month: 'Ultimo mes',
    quarter: 'Ultimos 3 meses',
    year: 'Ultimo ano'
  },
  type: Object.fromEntries(TYPE_TAGS.map(tag => [tag.value, tag.label])),
  genre: {},
  assetType: {},
  assetGenre: {},
  scriptType: {},
  ageRating: {
    Everyone: 'Everyone',
    Questionable: 'Questionable',
    Mature: 'Mature'
  }
};

const getActiveWorkshopFilterChips = (filters = {}) => {
  const chips = [];
  const addChip = (key, label, value) => {
    if (!value) return;
    chips.push({
      key,
      label,
      value: label ? `${label}: ${value}` : value
    });
  };

  if (filters.sort && filters.sort !== DEFAULT_WORKSHOP_FILTERS.sort) {
    addChip('sort', 'Orden', WORKSHOP_FILTER_LABELS.sort[filters.sort] || filters.sort);
  }
  if (filters.time && filters.time !== DEFAULT_WORKSHOP_FILTERS.time) {
    addChip('time', 'Periodo', WORKSHOP_FILTER_LABELS.time[filters.time] || filters.time);
  }

  addChip('type', 'Tipo', WORKSHOP_FILTER_LABELS.type[filters.type] || filters.type);
  addChip('genre', 'Genero', WORKSHOP_FILTER_LABELS.genre[filters.genre] || filters.genre);
  addChip('assetType', 'Asset', WORKSHOP_FILTER_LABELS.assetType[filters.assetType] || filters.assetType);
  addChip('assetGenre', 'Asset genero', WORKSHOP_FILTER_LABELS.assetGenre[filters.assetGenre] || filters.assetGenre);
  addChip('scriptType', 'Script', WORKSHOP_FILTER_LABELS.scriptType[filters.scriptType] || filters.scriptType);
  addChip('ageRating', 'Age rating', WORKSHOP_FILTER_LABELS.ageRating[filters.ageRating] || filters.ageRating);

  if (filters.matchAllTags === false) {
    addChip('matchAllTags', '', 'Cualquier tag');
  }

  return chips;
};

const loadFavorites = () => {
  return loadFavoriteWallpapers();
};

const saveFavorites = (favorites) => {
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
};

const loadSubscriptions = () => {
  return loadAuthorSubscriptions();
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

const getRequiredTags = (nextFilters = {}) => [
  nextFilters.type,
  nextFilters.genre,
  nextFilters.assetType,
  nextFilters.assetGenre,
  nextFilters.scriptType,
  nextFilters.ageRating
].filter(Boolean);

const mergeUniqueWorkshopWallpapers = (currentItems = [], nextItems = []) => {
  const seen = new Set();

  return [...currentItems, ...nextItems].filter(item => {
    const id = getWallpaperId(item);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

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

const getFavoriteRecentTime = (wallpaper = {}, index = 0) => {
  const values = [
    wallpaper.favoriteAddedAt,
    wallpaper.likedAt,
    wallpaper.addedAt,
    wallpaper.timeUpdated ? Number(wallpaper.timeUpdated) * 1000 : 0,
    wallpaper.timeCreated ? Number(wallpaper.timeCreated) * 1000 : 0
  ];
  const parsed = values
    .map(value => (typeof value === 'number' ? value : Date.parse(value)))
    .find(value => Number.isFinite(value) && value > 0);

  return parsed || (Date.now() - index);
};

const getFavoritePopularityScore = (wallpaper = {}) => (
  Number(wallpaper.favorited || 0) + Number(wallpaper.score || 0) * 1000
);

const sortFavoriteWallpapers = (items = [], sort = 'recent') => (
  [...items].sort((a, b) => {
    if (sort === 'downloads') {
      return Number(b.subscriptions || 0) - Number(a.subscriptions || 0);
    }

    if (sort === 'popular') {
      return getFavoritePopularityScore(b) - getFavoritePopularityScore(a);
    }

    return getFavoriteRecentTime(b) - getFavoriteRecentTime(a);
  })
);

const isVideoWallpaper = (wallpaper = {}) => {
  const mediaUrl = [
    wallpaper.playbackUrl,
    wallpaper.mediaUrl,
    wallpaper.localPath,
    wallpaper.downloadUrl,
    wallpaper.url,
    wallpaper.path,
    wallpaper.previewUrl
  ].filter(Boolean).join(' ');
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

const SteamIntegration = ({
  favoritesOnly = false,
  searchQuery = '',
  workshopFilters = DEFAULT_WORKSHOP_FILTERS,
  onNotify = () => {},
  onNavigate = () => {},
  showMatureContent = false
}) => {
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
  const [selectedWallpaper, setSelectedWallpaper] = useState(null);
  const [selectedAuthorId, setSelectedAuthorId] = useState(null);
  const [isSettingWallpaper, setIsSettingWallpaper] = useState(false);
  const [filterRefreshKey, setFilterRefreshKey] = useState(0);
  const [favoriteContentTab, setFavoriteContentTab] = useState('normal');
  const [favoriteSortTab, setFavoriteSortTab] = useState('recent');
  const loadMoreRef = useRef(null);
  const loadingMoreWorkshopRef = useRef(false);
  const listScrollYRef = useRef(0);

  const pushNotification = useCallback((message, type = 'error', extra = {}) => {
    const payload = typeof message === 'object'
      ? { type, ...message }
      : { ...extra, type, message };

    onNotify(payload);
  }, [onNotify]);

  const showWorkshopError = useCallback((message) => {
    setWorkshopError(message);
    pushNotification(message, 'error');
  }, [pushNotification]);

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

  // Cargar wallpapers de Steam al montar el componente
  useEffect(() => {
    loadSteamWallpapers();
    checkSteamPath();
    checkDownloaderStatus();
    loadVaultAccounts();
  }, []);

  useEffect(() => {
    saveFavorites(favorites);
  }, [favorites]);

  useEffect(() => {
    saveAuthorSubscriptions(subscriptions);
  }, [subscriptions]);

  useEffect(() => {
    localStorage.setItem(USERNAME_STORAGE_KEY, credentials.username);
  }, [credentials.username]);

  useEffect(() => {
    saveSteamAccounts(steamAccounts.map(account => account.username || account));
  }, [steamAccounts]);

  useEffect(() => {
    if (!showMatureContent && favoriteContentTab === 'mature') {
      setFavoriteContentTab('normal');
    }
  }, [favoriteContentTab, showMatureContent]);

  useEffect(() => {
    if (favoritesOnly || !hasMoreWorkshop || workshopLoading) return undefined;

    const node = loadMoreRef.current;
    const requestNextPage = () => {
      if (loadingMoreWorkshopRef.current) return;
      loadingMoreWorkshopRef.current = true;
      searchWorkshop(null, { page: workshopPage + 1, append: true });
    };

    const handleWindowScroll = () => {
      const scrollElement = document.scrollingElement || document.documentElement;
      const remaining = scrollElement.scrollHeight - window.innerHeight - window.scrollY;
      if (remaining <= 1200) {
        requestNextPage();
      }
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        requestNextPage();
      }
    }, { rootMargin: '1000px 0px' });

    if (node) {
      observer.observe(node);
    }
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    const scrollCheckId = window.setTimeout(handleWindowScroll, 0);

    return () => {
      window.clearTimeout(scrollCheckId);
      observer.disconnect();
      window.removeEventListener('scroll', handleWindowScroll);
    };
  }, [
    favoritesOnly,
    hasMoreWorkshop,
    workshopLoading,
    workshopPage,
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

  const loadSteamWallpapers = async () => {
    try {
      if (!window.electronAPI) {
        const message = 'No estás en versión de escritorio. Algunos features no disponibles.';
        setError(message);
        pushNotification(message, 'error');
        return;
      }

      setLoading(true);
      setError(null);

      const result = await window.electronAPI.getSteamWallpapers();

      if (result.success) {
        setSteamWallpapers(result.data);
      } else {
        const message = result.error || 'Error al cargar wallpapers de Steam';
        setError(message);
        pushNotification(message, 'error');
      }
    } catch (err) {
      const message = 'Error: ' + err.message;
      setError(message);
      pushNotification(message, 'error');
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
        if (!result.data?.hasDownloader) {
          pushNotification('No encontré SteamCMD ni DepotDownloader para descargar wallpapers. Revisa Configuración.', 'error');
        }
      } else {
        pushNotification(result.error || 'No se pudo revisar el descargador de Workshop.', 'error');
      }
    } catch (err) {
      pushNotification('Error revisando el descargador: ' + err.message, 'error');
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

  const searchWorkshop = async (event, overrides = {}) => {
    event?.preventDefault();

    try {
      if (!window.electronAPI) return;

      setWorkshopLoading(true);
      setWorkshopError(null);
      const nextQuery = overrides.query ?? searchQuery;
      const nextFilters = overrides.filters ?? workshopFilters;
      const nextPage = overrides.page ?? 1;
      const append = Boolean(overrides.append);
      const requiredTags = getRequiredTags(nextFilters);

      if (!append) {
        setFilterRefreshKey(current => current + 1);
      }

      const result = await window.electronAPI.searchWorkshopWallpapers({
        query: nextQuery,
        page: nextPage,
        limit: PAGE_SIZE,
        sort: nextFilters.sort,
        time: nextFilters.time,
        requiredTags,
        filters: nextFilters,
        matchAllTags: nextFilters.matchAllTags !== false,
        showMatureContent
      });

      if (result.success) {
        const nextItems = result.data.data || [];
        setWorkshopWallpapers(current => append ? mergeUniqueWorkshopWallpapers(current, nextItems) : nextItems);
        setWorkshopTotal(current => append
          ? Math.max(current, Number(result.data.total || 0), (nextPage - 1) * PAGE_SIZE + nextItems.length)
          : Math.max(Number(result.data.total || 0), nextItems.length)
        );
        setWorkshopPage(nextPage);
        setHasMoreWorkshop(Boolean(result.data.hasMore ?? nextItems.length === PAGE_SIZE));
      } else {
        showWorkshopError(result.error || 'Error al consultar Steam Workshop');
      }
    } catch (err) {
      showWorkshopError('Error al consultar Workshop: ' + err.message);
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

  useEffect(() => {
    if (favoritesOnly) return undefined;

    const searchDelay = window.setTimeout(() => {
      loadingMoreWorkshopRef.current = false;
      searchWorkshop(null, {
        query: searchQuery,
        filters: workshopFilters,
        page: 1,
        append: false
      });
    }, 320);

    return () => window.clearTimeout(searchDelay);
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

  const toggleFavorite = (wallpaper) => {
    setFavorites(current => {
      if (current.some(item => item.publishedFileId === wallpaper.publishedFileId)) {
        return current.filter(item => item.publishedFileId !== wallpaper.publishedFileId);
      }

      recordWallpaperInteraction(wallpaper, 'like');
      return [{ ...wallpaper, favoriteAddedAt: Date.now() }, ...current];
    });
  };

  const handleSubscribe = useCallback((authorId, isSubscribed, wallpaper = null) => {
    if (!authorId) return;
    setSubscriptions(current => updateAuthorSubscription(
      current,
      authorId,
      isSubscribed,
      wallpaper ? buildAuthorSubscriptionRecord(wallpaper, 'manual') : { source: 'manual' }
    ));
  }, []);

  const selectedSteamAccount = steamAccounts.find(account => account.username === credentials.username);

  const showDownloadResultPopup = useCallback(async ({
    success = true,
    title = '',
    message = '',
    wallpaper = null,
    path = '',
    error = ''
  } = {}) => {
    if ((success && !shouldShowDownloadConfirmation()) || !window.electronAPI?.showDownloadResult) {
      return;
    }

    try {
      const popupResult = await window.electronAPI.showDownloadResult({
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
        error
      });

      if (!popupResult?.success && popupResult?.error) {
        pushNotification(`No se pudo mostrar o abrir el contenido: ${popupResult.error}`, 'error');
      }
    } catch (popupError) {
      pushNotification(`No se pudo mostrar el aviso de descarga: ${popupError.message}`, 'error');
    }
  }, [pushNotification]);

  const downloadWorkshopWallpaper = async (wallpaper) => {
    try {
      if (!window.electronAPI) return;
      const wallpaperId = getWallpaperId(wallpaper);

      if (!wallpaperId) {
        showWorkshopError('Este wallpaper no tiene ID de Workshop y no se puede descargar.');
        return;
      }

      if (!credentials.username.trim()) {
        showWorkshopError('Configura una cuenta Steam en Configuracion antes de descargar.');
        return;
      }

      if (!downloaderStatus?.hasDownloader) {
        showWorkshopError('No encontre SteamCMD ni DepotDownloader. Abre Configuracion para revisar el diagnostico de descarga.');
        checkDownloaderStatus();
        return;
      }

      setDownloadingId(wallpaperId);
      setWorkshopError(null);
      pushNotification({
        type: 'progress',
        title: 'Descarga iniciada',
        message: `Se esta descargando "${wallpaper.title || 'Wallpaper de Workshop'}".`,
        status: 'Descargando',
        wallpaper
      });

      const result = await window.electronAPI.downloadWorkshopWallpaper({
        publishedFileId: wallpaperId,
        username: credentials.username,
        password: credentials.password
      });

      if (result.success) {
        const downloadedNotificationWallpaper = {
          ...wallpaper,
          ...result.data.wallpaper,
          publishedFileId: wallpaperId || result.data.wallpaper?.publishedFileId
        };

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
        const downloadPath = result.data.path || result.data.wallpaper?.localPath || '';
        void showDownloadResultPopup({
          success: true,
          title: result.data.wallpaper?.title || wallpaper.title || 'Wallpaper descargado',
          message: 'La descarga termino correctamente. Puedes abrir la carpeta del contenido.',
          wallpaper: downloadedNotificationWallpaper,
          path: downloadPath
        });
        pushNotification({
          type: 'success',
          title: 'Descarga completada',
          message: `"${downloadedNotificationWallpaper.title || wallpaper.title || 'Wallpaper'}" ya esta listo para usar.`,
          status: 'Completada',
          wallpaper: downloadedNotificationWallpaper,
          path: downloadPath
        });
        recordWallpaperInteraction(downloadedNotificationWallpaper, 'download');
        const authorId = wallpaper.authorId || wallpaper.author;
        if (authorId) {
          const nextSubscriptions = followAuthorFromWallpaper(downloadedNotificationWallpaper, 'download');
          setSubscriptions(nextSubscriptions);
        }
        loadSteamWallpapers();
      } else {
        const message = result.error || 'No se pudo descargar el wallpaper';
        showWorkshopError(message);
        void showDownloadResultPopup({
          success: false,
          title: 'Descarga fallida',
          message,
          wallpaper,
          error: message
        });
      }
    } catch (err) {
      const message = 'Error al descargar: ' + err.message;
      showWorkshopError(message);
      void showDownloadResultPopup({
        success: false,
        title: 'Descarga fallida',
        message,
        wallpaper,
        error: message
      });
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
        showWorkshopError(result.error || 'No se pudo eliminar el wallpaper');
      }
    } catch (err) {
      showWorkshopError('Error al eliminar: ' + err.message);
      console.error('Error deleting Workshop wallpaper:', err);
    } finally {
      setDeletingId('');
    }
  };

  const handleSetAsWallpaper = useCallback(async (wallpaper) => {
    try {
      if (!window.electronAPI) {
        pushNotification('Esta función solo está disponible en la versión de escritorio.', 'error');
        return;
      }

      if (isSceneWallpaper(wallpaper)) {
        pushNotification([
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
        pushNotification(`Wallpaper "${wallpaper.title}" establecido correctamente.`, 'success');
      } else {
        pushNotification(`Error: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error setting wallpaper:', error);
      pushNotification('Error al establecer wallpaper: ' + error.message, 'error');
    } finally {
      setIsSettingWallpaper(false);
    }
  }, [pushNotification]);

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

  const renderWallpaperGrid = (items) => (
    <div className="steam-grid workshop-grid virtual-grid">
      {items.map(wallpaper => (
        <WorkshopCard
          key={wallpaper.publishedFileId}
          wallpaper={wallpaper}
          downloadedWallpaper={getDownloadedWallpaper(wallpaper)}
          isFavorite={favoriteIds.has(getWallpaperId(wallpaper))}
          isDownloading={downloadingId === getWallpaperId(wallpaper)}
          isDeleting={deletingId === getWallpaperId(wallpaper)}
          downloaderReady={Boolean(downloaderStatus?.hasDownloader)}
          onOpen={openDetailWallpaper}
          onDownload={downloadWorkshopWallpaper}
          onDelete={deleteWorkshopWallpaper}
          onToggleFavorite={toggleFavorite}
        />
      ))}
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
                  {workshopLoading ? (
                    <>
                      <i className="bi bi-arrow-repeat spin-icon"></i>
                      Cargando más wallpapers...
                    </>
                  ) : (
                    <button type="button" onClick={loadMoreWorkshopWallpapers}>
                      <i className="bi bi-chevron-double-down"></i>
                      Cargar mas resultados
                    </button>
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
