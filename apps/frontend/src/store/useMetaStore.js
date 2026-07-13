import { create } from 'zustand';
import api from '../lib/axios';

const useMetaStore = create((set, get) => ({
  docTypes: {}, // Cache for doctype metadata
  isLoading: false,
  error: null,

  fetchDocTypeMeta: async (doctypeName) => {
    // If already cached, return it
    if (get().docTypes[doctypeName]) {
      return get().docTypes[doctypeName];
    }

    set({ isLoading: true, error: null });
    try {
      // In a real app, this hits the backend metadata engine endpoint
      const response = await api.get(`/meta/doctype/${doctypeName}`);
      const data = response.data.data;
      
      set((state) => ({
        docTypes: {
          ...state.docTypes,
          [doctypeName]: data
        },
        isLoading: false
      }));
      return data;
    } catch (error) {
      set({ 
        error: error.response?.data?.message || 'Failed to fetch doctype metadata', 
        isLoading: false 
      });
      console.error('Failed to fetch doctype metadata:', error);
      return null;
    }
  },
  
  clearCache: () => set({ docTypes: {} })
}));

export default useMetaStore;
