import React, { useEffect, useRef, memo } from 'react';
import { getPreviewUrl, getVideoPlaybackUrl, isVideoWallpaper } from '../utils/wallpaperMeta';
import '../styles/media-player.css';

const MediaPlayer = memo(({ wallpaper, isHovered, showControls = false }) => {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const videoUrl = getVideoPlaybackUrl(wallpaper);
  const previewUrl = getPreviewUrl(wallpaper);
  const isVideo = isVideoWallpaper(wallpaper) && Boolean(videoUrl);

  useEffect(() => {
    if (!videoRef.current || !isVideo) return;

    if (isHovered) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isHovered, isVideo, videoUrl]);

  const renderMedia = () => {
    switch (true) {
      case isVideo:
        return (
          <video
            ref={videoRef}
            className="media-video"
            muted={!showControls}
            loop
            playsInline
            preload="metadata"
            poster={previewUrl}
            src={videoUrl}
            {...(showControls && { controls: true, autoPlay: true })}
          />
        );
      case wallpaper.mediaType === 'gif':
        return (
          <img
            src={previewUrl}
            alt={wallpaper.title}
            className="media-gif"
            loading="lazy"
          />
        );
      case 'image':
      default:
        return (
          <img
            src={previewUrl}
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
