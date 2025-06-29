import { useState, useCallback, useEffect } from 'react';
import AuthService, { User, LoginInput, RegisterInput } from '../services/AuthService';

// We now rely on AuthService for persistence + JWT handling

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => AuthService.getCurrentUser());

  const login = useCallback(async (email: string, password: string) => {
    const { user: loggedInUser } = await AuthService.login({ email, password } as LoginInput);
    setUser(loggedInUser);
  }, []);

  const logout = useCallback(async () => {
    AuthService.logout();
    setUser(null);
  }, []);

  // Verify/refresh token on mount
  useEffect(() => {
    const check = async () => {
      if (!AuthService.isAuthenticated()) return;
      try {
        // Optionally refresh access token silently
        await AuthService.refreshToken();
        setUser(AuthService.getCurrentUser());
      } catch {
        AuthService.logout();
        setUser(null);
      }
    };
    check();
  }, []);

  return {
    user,
    login,
    logout,
  };
} 