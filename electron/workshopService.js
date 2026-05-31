const { spawn } = require('child_process');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const WALLPAPER_ENGINE_APP_ID = '431960';

class WorkshopService {
  constructor({ userDataPath, steamReader, logger = () => {} }) {
    this.userDataPath = userDataPath;
    this.steamReader = steamReader;
    this.logger = logger;
    this.downloadRoot = path.join(userDataPath, 'WorkshopDownloads');
  }

  async searchWallpapers({
    query = '',
    page = 1,
    limit = 24,
    sort = 'trend',
    time = 'all',
    requiredTags = []
  } = {}) {
    const days = this.timeToDays(time);
    const params = new URLSearchParams({
      appid: WALLPAPER_ENGINE_APP_ID,
      page: String(page),
      numperpage: String(limit),
      browsefilter: this.apiSort(sort),
      return_metadata: '1',
      return_previews: '1',
      return_tags: '1',
      return_vote_data: '1',
      match_all_tags: '0'
    });

    if (days) {
      params.set('days', String(days));
    }

    if (query.trim()) {
      params.set('search_text', query.trim());
    }

    requiredTags.filter(Boolean).forEach(tag => {
      params.append('requiredtags[]', tag);
    });

    const url = `https://api.steampowered.com/IPublishedFileService/QueryFiles/v1/?${params}`;

    try {
      const payload = await this.getJson(url);
      const response = payload.response || {};
      const items = response.publishedfiledetails || [];

      return {
        total: Number(response.total || items.length || 0),
        page,
        data: items.map(item => this.normalizeWorkshopItem(item))
      };
    } catch (error) {
      if (!String(error.message).includes('403')) {
        throw error;
      }

      return this.searchWorkshopHtml({ query, page, limit, sort, time, requiredTags });
    }
  }

