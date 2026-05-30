import React from 'react';
import '../styles/download-modal.css';

export default function DownloadModal({ wallpaper, message = 'Descargado', onClose }) {
  if (!wallpaper) return null;

  return (
    <div className="download-modal-overlay" role="dialog" aria-modal="true">
      <div className="download-modal">
        <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        <div className="modal-content">
          <div className="modal-preview">
            {wallpaper.mediaType === 'video' ? (
              <video src={wallpaper.mediaUrl} controls muted autoPlay loop />
            ) : (
              <img src={wallpaper.previewUrl || wallpaper.mediaUrl} alt={wallpaper.title} />
            )}
          </div>
          <div className="modal-info">
            <h2>{wallpaper.title}</h2>
            <p className="modal-message">{message}</p>
            <p className="modal-author">{wallpaper.author}</p>
            <div className="modal-actions">
              <button onClick={onClose} className="btn">Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
