import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import AppHeader from '../../components/AppHeader';
import Colors from '../../theme/colors';

import { fetchOfficerSummary } from '../../services/bookings';
import { getCurrentUserSession } from '../../services/auth';

export default function ReportsScreen({ navigation }) {
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
      <AppHeader navigation={navigation} showBack title="दैनिक रिपोर्ट" />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.centre}>{centreName || 'मंडी नहीं चुनी'}</Text>

        {!data ? (
          <Text style={styles.empty}>
            रिपोर्ट देखने के लिए पहले अपनी मंडी चुनें।
          </Text>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.title}>टोकन</Text>
              <Row label="कुल टोकन" value={data.total} />
              <Row label="प्रतीक्षित" value={data.pending} />
              <Row label="अंदर" value={data.inside} />
              <Row label="भुगतान हुआ" value={data.paid} />
              <Row label="अनुपस्थित" value={data.noShows} />
            </View>

            <View style={styles.card}>
              <Text style={styles.title}>खरीद</Text>
              <Row
                label="कुल खरीद"
                value={`${data.totalProcuredQuintals} क्विंटल`}
              />
              <Row
                label="वितरित राशि"
                value={`₹${(data.totalDisbursedRs || 0).toLocaleString('en-IN')}`}
              />
              <Row label="अभी अंदर" value={data.nowServingToken || '—'} />
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
  rowLabel: { color: Colors.subText, fontSize: 13 },
  rowValue: { color: Colors.navy, fontWeight: '800', fontSize: 13 },
});
