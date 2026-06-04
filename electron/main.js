const path = require('path');
const { fileURLToPath, pathToFileURL } = require('url');
const fs = require('fs');
const electron = require('electron');
const { app, BrowserWindow, ipcMain, Menu, shell, protocol, net, dialog } = electron;

if (!app) {
  try {
    fs.writeFileSync(
      path.join(process.cwd(), 'electron-bootstrap-error.log'),
      `require('electron') returned: ${JSON.stringify(electron)}`
    );
  } catch {
    // Nothing else can be done before Electron's app module is available.
  }
  process.exit(1);
}

const isDev = !app.isPackaged;
const SteamReader = require('./steamReader');
const WallpaperManager = require('./wallpaperManager');
const WorkshopService = require('./workshopService');
const AccountStore = require('./accountStore');
const LOCAL_MEDIA_PROTOCOL = 'local-media';

const MIME_EXTENSION_MAP = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'video/x-matroska': 'mkv'
};

const MEDIA_TYPE_EXTENSION_MAP = {
  gif: 'gif',
  image: 'jpg',
  video: 'mp4'
};

let mainWindow;
let steamReader;
let wallpaperManager;
let workshopService;
let accountStore;
let bundledServer;

if (app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('appData'), 'Wallpaper App Desktop'));
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: LOCAL_MEDIA_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true
    }
  }
]);

const getLogPath = () => path.join(app.getPath('userData'), 'main.log');

const log = (message, error) => {
  const details = error ? ` ${error.stack || error.message || error}` : '';
  const line = `[${new Date().toISOString()}] ${message}${details}\n`;

  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.appendFileSync(getLogPath(), line);
  } catch {
    // Logging must never prevent app startup.
  }
};

const startBundledServer = async () => {
  if (isDev || bundledServer) return;

  process.env.PORT = process.env.PORT || '5000';

  try {
    log('Starting bundled server');
    const serverRoot = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'server')
      : path.join(app.getAppPath(), 'server');
    const serverPath = path.join(serverRoot, 'index.js');
    const serverModule = await import(pathToFileURL(serverPath).href);
    bundledServer = serverModule.server;
    log('Bundled server started');
  } catch (error) {
    log('Error starting bundled server:', error);
    console.error('Error starting bundled server:', error);
  }
};

const stopBundledServer = () => {
  if (bundledServer) {
    bundledServer.close();
    bundledServer = null;
  }
};

const registerLocalMediaProtocol = () => {
  protocol.handle(LOCAL_MEDIA_PROTOCOL, (request) => {
    try {
      const mediaUrl = new URL(request.url);
      const filePath = decodeURIComponent(mediaUrl.pathname.replace(/^\/+/, ''));

      if (!filePath) {
        return new Response('Media path is empty', { status: 404 });
      }

      return net.fetch(pathToFileURL(filePath).href);
    } catch (error) {
      log('Error resolving local media URL:', error);
      return new Response('Unable to load media', { status: 500 });
    }
  });
};

const sanitizeFileName = (value = 'wallpaper') => {
  const safe = String(value)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+|\.+$/g, '')
    .trim();

  return safe || 'wallpaper';
};

const getMimeTypeFromDataUrl = (value = '') => {
  const match = /^data:([^;,]+)/i.exec(String(value));
  return match?.[1]?.toLowerCase() || '';
};

const getExtensionFromMimeType = (mimeType = '') => {
  const normalized = String(mimeType).split(';')[0].trim().toLowerCase();
  return MIME_EXTENSION_MAP[normalized] || '';
};

const getExtensionFromSource = (value = '') => {
  const source = String(value);
  const mimeExtension = getExtensionFromMimeType(getMimeTypeFromDataUrl(source));
  if (mimeExtension) return mimeExtension;

  let pathname = source.split(/[?#]/)[0];
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(source) && !/^[a-zA-Z]:[\\/]/.test(source)) {
      pathname = new URL(source).pathname;
    }
  } catch {
    pathname = source;
  }

  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    // Keep the original path when it is not valid percent-encoded text.
  }

  const extension = path.extname(pathname).replace(/^\./, '').toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(extension) ? extension : '';
};

