// Hook personalizado para obtener wallpapers
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { wallpapersUrl } from '../services/api';
import { getLocalWallpapers } from '../data/sampleWallpapers';

export const useWallpapers = (options = {}) => {
  const [wallpapers, setWallpapers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({});

  const fetchWallpapers = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      const response = await axios.get(wallpapersUrl(), { params });
      setWallpapers(response.data.data);
      setPagination(response.data.pagination);
      setError(null);
    } catch (err) {
      const fallback = getLocalWallpapers(params);
      setWallpapers(fallback.data);
      setPagination(fallback.pagination);
      setError(null);
      console.error('Error fetching wallpapers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWallpapers(options);
  }, []);

  return {
    wallpapers,
    loading,
    error,
    pagination,
    fetchWallpapers
  };
};

export default useWallpapers;
