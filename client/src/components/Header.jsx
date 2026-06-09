import React, { useState, useCallback } from 'react';
import '../styles/header.css';

const handleAppExit = async () => {
  if (window.electronAPI?.invoke) {
    try {
      const result = await window.electronAPI.invoke('app-exit');
      if (!result?.success) {
        console.error('Error al cerrar la app:', result?.error);
      }
    } catch (error) {
      console.error('Error al invocar exit:', error);
      process.exit(0);
    }
  }
};

const CATEGORIES = [
  { id: '', label: 'Todos' },
  { id: 'nature', label: 'Naturaleza' },
  { id: 'abstract', label: 'Abstracto' },
  { id: 'urban', label: 'Urbano' },
  { id: 'technology', label: 'Tecnologia' },
  { id: 'art', label: 'Arte' }
];

const WORKSHOP_FILTERS = {
  sort: [
    { value: 'trend', label: 'Tendencia' },
    { value: 'popular', label: 'Mas populares' },
    { value: 'favorites', label: 'Mas favoritos' },
    { value: 'recent', label: 'Recientes' },
    { value: 'updated', label: 'Actualizados' }
  ],
  time: [
    { value: 'all', label: 'Todo el tiempo' },
    { value: 'week', label: 'Ultima semana' },
    { value: 'month', label: 'Ultimo mes' },
    { value: 'quarter', label: 'Ultimos 3 meses' },
    { value: 'year', label: 'Ultimo ano' }
  ],
  type: [
    { value: '', label: 'Todos los tipos' },
    { value: 'Scene', label: 'Escena' },
    { value: 'Video', label: 'Video' },
    { value: 'Web', label: 'Web' },
    { value: 'Application', label: 'Aplicacion' }
  ],
  genre: [
    { value: '', label: 'Todos los generos' },
    { value: 'Abstract', label: 'Abstract' },
    { value: 'Animal', label: 'Animal' },
    { value: 'Anime', label: 'Anime' },
    { value: 'Cartoon', label: 'Cartoon' },
    { value: 'CGI', label: 'CGI' },
    { value: 'Cyberpunk', label: 'Cyberpunk' },
    { value: 'Fantasy', label: 'Fantasy' },
    { value: 'Game', label: 'Game' },
    { value: 'Girls', label: 'Girls' },
    { value: 'Guys', label: 'Guys' },
    { value: 'Landscape', label: 'Landscape' },
    { value: 'Medieval', label: 'Medieval' },
    { value: 'Music', label: 'Music' },
    { value: 'Nature', label: 'Nature' },
    { value: 'Pixel art', label: 'Pixel art' },
    { value: 'Sci-Fi', label: 'Sci-Fi' },
    { value: 'Space', label: 'Space' },
    { value: 'Technology', label: 'Technology' }
  ],
  assetType: [
    { value: '', label: 'Todos los assets' },
    { value: 'Script', label: 'Script' },
    { value: 'Particle System', label: 'Particle system' },
    { value: 'Sound', label: 'Sound' },
    { value: 'PBR', label: 'PBR' },
    { value: 'Model', label: 'Model' },
    { value: 'Texture', label: 'Texture' }
  ],
  assetGenre: [
    { value: '', label: 'Cualquier genero de asset' },
    { value: 'Nature', label: 'Nature' },
    { value: 'Cyberpunk', label: 'Cyberpunk' },
    { value: 'Abstract', label: 'Abstract' },
    { value: 'Sci-Fi', label: 'Sci-Fi' },
    { value: 'Fantasy', label: 'Fantasy' },
    { value: 'Game', label: 'Game' }
  ],
  scriptType: [
    { value: '', label: 'Cualquier script' },
    { value: 'UI', label: 'UI' },
    { value: 'Visual', label: 'Visual' },
    { value: 'Interactive', label: 'Interactive' },
    { value: 'Game', label: 'Game' }
  ],
  ageRating: [
    { value: '', label: 'Cualquier edad' },
    { value: 'Everyone', label: 'Everyone' },
    { value: 'Questionable', label: 'Questionable' },
    { value: 'Mature', label: 'Mature' }
  ]
};

