import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  enrichWallpaperMetadata,
  formatCompact,
  getPreviewUrl,
  normalizeTags
} from '../utils/wallpaperMeta';
import WallpaperCard from './WallpaperCard';
import '../styles/similar-wallpapers-modal.css';

export default function SimilarWallpapersModal({
  isOpen,
  wallpapers = [],
  currentWallpaper,
  onClose,
  onSelect,
  title = 'Wallpapers Similares'
}) {
  const overlayRef = useRef(null);
  const [selectedCategory, setSelectedCategory] = useState('all');

  if (!isOpen || !wallpapers.length) return null;

  // Agrupar por categoría
  const categories = {};
  wallpapers.forEach(wp => {
    const category = wp.category || 'Sin categoría';
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(wp);
  });

  const categories_list = Object.keys(categories).sort();
  const displayedWallpapers = selectedCategory === 'all'
    ? wallpapers
    : categories[selectedCategory] || [];

  const handleSelect = (wallpaper) => {
    onSelect?.(wallpaper);
    onClose?.();
  };

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) {
      onClose?.();
    }
  };

  return createPortal(
    <div className="similar-wallpapers-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="similar-wallpapers-modal">
        <header className="similar-modal-header">
          <h2>{title}</h2>
          <p className="similar-modal-subtitle">
            Encontramos <strong>{wallpapers.length}</strong> wallpapers similares
          </p>
          <button
            type="button"
            className="similar-modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </header>

        {categories_list.length > 1 && (
          <div className="similar-modal-filters">
            <button
              type="button"
              className={`filter-btn ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              Todos ({wallpapers.length})
            </button>
            {categories_list.map(category => (
              <button
                key={category}
                type="button"
                className={`filter-btn ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category} ({categories[category].length})
              </button>
            ))}
          </div>
        )}

        <div className="similar-modal-grid">
          {displayedWallpapers.map((wallpaper, index) => {
            const enriched = enrichWallpaperMetadata(wallpaper);
            const tags = normalizeTags(enriched);
            
            return (
              <div
                key={`${enriched._id || enriched.publishedFileId || enriched.id}-${index}`}
                className="similar-item"
              >
                <div
                  className="similar-item-preview"
                  onClick={() => handleSelect(wallpaper)}
                  role="button"
                  tabIndex={0}
                  onKeyPress={(e) => e.key === 'Enter' && handleSelect(wallpaper)}
                >
                  <img
                    src={getPreviewUrl(enriched)}
                    alt={enriched.title}
                    loading="lazy"
                  />
                  <div className="similar-item-overlay">
                    <button
                      type="button"
                      className="similar-item-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(wallpaper);
                      }}
                    >
                      <i className="bi bi-arrow-right"></i>
                      Ver
                    </button>
                  </div>
                </div>

                <div className="similar-item-info">
                  <h4 title={enriched.title}>{enriched.title}</h4>
                  <p className="similar-item-author">
                    <i className="bi bi-person-badge"></i>
                    {enriched.author || 'Autor desconocido'}
                  </p>

                  {tags.length > 0 && (
                    <div className="similar-item-tags">
                      {tags.slice(0, 2).map(tag => (
                        <span key={tag} className="tag">
                          <i className="bi bi-tag"></i>{tag}
                        </span>
                      ))}
                      {tags.length > 2 && (
                        <span className="tag-more">+{tags.length - 2}</span>
                      )}
                    </div>
                  )}

                  <div className="similar-item-stats">
                    <span>
                      <i className="bi bi-download"></i>
                      {formatCompact(enriched.downloads || enriched.subscriptions || 0)}
                    </span>
                    <span>
                      <i className="bi bi-heart"></i>
                      {formatCompact(enriched.likes || enriched.favorited || 0)}
                    </span>
                    <span>
                      <i className="bi bi-eye"></i>
                      {formatCompact(enriched.views || 0)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {displayedWallpapers.length === 0 && (
          <div className="similar-modal-empty">
            <i className="bi bi-inbox"></i>
            <p>No hay wallpapers en esta categoría</p>
          </div>
        )}

        <footer className="similar-modal-footer">
          <p>
            💡 Basado en etiquetas, categoría y contenido similar
          </p>
          <button
            type="button"
            className="similar-modal-button-close"
            onClick={onClose}
          >
            Cerrar
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
