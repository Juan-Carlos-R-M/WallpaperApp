#!/bin/bash

# Script para construir el ejecutable de Windows (.exe)
# Este script prepara y construye la aplicación de Electron

echo "=========================================="
echo "Wallpaper App - Build para Windows (.exe)"
echo "=========================================="

# Limpiar builds anteriores
echo "🧹 Limpiando builds anteriores..."
rm -rf dist out release

# Instalar dependencias si es necesario
echo "📦 Verificando dependencias..."
npm install

# Build del frontend React
echo "🔨 Compilando frontend React..."
npm run build --workspace=client

if [ $? -ne 0 ]; then
    echo "❌ Error compilando frontend"
    exit 1
fi

# Build con Electron Builder
echo "🔨 Construyendo ejecutable con Electron Builder..."
npx electron-builder --win --publish never

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ ¡Build completado exitosamente!"
    echo ""
    echo "Los ejecutables están en la carpeta 'dist':"
    echo "  - Wallpaper-App-Setup.exe (Instalador)"
    echo "  - Wallpaper-App-Portable.exe (Versión portable)"
    echo ""
else
    echo "❌ Error durante el build"
    exit 1
fi
