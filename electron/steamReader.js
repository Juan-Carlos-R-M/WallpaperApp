const fs = require('fs');
const path = require('path');
const os = require('os');

const WALLPAPER_ENGINE_APP_ID = '431960';
const LOCAL_MEDIA_PROTOCOL = 'local-media';
const DATA_URL_MAX_BYTES = 15 * 1024 * 1024;

class SteamReader {
  constructor({ additionalProjectRoots = [], logger = () => {} } = {}) {
    this.steamPath = null;
    this.additionalProjectRoots = additionalProjectRoots;
    this.logger = logger;
    try {
      this.logger('[SteamReader] Resolviendo ruta de Steam en constructor...');
      this.steamPathPromise = SteamReader.getSteamInstallPath()
        .then(steamPath => {
          this.logger(`[SteamReader] Ruta de Steam resuelta: ${steamPath}`);
          this.steamPath = steamPath;
          return steamPath;
        })
        .catch((err) => {
          this.logger(`[SteamReader] Error resolviendo ruta de Steam: ${err.message}`);
          return null;
        });
    } catch (err) {
      this.logger(`[SteamReader] Excepción en constructor: ${err.message}`);
      this.steamPathPromise = Promise.resolve(null);
    }
  }

  static async getSteamInstallPath() {
    // Rutas comunes de Steam en Windows
    const commonPaths = [
      `C:\\Program Files (x86)\\Steam`,
      `C:\\Program Files\\Steam`,
      `${process.env.PROGRAMFILES || 'C:\\Program Files'}\\Steam`,
      `${process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'}\\Steam`
    ].filter(Boolean);

    // 1. Intentar rutas comunes primero (ultra rápido y síncrono)
    for (const p of commonPaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    // 2. Si no está en las rutas comunes, intentar leer desde el registro con timeout de 2s
    try {
      const Registry = require('winreg');
      const regKey = new Registry({
        hive: Registry.HKEY_CURRENT_USER,
        key: '\\Software\\Valve\\Steam'
      });
      
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Límite de tiempo excedido consultando el registro de Steam'));
        }, 2000);

        regKey.get('SteamPath', (err, item) => {
          clearTimeout(timer);
          if (err) {
            reject(err);
          } else if (item && item.value && fs.existsSync(item.value)) {
            resolve(item.value);
          } else {
            reject(new Error('La ruta de Steam del registro no existe o es inválida'));
          }
        });
      });
    } catch (error) {
      throw new Error('Steam no encontrado');
    }
  }

  static async resolveSteamInstallPath() {
    return SteamReader.getSteamInstallPath();
  }

  static parseSteamLibraries(steamPath) {
    const libraries = [steamPath].filter(Boolean);
    const vdfPath = path.join(steamPath || '', 'steamapps', 'libraryfolders.vdf');

    if (!fs.existsSync(vdfPath)) {
      return libraries;
    }

    try {
      const vdf = fs.readFileSync(vdfPath, 'utf8');
      const regex = /"path"\s+"([^"]+)"/g;
      let match;

      while ((match = regex.exec(vdf))) {
        libraries.push(match[1].replace(/\\\\/g, '\\'));
      }
    } catch {
      // If libraryfolders.vdf cannot be parsed, keep the main Steam folder.
    }

    return Array.from(new Set(libraries));
  }

  static async getWallpaperEnginePaths() {
    const steamPath = await SteamReader.resolveSteamInstallPath().catch(() => null);
    const libraries = SteamReader.parseSteamLibraries(steamPath);
    const installCandidates = [
      process.env.WALLPAPER_ENGINE_PATH,
      ...libraries.map(library => path.join(library, 'steamapps', 'common', 'wallpaper_engine')),
      'C:\\Program Files (x86)\\Steam\\steamapps\\common\\wallpaper_engine',
      'C:\\Program Files\\Steam\\steamapps\\common\\wallpaper_engine',
      'C:\\Program Files (x86)\\Wallpaper Engine',
      'C:\\Program Files\\Wallpaper Engine'
    ].filter(Boolean);

    const installPath = installCandidates.find(candidate => fs.existsSync(candidate)) || null;
    const appDataMyProjects = path.join(os.homedir(), 'AppData', 'Local', 'Wallpaper Engine', 'projects', 'myprojects');
    const myProjectsCandidates = [
      process.env.WALLPAPER_ENGINE_MYPROJECTS_PATH,
      installPath && path.join(installPath, 'projects', 'myprojects'),
      appDataMyProjects
    ].filter(Boolean);
    const existingMyProjects = myProjectsCandidates.find(candidate => fs.existsSync(candidate));
    const myProjectsPath = existingMyProjects
      || process.env.WALLPAPER_ENGINE_MYPROJECTS_PATH
      || (installPath ? path.join(installPath, 'projects', 'myprojects') : null);

    const workshopContentPaths = libraries
      .map(library => path.join(library, 'steamapps', 'workshop', 'content', WALLPAPER_ENGINE_APP_ID))
      .filter(candidate => fs.existsSync(candidate));

    return {
      steamPath,
      libraries,
      installPath,
      projectsPath: myProjectsPath ? path.dirname(myProjectsPath) : null,
      myProjectsPath,
      workshopContentPaths
    };
  }

  async getSteamWallpapers() {
    try {
      this.logger('[SteamReader] Iniciando getSteamWallpapers...');
      const steamPath = this.steamPath || await this.steamPathPromise;
      this.logger(`[SteamReader] steamPath: ${steamPath}`);
      
      this.logger('[SteamReader] Obteniendo rutas de Wallpaper Engine...');
      const enginePaths = await SteamReader.getWallpaperEnginePaths();
      this.logger(`[SteamReader] enginePaths resueltos: ${JSON.stringify(enginePaths)}`);
      
      const wallpaperEnginePath = enginePaths.myProjectsPath || path.join(
        os.homedir(),
        'AppData',
        'Local',
        'Wallpaper Engine',
        'projects'
      );
      
      const roots = [
        fs.existsSync(wallpaperEnginePath) ? wallpaperEnginePath : null,
        ...(enginePaths.workshopContentPaths || []),
        ...this.additionalProjectRoots
      ].filter(Boolean);

      this.logger(`[SteamReader] Raíces a escanear (${roots.length}): ${roots.join(', ')}`);

      const wallpapers = this.readWallpapersFromRoots(roots);
      this.logger(`[SteamReader] Escaneo completado. Encontrados ${wallpapers.length} wallpapers en raíces.`);
      
      if (wallpapers.length > 0) {
        return wallpapers;
      }

      if (!fs.existsSync(wallpaperEnginePath)) {
        this.logger(`[SteamReader] Wallpaper Engine projects path no existe (${wallpaperEnginePath}). Intentando ruta de Steam...`);
        const fallbackWallpapers = this.getWallpapersFromSteam(steamPath);
        this.logger(`[SteamReader] Encontrados ${fallbackWallpapers.length} wallpapers en ruta fallback de Steam.`);
        return fallbackWallpapers;
      }

      return [];
    } catch (error) {
      this.logger(`[SteamReader] ❌ Error leyendo wallpapers de Steam: ${error.stack || error.message}`);
      console.error('Error reading Steam wallpapers:', error);
      return [];
    }
  }

  async getDownloadedWallpapers() {
    this.logger('[SteamReader] Iniciando getDownloadedWallpapers...');
    const appDownloads = this.readWallpapersFromRoots(this.additionalProjectRoots.filter(Boolean));
    this.logger(`[SteamReader] Descargas de la app: ${appDownloads.length} wallpapers`);
    return appDownloads.length > 0 ? appDownloads : this.getSteamWallpapers();
  }

  getWallpapersFromSteam(steamPath) {
    try {
      if (!steamPath) return [];

      const weContentPath = path.join(
        steamPath,
        'steamapps\\common\\wallpaper_engine'
      );

      const libraries = SteamReader.parseSteamLibraries(steamPath);
      const roots = libraries
        .map(library => path.join(library, 'steamapps', 'workshop', 'content', WALLPAPER_ENGINE_APP_ID))
        .filter(candidate => fs.existsSync(candidate));

      this.logger(`[SteamReader] Rutas fallback de Steam a escanear (${roots.length}): ${roots.join(', ')}`);

      if (roots.length > 0) {
        return this.readWallpapersFromRoots(roots);
      }

      if (fs.existsSync(weContentPath)) {
        this.logger(`[SteamReader] Escaneando weContentPath: ${weContentPath}`);
        return this.readWallpapersFromDirectory(weContentPath);
      }

      return [];
    } catch (error) {
      this.logger(`[SteamReader] Error en getWallpapersFromSteam: ${error.message}`);
      console.error('Error getting wallpapers from Steam:', error);
      return [];
    }
  }

  readWallpapersFromDirectory(dirPath, depth = 0) {
    const wallpapers = [];

    try {
      if (!fs.existsSync(dirPath)) return wallpapers;
      if (depth > 5) {
        this.logger(`[SteamReader] ⚠️ Límite de profundidad (5) alcanzado en ${dirPath}`);
        return wallpapers;
      }

      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      entries.forEach(entry => {
        if (entry.isDirectory()) {
          const projectPath = path.join(dirPath, entry.name);
          const configPath = path.join(projectPath, 'project.json');

          if (fs.existsSync(configPath)) {
            try {
              const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
              const wallpaper = this.parseWallpaperConfig(config, projectPath, entry.name);
              if (wallpaper) {
                wallpapers.push(wallpaper);
              }
            } catch (error) {
              this.logger(`[SteamReader] Error parsing config in ${entry.name}: ${error.message}`);
            }
          } else {
            wallpapers.push(...this.readWallpapersFromDirectory(projectPath, depth + 1));
          }
        }
      });

      return wallpapers;
    } catch (error) {
      this.logger(`[SteamReader] Error leyendo directorio ${dirPath}: ${error.message}`);
      return wallpapers;
    }
  }

  readWallpapersFromRoots(roots) {
    this.logger(`[SteamReader] Leyendo wallpapers desde ${roots.length} raíces...`);
    const seen = new Set();
    const wallpapers = [];

    roots.forEach(root => {
      this.readWallpapersFromDirectory(root).forEach(wallpaper => {
        const key = wallpaper.publishedFileId || wallpaper.localPath || wallpaper.mediaUrl || wallpaper.title;
        if (!key || seen.has(key)) return;
        seen.add(key);
        wallpapers.push(wallpaper);
      });
    });

    this.logger(`[SteamReader] Total de wallpapers únicos leídos de raíces: ${wallpapers.length}`);
    return wallpapers;
  }

  readWallpaperFromProject(projectPath, folderName = path.basename(projectPath)) {
    const configPath = path.join(projectPath, 'project.json');

    if (!fs.existsSync(projectPath)) {
      return null;
    }

    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return this.parseWallpaperConfig(config, projectPath, folderName);
      } catch (error) {
        console.error(`Error parsing wallpaper config in ${folderName}:`, error);
      }
    }

    return this.parseWallpaperConfig({ title: folderName }, projectPath, folderName);
  }

  parseWallpaperConfig(config, projectPath, folderName) {
    try {
      const title = config.title || folderName;
      const description = config.description || '';
      const author = config.author || 'Unknown';
      const tags = Array.isArray(config.tags) ? config.tags : [];

      let previewPath = '';
      let previewUrl = '';
      let mediaUrl = '';
      let playbackUrl = '';
      let mediaType = this.normalizeMediaType(config.type);
      const configuredMediaType = mediaType;

      const configuredPreviewPath = config.preview ? path.join(projectPath, config.preview) : '';
      if (configuredPreviewPath && fs.existsSync(configuredPreviewPath)) {
        previewPath = configuredPreviewPath;
        previewUrl = this.toDisplayUrl(configuredPreviewPath);
      } else {
        // Fallback: intentamos también en carpetas típicas del paquete de Workshop
        const fallbackPreviewPath = this.findFirstExistingFile(projectPath, [
          'preview.jpg',
          'preview.png',
          'preview.gif',
          'preview.jpeg',
          path.join('resource', 'image', 'preview.jpg'),
          path.join('image', 'preview.jpg'),
          path.join('assets', 'preview.jpg'),
        ]);

        if (fallbackPreviewPath) {
          previewPath = fallbackPreviewPath;
          previewUrl = this.toDisplayUrl(previewPath);
        }
      }


      const configuredMediaPath = config.file ? path.join(projectPath, config.file) : '';
      if (configuredMediaPath && fs.existsSync(configuredMediaPath)) {
        mediaUrl = configuredMediaPath;
        mediaType = this.inferMediaType(configuredMediaPath, mediaType);
        playbackUrl = this.isPlayableMediaType(mediaType)
          ? this.toPlayableUrl(configuredMediaPath, mediaType)
          : previewUrl;
      } else if (this.isPackagedSceneType(configuredMediaType)) {
        const packagePath = this.findFirstExistingFile(projectPath, [
          'scene.pkg',
          'index.html',
          'main.html'
        ]);
        mediaUrl = packagePath || projectPath;
        mediaType = configuredMediaType;
        playbackUrl = previewUrl;
      } else {
        const fallback = this.findFirstMediaFile(projectPath);
        if (fallback) {
          mediaUrl = fallback.path;
          playbackUrl = this.toPlayableUrl(fallback.path, fallback.type);
          mediaType = fallback.type;
        }
      }

      if (!mediaUrl) {
        mediaUrl = previewPath;
        playbackUrl = previewUrl;
        mediaType = previewPath && previewPath.toLowerCase().endsWith('.gif') ? 'gif' : 'image';
      }

      if (!playbackUrl && !this.isPlayableMediaType(mediaType)) {
        const displayFallback = this.findFirstMediaFile(projectPath);
        playbackUrl = displayFallback ? this.toPlayableUrl(displayFallback.path, displayFallback.type) : previewUrl;
      }

      return {
        publishedFileId: /^\d+$/.test(String(folderName)) ? String(folderName) : (folderName || ''),
        title,
        description,
        author,
        mediaType,
        mediaUrl,
        playbackUrl,
        previewUrl,
        localPath: projectPath,
        fromSteam: true,
        category: 'steam',
        tags: ['steam', 'wallpaper-engine', ...tags]
      };
    } catch (error) {
      console.error('Error parsing wallpaper config:', error);
      return null;
    }
  }

  normalizeMediaType(type) {
    const normalized = String(type || '').toLowerCase();

    if (normalized === 'video') return 'video';
    if (normalized === 'scene') return 'scene';
    if (normalized === 'web') return 'web';
    if (normalized === 'application') return 'application';
    if (normalized === 'gif') return 'gif';
    if (normalized === 'image') return 'image';
    return 'image';
  }

  inferMediaType(filePath, fallback = 'image') {
    const ext = path.extname(filePath).toLowerCase();

    if (['.mp4', '.webm', '.avi', '.mov', '.mkv'].includes(ext)) return 'video';
    if (ext === '.gif') return 'gif';
    if (['.jpg', '.jpeg', '.png', '.bmp', '.webp'].includes(ext)) return 'image';
    return fallback;
  }

  isPlayableMediaType(type) {
    return ['image', 'gif', 'video'].includes(type);
  }

  isPackagedSceneType(type) {
    return ['scene', 'web', 'application'].includes(String(type || '').toLowerCase());
  }

  toPlayableUrl(filePath, mediaType = this.inferMediaType(filePath)) {
    if (mediaType === 'video') {
      return this.toLocalMediaUrl(filePath);
    }

    return this.toDisplayUrl(filePath);
  }

  toDisplayUrl(filePath) {
    return this.toLocalMediaUrl(filePath);
  }

  toDataUrl(filePath) {
    try {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.bmp': 'image/bmp',
        '.webp': 'image/webp'
      };
      const mimeType = mimeTypes[ext];

      if (!mimeType) return '';

      const stats = fs.statSync(filePath);
      if (stats.size > DATA_URL_MAX_BYTES) return '';

      return `data:${mimeType};base64,${fs.readFileSync(filePath).toString('base64')}`;
    } catch {
      return '';
    }
  }

  findFirstExistingFile(projectPath, names) {
    return names.map(name => path.join(projectPath, name)).find(candidate => fs.existsSync(candidate)) || '';
  }

  findFirstMediaFile(projectPath) {
    const orderedExtensions = [
      ['.mp4', 'video'],
      ['.webm', 'video'],
      ['.avi', 'video'],
      ['.mov', 'video'],
      ['.mkv', 'video'],
      ['.gif', 'gif'],
      ['.jpg', 'image'],
      ['.jpeg', 'image'],
      ['.png', 'image'],
      ['.bmp', 'image'],
      ['.webp', 'image']
    ];
    const files = this.listFilesRecursive(projectPath);

    for (const [extension, type] of orderedExtensions) {
      const file = files.find(item => path.extname(item).toLowerCase() === extension);
      if (file) {
        return { path: file, type };
      }
    }

    return null;
  }

  listFilesRecursive(rootPath, limit = 800) {
    const files = [];
    const queue = [rootPath];

    while (queue.length && files.length < limit) {
      const current = queue.shift();
      let entries = [];

      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        const entryPath = path.join(current, entry.name);

        if (entry.isDirectory()) {
          queue.push(entryPath);
        } else if (entry.isFile()) {
          files.push(entryPath);
        }

        if (files.length >= limit) break;
      }
    }

    return files;
  }

  toLocalMediaUrl(filePath) {
    return filePath ? `${LOCAL_MEDIA_PROTOCOL}:///${encodeURIComponent(filePath)}` : '';
  }

  async searchSteamWallpapers(query) {
    try {
      const allWallpapers = await this.getSteamWallpapers();
      const lowerQuery = query.toLowerCase();

      return allWallpapers.filter(wp =>
        wp.title.toLowerCase().includes(lowerQuery) ||
        wp.description.toLowerCase().includes(lowerQuery) ||
        wp.author.toLowerCase().includes(lowerQuery)
      );
    } catch (error) {
      console.error('Error searching wallpapers:', error);
      return [];
    }
  }
}

module.exports = SteamReader;
