// Script para agregar wallpapers de ejemplo a la base de datos
// Ejecutar: npm run dev en el servidor y luego: node seed.js

import mongoose from 'mongoose';
import Wallpaper from './models/Wallpaper.js';
import dotenv from 'dotenv';

dotenv.config();

const placeholderImage = (label, colorA, colorB) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1440" viewBox="0 0 1920 1440">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${colorA}"/>
          <stop offset="1" stop-color="${colorB}"/>
        </linearGradient>
      </defs>
      <rect width="1920" height="1440" fill="url(#bg)"/>
      <circle cx="1450" cy="260" r="320" fill="rgba(255,255,255,0.13)"/>
      <circle cx="360" cy="1120" r="420" fill="rgba(0,0,0,0.18)"/>
      <text x="120" y="760" font-family="Arial, sans-serif" font-size="120" fill="white" font-weight="700">${label}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const sampleWallpapers = [
  {
    title: 'Mountain Vista',
    description: 'Hermosa vista de montañas al atardecer',
    author: 'Nature Photography',
    category: 'nature',
    tags: ['mountain', 'sunset', 'landscape'],
    image: {
      url: placeholderImage('Mountain Vista', '#1f7a68', '#27324f'),
      width: 1920,
      height: 1440,
      size: 2048576
    },
    preview: {
      url: placeholderImage('Mountain', '#1f7a68', '#27324f'),
      width: 400,
      height: 300
    },
    mediaType: 'image',
    mediaUrl: placeholderImage('Mountain Vista', '#1f7a68', '#27324f'),
    featured: true,
    rating: { average: 4.8, count: 256 },
    downloads: 1250
  },
  {
    title: 'Abstract Colors',
    description: 'Patrón abstracto colorido',
    author: 'Digital Artist',
    category: 'abstract',
    tags: ['abstract', 'colorful', 'modern'],
    image: {
      url: placeholderImage('Abstract Colors', '#7b2ff7', '#f107a3'),
      width: 1920,
      height: 1440,
      size: 2048576
    },
    preview: {
      url: placeholderImage('Abstract', '#7b2ff7', '#f107a3'),
      width: 400,
      height: 300
    },
    mediaType: 'image',
    mediaUrl: placeholderImage('Abstract Colors', '#7b2ff7', '#f107a3'),
    featured: true,
    rating: { average: 4.6, count: 198 },
    downloads: 892
  },
  {
    title: 'City Lights',
    description: 'Luces de la ciudad de noche',
    author: 'Urban Photographer',
    category: 'urban',
    tags: ['city', 'lights', 'night'],
    image: {
      url: placeholderImage('City Lights', '#182848', '#4b6cb7'),
      width: 1920,
      height: 1440,
      size: 2048576
    },
    preview: {
      url: placeholderImage('City', '#182848', '#4b6cb7'),
      width: 400,
      height: 300
    },
    mediaType: 'image',
    mediaUrl: placeholderImage('City Lights', '#182848', '#4b6cb7'),
    rating: { average: 4.5, count: 142 },
    downloads: 645
  },
  {
    title: 'Tech Future',
    description: 'Tema tecnológico futurista',
    author: 'Tech Designer',
    category: 'technology',
    tags: ['tech', 'future', 'digital'],
    image: {
      url: placeholderImage('Tech Future', '#0f2027', '#2c5364'),
      width: 1920,
      height: 1440,
      size: 2048576
    },
    preview: {
      url: placeholderImage('Tech', '#0f2027', '#2c5364'),
      width: 400,
      height: 300
    },
    mediaType: 'image',
    mediaUrl: placeholderImage('Tech Future', '#0f2027', '#2c5364'),
    rating: { average: 4.7, count: 187 },
    downloads: 934
  },
  {
    title: 'Digital Art',
    description: 'Obra de arte digital moderna',
    author: 'Digital Artist Pro',
    category: 'art',
    tags: ['art', 'digital', 'creative'],
    image: {
      url: placeholderImage('Digital Art', '#42275a', '#734b6d'),
      width: 1920,
      height: 1440,
      size: 2048576
    },
    preview: {
      url: placeholderImage('Art', '#42275a', '#734b6d'),
      width: 400,
      height: 300
    },
    mediaType: 'image',
    mediaUrl: placeholderImage('Digital Art', '#42275a', '#734b6d'),
    featured: true,
    rating: { average: 4.9, count: 312 },
    downloads: 1567
  }
];

async function seedDatabase() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wallpaper-app');
    console.log('✓ Conectado a MongoDB');

    // Limpiar wallpapers existentes
    await Wallpaper.deleteMany({});
    console.log('✓ Base de datos limpiada');

    // Insertar wallpapers de ejemplo
    const result = await Wallpaper.insertMany(sampleWallpapers);
    console.log(`✓ ${result.length} wallpapers agregados exitosamente`);

    // Mostrar resumen
    const total = await Wallpaper.countDocuments();
    const featured = await Wallpaper.countDocuments({ featured: true });
    console.log(`\nResumen:`);
    console.log(`- Total de wallpapers: ${total}`);
    console.log(`- Wallpapers destacados: ${featured}`);

    // Mostrar por categoría
    const categories = await Wallpaper.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    console.log(`\nPor categoría:`);
    categories.forEach(cat => {
      console.log(`  - ${cat._id}: ${cat.count}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

seedDatabase();
