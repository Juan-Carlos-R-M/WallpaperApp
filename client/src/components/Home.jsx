import React, { useCallback, useEffect, useMemo, useState } from "react";
import WallpaperCard from "./WallpaperCard";
import WallpaperDetails from "./WallpaperDetails";
import AuthorProfile from "./AuthorProfile";
import { getLocalWallpapers } from "../data/sampleWallpapers";
import { downloadWallpaperAsset } from "../utils/downloadWallpaper";
import {
  enrichWallpaperMetadata,
  formatCompact,
  getAuthorInfo,
  getPreviewUrl,
  getWallpaperId,
} from "../utils/wallpaperMeta";
import { canShowWallpaper } from "../utils/contentPreferences";
import { applyWallpaperAccent } from "../utils/dynamicAccent";
import {
  buildPreferenceProfile,
  buildAuthorSubscriptionRecord,
  followAuthorFromWallpaper,
  isAuthorSubscribed,
  loadAuthorSubscriptions,
  loadWallpaperInteractions,
  recordWallpaperInteraction,
  saveAuthorSubscriptions,
  updateAuthorSubscription,
} from "../utils/recommendationSignals";
import { fetchOnlineRecommendations } from "../utils/workshopRecommendations";
import "../styles/home.css";

const HOME_RECOMMENDATIONS_LIMIT = 5;
const HOME_AUTHOR_LIMIT = 5;
const HOME_RELATED_LIMIT = 12;

const WORKSHOP_SEARCH_LIMIT = 36;

const HOME_CATEGORIES = [
  { label: "Anime", query: "Anime", count: "32.5K", icon: "stars" },
  { label: "Paisajes", query: "Landscape", count: "18.2K", icon: "sunset" },
  { label: "Sci-Fi", query: "Sci-Fi", count: "14.8K", icon: "rocket-takeoff" },
  {
    label: "Minimalista",
    query: "Minimal",
    count: "8.7K",
    icon: "record-circle",
  },
  { label: "Oscuros", query: "Dark", count: "12.1K", icon: "moon-stars" },
  { label: "Ciberpunk", query: "Cyberpunk", count: "9.3K", icon: "cpu" },
];

const normalizeSearch = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase();

const buildFeaturedAuthors = (wallpapers = []) => {
  const authors = new Map();

  wallpapers.forEach((wallpaper) => {
    const authorId = wallpaper.authorId || wallpaper.author || "Autor";
    const authorInfo = getAuthorInfo(wallpaper);

    const current = authors.get(authorId) || {
      id: authorId,
      name: authorInfo?.name || wallpaper.author || authorId,
      handle: authorInfo?.handle || `@${String(authorId).slice(0, 12)}`,
      followers: authorInfo?.followers || 0,
      preview: getPreviewUrl(wallpaper),
      likes: 0,
    };

    current.likes += Number(wallpaper.likes || 0);
    authors.set(authorId, current);
  });

  return [...authors.values()]
    .sort((a, b) => b.followers + b.likes - (a.followers + a.likes))
    .slice(0, HOME_AUTHOR_LIMIT);
};

const buildHomeStats = (wallpapers = [], featuredAuthors = []) => ({
  wallpapers: wallpapers.length * 1000,
  authors: featuredAuthors.length * 4800,
  downloads: wallpapers.reduce(
    (total, item) => total + Number(item.downloads || 0),
    0,
  ),
  likes: wallpapers.reduce((total, item) => total + Number(item.likes || 0), 0),
});

const normalizeWallpaperCollection = (items = [], showMatureContent = false) =>
  items
    .map((item) => enrichWallpaperMetadata(item))
    .filter((item) => canShowWallpaper(item, showMatureContent));

const getLocalWallpaperCollection = (
  search = "",
  showMatureContent = false,
) => {
  const result = getLocalWallpapers({
    page: 1,
    limit: WORKSHOP_SEARCH_LIMIT,
    search,
  });
  return normalizeWallpaperCollection(result.data || [], showMatureContent);
};

