/*
 * screens/arhtiya/ArhtiyaDashboard.js  (install55)
 * ---------------------------------------------------------------
 * Same layout as the farmer dashboard: avatar + greeting row, one
 * live status card, a grid of DashboardCard tiles, logout in the
 * profile pop-up. The arhtiya is a "bulk farmer": he books passes
 * for the farmers linked to him and follows their lots.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import DashboardCard from '../../components/DashboardCard';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';

import { getCurrentUserSession, logoutUserSession, fetchMyFarmers } from '../../services/auth';
import { fetchActiveFarmerBookings, passLabel, stageOf, ARHTIYA_DAY_SHARE } from '../../services/bookings';
import { centreLabel, cropLabel } from '../../services/centres';
import { useLang } from '../../i18n/LanguageContext';

export default function ArhtiyaDashboard({ navigation }) {
  const { tr, lang } = useLang();
  const [session, setSession] = useState(null);
  const [farmers, setFarmers] = useState([]);
  const [tokens, setTokens] = useState([]);       // active tokens of all my farmers
  const [profileOpen, setProfileOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const user = await getCurrentUserSession();
    setSession(user);
    if (!user?.uid) return;
    try {
      const list = await fetchMyFarmers();
      setFarmers(list);
      const all = await Promise.all(list.map((f) => fetchActiveFarmerBookings(f.uid)));
      const flat = all.flat().sort((a, b) => `${a.date} ${a.slotTime}`.localeCompare(`${b.date} ${b.slotTime}`));
      setTokens(flat);
    } catch (e) {
      console.log('arhtiya load:', e?.message);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const logout = async () => {
    setProfileOpen(false);
    await logoutUserSession();
    navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Auth' }] });
  };

  const inside = tokens.filter((t) => t.status !== 'booked');
  const nextToken = tokens[0] || null;

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack={false} />

      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* Greeting row - identical to the farmer's */}
        <View style={styles.profileRow}>
          <TouchableOpacity style={styles.avatar} onPress={() => setProfileOpen(true)}>
            <Ionicons name="person" size={24} color={Colors.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.greet}>{tr('namaste')} 🙏</Text>
            <Text style={styles.name}>{session?.businessName || session?.name || tr('ar_title')}</Text>
            <Text style={styles.phone}>
              {session?.centreName ? centreLabel(session.centreName, lang) : ''}
              {session?.shedId ? ` • ${tr('ar_shed', { s: session.shedId })}` : ''}
            </Text>
          </View>
        </View>

        {/* Live status card */}
        {farmers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{tr('ar_noFarmers')}</Text>
            <Text style={styles.emptySub}>{tr('ar_noFarmersSub')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('MyFarmers')}>
              <Text style={styles.link}>{tr('ar_addFarmer')} →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.bookingCard, inside.length > 0 && styles.bookingCardLive]}>
            <Text style={styles.bookingLabel}>{tr('ar_today')}</Text>
            <Text style={styles.bookingCentre}>{tr('ar_summary', { f: farmers.length, t: tokens.length, i: inside.length })}</Text>
            {nextToken ? (
              <Text style={styles.bookingMeta}>
                {tr('ar_next', { n: nextToken.farmerName, p: passLabel(nextToken), d: nextToken.date })}
              </Text>
            ) : null}
            <Text style={styles.bookingMeta}>{tr('ar_shareNote', { p: Math.round(ARHTIYA_DAY_SHARE * 100) })}</Text>
            <PrimaryButton
              title={tr('ar_bookFor')}
              style={{ marginTop: 12, height: 44 }}
              onPress={() => navigation.navigate('MyFarmers', { pick: true })}
            />
          </View>
        )}

        {/* Their tokens (compact list, same look as the farmer's "other tokens") */}
        {tokens.length > 0 ? (
          <View style={styles.otherWrap}>
            <Text style={styles.otherTitle}>{tr('ar_tokens')}</Text>
            {tokens.map((b) => (
              <TouchableOpacity key={b.tokenId} style={styles.otherRow} onPress={() => navigation.navigate('TokenDetail', { tokenId: b.tokenId })}>
                <View style={styles.otherToken}><Text style={styles.otherTokenText}>{String(b.slotTime || '').slice(0, 5)}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.otherMain} numberOfLines={1}>{b.farmerName} • {cropLabel(b, lang)} • {b.approxQuantityQuintals} {tr('quintalShort')}</Text>
                  <Text style={styles.otherSub}>{b.date} • {tr(`fs_${stageOf(b)}`)}{b.shedId ? ` • ${tr('ar_shed', { s: b.shedId })}` : ''}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.subText} />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {/* Tile grid - same component as the farmer dashboard */}
        <View style={styles.grid}>
          <DashboardCard title={tr('ar_bookFor')} icon="calendar-outline" onPress={() => navigation.navigate('MyFarmers', { pick: true })} />
          <DashboardCard title={tr('ar_myFarmers')} icon="people-outline" onPress={() => navigation.navigate('MyFarmers')} />
          <DashboardCard title={tr('ar_profile')} icon="business-outline" onPress={() => navigation.navigate('ArhtiyaProfile')} />
          <DashboardCard title={tr('help')} icon="help-circle-outline" onPress={() => navigation.navigate('Help', { role: 'farmer' })} />
        </View>
      </ScrollView>

      {/* Profile pop-up with logout - same as the farmer's */}
      <Modal visible={profileOpen} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setProfileOpen(false)}>
          <View style={styles.modal}>
            <Text style={styles.profileName}>{session?.name || tr('ar_title')}</Text>
            <Text style={styles.profilePhone}>+91 {session?.phone || ''}</Text>
            <Text style={styles.profilePhone}>{tr('tr_licenseLine', { l: session?.licenseNumber || '—' })}</Text>

            <TouchableOpacity style={styles.profileLink} onPress={() => { setProfileOpen(false); navigation.navigate('ArhtiyaProfile'); }}>
              <Ionicons name="business-outline" size={18} color={Colors.secondary} />
              <Text style={styles.profileLinkText}>{tr('ar_profile')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.profileLink} onPress={() => { setProfileOpen(false); navigation.navigate('Notifications'); }}>
              <Ionicons name="notifications-outline" size={18} color={Colors.secondary} />
              <Text style={styles.profileLinkText}>{tr('nt_title')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
              <Ionicons name="log-out-outline" size={20} color={Colors.white} />
              <Text style={styles.logoutText}>{tr('logout')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 18, paddingBottom: 30 },

  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center' },
  greet: { fontSize: 20, color: Colors.secondary, fontWeight: '800' },
  name: { fontSize: 18, fontWeight: '800', color: Colors.navy },
  phone: { fontSize: 12, color: Colors.subText, marginTop: 2 },

  bookingCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 18 },
  bookingCardLive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  bookingLabel: { fontSize: 12, color: Colors.subText, fontWeight: '700' },
  bookingCentre: { fontSize: 15, fontWeight: '800', color: Colors.navy, marginTop: 4 },
  bookingMeta: { fontSize: 13, color: Colors.subText, marginTop: 4 },

  emptyCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 22, alignItems: 'center', marginBottom: 18, borderWidth: 1, borderColor: Colors.border },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Colors.navy },
  emptySub: { fontSize: 13, color: Colors.subText, textAlign: 'center', marginTop: 6 },
  link: { marginTop: 12, color: Colors.primary, fontWeight: '800' },

  otherWrap: { marginBottom: 18 },
  otherTitle: { fontSize: 13, fontWeight: '800', color: Colors.subText, marginBottom: 8 },
  otherRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  otherToken: { backgroundColor: Colors.navy, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  otherTokenText: { color: Colors.white, fontWeight: '800', fontSize: 13 },
  otherMain: { fontWeight: '800', color: Colors.navy, fontSize: 14 },
  otherSub: { color: Colors.subText, fontSize: 12, marginTop: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modal: { width: '80%', backgroundColor: Colors.white, borderRadius: 16, padding: 20 },
  profileName: { textAlign: 'center', fontSize: 18, fontWeight: '800', color: Colors.navy },
  profilePhone: { textAlign: 'center', color: Colors.subText, marginTop: 4 },
  profileLink: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 18, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  profileLinkText: { color: Colors.secondary, fontWeight: '800', fontSize: 15 },
  logoutBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: Colors.error, borderRadius: 12, paddingVertical: 12, marginTop: 6 },
  logoutText: { color: Colors.white, fontWeight: '800', fontSize: 16 },
});
