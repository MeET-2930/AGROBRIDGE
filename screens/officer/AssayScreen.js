import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';

import { QUALITY_GRADES } from '../../services/centres';
import { recordAssay } from '../../services/bookings';

/*
 * Assay = quality inspection at the mandi.
 * The inspector records moisture and foreign matter, assigns a
 * grade, and either passes the lot forward to weighing or
 * rejects it outright.
 */
export default function AssayScreen({ navigation, route }) {
  const { token } = route.params || {};

  const [moisture, setMoisture] = useState('12');
  const [foreign, setForeign] = useState('1');
  const [grade, setGrade] = useState('FAQ');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (rejected) => {
    const m = parseFloat(moisture);
    const f = parseFloat(foreign);

    if (Number.isNaN(m) || m < 0 || m > 100) {
      Alert.alert('नमी', 'कृपया 0 से 100 के बीच सही मान दर्ज करें।');
      return;
    }

    if (Number.isNaN(f) || f < 0 || f > 100) {
      Alert.alert('अन्य पदार्थ', 'कृपया 0 से 100 के बीच सही मान दर्ज करें।');
      return;
    }

    setBusy(true);

    try {
      await recordAssay(token.tokenId, {
        moisturePercent: m,
        foreignMatterPercent: f,
        grade: rejected ? 'REJECTED' : grade,
        notes,
        rejected,
      });

      Alert.alert(
        rejected ? 'अस्वीकृत' : 'दर्ज हो गया',
        rejected
          ? 'यह लॉट अस्वीकृत कर दिया गया।'
          : 'अब वाहन को तौल के लिए भेजें।',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('त्रुटि', error?.message || 'दर्ज नहीं हुआ।');
    } finally {
      setBusy(false);
    }
  };

  const confirmReject = () => {
    Alert.alert('लॉट अस्वीकार करें?', 'किसान को भुगतान नहीं होगा।', [
      { text: 'रद्द', style: 'cancel' },
      { text: 'हाँ, अस्वीकार', style: 'destructive', onPress: () => submit(true) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />

      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle
          title="गुणवत्ता जांच"
          subtitle={`टोकन ${token?.tokenNumber || ''} • ${token?.farmerName || ''}`}
        />

        <View style={styles.info}>
          <Text style={styles.infoText}>
            फसल: {String(token?.cropName || token?.crop || '').toUpperCase()}
          </Text>
          <Text style={styles.infoText}>
            वाहन: {token?.vehicleNumber || '—'}
          </Text>
        </View>

        <Text style={styles.label}>नमी % (Moisture)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={moisture}
          onChangeText={setMoisture}
          placeholder="12"
          placeholderTextColor="#999"
        />
        <Text style={styles.hint}>
          गेहूँ के लिए सामान्य सीमा 12% तक
        </Text>

        <Text style={styles.label}>अन्य पदार्थ % (Foreign Matter)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={foreign}
          onChangeText={setForeign}
          placeholder="1"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>ग्रेड</Text>
        <View style={styles.grades}>
          {QUALITY_GRADES.filter((g) => g.id !== 'REJECTED').map((g) => (
            <TouchableOpacity
              key={g.id}
              onPress={() => setGrade(g.id)}
              style={[styles.grade, grade === g.id && styles.gradeOn]}
            >
              <Text
                style={[
                  styles.gradeText,
                  grade === g.id && styles.gradeTextOn,
                ]}
              >
                {g.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>टिप्पणी (वैकल्पिक)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="कोई विशेष बात"
          placeholderTextColor="#999"
        />
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          title="अस्वीकार करें"
          variant="danger"
          onPress={confirmReject}
          disabled={busy}
          style={{ marginBottom: 10 }}
        />

        <PrimaryButton
          title="जांच पूरी - तौल पर भेजें"
          loading={busy}
          onPress={() => submit(false)}
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
    height: 48,
    paddingHorizontal: 12,
    color: Colors.text,
    fontWeight: '700',
  },
  textArea: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
  hint: { fontSize: 11, color: Colors.subText, marginTop: 4 },
  grades: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grade: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  gradeOn: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  gradeText: { color: Colors.subText, fontWeight: '700' },
  gradeTextOn: { color: Colors.primary, fontWeight: '900' },
  footer: {
    padding: 20,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
