# 📬 Sistema de Notificaciones Persistentes para Descargas

## ✅ Lo que se Implementó

El sistema de notificaciones ahora diferencia entre dos tipos:

### 1. **Notificaciones Normales** (Desaparecen automáticamente)
- Avisos rápidos
- Confirmaciones simples
- Duración: ~4 segundos
- Se ocultan automáticamente

### 2. **Notificaciones Persistentes** (Se quedan en la bandeja) ⭐
- Descargas en progreso
- Descargas completadas
- Errores de descarga
- **NO desaparecen automáticamente**
- Usuario debe cerrar manualmente
- Visible en todo momento en la bandeja

---

## 🔄 Flujo de Notificaciones de Descarga

```
1. Usuario hace clic en "Descargar"
                ↓
2. Wallpaper se agrega a la cola
   → Notificación: "Agregado a cola" (desaparece en 4s)
                ↓
3. Inicia descarga
   → Notificación: "Descargando..." (PERSISTENTE ⭐)
   → Icono giratorio en la bandeja 🔄
   → Contador de posición: (1/5)
                ↓
4. Durante la descarga
   → La notificación SE QUEDA en la bandeja
   → Muestra progreso en tiempo real
   → Usuario PUEDE VER el proceso completo
                ↓
5. Descarga termina (éxito o error)
   → Notificación actualiza: "✅ Descargado" (PERSISTENTE ⭐)
   → LA NOTIFICACIÓN SE QUEDA EN LA BANDEJA
   → Usuario la puede leer luego
   → Usuario la cierra manualmente con botón ✖
```

---

## 📍 Dónde Aparecen las Notificaciones

### Opción 1: Pila Flotante (Esquina Superior Derecha)
- Últimas 4 notificaciones
- Se mueven hacia arriba
- Descargas: Se quedan más tiempo (no desaparecen)
- Normales: Desaparecen en 4 segundos

### Opción 2: Bandeja de Notificaciones (Botón 🔔)
- **TODAS** las notificaciones aparecen aquí
- Persistentes: Se quedan indefinidamente
- Normales: Se quedan hasta el siguiente inicio de sesión
- Usuario puede eliminar cada una con botón ✖
- Usuario puede "Limpiar todo" para borrar todas

---

## 🎨 Visual de las Notificaciones en Bandeja

### Notificación de Descarga en Progreso:
```
🔄 Descargando...
Descargando: "Mi Wallpaper Favorito" (1/5)

Descargando (1/5)
┃ Mi Wallpaper Favorito
│ 📍 hace 2 minutos                              [✖]
```

### Notificación de Descarga Completada:
```
✅ Descarga completada
✅ "Mi Wallpaper" descargado exitosamente (1/5)

Completada
┃ Mi Wallpaper
│ 📍 hace 30 segundos                            [✖]
```

### Notificación de Error:
```
❌ Error en descarga
❌ Error descargando "Wallpaper": No disponible

Error
┃ Wallpaper
│ 📍 hace 5 segundos                             [✖]
```

---

## 🔑 Cambios de Código

### 1. **App.jsx** - Soporte para Notificaciones Persistentes

```javascript
// Las notificaciones con persistent: true NO se auto-ocultan
const isPersistent = notificationPayload.persistent === true 
                  || notificationPayload.type === 'progress';

// Si es persistente, NO ejecutar el setTimeout de ocultamiento
if (!isPersistent) {
  window.setTimeout(() => {
    // ... código de ocultamiento
  }, NOTIFICATION_VISIBLE_MS);
}
```

### 2. **useDownloadQueue.js** - Envía Notificaciones Persistentes

```javascript
// Todas las notificaciones de descarga son persistentes
onNotify({
  type: 'progress',
  persistent: true,  // ← CLAVE
  title: 'Descargando...',
  message: `Descargando: "${wallpaper.title}" (${position}/${totalInQueue})`,
  // ... resto de propiedades
});

onNotify({
  type: 'success',
  persistent: true,  // ← CLAVE
  title: 'Descarga completada',
  message: `✅ "${wallpaper.title}" descargado exitosamente`,
  // ... resto de propiedades
});
```

### 3. **header.css** - Animación de Progreso

```css
/* Icono giratorio para notificaciones de progreso */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.header-notification-card.progress .header-notification-icon i {
  animation: spin 1s linear infinite;
}
```

---

## 👤 Comportamiento del Usuario

### Escenario 1: Usuario Descargando 3 Wallpapers

