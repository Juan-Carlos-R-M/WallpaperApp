import React, { useEffect, useMemo, useState } from 'react';
import { getLocalWallpapers } from '../data/sampleWallpapers';
import {
  enrichWallpaperMetadata,
  formatCompact,
  getPreviewUrl,
  getWallpaperId,
  isDownloadedWallpaper
} from '../utils/wallpaperMeta';
import {
  loadAuthorSubscriptions,
  loadFavoriteWallpapers,
  loadWallpaperInteractions
} from '../utils/recommendationSignals';
import '../styles/steam-users.css';

const DEFAULT_FORM = {
  username: '',
  displayName: '',
  password: ''
};

const PROFILE_STORAGE_KEY = 'wallpaperApp.userProfile';

const DEFAULT_PROFILE = {
  displayName: 'WallpaperGirl',
  handle: '@wallpaper_girl',
  bio: 'Colecciono wallpapers con color, movimiento y atmosfera.',
  status: 'Explorando Workshop',
  avatar: '',
  banner: '',
  accent: 'pink',
  showDownloads: true,
  showLikes: true
};

const ACCENTS = [
  { id: 'pink', label: 'Rosa', color: '#ff2f73' },
  { id: 'violet', label: 'Violeta', color: '#a855ff' },
  { id: 'blue', label: 'Azul', color: '#1f8cff' },
  { id: 'green', label: 'Verde', color: '#42df62' },
  { id: 'orange', label: 'Fuego', color: '#ff9d00' }
];

const MOCK_FRIENDS = [
  { id: 'sakura', name: 'Sakura', handle: '@sakura_art', status: 'online', activity: 'Explorando Workshop', accent: '#ff4f8f' },
  { id: 'neon', name: 'NeonVoid', handle: '@neonvoid', status: 'online', activity: 'Viendo wallpapers', accent: '#7a5cff' },
  { id: 'akiro', name: 'Akiro', handle: '@akiro', status: 'online', activity: 'Editando coleccion', accent: '#ffcf42' },
  { id: 'luna', name: 'Luna', handle: '@luna_dream', status: 'away', activity: 'Viendo perfil de un artista', accent: '#d693ff' },
  { id: 'pixel', name: 'PixelStorm', handle: '@pixelstorm', status: 'online', activity: 'Descargando wallpaper', accent: '#42dfff' },
  { id: 'shadow', name: 'ShadowX', handle: '@shadowx', status: 'offline', activity: 'Ultima conexion: hace 3 horas', accent: '#6b7280' }
];

const MOCK_REQUESTS = [
  { id: 'starry', name: 'StarryNight', handle: '@starry', accent: '#ffd1ea' },
  { id: 'hikari', name: 'Hikari', handle: '@hikari', accent: '#b7d7ff' }
];

