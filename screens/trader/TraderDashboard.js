import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import Colors from '../../theme/colors';
import { getCurrentUserSession, logoutUserSession } from '../../services/auth';
import { todayLocal } from '../../services/dates';
import {
  subscribeToCentreAuctions,
  subscribeToTraderWins,
  isBiddingOpen,
  AUCTION_STATUS,
} from '../../services/auctions';

/*
 * Trader home: live lots at their mandi, their wins, quick links.
 */
export default function TraderDashboard({ navigation }) {
  const [session, setSession] = useState(null);
  const [lots, setLots] = useState([]);
  const [wins, setWins] = useState([]);
  const unsubA = useRef(null);
  const unsubB = useRef(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const user = await getCurrentUserSession();
        if (!alive) return;
        setSession(user);
        if (user?.centreId) {
          unsubA.current = subscribeToCentreAuctions(
            user.centreId,
            todayLocal(),
            (rows) => alive && setLots(rows)
          );
        }
        if (user?.uid) {
          unsubB.current = subscribeToTraderWins(user.uid, (rows) => alive && setWins(rows));
        }
      })();
      return () => {
        alive = false;
        unsubA.current && unsubA.current();
        unsubB.current && unsubB.current();
      };
    }, [])
  );

  const open = lots.filter(isBiddingOpen);
  const leading = open.filter((l) => l.highestBidderId === session?.uid).length;
  const todayWins = wins.filter((w) => w.date === todayLocal());
  const todayQty = todayWins.reduce((s, w) => s + (w.approxQuantityQuintals || 0), 0);

  const logout = () =>
    Alert.alert('लॉग आउट?', '', [
      { text: 'नहीं', style: 'cancel' },
      {
        text: 'हाँ',
        onPress: async () => {
          await logoutUserSession();
          navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Auth' }] });
        },
      },
    ]);

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>नमस्ते, {session?.name || 'व्यापारी'}</Text>
            <Text style={styles.firm}>{session?.businessName || ''}</Text>
            <Text style={styles.centre}>
              {session?.centreName || 'मंडी चुनें'} • लाइसेंस {session?.licenseNumber || '—'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('TraderProfile')}>
            <Ionicons name="person-circle-outline" size={40} color={Colors.white} />
          </TouchableOpacity>
        </View>

        {!session?.centreId ? (
          <TouchableOpacity
            style={styles.warn}
            onPress={() => navigation.navigate('TraderProfile')}
          >
            <Ionicons name="alert-circle" size={22} color="#B45309" />
            <Text style={styles.warnText}>
              नीलामी देखने के लिए पहले अपनी मंडी चुनें →
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Recent wins banner */}
        {todayWins.length > 0 ? (
          <TouchableOpacity
            style={styles.winBanner}
            onPress={() => navigation.navigate('MyPurchases')}
          >
            <Ionicons name="trophy" size={26} color="#B45309" />
            <View style={{ flex: 1 }}>
              <Text style={styles.winTitle}>
                🏆 आज {todayWins.length} लॉट जीते
              </Text>
              <Text style={styles.winSub}>
                {todayWins
                  .slice(0, 3)
                  .map((w) => `${w.tokenNumber} @ ₹${w.highestBid}`)
                  .join(' • ')}
                {todayWins.length > 3 ? ' …' : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#B45309" />
          </TouchableOpacity>
        ) : null}

        {/* Live auctions card */}
        <TouchableOpacity
          style={[styles.bigCard, open.length > 0 && styles.bigCardLive]}
          onPress={() => navigation.navigate('AuctionBoard')}
        >
          <View style={styles.bigLeft}>
            <Ionicons name="hammer-outline" size={30} color={Colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bigTitle}>लाइव नीलामी</Text>
            <Text style={styles.bigSub}>
              {open.length > 0
                ? `${open.length} लॉट पर बोली चालू${leading ? ` • ${leading} में आप आगे` : ''}`
                : 'अभी कोई लॉट खुला नहीं'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={Colors.white} />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>आज का सारांश</Text>
        <View style={styles.stats}>
          <Stat n={lots.length} l="कुल लॉट" />
          <Stat n={open.length} l="बोली चालू" c="#FFD54F" />
          <Stat n={todayWins.length} l="जीते" c="#A5D6A7" />
          <Stat n={`${todayQty}`} l="क्विंटल खरीद" c="#90CAF9" />
        </View>

        <Text style={styles.sectionTitle}>अन्य</Text>
        <Tool icon="cart-outline" label="मेरी खरीद" onPress={() => navigation.navigate('MyPurchases')} />
        <Tool icon="business-outline" label="मंडी / प्रोफ़ाइल" onPress={() => navigation.navigate('TraderProfile')} />
        <Tool icon="log-out-outline" label="लॉग आउट" onPress={logout} danger />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ n, l, c }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.num, c && { color: c }]}>{n}</Text>
      <Text style={styles.lbl}>{l}</Text>
    </View>
  );
}

function Tool({ icon, label, onPress, danger }) {
  return (
    <TouchableOpacity style={styles.toolRow} onPress={onPress}>
      <Ionicons name={icon} size={20} color={danger ? Colors.error : Colors.secondary} />
      <Text style={[styles.toolText, danger && { color: Colors.error }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={Colors.subText} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 18, paddingBottom: 30 },
  hero: {
    backgroundColor: Colors.navy,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  hello: { color: Colors.white, fontSize: 18, fontWeight: '900' },
  firm: { color: Colors.white, fontWeight: '700', marginTop: 2 },
  centre: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 4 },
  warn: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: '#FFF4D6',
    borderColor: '#F0C36D',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  warnText: { flex: 1, color: '#7A5200', fontWeight: '800' },
  winBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  winTitle: { fontWeight: '900', color: '#92400E', fontSize: 15 },
  winSub: { color: '#92400E', fontSize: 12, marginTop: 2 },

  bigCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.secondary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  bigCardLive: { backgroundColor: '#B45309' },
  bigLeft: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigTitle: { color: Colors.white, fontWeight: '900', fontSize: 17 },
  bigSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.navy, marginBottom: 10 },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: Colors.navy,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  stat: { width: '47%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 10 },
  num: { color: Colors.white, fontSize: 22, fontWeight: '900' },
  lbl: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  toolText: { flex: 1, fontWeight: '800', color: Colors.navy },
});
