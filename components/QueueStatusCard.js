/*
 * components/QueueStatusCard.js
 * ---------------------------------------------------------------
 * The farmer's live queue view.
 *
 * Shows only what the farmer needs to act on:
 *   - which token is being served right now
 *   - how many farmers are ahead of them
 *   - a colour telling them whether to wait, get ready, or go
 *
 * No other farmer's name, crop, quantity or payment is ever shown.
 *
 * Props:
 *   view    - object returned by buildQueueView() in services/bookings
 *   token   - the farmer's own token number, e.g. "A-16"
 *   onPress - optional, opens the full token detail screen
 * ---------------------------------------------------------------
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../theme/colors';

const LEVELS = {
  waiting: {
    bg: '#F5F5F5',
    border: '#BDBDBD',
    dot: '#9E9E9E',
    text: '#424242',
    icon: 'time-outline',
  },
  ready: {
    bg: '#FFF8E1',
    border: '#FFB300',
    dot: '#FFA000',
    text: '#E65100',
    icon: 'alert-circle-outline',
  },
  go: {
    bg: '#E8F5E9',
    border: '#2E7D32',
    dot: '#2E7D32',
    text: '#1B5E20',
    icon: 'checkmark-circle-outline',
  },
  action: {
    bg: '#FFF7ED',
    border: '#F59E0B',
    dot: '#F59E0B',
    text: '#9A3412',
    icon: 'hand-right-outline',
  },
  inside: {
    bg: '#E3F2FD',
    border: '#1565C0',
    dot: '#1565C0',
    text: '#0D47A1',
    icon: 'business-outline',
  },
  closed: {
    bg: '#FAFAFA',
    border: '#E0E0E0',
    dot: '#BDBDBD',
    text: '#616161',
    icon: 'flag-outline',
  },
};

function formatEta(minutes) {
  const m = Number(minutes) || 0;

  if (m <= 0) return null;
  if (m < 60) return `लगभग ${m} मिनट`;

  const hours = Math.floor(m / 60);
  const rest = m % 60;

  return rest > 0
    ? `लगभग ${hours} घंटे ${rest} मिनट`
    : `लगभग ${hours} घंटे`;
}

export default function QueueStatusCard({ view, token, onPress }) {
  if (!view) return null;

  const theme = LEVELS[view.level] || LEVELS.waiting;
  const eta = formatEta(view.etaMinutes);
  const showNumbers =
    view.level !== 'inside' && view.level !== 'closed' && view.level !== 'action';

  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      style={[
        styles.card,
        { backgroundColor: theme.bg, borderColor: theme.border },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.headRow}>
        <View style={[styles.dot, { backgroundColor: theme.dot }]} />

        <Text style={[styles.headline, { color: theme.text }]}>
          {view.headline}
        </Text>

        <Ionicons name={theme.icon} size={22} color={theme.dot} />
      </View>

      {showNumbers ? (
        <View style={styles.numberRow}>
          <View style={styles.numberBox}>
            <Text style={styles.numberLabel}>अभी चल रहा है</Text>
            <Text style={[styles.numberBig, { color: theme.text }]}>
              {view.nowServingToken || '—'}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.numberBox}>
            <Text style={styles.numberLabel}>आपका टोकन</Text>
            <Text style={[styles.numberBig, { color: theme.text }]}>
              {token || '—'}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.numberBox}>
            <Text style={styles.numberLabel}>आपसे पहले</Text>
            <Text style={[styles.numberBig, { color: theme.text }]}>
              {view.tokensAhead}
            </Text>
          </View>
        </View>
      ) : (
        <Text style={[styles.detailOnly, { color: theme.text }]}>
          {view.detail}
        </Text>
      )}

      {showNumbers && eta ? (
        <Text style={styles.eta}>
          अनुमानित प्रतीक्षा: {eta}
          <Text style={styles.etaNote}>  (अनुमान मात्र)</Text>
        </Text>
      ) : null}

      {view.level === 'go' ? (
        <View style={styles.callToAction}>
          <Text style={styles.callToActionText}>
            कृपया अपना वाहन लेकर गेट पर आएं
          </Text>
        </View>
      ) : null}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 16,
    marginBottom: 16,
  },

  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },

  headline: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
  },

  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },

  numberBox: {
    flex: 1,
    alignItems: 'center',
  },

  numberLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.subText,
    marginBottom: 4,
    textAlign: 'center',
  },

  numberBig: {
    fontSize: 24,
    fontWeight: '900',
  },

  divider: {
    width: 1,
    height: 34,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },

  detailOnly: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '700',
  },

  eta: {
    marginTop: 14,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.subText,
    textAlign: 'center',
  },

  etaNote: {
    fontSize: 10,
    fontWeight: '600',
  },

  callToAction: {
    marginTop: 12,
    backgroundColor: '#2E7D32',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },

  callToActionText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
});
