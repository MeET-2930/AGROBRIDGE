import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../theme/colors';

export default function PrimaryCard({ title, subtitle, icon, onPress, style }) {
  const t = title != null ? String(title) : '';
  const s = subtitle != null ? String(subtitle) : '';

  return (
    <TouchableOpacity style={[styles.card, style]} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.iconBox}>
        <Ionicons name={icon || 'document-text-outline'} size={28} color={Colors.secondary} />
      </View>
      <View style={styles.textContainer}>
        {t !== '' ? <Text style={styles.title}>{t}</Text> : null}
        {s !== '' ? <Text style={styles.subtitle}>{s}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={22} color={Colors.subText} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  textContainer: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', color: Colors.navy },
  subtitle: { fontSize: 12, color: Colors.subText, marginTop: 4, lineHeight: 18 },
});