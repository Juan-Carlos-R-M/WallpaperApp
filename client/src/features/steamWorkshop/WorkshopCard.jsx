import React, { memo, useEffect, useRef, useState } from 'react';
import { toPlayableUrl } from '../../utils/mediaUrl';
import {
  getWallpaperId,
  isVideoWallpaper,
  mergeDownloadedWallpaper
} from './workshopUtils';

const WorkshopCard = ({
  wallpaper,
  downloadedWallpaper,
  isFavorite,
  isDownloading,
  isDeleting,
  isIncomplete,
  downloaderReady,
  onOpen,
  onDownload,
  onDelete,
  onRepair,
  onToggleFavorite
}) => {
  const [isNearViewport, setIsNearViewport] = useState(false);
  const cardRef = useRef(null);
  const isDownloaded = Boolean(downloadedWallpaper);
  const displayWallpaper = mergeDownloadedWallpaper(wallpaper, downloadedWallpaper);
  const previewUrl = toPlayableUrl(displayWallpaper.previewUrl || displayWallpaper.playbackUrl || displayWallpaper.mediaUrl || wallpaper.previewUrl);
  const videoUrl = isVideoWallpaper(displayWallpaper) && (displayWallpaper.playbackUrl || displayWallpaper.mediaUrl)
    ? toPlayableUrl(displayWallpaper.playbackUrl || displayWallpaper.mediaUrl)
    : '';
  const typeLabel = isDownloaded ? displayWallpaper.mediaType || 'instalado' : displayWallpaper.mediaType || 'workshop';

  useEffect(() => {
    const node = cardRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setIsNearViewport(entry.isIntersecting),
      { rootMargin: '900px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const handleOpen = () => {
    console.log('[WorkshopCard] 🖱️ Clicked on wallpaper:', {
      title: displayWallpaper?.title,
      publishedFileId: displayWallpaper?.publishedFileId,
      description: displayWallpaper?.description?.substring(0, 50) + '...',
      tags: displayWallpaper?.tags,
      mediaType: displayWallpaper?.mediaType
    });
    onOpen(displayWallpaper);
  };
  const handleToggleFavorite = () => onToggleFavorite(wallpaper);
  const handleDownload = () => (isDownloaded ? onDownload(displayWallpaper) : onDownload(wallpaper));
  const handleDelete = () => onDelete(displayWallpaper);
  const handleRepair = () => onRepair && onRepair(wallpaper);

  return (
    <div className={`steam-card workshop-card gallery-workshop-card ${isDownloaded ? 'downloaded' : ''}`} ref={cardRef}>
      <button className="steam-card-click" onClick={handleOpen}>
        <div className="steam-card-image">
          {isNearViewport && videoUrl ? (
            <video
              src={videoUrl}
              poster={previewUrl}
              muted
              loop
              playsInline
              preload="metadata"
            />
          ) : isNearViewport && previewUrl && (
            <img
              src={previewUrl}
              alt={displayWallpaper.title}
              loading="lazy"
              decoding="async"
              onError={(event) => {
                event.target.style.display = 'none';
              }}
            />
          )}
          <div className="steam-card-overlay">
            <span className="steam-badge">
              <i className={`bi bi-${isDownloaded ? 'check-circle' : (typeLabel === 'Video' ? 'camera-reels' : 'image')}`}></i>
              {isDownloaded ? 'Instalado' : typeLabel}
            </span>
          </div>
        </div>
        <div className="steam-card-info">
          <h4>{displayWallpaper.title}</h4>
          {displayWallpaper.description && (
            <p className="description">{displayWallpaper.description}</p>
          )}
          <div className="workshop-meta">
            <span><i className="bi bi-download"></i> {Number(displayWallpaper.subscriptions || 0).toLocaleString()}</span>
            <span><i className="bi bi-heart"></i> {Number(displayWallpaper.favorited || 0).toLocaleString()}</span>
          </div>
        </div>
      </button>
      <div className="workshop-actions">
        <button type="button" className={`icon-action ${isFavorite ? 'liked' : ''}`} onClick={handleToggleFavorite}>
          <span>Favorito</span>
        </button>
        {isIncomplete ? (
          <>
            <button
              type="button"
              onClick={handleRepair}
              disabled={isDownloading || !downloaderReady}
              className="repair-wallpaper-btn primary"
              title="Reparar eliminando y descargando de nuevo"
            >
              <i className={`bi bi-wrench ${isDownloading ? 'spin-icon' : ''}`}></i>
              {isDownloading ? 'Reparando...' : 'Reparar'}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="delete-wallpaper-btn"
            >
              <i className="bi bi-trash"></i>
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </>
        ) : isDownloaded ? (
          <>
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading || !downloaderReady}
              className="repair-wallpaper-btn"
            >
              <i className={`bi bi-arrow-repeat ${isDownloading ? 'spin-icon' : ''}`}></i>
              {isDownloading ? 'Reparando...' : 'Reparar'}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="delete-wallpaper-btn"
            >
              <i className="bi bi-trash"></i>
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </>
        ) : (
          <button
            onClick={handleDownload}
            disabled={isDownloading || !downloaderReady}
            className="set-wallpaper-btn"
          >
            <i className={`bi bi-download ${isDownloading ? 'spin-icon' : ''}`}></i>
            {isDownloading ? 'Descargando...' : 'Descargar'}
          </button>
        )}
      </div>
    </div>
  );
};

const MemoWorkshopCard = memo(WorkshopCard);
MemoWorkshopCard.displayName = 'WorkshopCard';

const WorkshopGrid = ({
  items,
  downloadedById,
  favoriteIds,
  downloadingId,
  deletingId,
  downloaderReady,
  onOpen,
  onDownload,
  onDelete,
  onRepair,
  onToggleFavorite,
  isLoading = false
}) => (
  <div className="steam-grid workshop-grid virtual-grid">
    {items.map(wallpaper => (
      <MemoWorkshopCard
        key={getWallpaperId(wallpaper)}
        wallpaper={wallpaper}
        downloadedWallpaper={downloadedById.get(getWallpaperId(wallpaper)) || null}
        isFavorite={favoriteIds.has(getWallpaperId(wallpaper))}
        isDownloading={downloadingId === getWallpaperId(wallpaper)}
        isDeleting={deletingId === getWallpaperId(wallpaper)}
        isIncomplete={wallpaper.needsRepair === true}
        downloaderReady={downloaderReady}
        onOpen={onOpen}
        onDownload={onDownload}
        onDelete={onDelete}
        onRepair={onRepair}
        onToggleFavorite={onToggleFavorite}
      />
    ))}
    {isLoading && (
      <>
        {[...Array(12)].map((_, i) => (
          <div key={`skeleton-${i}`} className="skeleton-card gallery-skeleton-card">
            <div className="skeleton-image-wrapper">
              <div className="skeleton-image"></div>
              <div className="skeleton-badge"></div>
            </div>
            <div className="skeleton-info">
              <div className="skeleton-title"></div>
              <div className="skeleton-author"></div>
              <div className="skeleton-meta">
                <div className="skeleton-meta-item"></div>
                <div className="skeleton-meta-item"></div>
              </div>
            </div>
          </div>
        ))}
      </>
    )}
  </div>
);

export const MemoWorkshopGrid = memo(WorkshopGrid);
MemoWorkshopGrid.displayName = 'WorkshopGrid';

export { MemoWorkshopCard as WorkshopCardMemo, MemoWorkshopGrid as WorkshopGrid };
export default MemoWorkshopCard;
