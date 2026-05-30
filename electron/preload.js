const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSteamWallpapers: () => ipcRenderer.invoke('get-steam-wallpapers'),
  setSteamPath: (path) => ipcRenderer.invoke('set-steam-path', path),
  setWallpaper: (wallpaperPath) => ipcRenderer.invoke('set-wallpaper', wallpaperPath),
  getSteamPath: () => ipcRenderer.invoke('get-steam-path'),
  searchSteamWallpapers: (query) => ipcRenderer.invoke('search-steam-wallpapers', query),
  searchWorkshopWallpapers: (options) => ipcRenderer.invoke('search-workshop-wallpapers', options),
  downloadWorkshopWallpaper: (options) => ipcRenderer.invoke('download-workshop-wallpaper', options),
  getWorkshopDownloaderStatus: () => ipcRenderer.invoke('get-workshop-downloader-status'),
  getAppLogInfo: () => ipcRenderer.invoke('get-app-log-info'),
  readAppLog: () => ipcRenderer.invoke('read-app-log'),
  openPath: (targetPath) => ipcRenderer.invoke('open-path', targetPath),
  listSteamAccounts: () => ipcRenderer.invoke('steam-accounts-list'),
  saveSteamAccount: (account) => ipcRenderer.invoke('steam-accounts-save', account),
  removeSteamAccount: (username) => ipcRenderer.invoke('steam-accounts-remove', username),
  selectSteamAccount: (username) => ipcRenderer.invoke('steam-accounts-select', username),
  on: (channel, func) => {
    if (channel === 'wallpaper-changed') {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  once: (channel, func) => {
    if (channel === 'wallpaper-changed') {
      ipcRenderer.once(channel, (event, ...args) => func(...args));
    }
  }
});

window.addEventListener('error', (event) => {
  ipcRenderer.send('renderer-log', {
    level: 'error',
    message: `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`
  });
});

window.addEventListener('unhandledrejection', (event) => {
  ipcRenderer.send('renderer-log', {
    level: 'unhandledrejection',
    message: event.reason?.stack || event.reason?.message || String(event.reason)
  });
});
