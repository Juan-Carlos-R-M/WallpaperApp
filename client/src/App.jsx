import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';


import Header from './components/Header';
import LoadingScreen from './components/LoadingScreen';
import { DEFAULT_WORKSHOP_FILTERS } from './utils/workshopFilters';
import {
  CONTENT_PREFERENCES_EVENT,
  MATURE_CONTENT_STORAGE_KEY,
  loadShowMatureContent,
  saveShowMatureContent
} from './utils/contentPreferences';
import { getPreviewUrl } from './utils/wallpaperMeta';


import './App.css';



const Home = lazy(() => import('./components/Home'));
const Gallery = lazy(() => import('./components/Gallery'));
const SteamIntegration = lazy(() => import('./components/SteamIntegration'));
const SteamUsersManager = lazy(() => import('./components/SteamUsersManager'));
const AuthorsExplorer = lazy(() => import('./components/AuthorsExplorer'));
const Settings = lazy(() => import('./components/Settings'));

// Error Boundary para atrapar errores sin control
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error atrapado por ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#1a1a2e',
          color: '#fff',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <i style={{ fontSize: '48px' }} className="bi bi-exclamation-triangle-fill"></i>
          <div style={{ textAlign: 'center', maxWidth: '400px' }}>
            <h1>⚠️ Error en la aplicación</h1>
            <p>Ocurrió un error inesperado. Por favor, recarga la página.</p>
            <button onClick={() => globalThis.location.reload()} style={{
              padding: '10px 20px',
              marginTop: '20px',
              backgroundColor: '#ff6b6b',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px'
            }}>
              Recargar aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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
const NOTIFICATION_VISIBLE_MS = 5000;
const NOTIFICATION_EXIT_MS = 260;

const loadSavedWorkshopFilters = () => {
  try {
    const saved = localStorage.getItem(WORKSHOP_FILTER_STORAGE_KEY);
    return saved ? { ...DEFAULT_WORKSHOP_FILTERS, ...JSON.parse(saved) } : DEFAULT_WORKSHOP_FILTERS;
  } catch {
    return DEFAULT_WORKSHOP_FILTERS;
  }
};

const getNotificationIconClass = (type) => {
  switch (type) {
    case 'success':
      return 'download';
    case 'progress':
      return 'arrow-repeat spin-icon';
    default:
      return 'exclamation-triangle-fill';
  }
};

function App() {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('home');
  const [galleryFeed, setGalleryFeed] = useState('recent');
  const [workshopFilters, setWorkshopFilters] = useState(loadSavedWorkshopFilters);
  const [notifications, setNotifications] = useState([]);
  const [showMatureContent, setShowMatureContent] = useState(loadShowMatureContent);
  const notificationIdRef = useRef(0);
  const notificationTimeoutsRef = useRef(new Set()); // Track which notifications have timeouts

  const showGallery = activeTab === 'gallery';
  const showUsers = activeTab === 'users';

  const scrollToTop = useCallback(() => {
    const restore = () => {
      const scrollElement = document.scrollingElement || document.documentElement;
      globalThis.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      if (scrollElement) scrollElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    };
    restore();
    globalThis.requestAnimationFrame(restore);
    globalThis.setTimeout(restore, 80);
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

    globalThis.addEventListener(CONTENT_PREFERENCES_EVENT, handlePreferenceChange);
    globalThis.addEventListener('storage', handleStorageChange);

    return () => {
      globalThis.removeEventListener(CONTENT_PREFERENCES_EVENT, handlePreferenceChange);
      globalThis.removeEventListener('storage', handleStorageChange);
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

  const handleResetWorkshopFilters = useCallback(() => {
    const nextFilters = DEFAULT_WORKSHOP_FILTERS;
    setWorkshopFilters(nextFilters);
  }, []);

  const pushNotification = useCallback((payload, fallbackType = 'error') => {
    const notificationPayload = typeof payload === 'string'
      ? { message: payload, type: fallbackType }
      : { type: fallbackType, ...payload };
    const message = String(notificationPayload.message || notificationPayload.title || '').trim();

    if (!message) return;

    // Generar ID único:
    // - Para descargas: usar solo wallpaperId (progress/error/success se reemplazan)
    // - Para otros: usar ID secuencial
    let notificationId;
    if (notificationPayload.wallpaper?.publishedFileId) {
      const wallpaperId = notificationPayload.wallpaper.publishedFileId;
      notificationId = `wallpaper-${wallpaperId}`;
    } else {
      notificationId = `generic-${++notificationIdRef.current}`;
    }

    const notification = {
      id: notificationId,
      type: notificationPayload.type || fallbackType,
      title: notificationPayload.title || '',
      message,
      status: notificationPayload.status || '',
      wallpaper: notificationPayload.wallpaper || null,
      path: notificationPayload.path || '',
      createdAt: new Date().toISOString(),
      visible: true,
      fading: false,
      read: false,
      persistent: notificationPayload.persistent === true
    };

    // Verificar si esta notificación ya tiene timeout configurado
    const hasExistingTimeout = notificationTimeoutsRef.current.has(notificationId);

    // Reemplazar notificaciones del mismo wallpaper (evitar duplicados)
    setNotifications(current => {
      const filtered = current.filter(item => item.id !== notificationId);
      const updated = [notification, ...filtered].slice(0, 40);
      return updated;
    });

    // Solo configurar timeout si es UNA NUEVA notificación (sin timeout existente)
    // Las actualizaciones (como progreso) no resetean el timer
    if (!hasExistingTimeout) {
      // Marcar que esta notificación ya tiene timeout
      notificationTimeoutsRef.current.add(notificationId);

      // Hacer fade out de la pila flotante después de unos segundos
      globalThis.setTimeout(() => {
        setNotifications(current => 
          current.map(item => 
            item.id === notificationId ? { ...item, fading: true } : item
          )
        );
        
        // Después de un tiempo, remover de la vista flotante (pero mantener en bandeja si es persistente)
        globalThis.setTimeout(() => {
          setNotifications(current => current.map(item => (
            item.id === notificationId ? { ...item, visible: false } : item
          )));

          // Limpiar del Set de timeouts cuando se completa
          notificationTimeoutsRef.current.delete(notificationId);
        }, NOTIFICATION_EXIT_MS);
      }, notificationPayload.durationMs || NOTIFICATION_VISIBLE_MS);
    }
  }, []);

  const hideNotification = useCallback((id) => {
    setNotifications(current => current.map(item => (
      item.id === id ? { ...item, visible: false, hiding: true } : item
    )));
    globalThis.setTimeout(() => {
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
            <i className={`bi bi-${getNotificationIconClass(notification.type)}`}></i>
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
    <ErrorBoundary>
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
          onResetWorkshopFilters={handleResetWorkshopFilters}
          notifications={notifications}
          onRemoveNotification={removeNotification}
          onClearNotifications={clearNotifications}
          onMarkNotificationsRead={markNotificationsRead}
          onUpload={() => handleNavigate('steam')}
          onOpenProfile={() => handleNavigate('users')}
          showTitle={false}
        />
        <Suspense
          fallback={(
            <LoadingScreen
              isVisible={true}
              title="Cargando vista..."
              subtitle="Preparando la sección seleccionada"
              type="spinner"
              fullScreen={false}
            />
          )}
        >
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
        </Suspense>
        {notificationStack}
      </div>
    </ErrorBoundary>
  );
}

export default App;
