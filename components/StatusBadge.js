import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLang } from '../i18n/LanguageContext';

/*
 * Covers every status in the booking state machine:
 *   booked -> in-gate -> assay -> price-fixed -> weighing
 *          -> payment-processing -> paid
 * plus rejected / no-show / cancelled / waitlisted.
 * The label comes from translations: key "st_<status>".
 */
const COLORS = {
  'booked': { bg: '#FFF8E1', color: '#F57F17' },
  'in-gate': { bg: '#E3F2FD', color: '#1565C0' },
  'assay': { bg: '#EDE7F6', color: '#5E35B1' },
  'price-fixed': { bg: '#E8F5E9', color: '#1B5E20' },
  'weighing': { bg: '#E0F7FA', color: '#00838F' },
  'payment-processing': { bg: '#FFF3E0', color: '#EF6C00' },
  'paid': { bg: '#E8F5E9', color: '#2E7D32' },
  'rejected': { bg: '#FFEBEE', color: '#C62828' },
  'no-show': { bg: '#FFEBEE', color: '#C62828' },
  'missed': { bg: '#FFF3E0', color: '#E65100' },
  'cancelled': { bg: '#FAFAFA', color: '#757575' },
  'waitlisted': { bg: '#EDE7F6', color: '#5E35B1' },
  'appeared': { bg: '#E3F2FD', color: '#1565C0' },
};

export default function StatusBadge({ status }) {
  const { tr } = useLang();
  const c = COLORS[status] || { bg: '#FFF8E1', color: '#F57F17' };
  const key = `st_${status}`;
  const label = COLORS[status] ? tr(key) : String(status || '').toUpperCase();

  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 12, fontWeight: '800' },
});
