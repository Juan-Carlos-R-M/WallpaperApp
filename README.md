# 🎨 Wallpaper App

Una aplicación moderna de galería de wallpapers con soporte para imágenes, GIFs y videos, optimizada para bajo consumo de GPU. **Ahora disponible como aplicación de escritorio (.exe) con integración a Steam Wallpaper Engine.**

## ✨ Características

### 🖼️ Galería General
- **Galería Responsiva**: Grid adaptativo que se ajusta a cualquier dispositivo
- **Soporte Multimedia**: Imágenes, GIFs y videos en una sola galería
- **Optimización GPU**: Rendering eficiente con bajo consumo de recursos
- **Búsqueda y Filtros**: Busca wallpapers por texto o categoría
- **Lazy Loading**: Carga progresiva de imágenes bajo demanda
- **Infinite Scroll**: Carga automática de más wallpapers
- **Información Detallada**: Título, descripción, autor, calificación
- **Descarga Directa**: Descarga wallpapers en un clic

### 💻 Versión de Escritorio (.exe)
- **Integración Steam**: Accede directamente a tus wallpapers de Wallpaper Engine de Steam
- **Cambio de Fondo**: Establece fondos de pantalla con un clic desde la app
- **Aplicación Nativa**: Ejecutable .exe para Windows
- **Portátil**: No requiere instalación (versión portable)
- **Dark Theme**: Interfaz optimizada para la vista

## 🛠️ Arquitectura

```
Wallpaper-App/
├── electron/                 # Código Electron (escritorio)
│   ├── main.js              # Proceso principal
│   ├── preload.js           # Puente seguro
│   ├── steamReader.js       # Integración Steam
│   └── wallpaperManager.js  # Control de fondos Windows
├── server/                   # Backend Node.js/Express
│   ├── models/              # Modelos de base de datos (MongoDB)
│   ├── routes/              # Rutas API
│   ├── controllers/         # Lógica de negocios
│   └── index.js            # Servidor principal
├── client/                   # Frontend React + Vite
│   ├── src/
│   │   ├── components/      # Componentes React
│   │   │   ├── Gallery.jsx
│   │   │   ├── SteamIntegration.jsx  # Nuevo: Integración Steam
│   │   │   └── ...
│   │   ├── hooks/           # Custom React hooks
│   │   ├── styles/          # Estilos CSS
│   │   └── App.jsx          # Componente raíz
│   └── index.html           # HTML principal
├── build-exe.bat            # Script para compilar a .exe
├── BUILD-GUIDE.md           # Guía detallada de compilación
├── DESKTOP-APP.md           # Documentación app de escritorio
└── package.json             # Monorepo con workspaces
```

## 🚀 Instalación y Uso

### Requisitos
- Node.js 18+
- npm o yarn
- MongoDB (local o atlas)

### Setup

1. **Clonar y instalar**
```bash
cd Wallpaper-App
npm install
```

2. **Configurar variables de entorno**

**server/.env**
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/wallpaper-app
NODE_ENV=development
```

**client/.env**
```
VITE_API_BASE_URL=http://localhost:5000/api
VITE_ITEMS_PER_PAGE=12
```

3. **Ejecutar en desarrollo**
```bash
npm run dev
```

Esto iniciará:
- Backend en `http://localhost:5000`
- Frontend en `http://localhost:3000`

### Build para Producción

```bash
npm run build
```

Genera carpetas `build` en ambas aplicaciones.

### Compilar a Ejecutable .exe

Para crear una aplicación de escritorio distribuible:

```bash
# En Windows (recomendado)
.\build-exe.bat

# O usar npm
npm run dist-win
```

Los ejecutables estarán en la carpeta `dist/`:
- **Wallpaper-App-Setup.exe** - Instalador (recomendado para usuarios)
- **Wallpaper-App-Portable.exe** - Portátil (sin instalación necesaria)

Para más detalles, ver [BUILD-GUIDE.md](./BUILD-GUIDE.md)

## 🎮 Integración Steam Wallpaper Engine

La versión de escritorio (.exe) incluye integración con Wallpaper Engine de Steam:

### Requisitos
- Instalar **Wallpaper Engine** desde Steam (es una aplicación de pago)
- Descargar al menos un wallpaper en Steam

