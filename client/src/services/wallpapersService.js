/**
 * Wallpapers Service - Abstrae acceso a datos (Electron o HTTP)
 */

import axios from 'axios';
import { isElectronApp } from './config.js';
import { electronStore } from './electronStore.js';
import { wallpapersUrl } from './api.js';

class WallpapersService {
  constructor() {
    this.isElectron = isElectronApp();
  }

  async getAllWallpapers(params = {}) {
    if (this.isElectron) {
      return electronStore.getWallpapers();
    }
    
    const response = await axios.get(wallpapersUrl(), { params });
    return response.data;
  }

  async getWallpaperById(id) {
    if (this.isElectron) {
      return electronStore.getWallpaper(id);
    }
    
    const response = await axios.get(wallpapersUrl(`/${id}`));
    return response.data;
  }

  async searchWallpapers(query) {
    if (this.isElectron) {
      return electronStore.search(query);
    }
    
    const params = new URLSearchParams();
    if (query) params.append('search', query);
    const response = await axios.get(wallpapersUrl(`?${params}`));
    return response.data;
  }

  async saveWallpaper(wallpaper) {
    if (this.isElectron) {
      return electronStore.saveWallpaper(wallpaper);
    }
    
    if (wallpaper.id) {
      const response = await axios.put(wallpapersUrl(`/${wallpaper.id}`), wallpaper);
      return response.data;
    } else {
      const response = await axios.post(wallpapersUrl(), wallpaper);
      return response.data;
    }
  }

  async deleteWallpaper(id) {
    if (this.isElectron) {
      return electronStore.deleteWallpaper(id);
    }
    
    const response = await axios.delete(wallpapersUrl(`/${id}`));
    return response.data;
  }

  async getFavorites() {
    if (this.isElectron) {
      return electronStore.getFavorites();
    }
    
    // Fallback to localStorage si no está en Electron
    const favs = localStorage.getItem('favorites');
    return favs ? JSON.parse(favs) : [];
  }

  async addFavorite(wallpaper) {
    if (this.isElectron) {
      return electronStore.addFavorite(wallpaper);
    }
    
    const favorites = await this.getFavorites();
    if (!favorites.find(f => f.id === wallpaper.id)) {
      favorites.push(wallpaper);
      localStorage.setItem('favorites', JSON.stringify(favorites));
    }
    return true;
  }

  async removeFavorite(id) {
    if (this.isElectron) {
      return electronStore.removeFavorite(id);
    }
    
    let favorites = await this.getFavorites();
    favorites = favorites.filter(f => f.id !== id);
    localStorage.setItem('favorites', JSON.stringify(favorites));
    return true;
  }

  async isFavorite(id) {
    if (this.isElectron) {
      return electronStore.isFavorite(id);
    }
    
    const favorites = await this.getFavorites();
    return favorites.some(f => f.id === id);
  }

  async getStats() {
    if (this.isElectron) {
      return electronStore.getStats();
    }
    
    const wallpapers = await this.getAllWallpapers();
    return {
      totalWallpapers: wallpapers.length,
      totalFavorites: (await this.getFavorites()).length,
      lastUpdated: new Date().toISOString()
    };
  }

  async getSettings() {
    if (this.isElectron) {
      return electronStore.getSettings();
    }
    
    const settings = localStorage.getItem('settings');
    return settings ? JSON.parse(settings) : {
      theme: 'dark',
      autoPlay: true,
      quality: 'medium',
      notificationsEnabled: true
    };
  }

  async updateSettings(updates) {
    if (this.isElectron) {
      return electronStore.updateSettings(updates);
    }
    
    const settings = await this.getSettings();
    const updated = { ...settings, ...updates };
    localStorage.setItem('settings', JSON.stringify(updated));
    return updated;
  }
}

export const wallpapersService = new WallpapersService();

export default wallpapersService;
