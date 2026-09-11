import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../theme/colors';
import { useLang } from '../../i18n/LanguageContext';
import { LOGO_FULL } from '../../theme/brand';

export default function WelcomeScreen({ navigation }) {
  const { tr, setPickerOpen } = useLang();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Image source={LOGO_FULL} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brandSub}>{tr('brandSub')}</Text>
        <Text style={styles.headline}>{tr('welcome_headline')}</Text>
        <Text style={styles.headlineSub}>{tr('welcome_sub')}</Text>

        <TouchableOpacity style={styles.langPill} onPress={() => setPickerOpen(true)}>
          <Ionicons name="language" size={16} color={Colors.secondary} />
          <Text style={styles.langPillText}>{tr('selectLanguage')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cta}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('RoleSelection')}
        >
          <Text style={styles.ctaText}>{tr('getStarted')}</Text>
        </TouchableOpacity>
        <Text style={styles.footerTag}>{tr('welcome_footer')}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.accent,
    justifyContent: 'center', alignItems: 'center',
  },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  logo: { width: 260, height: 260, marginBottom: -10 },
  brandSub: { fontSize: 13, fontWeight: '700', color: Colors.navy, marginTop: 6, textAlign: 'center' },
  headline: { fontSize: 22, fontWeight: '800', color: Colors.navy, marginTop: 28, textAlign: 'center' },
  headlineSub: { fontSize: 16, fontWeight: '700', color: Colors.primary, marginTop: 6, textAlign: 'center' },
  langPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 26,
    backgroundColor: Colors.accent, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  langPillText: { color: Colors.secondary, fontWeight: '800', fontSize: 13 },
  footer: { padding: 20, paddingBottom: 28 },
  cta: {
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', elevation: 3,
  },
  ctaText: { color: Colors.white, fontSize: 17, fontWeight: '800' },
  footerTag: { fontSize: 11, color: Colors.subText, textAlign: 'center', marginTop: 12 },
});
