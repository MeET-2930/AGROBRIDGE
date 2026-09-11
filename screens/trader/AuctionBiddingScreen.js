import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';
import { getCurrentUserSession } from '../../services/auth';
import {
  subscribeToAuction,
  placeBid,
  closeAuctionIfDue,
  isBiddingOpen,
  secondsLeft,
  formatCountdown,
  BID_STEP,
  AUCTION_STATUS,
} from '../../services/auctions';

import { useLang } from '../../i18n/LanguageContext';
import { cropLabel, gradeLabel } from '../../services/centres';
/*
 * One lot, live. Big countdown, big highest bid, quick +5/+10/+25
 * buttons and a custom amount. Every tap is a Firestore transaction.
 */
export default function AuctionBiddingScreen({ navigation, route }) {
  const { tr, lang, trError } = useLang();
  const { tokenId } = route.params || {};
  const [session, setSession] = useState(null);
  const [lot, setLot] = useState(undefined);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    getCurrentUserSession().then(setSession);
    const unsub = subscribeToAuction(tokenId, setLot);
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => {
      unsub();
      clearInterval(t);
    };
  }, [tokenId]);

  useEffect(() => {
    if (lot?.status === AUCTION_STATUS.OPEN && secondsLeft(lot) === 0) {
      closeAuctionIfDue(tokenId).catch(() => {});
    }
  });

  if (lot === undefined) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader navigation={navigation} showBack />
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }
  if (!lot) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader navigation={navigation} showBack />
        <Text style={styles.empty}>{tr('bd_notFound')}</Text>
      </SafeAreaView>
    );
  }

  const open = isBiddingOpen(lot);
  const mine = lot.highestBidderId === session?.uid;
  const minNext = lot.highestBid > 0 ? lot.highestBid + BID_STEP : lot.reservePrice;
  const sec = secondsLeft(lot);
  const urgent = open && sec <= 60;

  const bid = async (value) => {
    const n = Math.round(Number(value));
    if (!n) {
      Alert.alert(tr('bd_amount'), tr('bd_badAmount'));
      return;
    }
    setBusy(true);
    try {
      await placeBid(tokenId, {
        traderId: session.uid,
        traderName: session.businessName || session.name,
        amount: n,
      });
      setAmount('');
    } catch (error) {
      Alert.alert(tr('bd_bidFailed'), trError(error, 'pleaseRetry'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack title={tr('bd_lotTitle', { t: lot.tokenNumber })} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Timer + status */}
        <View style={[styles.timerBox, urgent && styles.timerUrgent, !open && styles.timerClosed]}>
          <Text style={styles.timerLbl}>
            {open ? tr('bd_closesIn') : lot.status === AUCTION_STATUS.ACCEPTED ? tr('bd_sold') : tr('bd_closed')}
          </Text>
          <Text style={styles.timer}>{open ? formatCountdown(sec) : '00:00'}</Text>
        </View>

        {/* Highest bid */}
        <View style={[styles.bidBox, mine && styles.bidBoxMine]}>
          <Text style={styles.bidLbl}>{tr('ab_highest')}</Text>
          <Text style={styles.bidBig}>
            {lot.highestBid ? `₹${lot.highestBid}` : `₹${lot.reservePrice}`}
            <Text style={styles.bidUnit}> {tr('perQuintal')}</Text>
          </Text>
          <Text style={styles.bidWho}>
            {lot.highestBid
              ? mine
                ? tr('bd_yourHighest')
                : tr('bd_needMore', { who: lot.highestBidderName, n: minNext })
              : tr('bd_noBidsFloor', { n: lot.reservePrice })}
          </Text>
          <Text style={styles.bidCount}>{tr('ab_bids', { n: lot.bidCount || 0 })}</Text>
        </View>

        {/* Lot details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tr('bd_lotDetails')}</Text>
          <Row l={tr('crop')} v={cropLabel(lot, lang)} />
          <Row l={tr('approxQuantity')} v={`${lot.approxQuantityQuintals} ${tr('quintal')}`} />
          <Row l={tr('grade')} v={gradeLabel(lot.grade, lang)} />
          <Row l={tr('moisture')} v={`${lot.moisturePercent ?? '—'}%`} />
          <Row l={tr('foreignMatter')} v={`${lot.foreignMatterPercent ?? '—'}%`} />
          {lot.assayNotes ? <Row l={tr('bd_assayNotes')} v={lot.assayNotes} /> : null}
          <Row l={tr('farmer')} v={lot.farmerName} />
          <Row l="MSP" v={`₹${lot.msp}`} />
        </View>

        {/* Bidding controls */}
        {open ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{tr('bd_placeBid')}</Text>
            <View style={styles.quick}>
              {[0, 10, 25].map((extra) => {
                const v = minNext + extra;
                return (
                  <TouchableOpacity
                    key={extra}
                    style={styles.quickBtn}
                    disabled={busy || mine}
                    onPress={() => bid(v)}
                  >
                    <Text style={styles.quickTxt}>₹{v}</Text>
                    <Text style={styles.quickSub}>{extra === 0 ? tr('bd_minimum') : `+${extra}`}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.customRow}>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={(t) => setAmount(t.replace(/\D/g, ''))}
                keyboardType="number-pad"
                placeholder={tr('bd_orMore', { n: minNext })}
                placeholderTextColor="#999"
                editable={!mine}
              />
              <PrimaryButton
                title={tr('bd_bid')}
                loading={busy}
                disabled={mine || !amount}
                onPress={() => bid(amount)}
                style={{ height: 50, paddingHorizontal: 18 }}
              />
            </View>
            {mine ? (
              <Text style={styles.note}>{tr('bd_leadNote')}</Text>
            ) : (
              <Text style={styles.note}>{tr('bd_stepNote', { s: BID_STEP })}</Text>
            )}
          </View>
        ) : (
          <View style={[styles.card, { alignItems: 'center' }]}>
            <Ionicons
              name={lot.status === AUCTION_STATUS.ACCEPTED && mine ? 'trophy' : 'lock-closed-outline'}
              size={36}
              color={lot.status === AUCTION_STATUS.ACCEPTED && mine ? '#F59E0B' : Colors.subText}
            />
            <Text style={styles.closedTxt}>
              {lot.status === AUCTION_STATUS.ACCEPTED
                ? mine
                  ? tr('bd_congrats', { n: lot.highestBid })
                  : tr('bd_boughtBy', { who: lot.highestBidderName, n: lot.highestBid })
                : lot.status === AUCTION_STATUS.REJECTED
                ? tr('bd_farmerRejected')
                : tr('bd_awaitFarmer')}
            </Text>
          </View>
        )}

        {/* Bid history */}
        {Array.isArray(lot.bids) && lot.bids.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{tr('bd_history')}</Text>
            {lot.bids.slice(0, 15).map((b, i) => (
              <View key={`${b.at}-${i}`} style={styles.hist}>
                <Text style={[styles.histWho, b.traderId === session?.uid && { color: '#16A34A' }]}>
                  {b.traderId === session?.uid ? tr('bd_you') : b.traderName}
                </Text>
                <Text style={styles.histAmt}>₹{b.amount}</Text>
                <Text style={styles.histAt}>
                  {new Date(b.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ l, v }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowL}>{l}</Text>
      <Text style={styles.rowV}>{v || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 18, paddingBottom: 30 },
  empty: { textAlign: 'center', marginTop: 40, color: Colors.subText },
  timerBox: { backgroundColor: Colors.navy, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 12 },
  timerUrgent: { backgroundColor: '#B91C1C' },
  timerClosed: { backgroundColor: '#475569' },
  timerLbl: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '700' },
  timer: { color: Colors.white, fontSize: 44, fontWeight: '900', fontVariant: ['tabular-nums'] },
  bidBox: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#F59E0B',
    marginBottom: 12,
  },
  bidBoxMine: { borderColor: '#16A34A', backgroundColor: '#F0FDF4' },
  bidLbl: { fontSize: 12, color: Colors.subText, fontWeight: '800' },
  bidBig: { fontSize: 38, fontWeight: '900', color: '#16A34A' },
  bidUnit: { fontSize: 14, color: Colors.subText, fontWeight: '700' },
  bidWho: { color: Colors.navy, fontWeight: '700', marginTop: 4 },
  bidCount: { color: Colors.subText, fontSize: 12, marginTop: 2 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: Colors.navy, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, gap: 12 },
  rowL: { color: Colors.subText, fontSize: 13 },
  rowV: { color: Colors.navy, fontWeight: '700', fontSize: 13, flex: 1, textAlign: 'right' },
  quick: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  quickBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  quickTxt: { color: Colors.white, fontWeight: '900', fontSize: 18 },
  quickSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11 },
  customRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 20,
    fontWeight: '800',
    color: Colors.navy,
  },
  note: { color: Colors.subText, fontSize: 12, marginTop: 10 },
  closedTxt: { color: Colors.navy, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  hist: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  histWho: { flex: 1, fontWeight: '700', color: Colors.navy },
  histAmt: { fontWeight: '900', color: Colors.navy, marginRight: 12 },
  histAt: { color: Colors.subText, fontSize: 12 },
});
