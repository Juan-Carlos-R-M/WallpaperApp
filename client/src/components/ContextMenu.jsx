import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const ContextMenu = ({ x, y, onClose, options }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };
    const handleScroll = () => onClose();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust coordinates if the menu overflows the viewport boundaries
  const menuWidth = 220;
  const menuHeight = options.filter(opt => opt && !opt.hidden).length * 40 + 16;
  
  let adjustedX = x;
  let adjustedY = y;

  if (x + menuWidth > window.innerWidth) {
    adjustedX = window.innerWidth - menuWidth - 10;
  }
  if (y + menuHeight > window.innerHeight) {
    adjustedY = window.innerHeight - menuHeight - 10;
  }

  // Prevent negative coordinates
  adjustedX = Math.max(10, adjustedX);
  adjustedY = Math.max(10, adjustedY);

  const visibleOptions = options.filter(opt => opt && !opt.hidden);

  return createPortal(
    <div
      ref={menuRef}
      className="custom-context-menu"
      style={{
        position: 'fixed',
        top: `${adjustedY}px`,
        left: `${adjustedX}px`,
        zIndex: 99999,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {visibleOptions.map((opt, idx) => {
        if (opt.divider) {
          return <div key={`div-${idx}`} className="context-menu-divider" />;
        }
        return (
          <button
            key={idx}
            type="button"
            className={`context-menu-item ${opt.danger ? 'danger' : ''} ${opt.active ? 'active' : ''}`}
            disabled={opt.disabled}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              opt.onClick();
              onClose();
            }}
          >
            <i className={`bi bi-${opt.icon}`}></i>
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>,
    document.body
  );
};

export default ContextMenu;
