# Onboarding Accessibility Guide

## Overview

The SyntaxisAI onboarding flow is designed to be fully accessible to users with disabilities, following WCAG 2.1 AA guidelines and modern accessibility best practices.

## Accessibility Features

### 1. Keyboard Navigation
- **Full keyboard support**: All interactive elements are accessible via keyboard
- **Logical tab order**: Focus moves in a predictable sequence
- **Arrow key navigation**: Use arrow keys to navigate between steps
- **Escape key support**: Close dialogs and cancel operations
- **Enter/Space activation**: Activate buttons and controls

### 2. Screen Reader Support
- **ARIA labels**: Comprehensive labeling for all interactive elements
- **Live regions**: Dynamic content changes are announced
- **Semantic markup**: Proper heading structure and landmarks
- **Progress announcements**: Step completion and navigation updates
- **Error announcements**: Clear error messages and recovery instructions

### 3. Visual Accessibility
- **High contrast mode**: Enhanced color contrast for better visibility
- **Focus indicators**: Clear visual focus indicators for keyboard users
- **Reduced motion**: Respects user's motion preferences
- **Scalable text**: Supports browser zoom up to 200%
- **Color independence**: Information not conveyed by color alone

### 4. Motor Accessibility
- **Large touch targets**: Minimum 44px touch targets on mobile
- **Generous spacing**: Adequate spacing between interactive elements
- **Timeout extensions**: No time limits on onboarding steps
- **Error prevention**: Clear instructions and validation messages

## Implementation Details

### ARIA Attributes

#### Dialog Structure
```tsx
<Dialog
  role="dialog"
  aria-modal="true"
  aria-labelledby="onboarding-title"
  aria-describedby="onboarding-description"
>
  <DialogTitle id="onboarding-title">
    Getting Started with SyntaxisAI
  </DialogTitle>
  <DialogContent id="onboarding-description">
    {/* Content */}
  </DialogContent>
</Dialog>
```

#### Progress Indicator
```tsx
<Box
  role="progressbar"
  aria-valuenow={currentStep}
  aria-valuemin={0}
  aria-valuemax={totalSteps}
  aria-valuetext={`Step ${currentStep} of ${totalSteps}, ${percentage}% complete`}
>
  <Typography aria-live="polite">
    Step {currentStep} of {totalSteps}
  </Typography>
</Box>
```

#### Step Navigation
```tsx
<Stepper role="tablist" aria-label="Onboarding progress">
  {steps.map((step, index) => (
    <Step key={step.id}>
      <StepLabel
        aria-current={activeStep === index ? 'step' : undefined}
        aria-label={`${step.label}${
          completedSteps.includes(step.id) ? ' - completed' : ''
        }${activeStep === index ? ' - current step' : ''}`}
      >
        {step.label}
      </StepLabel>
    </Step>
  ))}
</Stepper>
```

#### Step Content
```tsx
<Paper
  role="tabpanel"
  aria-labelledby={`step-${activeStep}-label`}
  aria-describedby={`step-${activeStep}-description`}
  tabIndex={-1}
>
  <Typography
    id={`step-${activeStep}-label`}
    variant="h2"
    component="h2"
  >
    {steps[activeStep].label}
  </Typography>
  <Box id={`step-${activeStep}-description`}>
    {/* Step content */}
  </Box>
</Paper>
```

### Live Regions

#### Announcements
```tsx
// Hidden live region for announcements
<div
  id="onboarding-live-region"
  aria-live="polite"
  aria-atomic="true"
  style={{
    position: 'absolute',
    left: '-10000px',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
  }}
/>

// Usage in components
const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
  const liveRegion = document.getElementById('onboarding-live-region');
  if (liveRegion) {
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.textContent = message;
  }
};
```

#### Error Messages
```tsx
<Alert
  severity="error"
  role="alert"
  aria-live="assertive"
>
  {error}
</Alert>
```

### Keyboard Navigation

