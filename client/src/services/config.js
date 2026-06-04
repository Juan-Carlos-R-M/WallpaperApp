/**
 * Config - Detecta el ambiente (Electron o Web)
 */

export const isElectronApp = () => {
  return window.electronAPI !== undefined;
};

export const getApiConfig = () => {
  if (isElectronApp()) {
    return {
      type: 'electron',
      description: 'Usando almacenamiento local de Electron'
    };
  }
  
  return {
    type: 'http',
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
    description: 'Usando API HTTP'
  };
};

export default {
  isElectronApp,
  getApiConfig
};
