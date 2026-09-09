/*
 * screens/farmer/QuantityScreen.js  (install27)
 * ---------------------------------------------------------------
 * Step 4 of booking: "about how many quintals are you bringing?"
 *
 * Why its own screen: on the slot screen the quantity box sat under
 * a long list of time slots, so farmers pressed "Confirm" without
 * ever seeing it (default 10 quintals went into the booking).
 * Here the number is the only thing on the page, in large type,
 * with a summary of what was chosen so far. The booking is created
 * from this screen (Firestore transaction in services/bookings.js).
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';

import { createBooking } from '../../services/bookings';
import { getCurrentUserSession } from '../../services/auth';
import { friendlyDateLabel } from '../../services/dates';
import { centreLabel } from '../../services/centres';
import { useLang } from '../../i18n/LanguageContext';

const QUICK = [5, 10, 20, 50];

export default function QuantityScreen({ navigation, route }) {
  const { tr, lang, trError } = useLang();
  const { crop, centre, date, slot } = route.params || {};

  const [quantity, setQuantity] = useState(10);
  const [submitting, setSubmitting] = useState(false);

  const change = (delta) => setQuantity((q) => Math.max(1, Math.min(999, q + delta)));

  const confirm = async () => {
    if (!crop?.id || !centre?.id || !date || !slot?.slotTime) {
      Alert.alert(tr('ss_pickSlot'), tr('ss_pickOne'));
      navigation.goBack();
      return;
    }

    const session = await getCurrentUserSession();
    if (!session?.uid) {
      Alert.alert(tr('loginRequired'), tr('loginAgain'));
      return;
    }

    if (!quantity || quantity <= 0) {
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
        slotTime: slot.slotTime,
        slotWindow: slot.windowLabel,
      });

      navigation.reset({
        index: 0,
        routes: [{ name: 'TokenConfirmation', params: { booking } }],
      });
    } catch (error) {
      console.error('Booking error:', error);
      Alert.alert(tr('ss_bookFail'), trError(error, 'ss_bookFailSub'));
      // The slot may have filled while the farmer was deciding: go back so
      // the slot list reloads.
      navigation.goBack();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack audioKey="audio_qty" />

      <View style={styles.content}>
        <ScreenTitle title={tr('qty_title')} subtitle={tr('qty_sub')} />

        {/* What has been chosen so far - short, so nothing is a surprise on the token */}
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>{tr('qty_summary')}</Text>
          <Row label={tr('crop')} value={crop?.nameKey ? tr(crop.nameKey) : crop?.name || '-'} />
          <Row label={tr('mandi')} value={centreLabel(centre, lang) || '-'} />
          <Row label={tr('date')} value={date ? `${friendlyDateLabel(date)}  ${date.slice(8)}/${date.slice(5, 7)}` : '-'} />
          <Row label={tr('time')} value={slot?.windowLabel || '-'} last />
        </View>

        {/* The big number */}
        <View style={styles.quantityBox}>
          <View style={styles.quantityInputRow}>
            <TouchableOpacity style={styles.quantityButton} onPress={() => change(-1)} onLongPress={() => change(-5)}>
              <Text style={styles.quantityButtonText}>−</Text>
            </TouchableOpacity>

            <Text style={styles.quantityValue}>{quantity}</Text>

            <TouchableOpacity style={styles.quantityButton} onPress={() => change(1)} onLongPress={() => change(5)}>
              <Text style={styles.quantityButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.quantityUnit}>{tr('quintal')}</Text>

          <View style={styles.quickRow}>
            {QUICK.map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.quick, quantity === n && styles.quickOn]}
                onPress={() => setQuantity(n)}
              >
                <Text style={[styles.quickText, quantity === n && styles.quickTextOn]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={styles.hint}>{tr('qty_hint')}</Text>
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          loading={submitting}
          title={tr('confirmToken')}
          onPress={confirm}
          disabled={submitting}
        />
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value, last }) {
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, padding: 20 },

  summary: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
  },
  summaryTitle: { fontSize: 12, fontWeight: '800', color: Colors.subText, marginTop: 6, marginBottom: 2 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  rowLabel: { fontSize: 13, color: Colors.subText, fontWeight: '600' },
  rowValue: { fontSize: 13, color: Colors.navy, fontWeight: '800', flex: 1, textAlign: 'right' },

  quantityBox: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    alignItems: 'center',
  },
  quantityInputRow: { flexDirection: 'row', alignItems: 'center', gap: 26 },
  quantityButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonText: { fontSize: 34, fontWeight: '800', color: Colors.navy, lineHeight: 38 },
  quantityValue: {
    minWidth: 110,
    textAlign: 'center',
    fontSize: 54,
    fontWeight: '900',
    color: Colors.navy,
  },
  quantityUnit: { fontSize: 14, fontWeight: '700', color: Colors.subText, marginTop: 2 },

  quickRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  quick: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  quickOn: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  quickText: { fontWeight: '800', color: Colors.navy, fontSize: 14 },
  quickTextOn: { color: Colors.white },

  hint: { fontSize: 12, color: Colors.subText, textAlign: 'center', marginTop: 14, lineHeight: 18 },

  footer: {
    padding: 20,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
