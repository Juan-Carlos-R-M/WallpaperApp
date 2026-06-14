/**
 * LocalStore - Almacenamiento local para reemplazar MongoDB
 * Guarda los datos en archivos JSON en el directorio de datos del usuario
 */

const fs = require('fs').promises;
const path = require('path');

class LocalStore {
  constructor(userDataPath) {
    this.userDataPath = userDataPath;
    this.dataDir = path.join(userDataPath, 'data');
    this.wallpapersFile = path.join(this.dataDir, 'wallpapers.json');
    this.favoritesFile = path.join(this.dataDir, 'favorites.json');
    this.settingsFile = path.join(this.dataDir, 'settings.json');
  }

  async init() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      await this.ensureDataFiles();
    } catch (err) {
      console.error('Error inicializando LocalStore:', err);
    }
  }

  async ensureDataFiles() {
    const files = {
      [this.wallpapersFile]: [],
      [this.favoritesFile]: [],
      [this.settingsFile]: {
        theme: 'dark',
        autoPlay: true,
        quality: 'medium',
        notificationsEnabled: true
      }
    };

    for (const [file, defaultData] of Object.entries(files)) {
      try {
        await fs.access(file);
      } catch {
        await fs.writeFile(file, JSON.stringify(defaultData, null, 2));
      }
    }
  }

  async readFile(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      console.error(`Error leyendo archivo ${filePath}:`, err);
      return [];
    }
  }

  async writeFile(filePath, data) {
    try {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (err) {
      console.error(`Error escribiendo archivo ${filePath}:`, err);
      return false;
    }
  }

  // ========== WALLPAPERS ==========
  async getAllWallpapers() {
    return this.readFile(this.wallpapersFile);
  }

  async getWallpaperById(id) {
    const wallpapers = await this.getAllWallpapers();
    return wallpapers.find(w => w.id === id || w.publishedFileId === id);
  }

  async saveWallpaper(wallpaper) {
    const wallpapers = await this.getAllWallpapers();
    const index = wallpapers.findIndex(w => w.id === wallpaper.id || w.publishedFileId === wallpaper.publishedFileId);
    
    if (index >= 0) {
      wallpapers[index] = { ...wallpapers[index], ...wallpaper };
    } else {
      wallpaper.id = wallpaper.id || wallpaper.publishedFileId || Date.now().toString();
      wallpaper.savedAt = new Date().toISOString();
      wallpapers.push(wallpaper);
    }
    
    await this.writeFile(this.wallpapersFile, wallpapers);
    return wallpaper;
  }

  async deleteWallpaper(id) {
    let wallpapers = await this.getAllWallpapers();
    wallpapers = wallpapers.filter(w => w.id !== id && w.publishedFileId !== id);
    await this.writeFile(this.wallpapersFile, wallpapers);
    return true;
  }

  async getWallpapersByCategory(category) {
    const wallpapers = await this.getAllWallpapers();
    return wallpapers.filter(w => w.category === category);
  }

  // ========== FAVORITOS ==========
  async getFavorites() {
    return this.readFile(this.favoritesFile);
  }

  async addFavorite(wallpaper) {
    const favorites = await this.getFavorites();
    const wallpaperId = wallpaper.id || wallpaper.publishedFileId || wallpaper._id;
    const exists = favorites.some(f => {
      const fId = f.id || f.publishedFileId || f._id;
      return fId === wallpaperId || (wallpaperId && (f.id === wallpaperId || f.publishedFileId === wallpaperId));
    });
    if (!exists) {
      favorites.push({
        ...wallpaper,
        id: wallpaper.id || wallpaper.publishedFileId || wallpaper._id || Date.now().toString(),
        addedAt: new Date().toISOString()
      });
      await this.writeFile(this.favoritesFile, favorites);
    }
    return true;
  }

  async removeFavorite(id) {
    let favorites = await this.getFavorites();
    favorites = favorites.filter(f => f.id !== id && f.publishedFileId !== id);
    await this.writeFile(this.favoritesFile, favorites);
    return true;
  }

  async isFavorite(id) {
    const favorites = await this.getFavorites();
    return favorites.some(f => f.id === id || f.publishedFileId === id);
  }

  // ========== CONFIGURACIÓN ==========
  async getSettings() {
    return this.readFile(this.settingsFile);
  }

  async updateSettings(updates) {
    const settings = await this.getSettings();
    const updated = { ...settings, ...updates };
    await this.writeFile(this.settingsFile, updated);
    return updated;
  }

  // ========== BÚSQUEDA ==========
  async searchWallpapers(query) {
    const wallpapers = await this.getAllWallpapers();
    const q = query.toLowerCase();
    return wallpapers.filter(w =>
      w.title?.toLowerCase().includes(q) ||
      w.description?.toLowerCase().includes(q) ||
      w.author?.toLowerCase().includes(q)
    );
  }

  // ========== ESTADÍSTICAS ==========
  async getWallpaperStats() {
    const wallpapers = await this.getAllWallpapers();
    const favorites = await this.getFavorites();
    const categories = new Set(wallpapers.map(w => w.category).filter(Boolean));

    return {
      totalWallpapers: wallpapers.length,
      totalFavorites: favorites.length,
      categories: Array.from(categories),
      lastUpdated: new Date().toISOString()
    };
  }
}

module.exports = LocalStore;
