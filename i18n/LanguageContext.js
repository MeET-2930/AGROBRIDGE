import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import * as Speech from 'expo-speech';
import { translate, LANGUAGES } from './translations';

const LanguageContext = createContext(null);

const SPEECH_LANG = { hi: 'hi-IN', en: 'en-IN', pa: 'pa-IN', mr: 'mr-IN', gu: 'gu-IN' };

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('hi'); // Hindi default
  const [pickerOpen, setPickerOpen] = useState(false);

  const tr = useCallback((key) => String(translate(key, lang) || ''), [lang]);

  const speak = useCallback((keyOrText, isRaw = false) => {
    const text = isRaw ? String(keyOrText || '') : translate(keyOrText, lang);
    if (!text) return;
    Speech.stop();
    Speech.speak(String(text), { language: SPEECH_LANG[lang] || 'hi-IN', rate: 0.9 });
  }, [lang]);

  const stopSpeak = useCallback(() => Speech.stop(), []);

  const value = useMemo(() => ({
    lang, setLang, tr, speak, stopSpeak, pickerOpen, setPickerOpen, languages: LANGUAGES,
  }), [lang, tr, speak, stopSpeak, pickerOpen]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx;
}