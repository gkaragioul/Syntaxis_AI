// @ts-nocheck
import React, { useEffect, useRef } from 'react';
import { useResponsive } from '../../hooks/useResponsive';

export interface ResponsiveLayoutProps {
  children: React.ReactNode;
  variant?: 'default' | 'grid' | 'form';
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  spacing?: {
    mobile?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    tablet?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    desktop?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  };
  typography?: {
    mobile?: { fontSize: string; lineHeight: string };
    tablet?: { fontSize: string; lineHeight: string };
    desktop?: { fontSize: string; lineHeight: string };
  };
  navigation?: 'mobile' | 'tablet' | 'desktop';
  containerQuery?: boolean;
  containerBreakpoints?: {
    small?: number;
    medium?: number;
    large?: number;
  };
  touchOptimized?: boolean;
  className?: string;
}

export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  variant = 'default',
  columns,
  spacing,
  typography,
  navigation,
  containerQuery = false,
  containerBreakpoints,
  touchOptimized = false,
  className = '',
}) => {
  const { isMobile, isTablet, isDesktop, breakpoint, screenSize, orientation } = useResponsive();
  const layoutRef = useRef<HTMLDivElement>(null);

  // Apply responsive styles
  useEffect(() => {
    if (!layoutRef.current) return;

    const element = layoutRef.current;
    
    // Grid layout
    if (variant === 'grid' && columns) {
      const currentColumns = isMobile ? columns.mobile : isTablet ? columns.tablet : columns.desktop;
      if (currentColumns) {
        element.style.gridTemplateColumns = `repeat(${currentColumns}, 1fr)`;
      }
    }

    // Typography
    if (typography) {
      const currentTypography = isMobile ? typography.mobile : isTablet ? typography.tablet : typography.desktop;
      if (currentTypography) {
        element.style.fontSize = currentTypography.fontSize;
        element.style.lineHeight = currentTypography.lineHeight;
      }
    }

    // Container queries
    if (containerQuery) {
      element.style.containerType = 'inline-size';
    }

    // Touch optimization
    if (touchOptimized && isMobile) {
      const buttons = element.querySelectorAll('button');
      buttons.forEach(button => {
        button.style.minHeight = '44px';
        button.style.minWidth = '44px';
      });
    }
  }, [isMobile, isTablet, isDesktop, variant, columns, typography, containerQuery, touchOptimized]);

  // Generate CSS classes
  const getLayoutClasses = () => {
    const classes = ['responsive-layout'];
    
    // Breakpoint classes
    if (isMobile) classes.push('mobile-layout');
    if (isTablet) classes.push('tablet-layout');
    if (isDesktop) classes.push('desktop-layout');
    
    // Variant classes
    classes.push(`${variant}-layout`);
    
    // Spacing classes
    if (spacing) {
      const currentSpacing = isMobile ? spacing.mobile : isTablet ? spacing.tablet : spacing.desktop;
      if (currentSpacing) {
        classes.push(`spacing-${currentSpacing}`);
      }
    }
    
    // Touch optimization
    if (touchOptimized) {
      classes.push('touch-optimized');
    }
    
    // Custom className
    if (className) {
      classes.push(className);
    }
    
    return classes.join(' ');
  };

  // Handle responsive visibility
  const getVisibilityClasses = () => {
    const classes = [];
    
    if (isMobile) {
      classes.push('show-mobile', 'hide-tablet', 'hide-desktop');
    } else if (isTablet) {
      classes.push('hide-mobile', 'show-tablet', 'hide-desktop');
    } else if (isDesktop) {
      classes.push('hide-mobile', 'hide-tablet', 'show-desktop');
    }
    
    return classes;
  };

  // Apply responsive navigation
  const renderNavigation = () => {
    if (navigation === 'mobile' && isMobile) {
      return (
        <nav className="mobile-navigation">
          <button className="menu-toggle" aria-label="Toggle menu">
            ☰
          </button>
          <div className="nav-items mobile-hidden">
            {/* Navigation items would be passed as children or props */}
          </div>
        </nav>
      );
    }
    return null;
  };

  return (
    <div
      ref={layoutRef}
      data-testid="responsive-layout"
      data-breakpoint={breakpoint}
      data-orientation={orientation}
      className={getLayoutClasses()}
      style={{
        display: variant === 'grid' ? 'grid' : 'block',
        gap: variant === 'grid' ? '1rem' : undefined,
      }}
    >
      {renderNavigation()}
      {React.Children.map(children, (child, index) => {
        if (React.isValidElement(child)) {
          // Add responsive visibility classes to children if needed
          const visibilityClasses = getVisibilityClasses();
          const childClassName = child.props.className || '';
          
          // Check if child has responsive visibility classes
          const hasVisibilityClass = visibilityClasses.some(cls => 
            childClassName.includes(cls.replace('show-', '').replace('hide-', ''))
          );
          
          if (hasVisibilityClass) {
            return React.cloneElement(child, {
              ...child.props,
              style: {
                ...child.props.style,
                display: childClassName.includes('mobile-only') && !isMobile ? 'none' :
                        childClassName.includes('tablet-only') && !isTablet ? 'none' :
                        childClassName.includes('desktop-only') && !isDesktop ? 'none' :
                        undefined,
              },
            });
          }
        }
        return child;
      })}
    </div>
  );
};
