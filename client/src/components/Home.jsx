import React, { useEffect, useMemo, useRef, useState } from 'react';
import WallpaperCard from './WallpaperCard';
import WallpaperDetails from './WallpaperDetails';
import AuthorProfile from './AuthorProfile';
import { getLocalWallpapers } from '../data/sampleWallpapers';
import { downloadWallpaperAsset } from '../utils/downloadWallpaper';
import {
  enrichWallpaperMetadata,
  formatCompact,
  getAuthorInfo,
  getPreviewUrl,
  getWallpaperId
} from '../utils/wallpaperMeta';
import { canShowWallpaper } from '../utils/contentPreferences';
import { applyWallpaperAccent } from '../utils/dynamicAccent';
import {
  RECOMMENDATION_SIGNAL_EVENT,
  buildPreferenceProfile,
  buildAuthorSubscriptionRecord,
  followAuthorFromWallpaper,
  isAuthorSubscribed,
  loadAuthorSubscriptions,
  loadFavoriteWallpapers,
  loadWallpaperInteractions,
  recordWallpaperInteraction,
  saveAuthorSubscriptions,
  scoreWallpaperForProfile,
  updateAuthorSubscription
} from '../utils/recommendationSignals';
import { fetchOnlineRecommendations } from '../utils/workshopRecommendations';
import '../styles/home.css';

const HOME_CATEGORIES = [
  { label: 'Anime', query: 'Anime', count: '32.5K', icon: 'stars' },
  { label: 'Paisajes', query: 'Landscape', count: '18.2K', icon: 'sunset' },
  { label: 'Sci-Fi', query: 'Sci-Fi', count: '14.8K', icon: 'rocket-takeoff' },
  { label: 'Minimalista', query: 'Minimal', count: '8.7K', icon: 'record-circle' },
  { label: 'Oscuros', query: 'Dark', count: '12.1K', icon: 'moon-stars' },
  { label: 'Ciberpunk', query: 'Cyberpunk', count: '9.3K', icon: 'cpu' }
];

