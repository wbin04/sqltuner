import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Get API URL from environment variable
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Track if we're already redirecting to prevent infinite loops
let isRedirecting = false;

// Create axios instance
const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 120000, // 120 seconds for LLM requests
  withCredentials: true, // Send cookies with requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Cookies are automatically sent with withCredentials: true
    // No need to manually add Authorization header
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle common errors
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      
      // If 401 and not already retried, try to refresh token
      // BUT DON'T try to refresh if:
      // 1. This IS the refresh endpoint (prevents infinite loop)
      // 2. Already redirecting (prevents multiple redirects)
      // 3. Already on login page (no need to refresh)
      if (status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/refresh') && !isRedirecting) {
        // Don't try to refresh if already on login page
        if (window.location.pathname === '/login') {
          return Promise.reject(error);
        }

        originalRequest._retry = true;

        try {
          // Try to refresh the token
          await axiosInstance.post(`${API_URL}/auth/refresh`);
          
          // Retry the original request
          return axiosInstance(originalRequest);
        } catch (refreshError) {
          // Refresh failed, redirect to login (only once)
          if (!isRedirecting) {
            isRedirecting = true;
            console.error('Session expired - Please login again');
            window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        }
      }
      
      // If this is the refresh endpoint failing, redirect to login
      if (status === 401 && originalRequest.url?.includes('/auth/refresh') && !isRedirecting) {
        isRedirecting = true;
        window.location.href = '/login';
      }
      
      switch (status) {
        case 401:
          console.error('Unauthorized - Please login');
          break;
        case 403:
          console.error('Forbidden - Access denied');
          break;
        case 404:
          console.error('Not found');
          break;
        case 500:
          console.error('Server error');
          break;
        default:
          console.error(`Error: ${status}`);
      }
    } else if (error.request) {
      // Request was made but no response received
      console.error('Network error - No response from server');
    } else {
      // Something else happened
      console.error('Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;
