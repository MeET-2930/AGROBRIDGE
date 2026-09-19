/*
 * screens/farmer/SlotSelectionScreen.js  (install41)
 * ---------------------------------------------------------------
 * Step 4 of booking: pick the hour to arrive.
 *
 * Capacity is quintals per hour (see CAPACITY MODEL in
 * services/bookings.js). Every hour row is evaluated FOR THIS
 * FARMER'S LOAD: "room for your 25 q" or "no room for 25 q".
 * A big load that needs more than one hour is shown as one
 * continuous run ("9 AM - 12 PM, 3 hours") and booked as ONE token.
 * Booking happens here, inside a Firestore transaction.
 */
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
import DateCalendar from '../../components/DateCalendar';
import { cropClassOf } from '../../services/centres';
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
import { TESTING_MODE } from '../../services/config';

import { useLang } from '../../i18n/LanguageContext';
import { centreLabel } from '../../services/centres';

export default function SlotSelectionScreen({ navigation, route }) {
  const { tr, lang, trError } = useLang();
  const { crop, centre, quantity = 10 } = route.params || {};

  // Local date, never UTC. See services/dates.js for why.
  const today = todayLocal();

  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState([]);
  const [tooBig, setTooBig] = useState(false);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadSlots = async () => {
    if (!centre?.id) {
      setSlots([]);
      setSelected(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // install44: pass the farmer so the engine can use HIS history (Model A/C)
      const me = await getCurrentUserSession().catch(() => null);
      const result = await fetchCentreSlots(centre.id, date, { crop: crop?.id, quintals: quantity, farmerId: me?.uid || null });
      const all = result?.slots || [];

      let usable = all;

      if (!TESTING_MODE && date === today) {
        // Hide windows that have already passed today.
        const hour = new Date().getHours();
        usable = all.filter((s) => Number(s.slotTime.split(':')[0]) > hour);
      }

      setSlots(usable);
      setTooBig(Boolean(result?.tooBig));
      setSelected(usable.find((s) => s.fits) || null);
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
  }, [date, centre?.id, quantity]);

  const confirm = async () => {
    if (!selected || !selected.fits) {
      Alert.alert(tr('ss_pickSlot'), tr('ss_pickOne'));
      return;
    }

    const session = await getCurrentUserSession();
    if (!session?.uid) {
      Alert.alert(tr('loginRequired'), tr('loginAgain'));
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
        slotWindow: selected.runLabel || selected.windowLabel,
      });

      navigation.reset({
        index: 0,
        routes: [{ name: 'TokenConfirmation', params: { booking } }],
      });
    } catch (error) {
      console.error('Booking error:', error);
      Alert.alert(tr('ss_bookFail'), trError(error, 'ss_bookFailSub'));
      // Room may have gone while the farmer was deciding: reload ticks.
      loadSlots();
    } finally {
      setSubmitting(false);
    }
  };

  const firstFit = slots.find((s) => s.fits) || null;

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack audioKey="audio_slot" />

      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle
          title={tr('selectSlot')}
          subtitle={`${centreLabel(centre, lang) || tr('mandi')} • ${quantity} ${tr('quintal')}`}
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
            {tr('ss_selected', { label: friendlyDateLabel(date, lang), date })}
          </Text>
        </Text>

        {/* install49: calendar. Grain up to 7 days ahead, perishables today/tomorrow. */}
        <DateCalendar
          value={date}
          onChange={setDate}
          minDate={today}
          maxDate={dateOffsetLocal(cropClassOf(crop?.id) === 'perishable' ? 1 : 7)}
          lang={lang}
        />

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
          <>
            {tooBig ? (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>{tr('ss_tooBig', { q: quantity })}</Text>
              </View>
            ) : !firstFit ? (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>{tr('ss_noRoomDay', { q: quantity })}</Text>
              </View>
            ) : firstFit.needed > 1 ? (
              <View style={styles.noticeInfo}>
                <Text style={styles.noticeInfoText}>{tr('ss_bigLoad', { q: quantity, h: firstFit.needed })}</Text>
              </View>
            ) : null}

            {slots.map((slot) => {
              const isSelected = selected?.slotTime === slot.slotTime;

              return (
                <TouchableOpacity
                  key={slot.slotTime}
                  style={[
                    styles.slot,
                    isSelected && styles.slotOn,
                    !slot.fits && styles.slotFull,
                  ]}
                  onPress={() => setSelected(slot)}
                  disabled={!slot.fits}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.slotTitle}>
                      {slot.fits && slot.needed > 1 ? slot.runLabel : slot.windowLabel}
                    </Text>

                    <Text
                      style={[
                        styles.slotSub,
                        !slot.fits && { color: Colors.error },
                        slot.fits && { color: '#2E7D32' },
                      ]}
                    >
                      {slot.fits
                        ? slot.needed > 1
                          ? tr('ss_roomRun', { q: quantity, h: slot.needed })
                          : tr('ss_room', { q: quantity })
                        : slot.reason === 'vehicles'
                        ? tr('ss_noVehicle')
                        : slot.reason === 'tooLate'
                        ? tr('ss_tooLate')
                        : slot.reason === 'closed'
                        ? tr('ss_closed')
                        : slot.reason === 'horizon'
                        ? tr('ss_horizon', { d: slot.horizon })
                        : tr('ss_noRoom', { q: quantity })}
                    </Text>
                  </View>

                  <Text style={[styles.mark, slot.fits ? styles.markOk : styles.markNo]}>
                    {slot.fits ? (isSelected ? '✓' : '○') : '✕'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </>
        )}

      </ScrollView>

      <View style={styles.footer}>
        {selected?.fits ? (
          <Text style={styles.footerHint}>
            {tr('ss_arriveHint', { t: selected.arriveLabel })}
          </Text>
        ) : null}
        <PrimaryButton
          title={tr('confirmToken')}
          onPress={confirm}
          loading={submitting}
          disabled={!selected || !selected?.fits || loading || submitting}
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

  notice: {
    backgroundColor: '#FDECEA',
    borderColor: '#F5B5AE',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  noticeText: { color: '#8A1C10', fontWeight: '700', fontSize: 13, lineHeight: 18 },
  noticeInfo: {
    backgroundColor: '#E3F2FD',
    borderColor: '#90CAF9',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  noticeInfoText: { color: '#0D47A1', fontWeight: '700', fontSize: 13, lineHeight: 18 },

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
  slotSub: { color: Colors.subText, marginTop: 4, fontSize: 13, fontWeight: '700' },
  mark: { fontSize: 22, fontWeight: '900', marginLeft: 10 },
  markOk: { color: '#2E7D32' },
  markNo: { color: Colors.error },

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
  footerHint: { textAlign: 'center', color: Colors.subText, fontWeight: '700', fontSize: 13, marginBottom: 10 },
});
