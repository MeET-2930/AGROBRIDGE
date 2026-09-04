import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '../theme/colors';

export default function ScreenTitle({ title, subtitle }) {
  const t = title != null ? String(title) : '';
  const s = subtitle != null ? String(subtitle) : '';

  return (
    <View style={styles.container}>
      {t !== '' ? <Text style={styles.title}>{t}</Text> : null}
      {s !== '' ? <Text style={styles.subtitle}>{s}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  title: { fontSize: 21, fontWeight: '800', color: Colors.navy, letterSpacing: 0.2, lineHeight: 28 },
  subtitle: { fontSize: 13, color: Colors.subText, marginTop: 6, lineHeight: 18 },
});