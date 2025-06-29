import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '../../services/auth.service';
import { ValidationError, AuthenticationError } from '../../utils/errors';
import { TEST_USER } from '../setup';
import { mockServices } from '../mocks/services';

// Mock PrismaClient
const mockPrisma = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient;

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    authService = new AuthService(mockPrisma);
  });

  describe('register', () => {
    const newUser = {
      email: 'new@example.com',
      password: 'TestPass123!',
    };

    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: newUser.email,
        passwordHash: 'hashed_password',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.create.mockResolvedValueOnce(mockUser);

      const result = await authService.register(newUser);

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: newUser.email,
          passwordHash: expect.any(String),
        }),
      });

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
    });

    it('should throw error for duplicate email', async () => {
      mockPrisma.user.create.mockRejectedValueOnce({
        code: 'P2002',
        meta: { target: ['email'] },
      });

      await expect(authService.register(newUser)).rejects.toThrow(
        new ValidationError('Email already exists'),
      );
    });

    it('should validate email format', async () => {
      await expect(
        authService.register({ ...newUser, email: 'invalid-email' }),
      ).rejects.toThrow(new ValidationError('Invalid email format'));
    });

    it('should validate password strength', async () => {
      await expect(
        authService.register({ ...newUser, password: 'weak' }),
      ).rejects.toThrow(
        new ValidationError('Password must be at least 8 characters long'),
      );
    });
  });

  describe('login', () => {
    const validCredentials = {
      email: TEST_USER.email,
      password: TEST_USER.password,
    };

    it('should login user successfully', async () => {
      const mockUser = {
        ...TEST_USER,
        passwordHash: 'hashed_password',
      };

      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);

      const result = await authService.login(validCredentials);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: validCredentials.email },
      });

      expect(result).toHaveProperty('token');
      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
    });

    it('should throw error for invalid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(authService.login(validCredentials)).rejects.toThrow(
        new AuthenticationError('Invalid credentials'),
      );
    });

    it('should throw error for incorrect password', async () => {
      const mockUser = {
        ...TEST_USER,
        passwordHash: 'different_hash',
      };

      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);

      await expect(authService.login(validCredentials)).rejects.toThrow(
        new AuthenticationError('Invalid credentials'),
      );
    });
  });

  describe('validateToken', () => {
    const validToken = 'valid.jwt.token';
    const mockUser = {
      ...TEST_USER,
      passwordHash: 'hashed_password',
    };

    it('should validate token successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);

      const result = await authService.validateToken(validToken);

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
    });

    it('should throw error for invalid token', async () => {
      await expect(authService.validateToken('invalid.token')).rejects.toThrow(
        new AuthenticationError('Invalid token'),
      );
    });

    it('should throw error for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(authService.validateToken(validToken)).rejects.toThrow(
        new AuthenticationError('User not found'),
      );
    });
  });
});
