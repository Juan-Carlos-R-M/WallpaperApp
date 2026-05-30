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
    category: 'nature',
    tags: ['mountain', 'sunset', 'landscape'],
    preview: { url: placeholderImage('Mountain', '#1f7a68', '#27324f') },
    mediaType: 'image',
    mediaUrl: placeholderImage('Mountain Vista', '#1f7a68', '#27324f'),
    downloads: 1250,
    rating: { average: 4.8, count: 256 },
    featured: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    _id: 'local-abstract-1',
    title: 'Abstract Colors',
    description: 'Patron abstracto colorido',
    author: 'Digital Artist',
    category: 'abstract',
    tags: ['abstract', 'colorful', 'modern'],
    preview: { url: placeholderImage('Abstract', '#7b2ff7', '#f107a3') },
    mediaType: 'image',
    mediaUrl: placeholderImage('Abstract Colors', '#7b2ff7', '#f107a3'),
    downloads: 892,
    rating: { average: 4.6, count: 198 },
    featured: true,
    createdAt: '2026-01-02T00:00:00.000Z'
  },
  {
    _id: 'local-urban-1',
    title: 'City Lights',
    description: 'Luces de la ciudad de noche',
    author: 'Urban Photographer',
    category: 'urban',
    tags: ['city', 'lights', 'night'],
    preview: { url: placeholderImage('City', '#182848', '#4b6cb7') },
    mediaType: 'image',
    mediaUrl: placeholderImage('City Lights', '#182848', '#4b6cb7'),
    downloads: 645,
    rating: { average: 4.5, count: 142 },
    featured: false,
    createdAt: '2026-01-03T00:00:00.000Z'
  },
  {
    _id: 'local-technology-1',
    title: 'Tech Future',
    description: 'Tema tecnologico futurista',
    author: 'Tech Designer',
    category: 'technology',
    tags: ['tech', 'future', 'digital'],
    preview: { url: placeholderImage('Tech', '#0f2027', '#2c5364') },
    mediaType: 'image',
    mediaUrl: placeholderImage('Tech Future', '#0f2027', '#2c5364'),
    downloads: 934,
    rating: { average: 4.7, count: 187 },
    featured: false,
    createdAt: '2026-01-04T00:00:00.000Z'
  },
  {
    _id: 'local-art-1',
    title: 'Digital Art',
    description: 'Obra de arte digital moderna',
    author: 'Digital Artist Pro',
    category: 'art',
    tags: ['art', 'digital', 'creative'],
    preview: { url: placeholderImage('Art', '#42275a', '#734b6d') },
    mediaType: 'image',
    mediaUrl: placeholderImage('Digital Art', '#42275a', '#734b6d'),
    downloads: 1567,
    rating: { average: 4.9, count: 312 },
    featured: true,
    createdAt: '2026-01-05T00:00:00.000Z'
  }
];

export default sampleWallpapers;
