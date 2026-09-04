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
} from 'react-native';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';

import { QUALITY_GRADES, fetchCentreById, CROP_LIST } from '../../services/centres';
import { markPaid } from '../../services/bookings';

export default function MarkPaidScreen({ navigation, route }) {
  const { token } = route.params || {};

  const [centre, setCentre] = useState(null);
  const [centreLoading, setCentreLoading] = useState(true);

  // Prefer the weighed quantity if the weighbridge has recorded it.
  const [qty, setQty] = useState(
    token?.actualQuantity
      ? String(token.actualQuantity)
      : token?.approxQuantityQuintals
      ? String(token.approxQuantityQuintals)
      : '40'
  );

  // Default the rate to the MSP of the crop the farmer booked.
  const defaultRate =
    token?.ratePerQuintal ||
    CROP_LIST.find((c) => c.id === token?.crop)?.msp ||
    2275;

  // Once fixed (MSP / auction) the rate is locked for the cashier.
  const rateLocked = Boolean(token?.ratePerQuintal);

  const [rate, setRate] = useState(String(defaultRate));
  const [grade, setGrade] = useState(token?.grade || 'FAQ');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    fetchCentreById(token?.centreId)
      .then((result) => {
        if (alive) setCentre(result);
      })
      .catch((error) => {
        console.error('Centre load error:', error);
      })
      .finally(() => {
        if (alive) setCentreLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [token?.centreId]);

  const q = parseFloat(qty) || 0;
  const r = parseFloat(rate) || 0;
  const gross = q * r;

  const mandiFee = centre
    ? gross * ((Number(centre.mandiFeePercent) || 0) / 100)
    : 0;

  const commission = centre
    ? gross * ((Number(centre.commissionPercent) || 0) / 100)
    : 0;

  const hamali = centre
    ? q * (Number(centre.hamaliPerQuintal) || 0)
    : 0;

  const net = gross - mandiFee - commission - hamali;

  const submit = async () => {
    if (q <= 0) {
      Alert.alert('मात्रा', 'कृपया सही मात्रा दर्ज करें।');
      return;
    }

    if (r <= 0) {
      Alert.alert('दर', 'कृपया सही दर दर्ज करें।');
      return;
    }

    try {
      setLoading(true);

      await markPaid(token.tokenId, {
        actualQuantity: qty,
        ratePerQuintal: rate,
        grade,
      });

      Alert.alert('सफल', 'रसीद जनरेट हो गई', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('त्रुटि', error?.message || 'भुगतान दर्ज नहीं हुआ।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />

      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle
          title="भुगतान अंतिम"
          subtitle={`टोकन ${token?.tokenNumber || ''} • ${
            token?.farmerName || ''
          }`}
        />

        {centreLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 10 }} />
        ) : !centre ? (
          <Text style={styles.warn}>
            मंडी की जानकारी नहीं मिली। कटौती 0 मानी जाएगी।
          </Text>
        ) : null}

        <Text style={styles.label}>वास्तविक तौल (क्विंटल)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={qty}
          onChangeText={setQty}
        />

        <Text style={styles.label}>ग्रेड</Text>
        <View style={styles.grades}>
          {QUALITY_GRADES.map((g) => (
            <Text
              key={g.id}
              onPress={() => setGrade(g.id)}
              style={[styles.grade, grade === g.id && styles.gradeOn]}
            >
              {g.name}
            </Text>
          ))}
        </View>

        <Text style={styles.label}>
          दर प्रति क्विंटल (₹){rateLocked ? '  • तय भाव, बदला नहीं जा सकता' : ''}
        </Text>
        <TextInput
          style={[styles.input, rateLocked && { opacity: 0.6 }]}
          keyboardType="numeric"
          value={rate}
          onChangeText={setRate}
          editable={!rateLocked}
        />

        <View style={styles.preview}>
          <Text style={styles.previewTitle}>कटौती सहित गणना</Text>

          <Text style={styles.previewRow}>
            कुल राशि: ₹{gross.toFixed(2)}
          </Text>

          <Text style={styles.previewRow}>
            मंडी शुल्क ({centre?.mandiFeePercent || 0}%): −₹
            {mandiFee.toFixed(2)}
          </Text>

          <Text style={styles.previewRow}>
            आढ़त ({centre?.commissionPercent || 0}%): −₹
            {commission.toFixed(2)}
          </Text>

          <Text style={styles.previewRow}>
            हमाली (₹{centre?.hamaliPerQuintal || 0}/क्विंटल): −₹
            {hamali.toFixed(2)}
          </Text>

          <Text style={styles.previewNet}>
            नेट देय: ₹{net.toFixed(2)}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          title="आधिकारिक रसीद बनाएं"
          loading={loading}
          onPress={submit}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 30 },
  warn: {
    backgroundColor: '#FFF3E0',
    color: '#E65100',
    padding: 10,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '700',
  },
  label: {
    fontWeight: '700',
    color: Colors.navy,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 12,
    color: Colors.text,
  },
  grades: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grade: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    color: Colors.subText,
  },
  gradeOn: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
    color: Colors.primary,
    fontWeight: '800',
  },
  preview: {
    marginTop: 18,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    padding: 14,
  },
  previewTitle: { fontWeight: '800', color: Colors.navy, marginBottom: 8 },
  previewRow: { color: Colors.navy, marginBottom: 4, fontSize: 13 },
  previewNet: {
    fontWeight: '900',
    color: Colors.secondary,
    fontSize: 18,
    marginTop: 8,
  },
  footer: {
    padding: 20,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
