import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toPlayableUrl } from '../utils/mediaUrl';
import RecommendedWallpapers from './RecommendedWallpapers';
import '../styles/wallpaper-details.css';

const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|avi|mkv)(\?|#|$)/i;

export default function WallpaperDetails({ 
  wallpaper, 
  onClose, 
  onRepair, 
  onDelete, 
  onSubscribe,
  repairing = false,
  deleting = false,
  isDownloaded = false 
}) {
  const [isSubscribed, setIsSubscribed] = useState(wallpaper?.isSubscribed || false);
  const videoUrl = String(wallpaper?.mediaType || '').toLowerCase() === 'video'
    ? toPlayableUrl(wallpaper?.playbackUrl || wallpaper?.mediaUrl)
    : '';
  const mediaUrl = toPlayableUrl(wallpaper?.playbackUrl || wallpaper?.mediaUrl || wallpaper?.previewUrl || wallpaper?.image?.url || wallpaper?.preview?.url);
  const previewUrl = toPlayableUrl(wallpaper?.previewUrl || wallpaper?.preview?.url || wallpaper?.image?.url || mediaUrl);
  
  const isVideo = wallpaper?.mediaType === 'video'
    || VIDEO_EXTENSIONS.test([wallpaper?.playbackUrl, wallpaper?.mediaUrl, mediaUrl].filter(Boolean).join(' '));

  if (!wallpaper) return null;

  const handleSubscribe = () => {
    setIsSubscribed(!isSubscribed);
    onSubscribe?.(wallpaper, !isSubscribed);
  };

  const handleRepair = () => {
    onRepair?.(wallpaper);
  };

  const handleDelete = () => {
    if (confirm('¿Estás seguro de que deseas eliminar este wallpaper?')) {
      onDelete?.(wallpaper);
    }
  };

  const handleViewAuthor = () => {
    // This will trigger viewing the author's profile
    console.log('Ver perfil del autor:', wallpaper.authorId);
  };

  return createPortal(
    <div className="wallpaper-details-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="wallpaper-details-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        
        <div className="details-container">
          {/* Media Section */}
          <div className="details-media-section">
            {isVideo ? (
              <video 
                src={videoUrl} 
                poster={previewUrl}
                controls 
                autoPlay
                muted 
                loop 
                playsInline 
                preload="metadata"
              />
            ) : (
              <img src={previewUrl} alt={wallpaper.title} />
            )}
          </div>

          {/* Info Section */}
          <div className="details-info-section">
            <div className="details-header">
              <h1>{wallpaper.title}</h1>
              <p className="details-category">{wallpaper.category}</p>
            </div>

            {wallpaper.description && (
              <div className="details-description">
                <h3>Descripción</h3>
                <p>{wallpaper.description}</p>
              </div>
            )}

            {/* Author Section */}
            {wallpaper.authorInfo && (
              <div className="details-author-section">
                <div className="author-header">
                  <div className="author-info">
                    <h3>{wallpaper.authorInfo.name}</h3>
                    <p className="author-desc">{wallpaper.authorInfo.description}</p>
                    <div className="author-stats">
                      <span>{wallpaper.authorInfo.followers} seguidores</span>
                      <span>•</span>
                      <span>{wallpaper.authorInfo.wallpapers} wallpapers</span>
                    </div>
                  </div>
                  <div className="author-actions">
                    <button 
                      onClick={handleViewAuthor}
                      className="view-author-btn"
                    >
                      Ver Autor
                    </button>
                    <button 
                      onClick={handleSubscribe}
                      className={`subscribe-btn ${isSubscribed ? 'subscribed' : ''}`}
                    >
                      {isSubscribed ? 'Suscrito' : 'Suscribirse'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Stats Section */}
            <div className="details-stats">
              <div className="stat-item">
                <span className="stat-label">Descargas</span>
                <span className="stat-value">⬇️ {wallpaper.downloads}</span>
              </div>
              {wallpaper.likes && (
                <div className="stat-item">
                  <span className="stat-label">Me gusta</span>
                  <span className="stat-value">❤️ {wallpaper.likes}</span>
                </div>
              )}
              {wallpaper.rating && (
                <div className="stat-item">
                  <span className="stat-label">Calificación</span>
                  <span className="stat-value">⭐ {wallpaper.rating.average?.toFixed(1)} ({wallpaper.rating.count})</span>
                </div>
              )}
              {wallpaper.resolution && (
                <div className="stat-item">
                  <span className="stat-label">Resolución</span>
                  <span className="stat-value">{wallpaper.resolution}</span>
                </div>
              )}
              {wallpaper.uploadDate && (
                <div className="stat-item">
                  <span className="stat-label">Subido</span>
                  <span className="stat-value">{new Date(wallpaper.uploadDate).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            {/* Actions Section */}
            <div className="details-actions">
              {isDownloaded ? (
                <>
                  <button 
                    onClick={handleRepair} 
                    className="repair-btn"
                    disabled={repairing}
                  >
                    {repairing ? 'Reparando...' : 'Reparar'}
                  </button>
                  <button 
                    onClick={handleDelete} 
                    className="delete-btn"
                    disabled={deleting}
                  >
                    {deleting ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => window.open(`/download/${wallpaper._id}`)}
                  className="download-btn"
                >
                  Descargar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Recommended Wallpapers Section */}
        <RecommendedWallpapers 
          currentWallpaper={wallpaper}
          category={wallpaper.category}
        />
      </div>
    </div>,
    document.body
  );
}
