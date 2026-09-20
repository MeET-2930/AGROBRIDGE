/*
 * screens/officer/SmsOutboxScreen.js  (install55, admin only)
 * ---------------------------------------------------------------
 * Every farmer notification also becomes ONE <=160-character SMS in
 * the `smsOutbox` collection. There is no SMS gateway yet (needs
 * Blaze + DLT registration, see BLAZE_LATER.md), so every row sits
 * at "queued (no gateway)". This screen proves the text is ready and
 * short enough for a keypad phone. When a gateway is funded, a small
 * Cloud Function drains this collection and flips status to 'sent'.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import Colors from '../../theme/colors';
import { subscribeSmsOutbox, SMS_MAX } from '../../services/notifications';
import { useLang } from '../../i18n/LanguageContext';

export default function SmsOutboxScreen({ navigation }) {
  const { tr } = useLang();
  const [rows, setRows] = useState(null);

  useEffect(() => subscribeSmsOutbox(setRows, 100), []);

  const list = rows || [];
  const queued = list.filter((r) => String(r.status).startsWith('queued')).length;
  const tooLong = list.filter((r) => (r.chars || 0) > SMS_MAX).length;

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle title={tr('so_title')} subtitle={tr('so_sub')} />

        <View style={styles.banner}>
          <Ionicons name="information-circle-outline" size={20} color="#92400E" />
          <Text style={styles.bannerText}>{tr('so_noGateway')}</Text>
        </View>

        <View style={styles.statRow}>
          <Stat n={list.length} l={tr('so_total')} />
          <Stat n={queued} l={tr('so_queued')} />
          <Stat n={tooLong} l={tr('so_tooLong')} bad={tooLong > 0} />
        </View>

        {rows === null ? (
          <Text style={styles.empty}>{tr('loading')}</Text>
        ) : list.length === 0 ? (
          <Text style={styles.empty}>{tr('so_empty')}</Text>
        ) : (
          list.map((r) => (
            <View key={r.id} style={styles.card}>
              <View style={styles.top}>
                <Text style={styles.to}>+91 {r.to}</Text>
                <Text style={styles.when}>{String(r.createdAt || '').slice(0, 16).replace('T', ' ')}</Text>
              </View>
              <Text style={styles.body}>{r.text}</Text>
              <View style={styles.top}>
                <Text style={[styles.meta, (r.chars || 0) > SMS_MAX && { color: Colors.error }]}>{r.chars}/{SMS_MAX} • {r.lang}</Text>
                <Text style={styles.status}>{r.status}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ n, l, bad }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statN, bad && { color: Colors.error }]}>{n}</Text>
      <Text style={styles.statL}>{l}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  banner: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, marginBottom: 14 },
  bannerText: { flex: 1, color: '#92400E', fontSize: 13, lineHeight: 18 },
  statRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  stat: { flex: 1, backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12, alignItems: 'center' },
  statN: { fontSize: 22, fontWeight: '900', color: Colors.navy },
  statL: { fontSize: 11, color: Colors.subText, marginTop: 2, textAlign: 'center' },
  empty: { textAlign: 'center', color: Colors.subText, marginTop: 20 },
  card: { backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12, marginBottom: 8 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  to: { fontWeight: '800', color: Colors.navy },
  when: { fontSize: 11, color: Colors.subText },
  body: { color: Colors.text, fontSize: 14, marginVertical: 8, lineHeight: 20, fontFamily: undefined },
  meta: { fontSize: 11, color: Colors.subText },
  status: { fontSize: 11, color: '#92400E', fontWeight: '800' },
});
