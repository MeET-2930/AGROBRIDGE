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
  dutyOwnsStage,
  STATUS,
  CLOSED_STATUSES,
  yardRef,
  passLabel,
} from '../../services/bookings';

import { getCurrentUserSession } from '../../services/auth';
import { useLang } from '../../i18n/LanguageContext';
import { cropLabel } from '../../services/centres';

/*
 * Which screen the officer goes to next, based on where the
 * booking currently is in the pipeline.
 */
const NEXT_STAGE = {
  [STATUS.IN_GATE]: { route: 'Assay', label: 'stg_assay_a', stage: 'assay', duty: 'duty_assay' },
  [STATUS.ASSAY]: { route: 'Weighing', label: 'stg_weighing_a', stage: 'weighing', duty: 'duty_weighbridge' },
  [STATUS.PRICE_FIXED]: { route: 'Weighing', label: 'stg_weighing_a', stage: 'weighing', duty: 'duty_weighbridge' },
  [STATUS.WEIGHING]: { route: 'MarkPaid', label: 'stg_payment_a', stage: 'payment', duty: 'duty_accounts' },
  [STATUS.PAYMENT_PENDING]: { route: 'MarkPaid', label: 'stg_payment_a', stage: 'payment', duty: 'duty_accounts' },
};

export default function TodaysQueueScreen({ navigation }) {
  const { tr, lang, trError } = useLang();

  const [queue, setQueue] = useState([]);
  const [duty, setDuty] = useState('gate');
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
        if (alive) setDuty(user?.officerDuty || 'gate');

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
      Alert.alert(tr('error'), trError(error, 'gs_entryFail'));
    } finally {
      setBusy(false);
    }
  };

  const noShow = (tokenId) => {
    Alert.alert(tr('noShowQ'), tr('noShowSub'), [
      { text: tr('cancel'), style: 'cancel' },
      {
        text: tr('yes'),
        style: 'destructive',
        onPress: async () => {
          try {
            await markNoShow(tokenId);
          } catch (error) {
            Alert.alert(tr('error'), trError(error, 'notRecorded'));
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
        title={tr('gateQueue')}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.nowBar}>
          <Text style={styles.nowLabel}>{tr('tq_nowInside')}</Text>
          <Text style={styles.nowToken}>
            {nowServing ? `#${yardRef(nowServing)}` : '—'}
          </Text>
          <Text style={styles.nowCount}>
            {tr('tq_inQueue', { n: active.length })}
          </Text>
        </View>

        {active.length === 0 ? (
          <Text style={styles.empty}>{tr('tq_empty')}</Text>
        ) : (
          active.map((token) => (
            <View key={token.tokenId} style={styles.card}>
              <View style={styles.top}>
                <Text style={styles.token}>#{yardRef(token)}</Text>
                <StatusBadge status={token.status} />
              </View>

              <Text style={styles.name}>{token.farmerName}</Text>

              <Text style={styles.sub}>
                {cropLabel(token, lang)} •{' '}
                {token.vehicleNumber || tr('vehiclePending')}
              </Text>

              <Text style={styles.sub}>
                {tr('tq_timeLine', { slot: passLabel(token), eta: token.arriveAt || token.estimatedTurnTime })}
              </Text>

              <Text style={styles.sub}>
                {tr('tq_qtyLine', { q: token.approxQuantityQuintals })}
              </Text>

              <View style={styles.actions}>
                {token.status === STATUS.BOOKED ? (
                  dutyOwnsStage(duty, 'gate') ? (
                    <>
                      <TouchableOpacity
                        style={styles.outline}
                        onPress={() => noShow(token.tokenId)}
                      >
                        <Text style={styles.outlineText}>
                          {tr('markNoShow')}
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
                        <Text style={styles.primaryText}>{tr('tq_gateEntry')}</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Text style={styles.viewOnly}>
                      {tr('tq_handledBy', { who: tr('duty_gate') })}
                    </Text>
                  )
                ) : NEXT_STAGE[token.status] &&
                  dutyOwnsStage(duty, NEXT_STAGE[token.status].stage) ? (
                  <TouchableOpacity
                    style={styles.secondary}
                    onPress={() =>
                      navigation.navigate(NEXT_STAGE[token.status].route, { token })
                    }
                  >
                    <Text style={styles.primaryText}>
                      {tr(NEXT_STAGE[token.status].label)}
                    </Text>
                  </TouchableOpacity>
                ) : NEXT_STAGE[token.status] ? (
                  <Text style={styles.viewOnly}>
                    {tr('tq_handledBy', { who: tr(NEXT_STAGE[token.status].duty) })}
                  </Text>
                ) : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {tr('vehicleNumber')}
            </Text>

            <Text style={styles.sheetSub}>
              {tr('tokenAndName', { t: selected ? `#${yardRef(selected)}` : '', n: selected?.farmerName || '' })}
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
              {tr('tq_useScan')}
            </Text>

            <View style={styles.sheetRow}>
              <TouchableOpacity onPress={() => setModal(false)}>
                <Text style={styles.cancel}>{tr('cancel')}</Text>
              </TouchableOpacity>

              <PrimaryButton
                title={tr('confirm')}
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
  viewOnly: { color: Colors.subText, fontSize: 13, fontStyle: 'italic', paddingVertical: 8 },
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
  nowLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '700' },
  nowToken: {
    color: Colors.white,
    fontSize: 24,
    fontWeight: '900',
    marginLeft: 12,
    flex: 1,
  },
  nowCount: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '700' },

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
  sub: { marginTop: 3, color: Colors.subText, fontSize: 13 },

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
    backgroundColor: Colors.error,
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: 8,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineText: { color: Colors.white, fontWeight: '800' },
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
  sheetSub: { color: Colors.subText, marginBottom: 12, fontSize: 13 },
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
    fontSize: 12,
    color: Colors.subText,
    marginTop: 8,
    marginBottom: 14,
  },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cancel: { color: Colors.subText, fontWeight: '700', padding: 10 },
});
