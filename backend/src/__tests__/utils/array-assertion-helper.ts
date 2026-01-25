/**
 * Array Assertion Helper
 * 
 * TDD Phase: GREEN - Minimal implementation to make array assertion tests pass
 * Task: 1.1.3 - Fix Assertion Methods (Priority 4)
 * 
 * This class provides:
 * - Array subset and superset operations
 * - Array length validation
 * - Object array filtering and grouping
 * - Array intersection and difference operations
 */

export interface LengthConstraints {
  min?: number;
  max?: number;
  exact?: number;
}

export interface LengthValidationResult {
  isValid: boolean;
  actualLength: number;
  constraints: LengthConstraints;
}

export interface FilterResult<T> {
  filtered: T[];
  count: number;
  meetsConstraints: boolean;
}

export interface GroupResult<T> {
  groups: Record<string, T[]>;
  hasExpectedGroups: boolean;
  groupCount: number;
}

export class ArrayAssertionHelper {
  private isInitialized: boolean = false;

  constructor() {}

  /**
   * Initialize helper
   * GREEN: Basic initialization
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    this.isInitialized = true;
  }

  /**
   * Reset helper
   * GREEN: Basic reset
   */
  reset(): void {
    // Reset any state if needed
  }

  /**
   * Cleanup helper
   * GREEN: Basic cleanup
   */
  async cleanup(): Promise<void> {
    this.isInitialized = false;
  }

  /**
   * Check if array contains all specified elements
   * GREEN: Array contains all check
   */
  containsAll<T>(array: T[], elements: T[]): boolean {
    if (!Array.isArray(array) || !Array.isArray(elements)) {
      return false;
    }

    return elements.every(element => array.includes(element));
  }

  /**
   * Check if array contains any of the specified elements
   * GREEN: Array contains any check
   */
  containsAny<T>(array: T[], elements: T[]): boolean {
    if (!Array.isArray(array) || !Array.isArray(elements)) {
      return false;
    }

    return elements.some(element => array.includes(element));
  }

  /**
   * Check if array contains object with specified properties
   * GREEN: Object property matching
   */
  containsObjectWithProperties(array: any[], properties: Record<string, any>): boolean {
    if (!Array.isArray(array)) {
      return false;
    }

    return array.some(item => {
      if (typeof item !== 'object' || item === null) {
        return false;
      }

      return Object.entries(properties).every(([key, value]) => {
        return item[key] === value;
      });
    });
  }

  /**
   * Validate array length
   * GREEN: Length validation with constraints
   */
  validateLength(array: any[], constraints: LengthConstraints): LengthValidationResult {
    if (!Array.isArray(array)) {
      return {
        isValid: false,
        actualLength: 0,
        constraints
      };
    }

    const actualLength = array.length;
    let isValid = true;

    if (constraints.exact !== undefined) {
      isValid = actualLength === constraints.exact;
    } else {
      if (constraints.min !== undefined && actualLength < constraints.min) {
        isValid = false;
      }
      if (constraints.max !== undefined && actualLength > constraints.max) {
        isValid = false;
      }
    }

    return {
      isValid,
      actualLength,
      constraints
    };
  }

  /**
   * Check if array is subset of another array
   * GREEN: Subset validation
   */
  isSubset<T>(parentArray: T[], subsetArray: T[]): boolean {
    if (!Array.isArray(parentArray) || !Array.isArray(subsetArray)) {
      return false;
    }

    return subsetArray.every(element => parentArray.includes(element));
  }

  /**
   * Check if array is superset of another array
   * GREEN: Superset validation
   */
  isSuperset<T>(supersetArray: T[], subsetArray: T[]): boolean {
    return this.isSubset(supersetArray, subsetArray);
  }

  /**
   * Get intersection of two arrays
   * GREEN: Array intersection
   */
  getIntersection<T>(array1: T[], array2: T[]): T[] {
    if (!Array.isArray(array1) || !Array.isArray(array2)) {
      return [];
    }

    return array1.filter(element => array2.includes(element));
  }

  /**
   * Get difference between two arrays
   * GREEN: Array difference
   */
  getDifference<T>(array1: T[], array2: T[]): T[] {
    if (!Array.isArray(array1) || !Array.isArray(array2)) {
      return Array.isArray(array1) ? [...array1] : [];
    }

    return array1.filter(element => !array2.includes(element));
  }

