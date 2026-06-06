import { useCallback, useEffect, useRef, useState } from 'react';
import { steamService } from '../services/steamService';
import { recordWallpaperInteraction } from '../utils/recommendationSignals';
import { WORKSHOP_PAGE_SIZE } from '../features/steamWorkshop/workshopConfig';
import {
  getRequiredWorkshopTags,
  getWallpaperId,
  mergeUniqueWorkshopWallpapers
} from '../features/steamWorkshop/workshopUtils';

const USERNAME_STORAGE_KEY = 'wallpaperApp.steamUsername';
const ACCOUNTS_STORAGE_KEY = 'wallpaperApp.steamAccounts';
const DEFAULT_STEAM_USERNAME = 'adgjl1182';

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
  const [steamAccounts, setSteamAccounts] = useState(loadSteamAccounts);
  const [credentials, setCredentials] = useState({
    username: localStorage.getItem(USERNAME_STORAGE_KEY) || DEFAULT_STEAM_USERNAME,
    password: ''
  });
  const [downloadingId, setDownloadingId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [filterRefreshKey, setFilterRefreshKey] = useState(0);
  const loadingMoreWorkshopRef = useRef(false);

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
    try {
      if (!steamService.hasElectronApi()) {
        const message = 'No estas en version de escritorio. Algunos features no disponibles.';
        setError(message);
        pushNotification(message, 'error');
        return;
      }

      setLoading(true);
      setError(null);
      setSteamWallpapers(await steamService.getSteamWallpapers());
    } catch (err) {
      const message = 'Error: ' + err.message;
      setError(message);
      pushNotification(message, 'error');
      console.error('Error loading Steam wallpapers:', err);
    } finally {
      setLoading(false);
    }
  }, [pushNotification]);

  const checkSteamPath = useCallback(async () => {
    try {
      if (!steamService.hasElectronApi()) return;
      setSteamPath(await steamService.getSteamPath());
    } catch (err) {
      console.error('Error checking Steam path:', err);
    }
  }, []);

  const checkDownloaderStatus = useCallback(async () => {
    try {
      if (!steamService.hasElectronApi()) return;

      const status = await steamService.getWorkshopDownloaderStatus();
      setDownloaderStatus(status);
      if (!status?.hasDownloader) {
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
      setSteamAccounts(data.accounts);
      setCredentials(current => ({
        ...current,
        username: data.selectedUsername || current.username || DEFAULT_STEAM_USERNAME,
        password: ''
      }));
    } catch (err) {
      console.error('Error loading Steam accounts:', err);
    }
  }, []);

  const searchWorkshop = useCallback(async (event, overrides = {}) => {
    event?.preventDefault();

    try {
      if (!steamService.hasElectronApi()) return;

      setWorkshopLoading(true);
      setWorkshopError(null);
      const nextQuery = overrides.query ?? searchQuery;
      const nextFilters = overrides.filters ?? workshopFilters;
      const nextPage = overrides.page ?? 1;
      const append = Boolean(overrides.append);
      const requiredTags = getRequiredWorkshopTags(nextFilters);

      if (!append) {
        setFilterRefreshKey(current => current + 1);
      }

      const data = await steamService.searchWorkshopWallpapers({
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

      const nextItems = data.data || [];
      setWorkshopWallpapers(current => append ? mergeUniqueWorkshopWallpapers(current, nextItems) : nextItems);
      setWorkshopTotal(current => append
        ? Math.max(current, Number(data.total || 0), (nextPage - 1) * WORKSHOP_PAGE_SIZE + nextItems.length)
        : Math.max(Number(data.total || 0), nextItems.length)
      );
      setWorkshopPage(nextPage);
      setHasMoreWorkshop(Boolean(data.hasMore ?? nextItems.length === WORKSHOP_PAGE_SIZE));
    } catch (err) {
      showWorkshopError('Error al consultar Workshop: ' + err.message);
      console.error('Error searching Workshop:', err);
    } finally {
      setWorkshopLoading(false);
      loadingMoreWorkshopRef.current = false;
    }
  }, [searchQuery, showMatureContent, showWorkshopError, workshopFilters]);

  const loadMoreWorkshopWallpapers = useCallback(() => {
    if (favoritesOnly || workshopLoading || !hasMoreWorkshop || loadingMoreWorkshopRef.current) return;
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

      const data = await steamService.downloadWorkshopWallpaper({
        publishedFileId: wallpaperId,
        username: credentials.username,
        password: credentials.password
      });

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
      void showDownloadResultPopup({
        success: true,
        title: data.wallpaper?.title || wallpaper.title || 'Wallpaper descargado',
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
      loadSteamWallpapers();
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
  }, [
    checkDownloaderStatus,
    credentials.password,
    credentials.username,
    downloaderStatus?.hasDownloader,
    loadSteamWallpapers,
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
      loadSteamWallpapers();
    } catch (err) {
      showWorkshopError('Error al eliminar: ' + err.message);
      console.error('Error deleting Workshop wallpaper:', err);
    } finally {
      setDeletingId('');
    }
  }, [loadSteamWallpapers, onDeleteCompleted, showWorkshopError]);

  useEffect(() => {
    loadSteamWallpapers();
    checkSteamPath();
    checkDownloaderStatus();
    loadVaultAccounts();
  }, [checkDownloaderStatus, checkSteamPath, loadSteamWallpapers, loadVaultAccounts]);

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

    const searchDelay = window.setTimeout(() => {
      loadingMoreWorkshopRef.current = false;
      searchWorkshopRef.current(null, {
        query: searchQueryRef.current,
        filters: workshopFiltersRef.current,
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
    deleteWorkshopWallpaper
  };
};

export default useSteamWorkshop;
