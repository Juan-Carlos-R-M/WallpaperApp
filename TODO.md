# TODO - Optimización aplicación

## Paso 1: Investigación (ya hecho parcialmente)
- [x] Revisar componentes críticos: App, Home, WallpaperDetails, WallpaperCard, RecommendedWallpapers
- [x] Encontrar causa probable del problema de scroll/lazy-load en Gallery (IntersectionObserver + loading/hasMore)

## Paso 2: Cambios implementados (optimización)
- [x] `workshopRecommendations.js`: caché TTL **5 min** + dedupe **inflight**
- [x] `WallpaperDetails.jsx`: throttling `video onTimeUpdate` (~**200ms**)
- [x] `Gallery.jsx`: evitar inconsistencias del loader cuando el observer dispara rápido y cortar si nextPage vacío

## Paso 3: Pendiente / siguiente iteración
- [ ] Ajustar `WallpaperCard.jsx` (si hace falta) para eliminar renders extra por dependencias
- [ ] Verificar virtualización/paginación si Gallery tiene miles de items

## Paso 4: Validación
- [x] `npm run build` OK

