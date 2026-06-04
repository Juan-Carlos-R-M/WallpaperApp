import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { getLocalWallpapers } from '../data/sampleWallpapers';
import {
  enrichWallpaperMetadata,
  formatCompact,
  getAuthorInfo,
  getAuthorKey,
  getAuthorName,
  getPreviewUrl
} from '../utils/wallpaperMeta';
import { isAuthorSubscribed } from '../utils/recommendationSignals';
import '../styles/author-profile.css';

export default function AuthorProfile({
  authorId,
  allWallpapers = [],
  subscriptions = {},
  onClose,
  onSubscribe,
  onOpenWallpaper
}) {
  const [workshopProfile, setWorkshopProfile] = useState(null);
  const [workshopWallpapers, setWorkshopWallpapers] = useState([]);
  const [workshopLoading, setWorkshopLoading] = useState(false);
  const [workshopError, setWorkshopError] = useState('');
  const fallbackWallpapers = useMemo(() => (
    getLocalWallpapers({ limit: 100 }).data.map(enrichWallpaperMetadata)
  ), []);

  const authorInfo = getAuthorInfo(authorId);
  const canLoadWorkshopAuthor = /^\d+$/.test(String(authorId || ''))
    && typeof window !== 'undefined'
    && window.electronAPI
    && typeof window.electronAPI.getWorkshopAuthorProfile === 'function';

  useEffect(() => {
    if (!canLoadWorkshopAuthor) {
      setWorkshopProfile(null);
      setWorkshopWallpapers([]);
      setWorkshopLoading(false);
      setWorkshopError('');
      return undefined;
    }

    let active = true;

    const loadWorkshopAuthor = async () => {
      setWorkshopLoading(true);
      setWorkshopError('');

      try {
        const result = await window.electronAPI.getWorkshopAuthorProfile(authorId, { limit: 36 });
        if (!active) return;

        if (!result?.success) {
          throw new Error(result?.error || 'No se pudo cargar el autor.');
        }

        setWorkshopProfile(result.data?.profile || null);
        setWorkshopWallpapers((result.data?.wallpapers || []).map(item => enrichWallpaperMetadata({
          ...item,
          fromSteam: true
        })));
      } catch (error) {
        if (!active) return;
        setWorkshopProfile(null);
        setWorkshopWallpapers([]);
        setWorkshopError(error?.message || 'No se pudo cargar el autor.');
      } finally {
        if (active) setWorkshopLoading(false);
      }
    };

    loadWorkshopAuthor();
    return () => {
      active = false;
    };
  }, [authorId, canLoadWorkshopAuthor]);

  const normalizeAlias = (value = '') => String(value || '').trim().toLowerCase();
  const authorAliases = useMemo(() => new Set([
    authorId,
    authorInfo?.id,
    authorInfo?.name,
    authorInfo?.handle,
    workshopProfile?.id,
    workshopProfile?.name,
    workshopProfile?.handle
  ].map(normalizeAlias).filter(Boolean)), [
    authorId,
    authorInfo?.id,
    authorInfo?.name,
    authorInfo?.handle,
    workshopProfile?.id,
    workshopProfile?.name,
    workshopProfile?.handle
  ]);

  const wallpapers = useMemo(() => {
    if (workshopWallpapers.length > 0) {
      return workshopWallpapers;
    }

    const source = [...allWallpapers, ...fallbackWallpapers].map(enrichWallpaperMetadata);
    const seen = new Set();

    const matched = source.filter(wallpaper => {
      const wallpaperAliases = [
        getAuthorKey(wallpaper),
        wallpaper.authorId,
        wallpaper.creator,
        wallpaper.creatorId,
        wallpaper.author,
        wallpaper.publisher,
        wallpaper.authorInfo?.id,
        wallpaper.authorInfo?.name,
        getAuthorName(wallpaper)
      ].map(normalizeAlias).filter(Boolean);
      const sameAuthor = wallpaperAliases.some(alias => authorAliases.has(alias));
      const id = wallpaper.publishedFileId || wallpaper._id || wallpaper.id || wallpaper.title;
      if (!sameAuthor || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    if (matched.length > 0) return matched;

    const fallbackSeen = new Set();
    return source.filter(wallpaper => {
      const id = wallpaper.publishedFileId || wallpaper._id || wallpaper.id || wallpaper.title;
      if (!id || fallbackSeen.has(id)) return false;
      fallbackSeen.add(id);
      return true;
    }).slice(0, 12);
  }, [allWallpapers, fallbackWallpapers, authorAliases, workshopWallpapers]);

  const firstWallpaper = wallpapers[0];
  const profile = workshopProfile || authorInfo || firstWallpaper?.authorInfo || {
    id: authorId,
    name: firstWallpaper?.author || authorId || 'Autor',
    handle: authorId ? `@${String(authorId).slice(0, 12)}` : '',
    description: 'Creador de wallpapers para Wallpaper Gallery.',
    bio: '',
    followers: firstWallpaper?.followers || firstWallpaper?.subscriptions || 0,
    wallpapers: wallpapers.length,
    likes: wallpapers.reduce((total, wallpaper) => total + Number(wallpaper.likes || wallpaper.favorited || 0), 0),
    joined: ''
  };

  const profileId = profile.id || authorId;
  const isSubscribed = isAuthorSubscribed(subscriptions[profileId] || subscriptions[authorId]);
  const coverUrl = firstWallpaper ? getPreviewUrl(firstWallpaper) : '';
  const avatarUrl = profile.avatar || profile.avatarUrl || '';

  const handleSubscribe = () => {
    onSubscribe?.(profileId, !isSubscribed, firstWallpaper);
  };

  const handleOpenWallpaper = (wallpaper) => {
    onOpenWallpaper?.(wallpaper);
    onClose?.();
  };

  return createPortal(
    <div className="author-profile-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <section className="author-profile-modal" onClick={(event) => event.stopPropagation()}>
        <button className="author-close" onClick={onClose} aria-label="Cerrar">
          <i className="bi bi-x-lg"></i>
        </button>

        <nav className="author-breadcrumb">
          <button type="button" onClick={onClose}><i className="bi bi-house-door"></i> Inicio</button>
          <i className="bi bi-chevron-right"></i>
          <span>Autores</span>
          <i className="bi bi-chevron-right"></i>
          <strong>{profile.name}</strong>
        </nav>

        <header className="author-hero">
          {coverUrl && <img src={coverUrl} alt="" />}
          <div className="author-hero-scrim" />
          <div className="author-hero-content">
            <div className="author-avatar-wrap">
              <div className="author-avatar">
                {avatarUrl ? <img src={avatarUrl} alt={profile.name} /> : String(profile.name || '?').slice(0, 2).toUpperCase()}
              </div>
              <i className="bi bi-patch-check-fill"></i>
            </div>
            <div className="author-identity">
              <h1>{profile.name} <i className="bi bi-patch-check-fill"></i></h1>
              {profile.handle && <span>{profile.handle}</span>}
              <p>{profile.description || profile.bio || 'Creador de wallpapers para Wallpaper Engine.'}</p>
              <div className="author-inline-stats">
                <div><i className="bi bi-images"></i><strong>{formatCompact(profile.wallpapers || wallpapers.length)}</strong><span>Wallpapers</span></div>
                <div><i className="bi bi-person"></i><strong>{formatCompact(profile.followers)}</strong><span>Seguidores</span></div>
                <div><i className="bi bi-hand-thumbs-up"></i><strong>{formatCompact(profile.likes)}</strong><span>Me gusta</span></div>
                <div><i className="bi bi-calendar3"></i><strong>{profile.joined || '2024'}</strong><span>Se unio</span></div>
              </div>
            </div>
            <div className="author-hero-actions">
              <button
                onClick={handleSubscribe}
                className={`subscribe-btn-large ${isSubscribed ? 'subscribed' : ''}`}
              >
                <i className={`bi bi-person-${isSubscribed ? 'check-fill' : 'plus'}`}></i>
                {isSubscribed ? 'Siguiendo' : 'Seguir'}
              </button>
              <button type="button" className="author-message-btn">
                <i className="bi bi-chat-left-text"></i>
                Mensaje
              </button>
              <button type="button" className="author-more-btn" aria-label="Mas opciones">
                <i className="bi bi-three-dots"></i>
              </button>
            </div>
          </div>
        </header>

        <div className="author-profile-body">
          <div className="author-tabs">
            <button type="button" className="active">Wallpapers</button>
            <button type="button">Informacion</button>
          </div>

          <div className="author-wallpapers-section">
            {workshopLoading && (
              <div className="author-status">
                <i className="bi bi-arrow-repeat spin-icon"></i>
                Cargando wallpapers reales del Workshop...
              </div>
            )}
            {workshopError && (
              <div className="author-status error">
                <i className="bi bi-exclamation-triangle"></i>
                {workshopError}
              </div>
            )}
            <div className="author-filter-row">
              <div className="author-sort-tabs">
                <button type="button" className="active">Mas recientes</button>
                <button type="button">Mas populares</button>
                <button type="button">Mas descargados</button>
              </div>
              <div className="author-view-tools">
                <span>{wallpapers.length} disponibles</span>
                <button type="button" className="active"><i className="bi bi-grid-3x3-gap-fill"></i></button>
                <button type="button"><i className="bi bi-list-ul"></i></button>
              </div>
            </div>

            <div className="author-wallpapers-grid">
              {wallpapers.map((wallpaper, index) => (
                <button
                  type="button"
                  key={wallpaper._id || wallpaper.publishedFileId || index}
                  className="author-wallpaper-tile"
                  onClick={() => handleOpenWallpaper(wallpaper)}
                >
                  <img src={getPreviewUrl(wallpaper)} alt={wallpaper.title} />
                  <em>{wallpaper.fromSteam || wallpaper.publishedFileId ? 'WORKSHOP' : 'LOCAL'}</em>
                  <span>{wallpaper.title}</span>
                  <div>
                    <small><i className="bi bi-eye"></i> {formatCompact(wallpaper.views || wallpaper.subscriptions)}</small>
                    <small><i className="bi bi-heart"></i> {formatCompact(wallpaper.likes || wallpaper.favorited)}</small>
                    <small><i className="bi bi-download"></i> {formatCompact(wallpaper.downloads || wallpaper.subscriptions)}</small>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}