#### Event Handling
```tsx
const handleKeyDown = (event: KeyboardEvent) => {
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      event.preventDefault();
      focusNext();
      break;
    
    case 'ArrowLeft':
    case 'ArrowUp':
      event.preventDefault();
      focusPrevious();
      break;
    
    case 'Home':
      event.preventDefault();
      focusFirst();
      break;
    
    case 'End':
      event.preventDefault();
      focusLast();
      break;
    
    case 'Escape':
      handleClose();
      break;
  }
};
```

#### Focus Management
```tsx
const focusElement = (element: HTMLElement) => {
  if (element.tabIndex < 0) {
    element.tabIndex = -1;
  }
  element.focus();
};

const getFocusableElements = (container: HTMLElement) => {
  const selectors = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');
  
  return Array.from(container.querySelectorAll(selectors));
};
```

### Visual Accessibility

#### High Contrast Mode
```css
.high-contrast {
  --primary-color: #000000;
  --secondary-color: #ffffff;
  --accent-color: #ffff00;
  --error-color: #ff0000;
  --success-color: #00ff00;
}

.high-contrast .MuiButton-contained {
  background-color: var(--primary-color) !important;
  color: var(--secondary-color) !important;
  border: 2px solid var(--primary-color) !important;
}

.high-contrast .MuiButton-contained:focus {
  outline: 3px solid var(--accent-color) !important;
  outline-offset: 2px !important;
}
```

#### Reduced Motion
```css
.reduced-motion * {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
}

@media (prefers-reduced-motion: reduce) {
  .onboarding-dialog * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

#### Focus Indicators
```css
.enhanced-focus *:focus {
  outline: 3px solid #1976d2 !important;
  outline-offset: 2px !important;
  border-radius: 4px !important;
}

.keyboard-navigation .MuiButton-root:focus-visible {
  outline: 3px solid #1976d2 !important;
  outline-offset: 2px !important;
  box-shadow: 0 0 0 1px #fff, 0 0 0 4px #1976d2 !important;
}
```

## Testing Accessibility

### Automated Testing

#### Jest + Testing Library
```tsx
import { axe, toHaveNoViolations } from 'jest-axe';
import { render, screen } from '@testing-library/react';

expect.extend(toHaveNoViolations);

