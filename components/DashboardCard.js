import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../theme/colors';

export default function DashboardCard({ title, icon, onPress, badge }) {
  const main = title != null ? String(title) : '';
  const badgeText = badge != null && String(badge).trim() !== '' ? String(badge) : '';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {badgeText !== '' ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeText}</Text>
        </View>
      ) : null}
      <View style={styles.iconContainer}>
        <Ionicons name={icon || 'grid-outline'} size={32} color={Colors.secondary} />
      </View>
      {main !== '' ? (
        <Text style={styles.title} numberOfLines={2}>{main}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '47.5%',
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingVertical: 22,
    paddingHorizontal: 12,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: Colors.error, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10,
  },
  badgeText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
  iconContainer: { marginBottom: 12 },
  title: { fontSize: 14, fontWeight: '700', color: Colors.navy, textAlign: 'center' },
});