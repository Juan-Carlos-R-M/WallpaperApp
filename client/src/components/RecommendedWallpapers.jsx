import React, { useState, useEffect } from 'react';
import { getLocalWallpapers } from '../data/sampleWallpapers';
import WallpaperCard from './WallpaperCard';
import '../styles/recommended-wallpapers.css';

export default function RecommendedWallpapers({ currentWallpaper, category }) {
  const [recommended, setRecommended] = useState([]);

  useEffect(() => {
    if (!category) return;

    const result = getLocalWallpapers({ category, limit: 8 });
    const filtered = result.data.filter(wp => wp._id !== currentWallpaper?._id);
    setRecommended(filtered.slice(0, 4));
  }, [category, currentWallpaper?._id]);

  if (recommended.length === 0) return null;

  return (
    <div className="recommended-wallpapers">
      <h3>Wallpapers Similares</h3>
      <div className="recommended-grid">
        {recommended.map(wallpaper => (
          <div key={wallpaper._id} className="recommended-item">
            <WallpaperCard
              wallpaper={wallpaper}
              onOpenDetails={() => {}}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
