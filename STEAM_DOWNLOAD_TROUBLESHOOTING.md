# Solución de problemas - Descargas de Steam

## Error: "Depot 431960 is not available from this account"

Este error significa que **Wallpaper Engine no está disponible** para la cuenta de Steam que intentas usar.

### Causas comunes:

1. **La cuenta NO compró Wallpaper Engine**
   - El juego cuesta dinero en Steam
   - Debes tener licencia activa en esa cuenta

2. **Credenciales incorrectas**
   - Usuario o contraseña equivocados
   - Estás usando una cuenta diferente a la que compró Wallpaper Engine

3. **Problemas de sesión de Steam**
   - Sesión expirada
   - Steam Guard requiere verificación
   - Restricciones de acceso

### Soluciones paso a paso:

#### 1. Verifica que tienes Wallpaper Engine
- Abre Steam
- Busca "Wallpaper Engine"
- Verifica que aparezca en tu **Librería**
- Si no está, necesitas comprarlo primero

#### 2. Usa las credenciales correctas
- En la app, abre el **modal de descarga**
- Ingresa **Usuario de Steam** (nombre de usuario, NOT email)
- Ingresa **Contraseña de Steam** correcta
- Verifica que no haya espacios en blanco al principio o final

#### 3. Si tienes Steam Guard activado
- Opciones:
  - **A)** Desactiva temporalmente Steam Guard
  - **B)** Usa una **contraseña de app específica**:
    1. Ve a tu cuenta de Steam
    2. Seguridad → Contraseña de aplicación
    3. Crea una nueva contraseña para esta app
    4. Usa esa contraseña en lugar de tu contraseña normal

#### 4. Reinicia todo
```
1. Cierra completamente Steam
2. Cierra la app de Wallpaper
3. Reabre la app
4. Intenta descargar nuevamente
```

#### 5. Si nada funciona
- Abre Steam en tu navegador
- Ve a tu Librería
- Busca Wallpaper Engine
- Verifica que esté disponible en tu región
- Prueba iniciar sesión en Steam desde tu navegador para verificar credenciales

### Error técnico: "AsyncJobFailedException"

Si ves este error (generalmente junto con "Unhandled exception"):

#### Causas:
- Problemas de conexión temporal a Steam
- Herramienta de descarga corrupta
- Conflicto de puerto o red

#### Soluciones:
1. **Espera y reintentar**
   - A veces es un problema temporal de servidores
   - Espera 5 minutos y vuelve a intentar

2. **Reinicia el PC**
   - Cierra todo completamente
   - Reinicia tu ordenador
   - Abre la app y vuelve a intentar

3. **Verifica tu conexión**
   - Abre un navegador y ve a `steamcommunity.com`
   - Si funciona, es un problema de la app
   - Si no funciona, es tu conexión de internet

4. **Reinstala la herramienta de descarga**
   - Elimina la carpeta: `%APPDATA%\WallpaperApp\downloads`
   - Cierra y reabre la app
   - Intenta descargar nuevamente

### Logs útiles para diagnosticar

Cuando ocurra un error:
1. Abre la **Consola del navegador** (F12 → Pestaña Console)
2. Copia todo el error
3. Si necesitas reportar un problema, comparte estos logs

### No es un problema de la app

Recuerda que:
- La app NO descarga contenido
- La app SOLO gestiona Steam
- Si Steam rechaza, es responsabilidad de Steam

Asegúrate de:
- Tener conexión a internet estable
- Que Wallpaper Engine esté en tu librería
- Que tus credenciales sean correctas
- Que tu cuenta esté activa

---

**¿Todavía no funciona?**
- Verifica el log técnico mostrado en el error
- Intenta iniciar sesión en Steam directamente para verificar credenciales
- Prueba desde otra red o dispositivo si es posible
