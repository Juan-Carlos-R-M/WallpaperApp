import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getLocalWallpapers } from '../data/sampleWallpapers';
import WallpaperCard from './WallpaperCard';
import '../styles/author-profile.css';

export default function AuthorProfile({ authorId, onClose, onSubscribe }) {
  const [wallpapers, setWallpapers] = useState([]);
  const [authorInfo, setAuthorInfo] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!authorId) return;

    // Get all wallpapers and find ones by this author
    const result = getLocalWallpapers({ limit: 100 });
    const authorWallpapers = result.data.filter(wp => wp.authorId === authorId);
    
    setWallpapers(authorWallpapers);
    if (authorWallpapers.length > 0) {
      setAuthorInfo(authorWallpapers[0].authorInfo);
    }
  }, [authorId]);

  const handleSubscribe = () => {
    setIsSubscribed(!isSubscribed);
    onSubscribe?.(authorId, !isSubscribed);
  };

  if (!authorInfo) return null;

  return createPortal(
    <div className="author-profile-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="author-profile-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="author-header-section">
          <div className="author-cover" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}></div>
          <div className="author-profile-info">
            <h1>{authorInfo.name}</h1>
            <p>{authorInfo.description}</p>
            <div className="author-stats-large">
              <div className="stat">
                <span className="stat-number">{authorInfo.followers}</span>
                <span className="stat-label">Seguidores</span>
              </div>
              <div className="stat">
                <span className="stat-number">{authorInfo.wallpapers}</span>
                <span className="stat-label">Wallpapers</span>
              </div>
            </div>
            <button 
              onClick={handleSubscribe}
              className={`subscribe-btn-large ${isSubscribed ? 'subscribed' : ''}`}
            >
              {isSubscribed ? 'Suscrito' : 'Suscribirse'}
            </button>
          </div>
        </div>

        <div className="author-wallpapers-section">
          <h2>Wallpapers de {authorInfo.name}</h2>
          <div className="author-wallpapers-grid">
            {wallpapers.map(wallpaper => (
              <WallpaperCard
                key={wallpaper._id}
                wallpaper={wallpaper}
                onOpenDetails={() => {}}
              />
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
