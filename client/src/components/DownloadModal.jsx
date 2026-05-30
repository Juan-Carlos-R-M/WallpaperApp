import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toPlayableUrl } from '../utils/mediaUrl';
import '../styles/download-modal.css';

export default function DownloadModal({ 
  wallpaper, 
  message = 'Descargado', 
  onClose,
  onRepair,
  onDelete 
}) {
  useEffect(() => {
    if (!wallpaper) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [wallpaper]);

  if (!wallpaper) return null;

  const videoUrl = String(wallpaper.mediaType || '').toLowerCase() === 'video'
    ? toPlayableUrl(wallpaper.playbackUrl || wallpaper.mediaUrl)
    : '';
  const previewUrl = toPlayableUrl(wallpaper.previewUrl || wallpaper.preview?.url || wallpaper.image?.url || wallpaper.mediaUrl);

  const handleRepair = () => {
    onRepair?.(wallpaper);
    onClose?.();
  };

  const handleDelete = () => {
    if (confirm('¿Estás seguro de que deseas eliminar este wallpaper?')) {
      onDelete?.(wallpaper);
      onClose?.();
    }
  };

  return createPortal(
    <div className="download-modal-overlay" role="dialog" aria-modal="true">
      <div className="download-modal">
        <button className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        <div className="modal-content">
          <div className="modal-preview">
            {videoUrl ? (
              <video src={videoUrl} poster={previewUrl} controls muted loop playsInline preload="metadata" />
            ) : (
              <img src={previewUrl} alt={wallpaper.title} />
            )}
          </div>
          <div className="modal-info">
            <h2>{wallpaper.title}</h2>
            <p className="modal-message">{message}</p>
            <p className="modal-author">{wallpaper.author}</p>
            <div className="modal-actions">
              <button onClick={handleRepair} className="btn repair-btn">Reparar</button>
              <button onClick={handleDelete} className="btn delete-btn">Eliminar</button>
              <button onClick={onClose} className="btn close-btn">Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
