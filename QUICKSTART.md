# 🚀 INICIO RÁPIDO - Wallpaper App

## 🌐 Versión Web

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Configurar Variables de Entorno

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

### 3. Iniciar la Aplicación

```bash
npm run dev
```

Acceder a: `http://localhost:3000`

### 4. Agregar Datos de Ejemplo (Opcional)

En una nueva terminal:

```bash
cd server
node seed.js
```

---

## 💻 Versión de Escritorio (.exe)

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Ejecutar en Modo Desarrollo (Electron + Web)

```bash
npm run dev
```

Esto inicia:
- Backend (Node.js) en puerto 5000
- Frontend (React) en puerto 3000
- Aplicación Electron

### 3. Compilar a .exe

```bash
# En Windows
.\build-exe.bat

# O usar npm
npm run dist-win
```

Los archivos compilados estarán en `dist/`:
- `Wallpaper-App-Setup.exe` (Instalador)
- `Wallpaper-App-Portable.exe` (Portátil)

### 4. Distribuir

Comparte el archivo `.exe` de `dist/` con otros usuarios.

---

## ✅ Verificación

### Versión Web
- **Backend**: http://localhost:5000/api/health
- **Frontend**: http://localhost:3000
- **API**: http://localhost:5000/api/wallpapers

### Versión Desktop
- Ejecutar el `.exe` desde `dist/`
- Debe abrir la ventana de Electron automáticamente

---

## 🎮 Usar Wallpaper Engine de Steam

1. Instala **Wallpaper Engine** desde Steam
2. Descarga algunos wallpapers en Steam
3. Abre Wallpaper App (web o desktop)
4. Ve a la pestaña **"🎮 Steam Wallpaper Engine"**
5. Haz clic en **"✓ Establecer como Fondo"**

> ⚠️ En versión web, cambiar fondos no funciona. Usa la versión .exe para esta función.

---

## 📝 Notas

- Asegúrate que MongoDB esté corriendo (si usas la galería con backend)
- Si puerto 3000 o 5000 está en uso, cambiar en `.env`
- Los estilos están optimizados para GPU
- Lazy loading automático de imágenes
- Infinite scroll habilitado

---

## 🛠️ Troubleshooting

### Error de conexión MongoDB
```bash
# Windows (si MongoDB está instalado como servicio)
Start-Service MongoDB

# Linux
sudo systemctl start mongod

# macOS
brew services start mongodb-community
```

### Puerto en uso
Cambiar `PORT` en `server/.env` a otro puerto disponible.

### Limpiar caché
```bash
rm -rf node_modules package-lock.json
npm install
```

### Error en build del .exe
Ver [BUILD-GUIDE.md](./BUILD-GUIDE.md) para solucionar problemas de compilación.

---

## 📚 Documentación Completa

- **[README.md](./README.md)** - Documentación del proyecto
- **[DESKTOP-APP.md](./DESKTOP-APP.md)** - Guía de la aplicación de escritorio
- **[BUILD-GUIDE.md](./BUILD-GUIDE.md)** - Guía detallada de compilación

---

¡Listo! La aplicación debe estar funcionando ahora. 🎉

**¿Primera vez?**
1. Comienza con `npm run dev` para probar en web
2. Luego compila a `.exe` cuando estés listo para distribuir

