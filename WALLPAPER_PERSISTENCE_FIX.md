# 🔧 Solución: Wallpapers No Persisten Después de Cerrar App

## Problema Reportado
- ❌ Los wallpapers desaparecen después de cerrar la app
- ❌ Al reabrir, no cargan los wallpapers
- ❌ Los detalles no se muestran
- ❌ Sin mecanismo de recuperación si falla la conexión

## Soluciones Implementadas

### 1. **Cache en localStorage (24 horas)**
Se agregaron funciones para guardar y recuperar wallpapers en cache:

```javascript
// Guardado automático después de cargar datos exitosamente
saveWorkshopCache(wallpapers, page)      // Wallpapers del Workshop
saveSteamWallpapersCache(wallpapers)     // Wallpapers descargados de Steam
```

**Ubicación**: `client/src/hooks/useSteamWorkshop.js` líneas 48-99

**Comportamiento**:
- Al cargar wallpapers exitosamente → guarda en cache
- El cache expira después de 24 horas
- Si falla la conexión → recupera del cache automáticamente

---

### 2. **Inicialización desde Cache**
Los arrays de estado ahora cargan desde cache al iniciar la app:

```javascript
const [steamWallpapers, setSteamWallpapers] = useState(
  () => loadSteamWallpapersCache() || []
);
const [workshopWallpapers, setWorkshopWallpapers] = useState(
  () => loadWorkshopCache() || []
);
```

**Ubicación**: `client/src/hooks/useSteamWorkshop.js` líneas 132-133

**Resultado**:
- ✅ Al abrir la app, ve los wallpapers del cache inmediatamente
- ✅ Mientras se carga, los datos en cache se muestran
- ✅ Mejor UX: menos "pantalla vacía"

---

### 3. **Retry Logic (3 intentos)**
`loadSteamWallpapers()` ahora reintenta automáticamente si falla:

```javascript
// Reintentos con backoff exponencial:
// Intento 1 → Inmediato
// Intento 2 → Espera 1 segundo
// Intento 3 → Espera 2 segundos
// Si falla → Carga desde cache
```

**Ubicación**: `client/src/hooks/useSteamWorkshop.js` líneas 170-245

**Cambios**:
- Reintento 1 después de 1000ms
- Reintento 2 después de 2000ms
- Si aún falla → recupera del cache
- Logs detallados para debugging

---

### 4. **Guardar Wallpapers del Workshop**
Cuando se obtienen resultados de búsqueda, se guardan en cache:

```javascript
// Después de cada búsqueda exitosa
if (!append && nextItems.length > 0) {
  saveWorkshopCache(nextItems, nextPage);
}
```

**Ubicación**: `client/src/hooks/useSteamWorkshop.js` línea 383

**Beneficio**: Si cierras la app durante la búsqueda, los datos que ya cargó quedan guardados.

---

### 5. **Fallback desde Cache en Búsqueda**
Si la búsqueda falla en primera página, intenta cargar desde cache:

```javascript
// En el catch de searchWorkshop
if (!overrides.append && !append) {
  const cached = loadWorkshopCache();
  if (cached && cached.length > 0) {
    // Recuperar resultados anteriores
    setWorkshopWallpapers(cached);
  }
}
```

**Ubicación**: `client/src/hooks/useSteamWorkshop.js` líneas 420-438

**Resultado**: 
- ✅ Si internet falla, muestra el cache en lugar de pantalla vacía
- ✅ Usuario puede seguir navegando contenido anterior
- ✅ Notificación clara: "Usando datos en caché"

---

## Cómo Funciona el Flujo Completo

```
┌─ Abre App
│
├─→ Cargar desde cache (localStorage)
│   ├─ workshopWallpapers = cache || []
│   └─ steamWallpapers = cache || []
│
├─→ Intentar actualizar desde servidor (IPC)
│   ├─ Intento 1: 0ms
│   ├─ Intento 2: +1000ms
│   └─ Intento 3: +2000ms
│
├─→ Si actualización exitosa
│   ├─ Actualizar estado
│   └─ Guardar nuevo cache
│
└─→ Si falla todo
    └─ Mostrar cache + mensaje de error

```

