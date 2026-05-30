import mongoose from 'mongoose';

const wallpaperSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  author: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    enum: ['nature', 'abstract', 'urban', 'technology', 'art', 'other'],
    default: 'other'
  },
  tags: [String],
  image: {
    url: String,
    width: Number,
    height: Number,
    size: Number
  },
  preview: {
    url: String,
    width: Number,
    height: Number
  },
  mediaType: {
    type: String,
    enum: ['image', 'gif', 'video'],
    default: 'image'
  },
  mediaUrl: String,
  duration: Number, // Para videos y GIFs
  downloads: {
    type: Number,
    default: 0
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  featured: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Índices para búsqueda eficiente
wallpaperSchema.index({ title: 'text', description: 'text', tags: 'text' });
wallpaperSchema.index({ category: 1 });
wallpaperSchema.index({ featured: 1, createdAt: -1 });

const Wallpaper = mongoose.model('Wallpaper', wallpaperSchema);

export default Wallpaper;