const getUniqueDownloadPath = (directory, fileName) => {
  const extension = path.extname(fileName);
  const baseName = path.basename(fileName, extension);
  let candidate = path.join(directory, fileName);
  let index = 1;

  while (fs.existsSync(candidate)) {
    candidate = path.join(directory, `${baseName} (${index})${extension}`);
    index += 1;
  }

  return candidate;
};

const buildDownloadFileName = ({ title, mediaType, source, mimeType, fileName } = {}) => {
  const providedExtension = path.extname(fileName || '').replace(/^\./, '').toLowerCase();
  const extension = getExtensionFromMimeType(mimeType)
    || getExtensionFromSource(source)
    || (providedExtension && /^[a-z0-9]{1,8}$/.test(providedExtension) ? providedExtension : '')
    || MEDIA_TYPE_EXTENSION_MAP[String(mediaType || '').toLowerCase()]
    || 'jpg';
  const baseName = sanitizeFileName(path.basename(fileName || title || 'wallpaper', path.extname(fileName || '')));

  return `${baseName}.${extension}`;
};

const parseDataUrl = (value = '') => {
  const match = /^data:([^;,]+)?((?:;[^,]*)*),(.*)$/i.exec(String(value));
  if (!match) {
    throw new Error('La URL de datos no es valida.');
  }

  const mimeType = match[1] || '';
  const metadata = match[2] || '';
  const body = match[3] || '';
  const buffer = metadata.toLowerCase().includes(';base64')
    ? Buffer.from(body, 'base64')
    : Buffer.from(decodeURIComponent(body), 'utf8');

  return { buffer, mimeType };
};

const resolveLocalFilePath = (value = '') => {
  const source = String(value);
  if (/^[a-zA-Z]:[\\/]/.test(source) || source.startsWith('\\\\')) {
    return source;
  }

  if (source.startsWith(`${LOCAL_MEDIA_PROTOCOL}:`)) {
    const mediaUrl = new URL(source);
    return decodeURIComponent(mediaUrl.pathname.replace(/^\/+/, ''));
  }

  if (source.startsWith('file:')) {
    return fileURLToPath(source);
  }

  return '';
};

const saveBufferToDownloads = ({ buffer, title, mediaType, source, mimeType, fileName }) => {
  if (!buffer?.length) {
    throw new Error('El archivo descargado esta vacio.');
  }

  const downloadsDir = app.getPath('downloads');
  fs.mkdirSync(downloadsDir, { recursive: true });
  const finalFileName = buildDownloadFileName({ title, mediaType, source, mimeType, fileName });
  const targetPath = getUniqueDownloadPath(downloadsDir, finalFileName);
  fs.writeFileSync(targetPath, buffer);

  return {
    path: targetPath,
    fileName: path.basename(targetPath)
  };
};

const copyLocalFileToDownloads = ({ localFilePath, title, mediaType, source, fileName }) => {
  if (!fs.existsSync(localFilePath)) {
    throw new Error(`No encontre el archivo local: ${localFilePath}`);
  }

  const stats = fs.statSync(localFilePath);
  if (!stats.isFile()) {
    throw new Error('La fuente de descarga no es un archivo.');
  }

  const downloadsDir = app.getPath('downloads');
  fs.mkdirSync(downloadsDir, { recursive: true });
  const finalFileName = buildDownloadFileName({ title, mediaType, source: localFilePath || source, fileName });
  const targetPath = getUniqueDownloadPath(downloadsDir, finalFileName);
  fs.copyFileSync(localFilePath, targetPath);

  return {
    path: targetPath,
    fileName: path.basename(targetPath)
  };
};

const downloadRemoteFileToDownloads = async ({ source, title, mediaType, fileName }) => {
  const response = await net.fetch(source);
  if (!response.ok) {
    throw new Error(`La descarga respondio ${response.status}`);
  }

  const mimeType = response.headers.get('content-type') || '';
  const buffer = Buffer.from(await response.arrayBuffer());
  return saveBufferToDownloads({ buffer, title, mediaType, source, mimeType, fileName });
};

