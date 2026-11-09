import axios from 'axios';
import { getToken, logout } from './auth';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api' });

api.interceptors.request.use(config => {
  const token = getToken();
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    // Log out on an expired or invalid token, but not on a failed login attempt
    if (error.response?.status === 401 && !error.config.url.includes('/auth/login')) {
      logout();
    }
    return Promise.reject(error);
  }
);

export default api;
