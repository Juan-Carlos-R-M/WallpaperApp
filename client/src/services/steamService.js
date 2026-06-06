const getElectronApi = () => {
  if (!window.electronAPI) {
    throw new Error('Electron API no disponible');
  }

  return window.electronAPI;
};

const unwrapEnvelope = (result, fallbackMessage = 'La operacion de Electron fallo.') => {
  if (!result || typeof result !== 'object') {
    throw new Error(fallbackMessage);
  }

  if (!result.success) {
    const error = new Error(result.error || fallbackMessage);
    error.code = result.code || 'ELECTRON_IPC_ERROR';
    error.envelope = result;
    throw error;
  }

  return Object.prototype.hasOwnProperty.call(result, 'data') ? result.data : result;
};

export const steamService = {
  hasElectronApi() {
    return Boolean(window.electronAPI);
  },

  async getSteamWallpapers() {
    return unwrapEnvelope(
      await getElectronApi().getSteamWallpapers(),
      'Error al cargar wallpapers de Steam'
    );
  },

  async getSteamPath() {
    const result = await getElectronApi().getSteamPath();
    if (!result?.success) {
      throw new Error(result?.error || 'No se pudo leer la ruta de Steam');
    }

    return result.path || result.data?.steamPath || '';
  },

  async searchWorkshopWallpapers(options) {
    return unwrapEnvelope(
      await getElectronApi().searchWorkshopWallpapers(options),
      'Error al consultar Steam Workshop'
    );
  },

  async downloadWorkshopWallpaper(options) {
    return unwrapEnvelope(
      await getElectronApi().downloadWorkshopWallpaper(options),
      'No se pudo descargar el wallpaper'
    );
  },

  async deleteWorkshopWallpaper(options) {
    return unwrapEnvelope(
      await getElectronApi().deleteWorkshopWallpaper(options),
      'No se pudo eliminar el wallpaper'
    );
  },

  async getWorkshopDownloaderStatus() {
    return unwrapEnvelope(
      await getElectronApi().getWorkshopDownloaderStatus(),
      'No se pudo revisar el descargador de Workshop'
    );
  },

  async listSteamAccounts() {
    return unwrapEnvelope(
      await getElectronApi().listSteamAccounts(),
      'No se pudieron cargar las cuentas de Steam'
    );
  },

  async showDownloadResult(options) {
    if (!window.electronAPI?.showDownloadResult) {
      return { success: true };
    }

    const result = await window.electronAPI.showDownloadResult(options);
    if (!result?.success && result?.error) {
      throw new Error(result.error);
    }

    return result;
  },

  async setWallpaper(wallpaperPath) {
    const result = await getElectronApi().setWallpaper(wallpaperPath);
    if (!result?.success) {
      throw new Error(result?.error || 'No se pudo establecer el wallpaper');
    }

    return result;
  }
};

export default steamService;
