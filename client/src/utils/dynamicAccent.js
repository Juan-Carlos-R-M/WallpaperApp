import { getPreviewUrl, normalizeTags } from './wallpaperMeta';

const DEFAULT_ACCENT = {
  accent: '#e50914',
  dark: '#b80710',
  strong: '#c80712',
  hot: '#ff1f2d',
  soft: '#ff303a',
  rgb: '229 9 20',
  hotRgb: '255 31 45',
  softRgb: '255 48 58'
};

const PALETTES = [
  { keys: ['fire', 'burn', 'sunset', 'orange', 'volcano'], hue: 28 },
  { keys: ['cyber', 'rain', 'city', 'blue', 'night'], hue: 212 },
  { keys: ['forest', 'nature', 'landscape', 'green', 'day'], hue: 118 },
  { keys: ['violet', 'purple', 'galaxy', 'space', 'nocturne'], hue: 266 },
  { keys: ['pink', 'anime', 'cute', 'kawaii', 'neko'], hue: 337 },
  { keys: ['red', 'dark', 'demon', 'blood'], hue: 356 },
  { keys: ['gold', 'desert', 'warm', 'mountain'], hue: 39 }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const hslToRgb = (h, s, l) => {
  const hue = ((h % 360) + 360) % 360 / 360;
  const sat = clamp(s, 0, 100) / 100;
  const light = clamp(l, 0, 100) / 100;
  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
  const p = 2 * light - q;
  const convert = (t) => {
    let value = t;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  };

  return [
    Math.round(convert(hue + 1 / 3) * 255),
    Math.round(convert(hue) * 255),
    Math.round(convert(hue - 1 / 3) * 255)
  ];
};

const rgbToHex = ([r, g, b]) => (
  `#${[r, g, b].map(value => value.toString(16).padStart(2, '0')).join('')}`
);

const buildPalette = (hue, saturation = 78) => {
  const accent = hslToRgb(hue, saturation, 47);
  const dark = hslToRgb(hue, saturation, 34);
  const strong = hslToRgb(hue, saturation, 40);
  const hot = hslToRgb(hue, Math.min(94, saturation + 10), 55);
  const soft = hslToRgb(hue, Math.min(96, saturation + 8), 64);

  return {
    accent: rgbToHex(accent),
    dark: rgbToHex(dark),
    strong: rgbToHex(strong),
    hot: rgbToHex(hot),
    soft: rgbToHex(soft),
    rgb: accent.join(' '),
    hotRgb: hot.join(' '),
    softRgb: soft.join(' ')
  };
};

const hashString = (value = '') => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const getFallbackPalette = (wallpaper = {}) => {
  const text = [
    wallpaper.title,
    wallpaper.category,
    wallpaper.mediaType,
    ...normalizeTags(wallpaper, 20)
  ].join(' ').toLowerCase();

  const matched = PALETTES.find(palette => palette.keys.some(key => text.includes(key)));
  if (matched) return buildPalette(matched.hue);

  return buildPalette(hashString(text || getPreviewUrl(wallpaper)) % 360, 72);
};

const setCssPalette = (palette = DEFAULT_ACCENT) => {
  const root = document.documentElement;
  root.style.setProperty('--color-accent', palette.accent);
  root.style.setProperty('--color-accent-dark', palette.dark);
  root.style.setProperty('--color-accent-strong', palette.strong);
  root.style.setProperty('--color-accent-hot', palette.hot);
  root.style.setProperty('--color-accent-soft', palette.soft);
  root.style.setProperty('--color-accent-rgb', palette.rgb);
  root.style.setProperty('--color-accent-hot-rgb', palette.hotRgb);
  root.style.setProperty('--color-accent-soft-rgb', palette.softRgb);
};

const sampleImagePalette = (imageUrl) => new Promise((resolve, reject) => {
  if (!imageUrl || imageUrl.startsWith('local-media:')) {
    reject(new Error('No canvas-safe image URL'));
    return;
  }

  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.decoding = 'async';
  image.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      const size = 24;
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0, size, size);
      const { data } = context.getImageData(0, 0, size, size);
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;

      for (let index = 0; index < data.length; index += 16) {
        const alpha = data[index + 3];
        if (alpha < 180) continue;
        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];
        const brightness = (red + green + blue) / 3;
        const saturation = Math.max(red, green, blue) - Math.min(red, green, blue);
        if (brightness < 36 || brightness > 235 || saturation < 22) continue;
        r += red;
        g += green;
        b += blue;
        count += 1;
      }

      if (!count) throw new Error('No colorful pixels');
      const average = [r, g, b].map(value => Math.round(value / count));
      resolve({
        accent: rgbToHex(average),
        dark: rgbToHex(average.map(value => Math.round(value * 0.62))),
        strong: rgbToHex(average.map(value => Math.round(value * 0.78))),
        hot: rgbToHex(average.map(value => clamp(Math.round(value * 1.18), 0, 255))),
        soft: rgbToHex(average.map(value => clamp(Math.round(value * 1.32), 0, 255))),
        rgb: average.join(' '),
        hotRgb: average.map(value => clamp(Math.round(value * 1.18), 0, 255)).join(' '),
        softRgb: average.map(value => clamp(Math.round(value * 1.32), 0, 255)).join(' ')
      });
    } catch (error) {
      reject(error);
    }
  };
  image.onerror = () => reject(new Error('Image unavailable'));
  image.src = imageUrl;
});

export const applyWallpaperAccent = (wallpaper = {}) => {
  if (typeof document === 'undefined') return;
  const fallback = getFallbackPalette(wallpaper);
  setCssPalette(fallback);

  sampleImagePalette(getPreviewUrl(wallpaper))
    .then(setCssPalette)
    .catch(() => {});
};

export const resetWallpaperAccent = () => {
  if (typeof document === 'undefined') return;
  setCssPalette(DEFAULT_ACCENT);
};
