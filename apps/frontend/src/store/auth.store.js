import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      tenantId: null,
      userId: null,
      token: null,
      email: null,
      fullName: null,
      avatarUrl: null,
      isAuthenticated: false,
      isLocked: false,
      pinFailedAttempts: 0,
      
      login: (tenantId, userId, email, token) => set({ tenantId, userId, email, token, isAuthenticated: true, isLocked: false, pinFailedAttempts: 0 }),
      logout: () => set({ tenantId: null, userId: null, email: null, fullName: null, avatarUrl: null, token: null, isAuthenticated: false, isLocked: false, pinFailedAttempts: 0 }),
      
      updateProfile: (fullName, avatarUrl) => set((state) => ({ 
        fullName: fullName !== undefined ? fullName : state.fullName,
        avatarUrl: avatarUrl !== undefined ? avatarUrl : state.avatarUrl
      })),

      lockSession: () => set({ isLocked: true }),
      unlockSession: () => set({ isLocked: false, pinFailedAttempts: 0 }),
      incrementPinFailedAttempt: () => set((state) => ({ pinFailedAttempts: state.pinFailedAttempts + 1 })),
    }),
    {
      name: 'framee-auth-storage',
    }
  )
);
