import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useLanguageStore = create(
  persist(
    (set) => ({
      language: 'en', // Default language is English
      translations: {}, // Will be populated by backend API later
      setLanguage: (language) => set({ language }),
      setTranslations: (translations) => set({ translations }),
    }),
    {
      name: 'framee-language-storage',
    }
  )
);
