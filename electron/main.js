const path = require('path');
const { fileURLToPath, pathToFileURL } = require('url');
const fs = require('fs');
const electron = require('electron');
const { app, BrowserWindow, ipcMain, Menu, shell, protocol, net } = electron;

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
    const results = await workshopService.searchWallpapers(options);
    return { success: true, data: results };
  } catch (error) {
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
    return { success: true, data: await workshopService.getDownloaderStatus() };
  } catch (error) {
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

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
  log('Uncaught exception:', error);
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  log('Unhandled rejection:', error);
});