describe('OnboardingFlow Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<OnboardingFlow open={true} onClose={jest.fn()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA labels', () => {
    render(<OnboardingFlow open={true} onClose={jest.fn()} />);
    
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow');
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-label');
  });

  it('should announce step changes', async () => {
    const { rerender } = render(<OnboardingFlow open={true} onClose={jest.fn()} />);
    
    // Simulate step change
    rerender(<OnboardingFlow open={true} onClose={jest.fn()} />);
    
    // Check for live region updates
    const liveRegion = document.getElementById('onboarding-live-region');
    expect(liveRegion).toHaveTextContent(/step/i);
  });
});
```

#### Cypress Accessibility Tests
```typescript
// cypress/integration/onboarding-a11y.spec.ts
describe('Onboarding Accessibility', () => {
  beforeEach(() => {
    cy.visit('/onboarding');
    cy.injectAxe();
  });

  it('should have no accessibility violations', () => {
    cy.checkA11y();
  });

  it('should be navigable by keyboard', () => {
    cy.get('[data-testid="onboarding-dialog"]').should('be.visible');
    
    // Tab through all focusable elements
    cy.get('body').tab();
    cy.focused().should('have.attr', 'aria-label');
    
    // Test arrow key navigation
    cy.focused().type('{rightarrow}');
    cy.focused().should('not.be', cy.get('body'));
  });

  it('should work with screen reader', () => {
    // Test with screen reader simulation
    cy.get('[role="dialog"]').should('have.attr', 'aria-labelledby');
    cy.get('[role="progressbar"]').should('have.attr', 'aria-valuetext');
    cy.get('[aria-live="polite"]').should('exist');
  });
});
```

### Manual Testing

#### Screen Reader Testing
1. **NVDA (Windows)**
   - Download and install NVDA
   - Navigate through onboarding with screen reader active
   - Verify all content is announced correctly

2. **JAWS (Windows)**
   - Test with JAWS screen reader
   - Check virtual cursor navigation
   - Verify form mode interactions

3. **VoiceOver (macOS)**
   - Enable VoiceOver (Cmd + F5)
   - Test rotor navigation
   - Verify gesture support

4. **TalkBack (Android)**
   - Enable TalkBack in accessibility settings
   - Test touch exploration
   - Verify swipe navigation

#### Keyboard Testing
1. **Tab Navigation**
   - Tab through all interactive elements
   - Verify logical tab order
   - Check focus indicators are visible

2. **Arrow Key Navigation**
   - Test arrow key navigation between steps
   - Verify Home/End key functionality
   - Check Escape key behavior

3. **Screen Magnification**
   - Test with 200% browser zoom
   - Verify content remains accessible
   - Check for horizontal scrolling issues

#### Color and Contrast Testing
1. **Color Blindness Simulation**
   - Test with color blindness simulators
   - Verify information isn't color-dependent
   - Check alternative indicators

2. **High Contrast Mode**
   - Enable system high contrast mode
   - Test custom high contrast styles
   - Verify readability

3. **Contrast Ratio Testing**
   - Use tools like WebAIM Contrast Checker
   - Verify WCAG AA compliance (4.5:1 ratio)
   - Test with different background colors

## User Preferences

### Detecting User Preferences
```typescript
const checkAccessibilityPreferences = () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
  const prefersLargeText = window.matchMedia('(min-resolution: 192dpi)').matches;
  
  return {
    reducedMotion: prefersReducedMotion,
    highContrast: prefersHighContrast,
    largeText: prefersLargeText,
  };
};
```

### Applying Preferences
```typescript
const applyAccessibilityPreferences = (preferences: AccessibilityPreferences) => {
  const root = document.documentElement;
  
  if (preferences.reducedMotion) {
    root.classList.add('reduced-motion');
  }
  
  if (preferences.highContrast) {
    root.classList.add('high-contrast');
  }
  
  if (preferences.largeText) {
    root.classList.add('large-text');
  }
};
```

## Common Issues and Solutions

### Issue: Focus Lost During Step Transitions
**Solution:** Manage focus explicitly
```typescript
useEffect(() => {
  if (activeStep >= 0) {
    const stepContent = document.getElementById(`step-${activeStep}-content`);
    if (stepContent) {
      stepContent.focus();
    }
  }
}, [activeStep]);
```

### Issue: Screen Reader Not Announcing Changes
**Solution:** Use proper live regions
```typescript
const announce = (message: string) => {
  const liveRegion = document.getElementById('onboarding-live-region');
  if (liveRegion) {
    // Clear and then set to ensure announcement
    liveRegion.textContent = '';
    setTimeout(() => {
      liveRegion.textContent = message;
    }, 100);
  }
};
```

### Issue: Keyboard Trap in Modal
**Solution:** Implement proper focus management
```typescript
const trapFocus = (container: HTMLElement) => {
  const focusableElements = getFocusableElements(container);
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  container.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  });
};
```

## Resources

### Tools
- **axe DevTools**: Browser extension for accessibility testing
- **WAVE**: Web accessibility evaluation tool
- **Lighthouse**: Built-in Chrome accessibility audit
- **Color Oracle**: Color blindness simulator
- **Screen Reader Testing**: NVDA, JAWS, VoiceOver, TalkBack

### Guidelines
- **WCAG 2.1**: Web Content Accessibility Guidelines
- **ARIA Authoring Practices**: WAI-ARIA design patterns
- **Section 508**: US federal accessibility standards
- **EN 301 549**: European accessibility standard

### Testing Checklist
- [ ] All interactive elements are keyboard accessible
- [ ] Focus indicators are visible and clear
- [ ] Screen reader announces all content correctly
- [ ] Color contrast meets WCAG AA standards
- [ ] Content is readable at 200% zoom
- [ ] Motion respects user preferences
- [ ] Error messages are clear and helpful
- [ ] Form labels are properly associated
- [ ] Headings create logical structure
- [ ] Images have appropriate alt text