  /**
   * Filter array and assert constraints
   * GREEN: Filter with constraint validation
   */
  filterAndAssert<T>(
    array: T[], 
    filterFn: (item: T) => boolean, 
    constraints: { minCount?: number; maxCount?: number }
  ): FilterResult<T> {
    if (!Array.isArray(array)) {
      return {
        filtered: [],
        count: 0,
        meetsConstraints: false
      };
    }

    const filtered = array.filter(filterFn);
    const count = filtered.length;

    let meetsConstraints = true;
    if (constraints.minCount !== undefined && count < constraints.minCount) {
      meetsConstraints = false;
    }
    if (constraints.maxCount !== undefined && count > constraints.maxCount) {
      meetsConstraints = false;
    }

    return {
      filtered,
      count,
      meetsConstraints
    };
  }

  /**
   * Group array by property and assert
   * GREEN: Grouping with validation
   */
  groupByAndAssert<T>(
    array: T[], 
    groupByProperty: string, 
    constraints: { expectedGroups?: string[] }
  ): GroupResult<T> {
    if (!Array.isArray(array)) {
      return {
        groups: {},
        hasExpectedGroups: false,
        groupCount: 0
      };
    }

    const groups: Record<string, T[]> = {};

    array.forEach(item => {
      if (typeof item === 'object' && item !== null && groupByProperty in item) {
        const groupKey = String((item as any)[groupByProperty]);
        
        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }
        
        groups[groupKey].push(item);
      }
    });

    const groupKeys = Object.keys(groups);
    const groupCount = groupKeys.length;

    let hasExpectedGroups = true;
    if (constraints.expectedGroups) {
      hasExpectedGroups = constraints.expectedGroups.every(expectedGroup => 
        groupKeys.includes(expectedGroup)
      );
    }

    return {
      groups,
      hasExpectedGroups,
      groupCount
    };
  }

  /**
   * Find unique elements in array
   * GREEN: Unique element extraction
   */
  getUniqueElements<T>(array: T[]): T[] {
    if (!Array.isArray(array)) {
      return [];
    }

    return [...new Set(array)];
  }

  /**
   * Find duplicate elements in array
   * GREEN: Duplicate detection
   */
  getDuplicateElements<T>(array: T[]): T[] {
    if (!Array.isArray(array)) {
      return [];
    }

    const seen = new Set<T>();
    const duplicates = new Set<T>();

    array.forEach(element => {
      if (seen.has(element)) {
        duplicates.add(element);
      } else {
        seen.add(element);
      }
    });

    return Array.from(duplicates);
  }

  /**
   * Check if array is sorted
   * GREEN: Sort validation
   */
  isSorted<T>(array: T[], compareFn?: (a: T, b: T) => number): boolean {
    if (!Array.isArray(array) || array.length <= 1) {
      return true;
    }

    const compare = compareFn || ((a: T, b: T) => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });

    for (let i = 1; i < array.length; i++) {
      if (compare(array[i - 1], array[i]) > 0) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get array statistics
   * GREEN: Array analysis
   */
  getArrayStatistics<T>(array: T[]): {
    length: number;
    uniqueCount: number;
    duplicateCount: number;
    isEmpty: boolean;
    hasNulls: boolean;
    hasUndefined: boolean;
  } {
    if (!Array.isArray(array)) {
      return {
        length: 0,
        uniqueCount: 0,
        duplicateCount: 0,
        isEmpty: true,
        hasNulls: false,
        hasUndefined: false
      };
    }

    const uniqueElements = this.getUniqueElements(array);
    const duplicateElements = this.getDuplicateElements(array);

    return {
      length: array.length,
      uniqueCount: uniqueElements.length,
      duplicateCount: duplicateElements.length,
      isEmpty: array.length === 0,
      hasNulls: array.includes(null as any),
      hasUndefined: array.includes(undefined as any)
    };
  }

  /**
   * Validate helper state
   * GREEN: State validation
   */
  validateState(): {
    isValid: boolean;
    issues: string[];
    supportedOperations: string[];
  } {
    const issues: string[] = [];

    if (!this.isInitialized) {
      issues.push('Array assertion helper not initialized');
    }

    return {
      isValid: issues.length === 0,
      issues,
      supportedOperations: [
        'containsAll',
        'containsAny',
        'containsObjectWithProperties',
        'validateLength',
        'isSubset',
        'isSuperset',
        'getIntersection',
        'getDifference',
        'filterAndAssert',
        'groupByAndAssert',
        'getUniqueElements',
        'getDuplicateElements',
        'isSorted',
        'getArrayStatistics'
      ]
    };
  }
}

export default ArrayAssertionHelper;
