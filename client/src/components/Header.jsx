import React, { useState, useCallback } from 'react';
import '../styles/header.css';

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
  ]
};

const Header = ({ onSearch, selectedCategory = '', onCategorySelect = () => {}, showTitle = true }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [workshopFilters, setWorkshopFilters] = useState({
    sort: 'trend',
    time: 'all',
    type: ''
  });

  const handleSearch = useCallback(e => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch(query);
  }, [onSearch]);

  const handleClear = useCallback(() => {
    setSearchQuery('');
    onSearch('');
  }, [onSearch]);

  const updateWorkshopFilter = useCallback((name, value) => {
    setWorkshopFilters(current => ({ ...current, [name]: value }));
  }, []);

  const resetWorkshopFilters = useCallback(() => {
    setWorkshopFilters({ sort: 'trend', time: 'all', type: '' });
    setSearchQuery('');
    onSearch('');
    onCategorySelect('');
  }, [onCategorySelect, onSearch]);

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
              <button
                type="button"
                className={`header-filter-btn ${filtersOpen ? 'active' : ''}`}
                aria-label="Configurar filtros"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen(current => !current)}
              >
                <i className="bi bi-funnel-fill"></i>
              </button>
              <button type="button" aria-label="Subir wallpaper"><i className="bi bi-cloud-arrow-up"></i></button>
              <button type="button" aria-label="Notificaciones"><i className="bi bi-bell"></i><span>3</span></button>
              <button type="button" aria-label="Perfil" className="header-avatar">WG</button>
            </div>

            {filtersOpen && (
              <div className="header-workshop-filters">
                <div className="header-filter-panel-title">
                  <h3><i className="bi bi-sliders2"></i> Filtros de busqueda</h3>
                  <button type="button" onClick={resetWorkshopFilters}>
                    <i className="bi bi-arrow-counterclockwise"></i> Limpiar filtros
                  </button>
                </div>

                <div className="header-filter-grid">
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

                  <label>
                    <span><i className="bi bi-tag"></i> Tipo de wallpaper</span>
                    <select value={workshopFilters.type} onChange={(event) => updateWorkshopFilter('type', event.target.value)}>
                      {WORKSHOP_FILTERS.type.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="header-filter-suggestions">
                  <span><i className="bi bi-lightbulb"></i> Busquedas populares:</span>
                  <div>
                    {['anime', 'nature', 'cyberpunk', 'abstract', 'game', 'space', 'city', 'fantasy'].map(suggestion => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          setSearchQuery(suggestion);
                          onSearch(suggestion);
                        }}
                      >
                        <i className="bi bi-search"></i> {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
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
