/**
 * Assertion Helper Utilities
 *
 * TDD Phase: GREEN - Implementation to fix assertion method issues
 * Task: 1.1.3 - Fix assertion methods (toContain → toContainEqual)
 *
 * This utility provides:
 * 1. Correct assertion methods for different data types
 * 2. Helper functions for common assertion patterns
 * 3. Type-safe assertion utilities
 * 4. Performance-optimized assertion methods
 * 5. Clear error messages for failed assertions
 *
 * Usage Guidelines:
 * - Use toContain for primitive values and substring matching
 * - Use toContainEqual for object comparisons
 * - Use semantic helpers for common test patterns
 */

import { expect } from '@jest/globals';

/**
 * Type-safe assertion helpers that automatically choose the correct method
 */

/**
 * Smart assertion helper that chooses the correct method based on data type
 * Uses toContain for primitives and toContainEqual for objects
 */
export const expectArrayToContain = <T>(
  array: T[],
  expectedValue: T,
  message?: string
): void => {
  // Check if the expected value is a primitive type
  const isPrimitive = (value: any): boolean => {
    return value === null ||
           value === undefined ||
           typeof value === 'string' ||
           typeof value === 'number' ||
           typeof value === 'boolean' ||
           typeof value === 'symbol' ||
           typeof value === 'bigint';
  };

  if (isPrimitive(expectedValue)) {
    // Use toContain for primitive values (faster)
    expect(array).toContain(expectedValue);
  } else {
    // Use toContainEqual for objects and arrays (deep equality)
    expect(array).toContainEqual(expectedValue);
  }
};

/**
 * Asserts that an array contains a primitive value
 * Uses toContain for efficient === comparison
 */
export const expectArrayToContainPrimitive = <T extends string | number | boolean>(
  array: T[],
  value: T,
  message?: string
): void => {
  expect(array).toContain(value);
};

/**
 * Asserts that an array contains an object
 * Uses toContainEqual for deep equality comparison
 */
export const expectArrayToContainObject = <T extends object>(
  array: T[],
  expectedObject: T,
  message?: string
): void => {
  expect(array).toContainEqual(expectedObject);
};

/**
 * Asserts that a string contains a substring
 * Uses toContain for substring matching
 */
export const expectStringToContain = (
  text: string,
  substring: string,
  message?: string
): void => {
  expect(text).toContain(substring);
};

/**
 * Domain-specific assertion helpers for common patterns
 */

/**
 * Asserts that OCR results contain expected patterns
 */
export const expectOCRResultsToContainPattern = (
  results: { patterns: string[] },
  expectedPattern: string
): void => {
  expect(results.patterns).toContain(expectedPattern);
};

/**
 * Asserts that OCR suggestions contain expected suggestion object
 */
export const expectOCRSuggestionsToContain = (
  results: { suggestions: any[] },
  expectedSuggestion: any
): void => {
  expect(results.suggestions).toContainEqual(expectedSuggestion);
};

/**
 * Asserts that validation results contain expected validation object
 */
export const expectValidationResultsToContain = (
  results: Array<{ field: string; isValid: boolean; errors: string[] }>,
  expectedResult: { field: string; isValid: boolean; errors: string[] }
): void => {
  expect(results).toContainEqual(expectedResult);
};

/**
 * Asserts that extraction results contain expected field extraction
 */
export const expectExtractionResultsToContain = (
  results: Array<{ field: string; value: any; confidence: number }>,
  expectedExtraction: { field: string; value: any; confidence: number }
): void => {
  expect(results).toContainEqual(expectedExtraction);
};

/**
 * Asserts that invoice fields contain expected field data
 */
export const expectInvoiceFieldsToContain = (
  fields: Array<{ fieldName: string; value: any; confidence: number }>,
  expectedField: { fieldName: string; value: any; confidence: number }
): void => {
  expect(fields).toContainEqual(expectedField);
};

/**
 * Asserts that error array contains expected error object
 */
export const expectErrorsToContain = (
  errors: Array<{ code: string; message: string; field?: string }>,
  expectedError: { code: string; message: string; field?: string }
): void => {
  expect(errors).toContainEqual(expectedError);
};

/**
 * Asserts that configuration arrays contain expected config objects
 */
export const expectConfigToContain = (
  config: Array<{ key: string; value: any }>,
  expectedConfig: { key: string; value: any }
): void => {
  expect(config).toContainEqual(expectedConfig);
};

/**
 * Helper to find and assert object properties in arrays
 */
export const expectObjectInArrayByProperty = <T extends Record<string, any>>(
  array: T[],
  propertyName: keyof T,
  propertyValue: any,
  message?: string
): T => {
  const found = array.find(item => item[propertyName] === propertyValue);
  expect(found).toBeDefined();
  return found as T;
};

/**
 * Helper to assert multiple objects exist in an array
 */
export const expectArrayToContainObjects = <T extends object>(
  array: T[],
  expectedObjects: T[],
  message?: string
): void => {
  expectedObjects.forEach(expectedObject => {
    expect(array).toContainEqual(expectedObject);
  });
};

/**
 * Helper to assert array contains objects with specific properties
 */
export const expectArrayToContainObjectsWithProperties = <T extends Record<string, any>>(
  array: T[],
  expectedProperties: Partial<T>[],
  message?: string
): void => {
  expectedProperties.forEach(expectedProps => {
    const found = array.some(item => {
      return Object.keys(expectedProps).every(key =>
        item[key] === expectedProps[key]
      );
    });
    expect(found).toBe(true);
  });
};

/**
 * Response format assertion helpers
 */
export const expectStandardSuccessResponse = (response: any): void => {
  expect(response).toHaveProperty('success', true);
  expect(response).toHaveProperty('data');
  expect(response).toHaveProperty('timestamp');
  expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
};

export const expectStandardErrorResponse = (response: any): void => {
  expect(response).toHaveProperty('success', false);
  expect(response).toHaveProperty('error');
  expect(response.error).toHaveProperty('code');
  expect(response.error).toHaveProperty('message');
  expect(response).toHaveProperty('timestamp');
};

/**
 * Configuration validation helpers
 */
export const expectConfigurationToContainRequiredFields = (
  config: Record<string, any>,
  requiredFields: string[]
): void => {
  requiredFields.forEach(field => {
    expect(config).toHaveProperty(field);
  });
};

export const expectArrayToContainRequiredStrings = (
  array: string[],
  requiredStrings: string[]
): void => {
  requiredStrings.forEach(str => {
    expect(array).toContain(str);
  });
};

/**
 * Export all helpers as a single object for easy importing
 */
export const AssertionHelpers = {
  expectArrayToContainPrimitive,
  expectArrayToContainObject,
  expectStringToContain,
  expectOCRResultsToContainPattern,
  expectOCRSuggestionsToContain,
  expectValidationResultsToContain,
  expectExtractionResultsToContain,
  expectInvoiceFieldsToContain,
  expectErrorsToContain,
  expectConfigToContain,
  expectArrayToContain,
  expectObjectInArrayByProperty,
  expectArrayToContainObjects,
  expectArrayToContainObjectsWithProperties,
  expectStandardSuccessResponse,
  expectStandardErrorResponse,
  expectConfigurationToContainRequiredFields,
  expectArrayToContainRequiredStrings,
};

export default AssertionHelpers;
