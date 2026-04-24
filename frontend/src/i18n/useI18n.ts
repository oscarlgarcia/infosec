import { useState, useCallback, useEffect } from 'react';
import { translations, Language, TranslationKey } from './index';

const STORAGE_KEY = 'infosec-language';

export function useI18n() {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved === 'en' || saved === 'es') ? saved : 'es';
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }, []);

  const t = useCallback((key: TranslationKey): string => {
    return translations[language][key] || key;
  }, [language]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return { language, setLanguage, t };
}
