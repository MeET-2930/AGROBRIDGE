import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, RefreshControl, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../../components/AppHeader';
import Colors from '../../theme/colors';
import { useLang } from '../../i18n/LanguageContext';

const MOCK_NEWS = [
  {
    id: '1',
    tag: 'MSP',
    tagColor: '#138808',
    title_hi: 'गेहूं MSP 2025-26: ₹2,425/क्विंटल — 6.5% वृद्धि',
    title_en: 'Wheat MSP 2025-26: ₹2,425/qtl — 6.5% hike',
    body_hi: 'कैबिनेट ने रबी MSP घोषित किया। भुगतान DBT से 48 घंटे में। e-Kharid पर स्लॉट बुक करें।',
    body_en: 'Cabinet approves Rabi MSP. Payment via DBT within 48h. Book slot on e-Kharid.',
    date: '2026-10-26',
    link: 'https://pib.gov.in',
  },
  {
    id: '2',
    tag: 'PM-KISAN',
    tagColor: '#FF9933',
    title_hi: 'PM-KISAN 18वीं किस्त: ₹2,000 खाते में',
    title_en: 'PM-KISAN 18th instalment: ₹2,000 credited',
    body_hi: 'eKYC पूरा करें, आधार-सीडिंग अनिवार्य। हेल्पलाइन 155261।',
    body_en: 'Complete eKYC, Aadhaar seeding mandatory. Helpline 155261.',
    date: '2026-10-24',
    link: 'https://pmkisan.gov.in',
  },
  {
    id: '3',
    tag: 'SUBSIDY',
    tagColor: '#1a5fb4',
    title_hi: 'हरियाणा: धान पर ₹500/क्विंटल बोनस (अतिरिक्त)',
    title_en: 'Haryana: ₹500/qtl bonus on paddy (extra)',
    body_hi: 'मंडी में MFMB गेट पास पर ही मान्य। असली किसान सत्यापन अनिवार्य।',
    body_en: 'Valid only on MFMB gate pass at mandi. Genuine farmer verification required.',
    date: '2026-10-22',
    link: '',
  },
  {
    id: '4',
    tag: 'SCHEME',
    tagColor: '#7c3aed',
    title_hi: 'मीडियम अवधि भंडारण योजना — किसान को 3% ब्याज छूट',
    title_en: 'Medium-term storage scheme — 3% interest subvention',
    body_hi: 'FCI गोदाम में 6 माह तक भंडारण पर ब्याज में छूट। नजदीकी सहकारी समिति से संपर्क करें।',
    body_en: 'Interest relief for 6-month storage in FCI godowns. Contact your PACS.',
    date: '2026-10-20',
    link: '',
  },
  {
    id: '5',
    tag: 'MANDI',
    tagColor: '#0b3d0b',
    title_hi: 'AgroBridge नई मंडी: पटौदी में स्लॉट बुकिंग शुरू',
    title_en: 'AgroBridge new mandi: Slot booking starts at Pataudi',
    body_hi: 'अब पटौदी और फर्रुखनगर में भी ऑनलाइन स्लॉट। IVR 1800-XXX-XXXX पर भी बुक करें।',
    body_en: 'Online slots now at Pataudi & Farrukhnagar. Also book via IVR 1800-XXX-XXXX.',
    date: '2026-10-18',
    link: '',
  },
];

export default function FarmerNewsScreen({ navigation }) {
  const { lang } = useLang();
  const [refreshing, setRefreshing] = useState(false);
  const [news, setNews] = useState(MOCK_NEWS);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // TODO: fetch from /api/news or Firestore 'news' collection
    // const r = await fetch(`${IVR_BASE_URL}/api/news`).then(x=>x.json());
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const renderItem = ({ item }) => {
    const title = lang === 'hi' ? item.title_hi : item.title_en;
    const body = lang === 'hi' ? item.body_hi : item.body_en;
    return (
      <View style={styles.card}>
        <View style={styles.row1}>
          <View style={[styles.tag, { backgroundColor: item.tagColor }]}>
            <Text style={styles.tagText}>{item.tag}</Text>
          </View>
          <Text style={styles.date}>{item.date}</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        {item.link ? (
          <TouchableOpacity onPress={() => Linking.openURL(item.link)} style={styles.linkRow}>
            <Text style={styles.link}>पूरी जानकारी / Read more</Text>
            <Ionicons name="open-outline" size={14} color={Colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} title={lang === 'hi' ? 'योजनाएं व समाचार' : 'Schemes & News'} audioKey="audio_news" />
      <FlatList
        data={news}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{lang === 'hi' ? 'नवीनतम सरकारी योजनाएं' : 'Latest schemes & mandi updates'}</Text>
            <Text style={styles.headerSub}>{lang === 'hi' ? 'MSP, सब्सिडी, PM-KISAN और मंडी की ताज़ा खबर — रोज़ अपडेट।' : 'MSP, subsidies, PM-KISAN and mandi news — updated daily.'}</Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>No news yet</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: 16, paddingBottom: 24 },
  header: { marginBottom: 14, backgroundColor: Colors.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border },
  headerTitle: { fontSize: 16, fontWeight: '800', color: Colors.navy },
  headerSub: { fontSize: 13, color: Colors.subText, marginTop: 4, lineHeight: 18 },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  row1: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  tagText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  date: { fontSize: 11, color: Colors.subText },
  title: { fontSize: 15, fontWeight: '800', color: Colors.navy, lineHeight: 20 },
  body: { fontSize: 13, color: Colors.subText, marginTop: 6, lineHeight: 18 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  link: { fontSize: 13, color: Colors.primary, fontWeight: '700' },
  empty: { textAlign: 'center', color: Colors.subText, marginTop: 30 },
});
