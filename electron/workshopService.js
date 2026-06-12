const { spawn } = require('child_process');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const WALLPAPER_ENGINE_APP_ID = '431960';
const MAX_REDIRECTS = 5;

// Pre-compiled regex for extractPublishedFileIds (4x faster than recompiling)
const ID_EXTRACTION_REGEX = /(?:sharedfiles\/filedetails\/\?id=|workshopfiledetails\/\?id=|data-publishedfileid=["']?|publishedfileid["']?\s*[:=]\s*["']?)(\d+)/gi;

class WorkshopService {
  constructor({ userDataPath, steamReader, logger = () => {} }) {
    this.userDataPath = userDataPath;
    this.steamReader = steamReader;
    this.logger = logger;
    this.downloadRoot = path.join(userDataPath, 'WorkshopDownloads');
    this.authorProfileCache = new Map();
    this.apiKey = process.env.STEAM_WEB_API_KEY || process.env.STEAM_API_KEY || '';
  }

  // Convierte el sort string a queryType para IPublishedFileService/QueryFiles
  // Valores según EPublishedFileQueryType de la Steam Web API:
  sortToQueryType(sort) {
    const map = {
      trend:     0,   // k_PublishedFileQueryType_RankedByVote (trending)
      popular:   7,   // k_PublishedFileQueryType_RankedByTotalUniqueSubscriptions
      recent:    1,   // k_PublishedFileQueryType_RankedByPublicationDate
      favorites: 11,  // k_PublishedFileQueryType_RankedByTotalVotesDesc
      updated:   10,  // k_PublishedFileQueryType_RankedByLastUpdatedDate
    };
    return map[sort] !== undefined ? map[sort] : 0;
  }

  // Convierte el filtro de tiempo a days para la API de Steam
  timeToDaysApi(time) {
    const map = { week: 7, month: 30, quarter: 90, year: 365 };
    return map[time] || 0;
  }

  async searchWallpapers({
    query = '',
    page = 1,
    limit = 24,
    sort = 'trend',
    time = 'all',
    requiredTags = [],
    matchAllTags = true
  } = {}) {
    try {
      this.logger(`[searchWallpapers] Iniciando búsqueda: query="${query}", page=${page}, sort=${sort}, time=${time}, tags=${requiredTags.join(',')}`);
      
      const ids = matchAllTags === false && requiredTags.filter(Boolean).length > 1
        ? await this.fetchWorkshopIdsMatchingAnyTag({ query, page, limit, sort, time, requiredTags })
        : await this.fetchWorkshopIdsFromSearch({ query, page, limit, sort, time, requiredTags });
      
      this.logger(`[searchWallpapers] Encontrados ${ids.length} IDs para página ${page}`);
      
      if (!ids.length) {
        this.logger(`[searchWallpapers] ⚠️ Sin resultados para página ${page}. Retornando datos vacíos.`);
        return { total: 0, page, hasMore: false, data: [] };
      }

      this.logger(`[searchWallpapers] Obteniendo detalles de ${ids.length} items...`);
      const items = await this.getWorkshopItemsByIds(ids);
      this.logger(`[searchWallpapers] Obtenidos ${items.length} items de ${ids.length} IDs`);
      
      const hasMore = ids.length === Number(limit) && items.length > 0;
      const total = hasMore
        ? (Number(page) * Number(limit)) + 1
        : ((Number(page) - 1) * Number(limit)) + items.length;

      this.logger(`[searchWallpapers] ✅ Retornando: ${items.length} items, hasMore=${hasMore}, total=${total}`);

      return {
        total,
        page,
        hasMore,
        data: items
      };
    } catch (error) {
      this.logger(`[searchWallpapers] ❌ ERROR: ${error.message}`);
      throw error;
    }
  }