export default function Home({
  search = '',
  onSearch = () => {},
  showMatureContent = false,
  onNavigate = () => {},
  onOpenSteam,
  onOpenGallery = () => {},
  onOpenAuthors = () => {}
}) {
  const [selectedWallpaper, setSelectedWallpaper] = useState(null);
  const [selectedAuthorId, setSelectedAuthorId] = useState(null);
  const [activeCategory, setActiveCategory] = useState('');
  const [workshopWallpapers, setWorkshopWallpapers] = useState([]);
  const [workshopLoading, setWorkshopLoading] = useState(false);
  const [workshopLoaded, setWorkshopLoaded] = useState(false);
  const [workshopError, setWorkshopError] = useState('');
  const [downloadingId, setDownloadingId] = useState('');
  const [signalVersion, setSignalVersion] = useState(0);
  const [onlineRelatedWallpapers, setOnlineRelatedWallpapers] = useState([]);
  const popularSectionRef = useRef(null);
  const recentSectionRef = useRef(null);
  const authorsSectionRef = useRef(null);

  const workshopAvailable = typeof window !== 'undefined'
    && window.electronAPI
    && typeof window.electronAPI.searchWorkshopWallpapers === 'function';

  useEffect(() => {
    const matchingCategory = HOME_CATEGORIES.find(category => (
      category.query.toLowerCase() === String(search || '').trim().toLowerCase()
    ));
    setActiveCategory(matchingCategory?.label || '');
  }, [search]);

  useEffect(() => {
    if (!workshopAvailable) {
      setWorkshopWallpapers([]);
      setWorkshopLoading(false);
      setWorkshopError('');
      return undefined;
    }

    let isActive = true;

    const fetchWorkshopWallpapers = async () => {
      setWorkshopLoaded(false);
      setWorkshopLoading(true);
      setWorkshopError('');

      try {
        const result = await window.electronAPI.searchWorkshopWallpapers({
          query: search || '',
          page: 1,
          limit: 36,
          sort: 'trend',
          time: 'all',
          requiredTags: []
        });

        if (!isActive) return;

        if (!result?.success) {
          throw new Error(result?.error || 'No se pudo cargar Workshop.');
        }

        const items = Array.isArray(result.data?.data) ? result.data.data : [];
        setWorkshopWallpapers(items
          .map(item => enrichWallpaperMetadata({
            ...item,
            fromSteam: true,
            category: item.category || 'workshop'
          }))
          .filter(wallpaper => canShowWallpaper(wallpaper, showMatureContent))
        );
      } catch (error) {
        if (!isActive) return;
        setWorkshopWallpapers([]);
        setWorkshopError(error?.message || 'Error al cargar Workshop.');
      } finally {
        if (!isActive) return;
        setWorkshopLoading(false);
        setWorkshopLoaded(true);
      }
    };

    fetchWorkshopWallpapers();
    return () => {
      isActive = false;
    };
  }, [search, workshopAvailable, showMatureContent]);

  useEffect(() => {
    const refreshSignals = () => setSignalVersion(version => version + 1);
    window.addEventListener(RECOMMENDATION_SIGNAL_EVENT, refreshSignals);
    window.addEventListener('storage', refreshSignals);

    return () => {
      window.removeEventListener(RECOMMENDATION_SIGNAL_EVENT, refreshSignals);
      window.removeEventListener('storage', refreshSignals);
    };
  }, []);

  const showWorkshopResults = workshopAvailable && workshopLoaded && !workshopError;
  const wallpapers = useMemo(() => {
    if (showWorkshopResults) {
      return workshopWallpapers
        .map(enrichWallpaperMetadata)
        .filter(wallpaper => canShowWallpaper(wallpaper, showMatureContent));
    }

    return getLocalWallpapers({ page: 1, limit: 36, search }).data
      .map(enrichWallpaperMetadata)
      .filter(wallpaper => canShowWallpaper(wallpaper, showMatureContent));
  }, [search, workshopAvailable, workshopLoaded, workshopWallpapers, workshopError, showMatureContent]);

  const popularWallpapers = useMemo(() => (
    [...wallpapers]
      .sort((left, right) => Number(right.likes || 0) - Number(left.likes || 0))
      .slice(0, 5)
  ), [wallpapers]);

  const recentWallpapers = useMemo(() => (
    [...wallpapers]
      .sort((left, right) => Number(new Date(right.timeCreated || 0)) - Number(new Date(left.timeCreated || 0)))
      .slice(0, 5)
  ), [wallpapers]);

  const preferenceProfile = useMemo(() => buildPreferenceProfile({
    favorites: loadFavoriteWallpapers(),
    subscriptions: loadAuthorSubscriptions(),
    interactions: loadWallpaperInteractions()
  }), [signalVersion]);

  const recommendedWallpapers = useMemo(() => {
    const ranked = [...wallpapers]
      .map(wallpaper => ({
        wallpaper,
        score: scoreWallpaperForProfile(wallpaper, preferenceProfile)
      }))
      .sort((left, right) => right.score - left.score);

    return ranked
      .filter((item, index) => item.score > 0 || index < 5)
      .slice(0, 5)
      .map(item => item.wallpaper);
  }, [preferenceProfile, wallpapers]);

  const featuredAuthors = useMemo(() => {
    const authors = new Map();

    wallpapers.forEach(wallpaper => {
      const authorId = wallpaper.authorId || wallpaper.author || 'Autor';
      const authorInfo = getAuthorInfo(wallpaper);
      const current = authors.get(authorId) || {
        id: authorId,
        name: authorInfo?.name || wallpaper.author || authorId,
        handle: authorInfo?.handle || `@${String(authorId).slice(0, 12)}`,
        followers: authorInfo?.followers || 0,
        preview: getPreviewUrl(wallpaper),
        likes: 0
      };

      current.likes += Number(wallpaper.likes || 0);
      authors.set(authorId, current);
    });

    return [...authors.values()]
      .sort((left, right) => (right.followers + right.likes) - (left.followers + left.likes))
      .slice(0, 5);
  }, [wallpapers]);

  const stats = useMemo(() => ({
    wallpapers: wallpapers.length * 1000,
    authors: featuredAuthors.length * 4800,
    downloads: wallpapers.reduce((total, item) => total + Number(item.downloads || 0), 0),
    likes: wallpapers.reduce((total, item) => total + Number(item.likes || 0), 0)
  }), [featuredAuthors.length, wallpapers]);

  const heroWallpaper = popularWallpapers[0] || wallpapers[0];
  const heroPreview = heroWallpaper ? getPreviewUrl(heroWallpaper) : '';
  const selectedWallpaperIsWorkshopSource = Boolean(
    selectedWallpaper?.fromSteam || /^\d+$/.test(String(selectedWallpaper?.publishedFileId || ''))
  );

  const handleOpenDetails = (wallpaper) => {
    const enriched = enrichWallpaperMetadata(wallpaper);
    applyWallpaperAccent(enriched);
    setSelectedWallpaper(enriched);
  };

  useEffect(() => {
    if (!selectedWallpaper) {
      setOnlineRelatedWallpapers([]);
      return undefined;
    }

    let active = true;

    const loadOnlineRelated = async () => {
      const items = await fetchOnlineRecommendations({
        wallpaper: selectedWallpaper,
        limit: 12,
        showMatureContent
      });

      if (active) {
        setOnlineRelatedWallpapers(items);
      }
    };

    setOnlineRelatedWallpapers([]);
    loadOnlineRelated();

    return () => {
      active = false;
    };
  }, [selectedWallpaper, showMatureContent]);

  const handleDetailNavigate = (target) => {
    setSelectedWallpaper(null);

    if (target === 'gallery') {
      onOpenGallery('recent');
      return;
    }

    onNavigate(target);
  };

  const scrollToSection = (ref) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCategoryClick = (category) => {
    setActiveCategory(category.label);
    onSearch(category.query);
    window.setTimeout(() => scrollToSection(popularSectionRef), 80);
  };

  const handleDownloadWallpaper = async (wallpaper) => {
    const wallpaperId = getWallpaperId(wallpaper);
    const isWorkshopWallpaper = /^\d+$/.test(String(wallpaperId || ''));

    setDownloadingId(wallpaperId);

    try {
      if (isWorkshopWallpaper && window.electronAPI?.downloadWorkshopWallpaper) {
        const result = await window.electronAPI.downloadWorkshopWallpaper({
          publishedFileId: wallpaperId
        });

        if (!result?.success) {
          throw new Error(result?.error || 'No se pudo descargar desde Workshop.');
        }

        const downloadedWallpaper = enrichWallpaperMetadata({
          ...wallpaper,
          ...(result.data?.wallpaper || {}),
          fromSteam: true,
          installed: true,
          downloaded: true,
          localPath: result.data?.wallpaper?.localPath || result.data?.path,
          path: result.data?.path
        });

        setWorkshopWallpapers(current => current.map(item => (
          getWallpaperId(item) === wallpaperId ? downloadedWallpaper : item
        )));
        setSelectedWallpaper(current => (
          current && getWallpaperId(current) === wallpaperId ? downloadedWallpaper : current
        ));
        recordWallpaperInteraction(downloadedWallpaper, 'download');
        followAuthorFromWallpaper(downloadedWallpaper, 'download');
        setSignalVersion(version => version + 1);

        return {
          ...result.data,
          wallpaper: downloadedWallpaper,
          path: result.data?.path,
          message: 'Instalado en Wallpaper Engine'
        };
      }

      const result = await downloadWallpaperAsset(wallpaper);
      recordWallpaperInteraction(wallpaper, 'download');
      followAuthorFromWallpaper(wallpaper, 'download');
      setSignalVersion(version => version + 1);
      return result;
    } finally {
      setDownloadingId('');
    }
  };

  const handleSubscribeAuthor = (authorId, isSubscribed, wallpaper = null) => {
    if (!authorId) return;
    const subscriptions = loadAuthorSubscriptions();
    const next = updateAuthorSubscription(
      subscriptions,
      authorId,
      isSubscribed,
      wallpaper ? buildAuthorSubscriptionRecord(wallpaper, 'manual') : { source: 'manual' }
    );

    saveAuthorSubscriptions(next);
    setSignalVersion(version => version + 1);
  };

  const renderWallpaperSection = (title, items, { ref, feed = 'recent' } = {}) => (
    <section className="home-section" ref={ref}>
      <div className="home-section-title">
        <h3>{title}</h3>
        <button type="button" onClick={() => onOpenGallery(feed)}>Ver todo</button>
      </div>
      <div className="home-wallpaper-row">
        {items.map(wallpaper => (
          <WallpaperCard
            key={wallpaper._id || wallpaper.id || getWallpaperId(wallpaper)}
            wallpaper={wallpaper}
            onOpenDetails={handleOpenDetails}
            onOpenAuthor={setSelectedAuthorId}
            onDownload={handleDownloadWallpaper}
            repairing={downloadingId === getWallpaperId(wallpaper)}
          />
        ))}
      </div>
    </section>
  );

  return (
    <div className="home-screen">
      <section
        className="home-hero"
        style={heroPreview ? { '--home-hero-image': `url("${heroPreview}")` } : undefined}
      >
        <div className="home-hero-content">
          <h1>Descubre increibles <span>wallpapers</span></h1>
          <p>Explora miles de wallpapers animados creados por nuestra comunidad.</p>
          <div className="home-hero-stats">
            <span><i className="bi bi-image"></i><strong>{formatCompact(stats.wallpapers)}</strong><small>Wallpapers</small></span>
            <span><i className="bi bi-people"></i><strong>{formatCompact(stats.authors)}</strong><small>Autores</small></span>
            <span><i className="bi bi-download"></i><strong>{formatCompact(stats.downloads)}</strong><small>Descargas</small></span>
            <span><i className="bi bi-heart"></i><strong>{formatCompact(stats.likes)}</strong><small>Me gusta</small></span>
          </div>
          <div className="home-hero-actions">
            <button type="button" onClick={() => document.querySelector('.home-section')?.scrollIntoView({ behavior: 'smooth' })}>Explorar</button>
            <button type="button" onClick={() => scrollToSection(popularSectionRef)}><i className="bi bi-fire"></i> Mas populares</button>
          </div>
        </div>
        <div className="home-hero-dots">
          <span className="active"></span>
          <span></span>
          <span></span>
        </div>
      </section>

      <div className="home-category-strip">
        {HOME_CATEGORIES.map(category => (
          <button
            key={category.label}
            type="button"
            className={activeCategory === category.label ? 'active' : ''}
            onClick={() => handleCategoryClick(category)}
          >
            <i className={`bi bi-${category.icon}`}></i>
            <span><strong>{category.label}</strong><small>{category.count}</small></span>
          </button>
        ))}
        <button type="button" className="home-category-next" aria-label="Mas categorias" onClick={() => onOpenGallery('recent')}>
          <i className="bi bi-chevron-right"></i>
        </button>
      </div>

      {renderWallpaperSection('Recomendado para ti', recommendedWallpapers, { ref: popularSectionRef, feed: 'popular' })}
      {renderWallpaperSection('Populares esta semana', popularWallpapers, { feed: 'popular' })}
      {renderWallpaperSection('Mas recientes', recentWallpapers, { ref: recentSectionRef, feed: 'recent' })}

      <section className="home-section" ref={authorsSectionRef}>
        <div className="home-section-title">
          <h3>Autores destacados</h3>
          <button type="button" onClick={onOpenAuthors}>Ver todos</button>
        </div>
        <div className="home-authors-row">
          {featuredAuthors.map(author => (
            <button key={author.id} type="button" onClick={() => setSelectedAuthorId(author.id)}>
              <span>{author.preview ? <img src={author.preview} alt={author.name} /> : author.name.slice(0, 2)}</span>
              <strong>{author.name} <i className="bi bi-patch-check-fill"></i></strong>
              <small>{author.handle}</small>
              <em>{formatCompact(author.followers || author.likes)} seguidores</em>
            </button>
          ))}
        </div>
      </section>

      <section className="home-upload-cta">
        <span><i className="bi bi-cloud-arrow-up"></i></span>
        <div>
          <h3>Tienes un wallpaper increible?</h3>
          <p>Comparte tu creacion con la comunidad</p>
        </div>
        <button type="button" onClick={onOpenSteam}>Subir Wallpaper</button>
      </section>

      {selectedWallpaper && (
        <WallpaperDetails
          wallpaper={selectedWallpaper}
          onClose={() => setSelectedWallpaper(null)}
          onBack={() => setSelectedWallpaper(null)}
          onNavigate={handleDetailNavigate}
          onDownload={handleDownloadWallpaper}
          onOpenAuthor={setSelectedAuthorId}
          onSubscribe={handleSubscribeAuthor}
          isSubscribed={isAuthorSubscribed(preferenceProfile.subscriptions[selectedWallpaper.authorId || selectedWallpaper.author])}
          relatedWallpapers={onlineRelatedWallpapers}
          authorWallpapers={wallpapers.filter(item => item.authorId === selectedWallpaper.authorId).slice(0, 12)}
          onOpenRelated={handleOpenDetails}
          isDownloaded={Boolean(selectedWallpaper.localPath || selectedWallpaper.installed || selectedWallpaper.downloaded)}
          sourceName={selectedWallpaperIsWorkshopSource ? 'Workshop' : 'Galeria local'}
          sourceIcon={selectedWallpaperIsWorkshopSource ? 'steam' : 'hdd-stack'}
          sourceTarget={selectedWallpaperIsWorkshopSource ? 'steam' : 'gallery'}
          repairing={downloadingId === getWallpaperId(selectedWallpaper)}
          downloaderReady={true}
        />
      )}

      {selectedAuthorId && (
        <AuthorProfile
          authorId={selectedAuthorId}
          allWallpapers={wallpapers}
          subscriptions={preferenceProfile.subscriptions}
          onClose={() => setSelectedAuthorId(null)}
          onSubscribe={handleSubscribeAuthor}
          onOpenWallpaper={handleOpenDetails}
        />
      )}
    </div>
  );
}
