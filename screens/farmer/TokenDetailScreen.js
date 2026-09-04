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
  STATUS,
} from '../../services/bookings';
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
