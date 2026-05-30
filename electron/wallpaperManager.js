const { execSync } = require('child_process');
const PowerShell = require('node-powershell');
const path = require('path');
const fs = require('fs');
const os = require('os');

class WallpaperManager {
  constructor() {
    this.ps = null;
  }

  /**
   * Establece un wallpaper como fondo de pantalla
   * @param {string} wallpaperPath - Ruta completa del archivo
   * @returns {boolean} - Éxito de la operación
   */
  async setWallpaper(wallpaperPath) {
    try {
      if (!fs.existsSync(wallpaperPath)) {
        throw new Error(`El archivo no existe: ${wallpaperPath}`);
      }

      // Obtener el tipo de archivo
      const ext = path.extname(wallpaperPath).toLowerCase();

      // Para videos, crear un frame de vista previa en su lugar
      if (['.mp4', '.webm', '.avi', '.mov'].includes(ext)) {
        return this.setVideoWallpaper(wallpaperPath);
      }

      // Para imágenes estáticas
      if (['.jpg', '.jpeg', '.png', '.bmp'].includes(ext)) {
        return this.setStaticWallpaper(wallpaperPath);
      }

      throw new Error(`Tipo de archivo no soportado: ${ext}`);
    } catch (error) {
      console.error('Error setting wallpaper:', error);
      throw error;
    }
  }

  /**
   * Establece un wallpaper estático (imagen)
   */
  async setStaticWallpaper(imagePath) {
    try {
      const absolutePath = path.resolve(imagePath);
      
      // Usar PowerShell para cambiar el wallpaper
      this.ps = new PowerShell({
        executionPolicy: 'Bypass',
        noProfile: true
      });

      const psScript = `
        Add-Type -TypeDefinition @"
          using System;
          using System.Runtime.InteropServices;
          public class WallpaperChanger {
            [DllImport("user32.dll", CharSet = CharSet.Auto)]
            public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
            public const int SPI_SETDESKWALLPAPER = 20;
            public const int SPIF_UPDATEINIFILE = 0x01;
            public const int SPIF_SENDCHANGE = 0x02;
            
            public static void SetWallpaper(string path) {
              SystemParametersInfo(SPI_SETDESKWALLPAPER, 0, path, SPIF_UPDATEINIFILE | SPIF_SENDCHANGE);
            }
          }
        "@
        
        [WallpaperChanger]::SetWallpaper("${absolutePath}")
        Write-Host "Wallpaper changed successfully"
      `;

      await this.ps.addCommand(psScript);
      const output = await this.ps.invoke();
      
      console.log('PowerShell output:', output);
      
      this.ps.dispose();
      return true;
    } catch (error) {
      console.error('Error setting static wallpaper:', error);
      if (this.ps) this.ps.dispose();
      throw error;
    }
  }

  /**
   * Para videos, extrae un frame y lo usa como wallpaper
   */
  async setVideoWallpaper(videoPath) {
    try {
      console.log('Video wallpaper requested:', videoPath);
      
      // Opción 1: Extraer frame con ffmpeg (si está instalado)
      // Opción 2: Mostrar notificación que requiere Wallpaper Engine

      const previewPath = this.getPreviewImage(videoPath);
      
      if (fs.existsSync(previewPath)) {
        return this.setStaticWallpaper(previewPath);
      }

      // Si no hay preview, informar al usuario
      console.log('Note: Para usar videos como wallpaper, instala Wallpaper Engine desde Steam');
      return false;
    } catch (error) {
      console.error('Error setting video wallpaper:', error);
      throw error;
    }
  }

  /**
   * Obtiene la imagen de preview de un wallpaper
   */
  getPreviewImage(mediaPath) {
    const dir = path.dirname(mediaPath);
    const previewPath = path.join(dir, 'preview.jpg');
    
    if (fs.existsSync(previewPath)) {
      return previewPath;
    }

    // Buscar cualquier JPG en el directorio
    try {
      const files = fs.readdirSync(dir);
      const jpgs = files.filter(f => f.toLowerCase().endsWith('.jpg'));
      
      if (jpgs.length > 0) {
        return path.join(dir, jpgs[0]);
      }
    } catch (error) {
      console.error('Error finding preview image:', error);
    }

    return '';
  }

  /**
   * Obtiene la imagen de wallpaper actual
   */
  async getCurrentWallpaper() {
    try {
      const ps = new PowerShell({
        executionPolicy: 'Bypass',
        noProfile: true
      });

      const psScript = `
        Add-Type -TypeDefinition @"
          using System;
          using System.Runtime.InteropServices;
          public class WallpaperGetter {
            [DllImport("user32.dll", CharSet = CharSet.Auto)]
            public static extern int GetSystemMetrics(int nIndex);
            
            private const int SM_CXSCREEN = 0;
            private const int SM_CYSCREEN = 1;
          }
        "@
        
        $regPath = "HKCU:\\Control Panel\\Desktop"
        (Get-ItemProperty -Path $regPath -Name Wallpaper).Wallpaper
      `;

      await ps.addCommand(psScript);
      const output = await ps.invoke();
      ps.dispose();

      return output.trim();
    } catch (error) {
      console.error('Error getting current wallpaper:', error);
      return '';
    }
  }

  /**
   * Obtiene la lista de wallpapers del sistema (si Wallpaper Engine está instalado)
   */
  async getInstalledWallpapers() {
    try {
      const wallpaperEnginePath = path.join(
        os.homedir(),
        'AppData\\Local\\Wallpaper Engine\\projects'
      );

      if (!fs.existsSync(wallpaperEnginePath)) {
        return [];
      }

      const folders = fs.readdirSync(wallpaperEnginePath, { withFileTypes: true })
        .filter(f => f.isDirectory())
        .map(f => f.name);

      return folders;
    } catch (error) {
      console.error('Error getting installed wallpapers:', error);
      return [];
    }
  }
}

module.exports = WallpaperManager;
