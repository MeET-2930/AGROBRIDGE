import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import AppHeader from '../../components/AppHeader';
import Colors from '../../theme/colors';
import { useLang } from '../../i18n/LanguageContext';
import { getCurrentUserSession } from '../../services/auth';
import { sendChatMessage, translateTexts, missingTranslations } from '../../services/chatbot';

let counter = 0;
const nextId = () => `m${Date.now()}-${(counter += 1)}`;

const HISTORY_LIMIT = 60;
const CACHE_LIMIT = 200;

const historyKey = (id) => `chatHistory_${id || 'guest'}`;
const translationsKey = (id) => `chatTranslations_${id || 'guest'}`;

function sanitizeMessages(arr) {
  return (Array.isArray(arr) ? arr : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'bot') && typeof m.text === 'string')
    .map((m) => ({
      id: String(m.id || nextId()),
      role: m.role,
      text: m.text.slice(0, 2000),
      ...(m.isGreeting ? { isGreeting: true } : {}),
      ...(m.action === 'start-booking' ? { action: 'start-booking' } : {}),
    }))
    .slice(-HISTORY_LIMIT);
}

// Booking is deliberately handled by the app's booking screens, not by the
// language model. Those screens query live Firestore availability and use the
// transactional createBooking() path, so chat can never invent a free slot or
// a booking ID.
function isBookingRequest(text) {
  const value = String(text || '').toLowerCase();
  return /\b(book|booking|slot|appointment)\b|बुक|स्लॉट|बुकिंग|ਮੁਲਾਕਾਤ|ਸਲਾਟ|बुक करा|स्लॉट बुक/.test(value);
}

function bookingPrompt(lang) {
  const prompts = {
    hi: 'मैं आपके लिए वास्तविक स्लॉट बुकिंग शुरू कर सकता हूँ। पहले फसल, मंडी और मात्रा चुनें; फिर मैं लाइव उपलब्ध स्लॉट दिखाऊँगा। स्लॉट चुनने और पुष्टि करने के बाद ही बुकिंग बनेगी।',
    pa: 'ਮੈਂ ਤੁਹਾਡੇ ਲਈ ਅਸਲੀ ਸਲਾਟ ਬੁਕਿੰਗ ਸ਼ੁਰੂ ਕਰ ਸਕਦਾ ਹਾਂ। ਪਹਿਲਾਂ ਫ਼ਸਲ, ਮੰਡੀ ਅਤੇ ਮਾਤਰਾ ਚੁਣੋ; ਫਿਰ ਲਾਈਵ ਉਪਲਬਧ ਸਲਾਟ ਦਿਖਾਏ ਜਾਣਗੇ। ਸਲਾਟ ਚੁਣਨ ਅਤੇ ਪੁਸ਼ਟੀ ਤੋਂ ਬਾਅਦ ਹੀ ਬੁਕਿੰਗ ਬਣੇਗੀ।',
    mr: 'मी तुमच्यासाठी प्रत्यक्ष स्लॉट बुकिंग सुरू करू शकतो. आधी पीक, मंडी आणि प्रमाण निवडा; मग लाइव्ह उपलब्ध स्लॉट दिसतील. स्लॉट निवडून पुष्टी केल्यानंतरच बुकिंग होईल.',
    en: 'I can start a real slot booking for you. Choose the crop, mandi and quantity first; then you will see live available slots. A booking is created only after you select a slot and confirm it.',
  };
  return prompts[lang] || prompts.en;
}

function bookingButtonLabel(lang) {
  return ({ hi: 'स्लॉट बुकिंग शुरू करें', pa: 'ਸਲਾਟ ਬੁਕਿੰਗ ਸ਼ੁਰੂ ਕਰੋ', mr: 'स्लॉट बुकिंग सुरू करा', en: 'Start slot booking' })[lang] || 'Start slot booking';
}

