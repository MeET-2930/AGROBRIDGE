import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import Colors from '../../theme/colors';
import { useLang } from '../../i18n/LanguageContext';
import { gradeLabel } from '../../services/centres';

import { fetchMyBookings } from '../../services/bookings';
import { getCurrentUserSession } from '../../services/auth';

export default function PaymentsScreen({ navigation }) {
  const { tr, lang } = useLang();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPayments = async () => {
    try {
      const session = await getCurrentUserSession();
      if (!session?.uid) { setList([]); return; }
      const bookings = await fetchMyBookings(session.uid);
      setList(bookings.filter((item) => item.status === 'paid'));
    } catch (error) {
      console.error('Payments error:', error);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadPayments(); }, []));

  const refresh = async () => {
    setRefreshing(true);
    await loadPayments();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[Colors.primary]} />}
      >
        <ScreenTitle title={tr('pay_title')} subtitle={tr('pay_sub')} />

        {loading ? (
          <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 30 }} />
        ) : list.length === 0 ? (
          <Text style={styles.empty}>{tr('pay_empty')}</Text>
        ) : (
          list.map((payment) => (
            <TouchableOpacity
              key={payment.tokenId}
              style={styles.card}
              onPress={() => navigation.navigate('TokenDetail', { tokenId: payment.tokenId })}
            >
              <Text style={styles.id}>{payment.receiptId}</Text>
              <Text style={styles.centre}>{payment.centreName}</Text>
              <Text style={styles.row}>{tr('token')}: {payment.tokenNumber}</Text>
              <Text style={styles.row}>{tr('quantity')}: {payment.actualQuantity} {tr('quintal')}</Text>
              <Text style={styles.row}>
                {tr('grade')}: {gradeLabel(payment.grade, lang)} • {tr('rate')}: ₹{payment.ratePerQuintal}
              </Text>
              <Text style={styles.net}>
                {tr('pay_net', { n: Number(payment.netPayable || 0).toLocaleString('en-IN') })}
              </Text>
              {payment.parchi?.imageBase64 ? (
                <Text style={styles.parchiTag}>📎 {tr('pc_attached')} • {tr('pc_bothSlips')}</Text>
              ) : null}
              <Text style={styles.view}>{tr('hist_view')}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 30 },
  empty: { textAlign: 'center', color: Colors.subText, marginTop: 40 },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  id: { color: Colors.primary, fontWeight: '800', fontSize: 12 },
  centre: { fontWeight: '800', color: Colors.navy, marginTop: 4 },
  row: { color: Colors.subText, marginTop: 4, fontSize: 12 },
  net: { marginTop: 10, fontWeight: '900', color: Colors.secondary, fontSize: 16 },
  parchiTag: { marginTop: 6, fontSize: 11, fontWeight: '700', color: '#92400E' },
  view: { marginTop: 8, color: Colors.primary, fontWeight: '800', fontSize: 12 },
});
