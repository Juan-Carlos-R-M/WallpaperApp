import React, { useState, useRef, useEffect, memo } from 'react';
import MediaPlayer from './MediaPlayer';
import '../styles/wallpaper-card.css';

const WallpaperCard = memo(({ wallpaper }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef(null);

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

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = wallpaper.mediaUrl;
    link.download = `${wallpaper.title}.${wallpaper.mediaType === 'video' ? 'mp4' : wallpaper.mediaType === 'gif' ? 'gif' : 'jpg'}`;
    link.click();
  };

  return (
    <div
      ref={cardRef}
      className="wallpaper-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isVisible ? (
        <>
          <div className="card-media">
            <MediaPlayer 
              wallpaper={wallpaper}
              isHovered={isHovered}
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
            <button onClick={handleDownload} className="download-btn">
              Descargar
            </button>
          </div>
        </>
      ) : (
        <div className="card-placeholder" />
      )}
    </div>
  );
});

WallpaperCard.displayName = 'WallpaperCard';

export default WallpaperCard;
