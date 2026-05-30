import express from 'express';
import {
  getAllWallpapers,
  getWallpaperById,
  createWallpaper,
  updateWallpaper,
  deleteWallpaper,
  getFeaturedWallpapers,
  getWallpapersByCategory
} from '../controllers/wallpaperController.js';

const router = express.Router();

// Rutas públicas
router.get('/featured', getFeaturedWallpapers);
router.get('/category/:category', getWallpapersByCategory);
router.get('/:id', getWallpaperById);
router.get('/', getAllWallpapers);

// Rutas de administración (en producción, agregar autenticación)
router.post('/', createWallpaper);
router.put('/:id', updateWallpaper);
router.delete('/:id', deleteWallpaper);

export default router;
