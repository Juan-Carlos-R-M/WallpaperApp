# 🎨 Wallpaper App - Versión Sin Base de Datos

## 📋 Descripción

La aplicación Wallpaper App ha sido transformada a una **aplicación de escritorio pura** que **no requiere base de datos**. 

Ahora funciona completamente en Electron con:
- ✅ Almacenamiento local en archivos JSON
- ✅ Datos extraídos de Steam Cloud Workshop
- ✅ Sincronización automática
- ✅ Sin dependencias del servidor

---

## 🚀 Instalación y Uso

### 1. Instalación de Dependencias

```bash
cd c:\Users\charly\Downloads\Wallpaper-App
npm install
```

### 2. Desarrollo Local

```bash
# Terminal 1 - Iniciar cliente React
npm run dev

# Terminal 2 - Iniciar Electron (desde raíz del proyecto)
npm run dev-desktop

# O combinar ambas (requiere concurrently)
npm run dev-full
```

### 3. Compilar a Ejecutable .exe

```bash
# Build del cliente
npm run build

# Generar ejecutable (Windows)
npm run dist-win

# O ejecutar el script batch
.\build-exe.bat
```

El archivo `.exe` estará en la carpeta `dist/`

---

## 💾 Almacenamiento de Datos

### Estructura Local

Los datos se guardan en:
```
%APPDATA%\Wallpaper App Desktop\data\
├── wallpapers.json      # Wallpapers guardados/favoritos
├── favorites.json       # Lista de favoritos
└── settings.json        # Configuración de la app
```

### Archivos Descargados

Los wallpapers descargados se guardan en:
```
%USERPROFILE%\Downloads\
```

---

## 🌐 Integración con Steam Cloud

La aplicación puede:

1. **Leer wallpapers de Steam Wallpaper Engine**
   - Accede a tus wallpapers instalados en Steam
   - Lee metadatos (autor, título, etc.)

2. **Descargar desde Steam Workshop**
   - Buscar wallpapers en la comunidad Steam
   - Descargar directamente a la app
   - Gestionar descargas

3. **Sincronizar cambios**
   - Los cambios se guardan automáticamente
   - Sin dependencias de internet (excepto para descargas)

---

## 📁 Estructura del Proyecto

```
Wallpaper-App/
├── electron/                    # Proceso principal de Electron
│   ├── main.js                 # Punto de entrada
│   ├── preload.js              # API expuesta a React
│   ├── localStore.js           # Almacenamiento local
│   ├── steamReader.js          # Lee datos de Steam
│   ├── workshopService.js      # Descarga de Steam Workshop
│   ├── wallpaperManager.js     # Gestor de fondos de pantalla
│   └── accountStore.js         # Gestión de cuentas Steam
├── client/                      # Cliente React + Vite
│   ├── src/
│   │   ├── services/
│   │   │   ├── electronStore.js     # IPC para LocalStore
│   │   │   ├── wallpapersService.js # Abstracción de datos
│   │   │   ├── config.js            # Detección de ambiente
│   │   │   └── api.js               # URLs de API
│   │   ├── components/          # Componentes React
│   │   ├── pages/               # Páginas
│   │   └── App.jsx              # Componente raíz
│   └── vite.config.js           # Configuración Vite
├── package.json                 # Configuración raíz + Electron
└── build-exe.bat                # Script para compilar

❌ ELIMINADO: /server/          # Ya no se necesita
```

---

## 🔧 Características Técnicas

### IPC (Inter-Process Communication)

La app usa IPC de Electron para comunicación entre procesos:

```javascript
// Ejemplo desde React
import { electronStore } from './services/electronStore.js';

// Obtener wallpapers guardados
const wallpapers = await electronStore.getWallpapers();

// Agregar a favoritos
await electronStore.addFavorite(wallpaper);

// Actualizar configuración
await electronStore.updateSettings({ theme: 'light' });
```

### Detección Automática

La app detecta automáticamente si está en Electron:

