import React, { useState, useRef, useEffect, memo } from 'react';
import MediaPlayer from './MediaPlayer';
import DownloadModal from './DownloadModal';
import { downloadWallpaperAsset } from '../utils/downloadWallpaper';
import '../styles/wallpaper-card.css';

const isDownloadedWallpaper = (wallpaper = {}) => (
  Boolean(wallpaper.localPath || wallpaper.fromSteam || wallpaper.installed || wallpaper.downloaded)
);

const WallpaperCard = memo(({
  wallpaper,
  onOpenDetails,
  onRepair,
  onDelete,
  onSubscribe,
  repairing = false,
  deleting = false
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState(null);
  const cardRef = useRef(null);
  const isDownloaded = isDownloadedWallpaper(wallpaper);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entries[0].target);
        }
      },
      { threshold: 0.1 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const openDetails = (e) => {
    e.stopPropagation();
    onOpenDetails?.(wallpaper);
  };

  const handleDownload = async (event) => {
    event.stopPropagation();

    try {
      setIsDownloading(true);
      const result = await downloadWallpaperAsset(wallpaper);
      const message = result.path
        ? `Guardado como ${result.fileName}`
        : `Descargado como ${result.fileName}`;
      setDownloadNotice({ wallpaper, message });
      
      // Auto-trigger subscription if author has subscribers
      if (wallpaper.authorId) {
        onSubscribe?.(wallpaper.authorId, true);
      }
    } catch (error) {
      alert(`No se pudo descargar el wallpaper: ${error.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRepair = (event) => {
    event.stopPropagation();
    onRepair?.(wallpaper);
  };

  const handleDelete = (event) => {
    event.stopPropagation();
    onDelete?.(wallpaper);
  };

  return (
    <div
      ref={cardRef}
      className={`wallpaper-card ${isDownloaded ? 'downloaded' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isVisible ? (
        <>
          <div className="card-media">
            <MediaPlayer 
              wallpaper={wallpaper}
              isHovered={isHovered}
              showControls={false}
            />
          </div>
          <div className={`card-overlay ${isHovered ? 'visible' : ''}`}>
            <div className="card-info">
              <h3>{wallpaper.title}</h3>
              {wallpaper.description && (
                <p className="card-description">{wallpaper.description}</p>
              )}
              {wallpaper.author && (
                <p className="card-author">by {wallpaper.author}</p>
              )}
              <div className="card-stats">
                <span className="badge">{wallpaper.mediaType}</span>
                <span className="downloads">⬇️ {wallpaper.downloads}</span>
              </div>
              {wallpaper.rating && (
                <div className="card-rating">
                  ⭐ {wallpaper.rating.average.toFixed(1)} ({wallpaper.rating.count})
                </div>
              )}
            </div>
            <div className="card-actions">
              <button type="button" onClick={openDetails} className="details-btn">
                Detalles
              </button>
              {isDownloaded ? (
                <>
                  <button type="button" onClick={handleRepair} className="repair-btn" disabled={repairing}>
                    {repairing ? 'Reparando...' : 'Reparar'}
                  </button>
                  <button type="button" onClick={handleDelete} className="delete-btn" disabled={deleting}>
                    {deleting ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </>
              ) : (
                <>
                  <button 
                    type="button"
                    onClick={handleRepair} 
                    className="repair-btn" 
                    disabled={repairing}
                    title="Reparar wallpaper desde galería"
                  >
                    {repairing ? 'Reparando...' : 'Reparar'}
                  </button>
                  <button 
                    type="button"
                    onClick={handleDelete} 
                    className="delete-btn" 
                    disabled={deleting}
                    title="Eliminar wallpaper de galería"
                  >
                    {deleting ? 'Eliminando...' : 'Eliminar'}
                  </button>
                  <button 
                    onClick={handleDownload} 
                    className="download-btn" 
                    disabled={isDownloading}
                  >
                    {isDownloading ? 'Descargando...' : 'Descargar'}
                  </button>
                </>
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
          onRepair={handleRepair}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
});

WallpaperCard.displayName = 'WallpaperCard';

export default WallpaperCard;
