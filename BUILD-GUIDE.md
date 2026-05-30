# 🛠️ Guía de Construcción del .exe

## Requisitos Previos

Antes de compilar, asegúrate de tener instalado:

1. **Node.js 18+** - https://nodejs.org
2. **Git** (opcional) - https://git-scm.com
3. **Python 3.x** (requerido por electron-builder) - https://www.python.org
4. **Build Tools para Visual Studio** (para compilación nativa)

### En Windows

```powershell
# Instalar herramientas de build (run como Admin)
npm install --global windows-build-tools

# O instalar desde Visual Studio Community:
# https://visualstudio.microsoft.com/community/
```

## Paso 1: Preparación

```bash
# Clonar o navegar al proyecto
cd Wallpaper-App

# Instalar todas las dependencias
npm install
```

## Paso 2: Configurar Variables de Entorno

**server/.env**
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/wallpaper-app
NODE_ENV=production
```

**client/.env**
```
VITE_API_BASE_URL=http://localhost:5000/api
VITE_ITEMS_PER_PAGE=12
```

## Paso 3: Compilar Frontend

```bash
npm run build --workspace=client
```

Esto generará la carpeta `client/dist` con los archivos optimizados.

## Paso 4: Compilar con Electron Builder

### En Windows (PowerShell - Como Administrador)

```powershell
# Opción 1: Usar el script bat
.\build-exe.bat

# Opción 2: Manual
npm run dist-win
```

### En Línea de Comandos

```bash
npm run dist
```

## Paso 5: Encontrar el Ejecutable

Los archivos compilados estarán en:

```
dist/
├── Wallpaper-App-Setup-1.0.0.exe    (Instalador)
├── Wallpaper-App-1.0.0-Portable.exe (Portátil)
└── builder-effective-config.yaml    (Configuración)
```

## Optimizaciones de Build

### Tamaño de Archivo

Para reducir el tamaño del ejecutable:

```bash
# En package.json, sección "build":
"asar": true,          # Comprime los archivos
"asarUnpack": ["**"]   # Para archivos específicos
```

### Firma Digital (Avanzado)

Si necesitas firmar el ejecutable:

```javascript
// En package.json
"build": {
  "win": {
    "certificateFile": "path/to/cert.pfx",
    "certificatePassword": "password",
    "signingHashAlgorithms": ["sha256"]
  }
}
```

## Distribución

### Opción 1: Compartir el Instalador

```
Wallpaper-App-Setup-1.0.0.exe
```

Los usuarios pueden instalarlo como cualquier otra aplicación de Windows.

### Opción 2: Compartir la Versión Portátil

```
Wallpaper-App-1.0.0-Portable.exe
```

No requiere instalación, solo ejecutar.

### Opción 3: Comprimido

```bash
# Comprimir en ZIP
Compress-Archive -Path "dist/Wallpaper-App-Setup-1.0.0.exe" -DestinationPath "Wallpaper-App-v1.0.0.zip"
```

## Troubleshooting

### Error: "Python not found"
```powershell
npm install --global python-3.x.x
```

### Error: "Visual Studio Build Tools not found"
Descarga desde: https://visualstudio.microsoft.com/downloads/
- Instala "Desktop development with C++"

### Error: "node-gyp rebuild failed"
```bash
# Reinstalar dependencias nativas
npm rebuild
npm install --build-from-source
```

### El ejecutable es muy grande
- Verificar que `NODE_ENV=production`
- Eliminar carpetas `node_modules` innecesarias
- Usar `asar` para compresión

## Testing Pre-Build

Antes de compilar el .exe final:

```bash
# Probar la app en modo desarrollo
npm run dev

# O probar solo Electron
npm run electron-dev
```

## Actualización de Versión

Para cada nueva compilación:

1. Actualizar versión en `package.json`
2. Actualizar versión en `electron/main.js` (si aplica)
3. Agregar notas de cambios
4. Compilar nuevamente

```bash
# En package.json
{
  "version": "1.0.1"  // Incrementar versión
}
```

## CI/CD Automático (Avanzado)

Usar GitHub Actions para compilar automáticamente:

```yaml
# .github/workflows/build.yml
name: Build Desktop App

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build --workspace=client
      - run: npm run dist
      - uses: actions/upload-artifact@v2
        with:
          name: dist
          path: dist/
```

## Notas Importantes

- ✅ El servidor Express está incluido en el .exe
- ✅ No necesita instalación adicional de dependencias
- ✅ Funciona en Windows 10 en adelante
- ⚠️ La primera ejecución puede tomar más tiempo (descompresión de archivos)
- ⚠️ Requiere acceso a puerto 5000 para el servidor

## Soporte

Si tienes problemas:

1. Verifica los logs: `%APPDATA%\Wallpaper-App\logs`
2. Ejecuta como administrador
3. Revisa la consola de desarrollador (F12 cuando está abierta)

---

¡Listo para crear tu .exe! 🚀
