/**
 * Servicio mejorado de descargas con reintentos y manejo de errores de Steam
 * Archivo: electron/downloadRetryService.js
 */

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 2000; // 2 segundos

class DownloadRetryService {
  constructor({ logger = () => {}, maxRetries = DEFAULT_MAX_RETRIES } = {}) {
    this.logger = logger;
    this.maxRetries = maxRetries;
    this.downloadHistory = new Map(); // Rastrear intentos de descarga
    this.failedDownloads = new Map(); // Rastrear descargas fallidas permanentemente
  }

  /**
   * Determina si un error es recuperable (debe reintentar)
   */
  isRecoverableError(error) {
    const message = (error?.message || '').toLowerCase();
    
    // Errores NO recuperables (no reintentar)
    if (message.includes('not available from this account') || message.includes('not available')) {
      return false; // Problema de licencia, no resolver con reintentos
    }
    
    if (message.includes('steam guard') || message.includes('2-factor')) {
      return false; // Requiere autenticación manual
    }
    
    if (message.includes('no username given') && message.includes('anonymous')) {
      return false; // Credenciales inválidas
    }

    // Errores RECUPERABLES (reintentar)
    if (message.includes('asyncjobfailed') || message.includes('connection')) {
      return true;
    }

    if (message.includes('timeout') || message.includes('lost connection')) {
      return true;
    }

    if (message.includes('server') || message.includes('temporarily')) {
      return true;
    }

    return false; // Por defecto, no reintentar
  }

  /**
   * Ejecutar descarga con reintentos automáticos
   */
  async downloadWithRetry(
    publishedFileId,
    downloadFn,
    {
      maxRetries = this.maxRetries,
      retryDelay = DEFAULT_RETRY_DELAY,
      onRetry = () => {},
      onFailed = () => {}
    } = {}
  ) {
    const historyKey = String(publishedFileId);
    let lastError = null;
    let attempts = 0;

    for (attempts = 1; attempts <= maxRetries; attempts++) {
      try {
        this.logger(`[DownloadRetry] Intento ${attempts}/${maxRetries} para ${publishedFileId}`);
        
        const result = await downloadFn();
        
        this.logger(`[DownloadRetry] ✅ Éxito en intento ${attempts}: ${publishedFileId}`);
        this.downloadHistory.set(historyKey, { status: 'success', attempts, timestamp: Date.now() });
        
        return { success: true, result, attempts };
      } catch (error) {
        lastError = error;
        
        this.logger(`[DownloadRetry] ❌ Error en intento ${attempts}/${maxRetries}: ${error.message}`);

        // Verificar si es recuperable
        if (!this.isRecoverableError(error)) {
          this.logger(`[DownloadRetry] Error NO recuperable: ${error.message}`);
          this.downloadHistory.set(historyKey, { 
            status: 'permanent-failure', 
            attempts, 
            error: error.message,
            timestamp: Date.now() 
          });
          this.failedDownloads.set(historyKey, { error, attempts });
          
          onFailed({ publishedFileId, error, attempts, isRecoverable: false });
          
          return { success: false, error, attempts, isRecoverable: false };
        }

        // Si es el último intento, no esperar
        if (attempts < maxRetries) {
          const delayMs = retryDelay * attempts; // Backoff exponencial
          this.logger(`[DownloadRetry] Esperando ${delayMs}ms antes del siguiente intento...`);
          
          onRetry({ publishedFileId, attempt: attempts, maxRetries, error });
          
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // Todos los intentos fallaron
    this.logger(`[DownloadRetry] ❌ Falló después de ${attempts} intentos: ${publishedFileId}`);
    this.downloadHistory.set(historyKey, { 
      status: 'failed', 
      attempts, 
      error: lastError?.message,
      timestamp: Date.now() 
    });
    this.failedDownloads.set(historyKey, { error: lastError, attempts });
    
    onFailed({ publishedFileId, error: lastError, attempts, isRecoverable: true });
    
    return { success: false, error: lastError, attempts, isRecoverable: true };
  }

  /**
   * Obtener historial de descarga
   */
  getDownloadHistory(publishedFileId) {
    return this.downloadHistory.get(String(publishedFileId));
  }

  /**
   * Obtener descargas fallidas
   */
  getFailedDownloads() {
    return Array.from(this.failedDownloads.entries()).map(([id, data]) => ({
      publishedFileId: id,
      ...data
    }));
  }

  /**
   * Limpiar historial
   */
  clearHistory() {
    this.downloadHistory.clear();
    this.failedDownloads.clear();
  }

  /**
   * Obtener resumen de estadísticas
   */
  getStats() {
    let successful = 0;
    let failed = 0;
    let totalAttempts = 0;

    for (const [, data] of this.downloadHistory) {
      if (data.status === 'success') successful++;
      else failed++;
      totalAttempts += data.attempts || 1;
    }

    return {
      successful,
      failed,
      total: this.downloadHistory.size,
      totalAttempts,
      averageAttemptsPerDownload: this.downloadHistory.size > 0 
        ? (totalAttempts / this.downloadHistory.size).toFixed(2)
        : 0
    };
  }
}

module.exports = DownloadRetryService;
