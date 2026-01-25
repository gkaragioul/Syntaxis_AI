import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios, { AxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';

interface User {
  id: string;
  email: string;
  name: string;
  company?: string;
  role: string;
  subscriptionStatus: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface UserSession {
  id: string;
  deviceInfo: string;
  lastActiveAt: string;
}

interface ErrorResponse {
  message?: string;
}

interface AuthContextType extends Omit<AuthState, 'refreshToken'> {
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  doRefreshToken: () => Promise<void>;
  getUserSessions: () => Promise<UserSession[]>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  company?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_REFRESH_INTERVAL = 14 * 60 * 1000; // 14 minutes
const SESSION_STORAGE_KEY = 'auth_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(() => {
    const savedSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (savedSession) {
      try {
        const { user, accessToken, refreshToken } = JSON.parse(savedSession);
        return {
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        };
      } catch {
        // Invalid session data
      }
    }
    return {
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false, // Don't show loading spinner if no session exists
    };
  });

  const navigate = useNavigate();

  // Configure axios interceptors
  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        if (state.accessToken) {
          config.headers.Authorization = `Bearer ${state.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            await doRefreshToken();
            originalRequest.headers.Authorization = `Bearer ${state.accessToken}`;
            return axios(originalRequest);
          } catch (refreshError) {
            await logout();
            navigate('/login');
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [state.accessToken, navigate]);

  // Token refresh interval
  useEffect(() => {
    if (state.isAuthenticated) {
      const interval = setInterval(doRefreshToken, TOKEN_REFRESH_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [state.isAuthenticated]);

  const updateSession = useCallback((newState: Partial<AuthState>) => {
    setState((prevState) => {
      const updatedState = { ...prevState, ...newState };
      if (updatedState.isAuthenticated) {
        sessionStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({
            user: updatedState.user,
            accessToken: updatedState.accessToken,
            refreshToken: updatedState.refreshToken,
          })
        );
      } else {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
      return updatedState;
    });
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const deviceInfo = `${navigator.userAgent} - ${navigator.platform}`;
      const response = await axios.post('/api/auth/login', { email, password, deviceInfo });
      const { user, accessToken, refreshToken } = response.data;
      updateSession({
        user,
        accessToken,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });
      navigate('/dashboard');
    } catch (error) {
      const axiosError = error as AxiosError<ErrorResponse>;
      throw axiosError.response?.data?.message || 'Login failed';
    }
  };

  const register = async (data: RegisterData) => {
    try {
      await axios.post('/api/auth/register', data);
      navigate('/verify-email');
    } catch (error) {
      const axiosError = error as AxiosError<ErrorResponse>;
      throw axiosError.response?.data?.message || 'Registration failed';
    }
  };

  const logout = async () => {
    try {
      if (state.refreshToken) {
        await axios.post('/api/auth/logout', { refreshToken: state.refreshToken });
      }
      updateSession({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear the session even if the server request fails
      updateSession({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
      navigate('/login');
    }
  };

  const logoutAll = async () => {
    try {
      await axios.post('/api/auth/logout-all');
      updateSession({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
      navigate('/login');
    } catch (error) {
      const axiosError = error as AxiosError<ErrorResponse>;
      throw axiosError.response?.data?.message || 'Failed to logout from all devices';
    }
  };

  const doRefreshToken = async () => {
    if (!state.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post('/api/auth/refresh', {
        refreshToken: state.refreshToken,
      });
      const { accessToken, refreshToken: newRefreshToken } = response.data;
      updateSession({ accessToken, refreshToken: newRefreshToken });
    } catch (error) {
      const axiosError = error as AxiosError<ErrorResponse>;
      throw axiosError.response?.data?.message || 'Token refresh failed';
    }
  };

  const getUserSessions = async (): Promise<UserSession[]> => {
    try {
      const response = await axios.get('/api/auth/sessions');
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<ErrorResponse>;
      throw axiosError.response?.data?.message || 'Failed to fetch user sessions';
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      await axios.put('/api/auth/change-password', { currentPassword, newPassword });
      // After password change, all sessions are invalidated
      await logout();
    } catch (error) {
      const axiosError = error as AxiosError<ErrorResponse>;
      throw axiosError.response?.data?.message || 'Password change failed';
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    try {
      const response = await axios.put('/api/auth/profile', data);
      updateSession({ user: response.data });
    } catch (error) {
      const axiosError = error as AxiosError<ErrorResponse>;
      throw axiosError.response?.data?.message || 'Profile update failed';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
        isLoading: state.isLoading,
        login,
        register,
        logout,
        logoutAll,
        doRefreshToken,
        getUserSessions,
        changePassword,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 