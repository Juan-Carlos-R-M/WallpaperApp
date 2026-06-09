// Copia y pega esto en la consola del navegador (F12 > Console) para hacer debugging

// 1. Ver estado actual del cache
console.log('=== CACHE STATUS ===');
console.log('Workshop Cache:', localStorage.getItem('wallpaperApp.workshopCache')?.substring(0, 100) || 'EMPTY');
console.log('Steam Cache:', localStorage.getItem('wallpaperApp.steamWallpapersCache')?.substring(0, 100) || 'EMPTY');

// 2. Limpiar TODO el cache
function nukeCache() {
  localStorage.removeItem('wallpaperApp.workshopCache');
  localStorage.removeItem('wallpaperApp.steamWallpapersCache');
  localStorage.removeItem('wallpaperApp.workshopSearchState');
  console.log('✅ CACHE LIMPIADO. Recarga la página...');
  setTimeout(() => location.reload(), 1000);
}

// 3. Ver logs detallados
function showLogs() {
  const messages = [];
  
  // Interceptar console.log para capturar logs
  const origLog = console.log;
  console.log = function(...args) {
    messages.push(args.join(' '));
    origLog.apply(console, args);
  };
  
  console.log('📊 Logs capturados en últimos 30s:');
  setTimeout(() => {
    const relevant = messages.filter(m => 
      m.includes('[Steam]') || 
      m.includes('[Workshop]') || 
      m.includes('[Cache]') ||
      m.includes('[SteamIntegration]')
    );
    relevant.forEach(m => console.log(m));
  }, 30000);
}

// 4. Forzar recarga de wallpapers
function forceReload() {
  console.log('🔄 Forzando recarga...');
  localStorage.removeItem('wallpaperApp.workshopCache');
  location.reload();
}

// 5. Ver error actual
function checkError() {
  const error = localStorage.getItem('wallpaperApp.lastError');
  console.log('📋 Último error guardado:', error || 'NINGUNO');
}

// USAR:
// nukeCache()     - Limpia todo y recarga
// forceReload()   - Fuerza descarga sin cache
// showLogs()      - Ver logs de últimos 30s
// checkError()    - Ver último error
