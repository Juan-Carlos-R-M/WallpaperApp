import React from 'react';
import '../styles/download-queue.css';

/**
 * Componente para mostrar la cola de descargas
 */
export const DownloadQueueMonitor = ({
  activeDownload = null,
  downloadQueue = [],
  completedDownloads = new Map(),
  failedDownloads = new Map(),
  onClearCompleted = () => {},
  onRemoveFromQueue = () => {},
  isProcessing = false
}) => {
  if (!activeDownload && downloadQueue.length === 0 && completedDownloads.size === 0 && failedDownloads.size === 0) {
    return null;
  }

  const totalProcessed = completedDownloads.size + failedDownloads.size;
  const totalInQueue = downloadQueue.length + totalProcessed + (activeDownload ? 1 : 0);
  const progressPercent = totalInQueue > 0 ? (totalProcessed / totalInQueue) * 100 : 0;

  return (
    <div className="download-queue-monitor">
      <div className="download-queue-header">
        <h3>📥 Cola de Descargas</h3>
        <span className="download-queue-stats">
          {isProcessing ? '⏳ Procesando...' : '✓ Listo'}
          {totalInQueue > 0 && ` (${totalProcessed}/${totalInQueue})`}
        </span>
      </div>

      {/* Barra de progreso */}
      {totalInQueue > 0 && (
        <div className="download-queue-progress">
          <div 
            className="download-queue-progress-bar" 
            style={{ width: `${progressPercent}%` }}
          />
          <span className="download-queue-progress-text">
            {Math.round(progressPercent)}%
          </span>
        </div>
      )}

      {/* Descarga activa */}
      {activeDownload && (
        <div className="download-queue-item active">
          <div className="download-queue-item-icon">⏳</div>
          <div className="download-queue-item-content">
            <div className="download-queue-item-title">Descargando...</div>
            <div className="download-queue-item-name">{activeDownload.title}</div>
          </div>
        </div>
      )}

      {/* Cola pendiente */}
      {downloadQueue.length > 0 && (
        <div className="download-queue-section">
          <div className="download-queue-section-title">
            En cola: {downloadQueue.length}
          </div>
          <div className="download-queue-items">
            {downloadQueue.slice(0, 3).map((item, idx) => (
              <div key={idx} className="download-queue-item pending">
                <div className="download-queue-item-icon">{idx + 1}</div>
                <div className="download-queue-item-content">
                  <div className="download-queue-item-name">{item.title}</div>
                </div>
                <button
                  className="download-queue-item-remove"
                  onClick={() => onRemoveFromQueue(item.publishedFileId || item.id)}
                  title="Remover de la cola"
                >
                  ✕
                </button>
              </div>
            ))}
            {downloadQueue.length > 3 && (
              <div className="download-queue-more">
                +{downloadQueue.length - 3} más...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Completadas */}
      {completedDownloads.size > 0 && (
        <div className="download-queue-section">
          <div className="download-queue-section-title">
            ✅ Completadas: {completedDownloads.size}
          </div>
          <div className="download-queue-items">
            {Array.from(completedDownloads.values()).slice(0, 3).map((item, idx) => (
              <div key={idx} className="download-queue-item completed">
                <div className="download-queue-item-icon">✅</div>
                <div className="download-queue-item-content">
                  <div className="download-queue-item-name">{item.wallpaper.title}</div>
                </div>
              </div>
            ))}
            {completedDownloads.size > 3 && (
              <div className="download-queue-more">
                +{completedDownloads.size - 3} más...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fallidas */}
      {failedDownloads.size > 0 && (
        <div className="download-queue-section">
          <div className="download-queue-section-title">
            ❌ Con errores: {failedDownloads.size}
          </div>
          <div className="download-queue-items">
            {Array.from(failedDownloads.values()).slice(0, 3).map((item, idx) => (
              <div key={idx} className="download-queue-item failed">
                <div className="download-queue-item-icon">❌</div>
                <div className="download-queue-item-content">
                  <div className="download-queue-item-name">{item.wallpaper.title}</div>
                  <div className="download-queue-item-error">{item.error}</div>
                </div>
              </div>
            ))}
            {failedDownloads.size > 3 && (
              <div className="download-queue-more">
                +{failedDownloads.size - 3} más...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Botón limpiar */}
      {(completedDownloads.size > 0 || failedDownloads.size > 0) && (
        <button className="download-queue-clear-btn" onClick={onClearCompleted}>
          Limpiar historial
        </button>
      )}
    </div>
  );
};

export default DownloadQueueMonitor;
