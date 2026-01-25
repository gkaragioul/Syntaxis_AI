/**
 * Mock Manager
 * 
 * TDD Phase: GREEN - Minimal implementation to make mock management tests pass
 * Task: 1.1.4 - Test Environment Setup (Priority 1)
 * 
 * This class provides centralized mock management with:
 * - Mock registration and retrieval
 * - Scoped mock isolation
 * - Automatic cleanup
 */

import { jest } from '@jest/globals';

export interface MockRegistry {
  [serviceName: string]: {
    [methodName: string]: jest.Mock;
  };
}

export interface ScopedMocks {
  [scopeName: string]: MockRegistry;
}

export class MockManager {
  private mocks: MockRegistry = {};
  private scopedMocks: ScopedMocks = {};
  private activeScope: string | null = null;

  /**
   * Register a mock
   * GREEN: Basic mock registration
   */
  register(serviceName: string, methodName: string, mockFn: jest.Mock, scope?: string): void {
    if (scope) {
      this.registerScopedMock(serviceName, methodName, mockFn, scope);
    } else {
      if (!this.mocks[serviceName]) {
        this.mocks[serviceName] = {};
      }
      this.mocks[serviceName][methodName] = mockFn;
    }
  }

  /**
   * Get a registered mock
   * GREEN: Basic mock retrieval
   */
  get(serviceName: string, methodName: string): jest.Mock | undefined {
    // Check active scope first
    if (this.activeScope && this.scopedMocks[this.activeScope]) {
      const scopedMock = this.scopedMocks[this.activeScope][serviceName]?.[methodName];
      if (scopedMock) {
        return scopedMock;
      }
    }

    // Fall back to global mocks
    return this.mocks[serviceName]?.[methodName];
  }

  /**
   * Clear all mocks
   * GREEN: Basic cleanup implementation
   */
  clearAll(): void {
    // Clear global mocks
    Object.values(this.mocks).forEach(serviceMocks => {
      Object.values(serviceMocks).forEach(mock => {
        mock.mockClear();
      });
    });
    this.mocks = {};

    // Clear scoped mocks
    Object.values(this.scopedMocks).forEach(scopeMocks => {
      Object.values(scopeMocks).forEach(serviceMocks => {
        Object.values(serviceMocks).forEach(mock => {
          mock.mockClear();
        });
      });
    });
    this.scopedMocks = {};
    this.activeScope = null;

    // Clear Jest mocks
    jest.clearAllMocks();
  }

  /**
   * Create a new scope
   * GREEN: Basic scope creation
   */
  createScope(scopeName: string): void {
    if (!this.scopedMocks[scopeName]) {
      this.scopedMocks[scopeName] = {};
    }
  }

  /**
   * Activate a scope
   * GREEN: Basic scope activation
   */
  activateScope(scopeName: string): void {
    if (!this.scopedMocks[scopeName]) {
      this.createScope(scopeName);
    }
    this.activeScope = scopeName;
  }

  /**
   * Clear a specific scope
   * GREEN: Basic scope cleanup
   */
  clearScope(scopeName: string): void {
    if (this.scopedMocks[scopeName]) {
      // Clear all mocks in the scope
      Object.values(this.scopedMocks[scopeName]).forEach(serviceMocks => {
        Object.values(serviceMocks).forEach(mock => {
          mock.mockClear();
        });
      });
      delete this.scopedMocks[scopeName];
    }

    // If this was the active scope, deactivate it
    if (this.activeScope === scopeName) {
      this.activeScope = null;
    }
  }

  /**
   * Register scoped mock
   * GREEN: Helper for scoped mock registration
   */
  private registerScopedMock(serviceName: string, methodName: string, mockFn: jest.Mock, scope: string): void {
    if (!this.scopedMocks[scope]) {
      this.createScope(scope);
    }

    if (!this.scopedMocks[scope][serviceName]) {
      this.scopedMocks[scope][serviceName] = {};
    }

    this.scopedMocks[scope][serviceName][methodName] = mockFn;
  }

  /**
   * Get active scope
   * GREEN: Simple getter
   */
  getActiveScope(): string | null {
    return this.activeScope;
  }

  /**
   * List all registered mocks
   * GREEN: Debug helper
   */
  listMocks(): {
    global: MockRegistry;
    scoped: ScopedMocks;
    activeScope: string | null;
  } {
    return {
      global: { ...this.mocks },
      scoped: { ...this.scopedMocks },
      activeScope: this.activeScope
    };
  }

  /**
   * Check if mock exists
   * GREEN: Utility method
   */
  hasMock(serviceName: string, methodName: string, scope?: string): boolean {
    if (scope) {
      return !!(this.scopedMocks[scope]?.[serviceName]?.[methodName]);
    }
    return !!(this.mocks[serviceName]?.[methodName]);
  }

  /**
   * Remove specific mock
   * GREEN: Selective mock removal
   */
  remove(serviceName: string, methodName: string, scope?: string): void {
    if (scope) {
      if (this.scopedMocks[scope]?.[serviceName]?.[methodName]) {
        this.scopedMocks[scope][serviceName][methodName].mockClear();
        delete this.scopedMocks[scope][serviceName][methodName];
      }
    } else {
      if (this.mocks[serviceName]?.[methodName]) {
        this.mocks[serviceName][methodName].mockClear();
        delete this.mocks[serviceName][methodName];
      }
    }
  }
}

export default MockManager;
