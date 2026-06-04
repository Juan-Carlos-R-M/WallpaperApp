# CHANGELOG

## [2.0.0] - Mayo 2026

### 🔥 BREAKING CHANGES
- **ELIMINADA BASE DE DATOS MONGODB** - La aplicación ahora es completamente offline-first
- **ELIMINADO SERVIDOR BACKEND** - Ya no es necesario instalar/correr el backend
- **ELIMINADO WORKSPACE `/server`** - Estructura simplificada

### ✨ Nuevas Características
- **LocalStore para almacenamiento local** - Datos guardados en JSON local
- **IPC Communication** - Electron ↔ React via IPC sin HTTP
- **Auto-detección de ambiente** - La app detecta automáticamente si está en Electron o web
- **Almacenamiento en nube opcional** - Puede integrar OneDrive, Google Drive, etc. (futuro)

### 🔧 Cambios Técnicos

#### Nuevos Archivos
- `electron/localStore.js` - Gestor de almacenamiento local
- `client/src/services/electronStore.js` - Wrapper de IPC para LocalStore
- `client/src/services/wallpapersService.js` - Abstracción de datos
- `client/src/services/config.js` - Detección de ambiente
- `NO-DATABASE.md` - Documentación de cambios

#### Archivos Actualizados
- `electron/main.js` - Removido startBundledServer, agregados IPC handlers LocalStore
- `electron/preload.js` - Agregado método genérico `invoke()`
- `package.json` - Scripts simplificados, workspace reducido a solo client
- `client/package.json` - Sin cambios principales

#### Archivos Eliminados
- Todo el contenido de `/server` (no está disponible en distribución)

### 📊 Datos Almacenados Localmente
```
%APPDATA%/Wallpaper App Desktop/data/
├── wallpapers.json      # Wallpapers guardados
├── favorites.json       # Favoritos
└── settings.json        # Configuración
```

### 🔄 Migración

Si tienes datos en la BD antigua:
1. Exportar datos desde MongoDB
2. Convertir a formato JSON
3. Guardar en carpeta de datos local
4. Reiniciar la app

### ⚙️ Configuración

**Variables de entorno ELIMINADAS:**
- `MONGODB_URI`
- `PORT` (para el servidor)

**Variables de entorno MANTENIDAS (opcional para modo web):**
- `VITE_API_BASE_URL` - Solo si usas modo web

### 🚀 Scripts Nuevos
```bash
npm install-all       # Instalar dependencias (solo client ahora)
npm run dev           # Cliente dev mode
npm run dev-desktop   # Electron dev mode
npm run dev-full      # Ambos en paralelo
npm run build         # Build cliente
npm run dist-win      # Generar .exe
```

### 🧪 Testing
- Tests mantenidos para client
- Próximamente: tests para IPC

### 📝 Documentación
- Actualizado: README.md
- Nuevo: NO-DATABASE.md
- Nuevo: Este CHANGELOG

### 🐛 Bugs Solucionados
- Eliminada dependencia circular servidor/cliente
- Simplificado setup inicial
- Mejorada portabilidad del .exe

### 🎯 Próximas Mejoras
- [ ] Sincronización con OneDrive
- [ ] Sincronización con Google Drive
- [ ] Sincronización entre dispositivos
- [ ] Backup automático
- [ ] Historial de cambios
- [ ] Cloud sync en tiempo real

### ⚡ Rendimiento
- ✅ Startup más rápido (sin servidor)
- ✅ Menor consumo de memoria
- ✅ No requiere puerto extra (5000)
- ✅ Funciona sin internet (excepto Steam)

---

## [1.0.0] - Versión Original

### Características Principales
- Backend Node.js + Express + MongoDB
- Frontend React + Vite
- Integración Steam Wallpaper Engine
- Aplicación Desktop con Electron
- Soporte para Imágenes, GIFs, Videos

---

**Para más detalles, ver [NO-DATABASE.md](./NO-DATABASE.md)**
