/*
 * screens/officer/MarkPaidScreen.js  -  APMC cashier: final payment
 * ---------------------------------------------------------------
 * The cashier states HOW the price was decided (payment basis):
 *   msp      government purchase at MSP           -> no parchi
 *   ebid     bid placed inside the app            -> no parchi
 *   offline  bid held physically by the arhtiya   -> munim's PARCHI
 *            photo is MANDATORY (farmer's 2nd confirmation)
 * ---------------------------------------------------------------
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';

import { QUALITY_GRADES, fetchCentreById, CROP_LIST } from '../../services/centres';
import { markPaid } from '../../services/bookings';
import { getCurrentUserSession } from '../../services/auth';
import { useLang } from '../../i18n/LanguageContext';

const BASES = [
  { id: 'msp', icon: 'shield-checkmark-outline', t: 'pb_msp', d: 'pb_msp_d' },
  { id: 'ebid', icon: 'phone-portrait-outline', t: 'pb_ebid', d: 'pb_ebid_d' },
  { id: 'offline', icon: 'receipt-outline', t: 'pb_offline', d: 'pb_offline_d' },
];

/* Shrink the photo so it fits comfortably in a Firestore document. */
async function compressToDataUri(uri) {
  const out = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1000 } }],
    { compress: 0.55, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  return `data:image/jpeg;base64,${out.base64}`;
}