  async searchWorkshopHtml({
    query = '',
    page = 1,
    limit = 24,
    sort = 'trend',
    time = 'all',
    requiredTags = []
  } = {}) {
    const params = new URLSearchParams({
      appid: WALLPAPER_ENGINE_APP_ID,
      searchtext: query.trim(),
      browsesort: this.htmlSort(sort),
      section: 'readytouseitems',
      p: String(page)
    });
    const days = this.timeToDays(time);

    if (days) {
      params.set('days', String(days));
    }

    requiredTags.filter(Boolean).forEach(tag => {
      params.append('requiredtags[]', tag);
    });

    const html = await this.getText(`https://steamcommunity.com/workshop/browse/?${params}`);
    const items = [];
    const seen = new Set();
    const regex = /href="https:\/\/steamcommunity\.com\/sharedfiles\/filedetails\/\?id=(\d+)"[^>]*>\s*<img src="([^"]+)" alt="([^"]*)"/g;
    let match;

    while ((match = regex.exec(html)) && items.length < limit) {
      const publishedFileId = match[1];
      if (seen.has(publishedFileId)) continue;
      seen.add(publishedFileId);

      items.push({
        publishedFileId,
        title: this.decodeHtml(match[3]) || 'Workshop wallpaper',
        description: '',
        author: '',
        previewUrl: this.decodeHtml(match[2]),
        url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${publishedFileId}`,
        subscriptions: 0,
        favorited: 0,
        score: 0,
        fileSize: 0,
        timeCreated: 0,
        timeUpdated: 0,
        mediaType: 'workshop',
        tags: []
      });
    }

    return {
      total: items.length,
      page,
      data: items
    };
  }

  apiSort(sort) {
    const sortMap = {
      trend: 'trend',
      popular: 'totaluniquesubscribers',
      recent: 'mostrecent',
      favorites: 'totaluniquefavorites',
      updated: 'lastupdated'
    };

    return sortMap[sort] || sortMap.trend;
  }

  htmlSort(sort) {
    const sortMap = {
      trend: 'trend',
      popular: 'totaluniquesubscribers',
      recent: 'mostrecent',
      favorites: 'totaluniquefavorites',
      updated: 'lastupdated'
    };

    return sortMap[sort] || sortMap.trend;
  }

  timeToDays(time) {
    const dayMap = {
      week: 7,
      month: 30,
      quarter: 90,
      year: 365
    };

    return dayMap[time] || null;
  }

  async downloadWallpaper({ publishedFileId, username = '', password = '', downloader = 'auto' }) {
    if (!publishedFileId) {
      throw new Error('Falta el ID de Workshop.');
    }

    if (!username.trim() || !password) {
      throw new Error('Wallpaper Engine no se descarga como anonimo. Escribe tu usuario y contrasena de Steam antes de descargar.');
    }

    const targetRoot = await this.resolveWallpaperEngineTargetRoot();
    fs.mkdirSync(targetRoot, { recursive: true });
    fs.mkdirSync(this.downloadRoot, { recursive: true });

    const tool = this.resolveDownloader(downloader);
    if (!tool) {
      throw new Error(
        'No encontre DepotDownloader ni SteamCMD. Instala DepotDownloader o SteamCMD y vuelve a intentar.'
      );
    }

    const tempDir = path.join(this.downloadRoot, 'incoming', String(publishedFileId));
    const cacheDir = path.join(this.downloadRoot, String(publishedFileId));
    const targetDir = path.join(targetRoot, String(publishedFileId));
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });

    const args = tool.type === 'depot'
      ? this.buildDepotDownloaderArgs({ publishedFileId, username, password, targetDir: tempDir })
      : this.buildSteamCmdArgs({ publishedFileId, username, password });
    const steamCmdContentDir = path.join(this.downloadRoot, 'steamapps', 'workshop', 'content', WALLPAPER_ENGINE_APP_ID, String(publishedFileId));

    if (tool.type === 'steamcmd') {
      fs.rmSync(steamCmdContentDir, { recursive: true, force: true });
    }

    this.logger(`Starting ${tool.type} download executable=${tool.path} cwd=${tool.type === 'steamcmd' ? this.downloadRoot : tempDir} args=${this.redactArgs(args).join(' ')}`);

    const result = await this.runTool(tool.path, args, {
      cwd: tool.type === 'steamcmd' ? this.downloadRoot : tempDir
    });

    this.logger(`Downloader output for ${publishedFileId}:\n${result.output}`);

    const rawDownloadedDir = tool.type === 'steamcmd' ? steamCmdContentDir : tempDir;
    const projectDir = this.findProjectRoot(rawDownloadedDir);
    this.copyProjectDirectory(projectDir, cacheDir);
    this.copyProjectToMyProjects(projectDir, targetDir);

    const wallpaper = this.steamReader.readWallpaperFromProject(targetDir, String(publishedFileId));

    return {
      output: result.output,
      path: targetDir,
      downloadRoot: targetRoot,
      wallpaper
    };
  }

  async deleteWallpaper({ publishedFileId }) {
    if (!publishedFileId) {
      throw new Error('Falta el ID de Workshop.');
    }

    const id = String(publishedFileId);
    const enginePaths = await this.steamReader.constructor.getWallpaperEnginePaths();
    const candidates = [
      enginePaths.myProjectsPath && path.join(enginePaths.myProjectsPath, id),
      path.join(this.downloadRoot, id),
      path.join(this.downloadRoot, 'incoming', id)
    ].filter(Boolean);
    const deleted = [];

    for (const candidate of candidates) {
      if (!fs.existsSync(candidate)) continue;
      fs.rmSync(candidate, { recursive: true, force: true });
      deleted.push(candidate);
    }

    return {
      deleted,
      publishedFileId: id
    };
  }

  async getDownloaderStatus() {
    const depot = this.findDepotDownloader();
    const steamcmd = this.findSteamCmd();
    const enginePaths = await this.steamReader.constructor.getWallpaperEnginePaths();

    return {
      depotDownloader: depot,
      steamcmd,
      downloadRoot: this.downloadRoot,
      wallpaperEngineTarget: enginePaths.myProjectsPath,
      wallpaperEngineInstall: enginePaths.installPath,
      hasDownloader: Boolean(depot || steamcmd)
    };
  }

  async resolveWallpaperEngineTargetRoot() {
    const enginePaths = await this.steamReader.constructor.getWallpaperEnginePaths();

    if (!enginePaths.myProjectsPath) {
      throw new Error('No encontre la carpeta projects\\myprojects de Wallpaper Engine. Abre Wallpaper Engine una vez o define WALLPAPER_ENGINE_MYPROJECTS_PATH.');
    }

    this.logger(`Wallpaper Engine target folder: ${enginePaths.myProjectsPath}`);
    return enginePaths.myProjectsPath;
  }

  copyProjectToMyProjects(sourceDir, targetDir) {
    this.copyProjectDirectory(sourceDir, targetDir);
  }

  copyProjectDirectory(sourceDir, targetDir) {
    if (!fs.existsSync(sourceDir)) {
      throw new Error(`La descarga termino, pero no encontre el contenido descargado en ${sourceDir}`);
    }

    fs.mkdirSync(path.dirname(targetDir), { recursive: true });
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.cpSync(sourceDir, targetDir, { recursive: true });
  }

  findProjectRoot(downloadedDir) {
    if (!fs.existsSync(downloadedDir)) {
      throw new Error(`La descarga termino, pero no encontre archivos en ${downloadedDir}`);
    }

    if (fs.existsSync(path.join(downloadedDir, 'project.json'))) {
      return downloadedDir;
    }

    const queue = [downloadedDir];
    while (queue.length) {
      const current = queue.shift();
      const entries = fs.readdirSync(current, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const childPath = path.join(current, entry.name);
        if (fs.existsSync(path.join(childPath, 'project.json'))) {
          return childPath;
        }
        queue.push(childPath);
      }
    }

    throw new Error(`La descarga no contiene project.json. Revisa el log para ver que entrego el descargador en ${downloadedDir}`);
  }

  normalizeWorkshopItem(item) {
    const preview = this.getBestPreview(item);
    const tags = Array.isArray(item.tags) ? item.tags.map(tag => tag.tag).filter(Boolean) : [];
    const mediaType = this.inferWorkshopMediaType(tags);

    return {
      publishedFileId: String(item.publishedfileid || ''),
      title: item.title || 'Workshop wallpaper',
      description: this.stripHtml(item.file_description || item.description || ''),
      authorId: item.creator ? String(item.creator) : '',
      author: item.creator || '',
      creator: item.creator ? String(item.creator) : '',
      previewUrl: preview,
      url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${item.publishedfileid}`,
      subscriptions: Number(item.subscriptions || 0),
      favorited: Number(item.favorited || 0),
      score: Number(item.score || 0),
      fileSize: Number(item.file_size || item.consumer_app_id || 0),
      timeCreated: Number(item.time_created || 0),
      timeUpdated: Number(item.time_updated || 0),
      mediaType,
      tags
    };
  }

  inferWorkshopMediaType(tags = []) {
    const normalizedTags = tags.map(tag => String(tag).toLowerCase());

    if (normalizedTags.includes('video')) return 'video';
    if (normalizedTags.includes('web')) return 'web';
    if (normalizedTags.includes('application')) return 'application';
    if (normalizedTags.includes('scene')) return 'scene';
    return 'workshop';
  }

  getBestPreview(item) {
    if (item.preview_url) return item.preview_url;
    if (!Array.isArray(item.previews)) return '';

    const image = item.previews.find(preview => preview.url || preview.preview_url);
    return image ? image.url || image.preview_url : '';
  }

  stripHtml(value) {
    return String(value)
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  getJson(url) {
    return new Promise((resolve, reject) => {
      https.get(url, { headers: this.requestHeaders() }, res => {
        let body = '';

        res.on('data', chunk => {
          body += chunk;
        });

        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Steam API respondio ${res.statusCode}`));
            return;
          }

          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error(`Respuesta invalida de Steam: ${error.message}`));
          }
        });
      }).on('error', reject);
    });
  }

  getText(url) {
    return new Promise((resolve, reject) => {
      https.get(url, { headers: this.requestHeaders() }, res => {
        let body = '';

        res.on('data', chunk => {
          body += chunk;
        });

        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Steam Community respondio ${res.statusCode}`));
            return;
          }

          resolve(body);
        });
      }).on('error', reject);
    });
  }

  requestHeaders() {
    return {
      'User-Agent': 'Mozilla/5.0 Wallpaper-App/1.0'
    };
  }

  decodeHtml(value) {
    return String(value || '')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  resolveDownloader(choice) {
    if (choice === 'depot') {
      const depot = this.findDepotDownloader();
      return depot ? { type: 'depot', path: depot } : null;
    }

    if (choice === 'steamcmd') {
      const steamcmd = this.findSteamCmd();
      return steamcmd ? { type: 'steamcmd', path: steamcmd } : null;
    }

    const depot = this.findDepotDownloader();
    if (depot) return { type: 'depot', path: depot };

    const steamcmd = this.findSteamCmd();
    if (steamcmd) return { type: 'steamcmd', path: steamcmd };

    return null;
  }

  findDepotDownloader() {
    const candidates = [
      process.env.DEPOTDOWNLOADER_PATH,
      path.join(this.userDataPath, 'tools', 'DepotDownloader', 'DepotDownloader.exe'),
      process.resourcesPath && path.join(process.resourcesPath, 'app.asar.unpacked', 'tools', 'DepotDownloader', 'DepotDownloader.exe'),
      path.join(process.cwd(), 'tools', 'DepotDownloader', 'DepotDownloader.exe'),
      path.join(os.homedir(), 'Downloads', 'DepotDownloader', 'DepotDownloader.exe')
    ].filter(Boolean);

    return candidates.find(candidate => fs.existsSync(candidate)) || null;
  }

  findSteamCmd() {
    const candidates = [
      process.env.STEAMCMD_PATH,
      path.join(this.userDataPath, 'tools', 'steamcmd', 'steamcmd.exe'),
      process.resourcesPath && path.join(process.resourcesPath, 'app.asar.unpacked', 'tools', 'steamcmd', 'steamcmd.exe'),
      path.join(process.cwd(), 'tools', 'steamcmd', 'steamcmd.exe'),
      'C:\\steamcmd\\steamcmd.exe',
      path.join(os.homedir(), 'Downloads', 'steamcmd', 'steamcmd.exe')
    ].filter(Boolean);

    return candidates.find(candidate => fs.existsSync(candidate)) || null;
  }

  buildDepotDownloaderArgs({ publishedFileId, username, password, targetDir }) {
    const args = [
      '-app',
      WALLPAPER_ENGINE_APP_ID,
      '-pubfile',
      String(publishedFileId),
      '-dir',
      targetDir,
      '-validate'
    ];

    if (username.trim()) {
      args.push('-username', username.trim());
    }

    if (password) {
      args.push('-password', password);
    }

    return args;
  }

  buildSteamCmdArgs({ publishedFileId, username, password }) {
    const loginArgs = username.trim()
      ? ['+login', username.trim(), password || '']
      : ['+login', 'anonymous'];

    return [
      '+force_install_dir',
      this.downloadRoot,
      ...loginArgs,
      '+workshop_download_item',
      WALLPAPER_ENGINE_APP_ID,
      String(publishedFileId),
      'validate',
      '+quit'
    ];
  }

  runTool(executable, args, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(executable, args, {
        cwd: options.cwd,
        windowsHide: true
      });

      let output = '';

      child.stdout.on('data', chunk => {
        output += chunk.toString();
      });

      child.stderr.on('data', chunk => {
        output += chunk.toString();
      });

      child.on('error', reject);
      child.on('close', code => {
        if (code === 0) {
          resolve({ output });
          return;
        }

        this.logger(`Downloader failed with code ${code}:\n${output}`);
        reject(new Error(this.friendlyDownloaderError(output.trim() || `El descargador termino con codigo ${code}`)));
      });
    });
  }

  redactArgs(args) {
    const loginIndex = args.indexOf('+login');

    return args.map((arg, index) => {
      const previous = args[index - 1];
      if (previous === '-password') return '[REDACTED]';
      if (loginIndex !== -1 && index === loginIndex + 2) return '[REDACTED]';
      return arg;
    });
  }

  friendlyDownloaderError(output) {
    if (output.includes('No username given') || output.includes('Logging anonymously')) {
      return [
        'DepotDownloader intento entrar como anonimo y Steam rechazo Wallpaper Engine.',
        'Escribe usuario y contrasena de Steam en la app antes de descargar.',
        '',
        output
      ].join('\n');
    }

    if (output.includes('Steam Guard') || output.includes('2-factor') || output.includes('two-factor')) {
      return [
        'Steam Guard requiere verificacion adicional y el modo automatico no pudo completarla.',
        'Revisa el log para ver el codigo o mensaje exacto de DepotDownloader.',
        '',
        output
      ].join('\n');
    }

    if (output.includes('not available from this account')) {
      return [
        'Steam rechazo la descarga porque Wallpaper Engine no esta disponible para esa cuenta/sesion.',
        'Confirma que la cuenta compro Wallpaper Engine y vuelve a intentar con usuario y contrasena.',
        '',
        output
      ].join('\n');
    }

    return output;
  }

  toFileUrl(filePath) {
    return filePath ? pathToFileURL(filePath).href : '';
  }
}

module.exports = WorkshopService;