const saveWallpaperSourceToDownloads = async ({ source, title, mediaType, fileName }) => {
  if (!source) {
    throw new Error('Este wallpaper no tiene una fuente de descarga valida.');
  }

  const localFilePath = resolveLocalFilePath(source);
  if (localFilePath) {
    return copyLocalFileToDownloads({ localFilePath, title, mediaType, source, fileName });
  }

  if (String(source).startsWith('data:')) {
    const { buffer, mimeType } = parseDataUrl(source);
    return saveBufferToDownloads({ buffer, title, mediaType, source, mimeType, fileName });
  }

  if (/^https?:\/\//i.test(String(source))) {
    return downloadRemoteFileToDownloads({ source, title, mediaType, fileName });
  }

  throw new Error(`No se reconoce la fuente de descarga: ${source}`);
};

const createWindow = () => {
  log('Creating main window');
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: true
    },
    icon: path.join(__dirname, '../client/public/icon.png')
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    const indexPath = path.join(app.getAppPath(), 'client', 'dist', 'index.html');
    log(`Loading file ${indexPath}`);
    mainWindow.loadFile(indexPath);
  }

  mainWindow.webContents.on('did-finish-load', () => log('Renderer finished load'));
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    log(`Renderer failed load ${errorCode}: ${errorDescription}`);
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log(`Renderer process gone: ${JSON.stringify(details)}`);
  });
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      log(`Renderer console level=${level} ${sourceId}:${line} ${message}`);
    }
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    log('Main window closed');
    mainWindow = null;
  });

  mainWindow.show();
  mainWindow.focus();
};

