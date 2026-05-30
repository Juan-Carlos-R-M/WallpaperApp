const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const wallpapersUrl = (path = '') => `${API_BASE_URL}/wallpapers${path}`;

export default API_BASE_URL;
