import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
} from 'react';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translate, LANGUAGES, DEFAULT_LANG } from './translations';

const LanguageContext = createContext(null);
const STORAGE_KEY = 'agrobridge.lang';

const SPEECH_LANG = { hi: 'hi-IN', en: 'en-IN', pa: 'pa-IN', mr: 'mr-IN', gu: 'gu-IN' };

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(DEFAULT_LANG);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Remember the farmer's choice across app restarts.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved && LANGUAGES.some((l) => l.code === saved)) setLangState(saved);
      })
      .catch(() => {});
  }, []);

  const setLang = useCallback((code) => {
    setLangState(code);
    AsyncStorage.setItem(STORAGE_KEY, code).catch(() => {});
  }, []);

  /**
   * tr('key')                      -> translated string
   * tr('key', { n: 3 })            -> with {n} replaced
   * tr({ key, params })            -> same, object form (used by services)
   * Falls back to the key itself so a missing string is visible, not blank.
   */
  const tr = useCallback(
    (keyOrObj, params) => {
      if (keyOrObj == null || keyOrObj === '') return '';
      if (typeof keyOrObj === 'object') {
        return translate(keyOrObj.key, lang, keyOrObj.params);
      }
      return translate(keyOrObj, lang, params);
    },
    [lang]
  );

  /**
   * Translate an Error thrown by services. Errors carry `.key` and
   * `.params` when they are user-facing; otherwise we show message.
   */
  const trError = useCallback(
    (error, fallbackKey = 'err.generic') => {
      if (error?.key) return translate(error.key, lang, error.params);
      if (error?.message) return error.message;
      return translate(fallbackKey, lang);
    },
    [lang]
  );

  const speak = useCallback(
    (keyOrText, isRaw = false) => {
      const text = isRaw ? String(keyOrText || '') : translate(keyOrText, lang);
      if (!text) return;
      Speech.stop();
      Speech.speak(String(text), { language: SPEECH_LANG[lang] || 'hi-IN', rate: 0.9 });
    },
    [lang]
  );

  const stopSpeak = useCallback(() => Speech.stop(), []);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      tr,
      trError,
      speak,
      stopSpeak,
      pickerOpen,
      setPickerOpen,
      languages: LANGUAGES,
    }),
    [lang, setLang, tr, trError, speak, stopSpeak, pickerOpen]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx;
}
