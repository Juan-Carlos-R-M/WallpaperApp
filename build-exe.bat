@echo off
REM Script para construir el ejecutable de Windows (.exe)
REM Este script prepara y construye la aplicación de Electron

echo.
echo ==========================================
echo Wallpaper App - Build para Windows ^(.exe^)
echo ==========================================
echo.

REM Limpiar builds anteriores
echo 🧹 Limpiando builds anteriores...
rmdir /s /q dist 2>nul
rmdir /s /q out 2>nul
rmdir /s /q release 2>nul

REM Instalar dependencias si es necesario
echo 📦 Verificando dependencias...
call npm install
if errorlevel 1 (
    echo ❌ Error instalando dependencias
    exit /b 1
)

REM Build del frontend React
echo 🔨 Compilando frontend React...
call npm run build --workspace=client
if errorlevel 1 (
    echo ❌ Error compilando frontend
    exit /b 1
)

REM Build con Electron Builder
echo 🔨 Construyendo ejecutable con Electron Builder...
call npx electron-builder --win --publish never
if errorlevel 1 (
    echo ❌ Error durante el build
    exit /b 1
)

echo.
echo ✅ ¡Build completado exitosamente!
echo.
echo Los ejecutables están en la carpeta 'dist':
echo   - Wallpaper-App-Setup-*-version*.exe ^(Instalador^)
echo   - Wallpaper-App-*-version*-Portable.exe ^(Versión portable^)
echo.
pause