function sanitizeCache(obj) {
  const out = {};
  for (const code of ['en', 'hi', 'pa', 'mr']) {
    if (!Array.isArray(obj[code])) continue;
    out[code] = obj[code]
      .filter((e) => e && typeof e.id === 'string' && typeof e.text === 'string')
      .map((e) => ({ id: e.id, text: e.text.slice(0, 2000) }))
      .slice(-CACHE_LIMIT);
  }
  return out;
}

function mergeCache(prev, code, out) {
  const cur = Array.isArray(prev?.[code]) ? prev[code].slice() : [];
  const known = new Set(cur.map((e) => e.id));
  for (const t of out) {
    if (t && typeof t.id === 'string' && typeof t.text === 'string' && !known.has(t.id)) {
      cur.push({ id: t.id, text: t.text.slice(0, 2000) });
      known.add(t.id);
    }
  }
  return { ...(prev || {}), [code]: cur.slice(-CACHE_LIMIT) };
}

function trimCache(cache) {
  const out = {};
  for (const code of ['en', 'hi', 'pa', 'mr']) {
    if (Array.isArray(cache?.[code])) out[code] = cache[code].slice(-CACHE_LIMIT);
  }
  return out;
}

function renderRichText(body, baseStyle, boldStyle) {
  const parts = String(body || '').split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const m = /^\*\*([^*]+)\*\*$/.exec(part);
    if (m) {
      return (
        <Text key={i} style={[baseStyle, boldStyle]}>
          {m[1]}
        </Text>
      );
    }
    return (
      <Text key={i} style={baseStyle}>
        {part}
      </Text>
    );
  });
}

const CHAT_GREETING = {
  hi: `नमस्ते 🙏 मैं AgroBridge सहायक हूँ। मैं इन सबमें आपकी मदद कर सकता हूँ:
• स्लॉट बुकिंग
• टोकन और कतार (क्यू) स्थिति
• मंडी / खरीद प्रक्रिया
• गेट एंट्री
• गुणवत्ता जांच (अस्से)
• तौल
• भुगतान
• MSP या नीलामी
• ज़रूरी दस्तावेज़

पूछ सकते हैं: 'स्लॉट कैसे बुक करूँ?', 'मेरा टोकन नंबर क्या है?', 'गेट पर मेरी बारी कब आएगी?', 'गुणवत्ता जांच कैसे होती है?', 'कौन से दस्तावेज़ लगते हैं?', 'MSP बेहतर है या नीलामी?'

आप अंग्रेज़ी, हिंदी या हिंग्लिश में पूछ सकते हैं।`,
  en: `Namaste 🙏 I'm the AgroBridge Assistant. I can help you with:
• Slot booking
• Token & queue status
• Mandi / procurement process
• Gate entry
• Quality check (assay)
• Weighing
• Payments
• MSP vs auction
• Required documents

Try asking: 'How do I book a slot?', 'What's my token status?', 'When is my turn at the gate?', 'How does the assay work?', 'What documents do I need?', or 'MSP vs auction – which is better?'

You can ask in English, Hindi, Punjabi, or Marathi.`,
  pa: `ਸਤ ਸ੍ਰੀ ਅਕਾਲ 🙏 ਮੈਂ AgroBridge ਸਹਾਇਕ ਹਾਂ। ਮੈਂ ਇਨ੍ਹਾਂ ਸਾਰਿਆਂ ਵਿੱਚ ਤੁਹਾਡੀ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ:
• ਸਲਾਟ ਬੁੱਕਿੰਗ
• ਟੋਕਨ ਅਤੇ ਕਤਾਰ (ਕਿਊ) ਸਥਿਤੀ
• ਮੰਡੀ / ਖਰੀਦ ਪ੍ਰਕਿਰਿਆ
• ਗੇਟ ਐਂਟਰੀ
• ਗੁਣਵੱਤਾ ਜਾਂਚ (ਅਸੇ)
• ਤੋਲ
• ਭੁਗਤਾਨ
• MSP ਜਾਂ ਨੀਲਾਮੀ
• ਲੋੜੀਂਦੇ ਦਸਤਾਵੇਜ਼

ਪੁੱਛ ਸਕਦੇ ਹੋ: 'ਸਲਾਟ ਕਿਵੇਂ ਬੁੱਕ ਕਰਾਂ?', 'ਮੇਰਾ ਟੋਕਨ ਨੰਬਰ ਕੀ ਹੈ?', 'ਗੇਟ ਤੇ ਮੇਰੀ ਵਾਰੀ ਕਦੋਂ ਆਵੇਗੀ?', 'ਗੁਣਵੱਤਾ ਜਾਂਚ ਕਿਵੇਂ ਹੁੰਦੀ ਹੈ?', 'ਕਿਹੜੇ ਦਸਤਾਵੇਜ਼ ਚਾਹੀਦੇ ਹਨ?', 'MSP ਵਧੀਆ ਹੈ ਜਾਂ ਨੀਲਾਮੀ?'

ਤੁਸੀਂ ਅੰਗਰੇਜ਼ੀ, ਪੰਜਾਬੀ ਜਾਂ ਹਿੰਗਲਿਸ਼ ਵਿੱਚ ਪੁੱਛ ਸਕਦੇ ਹੋ।`,
  mr: `नमस्कार 🙏 मी AgroBridge सहायक आहे. मी या सर्व गोष्टींमध्ये तुम्हाला मदत करू शकतो:
• स्लॉट बुकिंग
• टोकन आणि रांग (क्यू) स्थिती
• मंडी / खरेदी प्रक्रिया
• गेट प्रवेश
• गुणवत्ता तपासणी (असे)
• वजन
• पेमेंट
• MSP किंवा लिलाव
• आवश्यक दस्तऐवज

विचारू शकता: 'स्लॉट कसा बुक करू?', 'माझा टोकन नंबर काय आहे?', 'गेटवर माझी वेळ कधी येईल?', 'गुणवत्ता तपासणी कशी होते?', 'कोणती कागदपत्रे लागतात?', 'MSP चांगलं की लिलाव?'

तुम्ही इंग्रजी, हिंदी किंवा हिंग्लिशमध्ये विचारू शकता.`,
};

