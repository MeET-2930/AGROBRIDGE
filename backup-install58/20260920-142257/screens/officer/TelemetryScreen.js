/*
 * screens/officer/TelemetryScreen.js  (install56, admin)
 * ---------------------------------------------------------------
 * "Where is the day stuck?"  Per stage: lots waiting now, how long
 * the oldest has waited, today's median and 90th-percentile dwell.
 * The bottleneck is highlighted with a plain sentence the admin can
 * act on (send a second inspector, open a weighbridge lane, call the
 * cashier). Numbers come from the timestamps officers already write,
 * so there is nothing extra to fill in.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import Colors from '../../theme/colors';
import { getCurrentUserSession } from '../../services/auth';
import { fetchStageTelemetry } from '../../services/bookings';
import { useLang } from '../../i18n/LanguageContext';

const ACTION = { assay: 'tl_act_assay', price: 'tl_act_price', weigh: 'tl_act_weigh', pay: 'tl_act_pay' };

export default function TelemetryScreen({ navigation }) {
  const { tr } = useLang();
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const u = await getCurrentUserSession();
    if (!u?.centreId) return;
    setData(await fetchStageTelemetry(u.centreId));
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const stages = (data?.stages || []).filter((s) => !s.optional);
  const bn = data?.bottleneck ? stages.find((s) => s.key === data.bottleneck) : null;

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <ScreenTitle title={tr('tl_title')} subtitle={tr('tl_sub')} />

        {!data ? <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 30 }} /> : (
          <>
            <View style={[styles.bnBox, !bn && styles.bnBoxOk]}>
              <Ionicons name={bn ? 'warning-outline' : 'checkmark-circle-outline'} size={22} color={bn ? '#B45309' : Colors.secondary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.bnTitle}>{bn ? tr('tl_bnTitle', { s: tr(`tl_${bn.key}`) }) : tr('tl_noBn')}</Text>
                <Text style={styles.bnSub}>
                  {bn ? tr('tl_bnSub', { n: bn.waiting, o: bn.oldestWaitMin, m: bn.medianMin ?? '—' }) : tr('tl_noBnSub')}
                </Text>
                {bn && ACTION[bn.key] ? <Text style={styles.bnAct}>→ {tr(ACTION[bn.key])}</Text> : null}
              </View>
            </View>

            <View style={styles.statRow}>
              <Stat n={data.totals.inside} l={tr('tl_inside')} />
              <Stat n={data.totals.doorToPayMedianMin != null ? `${data.totals.doorToPayMedianMin}′` : '—'} l={tr('tl_doorToPay')} />
              <Stat n={data.totals.doorToPayP90Min != null ? `${data.totals.doorToPayP90Min}′` : '—'} l={tr('tl_p90')} />
              <Stat n={data.totals.liftedPending} l={tr('tl_liftPending')} />
            </View>

            <View style={styles.card}>
              <View style={styles.head}>
                <Text style={[styles.h, { flex: 1.2 }]}>{tr('tl_stage')}</Text>
                <Text style={styles.h}>{tr('tl_waiting')}</Text>
                <Text style={styles.h}>{tr('tl_oldest')}</Text>
                <Text style={styles.h}>{tr('tl_median')}</Text>
                <Text style={styles.h}>{tr('tl_done')}</Text>
              </View>
              {stages.map((s) => {
                const hot = s.key === data.bottleneck;
                return (
                  <View key={s.key} style={[styles.row, hot && styles.rowHot]}>
                    <Text style={[styles.c, { flex: 1.2, fontWeight: '800', color: Colors.navy }]}>{tr(`tl_${s.key}`)}</Text>
                    <Text style={[styles.c, hot && { color: Colors.error, fontWeight: '900' }]}>{s.waiting}</Text>
                    <Text style={styles.c}>{s.waiting ? `${s.oldestWaitMin}′` : '—'}</Text>
                    <Text style={styles.c}>{s.medianMin != null ? `${s.medianMin}′` : '—'}</Text>
                    <Text style={styles.c}>{s.done}</Text>
                  </View>
                );
              })}
            </View>

            <Text style={styles.note}>{tr('tl_note')}</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ n, l }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statN}>{n}</Text>
      <Text style={styles.statL}>{l}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 18, paddingBottom: 40 },
  bnBox: { flexDirection: 'row', gap: 10, backgroundColor: '#FEF3C7', borderColor: '#D97706', borderWidth: 1.5, borderRadius: 14, padding: 14, marginBottom: 14 },
  bnBoxOk: { backgroundColor: '#E8F5E9', borderColor: '#A5D6A7' },
  bnTitle: { fontWeight: '900', color: Colors.navy, fontSize: 16 },
  bnSub: { color: Colors.text, fontSize: 13, marginTop: 4, lineHeight: 18 },
  bnAct: { color: Colors.secondary, fontWeight: '800', fontSize: 14, marginTop: 6 },
  statRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  stat: { flex: 1, backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 10, alignItems: 'center' },
  statN: { fontSize: 20, fontWeight: '900', color: Colors.navy },
  statL: { fontSize: 10, color: Colors.subText, marginTop: 2, textAlign: 'center' },
  card: { backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 12 },
  head: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  h: { flex: 1, fontSize: 11, fontWeight: '800', color: Colors.subText, textAlign: 'center' },
  row: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, alignItems: 'center' },
  rowHot: { backgroundColor: '#FEF2F2' },
  c: { flex: 1, fontSize: 14, color: Colors.text, textAlign: 'center' },
  note: { fontSize: 12, color: Colors.subText, marginTop: 12, lineHeight: 17 },
});
