import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import Colors from '../../theme/colors';
import { getCurrentUserSession } from '../../services/auth';
import { todayLocal } from '../../services/dates';
import {
  subscribeToCentreAuctions,
  isBiddingOpen,
  secondsLeft,
  formatCountdown,
  AUCTION_STATUS,
} from '../../services/auctions';

const STATUS_LABEL = {
  open: 'बोली चालू',
  closed: 'समय समाप्त',
  accepted: 'बिक गया',
  rejected: 'अस्वीकृत',
  cancelled: 'रद्द',
};

/*
 * e-NAM style display board: every lot at the trader's mandi today.
 */
export default function AuctionBoardScreen({ navigation }) {
  const [session, setSession] = useState(null);
  const [lots, setLots] = useState([]);
  const [, setTick] = useState(0);
  const unsub = useRef(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const user = await getCurrentUserSession();
        if (!alive) return;
        setSession(user);
        if (user?.centreId) {
          unsub.current = subscribeToCentreAuctions(user.centreId, todayLocal(), (rows) => {
            if (alive) setLots(rows);
          });
        }
      })();
      return () => {
        alive = false;
        unsub.current && unsub.current();
      };
    }, [])
  );

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const live = lots.filter(isBiddingOpen);
  const rest = lots.filter((l) => !isBiddingOpen(l));

  const Card = ({ lot }) => {
    const open = isBiddingOpen(lot);
    const mine = lot.highestBidderId === session?.uid;
    return (
      <TouchableOpacity
        style={[styles.card, open && styles.cardLive, mine && open && styles.cardMine]}
        onPress={() => navigation.navigate('AuctionBidding', { tokenId: lot.tokenId })}
      >
        <View style={styles.top}>
          <Text style={styles.lot}>लॉट {lot.tokenNumber}</Text>
          {open ? (
            <Text style={styles.timer}>⏱ {formatCountdown(secondsLeft(lot))}</Text>
          ) : (
            <Text style={styles.status}>{STATUS_LABEL[lot.status] || lot.status}</Text>
          )}
        </View>
        <Text style={styles.crop}>
          {lot.cropName} • ग्रेड {lot.grade} • ~{lot.approxQuantityQuintals} क्विं.
        </Text>
        <Text style={styles.meta}>
          नमी {lot.moisturePercent ?? '—'}% • अन्य पदार्थ {lot.foreignMatterPercent ?? '—'}% • MSP ₹{lot.msp}
        </Text>
        <View style={styles.bidRow}>
          <View>
            <Text style={styles.bidLbl}>सबसे ऊँची बोली</Text>
            <Text style={styles.bid}>
              {lot.highestBid ? `₹${lot.highestBid}` : '—'}
              <Text style={styles.bidUnit}> /क्विं.</Text>
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.bidLbl}>{lot.bidCount || 0} बोलियाँ</Text>
            {mine ? (
              <Text style={styles.mine}>
                {lot.status === AUCTION_STATUS.ACCEPTED ? '🏆 आपने जीता' : '● आप आगे हैं'}
              </Text>
            ) : lot.highestBidderName ? (
              <Text style={styles.other}>{lot.highestBidderName}</Text>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle
          title="नीलामी बोर्ड"
          subtitle={`${session?.centreName || ''} • ${live.length} लॉट चालू`}
        />

        {!session?.centreId ? (
          <Text style={styles.empty}>पहले प्रोफ़ाइल में मंडी चुनें।</Text>
        ) : lots.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="hourglass-outline" size={40} color={Colors.subText} />
            <Text style={styles.empty}>आज अभी कोई लॉट नीलामी में नहीं आया</Text>
            <Text style={styles.emptySub}>
              गुणवत्ता जांच के बाद किसान लॉट खोलेगा, वह यहाँ तुरंत दिखेगा।
            </Text>
          </View>
        ) : (
          <>
            {live.length > 0 ? <Text style={styles.section}>🔴 चालू</Text> : null}
            {live.map((l) => <Card key={l.tokenId} lot={l} />)}
            {rest.length > 0 ? <Text style={styles.section}>पुराने / बंद</Text> : null}
            {rest.map((l) => <Card key={l.tokenId} lot={l} />)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 18, paddingBottom: 30 },
  section: { fontWeight: '900', color: Colors.navy, marginBottom: 8, marginTop: 6 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  cardLive: { borderColor: '#F59E0B', borderWidth: 2 },
  cardMine: { backgroundColor: '#F0FDF4', borderColor: '#16A34A' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lot: { fontSize: 20, fontWeight: '900', color: Colors.navy },
  timer: { fontSize: 16, fontWeight: '900', color: '#B45309', fontVariant: ['tabular-nums'] },
  status: { fontSize: 11, fontWeight: '800', color: Colors.subText },
  crop: { marginTop: 6, fontWeight: '800', color: Colors.text },
  meta: { fontSize: 11, color: Colors.subText, marginTop: 2 },
  bidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  bidLbl: { fontSize: 10, color: Colors.subText, fontWeight: '700' },
  bid: { fontSize: 22, fontWeight: '900', color: '#16A34A' },
  bidUnit: { fontSize: 11, color: Colors.subText, fontWeight: '700' },
  mine: { color: '#16A34A', fontWeight: '900', fontSize: 12 },
  other: { color: Colors.navy, fontWeight: '700', fontSize: 12 },
  emptyBox: { alignItems: 'center', padding: 30, gap: 8 },
  empty: { textAlign: 'center', color: Colors.navy, fontWeight: '800', marginTop: 10 },
  emptySub: { textAlign: 'center', color: Colors.subText, fontSize: 12 },
});
