/**
 * Object Comparison Matcher
 * 
 * TDD Phase: GREEN - Minimal implementation to make object comparison tests pass
 * Task: 1.1.3 - Fix Assertion Methods (Priority 4)
 * 
 * This class provides:
 * - Deep object comparison utilities
 * - Array object search functions
 * - Partial object matching
 * - Nested array object finding
 */

export class ObjectComparisonMatcher {
  private isInitialized: boolean = false;

  constructor() {}

  /**
   * Initialize matcher
   * GREEN: Basic initialization
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    this.isInitialized = true;
  }

  /**
   * Reset matcher
   * GREEN: Basic reset
   */
  reset(): void {
    // Reset any state if needed
  }

  /**
   * Cleanup matcher
   * GREEN: Basic cleanup
   */
  async cleanup(): Promise<void> {
    this.isInitialized = false;
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
   * Check if array contains object with partial matching
   * GREEN: Partial object matching
   */
  arrayContainsObjectPartial(array: any[], partialObject: any): boolean {
    if (!Array.isArray(array)) {
      return false;
    }

    return array.some(item => this.partialMatch(item, partialObject));
  }

  /**
   * Deep equality comparison
   * GREEN: Comprehensive deep comparison
   */
  deepEqual(obj1: any, obj2: any): boolean {
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

    if (Array.isArray(obj1)) {
      if (obj1.length !== obj2.length) {
        return false;
      }
      
      for (let i = 0; i < obj1.length; i++) {
        if (!this.deepEqual(obj1[i], obj2[i])) {
          return false;
        }
      }
      
      return true;
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
   * Partial object matching
   * GREEN: Check if object contains all properties of partial object
   */
  partialMatch(fullObject: any, partialObject: any): boolean {
    if (partialObject == null) {
      return fullObject == null;
    }

    if (typeof partialObject !== 'object') {
      return fullObject === partialObject;
    }

    if (fullObject == null || typeof fullObject !== 'object') {
      return false;
    }

    for (const key in partialObject) {
      if (!(key in fullObject)) {
        return false;
      }

      if (!this.deepEqual(fullObject[key], partialObject[key])) {
        return false;
      }
    }

    return true;
  }

  /**
   * Find object in nested array
   * GREEN: Search for object in nested array structure
   */
  findObjectInNestedArray(
    parentArray: any[], 
    nestedArrayProperty: string, 
    targetObject: any
  ): any | null {
    if (!Array.isArray(parentArray)) {
      return null;
    }

    for (const parentItem of parentArray) {
      if (parentItem && 
          typeof parentItem === 'object' && 
          nestedArrayProperty in parentItem) {
        
        const nestedArray = parentItem[nestedArrayProperty];
        
        if (Array.isArray(nestedArray) && 
            this.arrayContainsObject(nestedArray, targetObject)) {
          return parentItem;
        }
      }
    }

    return null;
  }

  /**
   * Compare objects with custom comparison function
   * GREEN: Custom comparison support
   */
  compareWithCustomFunction(
    obj1: any, 
    obj2: any, 
    compareFn: (a: any, b: any) => boolean
  ): boolean {
    return compareFn(obj1, obj2);
  }

  /**
   * Get object differences
   * GREEN: Find differences between objects
   */
  getObjectDifferences(obj1: any, obj2: any): {
    added: string[];
    removed: string[];
    modified: string[];
    unchanged: string[];
  } {
    const result = {
      added: [] as string[],
      removed: [] as string[],
      modified: [] as string[],
      unchanged: [] as string[]
    };

    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
      return result;
    }

    const keys1 = Object.keys(obj1 || {});
    const keys2 = Object.keys(obj2 || {});
    const allKeys = new Set([...keys1, ...keys2]);

    for (const key of allKeys) {
      const hasKey1 = key in (obj1 || {});
      const hasKey2 = key in (obj2 || {});

      if (!hasKey1 && hasKey2) {
        result.added.push(key);
      } else if (hasKey1 && !hasKey2) {
        result.removed.push(key);
      } else if (hasKey1 && hasKey2) {
        if (this.deepEqual(obj1[key], obj2[key])) {
          result.unchanged.push(key);
        } else {
          result.modified.push(key);
        }
      }
    }

    return result;
  }

  /**
   * Check if objects are structurally similar
   * GREEN: Structural comparison (same keys, different values allowed)
   */
  structurallySimilar(obj1: any, obj2: any): boolean {
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
      return typeof obj1 === typeof obj2;
    }

    if (obj1 == null || obj2 == null) {
      return obj1 === obj2;
    }

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) {
      return false;
    }

    return keys1.every(key => keys2.includes(key));
  }

  /**
   * Find all matching objects in array
   * GREEN: Find all objects that match criteria
   */
  findAllMatchingObjects(
    array: any[], 
    matchCriteria: any, 
    usePartialMatch: boolean = false
  ): any[] {
    if (!Array.isArray(array)) {
      return [];
    }

    return array.filter(item => {
      if (usePartialMatch) {
        return this.partialMatch(item, matchCriteria);
      } else {
        return this.deepEqual(item, matchCriteria);
      }
    });
  }

  /**
   * Get matcher statistics
   * GREEN: Usage statistics
   */
  getStatistics(): {
    initialized: boolean;
    supportedOperations: string[];
  } {
    return {
      initialized: this.isInitialized,
      supportedOperations: [
        'arrayContainsObject',
        'arrayContainsObjectPartial',
        'deepEqual',
        'partialMatch',
        'findObjectInNestedArray',
        'getObjectDifferences',
        'structurallySimilar',
        'findAllMatchingObjects'
      ]
    };
  }

  /**
   * Validate matcher state
   * GREEN: State validation
   */
  validateState(): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (!this.isInitialized) {
      issues.push('Object comparison matcher not initialized');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }
}

export default ObjectComparisonMatcher;
