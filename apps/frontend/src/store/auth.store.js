import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '../lib/api.client';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLocked: false,
      
      login: async (email, password) => {
        const response = await apiClient.post('/api/v1/auth/login', { email, password });
        const { token, refresh_token, user } = response.data.data;
        
        set({
          user,
          accessToken: token,
          refreshToken: refresh_token,
          isAuthenticated: true,
          isLocked: false
        });
      },
      
      logout: async () => {
        const { refreshToken } = get();
        try {
          if (refreshToken) {
            await apiClient.post('/api/v1/auth/logout', { refresh_token: refreshToken });
          }
        } catch (e) {
          console.error('Logout error', e);
        } finally {
          set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, isLocked: false });
          window.location.href = '/login';
        }
      },
      
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      updateProfile: (fullName, avatarUrl) => set((state) => ({
        user: state.user ? { ...state.user, fullName, avatarUrl } : null
      })),
      lockSession: () => set({ isLocked: true }),
      unlockSession: () => set({ isLocked: false })
    }),
    {
      name: 'framee-auth-storage',
    }
  )
);
