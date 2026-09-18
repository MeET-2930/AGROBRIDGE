import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import StatusBadge from '../../components/StatusBadge';
import Colors from '../../theme/colors';
import { useLang } from '../../i18n/LanguageContext';
import { cropLabel, centreLabel } from '../../services/centres';

import { fetchMyBookings } from '../../services/bookings';
import { getCurrentUserSession } from '../../services/auth';

export default function HistoryScreen({ navigation }) {
  const { tr, lang } = useLang();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = async () => {
    try {
      const session = await getCurrentUserSession();
      if (!session?.uid) { setList([]); return; }
      setList(await fetchMyBookings(session.uid));
    } catch (error) {
      console.error('History error:', error);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadHistory(); }, []));

  const refresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[Colors.primary]} />}
      >
        <ScreenTitle title={tr('history')} subtitle={tr('hist_sub')} />

        {loading ? (
          <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 30 }} />
        ) : list.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{tr('hist_empty')}</Text>
            <Text style={styles.emptySub}>{tr('hist_emptySub')}</Text>
          </View>
        ) : (
          list.map((item) => (
            <TouchableOpacity
              key={item.tokenId}
              style={styles.card}
              onPress={() => navigation.navigate('TokenDetail', { tokenId: item.tokenId })}
            >
              <View style={styles.top}>
                <Text style={styles.token}>{item.slotWindow}</Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={styles.centre}>{centreLabel(item.centreName, lang)}</Text>
              <Text style={styles.crop}>{tr('crop')}: {cropLabel(item, lang)}</Text>
              <Text style={styles.sub}>{item.date} • {item.slotWindow}</Text>
              {item.vehicleNumber ? (
                <Text style={styles.sub}>{tr('vehicle')}: {item.vehicleNumber}</Text>
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
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  token: { fontSize: 20, fontWeight: '900', color: Colors.navy },
  centre: { marginTop: 8, fontWeight: '700', color: Colors.navy },
  crop: { marginTop: 4, fontSize: 13, color: Colors.secondary, fontWeight: '700' },
  sub: { marginTop: 3, color: Colors.subText, fontSize: 13 },
  view: { marginTop: 10, color: Colors.primary, fontWeight: '800', fontSize: 13 },
  empty: { backgroundColor: Colors.white, borderRadius: 16, padding: 25, alignItems: 'center', marginTop: 20, borderWidth: 1, borderColor: Colors.border },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Colors.navy },
  emptySub: { fontSize: 13, color: Colors.subText, marginTop: 6 },
});
