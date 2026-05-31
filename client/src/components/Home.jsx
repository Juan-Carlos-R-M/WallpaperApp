import React, { useMemo, useState } from 'react';
import WallpaperCard from './WallpaperCard';
import WallpaperDetails from './WallpaperDetails';
import AuthorProfile from './AuthorProfile';
import { getLocalWallpapers } from '../data/sampleWallpapers';
import {
  enrichWallpaperMetadata,
  formatCompact,
  getAuthorInfo,
  getPreviewUrl,
  getWallpaperId,
  sortSimilarWallpapers
} from '../utils/wallpaperMeta';
import '../styles/home.css';

const HOME_CATEGORIES = [
  { label: 'Anime', count: '32.5K', icon: 'stars' },
  { label: 'Paisajes', count: '18.2K', icon: 'sunset' },
  { label: 'Sci-Fi', count: '14.8K', icon: 'rocket-takeoff' },
  { label: 'Minimalista', count: '8.7K', icon: 'record-circle' },
  { label: 'Oscuros', count: '12.1K', icon: 'moon-stars' },
  { label: 'Ciberpunk', count: '9.3K', icon: 'cpu' }
];

export default function Home({ search = '', onOpenSteam }) {
  const [selectedWallpaper, setSelectedWallpaper] = useState(null);
  const [selectedAuthorId, setSelectedAuthorId] = useState(null);

  const wallpapers = useMemo(() => (
    getLocalWallpapers({ page: 1, limit: 36, search }).data.map(enrichWallpaperMetadata)
  ), [search]);

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

  const handleOpenDetails = (wallpaper) => {
    setSelectedWallpaper(enrichWallpaperMetadata(wallpaper));
  };

  const renderWallpaperSection = (title, items) => (
    <section className="home-section">
      <div className="home-section-title">
        <h3>{title}</h3>
        <button type="button">Ver todo</button>
      </div>
      <div className="home-wallpaper-row">
        {items.map(wallpaper => (
          <WallpaperCard
            key={wallpaper._id || wallpaper.id || getWallpaperId(wallpaper)}
            wallpaper={wallpaper}
            onOpenDetails={handleOpenDetails}
            onOpenAuthor={setSelectedAuthorId}
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
            <button type="button"><i className="bi bi-fire"></i> Mas populares</button>
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
          <button key={category.label} type="button">
            <i className={`bi bi-${category.icon}`}></i>
            <span><strong>{category.label}</strong><small>{category.count}</small></span>
          </button>
        ))}
        <button type="button" className="home-category-next" aria-label="Mas categorias">
          <i className="bi bi-chevron-right"></i>
        </button>
      </div>

      {renderWallpaperSection('Populares esta semana', popularWallpapers)}
      {renderWallpaperSection('Mas recientes', recentWallpapers)}

      <section className="home-section">
        <div className="home-section-title">
          <h3>Autores destacados</h3>
          <button type="button">Ver todos</button>
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
          onOpenAuthor={setSelectedAuthorId}
          relatedWallpapers={sortSimilarWallpapers(selectedWallpaper, wallpapers).slice(0, 12)}
          authorWallpapers={wallpapers.filter(item => item.authorId === selectedWallpaper.authorId).slice(0, 12)}
          onOpenRelated={handleOpenDetails}
          sourceName="Galeria local"
          sourceIcon="hdd-stack"
        />
      )}

      {selectedAuthorId && (
        <AuthorProfile
          authorId={selectedAuthorId}
          allWallpapers={wallpapers}
          subscriptions={{}}
          onClose={() => setSelectedAuthorId(null)}
          onSubscribe={() => {}}
          onOpenWallpaper={handleOpenDetails}
        />
      )}
    </div>
  );
}
