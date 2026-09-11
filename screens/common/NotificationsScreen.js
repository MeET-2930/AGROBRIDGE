/*
 * screens/common/NotificationsScreen.js   (install28)
 * The list behind the bell icon. Same screen for all three roles.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import Colors from '../../theme/colors';
import { useLang } from '../../i18n/LanguageContext';
import { useNotifications } from '../../notifications/NotificationContext';

const ICONS = {
  nt_booked_t: 'calendar-outline',
  nt_gate_t: 'log-in-outline',
  nt_assay_t: 'flask-outline',
  nt_rejected_t: 'close-circle-outline',
  nt_price_t: 'pricetag-outline',
  nt_weighed_t: 'scale-outline',
  nt_paid_t: 'cash-outline',
  nt_delay_t: 'time-outline',
  nt_noShow_t: 'alert-circle-outline',
  nt_yourTurn_t: 'flag-outline',
  nt_off_newToken_t: 'ticket-outline',
  nt_off_arrived_t: 'car-outline',
  nt_off_assayDone_t: 'flask-outline',
  nt_off_priceFixed_t: 'pricetag-outline',
  nt_off_weighed_t: 'scale-outline',
  nt_tr_newLot_t: 'megaphone-outline',
  nt_tr_outbid_t: 'trending-up-outline',
  nt_tr_won_t: 'trophy-outline',
  nt_tr_lost_t: 'remove-circle-outline',
  nt_auctionBid_t: 'trending-up-outline',
};

function timeAgo(iso, tr) {
  const d = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.round(d / 60000);
  if (m < 1) return tr('nt_justNow');
  if (m < 60) return tr('nt_minAgo', { n: m });
  const h = Math.round(m / 60);
  if (h < 24) return tr('nt_hrAgo', { n: h });
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' +
    new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export default function NotificationsScreen({ navigation }) {
  const { tr } = useLang();
  const { items, markAllRead, open, pushStatus, sendTestPush } = useNotifications();
  const [testMsg, setTestMsg] = useState('');

  useEffect(() => { markAllRead(); }, [markAllRead]);

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack title={tr('nt_title')} tag={tr('nt_sub')} />

      <View style={[styles.status, { borderColor: pushStatus?.token ? Colors.success : Colors.error }]}>
        <Text style={styles.statusTitle}>
          {pushStatus?.token ? tr('nt_pushOn') : tr('nt_pushOff')}
        </Text>
        {!pushStatus?.token && pushStatus?.error ? <Text style={styles.statusErr} selectable>{pushStatus.error}</Text> : null}
        {pushStatus?.token ? (
          <TouchableOpacity
            style={styles.testBtn}
            onPress={async () => { setTestMsg('...'); const ok = await sendTestPush(); setTestMsg(ok ? tr('nt_testSent') : tr('nt_testFail')); }}
          >
            <Text style={styles.testBtnText}>{tr('nt_testBtn')}</Text>
          </TouchableOpacity>
        ) : null}
        {testMsg ? <Text style={styles.statusErr}>{testMsg}</Text> : null}
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={40} color={Colors.subText} />
            <Text style={styles.emptyText}>{tr('nt_empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => open(item)} activeOpacity={item.route ? 0.7 : 1}>
            <View style={styles.icon}>
              <Ionicons name={ICONS[item.titleKey] || 'notifications-outline'} size={20} color={Colors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{tr({ key: item.titleKey, params: item.params })}</Text>
              <Text style={styles.body}>{tr({ key: item.bodyKey, params: item.params })}</Text>
              <Text style={styles.time}>{timeAgo(item.at, tr)}</Text>
            </View>
            {item.route ? <Ionicons name="chevron-forward" size={18} color={Colors.subText} /> : null}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 30 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  title: { fontWeight: '800', color: Colors.navy, fontSize: 14 },
  body: { color: Colors.subText, fontSize: 14, marginTop: 2, lineHeight: 18 },
  time: { color: Colors.subText, fontSize: 12, marginTop: 4 },
  empty: { alignItems: 'center', padding: 40, gap: 10 },
  status: { marginHorizontal: 16, marginTop: 12, backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, padding: 12, gap: 6 },
  statusTitle: { fontWeight: '800', color: Colors.navy, fontSize: 14 },
  statusErr: { color: Colors.subText, fontSize: 12 },
  testBtn: { alignSelf: 'flex-start', backgroundColor: Colors.secondary, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, marginTop: 4 },
  testBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  emptyText: { color: Colors.subText, fontWeight: '600', textAlign: 'center' },
});