const Home = ({
  search,
  onSearch,
  showMatureContent,
  onNavigate,
  onOpenSteam,
  onOpenGallery,
  onOpenAuthors,
}) => {
  const [activeCategory, setActiveCategory] = useState("");
  const [wallpapers, setWallpapers] = useState([]);
  const [recommendedWallpapers, setRecommendedWallpapers] = useState([]);
  const [popularWallpapers, setPopularWallpapers] = useState([]);
  const [recentWallpapers, setRecentWallpapers] = useState([]);

  const [selectedWallpaper, setSelectedWallpaper] = useState(null);
  const [selectedAuthorId, setSelectedAuthorId] = useState(null);
  const [downloadingId, setDownloadingId] = useState("");

  const [onlineRelatedWallpapers, setOnlineRelatedWallpapers] = useState([]);
  const preferenceProfile = useMemo(() => buildPreferenceProfile(), []);

  const featuredAuthors = useMemo(
    () => buildFeaturedAuthors(wallpapers),
    [wallpapers],
  );
  const stats = useMemo(
    () => buildHomeStats(wallpapers, featuredAuthors),
    [featuredAuthors, wallpapers],
  );

  const heroWallpaper = popularWallpapers[0] || wallpapers[0];
  const heroPreview = heroWallpaper ? getPreviewUrl(heroWallpaper) : "";

  const refreshLocal = useCallback(() => {
    const items = getLocalWallpaperCollection(search, showMatureContent);
    setWallpapers(items);

    const byLikes = [...items]
      .sort((a, b) => Number(b.likes || 0) - Number(a.likes || 0))
      .slice(0, HOME_RECOMMENDATIONS_LIMIT);

    const byRecency = [...items]
      .sort(
        (a, b) =>
          Number(new Date(b.timeCreated || 0)) -
          Number(new Date(a.timeCreated || 0)),
      )
      .slice(0, HOME_RECOMMENDATIONS_LIMIT);

    const recommended = [...items].slice(0, HOME_RECOMMENDATIONS_LIMIT);

    setPopularWallpapers(byLikes);
    setRecentWallpapers(byRecency);
    setRecommendedWallpapers(recommended);
  }, [search, showMatureContent]);

  useEffect(() => {
    refreshLocal();
  }, [refreshLocal]);

  const handleCategoryClick = useCallback(
    (category) => {
      setActiveCategory(category.label);
      onSearch(category.query);
    },
    [onSearch],
  );

  const handleOpenDetails = useCallback((wallpaper) => {
    const enriched = enrichWallpaperMetadata(wallpaper);
    applyWallpaperAccent(enriched);
    setSelectedWallpaper(enriched);
  }, []);

  const handleDetailNavigate = useCallback(
    (target) => {
      setSelectedWallpaper(null);
      if (target === "gallery") {
        onOpenGallery("recent");
        return;
      }
      onNavigate(target);
    },
    [onNavigate, onOpenGallery],
  );

  const handleDownloadWallpaper = useCallback(async (wallpaper) => {
    const wallpaperId = getWallpaperId(wallpaper);
    setDownloadingId(wallpaperId);
    try {
      const result = await downloadWallpaperAsset(wallpaper);
      recordWallpaperInteraction(wallpaper, "download");
      followAuthorFromWallpaper(wallpaper, "download");
      return result;
    } finally {
      setDownloadingId("");
    }
  }, []);

  const handleSubscribeAuthor = useCallback(
    (authorId, isSubscribed, wallpaper = null) => {
      if (!authorId) return;
      const subscriptions = loadAuthorSubscriptions();
      const next = updateAuthorSubscription(
        subscriptions,
        authorId,
        isSubscribed,
        wallpaper
          ? buildAuthorSubscriptionRecord(wallpaper, "manual")
          : { source: "manual" },
      );

      saveAuthorSubscriptions(next);
      // keep original UI lightweight
    },
    [],
  );

  useEffect(() => {
    let active = true;
    if (!selectedWallpaper) {
      setOnlineRelatedWallpapers([]);
      return undefined;
    }

    (async () => {
      try {
        const items = await fetchOnlineRecommendations({
          wallpaper: selectedWallpaper,
          limit: HOME_RELATED_LIMIT,
          showMatureContent,
        });
        if (active) setOnlineRelatedWallpapers(items);
      } catch {
        if (active) setOnlineRelatedWallpapers([]);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedWallpaper, showMatureContent]);

  const selectedWallpaperSubscriptionAuthorId =
    selectedWallpaper?.authorId || selectedWallpaper?.author || "";

  return (
    <div className="home-screen">
      <section
        className="home-hero"
        style={
          heroPreview
            ? { "--home-hero-image": `url("${heroPreview}")` }
            : undefined
        }
      >
        <div className="home-hero-content">
          <h1>
            Descubre increibles <span>wallpapers</span>
          </h1>
          <p>
            Explora miles de wallpapers animados creados por nuestra comunidad.
          </p>
          <div className="home-hero-stats">
            <span>
              <i className="bi bi-image"></i>
              <strong>{formatCompact(stats.wallpapers)}</strong>
              <small>Wallpapers</small>
            </span>
            <span>
              <i className="bi bi-people"></i>
              <strong>{formatCompact(stats.authors)}</strong>
              <small>Autores</small>
            </span>
            <span>
              <i className="bi bi-download"></i>
              <strong>{formatCompact(stats.downloads)}</strong>
              <small>Descargas</small>
            </span>
            <span>
              <i className="bi bi-heart"></i>
              <strong>{formatCompact(stats.likes)}</strong>
              <small>Me gusta</small>
            </span>
          </div>
          <div className="home-hero-actions">
            <button type="button" onClick={() => onOpenGallery("recent")}>
              Explorar
            </button>
            <button type="button" onClick={() => onOpenGallery("popular")}>
              <i className="bi bi-fire"></i> Mas populares
            </button>
          </div>
        </div>
        <div className="home-hero-dots">
          <span className="active"></span>
          <span></span>
          <span></span>
        </div>
      </section>

      <div className="home-category-strip">
        {HOME_CATEGORIES.map((category) => (
          <button
            key={category.label}
            type="button"
            className={activeCategory === category.label ? "active" : ""}
            onClick={() => handleCategoryClick(category)}
          >
            <i className={`bi bi-${category.icon}`}></i>
            <span>
              <strong>{category.label}</strong>
              <small>{category.count}</small>
            </span>
          </button>
        ))}
        <button
          type="button"
          className="home-category-next"
          aria-label="Mas categorias"
          onClick={() => onOpenGallery("recent")}
        >
          <i className="bi bi-chevron-right"></i>
        </button>
      </div>

      <section className="home-section">
        <div className="home-section-title">
          <h3>Recomendado para ti</h3>
          <button type="button" onClick={() => onOpenGallery("popular")}>
            Ver todo
          </button>
        </div>
        <div className="home-wallpaper-row">
          {recommendedWallpapers.map((wp) => (
            <WallpaperCard
              key={wp._id || wp.id || getWallpaperId(wp)}
              wallpaper={wp}
              onOpenDetails={handleOpenDetails}
              onOpenAuthor={setSelectedAuthorId}
              onDownload={handleDownloadWallpaper}
              repairing={downloadingId === getWallpaperId(wp)}
            />
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-title">
          <h3>Populares esta semana</h3>
          <button type="button" onClick={() => onOpenGallery("popular")}>
            Ver todo
          </button>
        </div>
        <div className="home-wallpaper-row">
          {popularWallpapers.map((wp) => (
            <WallpaperCard
              key={wp._id || wp.id || getWallpaperId(wp)}
              wallpaper={wp}
              onOpenDetails={handleOpenDetails}
              onOpenAuthor={setSelectedAuthorId}
              onDownload={handleDownloadWallpaper}
              repairing={downloadingId === getWallpaperId(wp)}
            />
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-title">
          <h3>Mas recientes</h3>
          <button type="button" onClick={() => onOpenGallery("recent")}>
            Ver todo
          </button>
        </div>
        <div className="home-wallpaper-row">
          {recentWallpapers.map((wp) => (
            <WallpaperCard
              key={wp._id || wp.id || getWallpaperId(wp)}
              wallpaper={wp}
              onOpenDetails={handleOpenDetails}
              onOpenAuthor={setSelectedAuthorId}
              onDownload={handleDownloadWallpaper}
              repairing={downloadingId === getWallpaperId(wp)}
            />
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-title">
          <h3>Autores destacados</h3>
          <button type="button" onClick={onOpenAuthors}>
            Ver todos
          </button>
        </div>
        <div className="home-authors-row">
          {featuredAuthors.map((author) => (
            <button
              key={author.id}
              type="button"
              onClick={() => setSelectedAuthorId(author.id)}
            >
              <span>
                {author.preview ? (
                  <img src={author.preview} alt={author.name} />
                ) : (
                  author.name.slice(0, 2)
                )}
              </span>
              <strong>
                {author.name} <i className="bi bi-patch-check-fill"></i>
              </strong>
              <small>{author.handle}</small>
              <em>
                {formatCompact(author.followers || author.likes)} seguidores
              </em>
            </button>
          ))}
        </div>
      </section>

      <section className="home-upload-cta">
        <span>
          <i className="bi bi-cloud-arrow-up"></i>
        </span>
        <div>
          <h3>Tienes un wallpaper increible?</h3>
          <p>Comparte tu creacion con la comunidad</p>
        </div>
        <button type="button" onClick={onOpenSteam}>
          Subir Wallpaper
        </button>
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
          isSubscribed={isAuthorSubscribed(
            selectedWallpaperSubscriptionAuthorId,
          )}
          relatedWallpapers={onlineRelatedWallpapers}
          authorWallpapers={[]}
          onOpenRelated={handleOpenDetails}
          isDownloaded={Boolean(
            selectedWallpaper.localPath ||
            selectedWallpaper.installed ||
            selectedWallpaper.downloaded,
          )}
          sourceName={"Galeria local"}
          sourceIcon={"hdd-stack"}
          sourceTarget={"gallery"}
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
};

export default Home;
