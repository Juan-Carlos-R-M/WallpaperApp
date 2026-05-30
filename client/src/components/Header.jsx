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

const Header = ({ onSearch, selectedCategory = '', onCategorySelect = () => {} }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const handleSearch = useCallback(e => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch(query);
  }, [onSearch]);

  const handleClear = useCallback(() => {
    setSearchQuery('');
    onSearch('');
  }, [onSearch]);

  return (
    <header className="header">
      <div className="header-container">
        <h1 className="header-title">Wallpaper Gallery</h1>
        <button
          type="button"
          className={`search-toggle ${searchOpen ? 'active' : ''}`}
          onClick={() => setSearchOpen(current => !current)}
          aria-expanded={searchOpen}
        >
          Buscar
        </button>
        {searchOpen && (
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
