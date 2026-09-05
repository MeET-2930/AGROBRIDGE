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

/*
 * One lot, live. Big countdown, big highest bid, quick +5/+10/+25
 * buttons and a custom amount. Every tap is a Firestore transaction.
 */
export default function AuctionBiddingScreen({ navigation, route }) {
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
        <Text style={styles.empty}>लॉट नहीं मिला</Text>
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
      Alert.alert('राशि', 'सही राशि दर्ज करें।');
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
      Alert.alert('बोली नहीं लगी', error?.message || 'दोबारा प्रयास करें।');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack title={`लॉट ${lot.tokenNumber}`} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Timer + status */}
        <View style={[styles.timerBox, urgent && styles.timerUrgent, !open && styles.timerClosed]}>
          <Text style={styles.timerLbl}>
            {open ? 'बोली बंद होने में' : lot.status === AUCTION_STATUS.ACCEPTED ? 'बिक गया' : 'नीलामी बंद'}
          </Text>
          <Text style={styles.timer}>{open ? formatCountdown(sec) : '00:00'}</Text>
        </View>

        {/* Highest bid */}
        <View style={[styles.bidBox, mine && styles.bidBoxMine]}>
          <Text style={styles.bidLbl}>सबसे ऊँची बोली</Text>
          <Text style={styles.bidBig}>
            {lot.highestBid ? `₹${lot.highestBid}` : `₹${lot.reservePrice}`}
            <Text style={styles.bidUnit}> / क्विंटल</Text>
          </Text>
          <Text style={styles.bidWho}>
            {lot.highestBid
              ? mine
                ? '● आपकी बोली सबसे ऊँची है'
                : `${lot.highestBidderName} • आपको ₹${minNext} या अधिक लगानी होगी`
              : `कोई बोली नहीं • शुरुआती भाव MSP ₹${lot.reservePrice}`}
          </Text>
          <Text style={styles.bidCount}>{lot.bidCount || 0} बोलियाँ</Text>
        </View>

        {/* Lot details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>लॉट विवरण</Text>
          <Row l="फसल" v={lot.cropName} />
          <Row l="अनुमानित मात्रा" v={`${lot.approxQuantityQuintals} क्विंटल`} />
          <Row l="ग्रेड" v={lot.grade} />
          <Row l="नमी" v={`${lot.moisturePercent ?? '—'}%`} />
          <Row l="अन्य पदार्थ" v={`${lot.foreignMatterPercent ?? '—'}%`} />
          {lot.assayNotes ? <Row l="जांच टिप्पणी" v={lot.assayNotes} /> : null}
          <Row l="किसान" v={lot.farmerName} />
          <Row l="MSP" v={`₹${lot.msp}`} />
        </View>

        {/* Bidding controls */}
        {open ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>बोली लगाएँ</Text>
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
                    <Text style={styles.quickSub}>{extra === 0 ? 'न्यूनतम' : `+${extra}`}</Text>
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
                placeholder={`₹${minNext} या अधिक`}
                placeholderTextColor="#999"
                editable={!mine}
              />
              <PrimaryButton
                title="बोली"
                loading={busy}
                disabled={mine || !amount}
                onPress={() => bid(amount)}
                style={{ height: 50, paddingHorizontal: 18 }}
              />
            </View>
            {mine ? (
              <Text style={styles.note}>आप पहले से आगे हैं। दूसरा व्यापारी ऊपर जाए तो आप फिर लगा सकते हैं।</Text>
            ) : (
              <Text style={styles.note}>न्यूनतम बढ़त ₹{BID_STEP}। बोली लगाने के बाद वापस नहीं ली जा सकती।</Text>
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
                  ? `बधाई! आपने ₹${lot.highestBid}/क्विं. पर जीता`
                  : `${lot.highestBidderName} ने ₹${lot.highestBid} पर खरीदा`
                : lot.status === AUCTION_STATUS.REJECTED
                ? 'किसान ने बोलियाँ अस्वीकार कीं'
                : 'समय समाप्त — किसान के निर्णय की प्रतीक्षा'}
            </Text>
          </View>
        )}

        {/* Bid history */}
        {Array.isArray(lot.bids) && lot.bids.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>बोली इतिहास</Text>
            {lot.bids.slice(0, 15).map((b, i) => (
              <View key={`${b.at}-${i}`} style={styles.hist}>
                <Text style={[styles.histWho, b.traderId === session?.uid && { color: '#16A34A' }]}>
                  {b.traderId === session?.uid ? 'आप' : b.traderName}
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
  timerLbl: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700' },
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
  bidLbl: { fontSize: 11, color: Colors.subText, fontWeight: '800' },
  bidBig: { fontSize: 38, fontWeight: '900', color: '#16A34A' },
  bidUnit: { fontSize: 13, color: Colors.subText, fontWeight: '700' },
  bidWho: { color: Colors.navy, fontWeight: '700', marginTop: 4 },
  bidCount: { color: Colors.subText, fontSize: 11, marginTop: 2 },
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
  rowL: { color: Colors.subText, fontSize: 12 },
  rowV: { color: Colors.navy, fontWeight: '700', fontSize: 12, flex: 1, textAlign: 'right' },
  quick: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  quickBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  quickTxt: { color: Colors.white, fontWeight: '900', fontSize: 18 },
  quickSub: { color: 'rgba(255,255,255,0.8)', fontSize: 10 },
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
  note: { color: Colors.subText, fontSize: 11, marginTop: 10 },
  closedTxt: { color: Colors.navy, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  hist: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  histWho: { flex: 1, fontWeight: '700', color: Colors.navy },
  histAmt: { fontWeight: '900', color: Colors.navy, marginRight: 12 },
  histAt: { color: Colors.subText, fontSize: 11 },
});
