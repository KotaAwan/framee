import { useLanguageStore } from '@/store/language.store';

import translationsData from '@/locales/translations.json';

const localDict = translationsData || { en: {}, id: {} };

export function useTranslation() {
  const language = useLanguageStore((state) => state.language);
  const translations = useLanguageStore((state) => state.translations); // dynamic from backend

  const t = (key, fallback) => {
    // Priority:
    // 1. Dynamic translations from API (stored in Zustand)
    if (translations[key]) return translations[key];
    
    // 2. Local fallback dictionary (based on selected language)
    if (localDict[language] && localDict[language][key]) return localDict[language][key];
    
    // 3. English fallback (if translation is missing in selected language)
    if (localDict['en'] && localDict['en'][key]) return localDict['en'][key];
    
    // 4. Return fallback argument if provided, otherwise the raw key
    return fallback || key;
  };

  return { t, language };
}
