const MIME_EXTENSION_MAP = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'video/x-matroska': 'mkv'
};

const MEDIA_TYPE_EXTENSION_MAP = {
  gif: 'gif',
  image: 'jpg',
  video: 'mp4'
};

const sanitizeFileName = (value = 'wallpaper') => {
  const safe = String(value)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+|\.+$/g, '')
    .trim();

  return safe || 'wallpaper';
};

const getMimeTypeFromDataUrl = (value = '') => {
  const match = /^data:([^;,]+)/i.exec(String(value));
  return match?.[1]?.toLowerCase() || '';
};

const getExtensionFromMimeType = (mimeType = '') => {
  const normalized = String(mimeType).split(';')[0].trim().toLowerCase();
  return MIME_EXTENSION_MAP[normalized] || '';
};

const getExtensionFromSource = (value = '') => {
  const source = String(value);
  const mimeExtension = getExtensionFromMimeType(getMimeTypeFromDataUrl(source));
  if (mimeExtension) return mimeExtension;

  let pathname = source.split(/[?#]/)[0];
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(source) && !/^[a-zA-Z]:[\\/]/.test(source)) {
      pathname = new URL(source).pathname;
    }
  } catch {
    pathname = source;
  }

  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    // Keep the original path when it is not valid percent-encoded text.
  }

  const match = /\.([a-z0-9]{1,8})$/i.exec(pathname);
  return match?.[1]?.toLowerCase() || '';
};

export const getWallpaperDownloadSource = (wallpaper = {}) => (
  wallpaper.downloadUrl
    || wallpaper.sourceUrl
    || wallpaper.originalUrl
    || wallpaper.mediaUrl
    || wallpaper.image?.url
    || wallpaper.preview?.url
    || wallpaper.previewUrl
    || wallpaper.playbackUrl
    || ''
);

export const buildWallpaperFileName = (wallpaper = {}, sourceUrl = '', mimeType = '') => {
  const sourceExtension = getExtensionFromSource(sourceUrl);
  const mimeExtension = getExtensionFromMimeType(mimeType);
  const mediaExtension = MEDIA_TYPE_EXTENSION_MAP[String(wallpaper.mediaType || '').toLowerCase()];
  const extension = mimeExtension || sourceExtension || mediaExtension || 'jpg';
  const baseName = sanitizeFileName(wallpaper.title || wallpaper._id || 'wallpaper');

  return `${baseName}.${extension}`;
};

const triggerBrowserDownload = (url, fileName) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  triggerBrowserDownload(url, fileName);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const downloadWallpaperAsset = async (wallpaper = {}) => {
  const sourceUrl = getWallpaperDownloadSource(wallpaper);
  if (!sourceUrl) {
    throw new Error('Este wallpaper no tiene una URL de descarga valida.');
  }

  const fallbackFileName = buildWallpaperFileName(wallpaper, sourceUrl);

  if (window.electronAPI?.downloadWallpaperFile) {
    const result = await window.electronAPI.downloadWallpaperFile({
      title: wallpaper.title,
      mediaType: wallpaper.mediaType,
      fileName: fallbackFileName,
      sourceUrl,
      mediaUrl: wallpaper.mediaUrl,
      previewUrl: wallpaper.previewUrl || wallpaper.preview?.url || wallpaper.image?.url,
      localPath: wallpaper.localPath
    });

    if (!result.success) {
      throw new Error(result.error || 'No se pudo descargar el wallpaper.');
    }

    return result.data || { fileName: fallbackFileName };
  }

  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`La descarga respondio ${response.status}`);
    }

    const blob = await response.blob();
    const contentType = response.headers.get('content-type') || blob.type;
    const fileName = buildWallpaperFileName(wallpaper, sourceUrl, contentType);
    downloadBlob(blob, fileName);
    return { fileName };
  } catch (error) {
    triggerBrowserDownload(sourceUrl, fallbackFileName);
    return {
      fileName: fallbackFileName,
      warning: error.message
    };
  }
};
