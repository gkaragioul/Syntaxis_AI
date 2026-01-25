// @ts-nocheck
import { useState, useCallback } from 'react';

// Mock user for free access mode
const MOCK_USER = {
  id: 'demo-user',
  email: 'demo@syntaxis.ai',
  name: 'Demo User',
  avatar: null,
};

export function useAuth() {
  // Always return mock user for free access
  const [user] = useState(MOCK_USER);

  const login = useCallback(async () => {
    // No-op in free access mode
  }, []);

  const logout = useCallback(async () => {
    // No-op in free access mode
  }, []);

  return {
    user,
    login,
    logout,
  };
} 