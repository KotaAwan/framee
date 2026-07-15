import { create } from 'zustand';
import apiClient from '../lib/api.client';

export const useMetadataStore = create((set, get) => ({
  doctypes: {}, // cache of doctype schemas keyed by doctype name
  modules: [],  // list of active modules
  
  fetchDocType: async (doctypeName) => {
    // If already cached, return it
    const existing = get().doctypes[doctypeName];
    if (existing) return existing;
    
    try {
      // In a real implementation this would fetch from GET /api/v1/meta/doctype/:name
      // For now, we mock the API call or rely on an endpoint that provides it.
      // E.g.: const response = await apiClient.get(`/api/v1/doc/DocType/${doctypeName}`);
      // set(state => ({ doctypes: { ...state.doctypes, [doctypeName]: response.data.data } }));
      
      return null;
    } catch (e) {
      console.error(`Failed to fetch metadata for ${doctypeName}`, e);
      return null;
    }
  },
  
  clearCache: () => set({ doctypes: {}, modules: [] })
}));
