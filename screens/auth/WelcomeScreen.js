import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../theme/colors';
import { useLang } from '../../i18n/LanguageContext';

export default function WelcomeScreen({ navigation }) {
  const { tr, speak, setPickerOpen } = useLang();
  const startLabel = tr('getStarted') || 'शुरू करें';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topActions}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setPickerOpen(true)}>
          <Ionicons name="language" size={20} color={Colors.navy} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => speak('audio_welcome')}>
          <Ionicons name="volume-medium" size={20} color={Colors.navy} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.logo}>🌾</Text>
        <Text style={styles.brand}>AGROBRIDGE</Text>
        <Text style={styles.brandSub}>{tr('brandSub') || 'किसानसेतु - डिजिटल मंडी खरीद'}</Text>
        <Text style={styles.headline}>स्मार्ट मंडी खरीद</Text>
        <Text style={styles.headlineSub}>बिना लाइन, बिना इंतजार</Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cta}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('RoleSelection')}
        >
          <Text style={styles.ctaText}>{startLabel}</Text>
        </TouchableOpacity>
        <Text style={styles.footerTag}>कृषि मंत्रालय आधारित डिजिटल मंडी पहल</Text>
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
  logo: { fontSize: 64, marginBottom: 8 },
  brand: { fontSize: 32, fontWeight: '900', color: Colors.secondary, letterSpacing: 2 },
  brandSub: { fontSize: 13, fontWeight: '700', color: Colors.navy, marginTop: 6, textAlign: 'center' },
  headline: { fontSize: 22, fontWeight: '800', color: Colors.navy, marginTop: 28, textAlign: 'center' },
  headlineSub: { fontSize: 16, fontWeight: '700', color: Colors.primary, marginTop: 6, textAlign: 'center' },
  footer: { padding: 20, paddingBottom: 28 },
  cta: {
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', elevation: 3,
  },
  ctaText: { color: Colors.white, fontSize: 17, fontWeight: '800' },
  footerTag: { fontSize: 11, color: Colors.subText, textAlign: 'center', marginTop: 12 },
});