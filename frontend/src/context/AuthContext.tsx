import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import axiosInstance from '../lib/axios';
import { User, LoginResponse, AuthContextType } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Check for existing session on mount (cookie-based)
  useEffect(() => {
    const checkAuth = async () => {
      // Don't check auth if already on login page
      if (window.location.pathname === '/login') {
        setIsLoading(false);
        setUser(null);
        return;
      }

      try {
        // Try to fetch user info - cookies are automatically sent
        const response = await axiosInstance.get(`${API_URL}/auth/me`);
        setUser(response.data);
      } catch (error) {
        // No valid session, user is not authenticated
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      const response = await axiosInstance.post<LoginResponse>(
        `${API_URL}/auth/login`,
        { email, password }
      );

      const { user: userData } = response.data;

      // Cookies are automatically set by the server
      // Just update the user state
      setUser(userData);

      // Redirect based on role
      if (userData.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/workspaces');
      }
    } catch (error) {
      if (isAxiosError(error)) {
        throw new Error(error.response?.data?.detail || 'Login failed');
      }
      throw new Error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Call logout endpoint to revoke session
      await axiosInstance.post(`${API_URL}/auth/logout`);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear user state regardless
      setUser(null);
      navigate('/login');
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
