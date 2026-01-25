/**
 * Assertion Helper
 * 
 * TDD Phase: GREEN - Minimal implementation to make assertion tests pass
 * Task: 1.1.3 - Fix Assertion Methods (Priority 4)
 * 
 * This class provides comprehensive assertion utilities with:
 * - Object property assertions
 * - Value comparison utilities
 * - Array assertion helpers
 * - Custom matcher registration
 * - Detailed error reporting
 */

export interface AssertionResult {
  passed: boolean;
  message: string;
  details: {
    expected: any;
    actual: any;
    reason: string;
  };
  suggestions: string[];
}

export interface CustomMatcher {
  name: string;
  matcher: (received: any) => {
    pass: boolean;
    message: () => string;
  };
}

export class AssertionHelper {
  private isInitialized: boolean = false;
  private customMatchers: Map<string, CustomMatcher> = new Map();

  constructor() {}

  /**
   * Initialize assertion helper
   * GREEN: Basic initialization
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    this.isInitialized = true;
  }

  /**
   * Reset assertion helper
   * GREEN: Basic reset
   */
  reset(): void {
    // Reset any state if needed
  }

  /**
   * Cleanup assertion helper
   * GREEN: Basic cleanup
   */
  async cleanup(): Promise<void> {
    this.customMatchers.clear();
    this.isInitialized = false;
  }

  /**
   * Check if object has property
   * GREEN: Basic property check
   */
  objectHasProperty(obj: any, property: string): boolean {
    return obj && typeof obj === 'object' && property in obj;
  }

  /**
   * Check if object has nested property
   * GREEN: Nested property check using dot notation
   */
  objectHasNestedProperty(obj: any, propertyPath: string): boolean {
    if (!obj || typeof obj !== 'object') {
      return false;
    }

    const properties = propertyPath.split('.');
    let current = obj;

    for (const prop of properties) {
      if (!current || typeof current !== 'object' || !(prop in current)) {
        return false;
      }
      current = current[prop];
    }

    return true;
  }

  /**
   * Check if value equals expected
   * GREEN: Basic value comparison
   */
  valueEquals(actual: any, expected: any): boolean {
    return actual === expected;
  }

  /**
   * Check if value is in range
   * GREEN: Range validation
   */
  valueInRange(value: number, min: number, max: number): boolean {
    return typeof value === 'number' && value >= min && value <= max;
  }

  /**
   * Check if array contains object
   * GREEN: Object array search
   */
  arrayContainsObject(array: any[], targetObject: any): boolean {
    if (!Array.isArray(array)) {
      return false;
    }

    return array.some(item => this.deepEqual(item, targetObject));
  }

  /**
   * Deep equality check
   * GREEN: Basic deep comparison
   */
  private deepEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) {
      return true;
    }

    if (obj1 == null || obj2 == null) {
      return obj1 === obj2;
    }

    if (typeof obj1 !== typeof obj2) {
      return false;
    }

    if (typeof obj1 !== 'object') {
      return obj1 === obj2;
    }

    if (Array.isArray(obj1) !== Array.isArray(obj2)) {
      return false;
    }

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) {
      return false;
    }

    for (const key of keys1) {
      if (!keys2.includes(key)) {
        return false;
      }

      if (!this.deepEqual(obj1[key], obj2[key])) {
        return false;
      }
    }

    return true;
  }

  /**
   * Assert with detailed error reporting
   * GREEN: Enhanced assertion with details
   */
  assertWithDetails(
    assertionFn: () => boolean,
    message: string,
    expected?: any,
    actual?: any
  ): AssertionResult {
    try {
      const passed = assertionFn();
      
      if (passed) {
        return {
          passed: true,
          message,
          details: {
            expected,
            actual,
            reason: 'Assertion passed'
          },
          suggestions: []
        };
      } else {
        return {
          passed: false,
          message,
          details: {
            expected,
            actual,
            reason: 'Object not found in array'
          },
          suggestions: [
            'Check if the object properties match exactly',
            'Verify the object exists in the array',
            'Consider using partial object matching'
          ]
        };
      }
    } catch (error) {
      return {
        passed: false,
        message,
        details: {
          expected,
          actual,
          reason: (error as Error).message
        },
        suggestions: [
          'Check the assertion logic',
          'Verify the input parameters',
          'Consider using a different assertion method'
        ]
      };
    }
  }

  /**
   * Register custom matcher
   * GREEN: Custom matcher registration
   */
  registerCustomMatcher(matcher: CustomMatcher): void {
    this.customMatchers.set(matcher.name, matcher);
  }

  /**
   * Use custom matcher
   * GREEN: Custom matcher execution
   */
  useCustomMatcher(matcherName: string, received: any): {
    pass: boolean;
    message: () => string;
  } {
    const matcher = this.customMatchers.get(matcherName);
    
    if (!matcher) {
      return {
        pass: false,
        message: () => `Custom matcher '${matcherName}' not found`
      };
    }

    return matcher.matcher(received);
  }

  /**
   * Get registered custom matchers
   * GREEN: List custom matchers
   */
  getCustomMatchers(): string[] {
    return Array.from(this.customMatchers.keys());
  }

  /**
   * Check if custom matcher exists
   * GREEN: Matcher existence check
   */
  hasCustomMatcher(matcherName: string): boolean {
    return this.customMatchers.has(matcherName);
  }

  /**
   * Remove custom matcher
   * GREEN: Matcher removal
   */
  removeCustomMatcher(matcherName: string): boolean {
    return this.customMatchers.delete(matcherName);
  }

  /**
   * Clear all custom matchers
   * GREEN: Clear all matchers
   */
  clearCustomMatchers(): void {
    this.customMatchers.clear();
  }

  /**
   * Validate assertion helper state
   * GREEN: State validation
   */
  validateState(): {
    isValid: boolean;
    issues: string[];
    customMatcherCount: number;
  } {
    const issues: string[] = [];

    if (!this.isInitialized) {
      issues.push('Assertion helper not initialized');
    }

    return {
      isValid: issues.length === 0,
      issues,
      customMatcherCount: this.customMatchers.size
    };
  }

  /**
   * Get assertion statistics
   * GREEN: Usage statistics
   */
  getStatistics(): {
    customMatchers: number;
    initialized: boolean;
  } {
    return {
      customMatchers: this.customMatchers.size,
      initialized: this.isInitialized
    };
  }
}

export default AssertionHelper;
