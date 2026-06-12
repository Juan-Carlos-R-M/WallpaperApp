const isElectronRenderer = () => (
  typeof window !== 'undefined' && Boolean(window.electronAPI)
);

const toLocalMediaUrl = (filePath = '') => {
  if (!filePath) return '';
  const normalized = String(filePath).replace(/\\/g, '/');
  // Chromium parses custom-scheme://X/path as host=X, pathname=/path.
  // We exploit this: put the drive letter as host so it survives round-trip.
  const driveMatch = normalized.match(/^([a-zA-Z]):(\/.*)?$/);
  if (driveMatch) {
    const drive = driveMatch[1].toUpperCase();
    const rest = driveMatch[2] || '/';
    return `local-media://${drive}${rest}`;
  }
  return `local-media:///${normalized}`;
};

const fileUrlToPath = (value = '') => {
  try {
    const url = new URL(value);
    return decodeURIComponent(url.pathname.replace(/^\/([a-zA-Z]:)/, '$1'));
  } catch {
    return '';
  }
};

export const toPlayableUrl = (value = '') => {
  const source = String(value || '');
  if (!source || source.startsWith('data:') || source.startsWith('local-media:') || /^https?:/i.test(source)) {
    return source;
  }

  if (source.startsWith('file:')) {
    const filePath = fileUrlToPath(source);
    return isElectronRenderer() && filePath ? toLocalMediaUrl(filePath) : source;
  }

  if (/^[a-zA-Z]:[\\/]/.test(source) || source.startsWith('\\\\')) {
    return isElectronRenderer()
      ? toLocalMediaUrl(source)
      : encodeURI(`file:///${source.replace(/\\/g, '/')}`);
  }

  return source;
};

export default toPlayableUrl;
