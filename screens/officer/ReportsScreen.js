import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import AppHeader from '../../components/AppHeader';
import Colors from '../../theme/colors';

import { fetchOfficerSummary, fetchGateConflicts, resolveGateConflict } from '../../services/bookings';   // install57: conflicts
import { getCurrentUserSession } from '../../services/auth';

import { useLang } from '../../i18n/LanguageContext';
import { centreLabel } from '../../services/centres';
export default function ReportsScreen({ navigation }) {
  const { tr, lang, trError } = useLang();
  const [data, setData] = useState(null);
  const [centreName, setCentreName] = useState('');
  const [tab, setTab] = useState('summary');          // install57: 'summary' | 'conflicts'
  const [conflicts, setConflicts] = useState([]);
  const [centreId, setCentreId] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      const load = async () => {
        const user = await getCurrentUserSession();

        if (!user?.centreId) {
          if (alive) setData(null);
          return;
        }

        if (alive) { setCentreName(user.centreName || ''); setCentreId(user.centreId); }
        try { const c = await fetchGateConflicts(user.centreId); if (alive) setConflicts(c); } catch (e) { /* ignore */ }

        const summary = await fetchOfficerSummary(user.centreId);
        if (alive) setData(summary);
      };

      load();

      return () => {
        alive = false;
      };
    }, [])
  );

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack title={tr('rp_title')} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.centre}>{centreName ? centreLabel(centreName, lang) : tr('od_noCentre')}</Text>

        {/* install57: tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, tab === 'summary' && styles.tabOn]} onPress={() => setTab('summary')}>
            <Text style={[styles.tabT, tab === 'summary' && styles.tabTOn]}>{tr('rp_tabSummary')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'conflicts' && styles.tabOn]} onPress={() => setTab('conflicts')}>
            <Text style={[styles.tabT, tab === 'conflicts' && styles.tabTOn]}>{tr('rp_tabConflicts')}{conflicts.length ? ` (${conflicts.length})` : ''}</Text>
          </TouchableOpacity>
        </View>

        {tab === 'conflicts' ? (
          <View style={styles.card}>
            <Text style={styles.title}>{tr('rp_conflictsTitle')}</Text>
            <Text style={styles.help}>{tr('rp_conflictsHelp')}</Text>
            {!conflicts.length ? <Text style={styles.empty}>{tr('rp_noConflicts')}</Text> : conflicts.map((c) => (
              <View key={c.id} style={styles.cRow}>
                <Ionicons name="alert-circle-outline" size={20} color={Colors.error} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cName}>{c.farmerName || '—'} · …{String(c.tokenId || '').slice(-6)}</Text>
                  <Text style={styles.cSub}>{String(c.at || '').slice(11, 16)} · {(c.plates || []).join(', ')}{c.lane ? ` · ${tr('q_yourLane')} ${c.lane}` : ''}</Text>
                  <Text style={styles.cErr}>{tr(c.error)}</Text>
                </View>
                <TouchableOpacity style={styles.resolveBtn} onPress={async () => { await resolveGateConflict(centreId, c.id); setConflicts((l) => l.filter((x) => x.id !== c.id)); }}>
                  <Text style={styles.resolveT}>{tr('rp_resolve')}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : !data ? (
          <Text style={styles.empty}>
            {tr('rp_pickFirst')}
          </Text>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.title}>{tr('rp_tokens')}</Text>
              <Row label={tr('od_totalTokens')} value={data.total} />
              <Row label={tr('od_waiting')} value={data.pending} />
              <Row label={tr('od_inside')} value={data.inside} />
              <Row label={tr('rp_paidCount')} value={data.paid} />
              <Row label={tr('od_absent')} value={data.noShows} />
            </View>

            <View style={styles.card}>
              <Text style={styles.title}>{tr('rp_procurement')}</Text>
              <Row
                label={tr('rp_totalProcured')}
                value={`${data.totalProcuredQuintals} ${tr('quintal')}`}
              />
              <Row
                label={tr('rp_disbursed')}
                value={`₹${(data.totalDisbursedRs || 0).toLocaleString('en-IN')}`}
              />
              <Row label={tr('rp_nowInside')} value={data.nowServingToken || '—'} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20 },
  centre: { fontWeight: '800', color: Colors.navy, marginBottom: 14 },
  empty: { color: Colors.subText, textAlign: 'center', marginTop: 30 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  title: { fontWeight: '800', color: Colors.navy, fontSize: 15, marginBottom: 12 },
  tabs: { flexDirection: 'row', backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 4, marginBottom: 14 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  tabOn: { backgroundColor: Colors.secondary },
  tabT: { fontWeight: '800', color: Colors.subText, fontSize: 14 },
  tabTOn: { color: Colors.white },
  help: { color: Colors.subText, fontSize: 13, lineHeight: 18, marginBottom: 10 },
  cRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  cName: { fontWeight: '800', color: Colors.navy, fontSize: 14 },
  cSub: { color: Colors.subText, fontSize: 12, marginTop: 2 },
  cErr: { color: Colors.error, fontSize: 13, marginTop: 2, fontWeight: '700' },
  resolveBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.secondary },
  resolveT: { color: Colors.secondary, fontWeight: '800', fontSize: 13 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rowLabel: { color: Colors.subText, fontSize: 14 },
  rowValue: { color: Colors.navy, fontWeight: '800', fontSize: 14 },
});
