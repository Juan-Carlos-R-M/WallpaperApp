import React, { useState, useRef, useEffect, memo } from 'react';
import MediaPlayer from './MediaPlayer';
import DownloadModal from './DownloadModal';
import { downloadWallpaperAsset } from '../utils/downloadWallpaper';
import {
  enrichWallpaperMetadata,
  getWallpaperId,
  isDownloadedWallpaper,
  isVideoWallpaper
} from '../utils/wallpaperMeta';
import '../styles/wallpaper-card.css';

const WallpaperCard = memo(({
  wallpaper,
  onOpenDetails,
  onOpenAuthor,
  onRepair,
  onDelete,
  onSubscribe,
  repairing = false,
  deleting = false
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadedOverride, setDownloadedOverride] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState(null);
  const cardRef = useRef(null);

  const displayWallpaper = enrichWallpaperMetadata(wallpaper);
  const isDownloaded = downloadedOverride || isDownloadedWallpaper(displayWallpaper);
  const mediaType = isVideoWallpaper(displayWallpaper) ? 'video' : String(displayWallpaper.mediaType || 'image').toLowerCase();

  useEffect(() => {
    setDownloadedOverride(false);
    setDownloadNotice(null);
  }, [getWallpaperId(wallpaper)]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entries[0].target);
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleCardClick = (event) => {
    if (event.target.closest('button') && !event.target.closest('.card-info')) {
      return;
    }
    onOpenDetails?.({ ...displayWallpaper, downloaded: isDownloaded });
  };

  const handleAuthorClick = (event) => {
    event.stopPropagation();
    const authorId = displayWallpaper.authorId || displayWallpaper.author;
    if (authorId) {
      onOpenAuthor?.(authorId);
    }
  };

  const repairWallpaper = (targetWallpaper = displayWallpaper) => {
    onRepair?.({ ...targetWallpaper, downloaded: true });
  };

  const deleteWallpaper = (targetWallpaper = displayWallpaper) => {
    onDelete?.({ ...targetWallpaper, downloaded: true });
  };

  const handleDownload = async (event) => {
    event.stopPropagation();
    event.preventDefault();

    try {
      setIsDownloading(true);
      const result = await downloadWallpaperAsset(displayWallpaper);
      const downloadedWallpaper = {
        ...displayWallpaper,
        downloaded: true,
        installed: true,
        localPath: result.path || displayWallpaper.localPath,
        downloadPath: result.path || displayWallpaper.downloadPath
      };
      const message = result.path
        ? `Guardado como ${result.fileName}`
        : `Descargado como ${result.fileName}`;

      setDownloadedOverride(true);
      setDownloadNotice({ wallpaper: downloadedWallpaper, message });

      if (displayWallpaper.authorId) {
        onSubscribe?.(displayWallpaper.authorId, true);
      }
    } catch (error) {
      console.error('Error downloading wallpaper:', error);
      alert(`No se pudo descargar el wallpaper: ${error.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRepair = (event) => {
    event.stopPropagation();
    event.preventDefault();
    repairWallpaper();
  };

  const handleDelete = (event) => {
    event.stopPropagation();
    event.preventDefault();
    deleteWallpaper();
  };

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const downloads = displayWallpaper.subscriptions || displayWallpaper.downloads || 0;
  const likes = displayWallpaper.favorited || displayWallpaper.likes || 0;
  const views = displayWallpaper.views || 0;

  return (
    <div
      ref={cardRef}
      className={`wallpaper-card ${isDownloaded ? 'downloaded' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      {isVisible ? (
        <>
          <div className="card-media">
            <MediaPlayer
              wallpaper={displayWallpaper}
              isHovered={isHovered}
              showControls={false}
            />
          </div>

          <span className="card-type-badge">
            <i className={`bi ${mediaType === 'video' ? 'bi-camera-reels' : 'bi-image'}`}></i>
            {mediaType === 'video' ? 'Video' : 'Imagen'}
          </span>

          {isDownloaded && (
            <span className="card-downloaded-badge">
              <i className="bi bi-check-circle-fill"></i>
              Descargado
            </span>
          )}

          <button
            type="button"
            className="card-more-btn"
            aria-label="Mas opciones"
            onClick={(event) => event.stopPropagation()}
          >
            <i className="bi bi-three-dots"></i>
          </button>

          <div className={`card-overlay ${isHovered ? 'visible' : ''}`}>
            <div className="card-info">
              <h3>{displayWallpaper.title || 'Sin titulo'}</h3>

              {displayWallpaper.description && (
                <p className="card-description">{displayWallpaper.description}</p>
              )}

              {displayWallpaper.author && (
                <p className="card-author">
                  <span className="author-label">por</span>
                  <button
                    className="author-link"
                    onClick={handleAuthorClick}
                    title={`Ver perfil de ${displayWallpaper.author}`}
                  >
                    {displayWallpaper.author}
                  </button>
                </p>
              )}

              <div className="card-stats">
                <span className="stat">
                  <i className="bi bi-eye"></i>
                  {formatNumber(views)}
                </span>
                <span className="stat">
                  <i className="bi bi-heart"></i>
                  {formatNumber(likes)}
                </span>
                <span className="stat">
                  <i className="bi bi-download"></i>
                  {formatNumber(downloads)}
                </span>
              </div>
            </div>

            <div className="card-actions">
              {isDownloaded ? (
                <>
                  <button
                    type="button"
                    onClick={handleRepair}
                    className="repair-btn"
                    disabled={repairing}
                    title="Reparar wallpaper"
                  >
                    <i className={`bi bi-arrow-repeat ${repairing ? 'spin-icon' : ''}`}></i>
                    {repairing ? 'Reparando...' : 'Reparar'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="delete-btn"
                    disabled={deleting}
                    title="Eliminar wallpaper"
                  >
                    <i className={`bi bi-trash ${deleting ? 'spin-icon' : ''}`}></i>
                    {deleting ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleDownload}
                  className="download-btn"
                  disabled={isDownloading}
                  title="Descargar wallpaper"
                >
                  <i className={`bi bi-download ${isDownloading ? 'spin-icon' : ''}`}></i>
                  {isDownloading ? 'Descargando...' : 'Descargar'}
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="card-placeholder" />
      )}

      {downloadNotice && (
        <DownloadModal
          wallpaper={downloadNotice.wallpaper}
          message={downloadNotice.message}
          onClose={() => setDownloadNotice(null)}
          onRepair={repairWallpaper}
          onDelete={deleteWallpaper}
        />
      )}
    </div>
  );
});

WallpaperCard.displayName = 'WallpaperCard';

export default WallpaperCard;
