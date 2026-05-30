import React, { useEffect, useState } from 'react';
import '../styles/steam-users.css';

const DEFAULT_FORM = {
  username: '',
  displayName: '',
  password: ''
};

const SteamUsersManager = () => {
  const [accounts, setAccounts] = useState([]);
  const [selectedUsername, setSelectedUsername] = useState('');
  const [form, setForm] = useState(DEFAULT_FORM);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
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

  const selectAccount = async (account) => {
    setSelectedUsername(account.username);
    setForm({
      username: account.username,
      displayName: account.displayName,
      password: ''
    });
    setError('');
    setMessage('');
    await window.electronAPI.selectSteamAccount(account.username);
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

  if (!window.electronAPI) {
    return (
      <div className="steam-users">
        <div className="steam-user-empty">Esta pantalla requiere la app de escritorio.</div>
      </div>
    );
  }

  return (
    <div className="steam-users">
      <div className="steam-users-header">
        <div>
          <h2>Usuarios Steam</h2>
          <p>Administra las cuentas usadas para descargar desde Workshop. Las contrasenas se guardan cifradas por Electron.</p>
        </div>
        <button type="button" onClick={newAccount}>Nuevo usuario</button>
      </div>

      {error && <div className="steam-user-error">{error}</div>}
      {message && <div className="steam-user-success">{message}</div>}

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
    </div>
  );
};

export default SteamUsersManager;