function TypingDots() {
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;
  const d3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = (v, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 300,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 300,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
    const a1 = bounce(d1, 0);
    const a2 = bounce(d2, 180);
    const a3 = bounce(d3, 360);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [d1, d2, d3]);

  const dots = [d1, d2, d3].map((v, i) => (
    <Animated.View
      key={i}
      style={[
        styles.typingDot,
        {
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
        },
      ]}
    />
  ));

  return <View style={styles.typingRow}>{dots}</View>;
}

export default function ChatbotScreen({ navigation }) {
  const { tr, lang } = useLang();

  const [messages, setMessages] = useState([
    { id: 'greeting', role: 'bot', text: '', isGreeting: true },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const listRef = useRef(null);
  const [uid, setUid] = useState(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [transCache, setTransCache] = useState({});
  const translatingRef = useRef(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const transCacheRef = useRef(transCache);
  transCacheRef.current = transCache;
  const langSettledRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      let id = 'guest';
      try {
        const session = await getCurrentUserSession();
        if (session?.uid) id = String(session.uid);
      } catch (e) {
        id = 'guest';
      }
      let storedMessages = null;
      let storedCache = null;
      try {
        const raw = await AsyncStorage.getItem(historyKey(id));
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) storedMessages = sanitizeMessages(arr);
        }
      } catch (e) {
        storedMessages = null;
      }
      try {
        const rawCache = await AsyncStorage.getItem(translationsKey(id));
        if (rawCache) {
          const obj = JSON.parse(rawCache);
          if (obj && typeof obj === 'object') storedCache = sanitizeCache(obj);
        }
      } catch (e) {
        storedCache = null;
      }
      if (!alive) return;
      setUid(id);
      if (storedMessages && storedMessages.length) setMessages(storedMessages);
      if (storedCache) setTransCache(storedCache);
      setHistoryLoaded(true);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!historyLoaded || !uid) return;
    AsyncStorage.setItem(historyKey(uid), JSON.stringify(messages.slice(-HISTORY_LIMIT))).catch(() => {});
  }, [messages, uid, historyLoaded]);

  useEffect(() => {
    if (!historyLoaded || !uid) return;
    AsyncStorage.setItem(translationsKey(uid), JSON.stringify(trimCache(transCache))).catch(() => {});
  }, [transCache, uid, historyLoaded]);

  const displayMessages = useMemo(() => {
    const entries = Array.isArray(transCache?.[lang]) ? transCache[lang] : null;
    if (!entries || !entries.length) return messages;
    const byId = new Map(entries.map((e) => [e.id, e.text]));
    let changed = false;
    const out = messages.map((m) => {
      if (m.isGreeting || m.typing) return m;
      const t = byId.get(m.id);
      if (typeof t === 'string' && t !== m.text) {
        changed = true;
        return { ...m, text: t };
      }
      return m;
    });
    return changed ? out : messages;
  }, [messages, transCache, lang]);

  useEffect(() => {
    if (!historyLoaded || !uid) return;
    const key = `${uid}|${lang}`;
    if (langSettledRef.current === key) return;
    const first = langSettledRef.current === null;
    langSettledRef.current = key;
    if (first) return;
    const cache = transCacheRef.current;
    const missing = missingTranslations(
      messagesRef.current,
      cache?.[lang]
    );
    if (!missing.length) return;
    if (translatingRef.current === key) return;
    translatingRef.current = key;
    (async () => {
      try {
        const out = await translateTexts(
          missing.map((m) => ({ id: m.id, text: m.text })),
          lang
        );
        if (Array.isArray(out) && out.length) {
          setTransCache((prev) => mergeCache(prev, lang, out));
        }
      } catch (e) {
        // Keep showing the original text; switching language again retries.
      } finally {
        if (translatingRef.current === key) translatingRef.current = null;
      }
    })();
  }, [lang, uid, historyLoaded]);

  const faqQuestions = [
    tr('chat_faq1'),
    tr('chat_faq2'),
    tr('chat_faq3'),
    tr('chat_faq4'),
    tr('chat_faq5'),
    tr('chat_faq6'),
  ];

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      if (listRef.current && typeof listRef.current.scrollToEnd === 'function') {
        listRef.current.scrollToEnd({ animated: true });
      }
    });
  }, []);

  const deliver = useCallback(async (rawText) => {
    const text = String(rawText || '').trim();
    if (!text || sending) return;

    setError(null);
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', text }]);

    // Do not ask the read-only AI service to book. Hand the farmer to the
    // existing, authenticated flow which reads live capacity and creates the
    // booking in a Firestore transaction after explicit confirmation.
    if (isBookingRequest(text)) {
      const replyId = nextId();
      const reply = bookingPrompt(lang);
      setMessages((prev) => [...prev, { id: replyId, role: 'bot', text: reply, action: 'start-booking' }]);
      setTransCache((prev) => mergeCache(prev, lang, [{ id: replyId, text: reply }]));
      return;
    }

    setSending(true);

    let phone = null;
    try {
      const session = await getCurrentUserSession();
      phone = session?.uid || null;
    } catch (e) {
      phone = null;
    }

    const replyLang = lang;
    try {
      const reply = await sendChatMessage(text, messages, phone, replyLang);
      const replyId = nextId();
      setMessages((prev) => [...prev, { id: replyId, role: 'bot', text: reply }]);
      setTransCache((prev) => mergeCache(prev, replyLang, [{ id: replyId, text: reply }]));
    } catch (e) {
      setError(e);
    } finally {
      setSending(false);
    }
  }, [sending, messages, lang]);

  const send = useCallback(() => {
    const text = String(input || '').trim();
    if (!text) return;
    setInput('');
    deliver(text);
  }, [input, deliver]);

  const sendPreset = useCallback((q) => {
    setInput('');
    deliver(q);
  }, [deliver]);

  const startBooking = useCallback(() => {
    navigation.navigate('CropSelection');
  }, [navigation]);

  const data = sending
    ? [...displayMessages, { id: 'typing', role: 'bot', typing: true }]
    : displayMessages;

  const renderItem = ({ item }) => {
    if (item.typing) {
      return (
        <View style={[styles.row, styles.rowBot]}>
          <View style={[styles.bubble, styles.bubbleBot]}>
            <TypingDots />
          </View>
        </View>
      );
    }

    const isUser = item.role === 'user';
    const body = item.isGreeting ? CHAT_GREETING[lang] || CHAT_GREETING.en : item.text;

    return (
      <View style={[styles.row, isUser ? styles.rowUser : styles.rowBot]}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
          <Text style={isUser ? styles.textUser : styles.textBot}>
            {isUser ? body : renderRichText(body, styles.textBot, styles.bold)}
          </Text>
          {item.action === 'start-booking' ? (
            <TouchableOpacity style={styles.bookingAction} onPress={startBooking} activeOpacity={0.8}>
              <Ionicons name="calendar-outline" size={16} color={Colors.white} />
              <Text style={styles.bookingActionText}>{bookingButtonLabel(lang)}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  const sendDisabled = !String(input || '').trim() || sending;

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack title={tr('chat_title')} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={listRef}
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollToEnd}
          onLayout={scrollToEnd}
        />

        {messages.length <= 1 && !sending ? (
          <View style={styles.faqCard}>
            <Text style={styles.faqTitle}>{tr('chat_faqTitle')}</Text>
            <Text style={styles.faqHint}>{tr('chat_faqHint')}</Text>
            <View style={styles.chipRow}>
              {faqQuestions.map((q) => (
                <TouchableOpacity
                  key={q}
                  style={styles.chip}
                  onPress={() => sendPreset(q)}
                  disabled={sending}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={14} color={Colors.primary} />
                  <Text style={styles.chipText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBar}>
            <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
            <Text style={styles.errorText}>{tr('chat_error')}</Text>
          </View>
        ) : null}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={tr('chat_placeholder')}
            placeholderTextColor="#999"
            multiline
            maxLength={2000}
            blurOnSubmit={false}
            returnKeyType="send"
            onSubmitEditing={send}
            onKeyPress={(e) => {
              if (e?.nativeEvent?.key === 'Enter' && !e.nativeEvent.shiftKey) {
                if (typeof e.preventDefault === 'function') e.preventDefault();
                send();
              }
            }}
          />
          <TouchableOpacity
            style={[styles.sendBtn, sendDisabled && styles.sendOff]}
            onPress={send}
            disabled={sendDisabled}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Ionicons name="send" size={18} color={Colors.white} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },

  listContent: { padding: 14, paddingBottom: 8 },

  row: { marginBottom: 10, width: '100%' },
  rowUser: { alignItems: 'flex-end' },
  rowBot: { alignItems: 'flex-start' },

  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 4 },

  textUser: { color: Colors.white, fontSize: 15, lineHeight: 21 },
  textBot: { color: Colors.text, fontSize: 15, lineHeight: 21 },
  bold: { fontWeight: '700' },
  bookingAction: { marginTop: 10, backgroundColor: Colors.primary, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start' },
  bookingActionText: { color: Colors.white, fontSize: 13, fontWeight: '800' },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 4, paddingVertical: 6 },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.subText },

  faqCard: {
    backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12,
  },
  faqTitle: { color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  faqHint: { color: Colors.subText, fontSize: 13, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.primary, borderRadius: 18,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 2,
  },
  chipText: { color: Colors.text, fontSize: 13, fontWeight: '600', flexShrink: 1 },

  errorBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FDECEA', borderRadius: 10,
    marginHorizontal: 14, marginBottom: 8, padding: 10,
  },
  errorText: { flex: 1, color: Colors.error, fontSize: 13, fontWeight: '600' },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10,
    maxHeight: 110, minHeight: 42,
    color: Colors.text, fontSize: 15,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendOff: { opacity: 0.45 },
});
