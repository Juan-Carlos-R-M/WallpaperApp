export const DOWNLOAD_CONFIRMATION_STORAGE_KEY = 'wallpaperApp.showDownloadConfirmation';
export const WORKSHOP_PAGE_SIZE = 24; // Optimized: 33% fewer API calls than 18

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

export const TYPE_TAGS = [
  { value: '', label: 'Todos los tipos', icon: 'bi-grid' },
  { value: 'Scene', label: 'Escena', icon: 'bi-bezier2' },
  { value: 'Video', label: 'Video', icon: 'bi-camera-reels' },
  { value: 'Web', label: 'Web', icon: 'bi-browser-chrome' },
  { value: 'Application', label: 'Aplicacion', icon: 'bi-window' }
];

export const FAVORITE_CONTENT_TABS = [
  { value: 'normal', label: 'Contenido normal', icon: 'bi-heart' },
  { value: 'mature', label: 'Contenido maduro', icon: 'bi-shield-lock' }
];

export const FAVORITE_SORT_TABS = [
  { value: 'recent', label: 'Mas recientes', icon: 'bi-clock-history' },
  { value: 'popular', label: 'Populares', icon: 'bi-star-fill' },
  { value: 'downloads', label: 'Mas descargados', icon: 'bi-download' }
];

export const WORKSHOP_FILTER_LABELS = {
  sort: {
    trend: 'Tendencia',
    popular: 'Mas populares',
    favorites: 'Mas favoritos',
    recent: 'Recientes',
    updated: 'Actualizados'
  },
  time: {
    all: 'Todo el tiempo',
    week: 'Ultima semana',
    month: 'Ultimo mes',
    quarter: 'Ultimos 3 meses',
    year: 'Ultimo ano'
  },
  type: Object.fromEntries(TYPE_TAGS.map(tag => [tag.value, tag.label])),
  genre: {},
  assetType: {},
  assetGenre: {},
  scriptType: {},
  ageRating: {
    Everyone: 'Everyone',
    Questionable: 'Questionable',
    Mature: 'Mature'
  }
};

export const getActiveWorkshopFilterChips = (filters = {}) => {
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

  addChip('type', 'Tipo', WORKSHOP_FILTER_LABELS.type[filters.type] || filters.type);
  addChip('genre', 'Genero', WORKSHOP_FILTER_LABELS.genre[filters.genre] || filters.genre);
  addChip('assetType', 'Asset', WORKSHOP_FILTER_LABELS.assetType[filters.assetType] || filters.assetType);
  addChip('assetGenre', 'Asset genero', WORKSHOP_FILTER_LABELS.assetGenre[filters.assetGenre] || filters.assetGenre);
  addChip('scriptType', 'Script', WORKSHOP_FILTER_LABELS.scriptType[filters.scriptType] || filters.scriptType);
  addChip('ageRating', 'Age rating', WORKSHOP_FILTER_LABELS.ageRating[filters.ageRating] || filters.ageRating);

  if (filters.matchAllTags === false) {
    addChip('matchAllTags', '', 'Cualquier tag');
  }

  return chips;
};