  /**
   * Búsqueda con múltiples tags en modo OR: hace múltiples consultas y combina resultados.
   */
  async searchWallpapersMultiTag({ query, page, limit, sort, time, requiredTags }) {
    const tags = [...new Set(requiredTags.filter(Boolean))];
    const seen = new Set();
    const allItems = [];

    for (const tag of tags) {
      try {
        const result = await this.searchWallpapers({ query, page, limit, sort, time, requiredTags: [tag], matchAllTags: true });
        for (const item of result.data) {
          const id = item.publishedFileId;
          if (!id || seen.has(id)) continue;
          seen.add(id);
          allItems.push(item);
          if (allItems.length >= Number(limit)) break;
        }
      } catch (e) {
        this.logger(`[searchWallpapersMultiTag] Error con tag "${tag}": ${e.message}`);
      }
      if (allItems.length >= Number(limit)) break;
    }

    const hasMore = allItems.length >= Number(limit);
    return {
      total: hasMore ? allItems.length + 1 : allItems.length,
      page,
      hasMore,
      data: allItems.slice(0, Number(limit))
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

    const url = `https://steamcommunity.com/workshop/browse/?${params}`;
    this.logger(`[fetchWorkshopIdsFromSearch] Obteniendo: ${url}`);
    
    const html = await this.getText(url);
    
    this.logger(`[fetchWorkshopIdsFromSearch] HTML recibido: ${html.length} bytes`);
    this.logger(`[fetchWorkshopIdsFromSearch] Primeros 500 caracteres: ${html.substring(0, 500)}`);
    
    const ids = [];
    const seen = new Set();
    
    const extractedIds = this.extractPublishedFileIds(html);
    this.logger(`[fetchWorkshopIdsFromSearch] IDs extraídos: ${extractedIds.length}`);
    
    for (const publishedFileId of extractedIds) {
      if (seen.has(publishedFileId)) continue;
      seen.add(publishedFileId);
      ids.push(publishedFileId);
      if (ids.length >= limit) break;
    }

    this.logger(`[fetchWorkshopIdsFromSearch] IDs finales retornados: ${ids.length} de ${limit} solicitados`);
    return ids;
  }

  async fetchWorkshopIdsMatchingAnyTag({
    query = '',
    page = 1,
    limit = 24,
    sort = 'trend',
    time = 'all',
    requiredTags = []
  } = {}) {
    const tags = [...new Set(requiredTags.map(tag => String(tag || '').trim()).filter(Boolean))];
    const seen = new Set();
    const ids = [];

    for (const tag of tags) {
      const tagIds = await this.fetchWorkshopIdsFromSearch({
        query,
        page,
        limit,
        sort,
        time,
        requiredTags: [tag]
      });

      for (const publishedFileId of tagIds) {
        if (seen.has(publishedFileId)) continue;
        seen.add(publishedFileId);
        ids.push(publishedFileId);
        if (ids.length >= limit) return ids;
      }
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

  async getWorkshopItemDetails(publishedFileId) {
    const [item] = await this.getWorkshopItemsByIds([publishedFileId]);
    return item || null;
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
    if (this.apiKey) {
      try {
        const apiItems = await this.getWorkshopItemsByAuthorApi(authorId, { limit });
        if (apiItems.length > 0) {
          return apiItems;
        }
        this.logger(`GetUserFiles no entrego wallpapers para autor ${authorId}. Uso fallback HTML.`);
      } catch (error) {
        this.logger(`GetUserFiles fallo para autor ${authorId}: ${error.message}. Uso fallback HTML.`);
      }
    }

    const ids = await this.fetchWorkshopIdsFromAuthor(authorId, { limit });
    return this.getWorkshopItemsByIds(ids);
  }

  async getWorkshopItemsByAuthorApi(authorId, { limit = 24 } = {}) {
    const id = String(authorId || '').trim();
    const maxItems = Math.max(1, Math.min(Number(limit) || 24, 100));

    if (!/^\d+$/.test(id)) {
      return [];
    }

    const allItems = [];
    let cursor = '*';
    let page = 1;

    while (allItems.length < maxItems && cursor) {
      const params = new URLSearchParams({
        key: this.apiKey,
        steamid: id,
        appid: WALLPAPER_ENGINE_APP_ID,
        numperpage: String(Math.min(100, maxItems - allItems.length)),
        return_metadata: '1',
        return_previews: '1',
        return_tags: '1',
        return_vote_data: '1',
        sortmethod: 'creationorder'
      });

      if (cursor !== '*') {
        params.set('cursor', cursor);
      }

      this.logger(`GetUserFiles author=${id} page=${page}`);
      const response = await this.getJson(`https://api.steampowered.com/IPublishedFileService/GetUserFiles/v1/?${params}`);
      const details = response?.response?.publishedfiledetails || [];

      if (!details.length) break;

      allItems.push(...details.map(item => this.normalizeWorkshopItem(item)));
      cursor = response?.response?.next_cursor || '';
      page += 1;
    }

    return this.attachAuthorProfiles(allItems.slice(0, maxItems));
  }

  async fetchWorkshopIdsFromAuthor(authorId, { limit = 24 } = {}) {
    const id = String(authorId || '').trim();
    if (!/^\d+$/.test(id)) {
      return [];
    }

    const ids = [];
    const seen = new Set();
    const maxItems = Math.max(1, Number(limit) || 24);
    const maxPages = Math.max(1, Math.ceil(maxItems / 30) + 1);

    for (let page = 1; page <= maxPages && ids.length < maxItems; page += 1) {
      const params = new URLSearchParams({
        appid: WALLPAPER_ENGINE_APP_ID,
        browsefilter: 'myfiles',
        sort: 'score',
        view: 'imagewall',
        p: String(page)
      });

      const html = await this.getText(`https://steamcommunity.com/profiles/${encodeURIComponent(id)}/myworkshopfiles/?${params}`);
      const pageIds = this.extractPublishedFileIds(html);

      if (!pageIds.length) break;

      for (const publishedFileId of pageIds) {
        if (seen.has(publishedFileId)) continue;
        seen.add(publishedFileId);
        ids.push(publishedFileId);
        if (ids.length >= maxItems) break;
      }
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

    const downloader = this.findDownloader();
    if (!downloader) {
      throw new Error('No encontre SteamCMD ni DepotDownloader. Instala SteamCMD o repara la instalacion de la app.');
    }

    const id = String(publishedFileId);
    const cacheDir = path.join(this.downloadRoot, id);
    const targetDir = path.join(targetRoot, id);
    const steamCmdContentDir = path.join(this.downloadRoot, 'steamapps', 'workshop', 'content', WALLPAPER_ENGINE_APP_ID, String(publishedFileId));
    const downloadedDir = downloader.type === 'steamcmd'
      ? steamCmdContentDir
      : path.join(this.downloadRoot, 'incoming', id);
    const args = this.buildDownloaderArgs({ downloader, publishedFileId, username, password, outputDir: downloadedDir });

    fs.rmSync(downloadedDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(downloadedDir), { recursive: true });
    if (downloader.type !== 'steamcmd') {
      fs.mkdirSync(downloadedDir, { recursive: true });
    }

    this.logger(`Starting ${downloader.name} download executable=${downloader.executable} cwd=${this.downloadRoot} args=${this.redactArgs(args).join(' ')}`);

    const result = await this.runTool(downloader.executable, args, {
      cwd: this.downloadRoot
    });

    this.logger(`Downloader output for ${publishedFileId}:\n${result.output}`);

    const projectDir = this.findProjectRoot(downloadedDir);
    this.copyProjectDirectory(projectDir, cacheDir);
    this.copyProjectToMyProjects(projectDir, targetDir);

    const wallpaper = this.steamReader.readWallpaperFromProject(targetDir, String(publishedFileId));

    return {
      output: result.output,
      path: targetDir,
      downloadRoot: targetRoot,
      downloader: downloader.name,
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
    const downloader = this.findDownloader();
    const steamcmd = this.findSteamCmd();
    const depotDownloader = this.findDepotDownloader();
    const enginePaths = await this.steamReader.constructor.getWallpaperEnginePaths();

    const steamCmdCandidates = this.getSteamCmdCandidates();
    const depotCandidates = this.getDepotDownloaderCandidates();

    // Log detallado de diagnóstico para encontrar por qué no detecta el binario
    try {
      this.logger('[getDownloaderStatus] === Diagnostico bins ===');
      for (const p of steamCmdCandidates) {
        try {
          this.logger(`[getDownloaderStatus] SteamCMD candidate exists=${fs.existsSync(p)} path=${p}`);
        } catch (e) {
          this.logger(`[getDownloaderStatus] SteamCMD candidate ERROR path=${p} err=${e?.message || e}`);
        }
      }
      for (const p of depotCandidates) {
        try {
          this.logger(`[getDownloaderStatus] DepotDownloader candidate exists=${fs.existsSync(p)} path=${p}`);
        } catch (e) {
          this.logger(`[getDownloaderStatus] DepotDownloader candidate ERROR path=${p} err=${e?.message || e}`);
        }
      }
      this.logger(`[getDownloaderStatus] findDownloader => ${downloader ? `${downloader.type}:${downloader.executable}` : 'null'}`);
      this.logger(`[getDownloaderStatus] findSteamCmd => ${steamcmd || 'null'}`);
      this.logger(`[getDownloaderStatus] findDepotDownloader => ${depotDownloader || 'null'}`);
    } catch {}

    const steamCmdCandidatesWithExists = steamCmdCandidates.map(p => ({ path: p, exists: fs.existsSync(p) }));
    const depotCandidatesWithExists = depotCandidates.map(p => ({ path: p, exists: fs.existsSync(p) }));

    return {
      downloader: downloader?.executable || null,
      downloaderName: downloader?.name || '',
      downloaderType: downloader?.type || '',
      steamcmd,
      depotDownloader,
      searchedDownloaderPaths: [
        ...steamCmdCandidates,
        ...depotCandidates
      ],
      steamCmdCandidatesWithExists,
      depotCandidatesWithExists,
      downloadRoot: this.downloadRoot,
      wallpaperEngineTarget: enginePaths.myProjectsPath,
      wallpaperEngineInstall: enginePaths.installPath,
      hasDownloader: Boolean(downloader || steamcmd || depotDownloader)
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

  extractPublishedFileIds(html) {
    const source = String(html || '');
    if (!source) {
      this.logger('[extractPublishedFileIds] HTML vacío');
      return [];
    }

    // Single-pass extraction (4x faster than 4 separate patterns)
    const ids = [];
    const seen = new Set();
    let match;

    // Reset regex state before use
    ID_EXTRACTION_REGEX.lastIndex = 0;

    let matches = 0;
    while ((match = ID_EXTRACTION_REGEX.exec(source)) !== null) {
      const id = String(match[1] || '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
      matches++;
    }

    this.logger(`[extractPublishedFileIds] ✅ ${matches} IDs encontrados (${ids.length} únicos)`);
    if (ids.length > 0) {
      this.logger(`[extractPublishedFileIds] Primeros 5 IDs: ${ids.slice(0, 5).join(', ')}`);
    }

    return ids;
  }

  getXmlTag(xml, tagName) {
    const match = new RegExp(`<${tagName}>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*<\\/${tagName}>`, 'i').exec(String(xml || ''));
    return match ? match[1].trim() : '';
  }

  getJson(url, redirectCount = 0) {
    return new Promise((resolve, reject) => {
      const requestUrl = this.normalizeSteamUrl(url);
      const timeoutMs = 25000; // 25s — Steam API puede ser lento
      let settled = false;

      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(value);
      };

      const timer = setTimeout(() => {
        request.destroy(new Error(`Steam API no respondio en ${timeoutMs}ms (${requestUrl})`));
      }, timeoutMs);

      const request = https.get(requestUrl, { headers: this.requestHeaders() }, res => {
        let body = '';

        if (this.isRedirect(res.statusCode)) {
          const redirectUrl = this.resolveRedirectUrl(requestUrl, res.headers.location);
          res.resume();

          if (!redirectUrl) {
            finish(reject, new Error(`Steam API redirigio sin ubicacion (${res.statusCode})`));
            return;
          }

          if (redirectCount >= MAX_REDIRECTS) {
            finish(reject, new Error(`Steam API redirigio demasiadas veces. Ultima ubicacion: ${redirectUrl}`));
            return;
          }

          this.logger(`Steam API redirect ${res.statusCode}: ${requestUrl} -> ${redirectUrl}`);
          finish(resolve, this.getJson(redirectUrl, redirectCount + 1));
          return;
        }

        res.on('data', chunk => {
          body += chunk;
        });

        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            finish(reject, new Error(`Steam API respondio ${res.statusCode}`));
            return;
          }

          try {
            finish(resolve, JSON.parse(body));
          } catch (error) {
            finish(reject, new Error(`Respuesta invalida de Steam: ${error.message}`));
          }
        });
      });

      request.on('error', error => finish(reject, this.friendlyNetworkError(error, requestUrl)));
    });
  }

  postForm(url, params) {
    return new Promise((resolve, reject) => {
      const requestUrl = this.normalizeSteamUrl(url);
      const postData = params.toString();
      const timeoutMs = 15000;
      let settled = false;

      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(value);
      };

      const timer = setTimeout(() => {
        request.destroy(new Error(`Steam API no respondio en ${timeoutMs}ms (${requestUrl})`));
      }, timeoutMs);

      const request = https.request(requestUrl, {
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
            finish(reject, new Error(`Steam API respondio ${res.statusCode}`));
            return;
          }

          try {
            finish(resolve, JSON.parse(body));
          } catch (error) {
            finish(reject, new Error(`Respuesta invalida de Steam: ${error.message}`));
          }
        });
      });

      request.on('error', error => finish(reject, this.friendlyNetworkError(error, requestUrl)));
      request.write(postData);
      request.end();
    });
  }