```javascript
import { wallpapersService } from './services/wallpapersService.js';

// Usa LocalStore en Electron, localStorage en web
const wallpapers = await wallpapersService.getAllWallpapers();
```

### Handlers Disponibles

- `local-store-get-wallpapers` - Obtener todos los wallpapers
- `local-store-save-wallpaper` - Guardar un wallpaper
- `local-store-delete-wallpaper` - Eliminar un wallpaper
- `local-store-get-favorites` - Obtener favoritos
- `local-store-add-favorite` - Agregar a favoritos
- `local-store-remove-favorite` - Remover de favoritos
- `local-store-search` - Buscar wallpapers
- `local-store-get-settings` - Obtener configuración
- `local-store-update-settings` - Actualizar configuración
- `local-store-get-stats` - Obtener estadísticas

---

## 📊 Datos Disponibles

### Steam Wallpaper Engine
- Wallpapers instalados localmente
- Información del autor
- Descargas desde Steam Workshop
- Control de actualizaciones

### Almacenamiento Local
- Wallpapers favoritos
- Configuración personalizada
- Historial de búsquedas (futuro)
- Estadísticas de uso (futuro)

---

## 🔐 Variables de Entorno

Ya **NO se necesitan** estas variables (servidor eliminado):
- ~~`MONGODB_URI`~~ ❌
- ~~`PORT`~~ ❌
- ~~`VITE_API_BASE_URL`~~ ❌

Solo mantén si usas modo web:
- `VITE_API_BASE_URL` - URL de API (por defecto: localhost:5000)

---

## 📝 Scripts Disponibles

```bash
# Desarrollo
npm install-all       # Instalar todas las dependencias
npm run dev           # Iniciar cliente React (dev)
npm run dev-desktop   # Iniciar Electron
npm run dev-full      # Ambos en paralelo

# Build
npm run build         # Build del cliente
npm run electron-build # Build con Electron
npm run dist-win      # Generar .exe para Windows
npm run pack          # Empaquetar sin instalar

# Otros
npm test              # Tests
npm run electron-dev  # Solo Electron en dev
```

---

## 🎯 Flujo de Datos

```
┌─────────────────────────────────────────┐
│   React Components                      │
│   (UI/Gallery/Search)                   │
└────────────────┬────────────────────────┘
                 │
                 ↓
        ┌────────────────────┐
        │ wallpapersService  │  ← Auto-detecta ambiente
        └────┬───────────────┘
             │
      ┌──────┴──────┐
      ↓             ↓
   ELECTRON      WEB/HTTP
   (IPC)         (axios)
      │             │
      ↓             ↓
   LocalStore   Backend API
   (JSON)       (no existe)
   
Local Data:
- Wallpapers
- Favorites
- Settings

Steam Data:
- Installed wallpapers
- Workshop items
- Author info
```

---

## 🐛 Troubleshooting

### "Electron API no disponible"
- Solo ocurre en modo web (sin Electron)
- Usa `wallpapersService` que auto-detecta el ambiente

### "No se pueden guardar cambios"
- Verifica permisos en `%APPDATA%\Wallpaper App Desktop\`
- Reinicia la aplicación

### "Steam no encontrado"
- Steam debe estar instalado en tu PC
- Wallpaper Engine es opcional pero recomendado

---

## 📚 Documentación Adicional

- [BUILD-GUIDE.md](./BUILD-GUIDE.md) - Guía de compilación
- [DESKTOP-APP.md](./DESKTOP-APP.md) - Documentación de desktop
- [README.md](./README.md) - Inicio rápido

---

## ✅ Estado del Proyecto

- ✅ Eliminada dependencia de MongoDB
- ✅ Eliminado servidor backend
- ✅ LocalStore implementado
- ✅ IPC configurado
- ✅ Detección de ambiente automática
- ✅ Steam integration mantiene
- ✅ Almacenamiento local funcional
- 🔄 Próximo: Tests y optimizaciones

---

**Versión:** 2.0.0 (Sin BD)  
**Última actualización:** Mayo 2026  
**Autor:** Wallpaper App Team
