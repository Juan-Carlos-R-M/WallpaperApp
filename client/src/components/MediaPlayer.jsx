import React, { useEffect, useRef, memo } from 'react';
import '../styles/media-player.css';

const MediaPlayer = memo(({ wallpaper, isHovered }) => {
  const containerRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current || wallpaper.mediaType !== 'video') return;

    if (isHovered) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isHovered, wallpaper.mediaType]);

  const renderMedia = () => {
    switch (wallpaper.mediaType) {
      case 'video':
        return (
          <video
            ref={videoRef}
            className="media-video"
            muted
            loop
            playsInline
            preload="metadata"
            poster={wallpaper.previewUrl || wallpaper.preview?.url || wallpaper.image?.url}
          >
            <source src={wallpaper.mediaUrl} type="video/mp4" />
          </video>
        );
      case 'gif':
        return (
          <img
            src={wallpaper.mediaUrl}
            alt={wallpaper.title}
            className="media-gif"
            loading="lazy"
          />
        );
      case 'image':
      default:
        return (
          <img
            src={wallpaper.preview?.url || wallpaper.image?.url}
            alt={wallpaper.title}
            className="media-image"
            loading="lazy"
          />
        );
    }
  };

  return (
    <div ref={containerRef} className="media-player">
      {renderMedia()}
    </div>
  );
});

MediaPlayer.displayName = 'MediaPlayer';

export default MediaPlayer;
