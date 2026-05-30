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
    _id: 'local-nature-1',
    title: 'Mountain Vista',
    description: 'Hermosa vista de montanas al atardecer',
    author: 'Nature Photography',
    authorId: 'author-nature-1',
    category: 'nature',
    mediaType: 'image',
    mediaUrl: placeholderImage('Mountain Vista', '#1f7a68', '#27324f'),
    previewUrl: placeholderImage('Mountain Vista', '#1f7a68', '#27324f'),
    downloads: 1250,
    rating: { average: 4.8, count: 256 },
    likes: 892,
    resolution: '1920x1440',
    uploadDate: '2024-01-15',
    isSubscribed: false,
    authorInfo: {
      name: 'Nature Photography',
      followers: 1250,
      wallpapers: 24,
      description: 'Fotografía profesional de naturaleza'
    }
  },
  {
    _id: 'local-abstract-1',
    title: 'Abstract Colors',
    description: 'Patron abstracto colorido',
    author: 'Digital Artist',
    authorId: 'author-digital-1',
    category: 'abstract',
    mediaType: 'image',
    mediaUrl: placeholderImage('Abstract Colors', '#7b2ff7', '#f107a3'),
    previewUrl: placeholderImage('Abstract Colors', '#7b2ff7', '#f107a3'),
    downloads: 892,
    rating: { average: 4.6, count: 198 },
    likes: 654,
    resolution: '1920x1440',
    uploadDate: '2024-01-10',
    isSubscribed: false,
    authorInfo: {
      name: 'Digital Artist',
      followers: 856,
      wallpapers: 18,
      description: 'Artista digital enfocado en patrones abstractos'
    }
  },
  {
    _id: 'local-urban-1',
    title: 'City Lights',
    description: 'Luces de la ciudad de noche',
    author: 'Urban Photographer',
    authorId: 'author-urban-1',
    category: 'urban',
    mediaType: 'image',
    mediaUrl: placeholderImage('City Lights', '#182848', '#4b6cb7'),
    previewUrl: placeholderImage('City Lights', '#182848', '#4b6cb7'),
    downloads: 645,
    rating: { average: 4.5, count: 142 },
    likes: 523,
    resolution: '1920x1440',
    uploadDate: '2024-01-05',
    isSubscribed: false,
    authorInfo: {
      name: 'Urban Photographer',
      followers: 742,
      wallpapers: 32,
      description: 'Fotografía urbana y arquitectura'
    }
  },
  {
    _id: 'local-technology-1',
    title: 'Tech Future',
    description: 'Tema tecnologico futurista',
    author: 'Tech Designer',
    authorId: 'author-tech-1',
    category: 'technology',
    mediaType: 'image',
    mediaUrl: placeholderImage('Tech Future', '#0f2027', '#2c5364'),
    previewUrl: placeholderImage('Tech Future', '#0f2027', '#2c5364'),
    downloads: 934,
    rating: { average: 4.7, count: 187 },
    likes: 712,
    resolution: '1920x1440',
    uploadDate: '2024-01-08',
    isSubscribed: false,
    authorInfo: {
      name: 'Tech Designer',
      followers: 1890,
      wallpapers: 45,
      description: 'Diseños futuristas y tecnológicos'
    }
  },
  {
    _id: 'local-art-1',
    title: 'Digital Art',
    description: 'Obra de arte digital moderna',
    author: 'Digital Artist Pro',
    authorId: 'author-digital-pro-1',
    category: 'art',
    mediaType: 'image',
    mediaUrl: placeholderImage('Digital Art', '#42275a', '#734b6d'),
    previewUrl: placeholderImage('Digital Art', '#42275a', '#734b6d'),
    downloads: 1567,
    rating: { average: 4.9, count: 312 },
    likes: 1234,
    resolution: '1920x1440',
    uploadDate: '2024-01-12',
    isSubscribed: false,
    authorInfo: {
      name: 'Digital Artist Pro',
      followers: 3456,
      wallpapers: 67,
      description: 'Artista profesional en arte digital'
    }
  }
];

export const getLocalWallpapers = ({ category = '', search = '', page = 1, limit = 12 } = {}) => {
  const normalizedSearch = search.toLowerCase();
  const filtered = sampleWallpapers.filter(wallpaper => {
    if (category && wallpaper.category !== category) return false;
    if (!normalizedSearch) return true;

    return [wallpaper.title, wallpaper.description, wallpaper.author, wallpaper.category]
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearch);
  });

  const start = (Number(page) - 1) * Number(limit);

  return {
    data: filtered.slice(start, start + Number(limit)),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(filtered.length / Number(limit)),
      total: filtered.length
    }
  };
};

export default sampleWallpapers;
