import React from 'react';

export interface LoadingSkeletonProps {
  variant: 'text' | 'rectangular' | 'circular';
  width?: number | string;
  height?: number | string;
  size?: number;
  animation?: boolean;
  'aria-label'?: string;
  'data-testid'?: string;
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant,
  width,
  height,
  size,
  animation = true,
  'aria-label': ariaLabel = 'Loading content',
  'data-testid': testId,
  className = '',
}) => {
  const getSkeletonClasses = () => {
    const classes = ['skeleton'];
    
    classes.push(`skeleton-${variant}`);
    
    if (!animation) {
      classes.push('skeleton-no-animation');
    }
    
    if (className) {
      classes.push(className);
    }
    
    return classes.join(' ');
  };

  const getSkeletonStyles = () => {
    const baseStyles: React.CSSProperties = {
      backgroundColor: '#e0e0e0',
      borderRadius: variant === 'circular' ? '50%' : variant === 'text' ? '4px' : '8px',
      display: 'inline-block',
    };

    if (animation) {
      baseStyles.animation = 'skeleton-pulse 1.5s ease-in-out infinite';
    }

    // Handle different variants
    switch (variant) {
      case 'text':
        return {
          ...baseStyles,
          width: width || '100%',
          height: height || '1em',
        };
      case 'rectangular':
        return {
          ...baseStyles,
          width: width || 100,
          height: height || 100,
        };
      case 'circular':
        const circularSize = size || 40;
        return {
          ...baseStyles,
          width: circularSize,
          height: circularSize,
        };
      default:
        return baseStyles;
    }
  };

  return (
    <div
      data-testid={testId}
      role="status"
      aria-label={ariaLabel}
      className={getSkeletonClasses()}
      style={getSkeletonStyles()}
    >
      <span style={{ position: 'absolute', left: '-10000px' }}>
        {ariaLabel}
      </span>
    </div>
  );
};
