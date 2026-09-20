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

import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';

import { fetchCentreSlots, createBooking, findTransferOptions, bookTransfer } from '../../services/bookings';
import { scheduleAt } from '../../services/deviceNotify';
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
  // install55: `forFarmer` = arhtiya booking on a farmer's behalf; `extra` = reg no / ceiling / nominee from the quantity screen
  const { crop, centre, quantity = 10, fromYardIncident = false, forFarmer = null, extra = {} } = route.params || {};

  // Local date, never UTC. See services/dates.js for why.
  const today = todayLocal();

  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState([]);
  const [tooBig, setTooBig] = useState(false);
  const [yardInfo, setYardInfo] = useState(null);   // install52: floor / recovery for this date
  const [transfers, setTransfers] = useState(null); // install53: nearby mandis with spare today (null = not checked)
  const [transferBusy, setTransferBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [closedDay, setClosedDay] = useState(null);   // install55: { reason:'weekly'|'holiday', label }

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
      setClosedDay(result?.closedDay || null);

      let usable = all;

      if (!TESTING_MODE && date === today) {
        // Hide windows that have already passed today.
        const hour = new Date().getHours();
        usable = all.filter((s) => Number(s.slotTime.split(':')[0]) > hour);
      }

      setSlots(usable);
      setTooBig(Boolean(result?.tooBig));
      setYardInfo(result?.yard || null);
      // install53: today thin here? look for spare in the cluster (same-day only)
      const thinToday = date === today && (!usable.some((s) => s.fits) || fromYardIncident || (result?.yard?.factor ?? 1) < 0.5);
      if (thinToday) {
        setTransfers(undefined);
        findTransferOptions(centre.id, crop?.id, quantity).then(setTransfers).catch(() => setTransfers([]));
      } else {
        setTransfers(null);
      }
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

  const takeTransfer = (opt) => {
    const until = new Date(Date.now() + 90 * 60000);
    const t = `${String(until.getHours()).padStart(2, '0')}:${String(until.getMinutes()).padStart(2, '0')}`;
    Alert.alert(tr('tf_go'), tr('tf_confirm', { mandi: centreLabel(opt.centre, lang), t }), [
      { text: tr('no'), style: 'cancel' },
      {
        text: tr('yes'),
        onPress: async () => {
          const session = await getCurrentUserSession();
          if (!session?.uid) { Alert.alert(tr('loginRequired'), tr('loginAgain')); return; }
          setTransferBusy(true);
          try {
            const booking = await bookTransfer({
              farmerId: session.uid, farmerName: session.name, farmerPhone: session.phone,
              fromCentreId: centre.id, toCentreId: opt.centre.id, crop: crop.id, cropName: crop.name, quintals: Number(quantity),
            });
            navigation.reset({ index: 0, routes: [{ name: 'TokenConfirmation', params: { booking } }] });
          } catch (error) {
            Alert.alert(tr('ss_bookFail'), trError(error, 'ss_bookFailSub'));
            loadSlots();
          } finally {
            setTransferBusy(false);
          }
        },
      },
    ]);
  };

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
      const who = forFarmer || session;   // install55: arhtiya books for his farmer
      const booking = await createBooking({
        farmerId: who.uid,
        farmerName: who.name,
        farmerPhone: who.phone,
        centreId: centre.id,
        crop: crop.id,
        cropName: crop.name,
        approxQuantityQuintals: Number(quantity),
        date,
        slotTime: selected.slotTime,
        slotWindow: selected.runLabel || selected.windowLabel,
        bookedVia: forFarmer ? 'arhtiya' : 'app',
        extra: {
          ...extra,
          ...(forFarmer ? { arhtiyaId: session.uid, arhtiyaName: session.businessName || session.name, arhtiyaShedId: session.shedId || null } : {}),
        },
      });

      // install55: evening-before reminder on THIS phone (7 pm the day before; today's bookings get none).
      // Works on Android/iOS builds; on the website scheduleAt returns null and nothing breaks.
      try {
        const eve = new Date(`${date}T19:00:00`);
        eve.setDate(eve.getDate() - 1);
        scheduleAt(eve, { title: tr('rm_eveTitle'), body: tr('rm_eveBody', { t: booking.arriveAt || booking.slotWindow, mandi: centreLabel(centre, lang) }), data: { tokenId: booking.tokenId } });
      } catch (e) { /* reminders are best-effort */ }

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
            <Ionicons name={closedDay ? 'calendar-clear-outline' : 'time-outline'} size={26} color={Colors.subText} />
            <Text style={styles.emptyText}>
              {closedDay
                ? closedDay.reason === 'holiday'
                  ? tr('ss_holiday', { l: closedDay.label || '' })
                  : tr('ss_weeklyOff')
                : date === today
                ? tr('ss_noneToday')
                : tr('ss_noneDay')}
            </Text>
            {closedDay ? <Text style={styles.emptyHint}>{tr('ss_closedHint')}</Text> : null}
          </View>
        ) : (
          <>
            {fromYardIncident ? (
              <View style={styles.noticeInfo}>
                <Text style={styles.noticeInfoText}>{tr('ss_yardRebook')}</Text>
              </View>
            ) : null}
            {transfers === undefined ? (
              <View style={styles.noticeInfo}><Text style={styles.noticeInfoText}>{tr('tf_checking')}</Text></View>
            ) : Array.isArray(transfers) && transfers.length ? (
              <View style={styles.tfBox}>
                <Text style={styles.tfTitle}>{tr('tf_title')}</Text>
                <Text style={styles.tfSub}>{tr('tf_sub')}</Text>
                {transfers.map((opt) => (
                  <View key={opt.centre.id} style={styles.tfRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tfName}>{centreLabel(opt.centre, lang)}</Text>
                      <Text style={styles.tfMeta}>{tr('tf_row', { km: opt.km ?? '?', until: opt.untilLabel, g: opt.gateWaiting })}</Text>
                    </View>
                    <TouchableOpacity style={styles.tfBtn} disabled={transferBusy} onPress={() => takeTransfer(opt)}>
                      <Text style={styles.tfBtnText}>{tr('tf_go')}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : Array.isArray(transfers) && (fromYardIncident || !firstFit) ? (
              <View style={styles.noticeInfo}><Text style={styles.noticeInfoText}>{tr('tf_none')}</Text></View>
            ) : null}
            {yardInfo && yardInfo.factor < 0.99 ? (
              <View style={styles.noticeYard}>
                <Text style={styles.noticeYardText}>{tr('ss_yardThin', { p: Math.round(yardInfo.floorUsedPercent), d: yardInfo.recoveryDays })}</Text>
              </View>
            ) : null}
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
                        : slot.reason === 'yard'
                        ? tr('ss_yard')
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
  tfBox: { backgroundColor: '#ECFDF5', borderColor: '#16A34A', borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 12 },
  tfTitle: { color: '#166534', fontWeight: '800', fontSize: 14 },
  tfSub: { color: '#166534', fontSize: 12, lineHeight: 17, marginTop: 2, marginBottom: 6 },
  tfRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#BBF7D0' },
  tfName: { color: Colors.navy, fontWeight: '800', fontSize: 13 },
  tfMeta: { color: Colors.subText, fontSize: 11, marginTop: 2 },
  tfBtn: { backgroundColor: '#16A34A', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginLeft: 8 },
  tfBtnText: { color: Colors.white, fontWeight: '800', fontSize: 12 },
  noticeYard: { backgroundColor: '#FEF3C7', borderColor: '#D97706', borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 12 },
  noticeYardText: { color: '#92400E', fontWeight: '700', fontSize: 13, lineHeight: 18 },

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
  emptyHint: { fontSize: 12, color: Colors.subText, textAlign: 'center', marginTop: 6 },
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
