<!-- Instrucciones personalizadas para el desarrollo de Wallpaper App -->

# Wallpaper App - Instrucciones de Desarrollo

## Descripción General

Aplicación full-stack de galería de wallpapers con:
- Backend: Node.js + Express + MongoDB
- Frontend: React + Vite + CSS optimizado
- Soporte para: Imágenes, GIFs, Videos
- Optimización: Bajo consumo de GPU, Lazy loading, Infinite scroll

## Convenciones del Proyecto

### Estructura de Carpetas
- `/server` - Backend Express
- `/client` - Frontend React
- Monorepo con npm workspaces

### Nombrado de Archivos
- Componentes React: `PascalCase.jsx` (ej: `WallpaperCard.jsx`)
- Hooks: `useHookName.js` (ej: `useWallpapers.js`)
- Estilos: `kebab-case.css` (ej: `wallpaper-card.css`)
- Controladores: `nameController.js`
- Modelos: `Name.js` (ej: `Wallpaper.js`)

### Commit Messages
- `feat:` - Nuevas características
- `fix:` - Correcciones de bugs
- `style:` - Cambios de estilo/formato
- `refactor:` - Refactorización sin cambio funcional
- `docs:` - Cambios de documentación

## Guía de Desarrollo

### Setup Inicial
1. `npm install` - Instalar dependencias
2. Crear archivos `.env` en `server/` y `client/`
3. `npm run dev` - Iniciar en modo desarrollo

### Scripts Disponibles
- `npm run dev` - Iniciar server + client
- `npm run build` - Build para producción
- `npm start` - Iniciar servidor (solo backend)
- `npm test` - Ejecutar tests

### Variables de Entorno

**server/.env**
- `PORT` - Puerto del servidor (default: 5000)
- `MONGODB_URI` - Conexión a MongoDB
- `NODE_ENV` - Entorno (development/production)

**client/.env**
- `VITE_API_BASE_URL` - URL base del API
- `VITE_ITEMS_PER_PAGE` - Items por página (default: 12)

## Estándares de Código

### React Components
- Usar componentes funcionales con hooks
- Memoizar componentes que se renderizan frecuentemente
- Usar `useCallback` para funciones pasadas como props
- Aplicar lazy loading donde sea posible

### CSS/Estilos
- Usar variables CSS para colores y transiciones
- Preferir CSS puro sobre framework
- Optimizar para GPU (will-change, transform)
- Mobile-first responsive design

### Backend
- Usar async/await en lugar de promises
- Validar entrada en controladores
- Incluir manejo de errores
- Usar índices en MongoDB para búsquedas

## Performance

### Optimizaciones Implementadas
1. **Lazy Loading**: Cargar imágenes bajo demanda
2. **Infinite Scroll**: Paginación automática
3. **Memoization**: React.memo para componentes
4. **GPU Acceleration**: CSS optimizado
5. **Code Splitting**: Bundling eficiente con Vite

### Monitoreo
- Usar DevTools del navegador para analizar
- Verificar Network tab para tamaño de requests
- Usar Lighthouse para auditorías

## Testing

- Test files: `*.test.js` o `*.spec.js`
- Framework: Vitest (preparado)
- Usar `@testing-library/react` para componentes

## Deployment

### Frontend (client/)
```bash
npm run build
# Copiar `dist/` a servidor web
```

### Backend (server/)
```bash
npm install --production
npm start
```

### Variables de Entorno en Producción
- Usar MongoDB Atlas
- Configurar CORS correctamente
- Usar HTTPS obligatorio
- Implementar rate limiting

## Debugging

### Backend
```bash
# Ver logs en desarrollo
NODE_ENV=development npm run dev

# Debug con inspector
node --inspect index.js
```

### Frontend
```bash
# React DevTools
# Redux DevTools (si se usa)
# Usar console.log/debugger
```

## Recursos Útiles

- [React Docs](https://react.dev)
- [Vite Docs](https://vitejs.dev)
- [MongoDB Docs](https://docs.mongodb.com)
- [Express Docs](https://expressjs.com)
- [MDN Web Docs](https://developer.mozilla.org)

## Contacto y Soporte

Para problemas o sugerencias, revisar la sección de Issues en GitHub.

---

Última actualización: Mayo 2026
