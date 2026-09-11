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

import { fetchCentreSlots } from '../../services/bookings';
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

    // Quantity is asked on its own screen (install27) so the farmer cannot
    // miss it under a long list of slots.
    navigation.navigate('Quantity', { crop, centre, date, slot: selected });
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

      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          title={tr('ss_next')}
          onPress={confirm}
          disabled={!selected || selected?.isFull || loading}
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

  sectionHint: { fontSize: 12, fontWeight: '600', color: Colors.subText },
  testBanner: {
    backgroundColor: '#FFF4D6',
    borderColor: '#F0C36D',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  testBannerText: { color: '#7A5200', fontWeight: '700', fontSize: 13 },

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
  dateSmall: { color: Colors.subText, fontSize: 11, marginTop: 2 },
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
  slotSub: { color: Colors.subText, marginTop: 4, fontSize: 13 },
  selectedText: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.primary,
    marginLeft: 10,
  },

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
