import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import AppHeader from '../../components/AppHeader';
import Colors from '../../theme/colors';

import { fetchOfficerSummary } from '../../services/bookings';
import { getCurrentUserSession } from '../../services/auth';

import { useLang } from '../../i18n/LanguageContext';
import { centreLabel } from '../../services/centres';
export default function ReportsScreen({ navigation }) {
  const { tr, lang, trError } = useLang();
  const [data, setData] = useState(null);
  const [centreName, setCentreName] = useState('');

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      const load = async () => {
        const user = await getCurrentUserSession();

        if (!user?.centreId) {
          if (alive) setData(null);
          return;
        }

        if (alive) setCentreName(user.centreName || '');

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

        {!data ? (
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rowLabel: { color: Colors.subText, fontSize: 14 },
  rowValue: { color: Colors.navy, fontWeight: '800', fontSize: 14 },
});
