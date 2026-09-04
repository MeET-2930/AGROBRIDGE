import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/*
 * Covers every status in the booking state machine:
 *   booked -> in-gate -> assay -> weighing -> payment-processing -> paid
 * plus rejected / no-show / cancelled / waitlisted
 */
const MAP = {
  'booked': { bg: '#FFF8E1', color: '#F57F17', label: 'बुक / BOOKED' },
  'in-gate': { bg: '#E3F2FD', color: '#1565C0', label: 'गेट अंदर / IN GATE' },
  'assay': { bg: '#EDE7F6', color: '#5E35B1', label: 'जांच / ASSAY' },
  'weighing': { bg: '#E0F7FA', color: '#00838F', label: 'तौल / WEIGHING' },
  'payment-processing': { bg: '#FFF3E0', color: '#EF6C00', label: 'भुगतान बाकी' },
  'paid': { bg: '#E8F5E9', color: '#2E7D32', label: 'भुगतान / PAID' },
  'rejected': { bg: '#FFEBEE', color: '#C62828', label: 'अस्वीकृत' },
  'no-show': { bg: '#FFEBEE', color: '#C62828', label: 'अनुपस्थित' },
  'cancelled': { bg: '#FAFAFA', color: '#757575', label: 'रद्द' },
  'waitlisted': { bg: '#EDE7F6', color: '#5E35B1', label: 'प्रतीक्षा' },
  // legacy value from earlier builds
  'appeared': { bg: '#E3F2FD', color: '#1565C0', label: 'मंडी में' },
};

export default function StatusBadge({ status }) {
  const entry = MAP[status] || {
    bg: '#FFF8E1',
    color: '#F57F17',
    label: String(status || '').toUpperCase(),
  };

  return (
    <View style={[styles.badge, { backgroundColor: entry.bg }]}>
      <Text style={[styles.text, { color: entry.color }]}>{entry.label}</Text>
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
  text: { fontSize: 11, fontWeight: '800' },
});
