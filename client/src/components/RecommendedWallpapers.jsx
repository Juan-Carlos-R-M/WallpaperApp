import React, { useState, useEffect } from 'react';
import WallpaperCard from './WallpaperCard';
import { fetchOnlineRecommendations } from '../utils/workshopRecommendations';
import '../styles/recommended-wallpapers.css';

export default function RecommendedWallpapers({
  currentWallpaper,
  category,
  showMatureContent = false,
  onOpenDetails = () => {}
}) {
  const [recommended, setRecommended] = useState([]);

  useEffect(() => {
    if (!currentWallpaper && !category) {
      setRecommended([]);
      return undefined;
    }

    let active = true;

    const loadRecommended = async () => {
      const items = await fetchOnlineRecommendations({
        wallpaper: currentWallpaper || { title: category, category, tags: [category].filter(Boolean) },
        limit: 4,
        showMatureContent
      });

      if (active) setRecommended(items);
    };

    setRecommended([]);
    loadRecommended();

    return () => {
      active = false;
    };
  }, [category, currentWallpaper, showMatureContent]);

  if (recommended.length === 0) return null;

  return (
    <div className="recommended-wallpapers">
      <h3>Wallpapers Similares</h3>
      <div className="recommended-grid">
        {recommended.map(wallpaper => (
          <div key={wallpaper._id} className="recommended-item">
            <WallpaperCard
              wallpaper={wallpaper}
              onOpenDetails={onOpenDetails}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
