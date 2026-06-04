import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AuthorProfile from './AuthorProfile';
import { getLocalWallpapers } from '../data/sampleWallpapers';
import {
  enrichWallpaperMetadata,
  formatCompact,
  getAuthorInfo,
  getPreviewUrl
} from '../utils/wallpaperMeta';
import { canShowWallpaper } from '../utils/contentPreferences';
import {
  RECOMMENDATION_SIGNAL_EVENT,
  buildAuthorSubscriptionRecord,
  getContentBucket,
  isAuthorSubscribed,
  loadAuthorSubscriptions,
  loadFavoriteWallpapers,
  saveAuthorSubscriptions,
  updateAuthorSubscription
} from '../utils/recommendationSignals';
import '../styles/authors-explorer.css';

const AUTHOR_TABS = [
  { value: 'all', label: 'Todos los autores', icon: 'grid' },
  { value: 'following', label: 'Seguidos', icon: 'person-check' },
  { value: 'standard', label: 'Contenido normal', icon: 'heart' },
  { value: 'mature', label: 'Contenido maduro', icon: 'shield-lock' },
  { value: 'mixed', label: 'Mixto', icon: 'intersect' }
];

const SORT_OPTIONS = [
  { value: 'recommended', label: 'Recomendados' },
  { value: 'followers', label: 'Mas seguidos' },
  { value: 'downloads', label: 'Mas descargas' },
  { value: 'wallpapers', label: 'Mas activos' }
];

const buildAuthors = (wallpapers = [], subscriptions = {}) => {
  const authors = new Map();

  wallpapers.map(enrichWallpaperMetadata).forEach(wallpaper => {
    const authorId = wallpaper.authorId || wallpaper.creator || wallpaper.author || 'Autor';
    const authorInfo = getAuthorInfo(wallpaper);
    const subscription = subscriptions[authorId];
    const followed = isAuthorSubscribed(subscription);
    const current = authors.get(authorId) || {
      id: authorId,
      name: subscription?.name || authorInfo?.name || wallpaper.author || `Autor ${String(authorId).slice(-6)}`,
      handle: subscription?.handle || authorInfo?.handle || `@${String(authorId).slice(0, 12)}`,
      avatar: subscription?.avatar || authorInfo?.avatar || '',
      preview: getPreviewUrl(wallpaper),
      wallpapers: 0,
      likes: 0,
      downloads: 0,
      followers: Number(authorInfo?.followers || 0),
      contentTypes: new Set(),
      tags: new Set(),
      followed,
      source: subscription?.source || ''
    };

    current.wallpapers += 1;
    current.likes += Number(wallpaper.likes || wallpaper.favorited || 0);
    current.downloads += Number(wallpaper.downloads || wallpaper.subscriptions || 0);
    current.contentTypes.add(getContentBucket(wallpaper));
    (Array.isArray(wallpaper.tags) ? wallpaper.tags : [])
      .map(tag => String(tag || '').trim().toLowerCase())
      .filter(Boolean)
      .forEach(tag => current.tags.add(tag));
    current.followed = current.followed || followed;
    if (!current.preview) current.preview = getPreviewUrl(wallpaper);
    authors.set(authorId, current);
  });

  Object.entries(subscriptions).forEach(([authorId, subscription]) => {
    if (!isAuthorSubscribed(subscription) || authors.has(authorId)) return;
    const record = typeof subscription === 'object' ? subscription : {};
    const contentTypes = Array.isArray(record.contentTypes) && record.contentTypes.length
      ? record.contentTypes
      : ['standard'];

    authors.set(authorId, {
      id: authorId,
      name: record.name || `Autor ${String(authorId).slice(-6)}`,
      handle: record.handle || `@${String(authorId).slice(0, 12)}`,
      avatar: record.avatar || '',
      preview: record.preview || '',
      wallpapers: 0,
      likes: 0,
      downloads: 0,
      followers: 0,
      contentTypes: new Set(contentTypes),
      tags: new Set(),
      followed: true,
      source: record.source || 'manual'
    });
  });

  return [...authors.values()].map(author => {
    const contentTypes = [...author.contentTypes];
    return {
      ...author,
      tags: [...author.tags],
      contentTypes,
      contentKind: contentTypes.length > 1 ? 'mixed' : contentTypes[0] || 'standard'
    };
  });
};

const getContentTabLabel = (tab) => {
  if (tab === 'mature') return 'contenido maduro';
  if (tab === 'standard') return 'contenido normal';
  if (tab === 'mixed') return 'contenido mixto';
  return 'tus gustos';
};

