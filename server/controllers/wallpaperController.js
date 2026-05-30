import Wallpaper from '../models/Wallpaper.js';
import mongoose from 'mongoose';
import sampleWallpapers from '../data/sampleWallpapers.js';

const isMongoConnected = () => mongoose.connection.readyState === 1;

const filterLocalWallpapers = ({ category, search } = {}) => {
  const normalizedSearch = search?.toLowerCase();

  return sampleWallpapers.filter(wallpaper => {
    if (category && wallpaper.category !== category) return false;
    if (!normalizedSearch) return true;

    const text = [
      wallpaper.title,
      wallpaper.description,
      wallpaper.author,
      ...(wallpaper.tags || [])
    ].join(' ').toLowerCase();

    return text.includes(normalizedSearch);
  });
};

const paginatedLocalResponse = (items, page = 1, limit = 12) => {
  const parsedPage = parseInt(page);
  const parsedLimit = parseInt(limit);
  const start = (parsedPage - 1) * parsedLimit;
  const data = items.slice(start, start + parsedLimit);

  return {
    data,
    pagination: {
      total: items.length,
      page: parsedPage,
      limit: parsedLimit,
      pages: Math.ceil(items.length / parsedLimit)
    }
  };
};

export const getAllWallpapers = async (req, res) => {
  try {
    const { category, page = 1, limit = 12, search, sort = '-createdAt' } = req.query;

    if (!isMongoConnected()) {
      const wallpapers = filterLocalWallpapers({ category, search });
      return res.json(paginatedLocalResponse(wallpapers, page, limit));
    }
    
    let query = {};
    
    if (category) {
      query.category = category;
    }
    
    if (search) {
      query.$text = { $search: search };
    }
    
    const skip = (page - 1) * limit;
    
    const wallpapers = await Wallpaper.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');
    
    const total = await Wallpaper.countDocuments(query);
    
    res.json({
      data: wallpapers,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getWallpaperById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isMongoConnected()) {
      const wallpaper = sampleWallpapers.find(item => item._id === id);
      if (!wallpaper) {
        return res.status(404).json({ error: 'Wallpaper no encontrado' });
      }
      return res.json(wallpaper);
    }

    const wallpaper = await Wallpaper.findById(id).select('-__v');
    
    if (!wallpaper) {
      return res.status(404).json({ error: 'Wallpaper no encontrado' });
    }
    
    res.json(wallpaper);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createWallpaper = async (req, res) => {
  try {
    const { title, description, author, category, tags, image, mediaType, mediaUrl } = req.body;
    
    const wallpaper = new Wallpaper({
      title,
      description,
      author,
      category,
      tags,
      image,
      mediaType,
      mediaUrl
    });
    
    await wallpaper.save();
    res.status(201).json(wallpaper);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateWallpaper = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const wallpaper = await Wallpaper.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: Date.now() },
      { new: true, runValidators: true }
    ).select('-__v');
    
    if (!wallpaper) {
      return res.status(404).json({ error: 'Wallpaper no encontrado' });
    }
    
    res.json(wallpaper);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteWallpaper = async (req, res) => {
  try {
    const { id } = req.params;
    const wallpaper = await Wallpaper.findByIdAndDelete(id);
    
    if (!wallpaper) {
      return res.status(404).json({ error: 'Wallpaper no encontrado' });
    }
    
    res.json({ message: 'Wallpaper eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getFeaturedWallpapers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;

    if (!isMongoConnected()) {
      return res.json(sampleWallpapers.filter(item => item.featured).slice(0, limit));
    }

    const wallpapers = await Wallpaper.find({ featured: true })
      .limit(limit)
      .select('-__v');
    
    res.json(wallpapers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getWallpapersByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;

    if (!isMongoConnected()) {
      const wallpapers = filterLocalWallpapers({ category });
      return res.json(paginatedLocalResponse(wallpapers, page, limit));
    }
    
    const skip = (page - 1) * limit;
    
    const wallpapers = await Wallpaper.find({ category })
      .skip(skip)
      .limit(limit)
      .select('-__v');
    
    const total = await Wallpaper.countDocuments({ category });
    
    res.json({
      data: wallpapers,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
