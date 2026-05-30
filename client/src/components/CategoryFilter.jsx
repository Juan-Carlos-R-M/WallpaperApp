import React, { useCallback } from 'react';
import '../styles/category-filter.css';

const CATEGORIES = [
  { id: '', label: 'Todos' },
  { id: 'nature', label: 'Naturaleza' },
  { id: 'abstract', label: 'Abstracto' },
  { id: 'urban', label: 'Urbano' },
  { id: 'technology', label: 'Tecnología' },
  { id: 'art', label: 'Arte' }
];

const CategoryFilter = ({ selected, onSelect }) => {
  const handleCategoryChange = useCallback(categoryId => {
    onSelect(categoryId);
  }, [onSelect]);

  return (
    <div className="category-filter">
      <h3>Categorías</h3>
      <div className="category-buttons">
        {CATEGORIES.map(category => (
          <button
            key={category.id}
            className={`category-btn ${selected === category.id ? 'active' : ''}`}
            onClick={() => handleCategoryChange(category.id)}
          >
            {category.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategoryFilter;
