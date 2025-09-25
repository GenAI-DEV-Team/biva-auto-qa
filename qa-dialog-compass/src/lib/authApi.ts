import { LoginRequest, RegisterRequest, AuthResponse, User } from '../types/auth';
import { api } from './api';

export const authApi = {
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await api.post('/auth/login', credentials);
    console.log('authApi.login response:', response);
    return response;
  },

  async register(userData: RegisterRequest): Promise<User> {
    const response = await api.post('/auth/register', userData);
    console.log('authApi.register response:', response);
    return response;
  },

  async logout(): Promise<{ message: string }> {
    const response = await api.post('/auth/logout');
    console.log('authApi.logout response:', response);
    return response;
  },

  async getCurrentUser(): Promise<User> {
    const response = await api.get('/auth/me');
    console.log('authApi.getCurrentUser response:', response);
    return response;
  },
};
