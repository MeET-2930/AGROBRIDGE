/*
 * screens/common/PublicBoardScreen.js  (install56)
 * ---------------------------------------------------------------
 * THE BOARD AT THE GATE. No login. Meant for a TV / tablet at the
 * mandi entrance, the secretary's office, or a farmer who just wants
 * to know "how is the day going" before leaving home.
 *
 * Shows ONLY what everyone may see: open/closed, hours, vehicles
 * inside, how long door-to-payment is taking today, which stage is
 * the bottleneck, floor status, inspector's next round.
 * Never shows names, token numbers, "now serving" or "ahead of you".
 * Refreshes every 60 s.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import Colors from '../../theme/colors';
import { fetchCentres, centreLabel } from '../../services/centres';
import { fetchPublicBoard } from '../../services/bookings';
import { useLang } from '../../i18n/LanguageContext';

const REFRESH_MS = 60000;

export default function PublicBoardScreen({ navigation, route }) {
  const { tr, lang } = useLang();
  const [centres, setCentres] = useState([]);
  const [centreId, setCentreId] = useState(route?.params?.centreId || '');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCentres().then((l) => { setCentres(l); if (!centreId && l[0]) setCentreId(l[0].id); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!centreId) return undefined;
    let alive = true;
    const load = () => fetchPublicBoard(centreId).then((d) => { if (alive) { setData(d); setError(''); } }).catch((e) => alive && setError(e?.message || 'error'));
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => { alive = false; clearInterval(t); };
  }, [centreId]);

  const b = data?.board;
  const light = !b ? 'grey' : !b.open || b.incident ? 'red' : (b.doorToPayMedianMin || 0) > 120 || (b.floorPercent || 0) > 90 ? 'amber' : 'green';
  const lightColor = { grey: '#9CA3AF', green: '#16A34A', amber: '#F59E0B', red: '#DC2626' }[light];

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{tr('pb_boardTitle')}</Text>

        {/* mandi picker */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {centres.map((c) => (
            <TouchableOpacity key={c.id} style={[styles.chip, centreId === c.id && styles.chipOn]} onPress={() => { setData(null); setCentreId(c.id); }}>
              <Text style={[styles.chipText, centreId === c.id && { color: Colors.white }]}>{centreLabel(c, lang)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {!b ? (
          error ? <Text style={styles.err}>{error}</Text> : <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 30 }} />
        ) : (
          <>
            {/* the big light */}
            <View style={[styles.light, { backgroundColor: lightColor }]}>
              <Ionicons name={light === 'green' ? 'checkmark-circle' : light === 'red' ? 'close-circle' : 'time'} size={40} color={Colors.white} />
              <Text style={styles.lightText}>
                {!b.open ? (b.closedReason === 'holiday' ? tr('pb_closedHoliday') : tr('pb_closedWeekly')) : b.incident ? tr('pb_incident') : light === 'amber' ? tr('pb_slow') : tr('pb_normal')}
              </Text>
              <Text style={styles.lightSub}>{tr('pb_hours', { h: b.hours })} • {tr('pb_updated', { t: String(data.at).slice(11, 16) })}</Text>
            </View>

            {/* four big numbers */}
            <View style={styles.grid}>
              <Big n={b.inside} l={tr('pb_inside')} />
              <Big n={b.doorToPayMedianMin != null ? `${b.doorToPayMedianMin} ${tr('min')}` : '—'} l={tr('pb_doorToPay')} />
              <Big n={b.paidToday} l={tr('pb_paidToday')} />
              <Big n={b.floorPercent != null ? `${b.floorPercent}%` : '—'} l={tr('pb_floor')} />
            </View>

            {/* what to do */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{tr('pb_adviceTitle')}</Text>
              <Text style={styles.advice}>• {tr('pb_adviceHour')}</Text>
              {b.thisHourExpected > 0 ? <Text style={styles.advice}>• {tr('pb_thisHour', { n: b.thisHourExpected })}</Text> : null}
              {b.assayRound ? <Text style={styles.advice}>• {tr('pb_round', { t: b.assayRound })}</Text> : null}
              {b.bottleneck ? <Text style={styles.advice}>• {tr('pb_bottleneck', { s: tr(`tl_${b.bottleneck}`) })}</Text> : null}
              {b.floorPercent != null && b.floorPercent > 80 ? <Text style={styles.advice}>• {tr('pb_floorHigh')}</Text> : null}
            </View>

            {/* stages */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{tr('pb_stagesTitle')}</Text>
              {b.stages.map((s) => (
                <View key={s.key} style={styles.stageRow}>
                  <Text style={styles.stageName}>{tr(`tl_${s.key}`)}</Text>
                  <Text style={[styles.stageWait, s.key === b.bottleneck && { color: Colors.error }]}>{tr('pb_waitingN', { n: s.waiting })}</Text>
                  <Text style={styles.stageMed}>{s.medianMin != null ? tr('pb_medianN', { n: s.medianMin }) : '—'}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.foot}>{tr('pb_footer')}</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Big({ n, l }) {
  return (
    <View style={styles.big}>
      <Text style={styles.bigN}>{n}</Text>
      <Text style={styles.bigL}>{l}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 18, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.navy, marginBottom: 10 },
  chips: { gap: 8, paddingBottom: 12 },
  chip: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.white },
  chipOn: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText: { fontWeight: '800', color: Colors.navy, fontSize: 14 },
  err: { color: Colors.error, marginTop: 20, textAlign: 'center' },
  light: { borderRadius: 18, padding: 22, alignItems: 'center', marginBottom: 14 },
  lightText: { color: Colors.white, fontSize: 24, fontWeight: '900', marginTop: 8, textAlign: 'center' },
  lightSub: { color: Colors.white, fontSize: 13, marginTop: 6, opacity: 0.95 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  big: { width: '48%', flexGrow: 1, backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 16, alignItems: 'center' },
  bigN: { fontSize: 34, fontWeight: '900', color: Colors.navy },
  bigL: { fontSize: 13, color: Colors.subText, marginTop: 4, textAlign: 'center', fontWeight: '700' },
  card: { backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 14 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Colors.navy, marginBottom: 8 },
  advice: { fontSize: 16, color: Colors.text, lineHeight: 24 },
  stageRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  stageName: { flex: 1.3, fontWeight: '800', color: Colors.navy, fontSize: 15 },
  stageWait: { flex: 1, color: Colors.text, fontSize: 14, fontWeight: '700' },
  stageMed: { flex: 1, color: Colors.subText, fontSize: 13, textAlign: 'right' },
  foot: { fontSize: 12, color: Colors.subText, textAlign: 'center', marginTop: 6, lineHeight: 17 },
});
