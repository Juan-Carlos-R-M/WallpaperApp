export const ensureSerializableFavoritesItem = (wallpaper) => {
  if (!wallpaper || typeof wallpaper !== 'object') return { id: undefined };

  // Lo que LocalStore.addFavorite espera es que haya un ID consistente.
  // Si el wallpaper viene de Steam puede traer: publishedFileId.
  const id = wallpaper.id || wallpaper._id || wallpaper.publishedFileId || wallpaper.localPath || wallpaper.mediaUrl;

  // Además: ensure que favoritos sean serializables.
  const safe = {
    ...wallpaper,
    id,
    publishedFileId: wallpaper.publishedFileId
  };

  return safe;
};