export default function MarkPaidScreen({ navigation, route }) {
  const { tr, lang, trError } = useLang();
  const { token } = route.params || {};

  const [centre, setCentre] = useState(null);
  const [centreLoading, setCentreLoading] = useState(true);
  const [session, setSession] = useState(null);

  const [qty, setQty] = useState(
    token?.actualQuantity
      ? String(token.actualQuantity)
      : token?.approxQuantityQuintals
      ? String(token.approxQuantityQuintals)
      : '40'
  );

  const defaultRate =
    token?.ratePerQuintal ||
    CROP_LIST.find((c) => c.id === token?.crop)?.msp ||
    2275;
  const rateLocked = Boolean(token?.ratePerQuintal);

  const [rate, setRate] = useState(String(defaultRate));
  const [grade, setGrade] = useState(token?.grade || 'FAQ');
  const [loading, setLoading] = useState(false);

  // Payment basis - pre-selected from what the app already knows.
  const [basis, setBasis] = useState(token?.priceMode === 'auction' ? 'ebid' : 'msp');

  // Munim's parchi (offline bids only)
  const [parchiUri, setParchiUri] = useState(null);
  const [parchiRate, setParchiRate] = useState('');
  const [parchiNote, setParchiNote] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getCurrentUserSession().then((s) => alive && setSession(s));
    fetchCentreById(token?.centreId)
      .then((result) => alive && setCentre(result))
      .catch((error) => console.error('Centre load error:', error))
      .finally(() => alive && setCentreLoading(false));
    return () => { alive = false; };
  }, [token?.centreId]);

  const q = parseFloat(qty) || 0;
  const r = parseFloat(rate) || 0;
  const gross = q * r;
  const mandiFee = centre ? gross * ((Number(centre.mandiFeePercent) || 0) / 100) : 0;
  const commission = centre ? gross * ((Number(centre.commissionPercent) || 0) / 100) : 0;
  const hamali = centre ? q * (Number(centre.hamaliPerQuintal) || 0) : 0;
  const net = gross - mandiFee - commission - hamali;

  const pr = parseFloat(parchiRate) || 0;
  const parchiMatches = pr > 0 && Math.abs(pr - r) < 0.5;

  /* ---------- photo ---------- */
  const pickPhoto = async (fromCamera) => {
    setPhotoBusy(true);
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(tr('error'), tr('pc_camPerm'));
        return;
      }
      const opts = { quality: 0.8, allowsEditing: false, mediaTypes: ['images'] };
      const res = fromCamera
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.[0]?.uri) return;
      setParchiUri(res.assets[0].uri);
    } catch (error) {
      console.error('Parchi photo error:', error);
      Alert.alert(tr('error'), tr('pc_photoFail'));
    } finally {
      setPhotoBusy(false);
    }
  };

  /* ---------- submit ---------- */
  const submit = async () => {
    if (q <= 0) { Alert.alert(tr('quantity'), tr('mp_badQty')); return; }
    if (r <= 0) { Alert.alert(tr('rate'), tr('mp_badRate')); return; }

    let parchi = null;
    if (basis === 'offline') {
      if (!parchiUri) { Alert.alert(tr('pc_title'), tr('pc_needPhoto')); return; }
      if (pr <= 0) { Alert.alert(tr('pc_title'), tr('pc_needRate')); return; }
    }

    try {
      setLoading(true);
      if (basis === 'offline') {
        const imageBase64 = await compressToDataUri(parchiUri);
        parchi = { imageBase64, rate: pr, note: parchiNote.trim() };
      }

      await markPaid(token.tokenId, {
        actualQuantity: qty,
        ratePerQuintal: rate,
        grade,
        paymentBasis: basis,
        parchi,
        cashierName: session?.name || null,
      });

      Alert.alert(tr('mp_success'), tr('mp_successSub'), [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert(tr('error'), trError(error, 'mp_fail'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenTitle
          title={tr('mp_title')}
          subtitle={tr('tokenAndName', { t: token?.tokenNumber || '', n: token?.farmerName || '' })}
        />

        {centreLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 10 }} />
        ) : !centre ? (
          <Text style={styles.warn}>{tr('mp_noCentre')}</Text>
        ) : null}

        {/* ---------- Payment basis ---------- */}
        <Text style={styles.label}>{tr('pb_title')}</Text>
        <Text style={styles.hint}>{tr('pb_hint')}</Text>
        {BASES.map((b) => {
          const on = basis === b.id;
          return (
            <TouchableOpacity
              key={b.id}
              style={[styles.basis, on && styles.basisOn]}
              onPress={() => setBasis(b.id)}
              activeOpacity={0.85}
            >
              <Ionicons name={b.icon} size={22} color={on ? Colors.primary : Colors.subText} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.basisTitle, on && { color: Colors.primary }]}>{tr(b.t)}</Text>
                <Text style={styles.basisDesc}>{tr(b.d)}</Text>
              </View>
              <Ionicons
                name={on ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={on ? Colors.primary : Colors.border}
              />
            </TouchableOpacity>
          );
        })}

        {/* ---------- Munim's parchi (offline only) ---------- */}
        {basis === 'offline' ? (
          <View style={styles.parchiBox}>
            <Text style={styles.parchiTitle}>{tr('pc_title')}</Text>
            <Text style={styles.hint}>{tr('pc_hint')}</Text>

            {parchiUri ? (
              <>
                <Image source={{ uri: parchiUri }} style={styles.parchiImg} resizeMode="contain" />
                <View style={styles.parchiRow}>
                  <TouchableOpacity style={styles.smallBtn} onPress={() => pickPhoto(true)}>
                    <Ionicons name="camera-outline" size={16} color={Colors.navy} />
                    <Text style={styles.smallBtnText}>{tr('pc_retake')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.smallBtn} onPress={() => setParchiUri(null)}>
                    <Ionicons name="trash-outline" size={16} color={Colors.error} />
                    <Text style={[styles.smallBtnText, { color: Colors.error }]}>{tr('pc_remove')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.parchiRow}>
                <PrimaryButton
                  title={tr('pc_takePhoto')}
                  loading={photoBusy}
                  onPress={() => pickPhoto(true)}
                  style={{ flex: 1, height: 46 }}
                />
                <TouchableOpacity style={styles.smallBtn} onPress={() => pickPhoto(false)} disabled={photoBusy}>
                  <Ionicons name="images-outline" size={16} color={Colors.navy} />
                  <Text style={styles.smallBtnText}>{tr('pc_gallery')}</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.label}>{tr('pc_rate')}</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={parchiRate}
              onChangeText={setParchiRate}
              placeholder={String(defaultRate)}
              placeholderTextColor="#999"
            />
            {pr > 0 ? (
              <Text style={[styles.matchText, parchiMatches ? styles.matchOk : styles.matchBad]}>
                {parchiMatches ? tr('pc_match') : tr('pc_mismatch', { a: pr, b: r })}
              </Text>
            ) : null}

            <Text style={styles.label}>{tr('pc_note')}</Text>
            <TextInput
              style={styles.input}
              value={parchiNote}
              onChangeText={setParchiNote}
              placeholder={tr('pc_notePh')}
              placeholderTextColor="#999"
            />
          </View>
        ) : null}

        {/* ---------- Quantity / grade / rate ---------- */}
        <Text style={styles.label}>{tr('mp_actualQty')}</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={qty}
          onChangeText={setQty}
        />

        <Text style={styles.label}>{tr('grade')}</Text>
        <View style={styles.grades}>
          {QUALITY_GRADES.filter((g) => g.id !== 'REJECTED').map((g) => (
            <Text
              key={g.id}
              onPress={() => setGrade(g.id)}
              style={[styles.grade, grade === g.id && styles.gradeOn]}
            >
              {tr(g.nameKey || g.name)}
            </Text>
          ))}
        </View>

        <Text style={styles.label}>
          {tr('mp_rate')}{rateLocked ? '  ' + tr('mp_rateLocked') : ''}
        </Text>
        <TextInput
          style={[styles.input, rateLocked && { backgroundColor: '#F3F4F6', color: Colors.subText }]}
          keyboardType="numeric"
          value={rate}
          onChangeText={setRate}
          editable={!rateLocked}
        />

        <View style={styles.preview}>
          <Text style={styles.previewTitle}>{tr('mp_preview')}</Text>
          <Text style={styles.previewRow}>{tr('mp_gross', { n: gross.toFixed(2) })}</Text>
          <Text style={styles.previewRow}>
            {tr('mp_fee', { p: centre?.mandiFeePercent || 0, n: mandiFee.toFixed(2) })}
          </Text>
          <Text style={styles.previewRow}>
            {tr('mp_comm', { p: centre?.commissionPercent || 0, n: commission.toFixed(2) })}
          </Text>
          <Text style={styles.previewRow}>
            {tr('mp_hamali', { p: centre?.hamaliPerQuintal || 0, n: hamali.toFixed(2) })}
          </Text>
          <Text style={styles.previewNet}>{tr('mp_net', { n: net.toFixed(2) })}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          title={tr('mp_submit')}
          loading={loading}
          onPress={submit}
          disabled={basis === 'offline' && !parchiUri}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 30 },
  warn: { backgroundColor: '#FFF3E0', color: '#E65100', padding: 10, borderRadius: 8, fontSize: 12, fontWeight: '700' },
  label: { fontWeight: '700', color: Colors.navy, marginTop: 12, marginBottom: 6 },
  hint: { fontSize: 12, color: Colors.subText, marginBottom: 8, lineHeight: 17 },
  input: {
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    height: 48, paddingHorizontal: 12, color: Colors.text,
  },
  basis: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, padding: 12, marginBottom: 8,
  },
  basisOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  basisTitle: { fontWeight: '800', color: Colors.navy, fontSize: 14 },
  basisDesc: { fontSize: 11, color: Colors.subText, marginTop: 2 },
  parchiBox: {
    marginTop: 6, backgroundColor: '#FFFBEB', borderWidth: 1.5, borderColor: '#F59E0B',
    borderRadius: 12, padding: 14,
  },
  parchiTitle: { fontWeight: '900', color: '#92400E', fontSize: 15, marginBottom: 4 },
  parchiImg: { width: '100%', height: 260, borderRadius: 10, backgroundColor: '#111', marginBottom: 8 },
  parchiRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  smallBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 46,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  smallBtnText: { fontWeight: '700', color: Colors.navy, fontSize: 12 },
  matchText: { marginTop: 6, fontSize: 12, fontWeight: '700', padding: 8, borderRadius: 8 },
  matchOk: { backgroundColor: '#DCFCE7', color: '#166534' },
  matchBad: { backgroundColor: '#FEE2E2', color: '#991B1B' },
  grades: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grade: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
    borderColor: Colors.border, overflow: 'hidden', color: Colors.subText,
  },
  gradeOn: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary, color: Colors.primary, fontWeight: '800' },
  preview: { marginTop: 18, backgroundColor: Colors.accent, borderRadius: 12, padding: 14 },
  previewTitle: { fontWeight: '800', color: Colors.navy, marginBottom: 8 },
  previewRow: { color: Colors.navy, marginBottom: 4, fontSize: 13 },
  previewNet: { fontWeight: '900', color: Colors.secondary, fontSize: 18, marginTop: 8 },
  footer: { padding: 20, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border },
});