---

## Archivos Modificados

### `client/src/hooks/useSteamWorkshop.js`
- ✅ Nuevas constantes de cache: `WORKSHOP_CACHE_KEY`, `STEAM_WALLPAPERS_CACHE_KEY`
- ✅ Funciones: `saveWorkshopCache()`, `loadWorkshopCache()`, `saveSteamWallpapersCache()`, `loadSteamWallpapersCache()`
- ✅ Estado inicial desde cache
- ✅ `loadSteamWallpapers()` mejorado con retry logic
- ✅ `searchWorkshop()` guarda resultados en cache
- ✅ Fallback desde cache si falla la búsqueda

---

## Pruebas Recomendadas

### Test 1: Persistencia de Cache
1. Abre la app y espera a que cargue wallpapers
2. Abre DevTools (F12) → Console
3. Verifica que se guardó: `localStorage.getItem('wallpaperApp.workshopCache')`
4. Cierra la app completamente
5. Reabre la app → **Los wallpapers deben aparecer inmediatamente**

### Test 2: Sin Conexión
1. Abre la app (asegúrate que hay cache)
2. Desactiva internet (DevTools → Offline)
3. Cierra y reabre la app
4. **Los wallpapers del cache deben aparecer**

### Test 3: Retry Logic
1. Abre la app
2. Desactiva internet en el medio de la carga
3. Verifica en Console que intenta reconectar (puedes ver logs `[Steam] Intento`)
4. Reactiva internet
5. **Debe recuperarse automáticamente en el 2do o 3er intento**

### Test 4: Detalles del Wallpaper
1. Abre un wallpaper desde cache
2. Verifica que muestra todos los detalles (título, autor, descripción)
3. Click en detalles debe funcionar correctamente

---

## Monitoreo (DevTools Console)

Busca estos logs para verificar que funciona:

```javascript
// Guardando cache
[Workshop] 💾 Guardados X items en cache

// Recuperando cache
[Steam] ✅ 15 wallpapers cargados y guardados en cache
[Workshop] 📦 Error en búsqueda, recuperando X items desde cache

// Reintentos
[Steam] Intentando cargar wallpapers (intento 2/3)
[Steam] Reintentando en 1000ms...

// Errores
[Steam] Agotados 3 intentos, cargando desde cache...
```

---

## ¿Aún no funciona?

### Síntoma: Cache no se guarda
```javascript
// En Console, ejecuta:
JSON.parse(localStorage.getItem('wallpaperApp.workshopCache') || 'null')
```
Si retorna `null`, verifica que:
- ✅ Los wallpapers se cargaron exitosamente (no error)
- ✅ LocalStorage no está deshabilitado
- ✅ No hay restricciones en el navegador

### Síntoma: Detalles vacíos
- Abre DevTools → Console
- Filtra por `[SteamIntegration]` y busca errores
- Verifica que `wallpaper.publishedFileId` no está vacío

### Síntoma: Reintentos no funcionan
- Verifica que `steamService.getSteamWallpapers()` retorna data válida
- En Console: `await window.electronAPI?.getSteamWallpapers()`
- Debería retornar: `{ success: true, data: [...] }`

---

## Mejoras Futuras

Consideradas para próximas versiones:

- [ ] Sincronización con IndexedDB para más capacidad
- [ ] Cachés separados por usuario/Steam account
- [ ] Limpieza automática de cache cuando alcanza 10MB
- [ ] Indicador visual cuando se está usando cache vs datos frescos
- [ ] Opción manual de "Actualizar cache ahora"

---

**Última actualización**: 7 Junio 2026
**Versión fix**: 2.0.2
