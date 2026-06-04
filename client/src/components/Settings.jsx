import React, { useCallback, useEffect, useState } from 'react';
import '../styles/settings.css';

const DOWNLOAD_CONFIRMATION_STORAGE_KEY = 'wallpaperApp.showDownloadConfirmation';

const Settings = () => {
  const [logInfo, setLogInfo] = useState(null);
  const [logContent, setLogContent] = useState('');
  const [downloaderStatus, setDownloaderStatus] = useState(null);
  const [error, setError] = useState('');
  const [showDownloadConfirmation, setShowDownloadConfirmation] = useState(
    localStorage.getItem(DOWNLOAD_CONFIRMATION_STORAGE_KEY) !== 'false'
  );

  const loadSettings = useCallback(async () => {
    try {
      setError('');

      if (!window.electronAPI) {
        setError('Esta pantalla requiere la app de escritorio.');
        return;
      }

      const [logResult, statusResult, contentResult] = await Promise.all([
        window.electronAPI.getAppLogInfo(),
        window.electronAPI.getWorkshopDownloaderStatus(),
        window.electronAPI.readAppLog()
      ]);

      if (logResult.success) setLogInfo(logResult.data);
      if (statusResult.success) setDownloaderStatus(statusResult.data);
      if (contentResult.success) setLogContent(contentResult.data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateDownloadConfirmation = (checked) => {
    setShowDownloadConfirmation(checked);
    localStorage.setItem(DOWNLOAD_CONFIRMATION_STORAGE_KEY, String(checked));
  };

  return (
    <section className="settings-screen">
      <div className="settings-header">
        <div>
          <h2>Configuracion</h2>
          <p>Diagnostico de descarga, carpetas detectadas y log de la app.</p>
        </div>
        <button type="button" onClick={loadSettings}>Actualizar</button>
      </div>

      {error && <div className="settings-error">{error}</div>}

      <div className="settings-grid">
        <article className="settings-card">
          <h3>Wallpaper Engine</h3>
          <dl>
            <div>
              <dt>Carpeta de descarga</dt>
              <dd>{downloaderStatus?.wallpaperEngineTarget || 'No detectada'}</dd>
            </div>
            <div>
              <dt>Instalacion</dt>
              <dd>{downloaderStatus?.wallpaperEngineInstall || 'No detectada'}</dd>
            </div>
            <div>
              <dt>Descargador</dt>
              <dd>{downloaderStatus?.hasDownloader ? 'SteamCMD listo' : 'Falta SteamCMD'}</dd>
            </div>
          </dl>
        </article>

        <article className="settings-card">
          <h3>Log</h3>
          <dl>
            <div>
              <dt>Archivo</dt>
              <dd>{logInfo?.path || 'Sin ruta'}</dd>
            </div>
            <div>
              <dt>Tamano</dt>
              <dd>{logInfo ? `${logInfo.size} bytes` : 'Sin dato'}</dd>
            </div>
          </dl>
        </article>

        <article className="settings-card">
          <h3>Notificaciones</h3>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={showDownloadConfirmation}
              onChange={(event) => updateDownloadConfirmation(event.target.checked)}
            />
            <span>
              <strong>Confirmacion de descarga</strong>
              <small>Mostrar la pantalla de wallpaper descargado al terminar.</small>
            </span>
          </label>
        </article>
      </div>

      <pre className="settings-log">{logContent || 'Todavia no hay entradas en el log.'}</pre>
    </section>
  );
};

export default Settings;