const DEFAULT_WORKSHOP_FILTERS = {
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

const formatNotificationTime = (value) => {
  if (!value) return '';

  try {
    return new Date(value).toLocaleString();
  } catch {
    return '';
  }
};

const Header = ({
  activeTab = 'home',
  searchQuery = '',
  onSearch,
  selectedCategory = '',
  onCategorySelect = () => {},
  workshopFilters = DEFAULT_WORKSHOP_FILTERS,
  onWorkshopFiltersChange = () => {},
  onResetWorkshopFilters = () => {},
  notifications = [],
  onRemoveNotification = () => {},
  onClearNotifications = () => {},
  onMarkNotificationsRead = () => {},
  onUpload = () => {},
  onOpenProfile = () => {},
  showTitle = true
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const isWorkshopScreen = activeTab === 'steam';
  const isFavoritesScreen = activeTab === 'favorites';
  const usesWorkshopFilters = isWorkshopScreen || isFavoritesScreen;
  const canShowFilters = ['home', 'gallery', 'steam', 'favorites'].includes(activeTab);
  const unreadNotifications = notifications.filter(notification => !notification.read).length;
  const activeWorkshopFilterCount = [
    workshopFilters.sort !== DEFAULT_WORKSHOP_FILTERS.sort,
    workshopFilters.time !== DEFAULT_WORKSHOP_FILTERS.time,
    workshopFilters.type,
    workshopFilters.genre,
    workshopFilters.assetType,
    workshopFilters.assetGenre,
    workshopFilters.scriptType,
    workshopFilters.ageRating,
    workshopFilters.matchAllTags === false
  ].filter(Boolean).length;

  const handleSearch = useCallback(e => {
    const query = e.target.value;
    onSearch(query);
  }, [onSearch]);

  const handleClear = useCallback(() => {
    onSearch('');
  }, [onSearch]);

  const updateWorkshopFilter = useCallback((name, value) => {
    onWorkshopFiltersChange({ ...workshopFilters, [name]: value });
  }, [onWorkshopFiltersChange, workshopFilters]);

  const resetWorkshopFilters = useCallback(() => {
    onResetWorkshopFilters();
    onSearch('');
    if (!usesWorkshopFilters) {
      onCategorySelect('');
    }
  }, [onCategorySelect, onResetWorkshopFilters, onSearch, usesWorkshopFilters]);

  const toggleNotifications = useCallback(() => {
    setNotificationsOpen(current => {
      const nextOpen = !current;
      if (nextOpen) {
        onMarkNotificationsRead();
      }
      return nextOpen;
    });
  }, [onMarkNotificationsRead]);

  return (
    <header className={`header ${showTitle ? '' : 'header-compact'}`}>
      <div className="header-container">
        {showTitle && <h1 className="header-title">Wallpaper Gallery</h1>}

        {!showTitle ? (
          <>
            <div className="compact-search-box">
              <input
                type="text"
                placeholder="Buscar wallpapers..."
                value={searchQuery}
                onChange={handleSearch}
                className="search-input"
              />
              {searchQuery ? (
                <button type="button" onClick={handleClear} className="search-clear">x</button>
              ) : (
                <i className="bi bi-search"></i>
              )}
            </div>

            <div className="header-actions">
              {canShowFilters && (
                <button
                  type="button"
                  className={`header-filter-btn ${filtersOpen || (usesWorkshopFilters && activeWorkshopFilterCount > 0) ? 'active' : ''}`}
                  aria-label="Configurar filtros"
                  aria-expanded={filtersOpen}
                  onClick={() => setFiltersOpen(current => !current)}
                >
                  <i className="bi bi-funnel-fill"></i>
                  {usesWorkshopFilters && activeWorkshopFilterCount > 0 && <span>{activeWorkshopFilterCount}</span>}
                </button>
              )}
              <button type="button" aria-label="Subir wallpaper" onClick={onUpload}>
                <i className="bi bi-cloud-arrow-up"></i>
              </button>
              <button
                type="button"
                className={`header-notification-btn ${notificationsOpen ? 'active' : ''}`}
                aria-label="Notificaciones"
                aria-expanded={notificationsOpen}
                onClick={toggleNotifications}
              >
                <i className="bi bi-bell"></i>
                {unreadNotifications > 0 && <span>{Math.min(unreadNotifications, 99)}</span>}
              </button>
              <button type="button" aria-label="Perfil" className="header-avatar" onClick={onOpenProfile}>WG</button>
              {window.electronAPI && (
                <button 
                  type="button" 
                  aria-label="Salir" 
                  className="header-exit-btn" 
                  onClick={handleAppExit}
                  title="Salir de la aplicación"
                >
                  <i className="bi bi-box-arrow-right"></i>
                </button>
              )}
            </div>

            {filtersOpen && canShowFilters && (
              <div className="header-workshop-filters">
                <div className="header-filter-panel-title">
                  <h3>
                    <i className="bi bi-sliders2"></i>
                    {isWorkshopScreen ? 'Filtros de Workshop' : isFavoritesScreen ? 'Filtros de me gusta' : 'Filtros de galeria'}
                  </h3>
                  <button type="button" onClick={resetWorkshopFilters}>
                    <i className="bi bi-arrow-counterclockwise"></i> Limpiar filtros
                  </button>
                </div>

                {usesWorkshopFilters ? (
                  <>
                    <div className={`header-filter-grid ${isFavoritesScreen ? 'single-filter' : ''}`}>
                      {isWorkshopScreen && (
                        <>
                          <label>
                            <span><i className="bi bi-sort-down"></i> Ordenar por</span>
                            <select value={workshopFilters.sort} onChange={(event) => updateWorkshopFilter('sort', event.target.value)}>
                              {WORKSHOP_FILTERS.sort.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>

                          <label>
                            <span><i className="bi bi-calendar"></i> Periodo</span>
                            <select value={workshopFilters.time} onChange={(event) => updateWorkshopFilter('time', event.target.value)}>
                              {WORKSHOP_FILTERS.time.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>
                        </>
                      )}

                      <label>
                        <span><i className="bi bi-tag"></i> Tipo de wallpaper</span>
                        <select value={workshopFilters.type} onChange={(event) => updateWorkshopFilter('type', event.target.value)}>
                          {WORKSHOP_FILTERS.type.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span><i className="bi bi-stars"></i> Genero</span>
                        <select value={workshopFilters.genre || ''} onChange={(event) => updateWorkshopFilter('genre', event.target.value)}>
                          {WORKSHOP_FILTERS.genre.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span><i className="bi bi-shield-check"></i> Age rating</span>
                        <select value={workshopFilters.ageRating || ''} onChange={(event) => updateWorkshopFilter('ageRating', event.target.value)}>
                          {WORKSHOP_FILTERS.ageRating.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>

                      {isWorkshopScreen && (
                        <>
                          <label>
                            <span><i className="bi bi-box"></i> Asset type</span>
                            <select value={workshopFilters.assetType || ''} onChange={(event) => updateWorkshopFilter('assetType', event.target.value)}>
                              {WORKSHOP_FILTERS.assetType.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>

                          <label>
                            <span><i className="bi bi-palette"></i> Asset genre</span>
                            <select value={workshopFilters.assetGenre || ''} onChange={(event) => updateWorkshopFilter('assetGenre', event.target.value)}>
                              {WORKSHOP_FILTERS.assetGenre.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>

                          <label>
                            <span><i className="bi bi-code-slash"></i> Script type</span>
                            <select value={workshopFilters.scriptType || ''} onChange={(event) => updateWorkshopFilter('scriptType', event.target.value)}>
                              {WORKSHOP_FILTERS.scriptType.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>

                          <label className="header-filter-toggle">
                            <span><i className="bi bi-intersect"></i> Coincidencia</span>
                            <button
                              type="button"
                              className={workshopFilters.matchAllTags === false ? '' : 'active'}
                              onClick={() => updateWorkshopFilter('matchAllTags', workshopFilters.matchAllTags === false)}
                            >
                              {workshopFilters.matchAllTags === false ? 'Cualquier tag' : 'Todos los tags'}
                            </button>
                          </label>
                        </>
                      )}
                    </div>

                    {isWorkshopScreen && (
                      <div className="header-filter-suggestions">
                        <span><i className="bi bi-lightbulb"></i> Busquedas populares:</span>
                        <div>
                          {['anime', 'nature', 'cyberpunk', 'abstract', 'game', 'space', 'city', 'fantasy'].map(suggestion => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => onSearch(suggestion)}
                            >
                              <i className="bi bi-search"></i> {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="header-category-filters" aria-label="Filtros de galeria">
                    {CATEGORIES.map(category => (
                      <button
                        key={category.id}
                        type="button"
                        className={selectedCategory === category.id ? 'active' : ''}
                        onClick={() => onCategorySelect(category.id)}
                      >
                        {category.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {notificationsOpen && (
              <div className="header-notifications-panel" role="dialog" aria-label="Lista de notificaciones">
                <div className="header-notifications-title">
                  <h3><i className="bi bi-bell-fill"></i> Notificaciones</h3>
                  {notifications.length > 0 && (
                    <button type="button" onClick={onClearNotifications}>
                      <i className="bi bi-trash3"></i> Limpiar
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="header-notifications-empty">
                    <i className="bi bi-inbox"></i>
                    <p>No hay notificaciones todavia.</p>
                  </div>
                ) : (
                  <div className="header-notification-list">
                    {notifications.map(notification => (
                      <article key={notification.id} className={`header-notification-card ${notification.type}`}>
                        <div className="header-notification-icon">
                          <i className={`bi bi-${
                            notification.type === 'success'
                              ? 'check-circle-fill'
                              : notification.type === 'progress'
                                ? 'arrow-repeat'
                                : 'exclamation-triangle-fill'
                          }`}></i>
                        </div>
                        <div className="header-notification-content">
                          <div>
                            <strong>{notification.title || 'Notificacion'}</strong>
                            {notification.status && <span>{notification.status}</span>}
                          </div>
                          <p>{notification.message}</p>
                          {notification.type === 'progress' && typeof notification.progress === 'number' && (
                            <div className="header-notification-progress">
                              <div className="progress-bar">
                                <div className="progress-fill" style={{ width: `${Math.min(notification.progress, 100)}%` }}></div>
                              </div>
                              <small>{Math.round(notification.progress)}%</small>
                            </div>
                          )}
                          {notification.wallpaper?.title && (
                            <small><i className="bi bi-image"></i> {notification.wallpaper.title}</small>
                          )}
                          {notification.path && (
                            <small><i className="bi bi-folder2-open"></i> {notification.path}</small>
                          )}
                          <time dateTime={notification.createdAt}>{formatNotificationTime(notification.createdAt)}</time>
                        </div>
                        <button
                          type="button"
                          className="header-notification-remove"
                          onClick={() => onRemoveNotification(notification.id)}
                          aria-label="Quitar notificacion"
                        >
                          <i className="bi bi-x-lg"></i>
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <button
            type="button"
            className={`search-toggle ${searchOpen ? 'active' : ''}`}
            onClick={() => setSearchOpen(current => !current)}
            aria-expanded={searchOpen}
          >
            Buscar
          </button>
        )}

        {showTitle && searchOpen && (
          <div className="search-panel">
            <div className="search-box">
              <input
                type="text"
                placeholder="Buscar wallpapers..."
                value={searchQuery}
                onChange={handleSearch}
                className="search-input"
                autoFocus
              />
              {searchQuery && (
                <button type="button" onClick={handleClear} className="search-clear">x</button>
              )}
            </div>
            <div className="search-filters" aria-label="Filtros de busqueda">
              {CATEGORIES.map(category => (
                <button
                  key={category.id}
                  type="button"
                  className={`search-filter-btn ${selectedCategory === category.id ? 'active' : ''}`}
                  onClick={() => onCategorySelect(category.id)}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
