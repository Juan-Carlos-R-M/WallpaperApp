import React, { useCallback, useEffect, useRef, useState } from 'react';
import Home from './components/Home';
import Gallery from './components/Gallery';
import Header from './components/Header';
import SteamIntegration, { DEFAULT_WORKSHOP_FILTERS } from './components/SteamIntegration';
import SteamUsersManager from './components/SteamUsersManager';
import AuthorsExplorer from './components/AuthorsExplorer';
import Settings from './components/Settings';
import {
  CONTENT_PREFERENCES_EVENT,
  MATURE_CONTENT_STORAGE_KEY,
  loadShowMatureContent,
  saveShowMatureContent
} from './utils/contentPreferences';
import { getPreviewUrl } from './utils/wallpaperMeta';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './App.css';

const NAV_ITEMS = [
  { id: 'home', label: 'Inicio', icon: 'house-door' },
  { id: 'gallery', label: 'Galeria', icon: 'grid-3x3-gap' },
  { id: 'steam', label: 'Steam Wallpaper Engine', icon: 'steam' },
  { id: 'favorites', label: 'Me gusta', icon: 'heart' },
  { id: 'authors', label: 'Autores', icon: 'people' },
  { id: 'users', label: 'Perfil y amigos', icon: 'people' },
  { id: 'settings', label: 'Configuracion', icon: 'gear' }
];

const WORKSHOP_FILTER_STORAGE_KEY = 'wallpaperApp.workshopFilters';
const NOTIFICATION_VISIBLE_MS = 3800;
const NOTIFICATION_EXIT_MS = 260;

const loadWorkshopFilters = () => {
  try {
    const saved = localStorage.getItem(WORKSHOP_FILTER_STORAGE_KEY);
    return saved ? { ...DEFAULT_WORKSHOP_FILTERS, ...JSON.parse(saved) } : DEFAULT_WORKSHOP_FILTERS;
  } catch {
    return DEFAULT_WORKSHOP_FILTERS;
  }
};

