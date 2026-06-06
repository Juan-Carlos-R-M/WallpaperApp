import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  enrichWallpaperMetadata,
  formatCompact,
  formatDate,
  formatFileSize,
  formatPlaybackTime,
  getAuthorInfo,
  getPreviewUrl,
  getVideoPlaybackUrl,
  normalizeTags
} from '../utils/wallpaperMeta';
import { applyWallpaperAccent } from '../utils/dynamicAccent';
import '../styles/steam-integration.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

export default function WallpaperDetails({
  wallpaper,
  onClose,
  onBack,
  onNavigate,
  onDownload,
  onDelete,
  onToggleFavorite,
  onOpenAuthor,
  onSubscribe,
  isDownloaded = false,
  isFavorite = false,
  isSubscribed = false,
  repairing = false,
  deleting = false,
  downloaderReady = true,
  relatedWallpapers = [],
  authorWallpapers = [],
  onOpenRelated,
  sourceName = 'Local',
  sourceIcon = 'hdd-stack',
  sourceTarget = '',
  showComments = false
}) {
  const overlayRef = useRef(null);
  const videoRef = useRef(null);
  const relatedRowRef = useRef(null);
  const sideAuthorRowRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [favorite, setFavorite] = useState(isFavorite);
  const [subscribed, setSubscribed] = useState(isSubscribed);
  const [resolvedAuthor, setResolvedAuthor] = useState('');
  const [workshopWallpaperDetails, setWorkshopWallpaperDetails] = useState(null);
  const [workshopAuthorProfile, setWorkshopAuthorProfile] = useState(null);

  const localWallpaper = enrichWallpaperMetadata(wallpaper || {});
  const displayWallpaper = enrichWallpaperMetadata({
    ...localWallpaper,
    ...(workshopWallpaperDetails || {}),
    description: localWallpaper.description || workshopWallpaperDetails?.description || '',
    previewUrl: localWallpaper.previewUrl || workshopWallpaperDetails?.previewUrl,
    mediaUrl: localWallpaper.mediaUrl || workshopWallpaperDetails?.mediaUrl,
    playbackUrl: localWallpaper.playbackUrl || workshopWallpaperDetails?.playbackUrl,
    localPath: localWallpaper.localPath,
    installed: localWallpaper.installed,
    downloaded: localWallpaper.downloaded,
    fromSteam: localWallpaper.fromSteam || workshopWallpaperDetails?.fromSteam,
    tags: Array.from(new Set([
      ...(Array.isArray(workshopWallpaperDetails?.tags) ? workshopWallpaperDetails.tags : []),
      ...(Array.isArray(localWallpaper.tags) ? localWallpaper.tags : [])
    ].filter(Boolean)))
  });
  const authorInfo = workshopAuthorProfile?.profile || getAuthorInfo(displayWallpaper) || displayWallpaper.authorInfo;

  useEffect(() => {
    setFavorite(isFavorite);
  }, [isFavorite]);

  useEffect(() => {
    setSubscribed(isSubscribed);
  }, [isSubscribed]);

  useEffect(() => {
    setWorkshopAuthorProfile(null);

    const authorId = displayWallpaper.authorId || displayWallpaper.creator;
    const shouldFetchAuthor = Boolean(
      authorId
      && /^\d+$/.test(String(authorId))
      && window?.electronAPI
      && typeof window.electronAPI.getWorkshopAuthorProfile === 'function'
    );

    if (!shouldFetchAuthor) return undefined;

    let active = true;

    const fetchAuthorProfile = async () => {
      try {
        const result = await window.electronAPI.getWorkshopAuthorProfile(authorId, { limit: 12 });
        if (!active || !result?.success) return;
        setWorkshopAuthorProfile(result.data || null);
      } catch (error) {
        console.error('Error loading Workshop author profile:', error);
      }
    };

    fetchAuthorProfile();

    return () => {
      active = false;
    };
  }, [displayWallpaper.authorId, displayWallpaper.creator, displayWallpaper.publishedFileId]);

  useEffect(() => {
    setWorkshopWallpaperDetails(null);

    const publishedFileId = localWallpaper.publishedFileId;
    const shouldFetchDetails = Boolean(
      publishedFileId
      && /^\d+$/.test(String(publishedFileId))
      && window?.electronAPI
      && typeof window.electronAPI.getWorkshopWallpaperDetails === 'function'
    );

    if (!shouldFetchDetails) return undefined;

    let active = true;

    const fetchWorkshopDetails = async () => {
      try {
        const result = await window.electronAPI.getWorkshopWallpaperDetails(publishedFileId);
        if (!active || !result?.success || !result.data) return;
        setWorkshopWallpaperDetails(enrichWallpaperMetadata({
          ...result.data,
          fromSteam: true
        }));
      } catch (error) {
        console.error('Error loading Workshop wallpaper details:', error);
      }
    };

    fetchWorkshopDetails();

    return () => {
      active = false;
    };
  }, [localWallpaper.publishedFileId]);

  useEffect(() => {
    if (!wallpaper) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    overlayRef.current?.scrollTo({ top: 0 });
    applyWallpaperAccent(displayWallpaper);

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [wallpaper, displayWallpaper.publishedFileId, displayWallpaper.previewUrl, displayWallpaper.title]);

  const videoUrl = getVideoPlaybackUrl(displayWallpaper);
  const previewUrl = getPreviewUrl(displayWallpaper);
  const isVideo = Boolean(videoUrl);
  const tags = normalizeTags(displayWallpaper);
  const progress = duration ? Math.min(100, (currentTime / duration) * 100) : 0;
  const authorName = authorInfo?.name || displayWallpaper.author || 'Autor';
  const authorId = workshopAuthorProfile?.profile?.id || authorInfo?.id || displayWallpaper.authorId || displayWallpaper.creator || authorName;
  const displayAuthor = authorInfo?.name || resolvedAuthor || authorName;
  const displayedAuthorWallpapers = workshopAuthorProfile?.wallpapers?.length
    ? workshopAuthorProfile.wallpapers.filter(item => item.publishedFileId !== displayWallpaper.publishedFileId)
    : authorWallpapers;

  useEffect(() => {
    setResolvedAuthor('');

    const shouldFetchAuthor = Boolean(
      displayWallpaper.publishedFileId
      && window?.electronAPI
      && typeof window.electronAPI.getWorkshopAuthorName === 'function'
      && (/^\d+$/.test(authorName) || displayWallpaper.fromSteam)
    );

    if (!shouldFetchAuthor) return undefined;

    let active = true;

    const fetchAuthorName = async () => {
      try {
        const result = await window.electronAPI.getWorkshopAuthorName(displayWallpaper.publishedFileId);
        if (!active || !result?.success) return;
        const resolved = String(result.data || '').trim();
        if (resolved) setResolvedAuthor(resolved);
      } catch (error) {
        console.error('Error resolving Workshop author name:', error);
      }
    };

    fetchAuthorName();

    return () => {
      active = false;
    };
  }, [displayWallpaper.publishedFileId, displayWallpaper.fromSteam, authorName]);

  if (!wallpaper) return null;

  const details = [
    ['Tipo', displayWallpaper.mediaType || tags[0] || 'Imagen'],
    displayWallpaper.publishedFileId ? ['ID Workshop', displayWallpaper.publishedFileId] : null,
    displayWallpaper.localPath ? ['Ubicacion', displayWallpaper.localPath] : null,
    displayWallpaper.resolution ? ['Resolucion', displayWallpaper.resolution] : null,
    ['Tamano', formatFileSize(displayWallpaper.fileSize)],
    displayWallpaper.timeCreated ? ['Fecha', formatDate(displayWallpaper.timeCreated)] : null,
    displayWallpaper.timeUpdated ? ['Actualizado', formatDate(displayWallpaper.timeUpdated)] : null,
    ['Etiquetas', tags.join(', ')]
  ].filter(Boolean);

  const togglePlayback = async () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      await videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  };

  const seekVideo = (event) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    video.currentTime = ratio * duration;
  };

  const handleToggleFavorite = () => {
    setFavorite(prev => !prev);
    onToggleFavorite?.(displayWallpaper);
  };

  const handleSubscribe = () => {
    const nextSubscribed = !subscribed;
    setSubscribed(nextSubscribed);
    onSubscribe?.(authorId, nextSubscribed, displayWallpaper);
  };

  const handleDownload = () => {
    onDownload?.(displayWallpaper);
    if (!isDownloaded && authorId) {
      setSubscribed(true);
      onSubscribe?.(authorId, true, displayWallpaper);
    }
  };

  const handleDelete = () => {
    if (onDelete && confirm('Eliminar este wallpaper?')) {
      onDelete(displayWallpaper);
    }
  };

  const handleOpenAuthor = () => {
    onOpenAuthor?.(authorId);
  };

  const handleBreadcrumbNavigate = (target) => {
    if (onNavigate && target) {
      onNavigate(target);
      return;
    }

    (onBack || onClose)?.();
  };

  const handleOpenRelated = (item) => {
    if (!item || !onOpenRelated) return;
    overlayRef.current?.scrollTo({ top: 0 });
    onOpenRelated(item);
  };

  const scrollWallpaperRow = (rowRef, direction) => {
    const row = rowRef.current;
    if (!row) return;
    row.scrollBy({
      left: direction * Math.max(260, Math.floor(row.clientWidth * 0.82)),
      behavior: 'smooth'
    });
  };

  const renderHorizontalWallpapers = (items, rowRef, className = '') => (
    <div className="detail-carousel-shell">
      <button
        type="button"
        className="detail-carousel-arrow previous"
        aria-label="Wallpapers anteriores"
        onClick={() => scrollWallpaperRow(rowRef, -1)}
      >
        <i className="bi bi-chevron-left"></i>
      </button>
      <div className={`detail-horizontal-row ${className}`} ref={rowRef}>
        {items.map((item, index) => {
          const related = enrichWallpaperMetadata(item);
          const downloaded = Boolean(related.localPath || related.installed || related.downloaded || related.fromSteam);
          const statValue = related.views || related.downloads || related.subscriptions || related.likes || 0;
          return (
            <button
              key={related._id || related.publishedFileId || related.id || index}
              type="button"
              onClick={() => handleOpenRelated(related)}
              className={index === 0 ? 'active' : ''}
              title={related.title}
            >
              <img src={getPreviewUrl(related)} alt={related.title} />
              <small>{downloaded ? 'Instalado' : 'Workshop'}</small>
              <span>{related.title}</span>
              <em><i className="bi bi-eye"></i> {formatCompact(statValue)}</em>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="detail-carousel-arrow next"
        aria-label="Wallpapers siguientes"
        onClick={() => scrollWallpaperRow(rowRef, 1)}
      >
        <i className="bi bi-chevron-right"></i>
      </button>
    </div>
  );

  const renderRecommendationStrip = (items) => {
    const visibleItems = items.slice(0, 5);
    const hiddenCount = Math.max(0, items.length - visibleItems.length);

    return (
      <div className="detail-thumbnail-strip">
        <button
          type="button"
          className="detail-strip-arrow previous"
          aria-label="Recomendaciones anteriores"
          onClick={() => scrollWallpaperRow(relatedRowRef, -1)}
        >
          <i className="bi bi-chevron-left"></i>
        </button>

        <div className="detail-strip-row" ref={relatedRowRef}>
          {visibleItems.map((item, index) => {
            const related = enrichWallpaperMetadata(item);
            return (
              <button
                key={related._id || related.publishedFileId || related.id || index}
                type="button"
                className={index === 0 ? 'active' : ''}
                title={related.title}
                onClick={() => handleOpenRelated(related)}
              >
                <img src={getPreviewUrl(related)} alt={related.title} />
              </button>
            );
          })}

          {hiddenCount > 0 && (
            <button
              type="button"
              className="detail-strip-more"
              aria-label={`${hiddenCount} recomendaciones mas`}
              onClick={() => scrollWallpaperRow(relatedRowRef, 1)}
            >
              <span>+{hiddenCount}</span>
            </button>
          )}
        </div>

        <button
          type="button"
          className="detail-strip-arrow next"
          aria-label="Mas recomendaciones"
          onClick={() => scrollWallpaperRow(relatedRowRef, 1)}
        >
          <i className="bi bi-chevron-right"></i>
        </button>
      </div>
    );
  };

  const primaryActionLabel = isDownloaded ? 'Reparar' : 'Descargar';
  const primaryActionIcon = isDownloaded ? 'arrow-repeat' : 'download';
  const primaryActionDisabled = repairing || !downloaderReady || !onDownload;

  return createPortal(
    <div className="wallpaper-details-overlay" ref={overlayRef} onClick={onClose}>
      <section className="wallpaper-detail-screen" onClick={(event) => event.stopPropagation()}>
        <nav className="detail-breadcrumb">
          <button type="button" onClick={() => handleBreadcrumbNavigate('home')}>
            <i className="bi bi-house-door"></i> Inicio
          </button>
          <i className="bi bi-chevron-right"></i>
          <button type="button" onClick={() => handleBreadcrumbNavigate(sourceTarget)}>
            <i className={`bi bi-${sourceIcon}`}></i> {sourceName}
          </button>
          <i className="bi bi-chevron-right"></i>
          <strong><i className="bi bi-image"></i> {displayWallpaper.title}</strong>
        </nav>

        <div className="detail-page-grid">
          <main className="detail-preview-column">
            <div className="detail-preview-frame">
              {isVideo ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  poster={previewUrl}
                  preload="metadata"
                  playsInline
                  onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
                  onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
              ) : previewUrl ? (
                <img src={previewUrl} alt={displayWallpaper.title} />
              ) : (
                <div className="detail-preview-empty">Sin preview</div>
              )}

              {isVideo && (
                <>
                  <div className="detail-player-bar" onClick={seekVideo}>
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <div className="detail-player-controls">
                    <button type="button" onClick={togglePlayback}>
                      <i className={`bi bi-${isPlaying ? 'pause-fill' : 'play-fill'}`}></i>
                    </button>
                    <span>{formatPlaybackTime(currentTime)} / {formatPlaybackTime(duration)}</span>
                  </div>
                </>
              )}
            </div>

            {relatedWallpapers.length > 0 && (
              <section className="detail-preview-section detail-recommendations">
                {renderRecommendationStrip(relatedWallpapers.slice(0, 12))}
              </section>
            )}

            {showComments && (
              <section className="detail-comments">
                <h3><i className="bi bi-chat-dots"></i> Comentarios <span>(128)</span></h3>
                <div className="detail-comment-box">
                  <i className="bi bi-pencil"></i> Escribe un comentario...
                </div>
                <article>
                  <div className="comment-header">
                    <i className="bi bi-person-circle"></i>
                    <strong>KuroNeko</strong>
                    <small><i className="bi bi-clock"></i> hace 2 dias</small>
                  </div>
                  <p>Increible ambiente, me encanta para estudiar. Gracias por compartirlo.</p>
                </article>
              </section>
            )}
          </main>

          <aside className="detail-side-panel">
            <div className="detail-title-row">
              <h2>{displayWallpaper.title}</h2>
              <span><i className={`bi bi-${sourceIcon}`}></i> {sourceName}</span>
            </div>

            <div className="detail-author">
              <div>{String(displayAuthor || '?').slice(0, 2).toUpperCase()}</div>
              <p>
                <strong><i className="bi bi-person-badge"></i> {displayAuthor}</strong>
                {authorInfo?.handle && <small>{authorInfo.handle}</small>}
              </p>
              {onOpenAuthor && (
                <button type="button" className="detail-author-link" onClick={handleOpenAuthor}>
                  Perfil del autor
                </button>
              )}
            </div>

            {displayWallpaper.description && (
              <p className="detail-description">{displayWallpaper.description}</p>
            )}

            <div className="detail-metrics">
              <div><i className="bi bi-download"></i><strong>{formatCompact(displayWallpaper.downloads || displayWallpaper.subscriptions)}</strong><span>Descargas</span></div>
              <div><i className="bi bi-heart"></i><strong>{formatCompact(displayWallpaper.likes || displayWallpaper.favorited)}</strong><span>Me gusta</span></div>
              <div><i className="bi bi-eye"></i><strong>{formatCompact(displayWallpaper.views)}</strong><span>Vistas</span></div>
              <div><i className="bi bi-star-fill"></i><strong>{Number(displayWallpaper.score || displayWallpaper.rating?.average || 0).toFixed(1)}</strong><span>Valoracion</span></div>
            </div>

            <div className={`detail-primary-actions ${isDownloaded ? 'downloaded' : ''}`}>
              {onDownload && (
                <button
                  type="button"
                  className="detail-download"
                  disabled={primaryActionDisabled}
                  onClick={handleDownload}
                >
                  <i className={`bi bi-${primaryActionIcon} ${repairing ? 'spin-icon' : ''}`}></i>
                  {repairing ? 'Procesando...' : primaryActionLabel}
                </button>
              )}
              {isDownloaded && onDelete && (
                <button
                  type="button"
                  className="detail-delete"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  <i className={`bi bi-trash${deleting ? '-fill spin-icon' : ''}`}></i>
                  {deleting ? 'Eliminando...' : 'Eliminar'}
                </button>
              )}
              {onToggleFavorite && (
                <button
                  type="button"
                  className={`detail-like ${favorite ? 'liked' : ''}`}
                  onClick={handleToggleFavorite}
                >
                  <i className={`bi bi-heart${favorite ? '-fill' : ''}`}></i>
                  Favorito
                </button>
              )}
              {onSubscribe && (
                <button
                  type="button"
                  className={`detail-share ${subscribed ? 'subscribed' : ''}`}
                  onClick={handleSubscribe}
                >
                  <i className={`bi bi-bell${subscribed ? '-fill' : ''}`}></i>
                  {subscribed ? 'Suscrito' : 'Seguir'}
                </button>
              )}
            </div>

            <div className="detail-tags">
              {tags.map(tag => <span key={tag}><i className="bi bi-tag"></i> {tag}</span>)}
            </div>

            <dl className="detail-specs">
              {details.map(([label, value]) => (
                <div key={label}>
                  <dt><i className="bi bi-info-circle"></i> {label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>

            <div className="detail-trust">
              <i className="bi bi-shield-check"></i>
              <strong>{sourceName === 'Workshop' ? 'Verificado por Wallpaper Engine' : 'Wallpaper local'}</strong>
              <span>{sourceName === 'Workshop'
                ? 'Este wallpaper conserva la informacion disponible del Workshop.'
                : 'Este wallpaper esta almacenado en tu dispositivo o en el catalogo local.'
              }</span>
            </div>

            {displayedAuthorWallpapers.length > 0 && (
              <section className="detail-author-wallpapers">
                <div>
                  <h3>Mas del autor</h3>
                  {onOpenAuthor && (
                    <button type="button" onClick={handleOpenAuthor}>Ver todo <i className="bi bi-chevron-right"></i></button>
                  )}
                </div>
                {renderHorizontalWallpapers(displayedAuthorWallpapers.slice(0, 12), sideAuthorRowRef, 'compact side')}
              </section>
            )}

          </aside>
        </div>
      </section>
    </div>,
    document.body
  );
}
