# TODO - Favorites storage -> favorites.json (IPC)

## Step 1
- Revisión: confirmar dónde se lee/escribe favoritos.
- Hallar fallback de `localStorage` que pueda divergir del `favorites.json`.

## Step 2 (cambio principal)
- ✅ Editar `client/src/components/WallpaperCard.jsx`:
  - Eliminar lectura/fallback de `localStorage` para favoritos en modo Electron.
  - Asegurar que `isFavoriteState` se derive solo de la prop `isFavorite`.

## Step 3
- Editar `client/src/components/Gallery.jsx` (si aplica):
  - Asegurar que `isFavorite` llegue como boolean a `WallpaperCard` (desde IPC).
  - Cuando se haga toggle, recargar favorites desde IPC para evitar desincronización.

## Step 4
- Validación manual:
  - Agregar/Quitar favorito.
  - Confirmar que `AppData/Roaming/wallpaper-app-desktop/data/favorites.json` cambia.

