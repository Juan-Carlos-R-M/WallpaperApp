import React from 'react';
import '../styles/skeleton-loader.css';

const SkeletonLoader = ({ count = 6, variant = 'card' }) => {
  if (variant === 'card') {
    return (
      <>
        {Array.from({ length: count }).map((_, i) => (
          <div key={`skeleton-${i}`} className="skeleton-card gallery-skeleton-card">
            <div className="skeleton-image-wrapper">
              <div className="skeleton-image"></div>
              <div className="skeleton-badge"></div>
            </div>
            <div className="skeleton-info">
              <div className="skeleton-title"></div>
              <div className="skeleton-author"></div>
              <div className="skeleton-meta">
                <div className="skeleton-meta-item"></div>
                <div className="skeleton-meta-item"></div>
              </div>
            </div>
          </div>
        ))}
      </>
    );
  }

  return (
    <div className="skeleton-loader">
      {Array.from({ length: count }).map((_, i) => (
        <div key={`skeleton-${i}`} className="skeleton-item"></div>
      ))}
    </div>
  );
};

export default SkeletonLoader;
