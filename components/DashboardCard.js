import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../theme/colors';

export default function DashboardCard({ title, subtitle, icon, highlight, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.card, highlight && styles.highlight]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.iconWrap, highlight && styles.iconWrapHighlight]}>
        <Ionicons name={icon || 'ellipse-outline'} size={24} color={highlight ? Colors.white : Colors.secondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, highlight && styles.titleHighlight]} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={highlight ? Colors.white : Colors.subText} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  highlight: {
    backgroundColor: Colors.navy,
    borderColor: Colors.secondary,
    borderWidth: 1.5,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapHighlight: {
    backgroundColor: Colors.primary,
  },
  title: { fontSize: 13, fontWeight: '800', color: Colors.navy, lineHeight: 16 },
  titleHighlight: { color: Colors.white },
  subtitle: { fontSize: 11, color: Colors.subText, marginTop: 2, lineHeight: 14 },
});
