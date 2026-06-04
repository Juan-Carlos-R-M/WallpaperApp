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
    this.authorProfileCache = new Map();
  }

  async searchWallpapers({
    query = '',
    page = 1,
    limit = 24,
    sort = 'trend',
    time = 'all',
    requiredTags = []
  } = {}) {
    const ids = await this.fetchWorkshopIdsFromSearch({ query, page, limit, sort, time, requiredTags });
    if (!ids.length) {
      return { total: 0, page, data: [] };
    }

    const items = await this.getWorkshopItemsByIds(ids);

    return {
      total: items.length,
      page,
      data: items
    };
  }

  async fetchWorkshopIdsFromSearch({
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
    const ids = [];
    const seen = new Set();
    const regex = /href="https:\/\/steamcommunity\.com\/sharedfiles\/filedetails\/\?id=(\d+)"/g;
    let match;

    while ((match = regex.exec(html)) && ids.length < limit) {
      const publishedFileId = match[1];
      if (seen.has(publishedFileId)) continue;
      seen.add(publishedFileId);
      ids.push(publishedFileId);
    }

    return ids;
  }

  async getWorkshopItemsByIds(publishedFileIds = []) {
    const ids = [...new Set(publishedFileIds.map(id => String(id).trim()).filter(Boolean))].slice(0, 100);
    if (!ids.length) {
      return [];
    }

    const params = new URLSearchParams();
    params.append('itemcount', String(ids.length));
    ids.forEach((id, index) => {
      params.append(`publishedfileids[${index}]`, id);
    });

    const url = 'https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/';

    try {
      const response = await this.postForm(url, params);
      const details = response?.response?.publishedfiledetails || [];
      const items = details
        .filter(item => Number(item.result || 1) === 1)
        .map(item => this.normalizeWorkshopItem(item));

      return this.attachAuthorProfiles(items);
    } catch (error) {
      this.logger(`GetPublishedFileDetails fallo: ${error.message}`);
      return [];
    }
  }

  async getWorkshopAuthorProfile(authorId, { limit = 24 } = {}) {
    const profile = await this.resolveWorkshopAuthorProfile(authorId);
    const wallpapers = await this.getWorkshopItemsByAuthor(authorId, { limit });

    return {
      profile: profile || {
        id: String(authorId || ''),
        name: String(authorId || 'Autor'),
        handle: authorId ? `@${String(authorId).slice(0, 12)}` : '',
        url: authorId ? `https://steamcommunity.com/profiles/${encodeURIComponent(authorId)}` : ''
      },
      wallpapers
    };
  }

  async getWorkshopItemsByAuthor(authorId, { limit = 24 } = {}) {
    const ids = await this.fetchWorkshopIdsFromAuthor(authorId, { limit });
    return this.getWorkshopItemsByIds(ids);
  }

  async fetchWorkshopIdsFromAuthor(authorId, { limit = 24 } = {}) {
    const id = String(authorId || '').trim();
    if (!/^\d+$/.test(id)) {
      return [];
    }

    const params = new URLSearchParams({
      appid: WALLPAPER_ENGINE_APP_ID,
      browsefilter: 'myfiles',
      sort: 'score',
      view: 'imagewall'
    });
    const html = await this.getText(`https://steamcommunity.com/profiles/${encodeURIComponent(id)}/myworkshopfiles/?${params}`);
    const ids = [];
    const seen = new Set();
    const regex = /href="https:\/\/steamcommunity\.com\/sharedfiles\/filedetails\/\?id=(\d+)"/g;
    let match;

    while ((match = regex.exec(html)) && ids.length < limit) {
      const publishedFileId = match[1];
      if (seen.has(publishedFileId)) continue;
      seen.add(publishedFileId);
      ids.push(publishedFileId);
    }

    return ids;
  }

  async attachAuthorProfiles(items = []) {
    const authorIds = [...new Set(items.map(item => item.authorId || item.creator).filter(Boolean))];
    if (!authorIds.length) {
      return items;
    }

    const profiles = await Promise.all(authorIds.map(authorId => this.resolveWorkshopAuthorProfile(authorId)));
    const profilesById = new Map(
      profiles.filter(Boolean).map(profile => [String(profile.id), profile])
    );

    return items.map(item => {
      const profile = profilesById.get(String(item.authorId || item.creator));
      if (!profile) return item;

      return {
        ...item,
        author: profile.name || item.author,
        authorInfo: profile
      };
    });
  }

  async resolveWorkshopAuthorProfile(authorId) {
    const id = String(authorId || '').trim();
    if (!/^\d+$/.test(id)) {
      return null;
    }

    if (!this.authorProfileCache.has(id)) {
      this.authorProfileCache.set(id, this.fetchWorkshopAuthorProfile(id).catch(error => {
        this.logger(`No pude resolver autor Steam ${id}: ${error.message}`);
        return null;
      }));
    }

    return this.authorProfileCache.get(id);
  }

  async fetchWorkshopAuthorProfile(authorId) {
    const url = `https://steamcommunity.com/profiles/${encodeURIComponent(authorId)}/?xml=1`;
    const xml = await this.getText(url);
    const name = this.decodeHtml(this.getXmlTag(xml, 'steamID')) || `Steam ${authorId.slice(-8)}`;
    const customUrl = this.decodeHtml(this.getXmlTag(xml, 'customURL'));
    const profileUrl = this.decodeHtml(this.getXmlTag(xml, 'profileURL')) || `https://steamcommunity.com/profiles/${authorId}`;
    const avatar = this.decodeHtml(this.getXmlTag(xml, 'avatarFull') || this.getXmlTag(xml, 'avatarMedium'));
    const joined = this.decodeHtml(this.getXmlTag(xml, 'memberSince'));

    return {
      id: authorId,
      name,
      handle: customUrl ? `@${customUrl}` : `@${authorId.slice(0, 12)}`,
      url: profileUrl,
      avatar,
      joined,
      description: 'Creador de wallpapers en Steam Workshop.',
      bio: '',
      followers: 0
    };
  }

  async getWorkshopAuthorName(publishedFileId) {
    if (!publishedFileId) return '';

    try {
      const url = `https://steamcommunity.com/sharedfiles/filedetails/?id=${encodeURIComponent(publishedFileId)}`;
      const html = await this.getText(url);
      const authorRegexes = [
        /<div[^>]*class=["']workshopItemOwnerName["'][^>]*>.*?<a[^>]*>([^<]+)<\/a>/is,
        /<div[^>]*class=["']friendBlockContent["'][^>]*>.*?<a[^>]*>([^<]+)<\/a>/is,
        /<a[^>]*href=["']https:\/\/steamcommunity\.com\/profiles\/[^"']+["'][^>]*>([^<]+)<\/a>/i
      ];

      for (const regex of authorRegexes) {
        const match = regex.exec(html);
        if (match && match[1]) {
          return this.decodeHtml(match[1].trim());
        }
      }
    } catch (error) {
      console.error(`Error fetching Workshop author for ${publishedFileId}:`, error);
    }

    return '';
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

  async downloadWallpaper({ publishedFileId, username = '', password = '' }) {
    if (!publishedFileId) {
      throw new Error('Falta el ID de Workshop.');
    }

    if (!username.trim() || !password) {
      throw new Error('Wallpaper Engine no se descarga como anonimo. Escribe tu usuario y contrasena de Steam antes de descargar.');
    }

    const targetRoot = await this.resolveWallpaperEngineTargetRoot();
    fs.mkdirSync(targetRoot, { recursive: true });
    fs.mkdirSync(this.downloadRoot, { recursive: true });

    const steamcmd = this.findSteamCmd();
    if (!steamcmd) {
      throw new Error('No encontre SteamCMD. Instala SteamCMD y vuelve a intentar.');
    }

    const cacheDir = path.join(this.downloadRoot, String(publishedFileId));
    const targetDir = path.join(targetRoot, String(publishedFileId));
    const args = this.buildSteamCmdArgs({ publishedFileId, username, password });
    const steamCmdContentDir = path.join(this.downloadRoot, 'steamapps', 'workshop', 'content', WALLPAPER_ENGINE_APP_ID, String(publishedFileId));

    fs.rmSync(steamCmdContentDir, { recursive: true, force: true });

    this.logger(`Starting steamcmd download executable=${steamcmd} cwd=${this.downloadRoot} args=${this.redactArgs(args).join(' ')}`);

    const result = await this.runTool(steamcmd, args, {
      cwd: this.downloadRoot
    });

    this.logger(`Downloader output for ${publishedFileId}:\n${result.output}`);

    const projectDir = this.findProjectRoot(steamCmdContentDir);
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
    const steamcmd = this.findSteamCmd();
    const enginePaths = await this.steamReader.constructor.getWallpaperEnginePaths();

    return {
      steamcmd,
      downloadRoot: this.downloadRoot,
      wallpaperEngineTarget: enginePaths.myProjectsPath,
      wallpaperEngineInstall: enginePaths.installPath,
      hasDownloader: Boolean(steamcmd)
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
      author: item.creator ? `Steam ${String(item.creator).slice(-8)}` : '',
      creator: item.creator ? String(item.creator) : '',
      authorInfo: item.creator ? {
        id: String(item.creator),
        name: `Steam ${String(item.creator).slice(-8)}`,
        handle: `@${String(item.creator).slice(0, 12)}`,
        url: `https://steamcommunity.com/profiles/${item.creator}`
      } : null,
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

  getXmlTag(xml, tagName) {
    const match = new RegExp(`<${tagName}>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*<\\/${tagName}>`, 'i').exec(String(xml || ''));
    return match ? match[1].trim() : '';
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

  postForm(url, params) {
    return new Promise((resolve, reject) => {
      const postData = params.toString();
      const request = https.request(url, {
        method: 'POST',
        headers: {
          ...this.requestHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, res => {
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
      });

      request.on('error', reject);
      request.write(postData);
      request.end();
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
        'SteamCMD intento entrar como anonimo y Steam rechazo Wallpaper Engine.',
        'Escribe usuario y contrasena de Steam en la app antes de descargar.',
        '',
        output
      ].join('\n');
    }

    if (output.includes('Steam Guard') || output.includes('2-factor') || output.includes('two-factor')) {
      return [
        'Steam Guard requiere verificacion adicional y el modo automatico no pudo completarla.',
        'Revisa el log para ver el codigo o mensaje exacto de SteamCMD.',
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
