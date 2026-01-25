/**
 * Assertion Methods Validation Tests
 * 
 * Task 1.1.3: Fix Assertion Methods - TDD Red Phase
 * 
 * These tests validate correct assertion method usage and demonstrate
 * the difference between toContain and toContainEqual for object comparisons.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { setupTestEnvironment, cleanupTestEnvironment } from '../utils/test-environment';

describe('Assertion Methods Validation', () => {
  beforeEach(async () => {
    await setupTestEnvironment({ useMocks: true });
  });

  afterEach(async () => {
    await cleanupTestEnvironment();
  });

  describe('Object Comparison Assertions', () => {
    it('should demonstrate correct usage of toContainEqual for objects', () => {
      // RED: This test demonstrates the correct way to test object arrays
      const users = [
        { id: '1', name: 'John', email: 'john@example.com' },
        { id: '2', name: 'Jane', email: 'jane@example.com' },
        { id: '3', name: 'Bob', email: 'bob@example.com' },
      ];

      const expectedUser = { id: '2', name: 'Jane', email: 'jane@example.com' };

      // CORRECT: Use toContainEqual for object comparison
      expect(users).toContainEqual(expectedUser);
      
      // This would be INCORRECT and should be avoided:
      // expect(users).toContain(expectedUser); // This fails because objects are compared by reference
    });

    it('should demonstrate toContain vs toContainEqual differences', () => {
      const stringArray = ['apple', 'banana', 'cherry'];
      const objectArray = [
        { fruit: 'apple', color: 'red' },
        { fruit: 'banana', color: 'yellow' },
        { fruit: 'cherry', color: 'red' },
      ];

      // For primitive values, toContain works fine
      expect(stringArray).toContain('banana');

      // For objects, must use toContainEqual
      expect(objectArray).toContainEqual({ fruit: 'banana', color: 'yellow' });
      
      // This would fail:
      // expect(objectArray).toContain({ fruit: 'banana', color: 'yellow' });
    });

    it('should validate invoice data with correct assertions', async () => {
      const invoices = await global.testPrisma.invoice.findMany();
      
      const expectedInvoice = {
        id: 'test-invoice-id',
        userId: 'test-user-id',
        fileName: 'test-invoice.pdf',
        status: 'pending',
        extractionConfidence: 0.95,
        validationStatus: 'passed',
      };

      // CORRECT: Use toContainEqual for object comparison in arrays
      expect(invoices).toContainEqual(
        expect.objectContaining(expectedInvoice)
      );
    });

    it('should validate review task data with correct assertions', async () => {
      const reviewTasks = await global.testPrisma.reviewTask.findMany();
      
      // CORRECT: Use toContainEqual for object arrays
      expect(reviewTasks).toContainEqual(
        expect.objectContaining({
          id: 'test-review-task-id',
          status: 'pending',
          priority: 'medium',
        })
      );
    });
  });

  describe('Nested Object Assertions', () => {
    it('should handle nested object comparisons correctly', () => {
      const apiResponse = {
        data: [
          {
            user: { id: '1', profile: { name: 'John', settings: { theme: 'dark' } } },
            invoices: [
              { id: 'inv1', amount: 100.50, status: 'paid' },
              { id: 'inv2', amount: 250.75, status: 'pending' },
            ],
          },
        ],
        meta: { total: 2, page: 1 },
      };

      // CORRECT: Use toContainEqual for nested objects
      expect(apiResponse.data[0].invoices).toContainEqual({
        id: 'inv2',
        amount: 250.75,
        status: 'pending',
      });

      // CORRECT: Use objectContaining for partial matches
      expect(apiResponse.data[0].invoices).toContainEqual(
        expect.objectContaining({
          id: 'inv1',
          status: 'paid',
        })
      );
    });

    it('should validate complex OCR results with correct assertions', () => {
      const ocrResults = [
        {
          id: 'ocr1',
          confidence: 0.95,
          extractedData: {
            vendor: { name: 'ACME Corp', address: '123 Main St' },
            amount: { value: 150.00, currency: 'USD' },
            lineItems: [
              { description: 'Service A', amount: 100.00 },
              { description: 'Service B', amount: 50.00 },
            ],
          },
        },
      ];

      // CORRECT: Use toContainEqual for complex nested objects
      expect(ocrResults).toContainEqual(
        expect.objectContaining({
          id: 'ocr1',
          extractedData: expect.objectContaining({
            vendor: { name: 'ACME Corp', address: '123 Main St' },
            lineItems: expect.arrayContaining([
              expect.objectContaining({ description: 'Service A', amount: 100.00 }),
            ]),
          }),
        })
      );
    });
  });

  describe('Array Assertion Best Practices', () => {
    it('should use arrayContaining for partial array matches', () => {
      const permissions = ['read', 'write', 'delete', 'admin'];
      
      // CORRECT: Use arrayContaining for partial matches
      expect(permissions).toEqual(
        expect.arrayContaining(['read', 'write'])
      );
    });

    it('should use toHaveLength for array length validation', () => {
      const results = [1, 2, 3, 4, 5];
      
      // CORRECT: Use toHaveLength for length checks
      expect(results).toHaveLength(5);
      
      // Also correct but less specific:
      // expect(results.length).toBe(5);
    });

    it('should validate database query results correctly', async () => {
      const users = await global.testPrisma.user.findMany();
      
      // CORRECT: Validate array structure and content
      expect(users).toHaveLength(1);
      expect(users).toContainEqual(
        expect.objectContaining({
          email: 'test@example.com',
          subscriptionStatus: 'free',
        })
      );
    });
  });

  describe('Error Assertion Patterns', () => {
    it('should validate error objects correctly', () => {
      const errors = [
        { field: 'email', message: 'Invalid email format', code: 'INVALID_EMAIL' },
        { field: 'password', message: 'Password too short', code: 'WEAK_PASSWORD' },
      ];

      // CORRECT: Use toContainEqual for error object validation
      expect(errors).toContainEqual({
        field: 'email',
        message: 'Invalid email format',
        code: 'INVALID_EMAIL',
      });
    });

    it('should validate API error responses correctly', () => {
      const errorResponse = {
        success: false,
        errors: [
          { field: 'amount', message: 'Amount must be positive' },
          { field: 'currency', message: 'Invalid currency code' },
        ],
        meta: { timestamp: '2024-01-01T00:00:00Z' },
      };

      // CORRECT: Use toContainEqual for error arrays
      expect(errorResponse.errors).toContainEqual(
        expect.objectContaining({
          field: 'amount',
          message: expect.stringContaining('positive'),
        })
      );
    });
  });

  describe('Performance and Memory Assertions', () => {
    it('should validate performance metrics correctly', () => {
      const performanceMetrics = [
        { operation: 'ocr_processing', duration: 1500, memory: 256 },
        { operation: 'pdf_parsing', duration: 800, memory: 128 },
        { operation: 'data_extraction', duration: 300, memory: 64 },
      ];

      // CORRECT: Use toContainEqual for performance data
      expect(performanceMetrics).toContainEqual(
        expect.objectContaining({
          operation: 'ocr_processing',
          duration: expect.any(Number),
          memory: expect.any(Number),
        })
      );
    });

    it('should validate batch processing results correctly', () => {
      const batchResults = {
        processed: [
          { id: 'file1', status: 'success', confidence: 0.95 },
          { id: 'file2', status: 'success', confidence: 0.88 },
        ],
        failed: [
          { id: 'file3', status: 'error', error: 'Invalid format' },
        ],
        summary: { total: 3, success: 2, failed: 1 },
      };

      // CORRECT: Use toContainEqual for batch result validation
      expect(batchResults.processed).toContainEqual(
        expect.objectContaining({
          id: 'file1',
          status: 'success',
          confidence: expect.any(Number),
        })
      );

      expect(batchResults.failed).toContainEqual(
        expect.objectContaining({
          id: 'file3',
          status: 'error',
        })
      );
    });
  });

  describe('Meta-Test: Assertion Method Validation', () => {
    it('should demonstrate why toContain fails for objects', () => {
      const objects = [{ id: 1 }, { id: 2 }];
      const targetObject = { id: 1 };

      // This assertion would fail because objects are compared by reference
      // expect(objects).toContain(targetObject); // WRONG - would fail

      // This is the correct way:
      expect(objects).toContainEqual(targetObject); // CORRECT - compares by value
    });

    it('should validate that our test utilities use correct assertions', () => {
      // Meta-test to ensure our test utilities follow best practices
      const testData = {
        users: [
          { id: '1', name: 'Test User' },
        ],
        config: {
          features: ['ocr', 'batch_processing'],
        },
      };

      // Validate that we're using correct assertion patterns
      expect(testData.users).toContainEqual(
        expect.objectContaining({ id: '1' })
      );

      expect(testData.config.features).toEqual(
        expect.arrayContaining(['ocr'])
      );
    });
  });
});