function App() {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('home');
  const [galleryFeed, setGalleryFeed] = useState('recent');
  const [workshopFilters, setWorkshopFilters] = useState(loadWorkshopFilters);
  const [notifications, setNotifications] = useState([]);
  const [showMatureContent, setShowMatureContent] = useState(loadShowMatureContent);
  const notificationIdRef = useRef(0);

  const showGallery = activeTab === 'gallery';
  const showUsers = activeTab === 'users';

  const scrollToTop = useCallback(() => {
    const restore = () => {
      const scrollElement = document.scrollingElement || document.documentElement;
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      if (scrollElement) scrollElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    };
    restore();
    window.requestAnimationFrame(restore);
    window.setTimeout(restore, 80);
  }, []);

  const handleNavigate = useCallback((nextTab) => {
    setActiveTab(nextTab);
    scrollToTop();
  }, [scrollToTop]);

  useEffect(() => {
    scrollToTop();
  }, [activeTab, scrollToTop]);

  useEffect(() => {
    const handlePreferenceChange = (event) => {
      if (typeof event.detail?.showMatureContent === 'boolean') {
        setShowMatureContent(event.detail.showMatureContent);
        return;
      }

      setShowMatureContent(loadShowMatureContent());
    };

    const handleStorageChange = (event) => {
      if (event.key === MATURE_CONTENT_STORAGE_KEY) {
        setShowMatureContent(loadShowMatureContent());
      }
    };

    window.addEventListener(CONTENT_PREFERENCES_EVENT, handlePreferenceChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(CONTENT_PREFERENCES_EVENT, handlePreferenceChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const updateMatureContentPreference = useCallback((enabled) => {
    saveShowMatureContent(enabled);
    setShowMatureContent(Boolean(enabled));
  }, []);

  const openGallery = useCallback((feed = 'recent') => {
    setGalleryFeed(feed);
    setActiveTab('gallery');
    scrollToTop();
  }, [scrollToTop]);

  const updateWorkshopFilters = useCallback((nextFilters) => {
    setWorkshopFilters(current => {
      const resolvedFilters = typeof nextFilters === 'function'
        ? nextFilters(current)
        : { ...current, ...nextFilters };
      localStorage.setItem(WORKSHOP_FILTER_STORAGE_KEY, JSON.stringify(resolvedFilters));
      return resolvedFilters;
    });
  }, []);

  const resetWorkshopFilters = useCallback(() => {
    localStorage.setItem(WORKSHOP_FILTER_STORAGE_KEY, JSON.stringify(DEFAULT_WORKSHOP_FILTERS));
    setWorkshopFilters(DEFAULT_WORKSHOP_FILTERS);
  }, []);

  const pushNotification = useCallback((payload, fallbackType = 'error') => {
    const notificationPayload = typeof payload === 'string'
      ? { message: payload, type: fallbackType }
      : { type: fallbackType, ...payload };
    const message = String(notificationPayload.message || notificationPayload.title || '').trim();

    if (!message) return;

    const id = notificationIdRef.current + 1;
    notificationIdRef.current = id;

    const notification = {
      id,
      type: notificationPayload.type || fallbackType,
      title: notificationPayload.title || '',
      message,
      status: notificationPayload.status || '',
      wallpaper: notificationPayload.wallpaper || null,
      path: notificationPayload.path || '',
      createdAt: new Date().toISOString(),
      visible: true,
      hiding: false,
      read: false
    };

    setNotifications(current => [notification, ...current].slice(0, 40));

    window.setTimeout(() => {
      setNotifications(current => current.map(item => (
        item.id === id ? { ...item, visible: false, hiding: true } : item
      )));
      window.setTimeout(() => {
        setNotifications(current => current.filter(item => item.id !== id));
      }, NOTIFICATION_EXIT_MS);
    }, notificationPayload.durationMs || NOTIFICATION_VISIBLE_MS);
  }, []);

  const hideNotification = useCallback((id) => {
    setNotifications(current => current.map(item => (
      item.id === id ? { ...item, visible: false, hiding: true } : item
    )));
    window.setTimeout(() => {
      setNotifications(current => current.filter(item => item.id !== id));
    }, NOTIFICATION_EXIT_MS);
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(current => current.filter(item => item.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const markNotificationsRead = useCallback(() => {
    setNotifications(current => current.map(item => ({ ...item, read: true })));
  }, []);

  const visibleNotifications = notifications.filter(notification => notification.visible || notification.hiding).slice(0, 4);

  const notificationStack = visibleNotifications.length > 0 && (
    <div className="app-notification-stack" role="status" aria-live="polite">
      {visibleNotifications.map(notification => (
        <div key={notification.id} className={`app-notification ${notification.type} ${notification.hiding ? 'leaving' : ''}`}>
          <span className="app-notification-icon">
            <i className={`bi bi-${
              notification.type === 'success'
                ? 'download'
                : notification.type === 'progress'
                  ? 'arrow-repeat spin-icon'
                  : 'exclamation-triangle-fill'
            }`}></i>
          </span>
          <div className="app-notification-body">
            <div className="app-notification-copy">
              {notification.title && <strong>{notification.title}</strong>}
              <p>{notification.message}</p>
            </div>
            {notification.wallpaper && (
              <div className="app-notification-wallpaper">
                {getPreviewUrl(notification.wallpaper) && (
                  <img src={getPreviewUrl(notification.wallpaper)} alt="" />
                )}
                <span>
                  <b>{notification.wallpaper.title || 'Wallpaper'}</b>
                  <small>{notification.wallpaper.author || notification.wallpaper.creator || notification.path || notification.status}</small>
                </span>
              </div>
            )}
          </div>
          <button type="button" onClick={() => hideNotification(notification.id)} aria-label="Cerrar notificacion">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="app">
      <aside className="app-sidebar" aria-label="Navegacion principal">
        <div className="sidebar-brand">
          <span className="sidebar-logo">
            <i className="bi bi-gem"></i>
          </span>
          <strong>Wallpaper <span>Gallery</span></strong>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-link ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => handleNavigate(item.id)}
              title={item.label}
            >
              <i className={`bi bi-${item.icon}`}></i>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-create"
            onClick={() => handleNavigate('steam')}
            title="Crear Wallpaper"
          >
            <i className="bi bi-cloud-arrow-up"></i>
            <span>Crear Wallpaper</span>
            <i className="bi bi-plus-lg"></i>
          </button>
          <small>
            <span>© 2024 Wallpaper Gallery</span>
            <span>Todos los derechos reservados.</span>
          </small>
        </div>
      </aside>

      <Header
        activeTab={activeTab}
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        selectedCategory={selectedCategory}
        onCategorySelect={setSelectedCategory}
        workshopFilters={workshopFilters}
        onWorkshopFiltersChange={updateWorkshopFilters}
        onResetWorkshopFilters={resetWorkshopFilters}
        notifications={notifications}
        onRemoveNotification={removeNotification}
        onClearNotifications={clearNotifications}
        onMarkNotificationsRead={markNotificationsRead}
        onUpload={() => handleNavigate('steam')}
        onOpenProfile={() => handleNavigate('users')}
        showTitle={false}
      />
      <div className="container">
        {activeTab === 'home' && (
          <Home
            search={searchQuery}
            onSearch={setSearchQuery}
            showMatureContent={showMatureContent}
            onNavigate={handleNavigate}
            onOpenSteam={() => handleNavigate('steam')}
            onOpenGallery={openGallery}
            onOpenAuthors={() => handleNavigate('authors')}
          />
        )}

        {showGallery && (
          <Gallery
            category={selectedCategory}
            search={searchQuery}
            initialFeed={galleryFeed}
            showMatureContent={showMatureContent}
          />
        )}

        {activeTab === 'steam' && (
          <SteamIntegration
            searchQuery={searchQuery}
            workshopFilters={workshopFilters}
            onNotify={pushNotification}
            onNavigate={handleNavigate}
            showMatureContent={showMatureContent}
          />
        )}

        {activeTab === 'favorites' && (
          <SteamIntegration
            favoritesOnly
            searchQuery={searchQuery}
            workshopFilters={workshopFilters}
            onNotify={pushNotification}
            onNavigate={handleNavigate}
            showMatureContent={showMatureContent}
          />
        )}

        {showUsers && (
          <SteamUsersManager />
        )}

        {activeTab === 'authors' && (
          <AuthorsExplorer
            searchQuery={searchQuery}
            showMatureContent={showMatureContent}
          />
        )}

        {activeTab === 'settings' && (
          <Settings
            showMatureContent={showMatureContent}
            onMatureContentChange={updateMatureContentPreference}
          />
        )}
      </div>
      {notificationStack}
    </div>
  );
}

export default App;
