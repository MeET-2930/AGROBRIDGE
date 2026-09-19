/*
 * screens/officer/GateRebookScreen.js  (install42)
 * ---------------------------------------------------------------
 * BOOK AT GATE - one screen for two people:
 *   - the walk-in who never booked
 *   - the farmer whose hour has passed (route.params.previous)
 *
 * The gate officer enters phone, crop and quintals; the SAME planner
 * the app uses finds the earliest hour TODAY with room for that load
 * and issues a fresh pass. Nobody already booked is moved. The farmer
 * waits outside for that hour like everyone else - the only way in is
 * a pass, and you get one here.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';

import { rebookAtGate, passLabel } from '../../services/bookings';
import { getCurrentUserSession } from '../../services/auth';
import { CROP_LIST, cropLabel } from '../../services/centres';
import { useLang } from '../../i18n/LanguageContext';

const QUICK = [5, 10, 20, 50];

export default function GateRebookScreen({ navigation, route }) {
  const { tr, lang, trError } = useLang();
  const previous = route.params?.previous || null;

  const [phone, setPhone] = useState(previous?.farmerPhone || '');
  const [name, setName] = useState(previous?.farmerName || '');
  const [crop, setCrop] = useState(
    CROP_LIST.find((c) => c.id === previous?.crop) || CROP_LIST[0]
  );
  const [quantity, setQuantity] = useState(Number(previous?.approxQuantityQuintals) || 10);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [isNow, setIsNow] = useState(false);   // install53: spare-room "Now" pass

  const change = (d) => setQuantity((q) => Math.max(1, Math.min(999, q + d)));

  const submit = async () => {
    const digits = String(phone).replace(/\D/g, '').slice(-10);
    if (digits.length !== 10) {
      Alert.alert(tr('login_mobile'), tr('gr_enterPhone'));
      return;
    }
    const session = await getCurrentUserSession();
    if (!session?.centreId) {
      Alert.alert(tr('loginRequired'), tr('loginAgain'));
      return;
    }
    setBusy(true);
    try {
      const out = await rebookAtGate({
        centreId: session.centreId,
        farmerId: previous?.farmerId || digits,
        farmerName: name || previous?.farmerName || '',
        farmerPhone: digits,
        crop: crop.id,
        cropName: crop.name,
        quintals: quantity,
        previousTokenId: previous?.tokenId || null,
      });
      if (!out.booking) {
        Alert.alert(tr('gr_noRoom'), tr('gr_noRoomSub', { q: quantity }));
        return;
      }
      setIsNow(Boolean(out.now));
      setResult(out.booking);
    } catch (error) {
      Alert.alert(tr('error'), trError(error, 'ss_bookFailSub'));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader navigation={navigation} showBack title={tr('gr_title')} />
        <View style={styles.done}>
          <Ionicons name="checkmark-circle" size={64} color="#16A34A" />
          <Text style={styles.doneTitle}>{isNow ? tr('gr_nowPass') : tr('gr_done')}</Text>
          <Text style={styles.doneSlot}>{passLabel(result)}</Text>
          {isNow ? <Text style={[styles.doneHint, { color: '#166534', fontWeight: '800' }]}>{tr('gr_nowHint')}</Text> : null}
          <Text style={styles.doneSub}>{result.date}</Text>
          <Text style={styles.doneCode}>{tr('gr_tellFarmer', { code: String(result.gatePassCode).replace(/(\d{3})(\d{3})/, '$1 $2') })}</Text>
          <Text style={styles.doneHint}>{tr('gr_waitHint', { t: result.arriveAt || passLabel(result) })}</Text>
          <PrimaryButton title={tr('back')} onPress={() => navigation.goBack()} style={{ marginTop: 20, alignSelf: 'stretch' }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack title={tr('gr_title')} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenTitle
          title={previous ? tr('gr_lateTitle') : tr('gr_walkTitle')}
          subtitle={previous ? tr('gr_lateSub', { t: passLabel(previous) }) : tr('gr_walkSub')}
        />

        <Text style={styles.label}>{tr('login_mobile')}</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="98XXXXXXXX"
          placeholderTextColor="#999"
          editable={!previous}
        />

        <Text style={styles.label}>{tr('name')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={tr('farmer')}
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>{tr('crop')}</Text>
        <View style={styles.chips}>
          {CROP_LIST.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.chip, crop.id === c.id && styles.chipOn]}
              onPress={() => setCrop(c)}
            >
              <Text style={[styles.chipText, crop.id === c.id && styles.chipTextOn]}>{cropLabel(c.id, lang)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>{tr('qty_title')}</Text>
        <View style={styles.qtyRow}>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => change(-1)} onLongPress={() => change(-5)}>
            <Text style={styles.qtyBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.qtyValue}>{quantity}</Text>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => change(1)} onLongPress={() => change(5)}>
            <Text style={styles.qtyBtnText}>+</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.chips}>
          {QUICK.map((n) => (
            <TouchableOpacity key={n} style={[styles.chip, quantity === n && styles.chipOn]} onPress={() => setQuantity(n)}>
              <Text style={[styles.chipText, quantity === n && styles.chipTextOn]}>{n} {tr('quintalShort')}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.note}>{tr('gr_note')}</Text>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton title={tr('gr_find')} onPress={submit} loading={busy} disabled={busy} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 30 },
  label: { marginTop: 14, fontWeight: '800', color: Colors.navy, fontSize: 13 },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 17,
    fontWeight: '700',
    color: Colors.navy,
    marginTop: 6,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  chipOn: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText: { fontWeight: '800', color: Colors.navy, fontSize: 13 },
  chipTextOn: { color: Colors.white },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginTop: 8 },
  qtyBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 30, fontWeight: '800', color: Colors.navy, lineHeight: 34 },
  qtyValue: { minWidth: 90, textAlign: 'center', fontSize: 40, fontWeight: '900', color: Colors.navy },
  note: { marginTop: 18, color: Colors.subText, fontSize: 13, lineHeight: 18 },
  footer: { padding: 20, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  doneTitle: { fontSize: 20, fontWeight: '900', color: Colors.navy, marginTop: 10 },
  doneSlot: { fontSize: 28, fontWeight: '900', color: Colors.primary, marginTop: 10 },
  doneSub: { color: Colors.subText, fontWeight: '700' },
  doneCode: { marginTop: 16, fontSize: 16, fontWeight: '800', color: Colors.navy, textAlign: 'center' },
  doneHint: { marginTop: 8, color: Colors.subText, textAlign: 'center', lineHeight: 20 },
});
