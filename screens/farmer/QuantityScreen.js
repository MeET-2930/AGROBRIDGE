/*
 * screens/farmer/QuantityScreen.js  (install41)
 * ---------------------------------------------------------------
 * Step 3 of booking: "about how many quintals are you bringing?"
 *
 * install41 moved this BEFORE the slot screen. The mandi's capacity
 * is now measured in quintals per hour, so the slot list can only
 * say "this hour has room for YOUR load" once the load is known.
 * This screen no longer books anything; the slot screen does.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';

import { centreLabel } from '../../services/centres';
import { useLang } from '../../i18n/LanguageContext';

const QUICK = [5, 10, 20, 50, 100];

export default function QuantityScreen({ navigation, route }) {
  const { tr, lang } = useLang();
  const { crop, centre } = route.params || {};

  const [quantity, setQuantity] = useState(10);

  const change = (delta) => setQuantity((q) => Math.max(1, Math.min(9999, (Number(q) || 0) + delta)));

  const next = () => {
    if (!crop?.id || !centre?.id) {
      navigation.goBack();
      return;
    }
    if (!quantity || quantity <= 0) {
      Alert.alert(tr('quantity'), tr('ss_enterQty'));
      return;
    }
    navigation.navigate('SlotSelection', { crop, centre, quantity: Number(quantity) });
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
          <Row label={tr('mandi')} value={centreLabel(centre, lang) || '-'} last />
        </View>

        {/* The big number */}
        <View style={styles.quantityBox}>
          <View style={styles.quantityInputRow}>
            <TouchableOpacity style={styles.quantityButton} onPress={() => change(-1)} onLongPress={() => change(-5)}>
              <Text style={styles.quantityButtonText}>−</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.quantityValue}
              value={String(quantity)}
              keyboardType="numeric"
              maxLength={4}
              selectTextOnFocus
              onChangeText={(v) => {
                const n = parseInt(String(v).replace(/\D/g, ''), 10);
                setQuantity(Number.isFinite(n) ? Math.max(0, Math.min(9999, n)) : 0);
              }}
            />

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
        <Text style={styles.hint}>{tr('qty_whyFirst')}</Text>
      </View>

      <View style={styles.footer}>
        <PrimaryButton title={tr('ss_next')} onPress={next} />
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
  summaryTitle: { fontSize: 13, fontWeight: '800', color: Colors.subText, marginTop: 6, marginBottom: 2 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  rowLabel: { fontSize: 14, color: Colors.subText, fontWeight: '600' },
  rowValue: { fontSize: 14, color: Colors.navy, fontWeight: '800', flex: 1, textAlign: 'right' },

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

  quickRow: { flexDirection: 'row', gap: 8, marginTop: 18, flexWrap: 'wrap', justifyContent: 'center' },
  quick: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  quickOn: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  quickText: { fontWeight: '800', color: Colors.navy, fontSize: 14 },
  quickTextOn: { color: Colors.white },

  hint: { fontSize: 13, color: Colors.subText, textAlign: 'center', marginTop: 14, lineHeight: 18 },

  footer: {
    padding: 20,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
