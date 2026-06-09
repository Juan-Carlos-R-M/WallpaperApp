## 🔍 GUÍA DE DIAGNÓSTICO - Wallpapers No Cargan

### Situación Actual
Los wallpapers no se cargan en la sección Steam Workshop. He implementado herramientas de diagnóstico avanzadas para identificar EXACTAMENTE dónde está el problema.

---

## 🚀 PASO 1: Ejecutar Diagnóstico Automático

### En la App de Escritorio (Electron):

1. **Abre la consola del navegador:**
   - Presiona: `F12` o `Ctrl+Shift+I` (Windows)
   - Vete a la pestaña **Console**

2. **Copia y pega esto en la consola:**
   ```javascript
   window.diagnostics.runFullDiagnostic()
   ```

3. **Presiona Enter** y espera el resultado (puede tardar 15 segundos)

### Qué Verás:

El diagnóstico te mostrará 4 secciones:

```
✓ ELECTRON API CHECK        ← Verifica si Electron está disponible
✓ CACHE CHECK              ← Ve si hay datos en caché
✓ REACT STATE CHECK        ← Comprueba el estado de React
✓ API CALL TEST            ← Intenta descargar wallpapers reales
```

---

## 📊 INTERPRETAR LOS RESULTADOS

### Escenario 1: "✗ Electron API not available"
**Significa:** No estás en la versión de Escritorio Electron
**Solución:** Ejecuta la app desde el archivo `.exe` de Electron, no desde el navegador web

### Escenario 2: "✗ API Call failed"
**Significa:** Wallpaper Engine no está disponible en tu sistema
**Solución:** 
- Verifica que Wallpaper Engine esté instalado
- Verifica que esté ejecutándose (mira en procesos)
- Si no está instalado, descargar de: https://store.steampowered.com/app/431960/

### Escenario 3: "✓ API Response received" pero "data length: 0"
**Significa:** El API responde, pero no devuelve wallpapers
**Solución:**
- Verifica que Steam esté iniciado en tu cuenta
- Verifica que haya wallpapers en Steam Workshop
- Intenta limpiar el cache de Steam

### Escenario 4: Todo ✓ pero NO hay wallpapers en la UI
**Significa:** El problema es en la renderización, no en datos
**Solución:**
- Recarga la página (F5)
- Limpia el cache con: `window.diagnostics.clearAllCache()`
- Reinicia la app

---

## 🧹 PASO 2: Limpiar Cache (Si es Necesario)

Si sospechas que el cache está corrupto, ejecuta:

```javascript
window.diagnostics.clearAllCache()
```

Luego **recarga la página** (F5)

---

## 📝 PASO 3: Ver el Cache Guardado

Para ver qué datos se han guardado en caché:

```javascript
window.diagnostics.showCache()
```

Esto te mostrará:
- Cuántos wallpapers están guardados
- Información de cada wallpaper
- Cuándo se guardó

---

## 🔧 PASO 4: Logs de Consola

Los logs más importantes para buscar:

```
[SteamIntegration] 🚀 Iniciando búsqueda inicial...
[Workshop] 🔍 Buscando página 1...
[Workshop] ✅ Obtenidos X items. hasMore=Y
[Cache] 💾 Guardados X wallpapers válidos
```

**Filtrar en consola:**
1. Click en el filtro (funnel icon) en la consola
2. Escribe: `[SteamIntegration]` o `[Workshop]` o `[Cache]`
3. Ver solo esos logs

---

## 📋 CHECKLIST DE DIAGNÓSTICO

Marca los que funcionan:

- [ ] `window.diagnostics` existe y no hay errores
- [ ] Electron API es ✓ (Si es ✗ significa no estás en la app Electron)
- [ ] Cache check: al menos uno de workshop/steam debería existir
- [ ] API Call: es ✓ Y devuelve items > 0
- [ ] Los logs muestran "✅ Obtenidos X items"
- [ ] Los wallpapers aparecen en la UI

---

## 🆘 COMANDOS DE EMERGENCIA

Si nada funciona:

1. **Nuclear option - limpiar TODO:**
   ```javascript
   // Ejecuta esto en consola
   localStorage.clear()
   ```
   Recarga: `F5`

2. **Verificar que Wallpaper Engine responde:**
   ```javascript
   await window.electronAPI.getSteamWallpapers()
   ```

3. **Buscar datos directamente en API:**
   ```javascript
   const result = await window.diagnostics.testAPICall();
   console.table(result.data); // Ver wallpapers reales
   ```

---

## 📞 INFORMACIÓN PARA REPORTAR

Cuando reportes el bug, incluye:

1. Resultado de `window.diagnostics.runFullDiagnostic()`
2. Versión de Wallpaper Engine (en Steam)
3. Sistema Operativo (Windows versión)
4. Si en la consola ves errores en rojo
5. Captura de los logs de `[SteamIntegration]` y `[Workshop]`

---

## 🎯 Lo Que He Hecho Para Arreglarlo

### Cambios Recientes:
1. ✅ Mejorado `searchWorkshop()` para mostrar errores claros
2. ✅ Añadido validación de respuesta de API
3. ✅ Auto-limpiar cache si detecta estado corrupto
4. ✅ Efectos de React mejorados para evitar dependencias cíclicas
5. ✅ Herramienta de diagnóstico automática

### Lo Que Hace Ahora:
- Si no hay Electron API → Muestra error claro
- Si API falla → Intenta cargar desde cache
- Si respuesta es vacía → Muestra mensaje de error
- Si no hay wallpapers Y no hay error → Limpia cache Y reintenta automáticamente

---

## 📌 PRÓXIMOS PASOS

1. **Ejecuta el diagnóstico completo**
2. **Dame los resultados** (en particular la sección "API CALL TEST")
3. Basándome en eso, podré identificar exactamente dónde está el problema
4. Aplicaré la solución específica

El diagnóstico debería resolver el 80% de los problemas.
