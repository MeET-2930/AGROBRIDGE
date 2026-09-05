import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import StatusBadge from '../../components/StatusBadge';
import Colors from '../../theme/colors';
import { getCurrentUserSession } from '../../services/auth';
import { subscribeToTraderWins } from '../../services/auctions';
import { subscribeToBooking } from '../../services/bookings';

/*
 * Lots this trader won, with the live booking status underneath
 * (price-fixed -> weighing -> paid) so they know when to collect.
 */
export default function MyPurchasesScreen({ navigation }) {
  const [wins, setWins] = useState([]);
  const [bookings, setBookings] = useState({});

  useEffect(() => {
    let unsub = () => {};
    getCurrentUserSession().then((u) => {
      if (u?.uid) unsub = subscribeToTraderWins(u.uid, setWins);
    });
    return () => unsub();
  }, []);

  // Follow each won token's booking for live stage.
  useEffect(() => {
    const unsubs = wins.map((w) =>
      subscribeToBooking(w.tokenId, (b) => setBookings((prev) => ({ ...prev, [w.tokenId]: b })))
    );
    return () => unsubs.forEach((u) => u && u());
  }, [wins.map((w) => w.tokenId).join(',')]);

  const totalQty = wins.reduce((s, w) => s + (bookings[w.tokenId]?.actualQuantity || w.approxQuantityQuintals || 0), 0);
  const totalRs = wins.reduce((s, w) => s + (bookings[w.tokenId]?.grossAmount || 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle title="मेरी खरीद" subtitle={`${wins.length} लॉट • ${totalQty} क्विंटल • ₹${Math.round(totalRs).toLocaleString('en-IN')}`} />

        {wins.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="cart-outline" size={40} color={Colors.subText} />
            <Text style={styles.empty}>अभी कोई खरीद नहीं</Text>
          </View>
        ) : (
          wins.map((w) => {
            const b = bookings[w.tokenId];
            return (
              <TouchableOpacity
                key={w.tokenId}
                style={styles.card}
                onPress={() => navigation.navigate('AuctionBidding', { tokenId: w.tokenId })}
              >
                <View style={styles.top}>
                  <Text style={styles.lot}>लॉट {w.tokenNumber}</Text>
                  {b ? <StatusBadge status={b.status} /> : null}
                </View>
                <Text style={styles.crop}>{w.cropName} • ग्रेड {w.grade} • {w.farmerName}</Text>
                <View style={styles.grid}>
                  <Cell l="भाव" v={`₹${w.highestBid}/क्विं.`} />
                  <Cell l="मात्रा" v={b?.actualQuantity ? `${b.actualQuantity} क्विं. (तौला)` : `~${w.approxQuantityQuintals} क्विं.`} />
                  <Cell l="कुल" v={b?.grossAmount ? `₹${Math.round(b.grossAmount).toLocaleString('en-IN')}` : '— तौल बाकी'} />
                  <Cell l="दिनांक" v={w.date} />
                </View>
                <Text style={styles.hint}>
                  {!b ? '' : b.status === 'price-fixed' ? '⏳ तौल की प्रतीक्षा' : b.status === 'weighing' ? '⚖️ तौल हो गया, भुगतान बाकी' : b.status === 'paid' ? '✅ सौदा पूरा' : ''}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Cell({ l, v }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellL}>{l}</Text>
      <Text style={styles.cellV}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 18, paddingBottom: 30 },
  emptyBox: { alignItems: 'center', padding: 30, gap: 8 },
  empty: { color: Colors.subText, fontWeight: '700' },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lot: { fontSize: 18, fontWeight: '900', color: Colors.navy },
  crop: { marginTop: 6, fontWeight: '700', color: Colors.text, fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  cell: { width: '50%', paddingVertical: 4 },
  cellL: { fontSize: 10, color: Colors.subText, fontWeight: '700' },
  cellV: { fontSize: 13, color: Colors.navy, fontWeight: '800' },
  hint: { marginTop: 6, color: Colors.subText, fontSize: 12, fontWeight: '700' },
});