const matchesContentTab = (author, activeTab) => {
  if (activeTab === 'standard') return author.contentKind === 'standard';
  if (activeTab === 'mature') return author.contentKind === 'mature';
  if (activeTab === 'mixed') return author.contentKind === 'mixed';
  return true;
};

const sortByOption = (items = [], sortBy = 'recommended') => (
  [...items].sort((left, right) => {
    if (sortBy === 'followers') return (right.followers + right.likes) - (left.followers + left.likes);
    if (sortBy === 'downloads') return right.downloads - left.downloads;
    if (sortBy === 'wallpapers') return right.wallpapers - left.wallpapers;

    return (
      Number(right.followed) * 100000
      + Number(right.recommendationScore || 0) * 1000
      + right.likes
      + right.downloads
      + right.wallpapers * 200
    ) - (
      Number(left.followed) * 100000
      + Number(left.recommendationScore || 0) * 1000
      + left.likes
      + left.downloads
      + left.wallpapers * 200
    );
  })
);

const buildTagWeights = (authors = [], favorites = []) => {
  const weights = new Map();
  const add = (tag, weight) => {
    const normalized = String(tag || '').trim().toLowerCase();
    if (!normalized) return;
    weights.set(normalized, (weights.get(normalized) || 0) + weight);
  };

  authors.forEach(author => {
    (author.tags || []).forEach(tag => add(tag, author.followed ? 4 : 1));
  });
  favorites.forEach(wallpaper => {
    (Array.isArray(wallpaper.tags) ? wallpaper.tags : []).forEach(tag => add(tag, 3));
  });

  return weights;
};

const scoreSuggestedAuthor = (author = {}, tagWeights = new Map(), activeTab = 'all') => {
  const tagScore = (author.tags || []).reduce((total, tag) => (
    total + (tagWeights.get(String(tag || '').toLowerCase()) || 0)
  ), 0);
  const sectionBoost = matchesContentTab(author, activeTab) && !['all', 'following'].includes(activeTab) ? 18 : 0;
  const popularity = Number(author.likes || 0) / 1600
    + Number(author.downloads || 0) / 5000
    + Number(author.wallpapers || 0) * 2;

  return tagScore * 12 + sectionBoost + popularity;
};

