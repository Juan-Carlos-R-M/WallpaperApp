import React, { memo, useEffect, useRef, useState } from 'react';
import { toPlayableUrl } from '../../utils/mediaUrl';
import ContextMenu from '../../components/ContextMenu';
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
  const [isHovered, setIsHovered] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const cardRef = useRef(null);
  const isDownloaded = Boolean(downloadedWallpaper);
  const displayWallpaper = mergeDownloadedWallpaper(wallpaper, downloadedWallpaper);
  const previewUrl = toPlayableUrl(displayWallpaper.previewUrl || displayWallpaper.playbackUrl || displayWallpaper.mediaUrl || wallpaper.previewUrl);
  const videoUrl = isVideoWallpaper(displayWallpaper) && (displayWallpaper.playbackUrl || displayWallpaper.mediaUrl)
    ? toPlayableUrl(displayWallpaper.playbackUrl || displayWallpaper.mediaUrl)
    : '';
  const typeLabel = isDownloaded ? displayWallpaper.mediaType || 'instalado' : displayWallpaper.mediaType || 'workshop';

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

  const handleToggleFavorite = (event) => {
    event?.stopPropagation();
    event?.preventDefault();
    onToggleFavorite(wallpaper);
  };

  const handleDownload = (event) => {
    event?.stopPropagation();
    event?.preventDefault();
    if (isDownloaded) {
      onDownload(displayWallpaper);
    } else {
      onDownload(wallpaper);
    }
  };

  const handleDelete = (event) => {
    event?.stopPropagation();
    event?.preventDefault();
    onDelete(displayWallpaper);
  };

  const handleRepair = (event) => {
    event?.stopPropagation();
    event?.preventDefault();
    if (onRepair) {
      onRepair(wallpaper);
    }
  };

  const handleContextMenu = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      x: event.clientX,
      y: event.clientY
    });
  };

  const contextMenuOptions = [
    {
      label: 'Ver detalles',
      icon: 'info-circle',
      onClick: handleOpen
    },
    isDownloaded && window.electronAPI?.setWallpaper ? {
      label: 'Establecer como fondo',
      icon: 'display',
      onClick: async () => {
        try {
          const path = displayWallpaper.fileSystemPath || displayWallpaper.localPath || displayWallpaper.mediaUrl;
          if (!path) throw new Error("No hay ruta de archivo válida");
          const winPath = String(path).replace(/^local-media:\/\/[A-Z]\//i, (match) => {
            return match.slice(14, 15) + ':/';
          });
          const success = await window.electronAPI.setWallpaper(winPath);
          if (success) {
            alert("¡Fondo de pantalla establecido!");
          } else {
            alert("No se pudo establecer el fondo.");
          }
        } catch (err) {
          alert("Error: " + err.message);
        }
      }
    } : null,
    {
      label: isFavorite ? 'Quitar de Favoritos' : 'Añadir a Favoritos',
      icon: isFavorite ? 'heart-fill' : 'heart',
      active: isFavorite,
      onClick: () => onToggleFavorite(wallpaper)
    },
    !isDownloaded ? {
      label: isDownloading ? 'Descargando...' : 'Descargar',
      icon: 'download',
      disabled: isDownloading || !downloaderReady,
      onClick: () => onDownload(wallpaper)
    } : null,
    isDownloaded ? {
      label: isDownloading ? 'Reparando...' : 'Reparar',
      icon: 'arrow-repeat',
      disabled: isDownloading || !downloaderReady,
      onClick: () => onRepair && onRepair(wallpaper)
    } : null,
    isDownloaded ? {
      divider: true
    } : null,
    isDownloaded ? {
      label: isDeleting ? 'Eliminando...' : 'Eliminar',
      icon: 'trash',
      danger: true,
      disabled: isDeleting,
      onClick: () => onDelete(displayWallpaper)
    } : null
  ].filter(Boolean);

  return (
    <div
      className={`steam-card workshop-card gallery-workshop-card ${isDownloaded ? 'downloaded' : ''}`}
      ref={cardRef}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button className="steam-card-click" onClick={handleOpen}>
        <div className="steam-card-image">
          {isHovered && videoUrl ? (
            <video
              src={videoUrl}
              poster={previewUrl}
              muted
              loop
              playsInline
              autoPlay
              preload="auto"
            />
          ) : previewUrl && (
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

      <button
        type="button"
        className="card-more-btn"
        aria-label="Mas opciones"
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          setContextMenu({
            x: rect.left,
            y: rect.bottom + window.scrollY
          });
        }}
      >
        <i className="bi bi-three-dots"></i>
      </button>

      <div className="workshop-actions">
        <div className="card-actions-icon-row">
          <button
            type="button"
            className={`action-icon-btn fav-btn ${isFavorite ? 'active' : ''}`}
            onClick={handleToggleFavorite}
            title={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
          >
            <i className={`bi bi-heart${isFavorite ? '-fill' : ''}`}></i>
          </button>
          
          {isIncomplete ? (
            <>
              <button
                type="button"
                onClick={handleRepair}
                disabled={isDownloading || !downloaderReady}
                className="action-icon-btn repair-btn"
                title="Reparar eliminando y descargando de nuevo"
              >
                <i className={`bi bi-wrench ${isDownloading ? 'spin-icon' : ''}`}></i>
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="action-icon-btn delete-btn danger"
                title="Eliminar wallpaper"
              >
                <i className="bi bi-trash"></i>
              </button>
            </>
          ) : isDownloaded ? (
            <>
              {/^\d+$/.test(getWallpaperId(wallpaper)) && (
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={isDownloading || !downloaderReady}
                  className="action-icon-btn repair-btn"
                  title="Reparar/Re-descargar"
                >
                  <i className={`bi bi-arrow-repeat ${isDownloading ? 'spin-icon' : ''}`}></i>
                </button>
              )}
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="action-icon-btn delete-btn danger"
                title="Eliminar wallpaper"
              >
                <i className="bi bi-trash"></i>
              </button>
            </>
          ) : (
            <button
              onClick={handleDownload}
              disabled={isDownloading || !downloaderReady}
              className="action-icon-btn download-btn success"
              title="Descargar wallpaper"
            >
              <i className={`bi bi-download ${isDownloading ? 'spin-icon' : ''}`}></i>
            </button>
          )}
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          options={contextMenuOptions}
        />
      )}
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
