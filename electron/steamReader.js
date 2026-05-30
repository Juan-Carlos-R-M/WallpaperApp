const fs = require('fs');
const path = require('path');
const os = require('os');
const { pathToFileURL } = require('url');

class SteamReader {
  constructor() {
    this.steamPath = null;
    try {
      this.steamPathPromise = Promise.resolve(SteamReader.getSteamInstallPath())
        .then(steamPath => {
          this.steamPath = steamPath;
          return steamPath;
        })
        .catch(() => null);
    } catch {
      this.steamPathPromise = Promise.resolve(null);
    }
  }

  static getSteamInstallPath() {
    const username = os.userInfo().username;
    
    // Rutas comunes de Steam en Windows
    const commonPaths = [
      `C:\\Program Files (x86)\\Steam`,
      `C:\\Program Files\\Steam`,
      `${process.env.PROGRAMFILES}\\Steam`,
      `${process.env.PROGRAMFILES} (x86)\\Steam`,
      // Si usuario cambió la ubicación, intentar desde el registro
    ];

    // Intentar leer desde el registro de Windows
    try {
      const Registry = require('winreg');
      const regKey = new Registry({
        hive: Registry.HKEY_CURRENT_USER,
        key: '\\Software\\Valve\\Steam'
      });
      
      return new Promise((resolve, reject) => {
        regKey.get('SteamPath', (err, item) => {
          if (err) {
            // Si el registro no funciona, buscar en rutas comunes
            for (const p of commonPaths) {
              if (fs.existsSync(p)) {
                resolve(p);
                return;
              }
            }
            reject(new Error('Steam no encontrado'));
          } else {
            resolve(item.value);
          }
        });
      });
    } catch (error) {
      // Si no hay winreg, buscar en rutas comunes
      for (const p of commonPaths) {
        if (fs.existsSync(p)) {
          return p;
        }
      }
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

    return {
      steamPath,
      installPath,
      projectsPath: myProjectsPath ? path.dirname(myProjectsPath) : null,
      myProjectsPath
    };
  }

  async getSteamWallpapers() {
    try {
      const steamPath = this.steamPath || await this.steamPathPromise;
      const enginePaths = await SteamReader.getWallpaperEnginePaths();
      
      // Ruta donde Wallpaper Engine guarda los wallpapers
      const wallpaperEnginePath = enginePaths.myProjectsPath || path.join(
        os.homedir(),
        'AppData',
        'Local',
        'Wallpaper Engine',
        'projects'
      );

      if (!fs.existsSync(wallpaperEnginePath)) {
        console.log('Wallpaper Engine no encontrado, intentando ruta de Steam...');
        return this.getWallpapersFromSteam(steamPath);
      }

      return this.readWallpapersFromDirectory(wallpaperEnginePath);
    } catch (error) {
      console.error('Error reading Steam wallpapers:', error);
      return [];
    }
  }

  getWallpapersFromSteam(steamPath) {
    try {
      if (!steamPath) return [];

      // Ruta de Wallpaper Engine en Steam
      const weContentPath = path.join(
        steamPath,
        'steamapps\\common\\wallpaper_engine'
      );

      if (fs.existsSync(weContentPath)) {
        return this.readWallpapersFromDirectory(weContentPath);
      }

      return [];
    } catch (error) {
      console.error('Error getting wallpapers from Steam:', error);
      return [];
    }
  }

  readWallpapersFromDirectory(dirPath) {
    const wallpapers = [];

    try {
      if (!fs.existsSync(dirPath)) return wallpapers;

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
              console.error(`Error parsing wallpaper config in ${entry.name}:`, error);
            }
          } else {
            wallpapers.push(...this.readWallpapersFromDirectory(projectPath));
          }
        }
      });

      return wallpapers;
    } catch (error) {
      console.error('Error reading wallpapers directory:', error);
      return wallpapers;
    }
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

      let previewUrl = '';
      let mediaUrl = '';
      let mediaType = this.normalizeMediaType(config.type);

      const configuredPreviewPath = config.preview ? path.join(projectPath, config.preview) : '';
      if (configuredPreviewPath && fs.existsSync(configuredPreviewPath)) {
        previewUrl = this.toFileUrl(configuredPreviewPath);
      } else {
        const previewPath = this.findFirstExistingFile(projectPath, [
          'preview.jpg',
          'preview.png',
          'preview.gif',
          'preview.jpeg'
        ]);

        if (previewPath) {
          previewUrl = this.toFileUrl(previewPath);
        }
      }

      const configuredMediaPath = config.file ? path.join(projectPath, config.file) : '';
      if (configuredMediaPath && fs.existsSync(configuredMediaPath)) {
        mediaUrl = configuredMediaPath;
        mediaType = this.inferMediaType(configuredMediaPath, mediaType);
      } else {
        const fallback = this.findFirstMediaFile(projectPath);
        if (fallback) {
          mediaUrl = fallback.path;
          mediaType = fallback.type;
        }
      }

      if (!mediaUrl) {
        mediaUrl = previewUrl;
        mediaType = previewUrl && previewUrl.toLowerCase().endsWith('.gif') ? 'gif' : 'image';
      }

      return {
        title,
        description,
        author,
        mediaType,
        mediaUrl,
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
    if (normalized === 'web') return 'web';
    if (normalized === 'gif') return 'gif';
    return 'image';
  }

  inferMediaType(filePath, fallback = 'image') {
    const ext = path.extname(filePath).toLowerCase();

    if (['.mp4', '.webm', '.avi', '.mov', '.mkv'].includes(ext)) return 'video';
    if (ext === '.gif') return 'gif';
    if (['.jpg', '.jpeg', '.png', '.bmp', '.webp'].includes(ext)) return 'image';
    return fallback;
  }

  findFirstExistingFile(projectPath, names) {
    return names.map(name => path.join(projectPath, name)).find(candidate => fs.existsSync(candidate)) || '';
  }

  findFirstMediaFile(projectPath) {
    const files = fs.readdirSync(projectPath);
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

    for (const [extension, type] of orderedExtensions) {
      const file = files.find(item => path.extname(item).toLowerCase() === extension);
      if (file) {
        return { path: path.join(projectPath, file), type };
      }
    }

    return null;
  }

  toFileUrl(filePath) {
    return filePath ? pathToFileURL(filePath).href : '';
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