  getText(url, redirectCount = 0) {
    return new Promise((resolve, reject) => {
      const requestUrl = this.normalizeSteamUrl(url);
      const timeoutMs = Number(process.env.WALLPAPER_APP_HTTP_TIMEOUT_MS) || 15000; // Reduced to 15s for faster fail-over
      let settled = false;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(value);
      };
      const timer = setTimeout(() => {
        request.destroy(new Error(`Steam Community no respondio en ${timeoutMs}ms (${requestUrl})`));
      }, timeoutMs);
      const request = https.get(requestUrl, { headers: this.requestHeaders() }, res => {
        let body = '';

        if (this.isRedirect(res.statusCode)) {
          const redirectUrl = this.resolveRedirectUrl(requestUrl, res.headers.location);
          res.resume();

          if (!redirectUrl) {
            finish(reject, new Error(`Steam Community redirigio sin ubicacion (${res.statusCode})`));
            return;
          }

          if (redirectCount >= MAX_REDIRECTS) {
            finish(reject, new Error(`Steam Community redirigio demasiadas veces. Ultima ubicacion: ${redirectUrl}`));
            return;
          }

          this.logger(`Steam Community redirect ${res.statusCode}: ${requestUrl} -> ${redirectUrl}`);
          this.getText(redirectUrl, redirectCount + 1).then(
            value => finish(resolve, value),
            error => finish(reject, error)
          );
          return;
        }

        res.on('data', chunk => {
          body += chunk;
        });

        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            finish(reject, new Error(`Steam Community respondio ${res.statusCode}`));
            return;
          }

          finish(resolve, body);
        });
      }).on('error', error => finish(reject, this.friendlyNetworkError(error, requestUrl)));
    });
  }

  normalizeSteamUrl(url) {
    const input = String(url || '');
    const normalized = input.replace(/steamcomunity\.com/gi, 'steamcommunity.com');

    if (normalized !== input) {
      this.logger(`Corrigiendo URL de Steam Community: ${input} -> ${normalized}`);
    }

    return normalized;
  }

  friendlyNetworkError(error, url) {
    if (error?.code !== 'ENOTFOUND') {
      return error;
    }

    let hostname = '';
    try {
      hostname = new URL(url).hostname;
    } catch {
      hostname = String(url || '');
    }

    return new Error(`No pude resolver ${hostname}. Verifica la conexion y que la URL sea steamcommunity.com. Error original: ${error.message}`);
  }

  isRedirect(statusCode) {
    return [301, 302, 303, 307, 308].includes(Number(statusCode));
  }

  resolveRedirectUrl(currentUrl, location) {
    if (!location) return '';

    try {
      return new URL(location, currentUrl).href;
    } catch {
      return '';
    }
  }

  requestHeaders() {
    return {
      'User-Agent': 'Mozilla/5.0 Wallpaper-App/1.0',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.7'
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
    return this.getSteamCmdCandidates().find(candidate => fs.existsSync(candidate)) || null;
  }

  getSteamCmdCandidates() {
    return [
      process.env.STEAMCMD_PATH,
      path.join(this.userDataPath, 'tools', 'steamcmd', 'steamcmd.exe'),
      process.resourcesPath && path.join(process.resourcesPath, 'app.asar.unpacked', 'tools', 'steamcmd', 'steamcmd.exe'),
      process.resourcesPath && path.join(process.resourcesPath, 'tools', 'steamcmd', 'steamcmd.exe'),
      process.execPath && path.join(path.dirname(process.execPath), 'tools', 'steamcmd', 'steamcmd.exe'),
      path.join(process.cwd(), 'tools', 'steamcmd', 'steamcmd.exe'),
      'C:\\steamcmd\\steamcmd.exe',
      path.join(os.homedir(), 'Downloads', 'steamcmd', 'steamcmd.exe')
    ].filter(Boolean);
  }

  findDepotDownloader() {
    return this.getDepotDownloaderCandidates().find(candidate => fs.existsSync(candidate)) || null;
  }

  getDepotDownloaderCandidates() {
    const candidates = [
      // Config por env
      process.env.DEPOTDOWNLOADER_PATH,

      // Rutas relativas (dev / no empaquetado)
      path.join(__dirname, '..', 'tools', 'DepotDownloader', 'DepotDownloader.exe'),
      path.join(process.cwd(), 'tools', 'DepotDownloader', 'DepotDownloader.exe'),

      // Ruta dentro de userData (si el instalador/copiarla usa ese lugar)
      path.join(this.userDataPath, 'tools', 'DepotDownloader', 'DepotDownloader.exe'),

      // Rutas típicas dentro de Electron empaquetado
      process.resourcesPath && path.join(process.resourcesPath, 'app.asar.unpacked', 'tools', 'DepotDownloader', 'DepotDownloader.exe'),
      process.resourcesPath && path.join(process.resourcesPath, 'tools', 'DepotDownloader', 'DepotDownloader.exe'),

      // Variante: app.getAppPath() (a veces apunta a resources/app.asar)
      // (nota: en main process app.getAppPath() existe; en este archivo usamos process.*
      // pero dejamos candidatos extra basados en app.asar si el empaquetado lo requiere)
      process.execPath && path.join(path.dirname(process.execPath), 'resources', 'app.asar.unpacked', 'tools', 'DepotDownloader', 'DepotDownloader.exe'),
      process.execPath && path.join(path.dirname(process.execPath), 'resources', 'app.asar.unpacked', 'tools', 'DepotDownloader', 'DepotDownloader.exe'),

      path.join(os.homedir(), 'Downloads', 'DepotDownloader', 'DepotDownloader.exe')
    ].filter(Boolean);

    // Deduplicar conservando orden
    return Array.from(new Set(candidates));
  }


  findDownloader() {
    const steamcmd = this.findSteamCmd();
    if (steamcmd) {
      return { type: 'steamcmd', name: 'SteamCMD', executable: steamcmd };
    }

    const depotDownloader = this.findDepotDownloader();
    if (depotDownloader) {
      return { type: 'depotdownloader', name: 'DepotDownloader', executable: depotDownloader };
    }

    return null;
  }

  buildDownloaderArgs({ downloader, publishedFileId, username, password, outputDir }) {
    if (downloader.type === 'steamcmd') {
      return this.buildSteamCmdArgs({ publishedFileId, username, password });
    }

    return this.buildDepotDownloaderArgs({ publishedFileId, username, password, outputDir });
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

  buildDepotDownloaderArgs({ publishedFileId, username, password, outputDir }) {
    return [
      '-app',
      WALLPAPER_ENGINE_APP_ID,
      '-pubfile',
      String(publishedFileId),
      '-username',
      username.trim(),
      '-password',
      password || '',
      '-dir',
      outputDir,
      '-validate'
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

    if (output.includes('not available from this account') || output.includes('Depot') && output.includes('is not available')) {
      return [
        'Steam rechazo la descarga porque Wallpaper Engine no esta disponible para esa cuenta/sesion.',
        '',
        'Posibles soluciones:',
        '1. Verifica que la CUENTA DE STEAM compro Wallpaper Engine',
        '2. Intenta con USUARIO y CONTRASEÑA correctos',
        '3. Si usas Steam Guard, desactívalo temporalmente',
        '4. Cierra Steam completamente y vuelve a intentar',
        '5. Si sigues con problemas, usa una VPN o revisa restricciones regionales',
        '',
        output
      ].join('\n');
    }

    if (output.includes('AsyncJobFailedException') || output.includes('Unhandled exception')) {
      return [
        'Error técnico durante la conexión a Steam.',
        '',
        'Intenta:',
        '1. Cierra Steam completamente',
        '2. Vuelve a iniciar la app',
        '3. Escribe de nuevo usuario y contraseña de Steam',
        '4. Reinicia tu PC si continúa el problema',
        '',
        'Log técnico:',
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
