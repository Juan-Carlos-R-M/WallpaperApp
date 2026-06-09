# 🔧 Guía: Reparación de Wallpapers No Cargando

## Problema
Los wallpapers del Workshop no cargan al abrir la aplicación, o funcionan ocasionalmente pero al cerrar y volver a abrir deja de funcionar.

## ¿Qué lo causa?
El cache local (localStorage) se corrompe o contiene datos inválidos, impidiendo que la app cargue los wallpapers guardados.

## ✅ Soluciones

### Solución 1: Botón "Limpiar Cache" (AUTOMÁTICO)
Ahora la app detecta automáticamente el cache corrupto y lo limpia. 

**Si ves un error en la sección de Workshop:**
1. Verás dos botones: "Reintentar" y "Limpiar Cache"
2. Haz clic en **"Limpiar Cache"** (botón rojo)
3. La app limpiará el cache y reintentará cargar los wallpapers automáticamente

### Solución 2: Limpiar Manualmente (MANUAL)
Si quieres limpiar el cache manualmente:

#### En Windows (Electron Desktop App):
```batch
REM Abre un cmd y ejecuta esto:
for /d %i in (%APPDATA%\Wallpaper App*) do rd /s /q "%i"

REM O simplemente ve a:
%APPDATA%\Wallpaper App\
REM Y elimina la carpeta "data"
```

#### En el Navegador (Web):
Abre la consola del navegador (F12) y ejecuta:
```javascript
// Limpiar todo
localStorage.removeItem('wallpaperApp.workshopCache');
localStorage.removeItem('wallpaperApp.steamWallpapersCache');
console.log('Cache limpiado');
```

### Solución 3: Usar la Consola del Navegador (DEBUGGING)
1. Abre la app en el navegador
2. Presiona **F12** para abrir DevTools
3. Abre la pestaña **Console**
4. Ejecuta esto:
```javascript
// Ver diagnóstico del cache
import { debugCache } from './utils/cacheManager.js';
debugCache();
```

O ejecuta desde la consola:
```javascript
// Limpiar cache corrupto
localStorage.removeItem('wallpaperApp.workshopCache');
localStorage.removeItem('wallpaperApp.steamWallpapersCache');
location.reload(); // Recarga la página
```

## 🔍 Qué Cambió en v2.0.3

### Nuevas Validaciones:
✅ El cache ahora se valida completamente antes de usarse
✅ Los wallpapers inválidos no se guardan
✅ El cache corrupto se detecta y se elimina automáticamente

### Nuevos Botones en UI:
✅ Botón "Limpiar Cache" en mensajes de error
✅ Permite limpiar manualmente si es necesario

### Auto-Reparación:
✅ Si se detecta cache corrupto, se limpia automáticamente después de 3 segundos
✅ La app reintenta cargar automáticamente

## 📊 Cómo Verificar que Funciona

1. **Abre la app y accede a Steam Workshop**
2. **Espera a que cargue (o presiona "Actualizar")**
3. **Verifica que ves wallpapers en la galería**
4. **Cierra completamente la app**
5. **Abre de nuevo la app**
6. **Los wallpapers deberían estar cargados desde el cache**

### Si todo funciona:
✅ Los wallpapers cargan correctamente
✅ Se mantienen al cerrar y abrir la app
✅ No ves errores en la consola

## 💡 Tips Adicionales

### Forzar Actualización:
- Click en botón **"Actualizar"** (esquina superior derecha)
- La app buscará wallpapers nuevos y actualizará el cache

### Ver Logs Detallados:
1. Abre DevTools (F12)
2. Abre Console
3. Filtra por: `[SteamIntegration]`, `[Cache]`, `[Workshop]`

### Limpiar Todo (Nuclear Option):
Si todo falla, elimina TODOS los datos guardados:

En Windows Desktop:
```batch
rmdir /s /q "%APPDATA%\Wallpaper App"
```

En el navegador:
```javascript
// Elimina TODO el almacenamiento local
localStorage.clear();
sessionStorage.clear();
```

## ❓ FAQ

**P: ¿Perderé mis favoritos?**
R: No, los favoritos se guardan en `localStorage` con otra clave y no se tocan.

**P: ¿Cuánto tarda en limpiar el cache?**
R: Normalmente es instantáneo. Si hay error, espera 3 segundos.

**P: ¿Dónde se guardan los wallpapers?**
R: En `%APPDATA%\Wallpaper App\data\` (Windows Desktop)

**P: ¿Necesito reinstalar la app?**
R: No, simplemente limpia el cache. La app sigue funcionando normalmente.

## 🐛 Si Sigue Sin Funcionar

1. **Verifica que Wallpaper Engine está instalado** en Steam
2. **Revisa la consola** (F12 → Console) para ver errores específicos
3. **Intenta en una ventana privada/incógnito** (para descartar conflictos)
4. **Reinicia tu computadora** (a veces ayuda)
5. **Abre un Issue** con los logs de error

---

Última actualización: Junio 2026 (v2.0.3)