### Uso

1. Abre Wallpaper App (versión .exe)
2. Ve a la pestaña **"🎮 Steam Wallpaper Engine"**
3. Los wallpapers se cargarán automáticamente
4. Haz clic en **"✓ Establecer como Fondo"** para usar uno

### Características

- ✅ Detección automática de Steam Wallpaper Engine
- ✅ Listado de todos tus wallpapers instalados
- ✅ Establece fondos con un clic
- ✅ Búsqueda y filtrado de wallpapers
- ✅ Soporte para imágenes, GIFs y videos
- ✅ Vista previa de wallpapers

### Limitaciones

- En versión web, cambiar fondos de pantalla no está disponible (solo .exe)
- Requiere que Wallpaper Engine esté instalado
- Solo funciona en Windows 10+

Para más información, ver [DESKTOP-APP.md](./DESKTOP-APP.md)

## 📚 API Endpoints

### Wallpapers
- `GET /api/wallpapers` - Obtener wallpapers con paginación
- `GET /api/wallpapers/:id` - Obtener wallpaper específico
- `GET /api/wallpapers/featured` - Obtener wallpapers destacados
- `GET /api/wallpapers/category/:category` - Filtrar por categoría
- `POST /api/wallpapers` - Crear wallpaper
- `PUT /api/wallpapers/:id` - Actualizar wallpaper
- `DELETE /api/wallpapers/:id` - Eliminar wallpaper

### Query Parameters
- `page`: Número de página (default: 1)
- `limit`: Wallpapers por página (default: 12)
- `category`: Filtrar por categoría
- `search`: Buscar por texto
- `sort`: Campo para ordenar (default: -createdAt)

## 🎯 Optimizaciones de GPU

La aplicación implementa varias optimizaciones para minimizar el uso de GPU:

1. **Lazy Loading**: Las imágenes se cargan solo cuando son visibles
2. **Intersection Observer**: Detección eficiente de visibilidad
3. **Hardware Acceleration**: Uso de `will-change` y `transform: translateZ(0)`
4. **Backface Visibility**: Evita renderizado innecesario
5. **Video Optimization**: Videos mutados y con `playsInline`
6. **Responsive Images**: Previsualizaciones adaptativas
7. **CSS Animations**: Optimizadas con GPU acceleration

## 🏗️ Estructura de Datos

### Wallpaper Schema
```javascript
{
  title: String,
  description: String,
  author: String,
  category: String (nature|abstract|urban|technology|art),
  tags: [String],
  image: { url, width, height, size },
  preview: { url, width, height },
  mediaType: String (image|gif|video),
  mediaUrl: String,
  duration: Number,
  downloads: Number,
  rating: { average, count },
  featured: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## 🌐 Responsive Design

- **Desktop**: Grid de 4-5 columnas
- **Tablet**: Grid de 2-3 columnas
- **Mobile**: Grid de 1-2 columnas

## 📦 Dependencias Principales

### Server
- Express: Framework HTTP
- Mongoose: ODM para MongoDB
- CORS: Compartir recursos entre dominios
- Multer: Manejo de uploads
- Sharp: Procesamiento de imágenes

### Client
- React: UI library
- Vite: Build tool
- Axios: HTTP client
- Zustand: State management (preparado para uso futuro)

## 🔧 Desarrollo

### Agregar nuevos componentes

1. Crear archivo en `client/src/components/`
2. Importar y usar en otros componentes
3. Agregar estilos en `client/src/styles/`

### Agregar nuevas rutas API

1. Crear controlador en `server/controllers/`
2. Agregar ruta en `server/routes/`
3. Registrar en `server/index.js`

## 🚨 Troubleshooting

### MongoDB no conecta
```bash
# Verificar que MongoDB está corriendo
# Windows: mongodb es un servicio
# Linux: sudo systemctl start mongod
# macOS: brew services start mongodb-community
```

### Puerto en uso
```bash
# Cambiar puerto en .env
PORT=5001  # Usar otro puerto
```

### Node modules corrupto
```bash
rm -rf node_modules package-lock.json
npm install
```

## 📝 Licencia

MIT

## 👤 Autor

Wallpaper App Team

---

**Última actualización**: Mayo 2026
