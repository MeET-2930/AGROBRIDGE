import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import PrimaryButton from '../../components/PrimaryButton';
import StatusBadge from '../../components/StatusBadge';
import Colors from '../../theme/colors';

import {
  subscribeToTodaysQueue,
  markGateEntry,
  markNoShow,
  STATUS,
  CLOSED_STATUSES,
} from '../../services/bookings';

import { getCurrentUserSession } from '../../services/auth';
import { useLang } from '../../i18n/LanguageContext';

/*
 * Which screen the officer goes to next, based on where the
 * booking currently is in the pipeline.
 */
const NEXT_STAGE = {
  [STATUS.IN_GATE]: { route: 'Assay', label: 'गुणवत्ता जांच' },
  [STATUS.ASSAY]: { route: 'Weighing', label: 'तौल करें' },
  [STATUS.WEIGHING]: { route: 'MarkPaid', label: 'भुगतान' },
  [STATUS.PAYMENT_PENDING]: { route: 'MarkPaid', label: 'भुगतान' },
};

export default function TodaysQueueScreen({ navigation }) {
  const { tr } = useLang();

  const [queue, setQueue] = useState([]);
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [vehicle, setVehicle] = useState('');
  const [busy, setBusy] = useState(false);

  /*
   * Live subscription. The officer's list updates the instant
   * anything changes, including changes made by another officer
   * on a different device.
   */
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      let unsubscribe = null;

      const start = async () => {
        const user = await getCurrentUserSession();

        if (!user?.centreId) {
          if (alive) setQueue([]);
          return;
        }

        unsubscribe = subscribeToTodaysQueue(user.centreId, null, (list) => {
          if (alive) setQueue(list);
        });
      };

      start();

      return () => {
        alive = false;
        if (unsubscribe) unsubscribe();
      };
    }, [])
  );

  const openGateEntry = (token) => {
    setSelected(token);
    setVehicle(token.vehicleNumber || '');
    setModal(true);
  };

  const confirmGateEntry = async () => {
    if (!selected) return;

    setBusy(true);

    try {
      await markGateEntry(selected.tokenId, vehicle);
      setModal(false);
    } catch (error) {
      Alert.alert('त्रुटि', error?.message || 'गेट प्रवेश दर्ज नहीं हुआ।');
    } finally {
      setBusy(false);
    }
  };

  const noShow = (tokenId) => {
    Alert.alert('अनुपस्थित?', 'क्या किसान नहीं आया?', [
      { text: 'रद्द', style: 'cancel' },
      {
        text: 'हाँ',
        style: 'destructive',
        onPress: async () => {
          try {
            await markNoShow(tokenId);
          } catch (error) {
            Alert.alert('त्रुटि', error?.message || 'दर्ज नहीं हुआ।');
          }
        },
      },
    ]);
  };

  const active = queue.filter(
    (item) => !CLOSED_STATUSES.includes(item.status)
  );

  const nowServing = queue.find((item) => item.status === STATUS.IN_GATE);

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        navigation={navigation}
        showBack
        audioKey="audio_officer_queue"
        title={tr('gateQueue') || 'गेट कतार'}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.nowBar}>
          <Text style={styles.nowLabel}>अभी अंदर</Text>
          <Text style={styles.nowToken}>
            {nowServing ? nowServing.tokenNumber : '—'}
          </Text>
          <Text style={styles.nowCount}>
            कतार में {active.length}
          </Text>
        </View>

        {active.length === 0 ? (
          <Text style={styles.empty}>कतार खाली है</Text>
        ) : (
          active.map((token) => (
            <View key={token.tokenId} style={styles.card}>
              <View style={styles.top}>
                <Text style={styles.token}>{token.tokenNumber}</Text>
                <StatusBadge status={token.status} />
              </View>

              <Text style={styles.name}>{token.farmerName}</Text>

              <Text style={styles.sub}>
                {String(token.cropName || token.crop || '').toUpperCase()} •{' '}
                {token.vehicleNumber || 'वाहन लंबित'}
              </Text>

              <Text style={styles.sub}>
                समय: {token.slotWindow} • अनुमानित {token.estimatedTurnTime}
              </Text>

              <Text style={styles.sub}>
                अनुमानित मात्रा: {token.approxQuantityQuintals} क्विंटल
              </Text>

              <View style={styles.actions}>
                {token.status === STATUS.BOOKED ? (
                  <>
                    <TouchableOpacity
                      style={styles.outline}
                      onPress={() => noShow(token.tokenId)}
                    >
                      <Text style={styles.outlineText}>
                        {tr('markNoShow') || 'अनुपस्थित'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.primary}
                      onPress={() => openGateEntry(token)}
                    >
                      <Ionicons
                        name="enter-outline"
                        size={16}
                        color={Colors.white}
                      />
                      <Text style={styles.primaryText}>गेट प्रवेश</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.secondary}
                    onPress={() => {
                      const next = NEXT_STAGE[token.status];
                      if (next) navigation.navigate(next.route, { token });
                    }}
                  >
                    <Text style={styles.primaryText}>
                      {NEXT_STAGE[token.status]?.label || 'आगे बढ़ें'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {tr('enterVehicle') || 'वाहन नंबर'}
            </Text>

            <Text style={styles.sheetSub}>
              टोकन {selected?.tokenNumber} • {selected?.farmerName}
            </Text>

            <TextInput
              style={styles.input}
              value={vehicle}
              onChangeText={setVehicle}
              placeholder="HR 26 AB 1234"
              placeholderTextColor="#999"
              autoCapitalize="characters"
            />

            <Text style={styles.note}>
              पुष्टि करते ही अगले किसान को हरा संकेत मिल जाएगा।
            </Text>

            <View style={styles.sheetRow}>
              <TouchableOpacity onPress={() => setModal(false)}>
                <Text style={styles.cancel}>{tr('cancel') || 'रद्द'}</Text>
              </TouchableOpacity>

              <PrimaryButton
                title={tr('confirmArrival') || 'पुष्टि'}
                loading={busy}
                onPress={confirmGateEntry}
                style={{ flex: 1, height: 44 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 30 },

  nowBar: {
    backgroundColor: Colors.navy,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nowLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700' },
  nowToken: {
    color: Colors.white,
    fontSize: 24,
    fontWeight: '900',
    marginLeft: 12,
    flex: 1,
  },
  nowCount: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700' },

  empty: { textAlign: 'center', marginTop: 40, color: Colors.subText },

  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  token: { fontSize: 22, fontWeight: '900', color: Colors.navy },
  name: { marginTop: 8, fontWeight: '700', color: Colors.text },
  sub: { marginTop: 3, color: Colors.subText, fontSize: 12 },

  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  outline: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: 8,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineText: { color: Colors.error, fontWeight: '800' },
  primary: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  secondary: {
    flex: 1,
    backgroundColor: Colors.secondary,
    borderRadius: 8,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: Colors.white, fontWeight: '800' },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    width: '88%',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 18,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: Colors.navy },
  sheetSub: { color: Colors.subText, marginBottom: 12, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  note: {
    fontSize: 11,
    color: Colors.subText,
    marginTop: 8,
    marginBottom: 14,
  },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cancel: { color: Colors.subText, fontWeight: '700', padding: 10 },
});
