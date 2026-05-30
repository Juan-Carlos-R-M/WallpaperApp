import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import WallpaperCard from './WallpaperCard';
import WallpaperDetails from './WallpaperDetails';
import AuthorProfile from './AuthorProfile';
import { wallpapersUrl } from '../services/api';
import { getLocalWallpapers } from '../data/sampleWallpapers';
import { toPlayableUrl } from '../utils/mediaUrl';
import '../styles/gallery.css';

const PAGE_SIZE = 24;

const Gallery = ({ category = '', search = '' }) => {
  const [wallpapers, setWallpapers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedWallpaper, setSelectedWallpaper] = useState(null);
  const [selectedAuthorId, setSelectedAuthorId] = useState(null);
  const [subscriptions, setSubscriptions] = useState({});
  const observerTarget = useRef(null);

  // Load subscriptions from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('wallpaperApp.subscriptions');
    if (saved) {
      setSubscriptions(JSON.parse(saved));
    }
  }, []);

  // Save subscriptions to localStorage
  const handleSubscribe = useCallback((authorIdOrWallpaperId, isSubscribed) => {
    setSubscriptions(prev => {
      const updated = { ...prev, [authorIdOrWallpaperId]: isSubscribed };
      localStorage.setItem('wallpaperApp.subscriptions', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const normalizeDesktopWallpaper = (wallpaper, index) => {
    const downloadUrl = wallpaper.mediaUrl || wallpaper.playbackUrl || wallpaper.previewUrl;
    const mediaUrl = toPlayableUrl(wallpaper.playbackUrl || wallpaper.mediaUrl || wallpaper.previewUrl);
    const previewUrl = toPlayableUrl(wallpaper.previewUrl || wallpaper.playbackUrl || wallpaper.mediaUrl);

    return {
      ...wallpaper,
      _id: wallpaper.localPath || wallpaper.mediaUrl || `wallpaper-engine-${index}`,
      downloadUrl,
      mediaUrl,
      playbackUrl: mediaUrl,
      previewUrl,
      preview: { url: previewUrl },
      image: { url: previewUrl },
      imageUrl: previewUrl,
      thumbnailUrl: previewUrl,
      downloads: wallpaper.downloads || 0,
      isSubscribed: subscriptions[wallpaper.authorId] || false
    };
  };

  const filterDesktopWallpapers = useCallback((items) => {
    const normalizedSearch = search.trim().toLowerCase();

    return items
      .filter(wallpaper => {
        if (!normalizedSearch) return true;

        return [
          wallpaper.title,
          wallpaper.description,
          wallpaper.author,
          wallpaper.localPath
        ].some(value => String(value || '').toLowerCase().includes(normalizedSearch));
      })
      .map(normalizeDesktopWallpaper);
  }, [search, subscriptions]);

  const fetchWallpapers = useCallback(async (pageNum = 1, reset = false) => {
    try {
      setLoading(true);

      if (window.electronAPI?.getDownloadedWallpapers || window.electronAPI?.getSteamWallpapers) {
        const result = window.electronAPI.getDownloadedWallpapers
          ? await window.electronAPI.getDownloadedWallpapers()
          : await window.electronAPI.getSteamWallpapers();

        if (!result.success) {
          setError(result.error || 'No se pudo leer la carpeta de descargas locales');
          setHasMore(false);
          return;
        }

        const filtered = filterDesktopWallpapers(result.data || []);
        const start = (pageNum - 1) * PAGE_SIZE;
        const nextPage = filtered.slice(start, start + PAGE_SIZE);

        setWallpapers(current => reset ? nextPage : [...current, ...nextPage]);
        setHasMore(start + PAGE_SIZE < filtered.length);
        setPage(pageNum);
        setError(null);
        return;
      }

      const params = new URLSearchParams({
        page: pageNum,
        limit: PAGE_SIZE
      });

      if (category) params.append('category', category);
      if (search) params.append('search', search);

      const response = await axios.get(wallpapersUrl(`?${params}`));

      if (reset) {
        setWallpapers(response.data.data);
      } else {
        setWallpapers(prev => [...prev, ...response.data.data]);
      }

      setHasMore(response.data.pagination.page < response.data.pagination.pages);
      setPage(pageNum);
    } catch (err) {
      const fallback = getLocalWallpapers({ page: pageNum, limit: PAGE_SIZE, category, search });
      if (reset) {
        setWallpapers(fallback.data);
      } else {
        setWallpapers(prev => [...prev, ...fallback.data]);
      }
      setHasMore(fallback.pagination.page < fallback.pagination.pages);
      setPage(pageNum);
      setError(null);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [category, search, filterDesktopWallpapers]);

  useEffect(() => {
    setPage(1);
    fetchWallpapers(1, true);
  }, [category, search]);

  // Intersection Observer para cargar más cuando se alcanza el final
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          fetchWallpapers(page + 1);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [fetchWallpapers, page, hasMore, loading]);

  const handleOpenDetails = (wallpaper) => {
    setSelectedWallpaper(wallpaper);
  };

  const handleRepair = (wallpaper) => {
    console.log('Reparar wallpaper:', wallpaper.title);
    alert(`Reparando ${wallpaper.title}...`);
  };

  const handleDelete = (wallpaper) => {
    console.log('Eliminar wallpaper:', wallpaper.title);
    alert(`Eliminando ${wallpaper.title}...`);
  };

  if (error) {
    return <div className="gallery-error">{error}</div>;
  }

  return (
    <div className="gallery">
      {wallpapers.length === 0 && !loading ? (
        <div className="gallery-empty">
          <p>No hay wallpapers disponibles</p>
        </div>
      ) : (
        <>
          <div className="gallery-grid">
            {wallpapers.map(wallpaper => (
              <WallpaperCard 
                key={wallpaper._id} 
                wallpaper={wallpaper}
                onOpenDetails={handleOpenDetails}
                onRepair={handleRepair}
                onDelete={handleDelete}
                onSubscribe={handleSubscribe}
              />
            ))}
          </div>
          {hasMore && (
            <div ref={observerTarget} className="gallery-loader">
              {loading && <p>Cargando más wallpapers...</p>}
            </div>
          )}
        </>
      )}

      {selectedWallpaper && (
        <WallpaperDetails
          wallpaper={selectedWallpaper}
          onClose={() => setSelectedWallpaper(null)}
          onRepair={handleRepair}
          onDelete={handleDelete}
          onSubscribe={handleSubscribe}
          isDownloaded={false}
        />
      )}

      {selectedAuthorId && (
        <AuthorProfile
          authorId={selectedAuthorId}
          onClose={() => setSelectedAuthorId(null)}
          onSubscribe={handleSubscribe}
        />
      )}
    </div>
  );
};

export default Gallery;
