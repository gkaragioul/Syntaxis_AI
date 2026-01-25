import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResponsiveLayout } from '../../components/Layout/ResponsiveLayout';
import { useResponsive } from '../../hooks/useResponsive';

// Mock the useResponsive hook
vi.mock('../../hooks/useResponsive');
const mockUseResponsive = vi.mocked(useResponsive);

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('ResponsiveLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render mobile layout on small screens', () => {
    mockUseResponsive.mockReturnValue({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      breakpoint: 'mobile',
      screenSize: { width: 375, height: 667 },
      orientation: 'portrait',
    });

    render(
      <ResponsiveLayout>
        <div data-testid="content">Test Content</div>
      </ResponsiveLayout>
    );

    const layout = screen.getByTestId('responsive-layout');
    expect(layout).toHaveClass('mobile-layout');
    expect(layout).toHaveAttribute('data-breakpoint', 'mobile');
  });

  it('should render tablet layout on medium screens', () => {
    mockUseResponsive.mockReturnValue({
      isMobile: false,
      isTablet: true,
      isDesktop: false,
      breakpoint: 'tablet',
      screenSize: { width: 768, height: 1024 },
      orientation: 'portrait',
    });

    render(
      <ResponsiveLayout>
        <div data-testid="content">Test Content</div>
      </ResponsiveLayout>
    );

    const layout = screen.getByTestId('responsive-layout');
    expect(layout).toHaveClass('tablet-layout');
    expect(layout).toHaveAttribute('data-breakpoint', 'tablet');
  });

  it('should render desktop layout on large screens', () => {
    mockUseResponsive.mockReturnValue({
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      breakpoint: 'desktop',
      screenSize: { width: 1920, height: 1080 },
      orientation: 'landscape',
    });

    render(
      <ResponsiveLayout>
        <div data-testid="content">Test Content</div>
      </ResponsiveLayout>
    );

    const layout = screen.getByTestId('responsive-layout');
    expect(layout).toHaveClass('desktop-layout');
    expect(layout).toHaveAttribute('data-breakpoint', 'desktop');
  });

  it('should handle orientation changes', () => {
    const { rerender } = render(
      <ResponsiveLayout>
        <div data-testid="content">Test Content</div>
      </ResponsiveLayout>
    );

    // Start with portrait
    mockUseResponsive.mockReturnValue({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      breakpoint: 'mobile',
      screenSize: { width: 375, height: 667 },
      orientation: 'portrait',
    });

    rerender(
      <ResponsiveLayout>
        <div data-testid="content">Test Content</div>
      </ResponsiveLayout>
    );

    let layout = screen.getByTestId('responsive-layout');
    expect(layout).toHaveAttribute('data-orientation', 'portrait');

    // Change to landscape
    mockUseResponsive.mockReturnValue({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      breakpoint: 'mobile',
      screenSize: { width: 667, height: 375 },
      orientation: 'landscape',
    });

    rerender(
      <ResponsiveLayout>
        <div data-testid="content">Test Content</div>
      </ResponsiveLayout>
    );

    layout = screen.getByTestId('responsive-layout');
    expect(layout).toHaveAttribute('data-orientation', 'landscape');
  });

  it('should apply responsive grid layout', () => {
    mockUseResponsive.mockReturnValue({
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      breakpoint: 'desktop',
      screenSize: { width: 1920, height: 1080 },
      orientation: 'landscape',
    });

    render(
      <ResponsiveLayout variant="grid" columns={{ mobile: 1, tablet: 2, desktop: 3 }}>
        <div data-testid="item-1">Item 1</div>
        <div data-testid="item-2">Item 2</div>
        <div data-testid="item-3">Item 3</div>
      </ResponsiveLayout>
    );

    const layout = screen.getByTestId('responsive-layout');
    expect(layout).toHaveClass('grid-layout');
    expect(layout).toHaveStyle('grid-template-columns: repeat(3, 1fr)');
  });

  it('should handle responsive spacing', () => {
    mockUseResponsive.mockReturnValue({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      breakpoint: 'mobile',
      screenSize: { width: 375, height: 667 },
      orientation: 'portrait',
    });

    render(
      <ResponsiveLayout 
        spacing={{ mobile: 'sm', tablet: 'md', desktop: 'lg' }}
      >
        <div data-testid="content">Test Content</div>
      </ResponsiveLayout>
    );

    const layout = screen.getByTestId('responsive-layout');
    expect(layout).toHaveClass('spacing-sm');
  });

  it('should support responsive visibility', () => {
    mockUseResponsive.mockReturnValue({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      breakpoint: 'mobile',
      screenSize: { width: 375, height: 667 },
      orientation: 'portrait',
    });

    render(
      <ResponsiveLayout>
        <div data-testid="mobile-only" className="show-mobile hide-tablet hide-desktop">
          Mobile Only
        </div>
        <div data-testid="desktop-only" className="hide-mobile hide-tablet show-desktop">
          Desktop Only
        </div>
      </ResponsiveLayout>
    );

    const mobileOnly = screen.getByTestId('mobile-only');
    const desktopOnly = screen.getByTestId('desktop-only');

    expect(mobileOnly).toBeVisible();
    expect(desktopOnly).not.toBeVisible();
  });

  it('should handle responsive typography', () => {
    mockUseResponsive.mockReturnValue({
      isMobile: false,
      isTablet: true,
      isDesktop: false,
      breakpoint: 'tablet',
      screenSize: { width: 768, height: 1024 },
      orientation: 'portrait',
    });

    render(
      <ResponsiveLayout 
        typography={{ 
          mobile: { fontSize: '14px', lineHeight: '1.4' },
          tablet: { fontSize: '16px', lineHeight: '1.5' },
          desktop: { fontSize: '18px', lineHeight: '1.6' }
        }}
      >
        <div data-testid="content">Test Content</div>
      </ResponsiveLayout>
    );

    const layout = screen.getByTestId('responsive-layout');
    expect(layout).toHaveStyle('font-size: 16px');
    expect(layout).toHaveStyle('line-height: 1.5');
  });

  it('should support responsive container queries', () => {
    mockUseResponsive.mockReturnValue({
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      breakpoint: 'desktop',
      screenSize: { width: 1920, height: 1080 },
      orientation: 'landscape',
    });

    render(
      <ResponsiveLayout 
        containerQuery
        containerBreakpoints={{ small: 300, medium: 600, large: 900 }}
      >
        <div data-testid="content">Test Content</div>
      </ResponsiveLayout>
    );

    const layout = screen.getByTestId('responsive-layout');
    expect(layout).toHaveStyle('container-type: inline-size');
  });

  it('should handle responsive images', () => {
    mockUseResponsive.mockReturnValue({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      breakpoint: 'mobile',
      screenSize: { width: 375, height: 667 },
      orientation: 'portrait',
    });

    render(
      <ResponsiveLayout>
        <img 
          data-testid="responsive-image"
          src="image-mobile.jpg"
          srcSet="image-mobile.jpg 375w, image-tablet.jpg 768w, image-desktop.jpg 1920w"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          alt="Responsive test image"
        />
      </ResponsiveLayout>
    );

    const image = screen.getByTestId('responsive-image');
    expect(image).toHaveAttribute('srcSet');
    expect(image).toHaveAttribute('sizes');
  });

  it('should support responsive navigation', () => {
    mockUseResponsive.mockReturnValue({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      breakpoint: 'mobile',
      screenSize: { width: 375, height: 667 },
      orientation: 'portrait',
    });

    render(
      <ResponsiveLayout navigation="mobile">
        <nav data-testid="navigation">
          <button data-testid="menu-toggle">☰</button>
          <div data-testid="nav-items" className="mobile-hidden">
            <a href="#home">Home</a>
            <a href="#about">About</a>
          </div>
        </nav>
      </ResponsiveLayout>
    );

    const menuToggle = screen.getByTestId('menu-toggle');
    const navItems = screen.getByTestId('nav-items');

    expect(menuToggle).toBeVisible();
    expect(navItems).toHaveClass('mobile-hidden');
  });

  it('should handle responsive form layouts', () => {
    mockUseResponsive.mockReturnValue({
      isMobile: false,
      isTablet: true,
      isDesktop: false,
      breakpoint: 'tablet',
      screenSize: { width: 768, height: 1024 },
      orientation: 'portrait',
    });

    render(
      <ResponsiveLayout variant="form">
        <form data-testid="responsive-form">
          <div className="form-row">
            <input data-testid="input-1" placeholder="Field 1" />
            <input data-testid="input-2" placeholder="Field 2" />
          </div>
        </form>
      </ResponsiveLayout>
    );

    const form = screen.getByTestId('responsive-form');
    expect(form.closest('[data-testid="responsive-layout"]')).toHaveClass('form-layout');
  });

  it('should support responsive touch targets', () => {
    mockUseResponsive.mockReturnValue({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      breakpoint: 'mobile',
      screenSize: { width: 375, height: 667 },
      orientation: 'portrait',
    });

    render(
      <ResponsiveLayout touchOptimized>
        <button data-testid="touch-button">Touch Me</button>
      </ResponsiveLayout>
    );

    const button = screen.getByTestId('touch-button');
    const layout = screen.getByTestId('responsive-layout');
    
    expect(layout).toHaveClass('touch-optimized');
    expect(button).toHaveStyle('min-height: 44px'); // iOS touch target minimum
  });
});
