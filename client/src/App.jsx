import React, { useState } from 'react';
import Home from './components/Home';
import Gallery from './components/Gallery';
import Header from './components/Header';
import SteamIntegration from './components/SteamIntegration';
import SteamUsersManager from './components/SteamUsersManager';
import Settings from './components/Settings';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './App.css';

const NAV_ITEMS = [
  { id: 'home', label: 'Inicio', icon: 'house-door' },
  { id: 'gallery', label: 'Galeria', icon: 'grid-3x3-gap' },
  { id: 'steam', label: 'Steam Wallpaper Engine', icon: 'steam' },
  { id: 'favorites', label: 'Guardados', icon: 'bookmark' },
  { id: 'authors', label: 'Autores', icon: 'people' },
  { id: 'users', label: 'Usuarios', icon: 'person-lines-fill' },
  { id: 'settings', label: 'Configuracion', icon: 'gear' }
];

function App() {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('home');

  const showGallery = activeTab === 'gallery';
  const showUsers = activeTab === 'users' || activeTab === 'authors';

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
              onClick={() => setActiveTab(item.id)}
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
            onClick={() => setActiveTab('steam')}
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
        onSearch={setSearchQuery}
        selectedCategory={selectedCategory}
        onCategorySelect={setSelectedCategory}
        showTitle={false}
      />
      <div className="container">
        {activeTab === 'home' && (
          <Home
            search={searchQuery}
            onOpenSteam={() => setActiveTab('steam')}
          />
        )}

        {showGallery && (
          <Gallery
            category={selectedCategory}
            search={searchQuery}
          />
        )}

        {activeTab === 'steam' && (
          <SteamIntegration />
        )}

        {activeTab === 'favorites' && (
          <SteamIntegration favoritesOnly />
        )}

        {showUsers && (
          <SteamUsersManager />
        )}

        {activeTab === 'settings' && (
          <Settings />
        )}
      </div>
    </div>
  );
}

export default App;
