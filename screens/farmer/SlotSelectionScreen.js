import React, { useEffect, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';

import { fetchCentreSlots, createBooking } from '../../services/bookings';
import { getCurrentUserSession } from '../../services/auth';
import {
  todayLocal,
  dateOffsetLocal,
  friendlyDateLabel,
} from '../../services/dates';

/*
 * TESTING MODE
 * ---------------------------------------------------------------
 * true  = every slot of today can be booked at any time of day,
 *         so the farmer -> officer loop can be tested whenever.
 * false = slots whose hour has already passed are hidden.
 * Flip this to false before the real demo.
 */
const TESTING_MODE = true;

import { useLang } from '../../i18n/LanguageContext';
import { centreLabel } from '../../services/centres';

export default function SlotSelectionScreen({ navigation, route }) {
  const { tr, lang, trError } = useLang();
  const { crop, centre } = route.params || {};

  // Local date, never UTC. See services/dates.js for why.
  const today = todayLocal();

  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quantity, setQuantity] = useState('10');

  const loadSlots = async () => {
    if (!centre?.id) {
      setSlots([]);
      setSelected(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const result = await fetchCentreSlots(centre.id, date);
      const all = result?.slots || [];

      let usable = all;

      if (!TESTING_MODE && date === today) {
        // Hide windows that have already passed today.
        const hour = new Date().getHours();
        usable = all.filter((s) => Number(s.slotTime.split(':')[0]) > hour);
      }

      setSlots(usable);
      setSelected(usable.find((s) => !s.isFull) || usable[0] || null);
    } catch (error) {
      console.error('Slot loading error:', error);
      setSlots([]);
      setSelected(null);

      Alert.alert(tr('ss_loadFail'), trError(error, 'pleaseRetry'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSlots();
  }, [date, centre?.id]);

  const confirm = async () => {
    if (!selected) {
      Alert.alert(tr('ss_pickSlot'), tr('ss_pickOne'));
      return;
    }

    if (selected.isFull) {
      Alert.alert(tr('ss_isFull'), tr('ss_isFullSub'));
      return;
    }

    const session = await getCurrentUserSession();

    if (!session?.uid) {
      Alert.alert(tr('loginRequired'), tr('loginAgain'));
      return;
    }

    if (!quantity || Number(quantity) <= 0) {
      Alert.alert(tr('quantity'), tr('ss_enterQty'));
      return;
    }

    setSubmitting(true);

    try {
      const booking = await createBooking({
        farmerId: session.uid,
        farmerName: session.name,
        farmerPhone: session.phone,
        centreId: centre.id,
        crop: crop.id,
        cropName: crop.name,
        approxQuantityQuintals: Number(quantity),
        date,
        slotTime: selected.slotTime,
        slotWindow: selected.windowLabel,
      });

      navigation.reset({
        index: 0,
        routes: [{ name: 'TokenConfirmation', params: { booking } }],
      });
    } catch (error) {
      console.error('Booking error:', error);
      Alert.alert(tr('ss_bookFail'), trError(error, 'ss_bookFailSub'));

      // The slot may have filled up while the farmer was deciding.
      loadSlots();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack audioKey="audio_slot" />

      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle
          title={tr('selectSlot')}
          subtitle={centreLabel(centre, lang) || tr('mandi')}
        />

        {TESTING_MODE ? (
          <View style={styles.testBanner}>
            <Text style={styles.testBannerText}>
              {tr('ss_testBanner')}
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>
          {tr('ss_pickDate')}{'  '}
          <Text style={styles.sectionHint}>
            {tr('ss_selected', { label: friendlyDateLabel(date), date })}
          </Text>
        </Text>

        <View style={styles.dates}>
          {[0, 1, 2].map((offset) => {
            const dateString = dateOffsetLocal(offset);
            const isSelected = date === dateString;

            return (
              <TouchableOpacity
                key={dateString}
                style={[styles.dateChip, isSelected && styles.dateOn]}
                onPress={() => setDate(dateString)}
              >
                <Text
                  style={[styles.dateText, isSelected && styles.dateTextOn]}
                >
                  {friendlyDateLabel(dateString)}
                </Text>

                <Text
                  style={[styles.dateSmall, isSelected && styles.dateTextOn]}
                >
                  {dateString.slice(8)}/{dateString.slice(5, 7)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>{tr('ss_pickSlot')}</Text>

        {loading ? (
          <ActivityIndicator
            color={Colors.primary}
            size="large"
            style={{ marginTop: 20 }}
          />
        ) : slots.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {date === today
                ? tr('ss_noneToday')
                : tr('ss_noneDay')}
            </Text>
          </View>
        ) : (
          slots.map((slot) => {
            const isSelected = selected?.slotTime === slot.slotTime;

            return (
              <TouchableOpacity
                key={slot.slotTime}
                style={[
                  styles.slot,
                  isSelected && styles.slotOn,
                  slot.isFull && styles.slotFull,
                ]}
                onPress={() => setSelected(slot)}
                disabled={slot.isFull}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.slotTitle}>{slot.windowLabel}</Text>

                  <Text
                    style={[
                      styles.slotSub,
                      slot.isFull && { color: Colors.error },
                    ]}
                  >
                    {slot.isFull
                      ? tr('ss_full')
                      : tr('ss_available', { a: slot.availableCapacity, b: slot.totalCapacity })}
                  </Text>
                </View>

                {isSelected && !slot.isFull ? (
                  <Text style={styles.selectedText}>✓</Text>
                ) : null}
              </TouchableOpacity>
            );
          })
        )}

        <Text style={styles.sectionTitle}>{tr('ss_qtyTitle')}</Text>

        <View style={styles.quantityBox}>
          <Text style={styles.quantityLabel}>{tr('ss_qtyLabel')}</Text>

          <View style={styles.quantityInputRow}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() =>
                setQuantity(
                  String(Math.max(1, Number(quantity || 0) - 1))
                )
              }
            >
              <Text style={styles.quantityButtonText}>−</Text>
            </TouchableOpacity>

            <Text style={styles.quantityValue}>{quantity || '0'}</Text>

            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => setQuantity(String(Number(quantity || 0) + 1))}
            >
              <Text style={styles.quantityButtonText}>+</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.quantityUnit}>{tr('quintal')}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          loading={submitting}
          title={tr('confirmToken')}
          onPress={confirm}
          disabled={!selected || selected?.isFull || loading || submitting}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 35 },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.navy,
    marginTop: 8,
    marginBottom: 10,
  },

  sectionHint: { fontSize: 11, fontWeight: '600', color: Colors.subText },
  testBanner: {
    backgroundColor: '#FFF4D6',
    borderColor: '#F0C36D',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  testBannerText: { color: '#7A5200', fontWeight: '700', fontSize: 12 },

  dates: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  dateChip: {
    flex: 1,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 11,
    alignItems: 'center',
  },
  dateOn: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  dateText: { fontWeight: '800', color: Colors.navy, fontSize: 14 },
  dateSmall: { color: Colors.subText, fontSize: 10, marginTop: 2 },
  dateTextOn: { color: Colors.white },

  slot: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  slotOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  slotFull: { opacity: 0.55 },
  slotTitle: { fontWeight: '800', color: Colors.navy, fontSize: 15 },
  slotSub: { color: Colors.subText, marginTop: 4, fontSize: 12 },
  selectedText: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.primary,
    marginLeft: 10,
  },

  quantityBox: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    alignItems: 'center',
  },
  quantityLabel: { fontSize: 12, fontWeight: '700', color: Colors.subText },
  quantityInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 22,
  },
  quantityButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonText: { fontSize: 25, fontWeight: '800', color: Colors.navy },
  quantityValue: {
    minWidth: 70,
    textAlign: 'center',
    fontSize: 25,
    fontWeight: '900',
    color: Colors.navy,
  },
  quantityUnit: { fontSize: 11, color: Colors.subText, marginTop: 4 },

  empty: {
    backgroundColor: Colors.white,
    padding: 20,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  emptyText: {
    color: Colors.subText,
    fontWeight: '600',
    textAlign: 'center',
  },

  footer: {
    padding: 20,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
