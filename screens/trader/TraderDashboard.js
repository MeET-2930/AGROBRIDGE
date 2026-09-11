/*
 * screens/trader/TraderDashboard.js
 * Same layout as the farmer dashboard: avatar + greeting row,
 * one live status card, a grid of DashboardCard tiles, and logout
 * tucked inside the profile pop-up (tap the avatar).
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import DashboardCard from '../../components/DashboardCard';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';

import { getCurrentUserSession, logoutUserSession } from '../../services/auth';
import { todayLocal } from '../../services/dates';
import {
  subscribeToCentreAuctions,
  subscribeToTraderWins,
  isBiddingOpen,
} from '../../services/auctions';
import { useLang } from '../../i18n/LanguageContext';
import { centreLabel } from '../../services/centres';

export default function TraderDashboard({ navigation }) {
  const { tr, lang } = useLang();
  const [session, setSession] = useState(null);
  const [lots, setLots] = useState([]);
  const [wins, setWins] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const unsubA = useRef(null);
  const unsubB = useRef(null);

  const stopListening = () => {
    if (unsubA.current) { unsubA.current(); unsubA.current = null; }
    if (unsubB.current) { unsubB.current(); unsubB.current = null; }
  };

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const user = await getCurrentUserSession();
        if (!alive) return;
        setSession(user);
        stopListening();
        if (user?.centreId) {
          unsubA.current = subscribeToCentreAuctions(user.centreId, todayLocal(), (rows) => alive && setLots(rows));
        }
        if (user?.uid) {
          unsubB.current = subscribeToTraderWins(user.uid, (rows) => alive && setWins(rows));
        }
      })();
      return () => { alive = false; stopListening(); };
    }, [])
  );

  const open = lots.filter(isBiddingOpen);
  const leading = open.filter((l) => l.highestBidderId === session?.uid).length;
  const todayWins = wins.filter((w) => w.date === todayLocal());

  const logout = async () => {
    setProfileOpen(false);
    stopListening();
    await logoutUserSession();
    navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Auth' }] });
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack={false} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Greeting row - identical to the farmer's */}
        <View style={styles.profileRow}>
          <TouchableOpacity style={styles.avatar} onPress={() => setProfileOpen(true)}>
            <Ionicons name="person" size={24} color={Colors.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.greet}>{tr('namaste')} 🙏</Text>
            <Text style={styles.name}>{session?.name || tr('tr_trader')}</Text>
            <Text style={styles.phone}>
              {session?.businessName ? `${session.businessName} • ` : ''}
              {session?.centreName ? centreLabel(session.centreName, lang) : tr('tr_pickMandi')}
            </Text>
          </View>
        </View>

        {/* Live status card (like the farmer's active booking card) */}
        {!session?.centreId ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{tr('tr_pickMandi')}</Text>
            <Text style={styles.emptySub}>{tr('tr_needMandi')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('TraderProfile')}>
              <Text style={styles.link}>{tr('tr_mandiProfile')} →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.bookingCard, open.length > 0 && styles.bookingCardLive]}>
            <Text style={styles.bookingLabel}>{tr('tr_liveAuction')}</Text>
            <Text style={styles.bookingCentre}>
              {open.length > 0
                ? tr('tr_openLots', { n: open.length }) + (leading ? tr('tr_leading', { n: leading }) : '')
                : tr('tr_noOpen')}
            </Text>
            <Text style={styles.bookingMeta}>
              {tr('tr_totalLots')}: {lots.length} • {tr('tr_won')}: {todayWins.length}
            </Text>
            {todayWins.length > 0 ? (
              <Text style={styles.bookingMeta}>{tr('tr_wonToday', { n: todayWins.length })}</Text>
            ) : null}
            <PrimaryButton
              title={tr('ab_title')}
              style={{ marginTop: 12, height: 44 }}
              onPress={() => navigation.navigate('AuctionBoard')}
            />
          </View>
        )}

        {/* Tile grid - same component as the farmer dashboard */}
        <View style={styles.grid}>
          <DashboardCard title={tr('tr_liveAuction')} icon="hammer-outline" onPress={() => navigation.navigate('AuctionBoard')} />
          <DashboardCard title={tr('tr_myPurchases')} icon="cart-outline" onPress={() => navigation.navigate('MyPurchases')} />
          <DashboardCard title={tr('tr_mandiProfile')} icon="business-outline" onPress={() => navigation.navigate('TraderProfile')} />
          <DashboardCard title={tr('help')} icon="help-circle-outline" onPress={() => navigation.navigate('Help', { role: 'trader' })} />
        </View>
      </ScrollView>

      {/* Profile pop-up with logout - same as the farmer's */}
      <Modal visible={profileOpen} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setProfileOpen(false)}>
          <View style={styles.modal}>
            <Text style={styles.profileName}>{session?.name || tr('tr_trader')}</Text>
            <Text style={styles.profilePhone}>+91 {session?.phone || ''}</Text>
            <Text style={styles.profilePhone}>{tr('tr_licenseLine', { l: session?.licenseNumber || '—' })}</Text>

            <TouchableOpacity
              style={styles.profileLink}
              onPress={() => { setProfileOpen(false); navigation.navigate('TraderProfile'); }}
            >
              <Ionicons name="business-outline" size={18} color={Colors.secondary} />
              <Text style={styles.profileLinkText}>{tr('tr_mandiProfile')}</Text>
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
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.navy,
    alignItems: 'center', justifyContent: 'center',
  },
  greet: { fontSize: 20, color: Colors.secondary, fontWeight: '800' },
  name: { fontSize: 18, fontWeight: '800', color: Colors.navy },
  phone: { fontSize: 11, color: Colors.subText, marginTop: 2 },

  bookingCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 18,
  },
  bookingCardLive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  bookingLabel: { fontSize: 11, color: Colors.subText, fontWeight: '700' },
  bookingCentre: { fontSize: 15, fontWeight: '800', color: Colors.navy, marginTop: 4 },
  bookingMeta: { fontSize: 12, color: Colors.subText, marginTop: 4 },

  emptyCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 22, alignItems: 'center',
    marginBottom: 18, borderWidth: 1, borderColor: Colors.border,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Colors.navy },
  emptySub: { fontSize: 12, color: Colors.subText, textAlign: 'center', marginTop: 6 },
  link: { marginTop: 12, color: Colors.primary, fontWeight: '800' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modal: { width: '80%', backgroundColor: Colors.white, borderRadius: 16, padding: 20 },
  profileName: { textAlign: 'center', fontSize: 18, fontWeight: '800', color: Colors.navy },
  profilePhone: { textAlign: 'center', color: Colors.subText, marginTop: 4 },
  profileLink: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    marginTop: 18, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  profileLinkText: { color: Colors.secondary, fontWeight: '800', fontSize: 15 },
  logoutBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    backgroundColor: Colors.error, borderRadius: 12, paddingVertical: 12, marginTop: 6,
  },
  logoutText: { color: Colors.white, fontWeight: '800', fontSize: 16 },
});
