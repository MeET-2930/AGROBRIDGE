import React, { useState, useRef, useCallback } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import Colors from '../../theme/colors';
import { useLang } from '../../i18n/LanguageContext';
import { sendChatMessage } from '../../services/chatbot';

let counter = 0;
const nextId = () => `m${Date.now()}-${(counter += 1)}`;

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

You can ask in English, Hindi, or Hinglish.`,
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

export default function ChatbotScreen({ navigation }) {
  const { tr, lang } = useLang();

  const [messages, setMessages] = useState([
    { id: 'greeting', role: 'bot', text: '', isGreeting: true },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const listRef = useRef(null);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      if (listRef.current && typeof listRef.current.scrollToEnd === 'function') {
        listRef.current.scrollToEnd({ animated: true });
      }
    });
  }, []);

  const send = useCallback(async () => {
    const text = String(input || '').trim();
    if (!text || sending) return;

    setInput('');
    setError(null);
    setSending(true);
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', text }]);

    try {
      const reply = await sendChatMessage(text, messages);
      setMessages((prev) => [...prev, { id: nextId(), role: 'bot', text: reply }]);
    } catch (e) {
      setError(e);
    } finally {
      setSending(false);
    }
  }, [input, sending, messages]);

  const data = sending
    ? [...messages, { id: 'typing', role: 'bot', typing: true }]
    : messages;

  const renderItem = ({ item }) => {
    if (item.typing) {
      return (
        <View style={[styles.row, styles.rowBot]}>
          <View style={[styles.bubble, styles.bubbleBot]}>
            <Text style={styles.typing}>…</Text>
          </View>
        </View>
      );
    }

    const isUser = item.role === 'user';
    const body = item.isGreeting ? CHAT_GREETING[lang] || CHAT_GREETING.en : item.text;

    return (
      <View style={[styles.row, isUser ? styles.rowUser : styles.rowBot]}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
          <Text style={isUser ? styles.textUser : styles.textBot}>{body}</Text>
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
  typing: { color: Colors.subText, fontSize: 18, fontWeight: '700', paddingHorizontal: 4 },

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