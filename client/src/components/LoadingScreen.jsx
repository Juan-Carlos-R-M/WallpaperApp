import React from 'react';
import '../styles/loading-screen.css';

/**
 * LoadingScreen - Pantalla de carga reutilizable
 * @param {boolean} isVisible - Si la pantalla está visible
 * @param {string} title - Título de la carga (default: "Cargando...")
 * @param {string} subtitle - Subtítulo opcional
 * @param {string} type - Tipo de animación: 'spinner', 'dots', 'bars', 'pulse' (default: 'spinner')
 * @param {boolean} fullScreen - Si ocupa toda la pantalla o es inline (default: true)
 */
export const LoadingScreen = ({
  isVisible = true,
  title = 'Cargando...',
  subtitle = '',
  type = 'spinner',
  fullScreen = true
}) => {
  if (!isVisible) return null;

  const renderAnimation = () => {
    switch (type) {
      case 'dots':
        return <DotsLoadingAnimation />;
      case 'bars':
        return <BarsLoadingAnimation />;
      case 'pulse':
        return <PulseLoadingAnimation />;
      case 'spinner':
      default:
        return <SpinnerLoadingAnimation />;
    }
  };

  const containerClass = fullScreen ? 'loading-screen-fullscreen' : 'loading-screen-inline';

  return (
    <div className={`loading-screen ${containerClass}`}>
      <div className="loading-content">
        {renderAnimation()}
        <h2 className="loading-title">{title}</h2>
        {subtitle && <p className="loading-subtitle">{subtitle}</p>}
      </div>
    </div>
  );
};

const DotsLoadingAnimation = () => (
  <div className="loading-animation dots">
    {[1, 2, 3, 4].map(dot => <span key={dot}></span>)}
  </div>
);

const BarsLoadingAnimation = () => (
  <div className="loading-animation bars">
    {[0.1, 0.2, 0.3, 0.4].map(delay => (
      <span style={{ animationDelay: `${delay}s` }} key={delay}></span>
    ))}
  </div>
);

const PulseLoadingAnimation = () => (
  <div className="loading-animation pulse">
    <div className="pulse-ring"></div>
  </div>
);

const SpinnerLoadingAnimation = () => (
  <div className="loading-animation spinner">
    {[1, 2, 3].map(ring => <div className="spinner-ring" key={ring}></div>)}
  </div>
);

export default LoadingScreen;
