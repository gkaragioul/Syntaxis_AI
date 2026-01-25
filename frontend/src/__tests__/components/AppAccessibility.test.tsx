import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, it, expect } from 'vitest';
import App from '../../App';

expect.extend(toHaveNoViolations);

describe('Accessibility – App', () => {
  it('should have no detectable accessibility violations', async () => {
    const { container } = render(<App />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
}); 