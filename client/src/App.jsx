import React, { useState } from 'react';
import Gallery from './components/Gallery';
import Header from './components/Header';
import SteamIntegration from './components/SteamIntegration';
import SteamUsersManager from './components/SteamUsersManager';
import Settings from './components/Settings';
import './App.css';

function App() {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('gallery');

  return (
    <div className="app">
      <Header
        onSearch={setSearchQuery}
        selectedCategory={selectedCategory}
        onCategorySelect={setSelectedCategory}
      />
      <div className="container">
        <div className="tabs-navigation">
          <button
            className={`tab-btn ${activeTab === 'gallery' ? 'active' : ''}`}
            onClick={() => setActiveTab('gallery')}
          >
            Galeria
          </button>
          <button
            className={`tab-btn ${activeTab === 'steam' ? 'active' : ''}`}
            onClick={() => setActiveTab('steam')}
          >
            Steam Wallpaper Engine
          </button>
          <button
            className={`tab-btn ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveTab('favorites')}
          >
            Guardados
          </button>
          <button
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Usuarios
          </button>
          <button
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Configuracion
          </button>
        </div>

        {activeTab === 'gallery' && (
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

        {activeTab === 'users' && (
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
