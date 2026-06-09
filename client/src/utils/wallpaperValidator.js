import { getWallpaperId } from './wallpaperMeta';
import { getPreviewUrl } from './wallpaperMeta';

/**
 * Valida si un wallpaper local está completo
 * @param {object} wallpaper - El wallpaper a validar
 * @returns {object} { isValid: boolean, issues: string[] }
 */
export const validateLocalWallpaper = (wallpaper = {}) => {
  const issues = [];

  // Verificar que tenga un ID
  const id = getWallpaperId(wallpaper);
  if (!id) {
    issues.push('Sin ID de wallpaper');
  }

  // Verificar que tenga título
  if (!wallpaper.title || !String(wallpaper.title).trim()) {
    issues.push('Sin título');
  }

  // Verificar que tenga autor
  if (!wallpaper.author && !wallpaper.creator && !wallpaper.authorName) {
    issues.push('Sin autor');
  }

  // Verificar que tenga una ruta local o contenido
  const hasLocalPath = wallpaper.localPath || wallpaper.path || wallpaper.downloadPath;
  const hasPreview = getPreviewUrl(wallpaper);
  const hasSource = wallpaper.sourceUrl || wallpaper.mediaUrl || wallpaper.previewUrl;

  if (!hasLocalPath && !hasPreview && !hasSource) {
    issues.push('Sin contenido local ni fuente remota');
  }

  // Verificar que tenga metadata suficiente
  if (!wallpaper.mediaType && !wallpaper.type) {
    issues.push('Sin tipo de media');
  }

  return {
    isValid: issues.length === 0,
    issues
  };
};

/**
 * Marca wallpapers que necesitan reparación
 * @param {array} wallpapers - Array de wallpapers
 * @returns {array} Wallpapers con flag needsRepair
 */
export const markBrokenWallpapers = (wallpapers = []) => {
  return wallpapers.map(wallpaper => {
    const validation = validateLocalWallpaper(wallpaper);
    
    // Considerar que necesita reparación si:
    // 1. No es válido (le faltan campos importantes)
    // 2. O está marcado explícitamente como incompleto
    const needsRepair = !validation.isValid || wallpaper.incomplete === true;

    return {
      ...wallpaper,
      needsRepair,
      validationIssues: validation.issues
    };
  });
};

/**
 * Obtiene solo los wallpapers que necesitan reparación
 * @param {array} wallpapers - Array de wallpapers
 * @returns {array} Wallpapers que necesitan reparación
 */
export const getBrokenWallpapers = (wallpapers = []) => {
  const marked = markBrokenWallpapers(wallpapers);
  return marked.filter(w => w.needsRepair === true);
};

/**
 * Crea un resumen de problemas encontrados
 * @param {array} wallpapers - Array de wallpapers con validación
 * @returns {object} { total: number, issues: Map<issue, count> }
 */
export const summarizeWallpaperIssues = (wallpapers = []) => {
  const broken = getBrokenWallpapers(wallpapers);
  const issueMap = new Map();

  broken.forEach(wallpaper => {
    if (wallpaper.validationIssues) {
      wallpaper.validationIssues.forEach(issue => {
        issueMap.set(issue, (issueMap.get(issue) || 0) + 1);
      });
    }
  });

  return {
    total: broken.length,
    issues: Object.fromEntries(issueMap)
  };
};

export default {
  validateLocalWallpaper,
  markBrokenWallpapers,
  getBrokenWallpapers,
  summarizeWallpaperIssues
};