export default function AuthorsExplorer({ searchQuery = '', showMatureContent = false }) {
  const [workshopWallpapers, setWorkshopWallpapers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedAuthorId, setSelectedAuthorId] = useState(null);
  const [subscriptions, setSubscriptions] = useState(loadAuthorSubscriptions);
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState('recommended');
  const [viewMode, setViewMode] = useState('grid');
  const [favoriteSignals, setFavoriteSignals] = useState(loadFavoriteWallpapers);

  const localWallpapers = useMemo(() => (
    getLocalWallpapers({ limit: 120 }).data.map(enrichWallpaperMetadata)
  ), []);

  useEffect(() => {
    const refreshSignals = () => {
      setSubscriptions(loadAuthorSubscriptions());
      setFavoriteSignals(loadFavoriteWallpapers());
    };
    window.addEventListener(RECOMMENDATION_SIGNAL_EVENT, refreshSignals);
    window.addEventListener('storage', refreshSignals);

    return () => {
      window.removeEventListener(RECOMMENDATION_SIGNAL_EVENT, refreshSignals);
      window.removeEventListener('storage', refreshSignals);
    };
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.searchWorkshopWallpapers) return undefined;

    let active = true;

    const loadWorkshopAuthors = async () => {
      setLoading(true);
      try {
        const result = await window.electronAPI.searchWorkshopWallpapers({
          query: searchQuery || '',
          page: 1,
          limit: 60,
          sort: 'trend',
          time: 'all',
          requiredTags: []
        });

        if (!active || !result?.success) return;
        setWorkshopWallpapers((result.data?.data || []).map(item => ({
          ...item,
          fromSteam: true
        })));
      } catch {
        if (active) setWorkshopWallpapers([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadWorkshopAuthors();
    return () => {
      active = false;
    };
  }, [searchQuery]);

  const allWallpapers = useMemo(() => (
    [...workshopWallpapers, ...localWallpapers]
      .map(enrichWallpaperMetadata)
      .filter(wallpaper => canShowWallpaper(wallpaper, showMatureContent))
  ), [localWallpapers, showMatureContent, workshopWallpapers]);

  const allAuthors = useMemo(() => (
    buildAuthors(allWallpapers, subscriptions)
  ), [allWallpapers, subscriptions]);

  const authorsView = useMemo(() => {
    const normalizedQuery = String(searchQuery || '').trim().toLowerCase();
    const searchedAuthors = allAuthors.filter(author => {
      const matchesSearch = !normalizedQuery || (
        [author.name, author.handle, author.id].some(value => (
          String(value || '').toLowerCase().includes(normalizedQuery)
        ))
      );
      return matchesSearch && matchesContentTab(author, activeTab);
    });

    const followedAuthors = sortByOption(
      searchedAuthors.filter(author => author.followed),
      sortBy
    );
    const referenceAuthors = followedAuthors.length > 0
      ? followedAuthors
      : allAuthors.filter(author => author.followed);
    const tagWeights = buildTagWeights(referenceAuthors, favoriteSignals);
    const suggestedAuthors = sortByOption(
      searchedAuthors
        .filter(author => !author.followed)
        .map(author => ({
          ...author,
          recommendationScore: scoreSuggestedAuthor(author, tagWeights, activeTab)
        })),
      sortBy
    );

    return {
      followedAuthors,
      suggestedAuthors,
      total: searchedAuthors.length
    };
  }, [activeTab, allAuthors, favoriteSignals, searchQuery, sortBy]);

  const authors = useMemo(() => ([
    ...authorsView.followedAuthors,
    ...authorsView.suggestedAuthors
  ]), [authorsView]);

  const suggestedSubtitle = useMemo(() => {
    if (authorsView.followedAuthors.length > 0) {
      return `Autores con etiquetas y ${getContentTabLabel(activeTab)} similar a los que sigues.`;
    }

    if (favoriteSignals.length > 0) {
      return `Autores con ${getContentTabLabel(activeTab)} parecido a tus me gusta.`;
    }

    return `Autores populares dentro de ${getContentTabLabel(activeTab)}.`;
  }, [activeTab, authorsView.followedAuthors.length, favoriteSignals.length]);

  const authorStats = useMemo(() => ({
    total: allAuthors.length,
    followed: allAuthors.filter(author => author.followed).length,
    wallpapers: allAuthors.reduce((total, author) => total + author.wallpapers, 0),
    downloads: allAuthors.reduce((total, author) => total + author.downloads, 0)
  }), [allAuthors]);

  useEffect(() => {
    if (!showMatureContent && activeTab === 'mature') {
      setActiveTab('all');
    }
  }, [activeTab, showMatureContent]);

  const handleSubscribe = useCallback((authorId, isSubscribed) => {
    if (!authorId) return;
    setSubscriptions(current => {
      const sampleWallpaper = allWallpapers.find(wallpaper => (
        (wallpaper.authorId || wallpaper.creator || wallpaper.author) === authorId
      ));
      const updated = updateAuthorSubscription(
        current,
        authorId,
        isSubscribed,
        sampleWallpaper ? buildAuthorSubscriptionRecord(sampleWallpaper, 'manual') : { source: 'manual' }
      );
      saveAuthorSubscriptions(updated);
      return updated;
    });
  }, [allWallpapers]);

  const renderAuthorCard = useCallback((author, index) => (
    <div
      key={author.id}
      role="button"
      tabIndex={0}
      className={`author-explorer-card ${author.followed ? 'followed' : ''} ${author.contentKind}`}
      onClick={() => setSelectedAuthorId(author.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setSelectedAuthorId(author.id);
        }
      }}
    >
      <span className="author-rank">{index + 1}</span>
      <span className="author-card-menu"><i className="bi bi-three-dots"></i></span>
      <span className="author-explorer-cover">
        {author.preview && <img src={author.preview} alt="" />}
      </span>
      <span className="author-explorer-avatar">
        {author.avatar ? <img src={author.avatar} alt={author.name} /> : String(author.name || '?').slice(0, 2).toUpperCase()}
      </span>
      <strong>{author.name} <i className="bi bi-patch-check-fill"></i></strong>
      <small>{author.handle}</small>
      <span className="author-content-pills">
        {author.contentTypes.map(type => (
          <b key={type}>{type === 'mature' ? 'Maduro' : 'Normal'}</b>
        ))}
      </span>
      <em>
        <span><i className="bi bi-images"></i> {formatCompact(author.wallpapers)}</span>
        <span><i className="bi bi-heart"></i> {formatCompact(author.likes)}</span>
        <span><i className="bi bi-download"></i> {formatCompact(author.downloads)}</span>
      </em>
      <span className="author-card-actions">
        <button
          type="button"
          className={`author-follow-btn ${author.followed ? 'subscribed' : ''}`}
          onClick={(event) => {
            event.stopPropagation();
            handleSubscribe(author.id, !author.followed);
          }}
        >
          <i className={`bi bi-${author.followed ? 'person-check-fill' : 'person-plus'}`}></i>
          {author.followed ? 'Siguiendo' : 'Seguir'}
        </button>
      </span>
    </div>
  ), [handleSubscribe]);

  const renderAuthorGrid = useCallback((items, offset = 0) => (
    <div className={`authors-grid ${viewMode}`}>
      {items.map((author, index) => renderAuthorCard(author, offset + index))}
    </div>
  ), [renderAuthorCard, viewMode]);

  const heroPreview = authors[0]?.preview || allWallpapers[0] && getPreviewUrl(allWallpapers[0]);

  return (
    <section className="authors-explorer">
      <div
        className="authors-explorer-header"
        style={heroPreview ? { '--authors-hero-image': `url("${heroPreview}")` } : undefined}
      >
        <div>
          <h2>Explora nuestros <span>creadores</span></h2>
          <p>Sigue autores para que su contenido aparezca con mas frecuencia en Inicio. Descargar un wallpaper tambien sigue a su autor.</p>
          <div className="authors-hero-stats">
            <span><strong>{formatCompact(authorStats.total)}</strong><small>Autores</small></span>
            <span><strong>{formatCompact(authorStats.followed)}</strong><small>Siguiendo</small></span>
            <span><strong>{formatCompact(authorStats.wallpapers)}</strong><small>Wallpapers</small></span>
            <span><strong>{formatCompact(authorStats.downloads)}</strong><small>Descargas</small></span>
          </div>
        </div>
        {loading && (
          <span>
            <i className="bi bi-arrow-repeat spin-icon"></i>
            Actualizando
          </span>
        )}
      </div>

      <div className="authors-toolbar">
        <div className="authors-tabs" role="tablist" aria-label="Filtrar autores">
          {AUTHOR_TABS.map(tab => (
            <button
              key={tab.value}
              type="button"
              className={activeTab === tab.value ? 'active' : ''}
              disabled={tab.value === 'mature' && !showMatureContent}
              onClick={() => setActiveTab(tab.value)}
            >
              <i className={`bi bi-${tab.icon}`}></i>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="authors-toolbar-actions">
          <label>
            <span>Ordenar por</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              {SORT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <div className="authors-view-toggle" aria-label="Modo de vista">
            <button type="button" className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')}>
              <i className="bi bi-grid-3x3-gap-fill"></i>
            </button>
            <button type="button" className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>
              <i className="bi bi-list-ul"></i>
            </button>
          </div>
        </div>
      </div>

      {authorsView.total === 0 ? (
        <div className="authors-empty">
          <i className="bi bi-people"></i>
          <p>No hay autores con esa busqueda.</p>
        </div>
      ) : (
        <>
          <section className="authors-section-block">
            <div className="authors-section-title">
              <div>
                <h3>Autores que sigues</h3>
                <p>
                  {activeTab === 'following'
                    ? 'Todos tus autores seguidos aparecen aqui.'
                    : `Tus seguidos con ${getContentTabLabel(activeTab)}.`}
                </p>
              </div>
              <span>{authorsView.followedAuthors.length}</span>
            </div>

            {authorsView.followedAuthors.length > 0 ? (
              renderAuthorGrid(authorsView.followedAuthors)
            ) : (
              <div className="authors-section-empty">
                <i className="bi bi-person-plus"></i>
                <p>Aun no sigues autores en esta seccion.</p>
              </div>
            )}
          </section>

          <section className="authors-section-block">
            <div className="authors-section-title">
              <div>
                <h3>Sugeridos para esta seccion</h3>
                <p>{suggestedSubtitle}</p>
              </div>
              <span>{authorsView.suggestedAuthors.length}</span>
            </div>

            {authorsView.suggestedAuthors.length > 0 ? (
              renderAuthorGrid(authorsView.suggestedAuthors)
            ) : (
              <div className="authors-section-empty">
                <i className="bi bi-stars"></i>
                <p>No hay sugerencias nuevas con este filtro.</p>
              </div>
            )}
          </section>
        </>
      )}

      {selectedAuthorId && (
        <AuthorProfile
          authorId={selectedAuthorId}
          allWallpapers={allWallpapers}
          subscriptions={subscriptions}
          onClose={() => setSelectedAuthorId(null)}
          onSubscribe={handleSubscribe}
          onOpenWallpaper={() => setSelectedAuthorId(null)}
        />
      )}
    </section>
  );
}
