# 🎨 Wallpaper App - Versión de Escritorio

## ¡Tu aplicación Wallpaper App ahora es un .exe!

Esta es la versión de escritorio de Wallpaper App con soporte completo para:

- 🎮 **Integración Steam Wallpaper Engine** - Accede a tus wallpapers de Steam directamente
- 🎨 **Galería Local** - Gestiona tus propios wallpapers
- 🖼️ **Cambio de Fondo de Pantalla** - Establece fondos de pantalla con un clic
- 🚀 **Aplicación Nativa** - Ejecutable .exe para Windows

## 🚀 Instalación

### Opción 1: Ejecutable Portátil
Descarga `Wallpaper-App-Portable.exe` y ejecútalo directamente.

### Opción 2: Instalador
Descarga `Wallpaper-App-Setup.exe` e instálalo en tu sistema.

### Opción 3: Compilar tu propio .exe

```bash
# 1. Instalar dependencias
npm install

# 2. Ejecutar el script de build
npm run dist-win

# O en Windows, ejecutar:
.\build-exe.bat
```

Los ejecutables generados estarán en la carpeta `dist/`.

## 🎮 Usando Wallpaper Engine de Steam

1. Instala **Wallpaper Engine** desde Steam (es una aplicación de pago)
2. Descarga algunos wallpapers en Steam
3. Abre Wallpaper App
4. Ve a la pestaña **"🎮 Steam Wallpaper Engine"**
5. Haz clic en **"✓ Establecer como Fondo"** en cualquier wallpaper

## 📋 Requisitos

- **Windows 10 o posterior**
- **Node.js 18+** (solo para compilar)
- **Wallpaper Engine de Steam** (opcional, para integración de Steam)
- **MongoDB** (si usas la galería con backend)

## 🔧 Características Técnicas

### Backend Integrado
El servidor Express va incluido en el .exe, por lo que no necesitas instalarlo por separado.

### Optimización de Sistema
- Bajo consumo de RAM
- GPU acceleration optimizado
- Lazy loading de imágenes
- Infinite scroll eficiente

### Integración Windows
- Cambio de fondo de pantalla mediante Windows API
- Acceso al registro de Windows para detectar Steam
- Soporte para archivos locales

## 📱 Interfaz

### Galería
Explora wallpapers de tu base de datos:
- Búsqueda en tiempo real
- Filtrado por categoría
- Información detallada
- Descarga de archivos

### Steam Wallpaper Engine
Accede a tus wallpapers de Steam:
- Detección automática de Steam
- Listado de wallpapers instalados
- Establecer como fondo con un clic
- Filtrado por nombre o autor

## ⚙️ Desarrollo

### Estructura del Proyecto

```
electron/
├── main.js              # Proceso principal
├── preload.js           # Puente seguro
├── steamReader.js       # Integración Steam
└── wallpaperManager.js  # API cambio fondos

client/
└── src/
    ├── components/
    │   └── SteamIntegration.jsx  # UI de Steam
    └── styles/
        └── steam-integration.css
```

### IPC Handlers Disponibles

```javascript
// Obtener wallpapers de Steam
window.electronAPI.getSteamWallpapers()

// Establecer un wallpaper
window.electronAPI.setWallpaper(wallpaperPath)

// Obtener ruta de Steam
window.electronAPI.getSteamPath()

// Buscar wallpapers
window.electronAPI.searchSteamWallpapers(query)
```

## 🐛 Troubleshooting

### "Steam no encontrado"
- Instala Steam desde https://steampowered.com
- Verifica que Steam esté instalado en la ruta por defecto
- Si instalaste en otra ruta, la app intentará detectarla

### "Wallpaper Engine no encontrado"
- Instala Wallpaper Engine desde Steam
- Descarga al menos un wallpaper para que se cree la carpeta de proyectos
- Reinicia la aplicación

### El fondo no cambia
- En Windows, a veces requiere permisos administrativos
- Ejecuta como administrador: Click derecho → "Ejecutar como administrador"
- Verifica que el archivo sea una imagen válida (JPG, PNG, BMP)

### Error de PowerShell
- La aplicación usa PowerShell para cambiar fondos
- Verifica que PowerShell esté disponible en tu sistema
- Intenta ejecutar como administrador

## 📦 Distribución

Para compartir tu .exe compilado:

1. Coloca el archivo `.exe` en una carpeta vacía
2. Comparte toda la carpeta (contiene archivos de dependencias)
3. O comparte solo el `.exe` si incluye todos los recursos

## 🔐 Seguridad

- Ninguna información se envía a servidores externos
- Todo funciona localmente en tu máquina
- La integración con Steam solo lee archivos locales
- Los cambios de fondo se hacen a través de Windows API

## 📚 Recursos

- [Electron Docs](https://www.electronjs.org/docs)
- [Windows API Registry](https://docs.microsoft.com/en-us/windows/win32/sysinfo/registry)
- [Steam Wallpaper Engine](https://store.steampowered.com/app/431960)
- [PowerShell Docs](https://docs.microsoft.com/en-us/powershell/)

## 📄 Licencia

MIT - Eres libre de usar y modificar esta aplicación

---

¡Disfruta de tu aplicación de escritorio! 🚀
