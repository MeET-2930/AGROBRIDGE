import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';

import { recordWeighing } from '../../services/bookings';

/*
 * Weighbridge: gross weight (loaded vehicle) minus tare weight
 * (empty vehicle) gives the net crop quantity that the farmer
 * is actually paid for.
 */
export default function WeighingScreen({ navigation, route }) {
  const { token } = route.params || {};

  const [gross, setGross] = useState(
    token?.approxQuantityQuintals
      ? String(token.approxQuantityQuintals)
      : ''
  );

  const [tare, setTare] = useState('0');
  const [busy, setBusy] = useState(false);

  const g = parseFloat(gross) || 0;
  const t = parseFloat(tare) || 0;
  const net = Math.round((g - t) * 100) / 100;

  const approx = Number(token?.approxQuantityQuintals) || 0;

  const variance =
    approx > 0 ? Math.round(((net - approx) / approx) * 100) : 0;

  const bigVariance = approx > 0 && Math.abs(variance) > 20;

  const submit = async () => {
    if (net <= 0) {
      Alert.alert('वजन', 'शुद्ध वजन शून्य से अधिक होना चाहिए।');
      return;
    }

    setBusy(true);

    try {
      await recordWeighing(token.tokenId, {
        grossWeightQuintals: g,
        tareWeightQuintals: t,
      });

      Alert.alert('दर्ज हो गया', 'अब भुगतान की प्रक्रिया करें।', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('त्रुटि', error?.message || 'दर्ज नहीं हुआ।');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />

      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle
          title="तौल (Weighbridge)"
          subtitle={`टोकन ${token?.tokenNumber || ''} • ${token?.farmerName || ''}`}
        />

        <View style={styles.info}>
          <Text style={styles.infoText}>
            किसान द्वारा बताई मात्रा: {approx} क्विंटल
          </Text>
          <Text style={styles.infoText}>
            ग्रेड: {token?.grade || '—'}
          </Text>
        </View>

        <Text style={styles.label}>कुल वजन / भरा वाहन (क्विंटल)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={gross}
          onChangeText={setGross}
          placeholder="0"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>खाली वाहन का वजन (क्विंटल)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={tare}
          onChangeText={setTare}
          placeholder="0"
          placeholderTextColor="#999"
        />
        <Text style={styles.hint}>
          यदि केवल फसल तौली गई है तो 0 रखें
        </Text>

        <View style={styles.netBox}>
          <Text style={styles.netLabel}>शुद्ध वजन</Text>
          <Text style={styles.netValue}>{net} क्विंटल</Text>

          {approx > 0 ? (
            <Text
              style={[styles.variance, bigVariance && styles.varianceWarn]}
            >
              बताई मात्रा से {variance > 0 ? '+' : ''}
              {variance}%
            </Text>
          ) : null}
        </View>

        {bigVariance ? (
          <Text style={styles.warn}>
            चेतावनी: बताई गई मात्रा से 20% से अधिक अंतर है। कृपया दोबारा जांचें।
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          title="तौल दर्ज करें"
          loading={busy}
          disabled={net <= 0}
          onPress={submit}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 30 },
  info: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  infoText: { color: Colors.navy, fontWeight: '700', fontSize: 12 },
  label: {
    fontWeight: '700',
    color: Colors.navy,
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    height: 52,
    paddingHorizontal: 12,
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  hint: { fontSize: 11, color: Colors.subText, marginTop: 4 },
  netBox: {
    marginTop: 22,
    backgroundColor: Colors.navy,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  netLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '700',
  },
  netValue: {
    color: Colors.white,
    fontSize: 32,
    fontWeight: '900',
    marginTop: 4,
  },
  variance: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    marginTop: 6,
    fontWeight: '700',
  },
  varianceWarn: { color: '#FFD54F' },
  warn: {
    marginTop: 12,
    backgroundColor: '#FFF3E0',
    color: '#E65100',
    padding: 12,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    padding: 20,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