```
Tiempo 0:00 - Click Descarga Wallpaper 1
├─ Cola: +1 wallpaper
├─ Notificación flotante: "Agregado a cola" (desaparece en 4s)
└─ Bandeja: No visible aún

Tiempo 0:05 - Click Descarga Wallpaper 2
├─ Cola: +1 wallpaper
├─ Notificación flotante: "Agregado a cola" (desaparece en 4s)
└─ Bandeja: No visible aún

Tiempo 0:10 - Se inicia primera descarga
├─ Notificación flotante: "🔄 Descargando..." (SE QUEDA)
├─ Bandeja: "🔄 Descargando Wallpaper 1 (1/3)" (SE QUEDA)
└─ Icono giratorio visible

Tiempo 0:15 - Click Descarga Wallpaper 3
├─ Cola: +1 wallpaper
├─ Notificación flotante: "Agregado a cola" (desaparece en 4s)
└─ Bandeja: "Agregado a cola" (visible)

Tiempo 1:30 - Wallpaper 1 completado
├─ Notificación anterior: Se actualiza en bandeja
├─ Bandeja: "✅ Wallpaper 1 descargado (1/3)" (SE QUEDA)
├─ Nueva notificación flotante: "✅ Completado" (desaparece)
└─ Se inicia descarga de Wallpaper 2

Tiempo 3:00 - Wallpaper 2 completado
├─ Similar al anterior
└─ Se inicia descarga de Wallpaper 3

Tiempo 5:00 - Wallpaper 3 completado
├─ Bandeja muestra 3 descargas completadas
├─ Resumen: "✅ 3 completadas, ❌ 0 con errores"
└─ Usuario puede ver todo el historial

RESULTADO EN BANDEJA:
┌─ Notificaciones ─────────────────────────────────────┐
│ [🔔 3 nuevas]                         [Limpiar todo] │
├──────────────────────────────────────────────────────┤
│ ✅ Wallpaper 1 descargado (1/3)               [✖]   │
│ ✅ Wallpaper 2 descargado (2/3)               [✖]   │
│ ✅ Wallpaper 3 descargado (3/3)               [✖]   │
│ ✅ Cola completada: 3 OK, 0 errores          [✖]   │
│ ℹ️ Agregado a cola...                          [✖]   │
│ ℹ️ Agregado a cola...                          [✖]   │
└──────────────────────────────────────────────────────┘
```

### Escenario 2: Usuario Navega Away Mientras Descarga

```
Estado 1: Descargando Wallpaper 1/3
├─ Usuario ve notificación en bandeja: "🔄 Descargando... (1/3)"
├─ Usuario navega a "Inicio" (sale de Steam)
├─ Notificación SIGUE VISIBLE en bandeja (arriba a la derecha)
└─ Buscador/Menu se cierran pero bandeja persiste

Estado 2: Descarga Completa
├─ Usuario ve notificación actualizada: "✅ Completado"
├─ Notificación SE QUEDA en bandeja
├─ Puede volver a Steam Workshop luego para continuar
└─ Puede limpiar bandeja cuando lo desee
```

---

## 🎯 Diferencias de Antes vs Después

| Aspecto | Antes | Después |
|---------|-------|---------|
| **Descargas visibles** | Desaparecían en 4s | Se quedan en bandeja |
| **Tipo de notificación** | Una sola (auto-oculta) | Dos tipos (normal + persistente) |
| **Progreso mostrado** | Solo pila flotante | Pila + bandeja |
| **Cuando termina** | Notificación desaparece | Notificación se queda |
| **Usuario puede** | Solo verla mientras aparece | Leerla cuando quiera |
| **Bandeja persistente** | No había distinción | Ahora sí |

---

## 📊 Cómo Funciona el Sistema Internamente

### Paso 1: Usuario hace click en descargar
```javascript
handleQueueDownload(wallpaper)
  → addToQueue(wallpaper)
  → onNotify({ type: 'info', message: 'Agregado a cola' })  // Desaparece
  → processQueue()
```

### Paso 2: Se inicia la descarga
```javascript
processQueue()
  → onNotify({
      type: 'progress',
      persistent: true,  // ← Esta es la clave
      message: 'Descargando...'
    })
  → App.jsx recibe la notificación
  → pushNotification() ve persistent: true
  → NO ejecuta setTimeout de ocultamiento
  → Notificación se queda en bandeja ✅
```

### Paso 3: Descarga completa o falla
```javascript
// Si éxito:
onNotify({
  type: 'success',
  persistent: true,  // ← Se queda
  message: '✅ Descargado'
})

// Si error:
onNotify({
  type: 'error',
  persistent: true,  // ← Se queda
  message: '❌ Error'
})
```

### Paso 4: Usuario interactúa
```javascript
// Usuario hace click en botón [✖]
onRemoveNotification(id)  // Solo entonces se borra
```

---

## 🔔 Resumen para el Usuario

✅ **Ahora verás todo el proceso de descarga en notificaciones**

1. **Mientras descarga** → Notificación en bandeja (se queda)
2. **Cuando termina** → Notificación actualizada (se queda)
3. **Puedes navegar** → La notificación te sigue
4. **Cuando quieras** → Cierras manualmente con [✖]

---

## 💡 Tips de Uso

1. **Ver progreso en tiempo real**
   - Click en botón 🔔 para abrir bandeja
   - Mira la notificación de progreso en vivo

2. **Dejar descargas y volver luego**
   - Las notificaciones se quedan en bandeja
   - Puedes volver a cualquier momento para verlas

3. **Borrar todo de una vez**
   - Botón "Limpiar" en bandeja
   - Borra todas las notificaciones

4. **Ver detalles de descarga**
   - Notificación muestra wallpaper + posición en cola
   - Ej: "Wallpaper X (2/5)" = segundo de 5

---

## 🐛 Solución de Problemas

### P: Las notificaciones desaparecen igual que antes
**R:** Recarga la página (Ctrl+R) o reinicia la app

### P: No aparecen en la bandeja
**R:** Mira en la esquina superior derecha (pila flotante)

### P: Aparecen demasiadas notificaciones
**R:** Usa botón "Limpiar todo" en bandeja para borrarlas

### P: Quiero cerrar una notificación rápido
**R:** Click en botón [✖] de la notificación

---

*Sistema implementado: Junio 7, 2026*  
*Wallpaper App v2.0 - Notificaciones Persistentes*
