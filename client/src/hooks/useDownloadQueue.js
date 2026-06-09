import { useCallback, useRef, useState, useEffect } from 'react';
import { getWallpaperId } from '../features/steamWorkshop/workshopUtils';

/**
 * Hook para gestionar una cola de descargas
 * Permite encolar múltiples descargas y procesarlas una por una
 */
export const useDownloadQueue = (onNotify = () => {}) => {
  const [downloadQueue, setDownloadQueue] = useState([]);
  const [activeDownload, setActiveDownload] = useState(null);
  const [completedDownloads, setCompletedDownloads] = useState(new Map());
  const [failedDownloads, setFailedDownloads] = useState(new Map());
  const queueRef = useRef([]);
  const processingRef = useRef(false);
  const downloadFunctionRef = useRef(null);

  // Agregar un wallpaper a la cola
  const addToQueue = useCallback((wallpaper) => {
    const wallpaperId = getWallpaperId(wallpaper);
    
    if (!wallpaperId) {
      console.warn('[DownloadQueue] Wallpaper sin ID:', wallpaper);
      return false;
    }

    // Evitar duplicados en la cola
    if (queueRef.current.some(w => getWallpaperId(w) === wallpaperId)) {
      console.log(`[DownloadQueue] ⚠️ ${wallpaper.title} ya está en la cola`);
      onNotify({
        type: 'warning',
        title: 'Ya en cola',
        message: `"${wallpaper.title}" ya está en la cola de descargas`
      });
      return false;
    }

    // Evitar si ya está descargado
    if (completedDownloads.has(wallpaperId)) {
      console.log(`[DownloadQueue] ✅ ${wallpaper.title} ya fue descargado`);
      onNotify({
        type: 'info',
        title: 'Ya descargado',
        message: `"${wallpaper.title}" ya fue descargado exitosamente`
      });
      return false;
    }

    queueRef.current.push(wallpaper);
    setDownloadQueue([...queueRef.current]);

    const position = queueRef.current.length;
    console.log(`[DownloadQueue] ➕ ${wallpaper.title} agregado a cola (posición: ${position})`);
    
    // Solo enviar notificación si hay más de 1 en la cola
    if (position > 1) {
      onNotify({
        type: 'info',
        title: 'Agregado a cola',
        message: `"${wallpaper.title}" agregado a la cola (posición: ${position}/${queueRef.current.length})`,
        wallpaper
      });
    }

    return true;
  }, [completedDownloads, onNotify]);

  // Remover de la cola
  const removeFromQueue = useCallback((wallpaperId) => {
    const index = queueRef.current.findIndex(w => getWallpaperId(w) === wallpaperId);
    if (index > -1) {
      queueRef.current.splice(index, 1);
      setDownloadQueue([...queueRef.current]);
    }
  }, []);

  // Limpiar cola
  const clearQueue = useCallback(() => {
    queueRef.current = [];
    setDownloadQueue([]);
  }, []);

  // Establecer la función de descarga
  const setDownloadFunction = useCallback((fn) => {
    downloadFunctionRef.current = fn;
  }, []);

  // Procesar la cola
  const processQueue = useCallback(async () => {
    if (processingRef.current || !downloadFunctionRef.current) {
      return;
    }

    processingRef.current = true;

    while (queueRef.current.length > 0) {
      const wallpaper = queueRef.current[0];
      const wallpaperId = getWallpaperId(wallpaper);

      try {
        setActiveDownload(wallpaper);
        const totalInQueue = downloadQueue.length;
        const currentIndex = queueRef.current.findIndex(w => getWallpaperId(w) === wallpaperId);
        const position = currentIndex + 1;

        onNotify({
          type: 'progress',
          persistent: true,
          title: 'Descargando...',
          message: `Descargando: "${wallpaper.title}" (${position}/${totalInQueue})`,
          status: `Descargando (${position}/${totalInQueue})`,
          wallpaper,
          progress: (position - 1) / totalInQueue
        });

        console.log(`[DownloadQueue] 📥 Iniciando descarga ${position}/${totalInQueue}: ${wallpaper.title}`);

        // Llamar la función de descarga
        await downloadFunctionRef.current(wallpaper);

        // Marcar como completado
        setCompletedDownloads(prev => new Map(prev).set(wallpaperId, {
          wallpaper,
          timestamp: Date.now(),
          status: 'completed'
        }));

        onNotify({
          type: 'success',
          persistent: true,
          title: 'Descarga completada',
          message: `✅ "${wallpaper.title}" descargado exitosamente (${position}/${totalInQueue})`,
          status: 'Completada',
          wallpaper
        });

        console.log(`[DownloadQueue] ✅ Descarga completada: ${wallpaper.title}`);
      } catch (error) {
        // Marcar como fallido
        setFailedDownloads(prev => new Map(prev).set(wallpaperId, {
          wallpaper,
          error: error.message,
          timestamp: Date.now(),
          status: 'failed'
        }));

        onNotify({
          type: 'error',
          persistent: true,
          title: 'Error en descarga',
          message: `❌ Error descargando "${wallpaper.title}": ${error.message}`,
          status: 'Error',
          wallpaper
        });

        console.error(`[DownloadQueue] ❌ Error descargando: ${error.message}`);
      } finally {
        // Remover de la cola
        queueRef.current.shift();
        setDownloadQueue([...queueRef.current]);
        
        // Esperar 1 segundo antes de la siguiente descarga
        if (queueRef.current.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    setActiveDownload(null);
    processingRef.current = false;

    // Resumen final
    const completed = completedDownloads.size;
    const failed = failedDownloads.size;
    if (completed > 0 || failed > 0) {
      onNotify({
        type: 'info',
        persistent: true,
        title: 'Cola de descargas completada',
        message: `✅ ${completed} completadas, ❌ ${failed} con errores`
      });
    }
  }, [downloadQueue.length, completedDownloads, failedDownloads, onNotify]);

  return {
    downloadQueue,
    activeDownload,
    completedDownloads,
    failedDownloads,
    addToQueue,
    removeFromQueue,
    clearQueue,
    setDownloadFunction,
    processQueue,
    isProcessing: processingRef.current,
    queueLength: queueRef.current.length
  };
};