// IPC Handlers para Steam/Wallpaper Engine
ipcMain.handle('get-steam-wallpapers', async () => {
  try {
    const wallpapers = await steamReader.getSteamWallpapers();
    return { success: true, data: wallpapers };
  } catch (error) {
    console.error('Error getting Steam wallpapers:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-downloaded-wallpapers', async () => {
  try {
    const wallpapers = await steamReader.getDownloadedWallpapers();
    return { success: true, data: wallpapers };
  } catch (error) {
    console.error('Error getting downloaded wallpapers:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-wallpaper-file', async (_event, options = {}) => {
  const sources = [
    options.sourceUrl,
    options.mediaUrl,
    options.previewUrl
  ].filter(Boolean);

  let lastError;

  for (const source of sources) {
    try {
      const saved = await saveWallpaperSourceToDownloads({
        source,
        title: options.title,
        mediaType: options.mediaType,
        fileName: options.fileName
      });

      log(`Wallpaper file saved to ${saved.path}`);
      return { success: true, data: saved };
    } catch (error) {
      lastError = error;
      log(`Unable to save wallpaper source ${source}:`, error);
    }
  }

  return {
    success: false,
    error: lastError?.message || 'No se pudo descargar el wallpaper.'
  };
});

ipcMain.handle('delete-wallpaper-file', async (_event, options = {}) => {
  try {
    const targetPath = resolveLocalFilePath(options.localPath || options.path || options.downloadPath);
    if (!targetPath) {
      return { success: false, error: 'No se encontro una ruta local para eliminar.' };
    }

    const downloadsDir = path.resolve(app.getPath('downloads'));
    const resolvedTarget = path.resolve(targetPath);
    if (!resolvedTarget.toLowerCase().startsWith(downloadsDir.toLowerCase() + path.sep)) {
      return { success: false, error: 'Solo puedo eliminar archivos descargados en tu carpeta de Descargas.' };
    }

    if (!fs.existsSync(resolvedTarget)) {
      return { success: true, data: { deleted: false, path: resolvedTarget } };
    }

    const stats = fs.statSync(resolvedTarget);
    if (!stats.isFile()) {
      return { success: false, error: 'La ruta no apunta a un archivo descargado.' };
    }

    fs.unlinkSync(resolvedTarget);
    log(`Wallpaper file deleted from ${resolvedTarget}`);
    return { success: true, data: { deleted: true, path: resolvedTarget } };
  } catch (error) {
    log('Error deleting wallpaper file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('set-wallpaper', async (event, wallpaperPath) => {
  try {
    const success = await wallpaperManager.setWallpaper(wallpaperPath);
    return { success };
  } catch (error) {
    console.error('Error setting wallpaper:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-steam-path', async () => {
  try {
    const paths = await SteamReader.getWallpaperEnginePaths();
    return { success: true, path: paths.steamPath, data: paths };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('search-steam-wallpapers', async (event, query) => {
  try {
    const results = await steamReader.searchSteamWallpapers(query);
    return { success: true, data: results };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('search-workshop-wallpapers', async (_event, options) => {
  try {
    log(`Workshop search requested query="${options?.query || ''}" page=${options?.page || 1}`);
    const results = await workshopService.searchWallpapers(options);
    return { success: true, data: results };
  } catch (error) {
    log('Error searching Workshop wallpapers:', error);
    console.error('Error searching Workshop wallpapers:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-workshop-wallpaper', async (_event, options) => {
  try {
    const username = options?.username || accountStore.listAccounts().selectedUsername;
    const password = options?.password || accountStore.getPassword(username);
    log(`Download requested for Workshop item ${options?.publishedFileId} username=${username ? 'provided' : 'missing'} password=${password ? 'stored/provided' : 'missing'}`);
    const result = await workshopService.downloadWallpaper({ ...options, username, password });
    log(`Download completed for Workshop item ${options?.publishedFileId}`);
    return { success: true, data: result };
  } catch (error) {
    log(`Error downloading Workshop item ${options?.publishedFileId}:`, error);
    console.error('Error downloading Workshop wallpaper:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-workshop-wallpaper', async (_event, options = {}) => {
  try {
    const result = await workshopService.deleteWallpaper(options);
    log(`Deleted Workshop item ${options?.publishedFileId}: ${result.deleted.join(', ') || 'nothing to delete'}`);
    return { success: true, data: result };
  } catch (error) {
    log(`Error deleting Workshop item ${options?.publishedFileId}:`, error);
    console.error('Error deleting Workshop wallpaper:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('steam-accounts-list', async () => {
  try {
    return { success: true, data: accountStore.listAccounts() };
  } catch (error) {
    log('Error listing Steam accounts:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('steam-accounts-save', async (_event, account) => {
  try {
    return { success: true, data: accountStore.saveAccount(account) };
  } catch (error) {
    log('Error saving Steam account:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('steam-accounts-remove', async (_event, username) => {
  try {
    return { success: true, data: accountStore.removeAccount(username) };
  } catch (error) {
    log('Error removing Steam account:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('steam-accounts-select', async (_event, username) => {
  try {
    return { success: true, data: accountStore.selectAccount(username) };
  } catch (error) {
    log('Error selecting Steam account:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-workshop-downloader-status', async () => {
  try {
    const status = await workshopService.getDownloaderStatus();
    if (!status.hasDownloader) {
      log(`Workshop downloader missing. SteamCMD and DepotDownloader were not detected. Checked paths:\n${status.searchedDownloaderPaths.join('\n')}`);
    }
    return { success: true, data: status };
  } catch (error) {
    log('Error getting Workshop downloader status:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-workshop-author-name', async (_event, publishedFileId) => {
  try {
    const authorName = await workshopService.getWorkshopAuthorName(String(publishedFileId));
    return { success: true, data: authorName };
  } catch (error) {
    log(`Error getting Workshop author name for ${publishedFileId}:`, error);
    console.error('Error getting Workshop author name:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-workshop-author-profile', async (_event, authorId, options = {}) => {
  try {
    const data = await workshopService.getWorkshopAuthorProfile(String(authorId), options);
    return { success: true, data };
  } catch (error) {
    log(`Error getting Workshop author profile for ${authorId}:`, error);
    console.error('Error getting Workshop author profile:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-app-log-info', async () => {
  try {
    const logPath = getLogPath();
    const exists = fs.existsSync(logPath);
    return {
      success: true,
      data: {
        path: logPath,
        exists,
        size: exists ? fs.statSync(logPath).size : 0
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-app-log', async () => {
  try {
    const logPath = getLogPath();
    if (!fs.existsSync(logPath)) {
      return { success: true, data: '' };
    }

    const lines = fs.readFileSync(logPath, 'utf8').split(/\r?\n/);
    return { success: true, data: lines.slice(-500).join('\n') };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-path', async (_event, targetPath) => {
  try {
    if (!targetPath) {
      return { success: false, error: 'Ruta vacia' };
    }

    const result = await shell.openPath(targetPath);
    return result ? { success: false, error: result } : { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

const escapeHtml = (value = '') => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatDialogSize = (size) => {
  const number = Number(size || 0);
  if (!Number.isFinite(number) || number <= 0) return '';
  if (number >= 1024 * 1024 * 1024) return `${(number / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (number >= 1024 * 1024) return `${(number / (1024 * 1024)).toFixed(1)} MB`;
  if (number >= 1024) return `${(number / 1024).toFixed(1)} KB`;
  return `${number} B`;
};

const getDialogResolution = (wallpaper = {}, fallback = '') => {
  if (fallback) return String(fallback);
  if (wallpaper.width && wallpaper.height) return `${wallpaper.width} x ${wallpaper.height}`;
  if (wallpaper.resolution) return String(wallpaper.resolution);
  return '';
};

const createDownloadResultHtml = ({
  success,
  title,
  message,
  wallpaper = {},
  targetPath = '',
  error = ''
}) => {
  const safeTitle = escapeHtml(title || (success ? 'Wallpaper descargado' : 'Descarga fallida'));
  const safeMessage = escapeHtml(message || (success
    ? 'El wallpaper se ha descargado correctamente.'
    : error || 'No se pudo completar la descarga.'));
  const wallpaperTitle = escapeHtml(wallpaper.title || wallpaper.wallpaperTitle || title || 'Wallpaper');
  const author = escapeHtml(wallpaper.author || wallpaper.authorName || wallpaper.creator || 'Autor desconocido');
  const previewUrl = escapeHtml(wallpaper.previewUrl || wallpaper.image || wallpaper.thumbnail || '');
  const mediaType = escapeHtml(wallpaper.mediaType || wallpaper.type || 'Workshop');
  const resolution = escapeHtml(getDialogResolution(wallpaper, wallpaper.resolution));
  const size = escapeHtml(formatDialogSize(wallpaper.fileSize || wallpaper.size) || String(wallpaper.fileSize || wallpaper.size || ''));
  const downloadedAt = escapeHtml(new Date().toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }));
  const tags = (Array.isArray(wallpaper.tags) ? wallpaper.tags : [])
    .slice(0, 4)
    .map(tag => `<span>${escapeHtml(tag)}</span>`)
    .join('');
  const safePath = escapeHtml(targetPath);
  const icon = success ? '↓' : '!';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src * data: local-media: file:; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>${safeTitle}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      overflow: hidden;
      color: #f7f3f4;
      font-family: Inter, "Segoe UI", Arial, sans-serif;
      background: #050505;
    }
    .dialog {
      display: grid;
      grid-template-rows: auto 1fr auto;
      min-height: 100vh;
      border: 1px solid rgba(255, 38, 54, 0.26);
      border-radius: 18px;
      background:
        radial-gradient(circle at 72% 18%, rgba(224, 20, 38, 0.12), transparent 34%),
        linear-gradient(135deg, rgba(16, 16, 17, 0.98), rgba(3, 3, 4, 0.99));
    }
    header {
      display: grid;
      grid-template-columns: 74px 1fr 42px;
      gap: 18px;
      align-items: center;
      padding: 30px 34px 28px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .status-icon {
      display: grid;
      width: 56px;
      height: 56px;
      place-items: center;
      border: 3px solid rgba(255, 34, 52, 0.82);
      border-radius: 50%;
      color: #ff2438;
      font-size: 34px;
      line-height: 1;
    }
    h1 { margin: 0 0 8px; font-size: 26px; line-height: 1.15; }
    header p { margin: 0; color: rgba(255,255,255,0.58); font-size: 15px; }
    .close {
      width: 42px;
      height: 42px;
      border: 0;
      color: #ff2438;
      background: transparent;
      font-size: 30px;
      text-decoration: none;
      text-align: center;
      line-height: 38px;
    }
    main {
      display: grid;
      grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.8fr);
      gap: 34px;
      padding: 28px 34px;
      align-items: center;
    }
    .preview {
      width: 100%;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      border-radius: 10px;
      background: rgba(255,255,255,0.04);
    }
    .preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .preview-empty {
      display: grid;
      width: 100%;
      height: 100%;
      place-items: center;
      color: rgba(255,255,255,0.45);
      font-size: 54px;
    }
    .details { display: grid; gap: 20px; min-width: 0; }
    .source {
      justify-self: start;
      padding: 8px 12px;
      border-radius: 7px;
      color: #ff615f;
      background: rgba(211, 22, 34, 0.42);
      font-weight: 900;
      text-transform: uppercase;
    }
    h2 { margin: 0; font-size: 30px; line-height: 1.15; }
    .author { margin: -10px 0 0; color: rgba(255,255,255,0.5); font-size: 18px; }
    .tags { display: flex; flex-wrap: wrap; gap: 10px; }
    .tags span {
      padding: 9px 13px;
      border: 1px solid rgba(255, 34, 52, 0.34);
      border-radius: 7px;
      color: #ff454d;
      background: rgba(255, 34, 52, 0.06);
    }
    .meta { display: grid; border-top: 1px solid rgba(255,255,255,0.08); }
    .meta-row {
      display: grid;
      grid-template-columns: 34px 1fr;
      gap: 14px;
      padding: 15px 0;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .meta-row i { color: #ff2438; font-style: normal; font-size: 20px; }
    .meta-row strong { display: block; margin-bottom: 4px; font-size: 14px; }
    .meta-row span { color: rgba(255,255,255,0.58); line-height: 1.35; overflow-wrap: anywhere; }
    footer {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 22px;
      padding: 24px 34px 30px;
      border-top: 1px solid rgba(255,255,255,0.08);
    }
    footer a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 54px;
      border-radius: 8px;
      color: #fff;
      text-decoration: none;
      font-size: 17px;
      font-weight: 900;
    }
    .secondary {
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(255,255,255,0.03);
    }
    .primary {
      background: linear-gradient(135deg, #ec1528, #bf0718);
      box-shadow: 0 16px 40px rgba(236, 21, 40, 0.22);
    }
  </style>
</head>
<body>
  <section class="dialog">
    <header>
      <span class="status-icon">${icon}</span>
      <div>
        <h1>${safeTitle}</h1>
        <p>${safeMessage}</p>
      </div>
      <a class="close" href="wallpaper-alert://accept" aria-label="Cerrar">×</a>
    </header>
    <main>
      <div class="preview">${previewUrl ? `<img src="${previewUrl}" alt="">` : '<div class="preview-empty">▧</div>'}</div>
      <aside class="details">
        <span class="source">${mediaType}</span>
        <h2>${wallpaperTitle}</h2>
        <p class="author">by ${author}</p>
        ${tags ? `<div class="tags">${tags}</div>` : ''}
        <div class="meta">
          ${safePath ? `<div class="meta-row"><i>▣</i><div><strong>Ubicacion</strong><span>${safePath}</span></div></div>` : ''}
          ${resolution ? `<div class="meta-row"><i>▧</i><div><strong>Resolucion</strong><span>${resolution}</span></div></div>` : ''}
          ${size ? `<div class="meta-row"><i>◇</i><div><strong>Tamano</strong><span>${size}</span></div></div>` : ''}
          <div class="meta-row"><i>◷</i><div><strong>Descargado el</strong><span>${downloadedAt}</span></div></div>
        </div>
      </aside>
    </main>
    <footer>
      ${success && safePath ? '<a class="secondary" href="wallpaper-alert://open">Abrir ubicacion</a>' : '<span></span>'}
      <a class="primary" href="wallpaper-alert://accept">Aceptar</a>
    </footer>
  </section>
</body>
</html>`;
};

const showDownloadResultWindow = (parentWindow, options = {}) => new Promise((resolve, reject) => {
  const success = options.success !== false;
  const targetPath = String(options.path || options.localPath || '').trim();
  const wallpaper = {
    ...(options.wallpaper || {}),
    title: options.wallpaper?.title || options.wallpaperTitle || options.title,
    author: options.author || options.wallpaper?.author,
    tags: options.tags || options.wallpaper?.tags,
    previewUrl: options.previewUrl || options.wallpaper?.previewUrl,
    resolution: options.resolution || options.wallpaper?.resolution,
    fileSize: options.fileSize || options.wallpaper?.fileSize,
    mediaType: options.mediaType || options.wallpaper?.mediaType
  };
  let settled = false;

  const alertWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    parent: parentWindow || undefined,
    modal: Boolean(parentWindow),
    show: false,
    frame: false,
    resizable: true,
    backgroundColor: '#050505',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  const finish = (action = 'accept') => {
    if (settled) return;
    settled = true;
    resolve({ success: true, action });
    if (!alertWindow.isDestroyed()) alertWindow.close();
  };

  alertWindow.once('ready-to-show', () => alertWindow.show());
  alertWindow.once('closed', () => finish('accept'));
  alertWindow.webContents.on('will-navigate', (navigationEvent, navigationUrl) => {
    if (!navigationUrl.startsWith('wallpaper-alert://')) return;
    navigationEvent.preventDefault();
    finish(navigationUrl.includes('open') ? 'open' : 'accept');
  });
  alertWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('wallpaper-alert://')) {
      finish(url.includes('open') ? 'open' : 'accept');
    }
    return { action: 'deny' };
  });
  alertWindow.webContents.once('did-fail-load', (_event, _code, description) => reject(new Error(description)));

  const html = createDownloadResultHtml({
    success,
    title: success ? (options.title || 'Wallpaper descargado') : (options.title || 'Descarga fallida'),
    message: options.message,
    wallpaper,
    targetPath,
    error: options.error
  });

  alertWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
});

ipcMain.handle('show-download-result', async (event, options = {}) => {
  try {
    const success = options.success !== false;
    const targetPath = String(options.path || options.localPath || '').trim();
    const hasPath = Boolean(targetPath);
    const parentWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const result = await showDownloadResultWindow(parentWindow, options);

    if (success && hasPath && result.action === 'open') {
      const openResult = await shell.openPath(targetPath);
      if (openResult) {
        return { success: false, error: openResult };
      }
    }

    return result;
  } catch (error) {
    log('Error showing download result dialog:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.on('renderer-log', (_event, payload = {}) => {
  log(`Renderer ${payload.level || 'log'}: ${payload.message || ''}`);
});

app.on('ready', async () => {
  log('App ready');
  registerLocalMediaProtocol();
  steamReader = new SteamReader({
    additionalProjectRoots: [
      path.join(app.getPath('userData'), 'WorkshopDownloads')
    ]
  });
  wallpaperManager = new WallpaperManager();
  accountStore = new AccountStore({
    userDataPath: app.getPath('userData'),
    logger: log
  });
  workshopService = new WorkshopService({
    userDataPath: app.getPath('userData'),
    steamReader,
    logger: log
  });
  await startBundledServer();
  createWindow();
  createMenu();
});

app.on('window-all-closed', () => {
  log('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => log('App before quit'));

app.on('before-quit', stopBundledServer);

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

const createMenu = () => {
  const template = [
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Salir',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { label: 'Deshacer', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Rehacer', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: 'Cortar', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copiar', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Pegar', accelerator: 'CmdOrCtrl+V', role: 'paste' }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Acerca de',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Acerca de Wallpaper App',
              message: 'Wallpaper App v1.0.0',
              detail: 'Una aplicación de escritorio para gestionar wallpapers con integración a Steam Wallpaper Engine'
            });
          }
        }
      ]
    }
  ];

  Menu.setApplicationMenu(null);
};

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
  log('Uncaught exception:', error);
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  log('Unhandled rejection:', error);
});
