import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { Alert, Linking, Platform, AppState } from 'react-native';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translate, LANGUAGES, DEFAULT_LANG } from './translations';

const LanguageContext = createContext(null);
const STORAGE_KEY = 'agrobridge.lang';

const SPEECH_LANG = { hi: 'hi-IN', en: 'en-IN', pa: 'pa-IN', mr: 'mr-IN', gu: 'gu-IN' };
const LANG_NAME = { hi: 'Hindi / हिन्दी', en: 'English', pa: 'Punjabi / ਪੰਜਾਬੀ', mr: 'Marathi / मराठी' };

/*
 * install22 - UNIVERSAL VOICE
 * Expo Go carries Google's online voices, a plain APK only has what the
 * phone has installed. Many phones ship without Hindi/Punjabi/Marathi
 * voices, so the speaker button was silent there. Now:
 *   1. ask the phone which voices exist (cached per session)
 *   2. missing? -> speak the ENGLISH text (always present) and show,
 *      once, a dialog with a button that opens the phone's TTS settings.
 */
let voicesCache = null;
async function hasVoiceFor(lang) {
  if (Platform.OS === 'web') return true;
  try {
    if (!voicesCache) voicesCache = await Speech.getAvailableVoicesAsync();
    const want = (SPEECH_LANG[lang] || '').slice(0, 2).toLowerCase();
    return voicesCache.some((v) => String(v.language || '').toLowerCase().startsWith(want));
  } catch (e) {
    return true;              // cannot tell -> just try
  }
}
function openTtsSettings() {
  if (Platform.OS === 'android') {
    Linking.sendIntent('com.android.settings.TTS_SETTINGS').catch(() => Linking.openSettings());
  } else {
    Linking.openSettings();
  }
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(DEFAULT_LANG);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);   // true while voice help plays

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

  const warnedRef = React.useRef(false);

  const speak = useCallback(
    async (keyOrText, isRaw = false) => {
      let useLang = lang;
      let text = isRaw ? String(keyOrText || '') : translate(keyOrText, lang);
      if (!text) return;

      if (lang !== 'en' && !(await hasVoiceFor(lang))) {
        useLang = 'en';
        // read the English version of the same help text when we have a key
        if (!isRaw) text = translate(keyOrText, 'en');
        if (!warnedRef.current) {
          warnedRef.current = true;
          const name = LANG_NAME[lang] || lang;
          Alert.alert(
            translate('tts_missing_t', lang, { lang: name }),
            translate('tts_missing_d', lang, { lang: name }),
            [
              { text: translate('tts_later', lang), style: 'cancel' },
              { text: translate('tts_openSettings', lang), onPress: openTtsSettings },
            ]
          );
        }
      }

      Speech.stop();
      setSpeaking(true);
      const done = () => setSpeaking(false);
      Speech.speak(String(text), {
        language: SPEECH_LANG[useLang] || 'en-IN',
        rate: 0.9,
        onDone: done,
        onStopped: done,
        onError: done,
      });
    },
    [lang]
  );

  const stopSpeak = useCallback(() => {
    Speech.stop();
    setSpeaking(false);
  }, []);

  // Stop talking if the language changes mid-sentence.
  useEffect(() => { Speech.stop(); setSpeaking(false); }, [lang]);

  // install40: stop talking when the app goes to the background. (Screen
  // changes are handled by <StopSpeechOnNavigate/> inside the navigator.)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') { Speech.stop(); setSpeaking(false); }
    });
    return () => sub?.remove?.();
  }, []);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      tr,
      trError,
      speak,
      stopSpeak,
      speaking,
      pickerOpen,
      setPickerOpen,
      languages: LANGUAGES,
    }),
    [lang, setLang, tr, trError, speak, stopSpeak, speaking, pickerOpen]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx;
}

/**
 * install40: put this inside NavigationContainer. Whenever the screen changes
 * (any button that navigates), the voice help stops - a farmer who understood
 * quickly should not have to listen to the rest.
 */
export function StopSpeechOnNavigate({ routeName }) {
  const { stopSpeak } = useLang();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    stopSpeak();
  }, [routeName, stopSpeak]);
  return null;
}
