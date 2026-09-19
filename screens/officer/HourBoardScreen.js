/*
 * screens/officer/HourBoardScreen.js   (install49)
 * ---------------------------------------------------------------
 * Mandi Admin: "Hour-by-hour board" - its own screen (was a card
 * inside the Capacity engine screen). For each hour of today:
 *   booked % (if everyone shows) vs expected % (per the models),
 *   declared / reserved / actual quintals, vehicles, inside, paid,
 *   missed, re-booked, and a close / reopen button.
 * Data comes from the same fetchEngineInsights() call as the engine
 * screen, so it works unchanged when the engine moves to the server.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import AppHeader from '../../components/AppHeader';
import Colors from '../../theme/colors';
import { useLang } from '../../i18n/LanguageContext';
import { getCurrentUserSession } from '../../services/auth';
import { CROP_LIST, cropLabel, centreLabel } from '../../services/centres';
import { fetchEngineInsights, setSlotClosed, todayString } from '../../services/bookings';

export default function HourBoardScreen({ navigation, route }) {
  const { tr, lang, trError } = useLang();
  const [centreId, setCentreId] = useState(null);
  const [crop, setCrop] = useState(route.params?.crop || CROP_LIST[0]?.id || 'wheat');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (cid = centreId, c = crop) => {
    if (!cid) return;
    try {
      setData(await fetchEngineInsights(cid, todayString(), c));
    } catch (e) {
      Alert.alert(tr('error'), trError(e, 'notRecorded'));
    }
  }, [centreId, crop]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const user = await getCurrentUserSession();
        if (!alive || !user?.centreId) return;
        setCentreId(user.centreId);
        load(user.centreId, crop);
      })();
      return () => { alive = false; };
    }, [crop])
  );

  const toggle = async (h) => {
    setBusy(true);
    try {
      await setSlotClosed(centreId, data.date, h.slotTime, !h.closed);
      await load();
    } catch (e) {
      Alert.alert(tr('error'), trError(e, 'notRecorded'));
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader navigation={navigation} showBack title={tr('en_boardTitle')} />
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
      </SafeAreaView>
    );
  }

  const totals = data.hours.reduce((a, h) => ({
    declared: a.declared + (h.declaredQuintals || 0),
    actual: a.actual + (h.actualQuintals || 0),
    vehicles: a.vehicles + (h.vehicles || 0),
    missed: a.missed + (h.missed || 0),
    rebooked: a.rebooked + (h.rebooked || 0),
  }), { declared: 0, actual: 0, vehicles: 0, missed: 0, rebooked: 0 });

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack title={tr('en_boardTitle')} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.centre}>{centreLabel(data.centre.name, lang)} • {data.date}</Text>

        <View style={styles.chips}>
          {CROP_LIST.map((c) => (
            <TouchableOpacity key={c.id} style={[styles.chip, crop === c.id && styles.chipOn]} onPress={() => setCrop(c.id)}>
              <Text style={[styles.chipText, crop === c.id && styles.chipTextOn]}>{cropLabel(c, lang)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* day totals */}
        <View style={styles.totals}>
          <Stat label={tr('en_declared')} value={`${totals.declared} ${tr('quintalShort')}`} />
          <Stat label={tr('en_actual')} value={`${totals.actual} ${tr('quintalShort')}`} />
          <Stat label={tr('en_vehicles')} value={totals.vehicles} />
          <Stat label={tr('en_missed')} value={totals.missed} warn={totals.missed > 0} />
          <Stat label={tr('en_rebooked')} value={totals.rebooked} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sub}>{tr('en_boardSub')}</Text>
          {data.hours.map((h) => (
            <View key={h.slotTime} style={[styles.hourRow, h.closed && styles.hourClosed]}>
              <View style={styles.hourHead}>
                <Text style={styles.hourLabel}>{h.label}</Text>
                <Text style={styles.hourPct}>{h.usedPercent}% {tr('en_booked')} · {h.expectedPercent}% {tr('en_expected')}</Text>
              </View>
              <View style={styles.bar}>
                <View style={[styles.barNominal, { width: `${Math.min(100, h.usedPercent)}%` }]} />
                <View style={[styles.barExpected, { width: `${Math.min(100, h.expectedPercent)}%` }]} />
                <View style={[styles.barBuffer, { left: `${Math.round((h.bookableMinutes / 60) * 100)}%` }]} />
              </View>
              <Text style={styles.hourMeta}>
                {tr('en_declared')} {h.declaredQuintals} · {tr('en_reserved')} {h.reservedQuintals} · {tr('en_actual')} {h.actualQuintals} {tr('quintalShort')}
              </Text>
              <Text style={styles.hourMeta}>
                {tr('en_vehicles')} {h.vehicles} · {tr('en_inside')} {h.inside} · {tr('en_paid')} {h.paid} · {tr('en_missed')} {h.missed} · {tr('en_rebooked')} {h.rebooked} · {h.throughput} {tr('en_qh')}{h.throughputSource !== 'set' ? '*' : ''}
              </Text>
              <TouchableOpacity
                style={[styles.closeBtn, h.closed && styles.reopenBtn]} disabled={busy}
                onPress={() => toggle(h)}
              >
                <Text style={[styles.closeBtnText, h.closed && { color: Colors.primary }]}>{h.closed ? tr('en_reopen') : tr('en_close')}</Text>
              </TouchableOpacity>
            </View>
          ))}
          <Text style={styles.small}>{tr('en_legend')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, warn }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, warn && { color: Colors.error }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  centre: { fontWeight: '800', color: Colors.navy, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white },
  chipOn: { borderColor: Colors.primary, backgroundColor: Colors.accent },
  chipText: { color: Colors.subText, fontWeight: '700', fontSize: 13 },
  chipTextOn: { color: Colors.primary },
  totals: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 10, marginBottom: 14 },
  stat: { width: '33.33%', alignItems: 'center', paddingVertical: 8 },
  statValue: { fontSize: 18, fontWeight: '900', color: Colors.navy },
  statLabel: { fontSize: 11, color: Colors.subText, marginTop: 2 },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 14 },
  sub: { color: Colors.subText, fontSize: 12, marginBottom: 6, lineHeight: 17 },
  small: { color: Colors.subText, fontSize: 11, marginTop: 8, lineHeight: 15 },
  hourRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  hourClosed: { backgroundColor: '#FEE2E2', marginHorizontal: -16, paddingHorizontal: 16 },
  hourHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hourLabel: { fontWeight: '800', color: Colors.navy, fontSize: 14 },
  hourPct: { color: Colors.subText, fontSize: 11, fontWeight: '700' },
  bar: { height: 12, backgroundColor: '#E5E7EB', borderRadius: 6, marginTop: 6, overflow: 'hidden' },
  barNominal: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#BFDBFE', borderRadius: 6 },
  barExpected: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#2563EB', borderRadius: 6 },
  barBuffer: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#DC2626' },
  hourMeta: { color: Colors.subText, fontSize: 11, marginTop: 4 },
  closeBtn: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: Colors.error },
  reopenBtn: { borderColor: Colors.primary },
  closeBtnText: { color: Colors.error, fontWeight: '800', fontSize: 12 },
});
