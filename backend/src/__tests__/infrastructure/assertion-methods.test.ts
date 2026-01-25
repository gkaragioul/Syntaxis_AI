/**
 * Assertion Methods Fix Tests
 *
 * TDD Phase: RED - These tests should fail initially
 * Task: 1.1.3 - Fix Assertion Methods (Priority 4)
 *
 * Following the scratchpad plan (lines 188-194), these tests define the expected behavior
 * for proper assertion methods with extreme modularity and best practices:
 *
 * 1. Audit all tests using incorrect assertion methods
 * 2. Create test utility for proper object comparison assertions
 * 3. Write failing tests demonstrating assertion issues
 * 4. Replace toContain with toContainEqual for object comparisons
 * 5. Create reusable assertion helper functions
 * 6. Validate all tests use correct assertion methods
 *
 * This addresses the assertion method issues identified in the scratchpad.
 */

import { AssertionHelper } from '../utils/assertion-helper';
import { TestAssertionValidator } from '../utils/test-assertion-validator';
import { ObjectComparisonMatcher } from '../utils/object-comparison-matcher';
import { ArrayAssertionHelper } from '../utils/array-assertion-helper';
import { jest } from '@jest/globals';

describe('Assertion Methods Fix - TDD Foundation Repair', () => {
  let assertionHelper: AssertionHelper;
  let assertionValidator: TestAssertionValidator;
  let objectMatcher: ObjectComparisonMatcher;
  let arrayHelper: ArrayAssertionHelper;

  beforeAll(async () => {
    // RED: These should fail - we need comprehensive assertion utilities
    assertionHelper = new AssertionHelper();
    assertionValidator = new TestAssertionValidator();
    objectMatcher = new ObjectComparisonMatcher();
    arrayHelper = new ArrayAssertionHelper();

    await assertionHelper.initialize();
    await assertionValidator.initialize();
    await objectMatcher.initialize();
    await arrayHelper.initialize();
  });

  beforeEach(() => {
    assertionHelper.reset();
    assertionValidator.reset();
    objectMatcher.reset();
    arrayHelper.reset();
  });

  afterAll(async () => {
    await assertionHelper.cleanup();
    await assertionValidator.cleanup();
    await objectMatcher.cleanup();
    await arrayHelper.cleanup();
  });

  describe('Object Comparison Assertion Fixes', () => {
    it('should identify incorrect toContain usage for object comparisons', async () => {
      // RED: This test should fail - we need to detect incorrect assertions
      const testCode = `
        const users = [
          { id: 1, name: 'John', email: 'john@example.com' },
          { id: 2, name: 'Jane', email: 'jane@example.com' }
        ];

        // INCORRECT: toContain doesn't work for object comparison
        expect(users).toContain({ id: 1, name: 'John', email: 'john@example.com' });
      `;

      const issues = await assertionValidator.analyzeTestCode(testCode);

      expect(issues).toEqual({
        incorrectAssertions: [
          {
            line: 7,
            method: 'toContain',
            issue: 'toContain does not work for object comparison',
            suggestion: 'Use toContainEqual for object comparison',
            severity: 'error'
          }
        ],
        totalIssues: 1,
        fixable: true
      });
    });

    it('should provide correct object comparison assertions', async () => {
      // RED: This test should fail - we need ObjectComparisonMatcher
      const users = [
        { id: 1, name: 'John', email: 'john@example.com' },
        { id: 2, name: 'Jane', email: 'jane@example.com' }
      ];

      const targetUser = { id: 1, name: 'John', email: 'john@example.com' };

      // Test correct object comparison
      const containsUser = objectMatcher.arrayContainsObject(users, targetUser);
      expect(containsUser).toBe(true);

      // Test with partial object matching
      const partialUser = { id: 1, name: 'John' };
      const containsPartial = objectMatcher.arrayContainsObjectPartial(users, partialUser);
      expect(containsPartial).toBe(true);

      // Test with non-matching object
      const nonExistentUser = { id: 3, name: 'Bob', email: 'bob@example.com' };
      const containsNonExistent = objectMatcher.arrayContainsObject(users, nonExistentUser);
      expect(containsNonExistent).toBe(false);
    });

  });

  describe('Array Assertion Helper Functions', () => {
    it('should provide comprehensive array assertion utilities', async () => {
      // RED: This test should fail - we need ArrayAssertionHelper
      const numbers = [1, 2, 3, 4, 5];
      const strings = ['apple', 'banana', 'cherry'];
      const objects = [
        { id: 1, type: 'fruit', name: 'apple' },
        { id: 2, type: 'fruit', name: 'banana' },
        { id: 3, type: 'vegetable', name: 'carrot' }
      ];

      // Test array contains all elements
      const containsAllNumbers = arrayHelper.containsAll(numbers, [2, 4]);
      expect(containsAllNumbers).toBe(true);

      // Test array contains any element
      const containsAnyStrings = arrayHelper.containsAny(strings, ['banana', 'grape']);
      expect(containsAnyStrings).toBe(true);

      // Test array contains object with properties
      const containsObjectWithProps = arrayHelper.containsObjectWithProperties(
        objects,
        { type: 'fruit', name: 'apple' }
      );
      expect(containsObjectWithProps).toBe(true);

      // Test array length assertions
      const lengthValidation = arrayHelper.validateLength(objects, { min: 2, max: 5 });
      expect(lengthValidation).toEqual({
        isValid: true,
        actualLength: 3,
        constraints: { min: 2, max: 5 }
      });
    });

  });

  describe('Assertion Helper Integration', () => {
    it('should provide comprehensive assertion utilities', async () => {
      // RED: This test should fail - we need comprehensive AssertionHelper
      const testData = {
        users: [
          { id: 1, name: 'John', email: 'john@example.com' },
          { id: 2, name: 'Jane', email: 'jane@example.com' }
        ],
        settings: {
          theme: 'dark',
          notifications: true
        },
        stats: {
          totalUsers: 2,
          activeUsers: 2
        }
      };

      // Test object property assertions
      const hasProperty = assertionHelper.objectHasProperty(testData, 'users');
      expect(hasProperty).toBe(true);

      const hasNestedProperty = assertionHelper.objectHasNestedProperty(
        testData,
        'settings.theme'
      );
      expect(hasNestedProperty).toBe(true);

      // Test value assertions
      const valueEquals = assertionHelper.valueEquals(testData.stats.totalUsers, 2);
      expect(valueEquals).toBe(true);

      const valueInRange = assertionHelper.valueInRange(testData.stats.activeUsers, 1, 5);
      expect(valueInRange).toBe(true);

      // Test array assertions
      const arrayContainsObject = assertionHelper.arrayContainsObject(
        testData.users,
        { id: 1, name: 'John', email: 'john@example.com' }
      );
      expect(arrayContainsObject).toBe(true);
    });
  });

  describe('Common Patterns in Codebase', () => {
    it('should handle OCR result patterns correctly', () => {
      // RED: This simulates patterns found in OCR tests
      
      const ocrResults = {
        patterns: ['date_format', 'currency_format', 'invoice_number'],
        suggestions: [
          { type: 'date', value: '2024-01-15', confidence: 0.95 },
          { type: 'amount', value: '1000.00', confidence: 0.88 }
        ],
        metadata: {
          engine: 'tesseract',
          processingTime: 1500,
          confidence: 0.92
        }
      };
      
      // CORRECT: toContain for primitive values in arrays
      expect(ocrResults.patterns).toContain('date_format');
      expect(ocrResults.patterns).toContain('currency_format');
      
      // INCORRECT: This would fail if we used toContain for objects
      try {
        expect(ocrResults.suggestions).toContain({ 
          type: 'date', 
          value: '2024-01-15', 
          confidence: 0.95 
        });
        fail('Should have failed with toContain for suggestion object');
      } catch (error) {
        expect(error.message).toContain('Expected array to contain');
      }
      
      // CORRECT: toContainEqual for objects in arrays
      expect(ocrResults.suggestions).toContainEqual({ 
        type: 'date', 
        value: '2024-01-15', 
        confidence: 0.95 
      });
    });

    it('should handle validation result patterns correctly', () => {
      // RED: This simulates patterns found in validation tests
      
      const validationResults = [
        { field: 'invoiceNumber', isValid: true, errors: [] },
        { field: 'amount', isValid: false, errors: ['Invalid format'] },
        { field: 'date', isValid: true, errors: [] }
      ];
      
      // INCORRECT: Using toContain for object comparison
      try {
        expect(validationResults).toContain({ 
          field: 'amount', 
          isValid: false, 
          errors: ['Invalid format'] 
        });
        fail('Should have failed with toContain for validation object');
      } catch (error) {
        expect(error.message).toContain('Expected array to contain');
      }
      
      // CORRECT: Using toContainEqual for object comparison
      expect(validationResults).toContainEqual({ 
        field: 'amount', 
        isValid: false, 
        errors: ['Invalid format'] 
      });
    });
  });

  describe('Test Utility Functions', () => {
    it('should provide helper functions for common assertion patterns', () => {
      // RED: This test should fail due to missing utility functions
      
      const expectArrayToContainObject = (array: any[], expectedObject: any) => {
        expect(array).toContainEqual(expectedObject);
      };
      
      const expectArrayToContainString = (array: string[], expectedString: string) => {
        expect(array).toContain(expectedString);
      };
      
      const expectObjectInResults = (results: any[], field: string, value: any) => {
        const found = results.find(item => item[field] === value);
        expect(found).toBeDefined();
        return found;
      };
      
      // Test the utility functions
      const testData = [
        { id: 1, name: 'Test 1' },
        { id: 2, name: 'Test 2' }
      ];
      
      expectArrayToContainObject(testData, { id: 1, name: 'Test 1' });
      
      const stringData = ['apple', 'banana', 'cherry'];
      expectArrayToContainString(stringData, 'banana');
      
      const foundItem = expectObjectInResults(testData, 'id', 2);
      expect(foundItem.name).toBe('Test 2');
    });
  });

  describe('Performance Considerations', () => {
    it('should understand performance differences between assertion methods', () => {
      // toContain uses === comparison (faster for primitives)
      // toContainEqual uses deep equality comparison (slower but necessary for objects)
      
      const largeStringArray = Array.from({ length: 1000 }, (_, i) => `item-${i}`);
      const largeObjectArray = Array.from({ length: 1000 }, (_, i) => ({ 
        id: i, 
        name: `item-${i}` 
      }));
      
      // Fast primitive comparison
      const startTime1 = Date.now();
      expect(largeStringArray).toContain('item-500');
      const endTime1 = Date.now();
      
      // Slower object comparison
      const startTime2 = Date.now();
      expect(largeObjectArray).toContainEqual({ id: 500, name: 'item-500' });
      const endTime2 = Date.now();
      
      // Object comparison should take longer (though both should be fast)
      const primitiveTime = endTime1 - startTime1;
      const objectTime = endTime2 - startTime2;
      
      // Both should complete quickly, but object comparison may be slower
      expect(primitiveTime).toBeLessThan(100);
      expect(objectTime).toBeLessThan(100);
    });

    it('should provide automated assertion fixes', async () => {
      // RED: This test should fail - we need automated fixing
      const incorrectTestCode = `
        const users = [{ id: 1, name: 'John' }];
        expect(users).toContain({ id: 1, name: 'John' });
      `;

      const fixedCode = await assertionValidator.autoFixAssertions(incorrectTestCode);

      expect(fixedCode.fixed).toBe(true);
      expect(fixedCode.changesApplied).toHaveLength(1);
      expect(fixedCode.changesApplied[0].reason).toContain('toContainEqual');
    });
  });
});
