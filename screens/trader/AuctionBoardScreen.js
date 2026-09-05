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

import { useLang } from '../../i18n/LanguageContext';
import { cropLabel, gradeLabel, centreLabel } from '../../services/centres';
/*
 * e-NAM style display board: every lot at the trader's mandi today.
 */
export default function AuctionBoardScreen({ navigation }) {
  const { tr, lang, trError } = useLang();
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
          <Text style={styles.lot}>{tr('bd_lotTitle', { t: lot.tokenNumber })}</Text>
          {open ? (
            <Text style={styles.timer}>⏱ {formatCountdown(secondsLeft(lot))}</Text>
          ) : (
            <Text style={styles.status}>{tr(`ast_${lot.status}`)}</Text>
          )}
        </View>
        <Text style={styles.crop}>
          {tr('ab_lotLine', { crop: cropLabel(lot, lang), g: gradeLabel(lot.grade, lang), q: lot.approxQuantityQuintals })}
        </Text>
        <Text style={styles.meta}>
          {tr('ab_metaLine', { m: lot.moisturePercent ?? '—', f: lot.foreignMatterPercent ?? '—', msp: lot.msp })}
        </Text>
        <View style={styles.bidRow}>
          <View>
            <Text style={styles.bidLbl}>{tr('ab_highest')}</Text>
            <Text style={styles.bid}>
              {lot.highestBid ? `₹${lot.highestBid}` : '—'}
              <Text style={styles.bidUnit}> /{tr('quintalShort')}</Text>
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.bidLbl}>{tr('ab_bids', { n: lot.bidCount || 0 })}</Text>
            {mine ? (
              <Text style={styles.mine}>
                {lot.status === AUCTION_STATUS.ACCEPTED ? tr('ab_youWon') : tr('ab_youLead')}
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
          title={tr('ab_title')}
          subtitle={tr('ab_sub', { c: centreLabel(session?.centreName || '', lang), n: live.length })}
        />

        {!session?.centreId ? (
          <Text style={styles.empty}>{tr('ab_pickFirst')}</Text>
        ) : lots.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="hourglass-outline" size={40} color={Colors.subText} />
            <Text style={styles.empty}>{tr('ab_empty')}</Text>
            <Text style={styles.emptySub}>
              {tr('ab_emptySub')}
            </Text>
          </View>
        ) : (
          <>
            {live.length > 0 ? <Text style={styles.section}>{tr('ab_live')}</Text> : null}
            {live.map((l) => <Card key={l.tokenId} lot={l} />)}
            {rest.length > 0 ? <Text style={styles.section}>{tr('ab_past')}</Text> : null}
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