const readProfile = () => {
  try {
    const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
    return saved ? { ...DEFAULT_PROFILE, ...JSON.parse(saved) } : DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
};

const SteamUsersManager = () => {
  const [activeView, setActiveView] = useState('profile');
  const [accounts, setAccounts] = useState([]);
  const [selectedUsername, setSelectedUsername] = useState('');
  const [form, setForm] = useState(DEFAULT_FORM);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(readProfile);
  const [profileDraft, setProfileDraft] = useState(readProfile);
  const [downloadedWallpapers, setDownloadedWallpapers] = useState([]);
  const [friends, setFriends] = useState(MOCK_FRIENDS);
  const [friendRequests, setFriendRequests] = useState(MOCK_REQUESTS);
  const [selectedFriendId, setSelectedFriendId] = useState(MOCK_FRIENDS[0]?.id || '');
  const [friendSearch, setFriendSearch] = useState('');
  const [friendName, setFriendName] = useState('');

  useEffect(() => {
    loadAccounts();
    loadDownloadedWallpapers();
  }, []);

  const loadDownloadedWallpapers = async () => {
    if (!window.electronAPI?.getDownloadedWallpapers) {
      setDownloadedWallpapers([]);
      return;
    }

    try {
      const result = await window.electronAPI.getDownloadedWallpapers();
      if (result?.success) {
        setDownloadedWallpapers((result.data || []).map(enrichWallpaperMetadata));
      }
    } catch {
      setDownloadedWallpapers([]);
    }
  };

  const loadAccounts = async () => {
    if (!window.electronAPI?.listSteamAccounts) return;

    try {
      const result = await window.electronAPI.listSteamAccounts();
      if (!result.success) {
        setError(result.error || 'No se pudieron cargar usuarios');
        return;
      }

      setAccounts(result.data.accounts);
      setSelectedUsername(result.data.selectedUsername);
      const selected = result.data.accounts.find(account => account.username === result.data.selectedUsername);
      setForm({
        username: selected?.username || '',
        displayName: selected?.displayName || '',
        password: ''
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const profileAccent = ACCENTS.find(item => item.id === profile.accent) || ACCENTS[0];
  const draftAccent = ACCENTS.find(item => item.id === profileDraft.accent) || ACCENTS[0];
  const favoriteWallpapers = useMemo(() => loadFavoriteWallpapers().map(enrichWallpaperMetadata), []);
  const interactions = useMemo(() => loadWallpaperInteractions(), []);
  const subscriptions = useMemo(() => loadAuthorSubscriptions(), []);
  const sampleWallpapers = useMemo(() => getLocalWallpapers({ limit: 24 }).data.map(enrichWallpaperMetadata), []);
  const interactionWallpapers = useMemo(() => (
    Object.values(interactions)
      .map(item => item.wallpaper)
      .filter(Boolean)
      .map(enrichWallpaperMetadata)
  ), [interactions]);
  const downloaded = useMemo(() => {
    const merged = [...downloadedWallpapers, ...interactionWallpapers.filter(isDownloadedWallpaper)];
    const seen = new Set();
    return merged.filter(wallpaper => {
      const id = getWallpaperId(wallpaper);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [downloadedWallpapers, interactionWallpapers]);
  const liked = favoriteWallpapers.length > 0 ? favoriteWallpapers : sampleWallpapers.slice(0, 6);
  const recent = [...downloaded, ...interactionWallpapers, ...sampleWallpapers].slice(0, 9);
  const heroWallpaper = liked[0] || downloaded[0] || sampleWallpapers[0];
  const heroPreview = profile.banner || getPreviewUrl(heroWallpaper);
  const selectedFriend = friends.find(friend => friend.id === selectedFriendId) || friends[0];
  const visibleFriends = friends.filter(friend => (
    [friend.name, friend.handle, friend.activity].some(value => (
      String(value || '').toLowerCase().includes(friendSearch.trim().toLowerCase())
    ))
  ));

  const stats = {
    liked: liked.length,
    downloaded: downloaded.length,
    following: Object.values(subscriptions).filter(item => item === true || item?.following).length,
    views: recent.reduce((total, item) => total + Number(item.views || item.downloads || item.subscriptions || 0), 0)
  };

  const saveProfile = (event) => {
    event.preventDefault();
    setProfile(profileDraft);
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profileDraft));
    setMessage('Perfil actualizado');
    setError('');
  };

  const selectAccount = async (account) => {
    setSelectedUsername(account.username);
    setForm({
      username: account.username,
      displayName: account.displayName,
      password: ''
    });
    setError('');
    setMessage('');
    await window.electronAPI?.selectSteamAccount?.(account.username);
  };

  const saveAccount = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      const result = await window.electronAPI.saveSteamAccount(form);
      if (!result.success) {
        setError(result.error || 'No se pudo guardar la cuenta');
        return;
      }

      setAccounts(result.data.accounts);
      setSelectedUsername(result.data.selectedUsername);
      setForm(current => ({ ...current, password: '' }));
      setMessage('Cuenta guardada');
    } catch (err) {
      setError(err.message);
    }
  };

  const removeAccount = async () => {
    if (!form.username) return;

    setError('');
    setMessage('');

    try {
      const result = await window.electronAPI.removeSteamAccount(form.username);
      if (!result.success) {
        setError(result.error || 'No se pudo eliminar la cuenta');
        return;
      }

      setAccounts(result.data.accounts);
      setSelectedUsername(result.data.selectedUsername);
      const selected = result.data.accounts.find(account => account.username === result.data.selectedUsername);
      setForm({
        username: selected?.username || '',
        displayName: selected?.displayName || '',
        password: ''
      });
      setMessage('Cuenta eliminada');
    } catch (err) {
      setError(err.message);
    }
  };

  const newAccount = () => {
    setForm(DEFAULT_FORM);
    setError('');
    setMessage('');
  };

  const sendFriendRequest = (event) => {
    event.preventDefault();
    const name = friendName.trim();
    if (!name) return;
    setMessage(`Solicitud enviada a ${name}`);
    setFriendName('');
  };

  const acceptRequest = (request) => {
    setFriendRequests(current => current.filter(item => item.id !== request.id));
    setFriends(current => [
      { ...request, status: 'online', activity: 'Nuevo amigo', accent: request.accent },
      ...current
    ]);
    setSelectedFriendId(request.id);
  };

  const declineRequest = (requestId) => {
    setFriendRequests(current => current.filter(item => item.id !== requestId));
  };

  const renderWallpaperGrid = (items = []) => (
    <div className="user-wallpaper-grid">
      {items.slice(0, 9).map((wallpaper, index) => (
        <article key={getWallpaperId(wallpaper) || index} className="user-wallpaper-card">
          {getPreviewUrl(wallpaper) && <img src={getPreviewUrl(wallpaper)} alt={wallpaper.title} />}
          <span>{String(wallpaper.mediaType || 'image').toUpperCase()}</span>
          <strong>{wallpaper.title || 'Wallpaper'}</strong>
          <small>
            <i className="bi bi-heart"></i> {formatCompact(wallpaper.likes || wallpaper.favorited)}
            <i className="bi bi-download"></i> {formatCompact(wallpaper.downloads || wallpaper.subscriptions)}
          </small>
        </article>
      ))}
    </div>
  );

  return (
    <section className="steam-users social-hub" style={{ '--profile-accent': profileAccent.color, '--draft-accent': draftAccent.color }}>
      <nav className="social-hub-tabs" aria-label="Perfil y social">
        <button type="button" className={activeView === 'profile' ? 'active' : ''} onClick={() => setActiveView('profile')}>
          <i className="bi bi-person-heart"></i> Perfil
        </button>
        <button type="button" className={activeView === 'friends' ? 'active' : ''} onClick={() => setActiveView('friends')}>
          <i className="bi bi-people"></i> Amigos <span>{friends.filter(friend => friend.status === 'online').length}</span>
        </button>
        <button type="button" className={activeView === 'account' ? 'active' : ''} onClick={() => setActiveView('account')}>
          <i className="bi bi-shield-lock"></i> Cuenta Steam
        </button>
      </nav>

      {error && <div className="steam-user-error">{error}</div>}
      {message && <div className="steam-user-success">{message}</div>}

      {activeView === 'profile' && (
        <div className="user-profile-screen">
          <header
            className="user-profile-hero"
            style={heroPreview ? { '--profile-banner': `url("${heroPreview}")` } : undefined}
          >
            <div className="profile-color-orb" />
            <div className="user-avatar-large">
              {profile.avatar ? <img src={profile.avatar} alt={profile.displayName} /> : profile.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="user-profile-copy">
              <span>Mi perfil</span>
              <h2>{profile.displayName}</h2>
              <small>{profile.handle} - {profile.status}</small>
              <p>{profile.bio}</p>
            </div>
            <div className="user-profile-stats">
              <span><strong>{formatCompact(stats.liked)}</strong><small>Me gusta</small></span>
              <span><strong>{formatCompact(stats.downloaded)}</strong><small>Descargados</small></span>
              <span><strong>{formatCompact(stats.following)}</strong><small>Siguiendo</small></span>
              <span><strong>{formatCompact(stats.views)}</strong><small>Actividad</small></span>
            </div>
          </header>

          <div className="user-profile-layout">
            <main className="user-profile-main">
              {profile.showLikes && (
                <section className="user-section-panel">
                  <div className="user-section-title">
                    <h3>Wallpapers que me gustan</h3>
                    <button type="button">Ver todos</button>
                  </div>
                  {renderWallpaperGrid(liked)}
                </section>
              )}

              {profile.showDownloads && (
                <section className="user-section-panel">
                  <div className="user-section-title">
                    <h3>Descargados y locales</h3>
                    <button type="button" onClick={loadDownloadedWallpapers}>Actualizar</button>
                  </div>
                  {downloaded.length > 0 ? renderWallpaperGrid(downloaded) : (
                    <div className="user-empty-panel">
                      <i className="bi bi-download"></i>
                      <p>Tus wallpapers descargados apareceran aqui.</p>
                    </div>
                  )}
                </section>
              )}

              <section className="user-section-panel">
                <div className="user-section-title">
                  <h3>Actividad reciente</h3>
                  <button type="button">Historial</button>
                </div>
                <div className="user-activity-list">
                  {recent.slice(0, 5).map((wallpaper, index) => (
                    <article key={getWallpaperId(wallpaper) || index}>
                      {getPreviewUrl(wallpaper) && <img src={getPreviewUrl(wallpaper)} alt="" />}
                      <span>
                        <strong>{index % 2 === 0 ? 'Agregaste a favoritos' : 'Descargaste'} {wallpaper.title}</strong>
                        <small>{wallpaper.author || 'Wallpaper Gallery'} - hace {index + 1} h</small>
                      </span>
                    </article>
                  ))}
                </div>
              </section>
            </main>

            <aside className="profile-editor-panel">
              <h3><i className="bi bi-sliders"></i> Personalizacion</h3>
              <form onSubmit={saveProfile}>
                <label>
                  Nombre visible
                  <input value={profileDraft.displayName} onChange={(event) => setProfileDraft(current => ({ ...current, displayName: event.target.value }))} />
                </label>
                <label>
                  Usuario
                  <input value={profileDraft.handle} onChange={(event) => setProfileDraft(current => ({ ...current, handle: event.target.value }))} />
                </label>
                <label>
                  Estado
                  <input value={profileDraft.status} onChange={(event) => setProfileDraft(current => ({ ...current, status: event.target.value }))} />
                </label>
                <label>
                  Bio
                  <textarea value={profileDraft.bio} onChange={(event) => setProfileDraft(current => ({ ...current, bio: event.target.value }))} />
                </label>
                <label>
                  Avatar URL
                  <input value={profileDraft.avatar} onChange={(event) => setProfileDraft(current => ({ ...current, avatar: event.target.value }))} placeholder="https://..." />
                </label>
                <label>
                  Banner URL
                  <input value={profileDraft.banner} onChange={(event) => setProfileDraft(current => ({ ...current, banner: event.target.value }))} placeholder="usa un wallpaper o imagen" />
                </label>
                <div className="profile-color-picker">
                  <span>Color del perfil</span>
                  {ACCENTS.map(accent => (
                    <button
                      key={accent.id}
                      type="button"
                      className={profileDraft.accent === accent.id ? 'active' : ''}
                      style={{ '--swatch': accent.color }}
                      onClick={() => setProfileDraft(current => ({ ...current, accent: accent.id }))}
                      aria-label={accent.label}
                    />
                  ))}
                </div>
                <label className="profile-toggle-row">
                  <input
                    type="checkbox"
                    checked={profileDraft.showLikes}
                    onChange={(event) => setProfileDraft(current => ({ ...current, showLikes: event.target.checked }))}
                  />
                  Mostrar favoritos
                </label>
                <label className="profile-toggle-row">
                  <input
                    type="checkbox"
                    checked={profileDraft.showDownloads}
                    onChange={(event) => setProfileDraft(current => ({ ...current, showDownloads: event.target.checked }))}
                  />
                  Mostrar descargados
                </label>
                <button type="submit" className="profile-save-btn">
                  <i className="bi bi-check2-circle"></i> Guardar perfil
                </button>
              </form>
            </aside>
          </div>
        </div>
      )}

      {activeView === 'friends' && (
        <div className="friends-screen">
          <header className="friends-header">
            <div>
              <span>Social</span>
              <h2>Amigos</h2>
              <p>Interfaz lista para conectar busqueda, solicitudes y chats cuando tengas esas funciones.</p>
            </div>
            <form onSubmit={sendFriendRequest}>
              <input value={friendName} onChange={(event) => setFriendName(event.target.value)} placeholder="Usuario de Wallpaper App" />
              <button type="submit"><i className="bi bi-person-plus"></i> Enviar solicitud</button>
            </form>
          </header>

          <div className="friends-layout">
            <aside className="friends-list-panel">
              <input value={friendSearch} onChange={(event) => setFriendSearch(event.target.value)} placeholder="Buscar amigos..." />
              <div className="friends-list">
                {visibleFriends.map(friend => (
                  <button
                    key={friend.id}
                    type="button"
                    className={selectedFriend?.id === friend.id ? 'active' : ''}
                    onClick={() => setSelectedFriendId(friend.id)}
                    style={{ '--friend-accent': friend.accent }}
                  >
                    <span>{friend.name.slice(0, 2).toUpperCase()}</span>
                    <strong>{friend.name}</strong>
                    <small>{friend.status === 'online' ? 'En linea' : friend.status === 'away' ? 'Ausente' : 'Desconectado'}</small>
                    <em>{friend.activity}</em>
                  </button>
                ))}
              </div>
            </aside>

            <main className="friend-detail-panel" style={{ '--friend-accent': selectedFriend?.accent || profileAccent.color }}>
              <section className="friend-hero-card">
                <div className="friend-orb" />
                <div className="friend-avatar">{selectedFriend?.name.slice(0, 2).toUpperCase()}</div>
                <div>
                  <h3>{selectedFriend?.name}</h3>
                  <span>{selectedFriend?.handle} - {selectedFriend?.status === 'online' ? 'En linea' : 'No disponible'}</span>
                  <p>{selectedFriend?.activity}</p>
                </div>
                <div className="friend-actions">
                  <button type="button"><i className="bi bi-chat-dots"></i> Mensaje</button>
                  <button type="button"><i className="bi bi-person"></i> Ver perfil</button>
                </div>
              </section>

              <section className="friend-wallpapers">
                <div className="user-section-title">
                  <h3>Wallpapers recientes</h3>
                  <button type="button">Ver todos</button>
                </div>
                {renderWallpaperGrid(sampleWallpapers.slice(0, 4))}
              </section>

              <section className="friend-activity">
                <div className="user-section-title">
                  <h3>Actividad de amigos</h3>
                  <button type="button">Ver toda</button>
                </div>
                <div className="user-activity-list">
                  {sampleWallpapers.slice(0, 3).map((wallpaper, index) => (
                    <article key={getWallpaperId(wallpaper) || index}>
                      {getPreviewUrl(wallpaper) && <img src={getPreviewUrl(wallpaper)} alt="" />}
                      <span>
                        <strong>{selectedFriend?.name} {index === 0 ? 'favorito' : index === 1 ? 'descargo' : 'comento en'} {wallpaper.title}</strong>
                        <small>hace {index + 1} horas</small>
                      </span>
                    </article>
                  ))}
                </div>
              </section>
            </main>

            <aside className="friends-side-panel">
              <section>
                <h3>Solicitudes ({friendRequests.length})</h3>
                {friendRequests.map(request => (
                  <article key={request.id} style={{ '--friend-accent': request.accent }}>
                    <span>{request.name.slice(0, 2).toUpperCase()}</span>
                    <div>
                      <strong>{request.name}</strong>
                      <small>Quiere ser tu amigo</small>
                    </div>
                    <button type="button" onClick={() => acceptRequest(request)} aria-label="Aceptar"><i className="bi bi-check-lg"></i></button>
                    <button type="button" onClick={() => declineRequest(request.id)} aria-label="Rechazar"><i className="bi bi-x-lg"></i></button>
                  </article>
                ))}
              </section>

              <section>
                <h3>Sugerencias</h3>
                {['Yoru', 'Kuroi', 'Skyline'].map((name, index) => (
                  <article key={name}>
                    <span>{name.slice(0, 2).toUpperCase()}</span>
                    <div>
                      <strong>{name}</strong>
                      <small>{12 - index * 3} amigos en comun</small>
                    </div>
                    <button type="button" onClick={() => setFriendName(name)}>Anadir</button>
                  </article>
                ))}
              </section>
            </aside>
          </div>
        </div>
      )}

      {activeView === 'account' && (
        <div className="steam-account-screen">
          <div className="steam-users-header">
            <div>
              <h2>Cuenta Steam</h2>
              <p>Administra las cuentas usadas para descargar desde Workshop. Las contrasenas se guardan cifradas por Electron.</p>
            </div>
            <button type="button" onClick={newAccount}>Nuevo usuario</button>
          </div>

          {!window.electronAPI ? (
            <div className="steam-user-empty">Esta pantalla requiere la app de escritorio.</div>
          ) : (
            <div className="steam-users-layout">
              <div className="steam-user-list">
                {accounts.map(account => (
                  <button
                    key={account.username}
                    type="button"
                    className={`steam-user-row ${selectedUsername === account.username ? 'active' : ''}`}
                    onClick={() => selectAccount(account)}
                  >
                    <strong>{account.displayName}</strong>
                    <span>{account.username}</span>
                    <small>{account.hasPassword ? 'Contrasena guardada' : 'Sin contrasena'}</small>
                  </button>
                ))}
              </div>

              <form className="steam-user-form" onSubmit={saveAccount}>
                <label>
                  Usuario Steam
                  <input
                    value={form.username}
                    onChange={(event) => setForm(current => ({ ...current, username: event.target.value }))}
                    placeholder="usuario"
                    autoComplete="username"
                    required
                  />
                </label>
                <label>
                  Nombre visible
                  <input
                    value={form.displayName}
                    onChange={(event) => setForm(current => ({ ...current, displayName: event.target.value }))}
                    placeholder="opcional"
                  />
                </label>
                <label>
                  Contrasena
                  <input
                    value={form.password}
                    onChange={(event) => setForm(current => ({ ...current, password: event.target.value }))}
                    placeholder="dejar vacia para conservar la guardada"
                    type="password"
                    autoComplete="current-password"
                  />
                </label>

                <div className="steam-user-actions">
                  <button type="submit">Guardar</button>
                  <button type="button" onClick={removeAccount} disabled={!form.username}>Eliminar</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default SteamUsersManager;
