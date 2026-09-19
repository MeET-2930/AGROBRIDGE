/*
 * components/QueueStatusCard.js  (install42)
 * ---------------------------------------------------------------
 * The farmer's live status card.
 *
 * OUTSIDE the gate it is a TIME light, not a queue position:
 *   grey   - your hour has not started ("reach by 8:50")
 *   green  - your hour is open, go to the gate
 *   orange - your hour has passed, go to the gate to be rebooked
 * There is deliberately no "now serving" / "ahead of you" outside:
 * order outside is arrival order within the hour, decided at the gate.
 *
 * INSIDE the yard the order is real: "Lane 2 - 3 vehicles ahead".
 *
 *   view    - object returned by buildQueueView() in services/bookings
 *   lane    - optional { lane, ahead, etaMinutes } from laneAhead()
 *   onPress - optional, opens the full detail screen
 * ---------------------------------------------------------------
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../theme/colors';
import { useLang } from '../i18n/LanguageContext';

const LEVELS = {
  waiting: { bg: '#F5F5F5', border: '#BDBDBD', dot: '#9E9E9E', text: '#424242', icon: 'time-outline' },
  ready: { bg: '#FEE2E2', border: '#DC2626', dot: '#DC2626', text: '#991B1B', icon: 'alert-circle-outline' },      // hour passed = RED
  soon: { bg: '#FFF7ED', border: '#F59E0B', dot: '#F59E0B', text: '#9A3412', icon: 'timer-outline' },           // opens in <=15 min = AMBER
  go: { bg: '#E8F5E9', border: '#2E7D32', dot: '#2E7D32', text: '#1B5E20', icon: 'checkmark-circle-outline' },
  action: { bg: '#FFF7ED', border: '#F59E0B', dot: '#F59E0B', text: '#9A3412', icon: 'hand-right-outline' },
  inside: { bg: '#E3F2FD', border: '#1565C0', dot: '#1565C0', text: '#0D47A1', icon: 'business-outline' },
  closed: { bg: '#FAFAFA', border: '#E0E0E0', dot: '#BDBDBD', text: '#616161', icon: 'flag-outline' },
};

export default function QueueStatusCard({ view, lane, onPress }) {
  const { tr } = useLang();
  if (!view) return null;

  const msg = (m) => {
    if (!m) return '';
    if (typeof m === 'string') return m;
    const params = {};
    Object.entries(m.params || {}).forEach(([k, v]) => {
      params[k] = v && typeof v === 'object' && v.key ? tr(v.key) : v;
    });
    return tr(m.key, params);
  };

  const formatEta = (minutes) => {
    const m = Number(minutes) || 0;
    if (m <= 0) return null;
    if (m < 60) return tr('q_aboutMin', { m });
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest > 0 ? tr('q_aboutHrMin', { h, m: rest }) : tr('q_aboutHr', { h });
  };

  const theme = LEVELS[view.level] || LEVELS.waiting;
  const Wrapper = onPress ? TouchableOpacity : View;
  const showLane = view.level === 'inside' && lane && lane.lane;

  return (
    <Wrapper
      style={[styles.card, { backgroundColor: theme.bg, borderColor: theme.border }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.headRow}>
        <View style={[styles.dot, { backgroundColor: theme.dot }]} />
        <Text style={[styles.headline, { color: theme.text }]}>{msg(view.headline)}</Text>
        <Ionicons name={theme.icon} size={22} color={theme.dot} />
      </View>

      <Text style={[styles.detail, { color: theme.text }]}>{msg(view.detail)}</Text>

      {showLane ? (
        <View style={styles.numberRow}>
          <View style={styles.numberBox}>
            <Text style={styles.numberLabel}>{tr('q_yourLane')}</Text>
            <Text style={[styles.numberBig, { color: theme.text }]}>{lane.lane}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.numberBox}>
            <Text style={styles.numberLabel}>{tr('q_aheadInLane')}</Text>
            <Text style={[styles.numberBig, { color: theme.text }]}>{lane.ahead}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.numberBox}>
            <Text style={styles.numberLabel}>{tr('q_wait')}</Text>
            <Text style={[styles.numberBig, { color: theme.text }]}>{formatEta(lane.etaMinutes) || '—'}</Text>
          </View>
        </View>
      ) : null}

      {view.level === 'go' ? (
        <View style={styles.callToAction}>
          <Text style={styles.callToActionText}>{tr('q_comeToGate')}</Text>
        </View>
      ) : null}

      {view.level === 'ready' && view.slotState === 'passed' && !view.lateChoice ? (
        <View style={[styles.callToAction, { backgroundColor: '#DC2626' }]}>
          <Text style={styles.callToActionText}>{tr('q_chooseBelow')}</Text>
        </View>
      ) : null}
      {view.level === 'soon' ? (
        <View style={[styles.callToAction, { backgroundColor: '#F59E0B' }]}>
          <Text style={styles.callToActionText}>{tr('q_getReady')}</Text>
        </View>
      ) : null}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 2, padding: 16, marginBottom: 16 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  headline: { flex: 1, fontSize: 16, fontWeight: '900' },
  detail: { marginTop: 10, fontSize: 14, fontWeight: '700' },
  numberRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  numberBox: { flex: 1, alignItems: 'center' },
  numberLabel: { fontSize: 11, fontWeight: '700', color: Colors.subText, marginBottom: 4, textAlign: 'center' },
  numberBig: { fontSize: 22, fontWeight: '900' },
  divider: { width: 1, height: 34, backgroundColor: 'rgba(0,0,0,0.12)' },
  callToAction: { marginTop: 12, backgroundColor: '#2E7D32', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  callToActionText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
});
