import React, { useEffect, useState } from 'react';

export interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'inherit';
  'aria-label'?: string;
  'data-testid'?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  color = 'primary',
  'aria-label': ariaLabel = 'Loading',
  'data-testid': testId,
  className = '',
}) => {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const getSpinnerClasses = () => {
    const classes = ['loading-spinner'];
    
    classes.push(`loading-spinner-${size}`);
    classes.push(`loading-spinner-${color}`);
    
    if (reducedMotion) {
      classes.push('reduced-motion');
    }
    
    if (className) {
      classes.push(className);
    }
    
    return classes.join(' ');
  };

  const getSizeStyles = () => {
    const sizes = {
      small: { width: '16px', height: '16px' },
      medium: { width: '24px', height: '24px' },
      large: { width: '32px', height: '32px' },
    };
    return sizes[size];
  };

  const getColorStyles = () => {
    const colors = {
      primary: { borderColor: '#1976d2' },
      secondary: { borderColor: '#9c27b0' },
      inherit: { borderColor: 'currentColor' },
    };
    return colors[color];
  };

  return (
    <div
      data-testid={testId}
      role="status"
      aria-label={ariaLabel}
      className={getSpinnerClasses()}
      style={{
        ...getSizeStyles(),
        ...getColorStyles(),
        border: '2px solid transparent',
        borderTopColor: getColorStyles().borderColor,
        borderRadius: '50%',
        animation: reducedMotion ? 'none' : 'spin 1s linear infinite',
        display: 'inline-block',
      }}
    >
      <span style={{ position: 'absolute', left: '-10000px' }}>
        {ariaLabel}
      </span>
    </div>
  );
};
