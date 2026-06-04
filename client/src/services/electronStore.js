/**
 * ElectronStore - Servicio para acceder al almacenamiento local via IPC
 * Reemplaza las llamadas HTTP al servidor backend
 */

const isElectron = () => {
  return window.electronAPI !== undefined;
};

export const electronStore = {
  // Wallpapers
  async getWallpapers() {
    if (!isElectron()) throw new Error('Electron API no disponible');
    const result = await window.electronAPI.invoke('local-store-get-wallpapers');
    if (!result.success) throw new Error(result.error);
    return result.data;
  },

  async getWallpaper(id) {
    if (!isElectron()) throw new Error('Electron API no disponible');
    const result = await window.electronAPI.invoke('local-store-get-wallpaper', id);
    if (!result.success) throw new Error(result.error);
    return result.data;
  },

  async saveWallpaper(wallpaper) {
    if (!isElectron()) throw new Error('Electron API no disponible');
    const result = await window.electronAPI.invoke('local-store-save-wallpaper', wallpaper);
    if (!result.success) throw new Error(result.error);
    return result.data;
  },

  async deleteWallpaper(id) {
    if (!isElectron()) throw new Error('Electron API no disponible');
    const result = await window.electronAPI.invoke('local-store-delete-wallpaper', id);
    if (!result.success) throw new Error(result.error);
    return result.data;
  },

  // Favorites
  async getFavorites() {
    if (!isElectron()) throw new Error('Electron API no disponible');
    const result = await window.electronAPI.invoke('local-store-get-favorites');
    if (!result.success) throw new Error(result.error);
    return result.data;
  },

  async addFavorite(wallpaper) {
    if (!isElectron()) throw new Error('Electron API no disponible');
    const result = await window.electronAPI.invoke('local-store-add-favorite', wallpaper);
    if (!result.success) throw new Error(result.error);
    return result.data;
  },

  async removeFavorite(id) {
    if (!isElectron()) throw new Error('Electron API no disponible');
    const result = await window.electronAPI.invoke('local-store-remove-favorite', id);
    if (!result.success) throw new Error(result.error);
    return result.data;
  },

  async isFavorite(id) {
    if (!isElectron()) throw new Error('Electron API no disponible');
    const result = await window.electronAPI.invoke('local-store-is-favorite', id);
    if (!result.success) throw new Error(result.error);
    return result.data;
  },

  // Search
  async search(query) {
    if (!isElectron()) throw new Error('Electron API no disponible');
    const result = await window.electronAPI.invoke('local-store-search', query);
    if (!result.success) throw new Error(result.error);
    return result.data;
  },

  // Settings
  async getSettings() {
    if (!isElectron()) throw new Error('Electron API no disponible');
    const result = await window.electronAPI.invoke('local-store-get-settings');
    if (!result.success) throw new Error(result.error);
    return result.data;
  },

  async updateSettings(updates) {
    if (!isElectron()) throw new Error('Electron API no disponible');
    const result = await window.electronAPI.invoke('local-store-update-settings', updates);
    if (!result.success) throw new Error(result.error);
    return result.data;
  },

  // Stats
  async getStats() {
    if (!isElectron()) throw new Error('Electron API no disponible');
    const result = await window.electronAPI.invoke('local-store-get-stats');
    if (!result.success) throw new Error(result.error);
    return result.data;
  }
};

export default electronStore;
