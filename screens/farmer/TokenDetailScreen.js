import React, { useEffect, useRef, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';

import AppHeader from '../../components/AppHeader';
import StatusBadge from '../../components/StatusBadge';
import QueueStatusCard from '../../components/QueueStatusCard';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';

import {
  subscribeToBooking,
  subscribeToQueue,
  buildQueueView,
  cancelBooking,
  fixPrice,
  STATUS,
} from '../../services/bookings';
import { CROP_LIST } from '../../services/centres';
import {
  subscribeToAuction,
  openAuction,
  acceptHighestBid,
  rejectAuction,
  extendAuction,
  closeAuctionIfDue,
  isBiddingOpen,
  secondsLeft,
  formatCountdown,
  AUCTION_STATUS,
} from '../../services/auctions';
import { downloadReceiptPdf, downloadGatePassPdf } from '../../services/receipt';
import GatePassCard from '../../components/GatePassCard';

const GREEN = '#16A34A';
const AMBER = '#F59E0B';

/*
 * Stage checklist shown to the farmer so they always know
 * where they are in the process.
 */
const STAGES = [
  { key: STATUS.BOOKED, label: 'बुकिंग हुई' },
  { key: STATUS.IN_GATE, label: 'गेट प्रवेश' },
  { key: STATUS.ASSAY, label: 'गुणवत्ता जांच' },
  { key: STATUS.PRICE_FIXED, label: 'भाव तय (MSP / नीलामी)' },
  { key: STATUS.WEIGHING, label: 'तौल' },
  { key: STATUS.PAYMENT_PENDING, label: 'भुगतान तैयार' },
  { key: STATUS.PAID, label: 'भुगतान पूरा' },
];

const STAGE_ORDER = STAGES.map((s) => s.key);

export default function TokenDetailScreen({ navigation, route }) {
  const { tokenId } = route.params || {};

  const [token, setToken] = useState(null);
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingPass, setDownloadingPass] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [auction, setAuction] = useState(null);
  const [tick, setTick] = useState(0);
  const [auctionBusy, setAuctionBusy] = useState(false);

  // Live auction doc for this token + 1s ticker for the countdown.
  useEffect(() => {
    if (!tokenId) return undefined;
    const unsub = subscribeToAuction(tokenId, setAuction);
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, [tokenId]);

  // When the timer hits zero, flip the lot to 'closed' once.
  useEffect(() => {
    if (auction?.status === AUCTION_STATUS.OPEN && secondsLeft(auction) === 0) {
      closeAuctionIfDue(tokenId).catch(() => {});
    }
  }, [tick, auction?.status]);

  const unsubQueue = useRef(null);

  useEffect(() => {
    if (!tokenId) {
      setLoading(false);
      return;
    }

    const unsubBooking = subscribeToBooking(tokenId, (fresh) => {
      setToken(fresh);
      setLoading(false);

      // Attach the queue listener once we know the centre and date.
      if (fresh && !unsubQueue.current) {
        unsubQueue.current = subscribeToQueue(
          fresh.centreId,
          fresh.date,
          setQueue
        );
      }
    });

    return () => {
      unsubBooking();

      if (unsubQueue.current) {
        unsubQueue.current();
        unsubQueue.current = null;
      }
    };
  }, [tokenId]);

  const confirmCancel = () => {
    Alert.alert('बुकिंग रद्द करें?', 'यह टोकन रद्द हो जाएगा।', [
      { text: 'नहीं', style: 'cancel' },
      {
        text: 'हाँ, रद्द करें',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);

          try {
            await cancelBooking(tokenId);
            navigation.goBack();
          } catch (error) {
            Alert.alert('त्रुटि', error?.message || 'रद्द नहीं हो सका।');
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader navigation={navigation} showBack />
        <ActivityIndicator
          color={Colors.primary}
          size="large"
          style={{ marginTop: 40 }}
        />
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader navigation={navigation} showBack />
        <View style={styles.content}>
          <Text style={styles.notFound}>टोकन नहीं मिला</Text>
        </View>
      </SafeAreaView>
    );
  }

  const view = buildQueueView(token, queue);
  const currentIndex = STAGE_ORDER.indexOf(token.status);

  const msp = CROP_LIST.find((c) => c.id === token?.crop)?.msp || 0;

  const acceptMsp = () => {
    Alert.alert(
      'MSP पर बेचें?',
      `₹${msp} प्रति क्विंटल पर सरकारी एजेंसी को बेचने की पुष्टि करें। इसके बाद तौल होगा।`,
      [
        { text: 'नहीं', style: 'cancel' },
        {
          text: 'हाँ, MSP पर बेचें',
          onPress: async () => {
            setFixing(true);
            try {
              await fixPrice(tokenId, { mode: 'msp', ratePerQuintal: msp });
            } catch (error) {
              Alert.alert('त्रुटि', error?.message || 'भाव तय नहीं हुआ।');
            } finally {
              setFixing(false);
            }
          },
        },
      ]
    );
  };

  const startAuction = () => {
    Alert.alert(
      'नीलामी शुरू करें?',
      `10 मिनट की लाइव बोली शुरू होगी। न्यूनतम भाव MSP ₹${msp} रहेगा। बाद में आप बोली स्वीकार या अस्वीकार कर सकते हैं।`,
      [
        { text: 'नहीं', style: 'cancel' },
        {
          text: 'हाँ, शुरू करें',
          onPress: async () => {
            setAuctionBusy(true);
            try {
              await openAuction({ ...token, tokenId });
            } catch (error) {
              Alert.alert('त्रुटि', error?.message || 'नीलामी शुरू नहीं हुई।');
            } finally {
              setAuctionBusy(false);
            }
          },
        },
      ]
    );
  };

  const acceptBid = () => {
    if (!auction?.highestBid) return;
    Alert.alert(
      'बोली स्वीकार करें?',
      `${auction.highestBidderName} — ₹${auction.highestBid} / क्विंटल। इसके बाद तौल होगा।`,
      [
        { text: 'नहीं', style: 'cancel' },
        {
          text: 'स्वीकार',
          onPress: async () => {
            setAuctionBusy(true);
            try {
              const lot = await acceptHighestBid(tokenId, token.farmerId);
              await fixPrice(tokenId, {
                mode: 'auction',
                ratePerQuintal: lot.highestBid,
                buyerId: lot.highestBidderId,
                buyerName: lot.highestBidderName,
              });
            } catch (error) {
              Alert.alert('त्रुटि', error?.message || 'स्वीकार नहीं हुआ।');
            } finally {
              setAuctionBusy(false);
            }
          },
        },
      ]
    );
  };

  const rejectBids = () => {
    Alert.alert('बोली अस्वीकार?', 'आप फिर MSP पर बेच सकते हैं या दोबारा नीलामी कर सकते हैं।', [
      { text: 'नहीं', style: 'cancel' },
      {
        text: 'अस्वीकार',
        style: 'destructive',
        onPress: async () => {
          try {
            await rejectAuction(tokenId);
          } catch (error) {
            Alert.alert('त्रुटि', error?.message || 'असफल।');
          }
        },
      },
    ]);
  };

  const extend = async () => {
    try {
      await extendAuction(tokenId, 5);
    } catch (error) {
      Alert.alert('त्रुटि', error?.message || 'असफल।');
    }
  };

  const handleGatePass = async () => {
    setDownloadingPass(true);
    try {
      await downloadGatePassPdf({ ...token, id: token.id || tokenId });
    } catch (error) {
      console.error('Gate pass PDF error:', error);
      Alert.alert('PDF नहीं बना', error?.message || 'कृपया दोबारा प्रयास करें।');
    } finally {
      setDownloadingPass(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadReceiptPdf({ ...token, id: token.id || tokenId });
    } catch (error) {
      console.error('Receipt PDF error:', error);
      Alert.alert(
        'PDF नहीं बना',
        error?.message ||
          'कृपया दोबारा प्रयास करें। (क्या expo-print इंस्टॉल है?)'
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.tokenHeader}>
          <View>
            <Text style={styles.tokenLabel}>आपका टोकन</Text>
            <Text style={styles.tokenNumber}>{token.tokenNumber}</Text>
          </View>

          <StatusBadge status={token.status} />
        </View>

        <QueueStatusCard view={view} token={token.tokenNumber} />

        {/* Gate pass: only useful until the vehicle is inside */}
        {token.status === STATUS.BOOKED ? (
          <View>
            <GatePassCard token={token} />
            <PrimaryButton
              title="⬇  गेट पास PDF डाउनलोड करें"
              variant="outline"
              loading={downloadingPass}
              onPress={handleGatePass}
              style={{ marginBottom: 14 }}
            />
          </View>
        ) : null}

        {/* Stage progress */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>प्रगति</Text>

          {STAGES.map((stage, index) => {
            /*
             * Each status means "this step is DONE". So the step
             * matching the current status is green, and the NEXT
             * step is the amber "in progress" one. Booking is
             * complete the moment the token exists.
             */
            const isPaid = token.status === STATUS.PAID;
            const done = isPaid || (currentIndex >= 0 && index <= currentIndex);
            const active = !isPaid && index === currentIndex + 1;
            const isLast = index === STAGES.length - 1;

            return (
              <View key={stage.key} style={styles.stageRow}>
                <View style={styles.stageLeft}>
                  {done ? (
                    <View style={[styles.stageDot, styles.stageDotDone]}>
                      <Text style={styles.stageTick}>✓</Text>
                    </View>
                  ) : active ? (
                    <PulsingDot />
                  ) : (
                    <View style={styles.stageDot} />
                  )}

                  {!isLast ? (
                    <View
                      style={[
                        styles.stageLine,
                        done && styles.stageLineDone,
                      ]}
                    />
                  ) : null}
                </View>

                <View style={styles.stageTextBox}>
                  <Text
                    style={[
                      styles.stageLabel,
                      done && styles.stageLabelDone,
                      active && styles.stageLabelActive,
                    ]}
                  >
                    {stage.label}
                  </Text>

                  <Text style={styles.stageSub}>
                    {done ? 'पूरा हुआ' : active ? 'अभी चल रहा है' : 'बाकी'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Booking details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>बुकिंग विवरण</Text>

          <Row label="मंडी" value={token.centreName} />
          <Row label="पता" value={token.centreAddress} />
          <Row label="तारीख" value={token.date} />
          <Row label="समय" value={token.slotWindow} />
          <Row label="फसल" value={token.cropName || token.crop} />
          <Row
            label="अनुमानित मात्रा"
            value={`${token.approxQuantityQuintals} क्विंटल`}
          />
          <Row label="वाहन" value={token.vehicleNumber || 'गेट पर दर्ज होगा'} />
        </View>

        {/* Price decision: after assay, before weighing */}
        {token.status === STATUS.ASSAY ? (
          <View style={[styles.card, styles.priceCard]}>
            <Text style={styles.cardTitle}>भाव तय करें</Text>
            <Text style={styles.priceHint}>
              जांच पूरी हो गई (ग्रेड {token.grade}). अब बताएं कि आप कैसे बेचना चाहते हैं। भाव तय होने के बाद ही तौल होगा।
            </Text>

            <View style={styles.priceOption}>
              <View style={{ flex: 1 }}>
                <Text style={styles.priceTitle}>सरकारी खरीद (MSP)</Text>
                <Text style={styles.priceBig}>₹{msp} / क्विंटल</Text>
                <Text style={styles.priceSub}>निश्चित भाव, तुरंत आगे बढ़ें</Text>
              </View>
              <PrimaryButton
                title="MSP पर बेचें"
                loading={fixing}
                onPress={acceptMsp}
                style={{ height: 44, paddingHorizontal: 14 }}
              />
            </View>

            {/* ---- e-Auction ---- */}
            {!auction || auction.status === AUCTION_STATUS.REJECTED ? (
              <View style={styles.priceOption}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.priceTitle}>व्यापारी नीलामी (e-Auction)</Text>
                  <Text style={styles.priceSub}>
                    10 मिनट लाइव बोली • न्यूनतम भाव MSP ₹{msp}
                  </Text>
                  {auction?.status === AUCTION_STATUS.REJECTED ? (
                    <Text style={[styles.priceSub, { color: Colors.error }]}>
                      पिछली नीलामी अस्वीकार की गई
                    </Text>
                  ) : null}
                </View>
                <PrimaryButton
                  title={auction ? 'दोबारा नीलामी' : 'नीलामी शुरू'}
                  variant="outline"
                  loading={auctionBusy}
                  onPress={startAuction}
                  style={{ height: 44, paddingHorizontal: 14 }}
                />
              </View>
            ) : (
              <View style={[styles.priceOption, styles.auctionLive]}>
                <View style={{ flex: 1 }}>
                  <View style={styles.auctionHead}>
                    <Text style={styles.priceTitle}>
                      {isBiddingOpen(auction) ? '🔴 नीलामी चालू' : '⏹ नीलामी समाप्त'}
                    </Text>
                    <Text style={styles.countdown}>
                      {formatCountdown(secondsLeft(auction))}
                    </Text>
                  </View>

                  {auction.highestBid ? (
                    <>
                      <Text style={styles.priceBig}>₹{auction.highestBid} / क्विंटल</Text>
                      <Text style={styles.priceSub}>
                        सबसे ऊँची बोली: {auction.highestBidderName} • कुल {auction.bidCount} बोलियाँ
                      </Text>
                      {auction.highestBid > msp ? (
                        <Text style={[styles.priceSub, { color: '#16A34A', fontWeight: '800' }]}>
                          MSP से ₹{auction.highestBid - msp} अधिक
                        </Text>
                      ) : null}
                    </>
                  ) : (
                    <Text style={styles.priceSub}>अभी तक कोई बोली नहीं आई</Text>
                  )}

                  <View style={styles.auctionActions}>
                    {auction.highestBid ? (
                      <PrimaryButton
                        title="बोली स्वीकार करें"
                        loading={auctionBusy}
                        onPress={acceptBid}
                        style={{ flex: 1, height: 42 }}
                      />
                    ) : null}
                    {!isBiddingOpen(auction) && !auction.highestBid ? (
                      <PrimaryButton
                        title="5 मिनट और"
                        variant="outline"
                        onPress={extend}
                        style={{ height: 42, paddingHorizontal: 12 }}
                      />
                    ) : null}
                    <PrimaryButton
                      title="अस्वीकार"
                      variant="outline"
                      onPress={rejectBids}
                      style={{ height: 42, paddingHorizontal: 12 }}
                    />
                  </View>
                </View>
              </View>
            )}
          </View>
        ) : null}

        {token.ratePerQuintal && token.status !== STATUS.ASSAY ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>तय भाव</Text>
            <Row
              label="भाव"
              value={`₹${token.ratePerQuintal} / क्विंटल`}
              bold
            />
            <Row
              label="माध्यम"
              value={token.priceMode === 'auction' ? 'नीलामी' : 'MSP'}
            />
            <Row label="खरीदार" value={token.buyerName} />
          </View>
        ) : null}

        {/* Assay results, once recorded */}
        {token.assayAt ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>गुणवत्ता जांच</Text>
            <Row label="ग्रेड" value={token.grade} />
            <Row label="नमी" value={`${token.moisturePercent}%`} />
            <Row
              label="अन्य पदार्थ"
              value={`${token.foreignMatterPercent}%`}
            />
            {token.assayNotes ? (
              <Row label="टिप्पणी" value={token.assayNotes} />
            ) : null}
          </View>
        ) : null}

        {/* Weighing, once recorded */}
        {token.weighedAt ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>तौल</Text>
            <Row
              label="कुल वजन"
              value={`${token.grossWeightQuintals} क्विंटल`}
            />
            <Row
              label="खाली वाहन"
              value={`${token.tareWeightQuintals} क्विंटल`}
            />
            <Row
              label="शुद्ध वजन"
              value={`${token.actualQuantity} क्विंटल`}
              bold
            />
          </View>
        ) : null}

        {/* Payment receipt */}
        {token.status === STATUS.PAID ? (
          <View style={[styles.card, styles.receiptCard]}>
            <Text style={styles.cardTitle}>भुगतान रसीद</Text>

            <Row label="रसीद क्रमांक" value={token.receiptId} />
            <Row label="मात्रा" value={`${token.actualQuantity} क्विंटल`} />
            <Row label="दर" value={`₹${token.ratePerQuintal} / क्विंटल`} />
            <Row label="कुल राशि" value={`₹${token.grossAmount}`} />
            <Row label="मंडी शुल्क" value={`− ₹${token.mandiFee}`} />
            <Row label="आढ़त" value={`− ₹${token.commission}`} />
            <Row label="हमाली" value={`− ₹${token.hamali}`} />

            <View style={styles.netRow}>
              <Text style={styles.netLabel}>नेट भुगतान</Text>
              <Text style={styles.netValue}>
                ₹{Number(token.netPayable).toLocaleString('en-IN')}
              </Text>
            </View>

            {token.paymentReference ? (
              <Text style={styles.utr}>
                संदर्भ संख्या: {token.paymentReference}
              </Text>
            ) : null}

            <PrimaryButton
              title="⬇  रसीद PDF डाउनलोड करें"
              loading={downloading}
              onPress={handleDownload}
              style={{ marginTop: 14 }}
            />
          </View>
        ) : null}

        {token.status === STATUS.BOOKED ? (
          <PrimaryButton
            title="बुकिंग रद्द करें"
            variant="outline"
            loading={cancelling}
            onPress={confirmCancel}
            style={{ marginTop: 4 }}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function PulsingDot() {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.35,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);

  return (
    <View style={styles.pulseWrap}>
      <Animated.View
        style={[styles.pulseHalo, { transform: [{ scale }] }]}
      />
      <View style={[styles.stageDot, styles.stageDotActive]} />
    </View>
  );
}

function Row({ label, value, bold }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.rowValueBold]}>
        {value || '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 18, paddingBottom: 30 },

  notFound: { textAlign: 'center', color: Colors.subText, marginTop: 40 },

  tokenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tokenLabel: { fontSize: 11, color: Colors.subText, fontWeight: '700' },
  tokenNumber: { fontSize: 32, fontWeight: '900', color: Colors.navy },

  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  receiptCard: { borderColor: Colors.secondary, borderWidth: 2 },
  priceCard: { borderColor: '#F59E0B', borderWidth: 2 },
  priceHint: { color: Colors.subText, fontSize: 12, marginBottom: 12 },
  priceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  priceTitle: { fontWeight: '800', color: Colors.navy, fontSize: 13 },
  priceBig: { fontWeight: '900', color: '#16A34A', fontSize: 20 },
  priceSub: { color: Colors.subText, fontSize: 11 },
  auctionLive: { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  auctionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  countdown: { fontSize: 18, fontWeight: '900', color: '#B45309', fontVariant: ['tabular-nums'] },
  auctionActions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.navy,
    marginBottom: 12,
  },

  stageRow: { flexDirection: 'row', alignItems: 'flex-start' },
  stageLeft: { width: 28, alignItems: 'center' },
  stageDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageDotDone: { backgroundColor: GREEN, borderColor: GREEN },
  stageDotActive: { backgroundColor: AMBER, borderColor: AMBER },
  stageTick: { color: Colors.white, fontSize: 13, fontWeight: '900' },
  stageLine: {
    width: 3,
    height: 22,
    backgroundColor: Colors.border,
    marginVertical: 2,
  },
  stageLineDone: { backgroundColor: GREEN },
  pulseWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseHalo: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: AMBER,
    opacity: 0.3,
  },
  stageTextBox: { flex: 1, marginLeft: 10, paddingBottom: 12 },
  stageLabel: { fontSize: 14, color: Colors.subText, fontWeight: '600' },
  stageLabelDone: { color: GREEN, fontWeight: '800' },
  stageLabelActive: { color: AMBER, fontWeight: '900' },
  stageSub: { fontSize: 11, color: Colors.subText, marginTop: 1 },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 12,
  },
  rowLabel: { fontSize: 12, color: Colors.subText, flex: 1 },
  rowValue: {
    fontSize: 12,
    color: Colors.navy,
    fontWeight: '700',
    flex: 1.4,
    textAlign: 'right',
  },
  rowValueBold: { fontSize: 14, fontWeight: '900' },

  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  netLabel: { fontSize: 14, fontWeight: '800', color: Colors.navy },
  netValue: { fontSize: 20, fontWeight: '900', color: Colors.secondary },
  utr: { fontSize: 10, color: Colors.subText, marginTop: 8 },
});
