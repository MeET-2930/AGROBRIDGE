import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLang } from '../../i18n/LanguageContext';
import { getCurrentUserSession } from '../../services/auth';
import { IVR_BASE_URL } from '../../services/config';
import Colors from '../../theme/colors';
import AppHeader from '../../components/AppHeader';

export default function AIVoiceBookingScreen({ navigation }) {
  const { tr, lang } = useLang();
  const [session, setSession] = useState(null);
  const [phone, setPhone] = useState('9100000001');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const scrollRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    getCurrentUserSession().then((u) => {
      if (u?.phone) setPhone(u.phone);
      setSession(u);
      // silent start — no greeting spoken, just ready
    });
  }, []);

  const scrollToEnd = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const speak = (text) => {
    if (Platform.OS === 'web' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const u = new window.SpeechSynthesisUtterance(text);
        u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
        u.rate = 0.96;
        window.speechSynthesis.speak(u);
      } catch (e) {}
    }
  };

  const stopSpeech = () => {
    try {
      if (Platform.OS === 'web' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
      // also stop any audio elements
      if (Platform.OS === 'web') document.querySelectorAll('audio').forEach(a=>{a.pause();a.src='';});
    } catch (e) {}
  };

  const send = async (content) => {
    if (!content.trim() || sending) return;
    // App has session — no phone check needed (Gemma will use logged-in farmer)
    const p = (session?.phone || phone).replace(/\D/g, '').slice(-10);
    const farmerName = session?.name || '';
    stopSpeech();
    const newMessages = [...messages, { role: 'user', content }];
    setMessages(newMessages);
    setInput('');
    setSending(true);
    try {
      // Use Gemma endpoint — speak whatever you wish, it extracts values
      const r = await fetch(`${IVR_BASE_URL}/agent/gemma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-agb-key': 'agb-dev-key' },
        body: JSON.stringify({ messages: newMessages, phone: p, farmerName, lang, text: content }),
      });
      const j = await r.json();
      const reply = j.reply || 'क्षमा कीजिए';
      const updated = [...newMessages, { role: 'assistant', content: reply }];
      setMessages(updated);
      speak(reply);
      if (j.done) {
        // booking done — will appear in dashboard
      }
    } catch (e) {
      setMessages([...newMessages, { role: 'assistant', content: 'नेटवर्क दिक्कत, फिर से बोलिए।' }]);
    } finally {
      setSending(false);
      scrollToEnd();
    }
  };

  const toggleMic = () => {
    stopSpeech(); // shut up instantly when you tap mic
    if (recording) {
      try { recognitionRef.current?.stop(); } catch (e) {}
      setRecording(false);
      return;
    }
    const SR = Platform.OS === 'web' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
    if (!SR) {
      alert('Mic not supported on this device — type instead');
      return;
    }
    const rec = new SR();
    rec.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    rec.interimResults = false;
    rec.continuous = false;
    recognitionRef.current = rec;
    setRecording(true);
    rec.onresult = (e) => {
      const t = (e.results[0] && e.results[0][0] && e.results[0][0].transcript) || '';
      if (t) send(t);
    };
    rec.onend = () => setRecording(false);
    rec.onerror = () => setRecording(false);
    try { rec.start(); setTimeout(()=>{ try{rec.stop()}catch(e){} }, 7000); } catch (e) { setRecording(false); }
  };

  return (
    <View style={styles.container}>
      <AppHeader navigation={navigation} title="AI Voice Booking" audioKey="audio_farmer_dashboard" />
      <View style={styles.topRow}>
        <Text style={styles.hint}>Gemma से बोलें — जो मन में है: "गुरुग्राम में गेहूं 20 क्विंटल कल सुबह 10 बजे" — नाम/फोन नहीं पूछेगी, सीधे बुक करेगी</Text>
      </View>
      <ScrollView ref={scrollRef} style={styles.chat} contentContainerStyle={{ padding: 12 }}>
        {messages.length === 0 ? (
          <Text style={styles.empty}>Gemma सुनकर खुद मंडी/फसल/मात्रा/तारीख/समय निकाल लेगी — आप बस बोल दें, जो कमी होगी वही पूछेगी। लॉगिन से नाम/फोन पहले से पता है।</Text>
        ) : (
          messages.map((m, i) => (
            <View key={i} style={[styles.msg, m.role === 'user' ? styles.me : styles.bot]}>
              <Text style={styles.msgText}>{m.content}</Text>
            </View>
          ))
        )}
        {sending ? <ActivityIndicator style={{ marginTop: 8 }} color={Colors.primary} /> : null}
      </ScrollView>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="e.g. मेरा नाम राहुल, गुरुग्राम में गेहूं 20 क्विंटल"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => send(input)}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={() => send(input)}>
          <Ionicons name="send" size={18} color={Colors.white} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={[styles.micBtn, recording && styles.micRec]} onPress={toggleMic}>
        <Ionicons name={recording ? 'stop' : 'mic'} size={22} color={Colors.white} />
        <Text style={styles.micText}>{recording ? 'Listening… tap to stop' : '🎤 Speak Sentence — tap to talk'}</Text>
      </TouchableOpacity>
      <Text style={styles.status}>Gemma (Google) • +91 {session?.phone || phone} • {lang === 'hi' ? 'हिन्दी' : 'English'} • tap mic to stop</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topRow: { padding: 10, alignItems: 'center' },
  hint: { fontSize: 12, color: Colors.subText, textAlign: 'center' },
  chat: { flex: 1, backgroundColor: '#f3f4f6', margin: 12, borderRadius: 16 },
  empty: { color: Colors.subText, fontSize: 13, textAlign: 'center', marginTop: 20, lineHeight: 18 },
  msg: { maxWidth: '86%', padding: 10, borderRadius: 14, marginVertical: 6 },
  me: { backgroundColor: '#fff3e0', borderRightWidth: 3, borderRightColor: Colors.primary, alignSelf: 'flex-end' },
  bot: { backgroundColor: '#e8f5e9', borderLeftWidth: 3, borderLeftColor: Colors.secondary, alignSelf: 'flex-start' },
  msgText: { fontSize: 14, color: Colors.navy, lineHeight: 18 },
  inputRow: { flexDirection: 'row', gap: 8, padding: 12, alignItems: 'center' },
  input: { flex: 1, height: 42, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, backgroundColor: Colors.white },
  sendBtn: { width: 44, height: 42, borderRadius: 10, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center' },
  micBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.secondary, marginHorizontal: 12, marginBottom: 6, height: 48, borderRadius: 14 },
  micRec: { backgroundColor: Colors.error },
  micText: { color: Colors.white, fontWeight: '800', fontSize: 14 },
  status: { fontSize: 11, color: Colors.subText, textAlign: 'center', marginBottom: 8 },
});
