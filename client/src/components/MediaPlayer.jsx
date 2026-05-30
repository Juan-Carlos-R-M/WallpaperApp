import React, { useEffect, useRef, memo } from 'react';
import { toPlayableUrl } from '../utils/mediaUrl';
import '../styles/media-player.css';

const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|avi|mkv)(\?|#|$)/i;

const MediaPlayer = memo(({ wallpaper, isHovered, showControls = false }) => {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const mediaUrl = toPlayableUrl(wallpaper.playbackUrl || wallpaper.mediaUrl || wallpaper.previewUrl || wallpaper.image?.url || wallpaper.preview?.url);
  const previewUrl = toPlayableUrl(wallpaper.previewUrl || wallpaper.preview?.url || wallpaper.image?.url || mediaUrl);
  const isVideo = wallpaper.mediaType === 'video'
    || VIDEO_EXTENSIONS.test([wallpaper.playbackUrl, wallpaper.mediaUrl, mediaUrl].filter(Boolean).join(' '));

  useEffect(() => {
    if (!videoRef.current || !isVideo) return;

    if (isHovered) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isHovered, isVideo, mediaUrl]);

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
            src={mediaUrl}
            {...(showControls && { controls: true, autoPlay: true })}
          />
        );
      case wallpaper.mediaType === 'gif':
        return (
          <img
            src={mediaUrl}
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
