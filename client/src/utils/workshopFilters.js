/**
 * Centralización de configuración de filtros de workshop
 * Elimina duplicación de DEFAULT_WORKSHOP_FILTERS en múltiples archivos
 */

import { STORAGE_KEYS, getStorageItem, setStorageItem } from './storageKeys';

export const DEFAULT_WORKSHOP_FILTERS = {
  sort: 'trend',
  time: 'all',
  type: '',
  genre: '',
  assetType: '',
  assetGenre: '',
  scriptType: '',
  ageRating: '',
  matchAllTags: true
};

export const WORKSHOP_FILTER_LABELS = {
  sort: {
    trend: 'Tendencia',
    popular: 'Más populares',
    favorites: 'Más favoritos',
    recent: 'Recientes',
    updated: 'Actualizados'
  },
  time: {
    all: 'Todo el tiempo',
    week: 'Última semana',
    month: 'Último mes',
    quarter: 'Últimos 3 meses',
    year: 'Último año'
  },
  ageRating: {
    Everyone: 'Everyone',
    Questionable: 'Questionable',
    Mature: 'Mature'
  }
};

export const TYPE_TAGS = [
  { value: '', label: 'Todos los tipos', icon: 'bi-grid' },
  { value: 'Scene', label: 'Escena', icon: 'bi-bezier2' },
  { value: 'Video', label: 'Video', icon: 'bi-camera-reels' },
  { value: 'Web', label: 'Web', icon: 'bi-browser-chrome' },
  { value: 'Application', label: 'Aplicación', icon: 'bi-window' }
];

/**
 * Cargar filtros guardados desde localStorage o retornar defaults
 * @returns {Object} Filtros cargados o defaults
 */
export const loadWorkshopFilters = () => {
  const saved = getStorageItem(STORAGE_KEYS.WORKSHOP_FILTERS);
  return saved ? { ...DEFAULT_WORKSHOP_FILTERS, ...saved } : DEFAULT_WORKSHOP_FILTERS;
};

/**
 * Guardar filtros en localStorage
 * @param {Object} filters - Filtros a guardar
 * @returns {boolean}
 */
export const saveWorkshopFilters = (filters) => {
  return setStorageItem(STORAGE_KEYS.WORKSHOP_FILTERS, filters);
};

/**
 * Resetear filtros a valores por defecto
 * @returns {Object}
 */
export const resetWorkshopFilters = () => {
  setStorageItem(STORAGE_KEYS.WORKSHOP_FILTERS, DEFAULT_WORKSHOP_FILTERS);
  return DEFAULT_WORKSHOP_FILTERS;
};

/**
 * Obtener chips de filtros activos para mostrar UI
 * @param {Object} filters - Filtros actuales
 * @returns {Array} Array de chips
 */
export const getActiveFilterChips = (filters = {}) => {
  const chips = [];

  const addChip = (key, label, value) => {
    if (!value) return;
    chips.push({
      key,
      label,
      value: label ? `${label}: ${value}` : value
    });
  };

  if (filters.sort && filters.sort !== DEFAULT_WORKSHOP_FILTERS.sort) {
    addChip('sort', 'Orden', WORKSHOP_FILTER_LABELS.sort[filters.sort] || filters.sort);
  }
  if (filters.time && filters.time !== DEFAULT_WORKSHOP_FILTERS.time) {
    addChip('time', 'Periodo', WORKSHOP_FILTER_LABELS.time[filters.time] || filters.time);
  }

  addChip('type', 'Tipo', WORKSHOP_FILTER_LABELS.type?.[filters.type] || filters.type);
  addChip('genre', 'Género', WORKSHOP_FILTER_LABELS.genre?.[filters.genre] || filters.genre);
  addChip('assetType', 'Asset', WORKSHOP_FILTER_LABELS.assetType?.[filters.assetType] || filters.assetType);
  addChip('assetGenre', 'Asset género', WORKSHOP_FILTER_LABELS.assetGenre?.[filters.assetGenre] || filters.assetGenre);
  addChip('scriptType', 'Script', WORKSHOP_FILTER_LABELS.scriptType?.[filters.scriptType] || filters.scriptType);
  addChip('ageRating', 'Age rating', WORKSHOP_FILTER_LABELS.ageRating?.[filters.ageRating] || filters.ageRating);

  if (filters.matchAllTags === false) {
    addChip('matchAllTags', '', 'Cualquier tag');
  }

  return chips;
};

/**
 * Validar y normalizar filtros
 * @param {Object} filters - Filtros a validar
 * @returns {Object} Filtros normalizados
 */
export const normalizeFilters = (filters = {}) => {
  return {
    ...DEFAULT_WORKSHOP_FILTERS,
    ...Object.keys(filters).reduce((acc, key) => {
      if (key in DEFAULT_WORKSHOP_FILTERS) {
        acc[key] = filters[key];
      }
      return acc;
    }, {})
  };
};
