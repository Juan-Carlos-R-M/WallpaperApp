/**
 * DIAGNOSTIC TOOL - Ejecuta en consola del navegador
 * window.diagnostics.runFullDiagnostic()
 */

const diagnosticTool = {
  // Verificar Electron API
  checkElectronAPI: () => {
    console.log('\n=== ELECTRON API CHECK ===');
    const hasAPI = Boolean(window.electronAPI);
    console.log('✓ window.electronAPI exists:', hasAPI);
    
    if (hasAPI) {
      const methods = Object.keys(window.electronAPI);
      console.log('✓ Available methods:', methods);
      console.log('✓ searchWorkshopWallpapers available:', typeof window.electronAPI.searchWorkshopWallpapers === 'function');
      console.log('✓ getSteamWallpapers available:', typeof window.electronAPI.getSteamWallpapers === 'function');
    }
    return hasAPI;
  },

  // Verificar localStorage
  checkCache: () => {
    console.log('\n=== CACHE CHECK ===');
    try {
      const workshop = localStorage.getItem('wallpaperApp.workshopCache');
      const steam = localStorage.getItem('wallpaperApp.steamWallpapersCache');
      
      console.log('✓ Workshop cache exists:', !!workshop);
      if (workshop) {
        const data = JSON.parse(workshop);
        console.log('  - Items:', data.data?.length || 0);
        console.log('  - Page:', data.page);
        console.log('  - Timestamp:', new Date(data.timestamp).toLocaleString());
      }
      
      console.log('✓ Steam cache exists:', !!steam);
      if (steam) {
        const data = JSON.parse(steam);
        console.log('  - Items:', data.data?.length || 0);
        console.log('  - Timestamp:', new Date(data.timestamp).toLocaleString());
      }
    } catch (e) {
      console.error('✗ Cache error:', e.message);
    }
  },

  // Verificar React state (si el componente está montado)
  checkReactState: () => {
    console.log('\n=== REACT STATE CHECK ===');
    try {
      // Buscar el elemento raíz de React
      const root = document.querySelector('#root');
      if (!root) {
        console.error('✗ React root element not found');
        return;
      }

      // Intenta acceder a las props del componente
      const rootInstance = root._reactRootContainer || root.__reactContainer;
      console.log('✓ React root found');
      console.log('  - Root instance:', !!rootInstance);
    } catch (e) {
      console.warn('⚠ Cannot inspect React state directly (requires React DevTools)');
    }
  },

  // Prueba de llamada a API
  testAPICall: async () => {
    console.log('\n=== API CALL TEST ===');
    if (!window.electronAPI) {
      console.error('✗ Electron API not available');
      return;
    }

    try {
      console.log('📡 Calling searchWorkshopWallpapers...');
      const response = await window.electronAPI.searchWorkshopWallpapers({
        query: '',
        page: 1,
        limit: 12,
        sort: 'trend',
        time: '1y'
      });
      
      console.log('✓ API Response received');
      console.log('  - Type:', typeof response);
      console.log('  - Has data property:', !!response.data);
      console.log('  - Data length:', response.data?.length || 0);
      console.log('  - Has more:', response.hasMore);
      console.log('  - Total:', response.total);
      console.log('  - Full response:', response);
      
      return response;
    } catch (e) {
      console.error('✗ API Call failed:', e.message);
      console.error('  - Error type:', e.constructor.name);
      console.error('  - Full error:', e);
    }
  },

  // Verificar localStorage access
  checkLocalStorageAccess: () => {
    console.log('\n=== LOCALSTORAGE ACCESS CHECK ===');
    try {
      localStorage.setItem('diagnostics.test', 'ok');
      const value = localStorage.getItem('diagnostics.test');
      localStorage.removeItem('diagnostics.test');
      console.log('✓ localStorage write:', value === 'ok');
    } catch (e) {
      console.error('✗ localStorage error:', e.message);
    }
  },

  // Verificar console logs
  checkLogs: (filter = '') => {
    console.log('\n=== RECENT LOGS ===');
    // Nota: Esto es solo una demostración. Los logs reales se ven en la consola
    console.log('Filter: "[SteamIntegration]", "[Workshop]", "[Cache]", "[Steam]"');
    console.log('💡 Usa el filtro de la consola para ver logs de componentes específicos');
  },

  // Test completo
  runFullDiagnostic: async function() {
    console.clear();
    console.log('╔════════════════════════════════════════╗');
    console.log('║     WALLPAPER APP DIAGNOSTIC TOOL     ║');
    console.log('╚════════════════════════════════════════╝\n');
    
    this.checkElectronAPI();
    this.checkCache();
    this.checkReactState();
    this.checkLocalStorageAccess();
    this.checkLogs();
    
    console.log('\n=== RUNNING API TEST (Este puede tardar 15 segundos) ===');
    const apiResult = await this.testAPICall();
    
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  DIAGNOSTIC COMPLETE                 ║');
    console.log('╚════════════════════════════════════════╝\n');
    
    // Resumen
    console.log('📊 SUMMARY:');
    console.log('- Si Electron API = ✗, el problema es que no estás en versión Electron');
    console.log('- Si API Call = ✗, el problema es que Wallpaper Engine no está disponible');
    console.log('- Si Cache existe, los datos se deberían mostrar aunque el API falle');
    console.log('- Si todo = ✓ pero no hay wallpapers, el problema es en la renderización');
    
    return apiResult;
  },

  // Limpiar cache manualmente
  clearAllCache: () => {
    console.log('🧹 Limpiando todo el cache...');
    localStorage.removeItem('wallpaperApp.workshopCache');
    localStorage.removeItem('wallpaperApp.steamWallpapersCache');
    localStorage.removeItem('wallpaperApp.steamUsername');
    localStorage.removeItem('wallpaperApp.steamAccounts');
    console.log('✓ Cache limpiado. Recarga la página.');
  },

  // Mostrar cache completo
  showCache: () => {
    console.log('\n=== FULL CACHE CONTENTS ===');
    try {
      const workshop = localStorage.getItem('wallpaperApp.workshopCache');
      if (workshop) {
        const data = JSON.parse(workshop);
        console.log('Workshop Cache:');
        console.table(data.data?.slice(0, 5) || []);
      } else {
        console.log('No workshop cache');
      }
      
      const steam = localStorage.getItem('wallpaperApp.steamWallpapersCache');
      if (steam) {
        const data = JSON.parse(steam);
        console.log('\nSteam Cache:');
        console.table(data.data?.slice(0, 5) || []);
      } else {
        console.log('No steam cache');
      }
    } catch (e) {
      console.error('Error reading cache:', e);
    }
  }
};

// Exponer en window para acceso desde consola
if (typeof window !== 'undefined') {
  window.diagnostics = diagnosticTool;
  console.log('✓ Diagnostic tool ready. Use: window.diagnostics.runFullDiagnostic()');
}

export default diagnosticTool;
