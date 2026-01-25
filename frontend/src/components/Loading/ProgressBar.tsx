import React from 'react';

export interface ProgressBarProps {
  value?: number;
  variant?: 'default' | 'success' | 'warning' | 'error';
  showLabel?: boolean;
  label?: string;
  'aria-label'?: string;
  'data-testid'?: string;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  variant = 'default',
  showLabel = false,
  label,
  'aria-label': ariaLabel,
  'data-testid': testId,
  className = '',
}) => {
  const isIndeterminate = value === undefined;
  const progressValue = Math.min(Math.max(value || 0, 0), 100);

  const getProgressClasses = () => {
    const classes = ['progress-bar'];
    
    if (isIndeterminate) {
      classes.push('progress-indeterminate');
    }
    
    classes.push(`progress-${variant}`);
    
    if (className) {
      classes.push(className);
    }
    
    return classes.join(' ');
  };

  const getProgressStyles = () => {
    const baseStyles: React.CSSProperties = {
      width: '100%',
      height: '8px',
      backgroundColor: '#e0e0e0',
      borderRadius: '4px',
      overflow: 'hidden',
      position: 'relative',
    };

    return baseStyles;
  };

  const getBarStyles = () => {
    const colors = {
      default: '#1976d2',
      success: '#4caf50',
      warning: '#ff9800',
      error: '#f44336',
    };

    const baseStyles: React.CSSProperties = {
      height: '100%',
      backgroundColor: colors[variant],
      borderRadius: '4px',
      transition: 'width 0.3s ease',
    };

    if (isIndeterminate) {
      baseStyles.width = '30%';
      baseStyles.animation = 'progress-indeterminate 2s linear infinite';
    } else {
      baseStyles.width = `${progressValue}%`;
    }

    return baseStyles;
  };

  const displayLabel = label || (showLabel && !isIndeterminate ? `${progressValue}%` : undefined);

  return (
    <div style={{ width: '100%' }}>
      <div
        data-testid={testId}
        role="progressbar"
        aria-valuenow={isIndeterminate ? undefined : progressValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel || displayLabel}
        className={getProgressClasses()}
        style={getProgressStyles()}
      >
        <div style={getBarStyles()} />
      </div>
      {displayLabel && (
        <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
          {displayLabel}
        </div>
      )}
    </div>
  );
};
