import React, { useState, useRef, useEffect, memo } from 'react';
import MediaPlayer from './MediaPlayer';
import DownloadModal from './DownloadModal';
import ContextMenu from './ContextMenu';
import { downloadWallpaperAsset } from '../utils/downloadWallpaper';
import {
  enrichWallpaperMetadata,
  getWallpaperId,
  isDownloadedWallpaper,
  isVideoWallpaper
} from '../utils/wallpaperMeta';
import { applyWallpaperAccent } from '../utils/dynamicAccent';
import '../styles/wallpaper-card.css';

const WallpaperCard = memo(({
  wallpaper,
  onOpenDetails,
  onOpenAuthor,
  onRepair,
  onDelete,
  onDownload,
  onSubscribe,
  isFavorite,
  onToggleFavorite,
  repairing = false,
  deleting = false
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadedOverride, setDownloadedOverride] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const cardRef = useRef(null);

  const displayWallpaper = enrichWallpaperMetadata(wallpaper);
  const wallpaperId = getWallpaperId(displayWallpaper);
  const isDownloaded = downloadedOverride || isDownloadedWallpaper(displayWallpaper);
  const mediaType = isVideoWallpaper(displayWallpaper) ? 'video' : String(displayWallpaper.mediaType || 'image').toLowerCase();

  const isElectron = Boolean(window?.electronAPI?.getFavorites);


  // En Electron, la fuente de verdad es IPC -> favorites.json.
  // Por eso NO usamos localStorage como fallback aquí.
  const [isFavoriteState, setIsFavoriteState] = useState(() => {
    if (typeof isFavorite === 'boolean') return isFavorite;
    return false;
  });


  useEffect(() => {
    if (typeof isFavorite === 'boolean') {
      setIsFavoriteState(isFavorite);
    }
  }, [isFavorite]);


  useEffect(() => {
    const handleFavoritesUpdated = (e) => {
      if (getWallpaperId(e.detail.wallpaper) === getWallpaperId(wallpaper)) {
        setIsFavoriteState(e.detail.isFavorite);
      }
    };
    window.addEventListener('favorites-updated', handleFavoritesUpdated);
    return () => window.removeEventListener('favorites-updated', handleFavoritesUpdated);
  }, [wallpaper]);

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
    applyWallpaperAccent(displayWallpaper);
    onOpenDetails?.({ ...displayWallpaper, downloaded: isDownloaded });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    applyWallpaperAccent(displayWallpaper);
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
      const result = onDownload
        ? await onDownload(displayWallpaper)
        : await downloadWallpaperAsset(displayWallpaper);
      const resultWallpaper = result?.wallpaper || result?.data?.wallpaper || null;
      const downloadedWallpaper = {
        ...displayWallpaper,
        ...resultWallpaper,
        downloaded: true,
        installed: true,
        localPath: result?.path || resultWallpaper?.localPath || displayWallpaper.localPath,
        downloadPath: result?.path || resultWallpaper?.downloadPath || displayWallpaper.downloadPath
      };
      const message = result?.message
        || (result?.path
          ? `Descargado en ${result.path}`
          : `Descargado como ${result?.fileName || displayWallpaper.title}`);

      setDownloadedOverride(true);
      setDownloadNotice({ wallpaper: downloadedWallpaper, message });

      if (displayWallpaper.authorId) {
        onSubscribe?.(displayWallpaper.authorId, true, displayWallpaper);
      }
    } catch (error) {
      console.error('Error downloading wallpaper:', error);
      let errorMessage = error.message || 'No se pudo descargar el wallpaper';
      if (errorMessage.includes('\n')) {
        console.error('Detalles del error de descarga:\n' + errorMessage);
        const lines = errorMessage.split('\n');
        errorMessage = lines.slice(0, 3).join('\n');
      }
      alert(`Descarga fallida:\n\n${errorMessage}\n\nRevisa la consola para más detalles.`);
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

  const handleToggleFavorite = (event) => {
    event?.stopPropagation();
    event?.preventDefault();

    if (onToggleFavorite) {
      onToggleFavorite(wallpaper);
      return;
    }

    const ipcAvailable = Boolean(window?.electronAPI?.addFavorite && window?.electronAPI?.removeFavorite);

    // En Electron, persiste directo en favorites.json vía IPC.
    if (isElectron && ipcAvailable) {
      const id = displayWallpaper.id || displayWallpaper._id || displayWallpaper.publishedFileId || displayWallpaper.localPath || displayWallpaper.mediaUrl;
      const normalized = { ...displayWallpaper, id };
      const nextFavoriteState = !isFavoriteState;

      const promise = isFavoriteState
        ? window.electronAPI.removeFavorite(id)
        : window.electronAPI.addFavorite(normalized);

      promise.then(res => {
        if (res?.success) {
          setIsFavoriteState(nextFavoriteState);
          window.dispatchEvent(new CustomEvent('favorites-updated', {
            detail: { wallpaper: normalized, isFavorite: nextFavoriteState }
          }));
        }
      }).catch(err => {
        console.error('Error toggling favorite via IPC:', err);
      });
      return;
    }

    // Sin onToggleFavorite ni Electron: fallback a localStorage
    try {
      const favs = JSON.parse(localStorage.getItem('wallpaperApp.workshopFavorites') || '[]');
      const id = getWallpaperId(wallpaper);
      const exists = favs.some(item => getWallpaperId(item) === id);
      let nextFavorites;
      if (exists) {
        nextFavorites = favs.filter(item => getWallpaperId(item) !== id);
        setIsFavoriteState(false);
      } else {
        nextFavorites = [{ ...wallpaper, favoriteAddedAt: Date.now() }, ...favs];
        setIsFavoriteState(true);
      }
      localStorage.setItem('wallpaperApp.workshopFavorites', JSON.stringify(nextFavorites));
      window.dispatchEvent(new CustomEvent('favorites-updated', { detail: { wallpaper, isFavorite: !exists } }));
    } catch (err) {
      console.error('Error toggling favorite via localStorage:', err);
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

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const downloads = displayWallpaper.subscriptions || displayWallpaper.downloads || 0;
  const likes = displayWallpaper.favorited || displayWallpaper.likes || 0;
  const views = displayWallpaper.views || 0;

  const contextMenuOptions = [
    {
      label: 'Ver detalles',
      icon: 'info-circle',
      onClick: () => onOpenDetails?.({ ...displayWallpaper, downloaded: isDownloaded })
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
      label: isFavoriteState ? 'Quitar de Favoritos' : 'Añadir a Favoritos',
      icon: isFavoriteState ? 'heart-fill' : 'heart',
      active: isFavoriteState,
      onClick: () => handleToggleFavorite()
    },
    !isDownloaded ? {
      label: isDownloading ? 'Descargando...' : 'Descargar',
      icon: 'download',
      disabled: isDownloading,
      onClick: () => handleDownload({ stopPropagation: () => {}, preventDefault: () => {} })
    } : null,
    isDownloaded ? {
      label: repairing ? 'Reparando...' : 'Reparar',
      icon: 'arrow-repeat',
      disabled: repairing,
      onClick: () => handleRepair({ stopPropagation: () => {}, preventDefault: () => {} })
    } : null,
    isDownloaded ? {
      divider: true
    } : null,
    isDownloaded ? {
      label: deleting ? 'Eliminando...' : 'Eliminar',
      icon: 'trash',
      danger: true,
      disabled: deleting,
      onClick: () => handleDelete({ stopPropagation: () => {}, preventDefault: () => {} })
    } : null
  ].filter(Boolean);

  return (
    <div
      ref={cardRef}
      className={`wallpaper-card ${isDownloaded ? 'downloaded' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
      onContextMenu={handleContextMenu}
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
              <div className="card-actions-icon-row">
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  className={`action-icon-btn fav-btn ${isFavoriteState ? 'active' : ''}`}
                  title={isFavoriteState ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                >
                  <i className={`bi bi-heart${isFavoriteState ? '-fill' : ''}`}></i>
                </button>

                {isDownloaded ? (
                  <>
                    <button
                      type="button"
                      onClick={handleRepair}
                      className="action-icon-btn repair-btn"
                      disabled={repairing}
                      title="Reparar wallpaper"
                    >
                      <i className={`bi bi-arrow-repeat ${repairing ? 'spin-icon' : ''}`}></i>
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="action-icon-btn delete-btn danger"
                      disabled={deleting}
                      title="Eliminar wallpaper"
                    >
                      <i className={`bi bi-trash ${deleting ? 'spin-icon' : ''}`}></i>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="action-icon-btn download-btn success"
                    disabled={isDownloading}
                    title="Descargar wallpaper"
                  >
                    <i className={`bi bi-download ${isDownloading ? 'spin-icon' : ''}`}></i>
                  </button>
                )}
              </div>
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
});

WallpaperCard.displayName = 'WallpaperCard';

export default WallpaperCard;

