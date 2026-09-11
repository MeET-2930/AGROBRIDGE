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

import { QUALITY_GRADES, cropLabel } from '../../services/centres';
import { recordAssay } from '../../services/bookings';

import { useLang } from '../../i18n/LanguageContext';
/*
 * Assay = quality inspection at the mandi.
 * The inspector records moisture and foreign matter, assigns a
 * grade, and either passes the lot forward to weighing or
 * rejects it outright.
 */
export default function AssayScreen({ navigation, route }) {
  const { tr, lang, trError } = useLang();
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
      Alert.alert(tr('moisture'), tr('as_range'));
      return;
    }

    if (Number.isNaN(f) || f < 0 || f > 100) {
      Alert.alert(tr('foreignMatter'), tr('as_range'));
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
        rejected ? tr('as_rejected') : tr('recorded'),
        rejected ? tr('as_rejectedSub') : tr('as_recordedSub'),
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert(tr('error'), trError(error, 'notRecorded'));
    } finally {
      setBusy(false);
    }
  };

  const confirmReject = () => {
    Alert.alert(tr('as_rejectQ'), tr('as_rejectQSub'), [
      { text: tr('cancel'), style: 'cancel' },
      { text: tr('as_yesReject'), style: 'destructive', onPress: () => submit(true) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />

      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle
          title={tr('as_title')}
          subtitle={tr('tokenAndName', { t: token?.tokenNumber || '', n: token?.farmerName || '' })}
        />

        <View style={styles.info}>
          <Text style={styles.infoText}>
            {tr('as_cropLine', { c: cropLabel(token, lang) })}
          </Text>
          <Text style={styles.infoText}>
            {tr('as_vehicleLine', { v: token?.vehicleNumber || '—' })}
          </Text>
        </View>

        <Text style={styles.label}>{tr('as_moisture')}</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={moisture}
          onChangeText={setMoisture}
          placeholder="12"
          placeholderTextColor="#999"
        />
        <Text style={styles.hint}>
          {tr('as_moistureHint')}
        </Text>

        <Text style={styles.label}>{tr('as_foreign')}</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={foreign}
          onChangeText={setForeign}
          placeholder="1"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>{tr('grade')}</Text>
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
                {tr(g.nameKey || g.name)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>{tr('as_notes')}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder={tr('as_notesPh')}
          placeholderTextColor="#999"
        />
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          title={tr('as_rejectBtn')}
          variant="danger"
          onPress={confirmReject}
          disabled={busy}
          style={{ marginBottom: 10 }}
        />

        <PrimaryButton
          title={tr('as_submit')}
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
  infoText: { color: Colors.navy, fontWeight: '700', fontSize: 13 },
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
  hint: { fontSize: 12, color: Colors.subText, marginTop: 4 },
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
