/*
 * screens/common/HelpScreen.js
 * Help centre for every role: FAQ (tap to expand, 🔊 reads it),
 * call the mandi office, WhatsApp, and "Report a problem".
 * Route param: role = 'farmer' | 'officer' | 'trader'
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput,
  Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';
import { useLang } from '../../i18n/LanguageContext';
import { sendFeedback, APP_VERSION } from '../../services/feedback';
import { getCurrentUserSession } from '../../services/auth';
import { fetchCentreById } from '../../services/centres';

// Team helpline shown under "Ask on WhatsApp" - change to your number.
const HELPLINE_WHATSAPP = '919999999999';

const FAQ = {
  farmer: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'],
  officer: ['o1', 'o2', 'o3', 'o4', 'f2', 'f3'],
  trader: ['t1', 't2', 't3', 'f4'],
};

export default function HelpScreen({ navigation, route }) {
  const { tr, lang, speak, stopSpeak } = useLang();
  const role = route?.params?.role || 'farmer';
  const [open, setOpen] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [centrePhone, setCentrePhone] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await getCurrentUserSession();
      if (s?.centreId) {
        const c = await fetchCentreById(s.centreId).catch(() => null);
        if (alive && c?.phone) setCentrePhone(String(c.phone));
      }
    })();
    return () => { alive = false; stopSpeak(); };
  }, []);

  const submit = async () => {
    if (!text.trim()) { Alert.alert(tr('hc_report'), tr('hc_empty')); return; }
    setSending(true);
    try {
      await sendFeedback({ text, screen: route?.params?.from || 'Help', lang });
      setText('');
      Alert.alert(tr('done'), tr('hc_sent'));
    } catch (e) {
      Alert.alert(tr('error'), tr('hc_sendFail'));
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack title={tr('hc_title')} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenTitle title={tr('hc_title')} subtitle={tr('hc_sub')} />

        <Text style={styles.section}>{tr('hc_faq')}</Text>
        {FAQ[role].map((id) => {
          const on = open === id;
          return (
            <View key={id} style={[styles.faq, on && styles.faqOn]}>
              <TouchableOpacity style={styles.faqHead} onPress={() => { stopSpeak(); setOpen(on ? null : id); }}>
                <Text style={styles.faqQ}>{tr(`faq_${id}_q`)}</Text>
                <Ionicons name={on ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.subText} />
              </TouchableOpacity>
              {on ? (
                <View style={styles.faqBody}>
                  <Text style={styles.faqA}>{tr(`faq_${id}_a`)}</Text>
                  <TouchableOpacity style={styles.speak} onPress={() => speak(`faq_${id}_a`)}>
                    <Ionicons name="volume-medium" size={16} color={Colors.secondary} />
                    <Text style={styles.speakText}>{tr('listen')}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        })}

        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.tool, !centrePhone && { opacity: 0.5 }]}
            disabled={!centrePhone}
            onPress={() => Linking.openURL(`tel:${centrePhone}`)}
          >
            <Ionicons name="call-outline" size={20} color={Colors.secondary} />
            <Text style={styles.toolText}>{tr('hc_callMandi')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tool}
            onPress={() => Linking.openURL(`https://wa.me/${HELPLINE_WHATSAPP}?text=AgroBridge%20help`)}
          >
            <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
            <Text style={styles.toolText}>{tr('hc_whatsapp')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.section}>{tr('hc_report')}</Text>
        <Text style={styles.hint}>{tr('hc_reportHint')}</Text>
        <TextInput
          style={styles.input}
          multiline
          value={text}
          onChangeText={setText}
          placeholder={tr('hc_reportPh')}
          placeholderTextColor="#999"
        />
        <PrimaryButton title={tr('hc_send')} loading={sending} onPress={submit} style={{ marginTop: 10 }} />

        <Text style={styles.version}>{tr('hc_version')}: {APP_VERSION}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  section: { fontSize: 14, fontWeight: '800', color: Colors.navy, marginTop: 10, marginBottom: 8 },
  hint: { fontSize: 13, color: Colors.subText, marginBottom: 8 },
  faq: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, marginBottom: 8 },
  faqOn: { borderColor: Colors.primary },
  faqHead: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8 },
  faqQ: { flex: 1, fontWeight: '700', color: Colors.navy, fontSize: 14 },
  faqBody: { paddingHorizontal: 14, paddingBottom: 14 },
  faqA: { color: Colors.text, fontSize: 14, lineHeight: 20 },
  speak: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, alignSelf: 'flex-start' },
  speakText: { color: Colors.secondary, fontWeight: '800', fontSize: 13 },
  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
  tool: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12,
  },
  toolText: { flex: 1, fontWeight: '700', color: Colors.navy, fontSize: 13 },
  input: {
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    minHeight: 110, padding: 12, textAlignVertical: 'top', color: Colors.text,
  },
  version: { textAlign: 'center', color: Colors.subText, fontSize: 12, marginTop: 20 },
});
