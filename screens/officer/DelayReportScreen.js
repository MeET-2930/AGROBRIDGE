/*
 * screens/officer/DelayReportScreen.js   (install52)
 * Admin: broadcast a delay (minutes) - OR declare a YARD INCIDENT
 * (floor full / lifting stopped). The second one asks no minutes:
 * every farmer with a pass today is told the truth and chooses
 * "wait" or "cancel & re-book" (no penalty). See engine/yard.js.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, SafeAreaView, Alert, ScrollView } from 'react-native';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';

import { reportCentreDelay, declareYardIncident } from '../../services/bookings';
import { getCurrentUserSession } from '../../services/auth';

import { useLang } from '../../i18n/LanguageContext';
export default function DelayReportScreen({ navigation }) {
  const { tr, lang, trError } = useLang();
  const [minutes, setMinutes] = useState('20');
  const [reason, setReason] = useState(tr('dl_reasonDefault'));
  const [busy, setBusy] = useState(false);
  const [yardBusy, setYardBusy] = useState(false);

  const submit = async () => {
    setBusy(true);

    try {
      const user = await getCurrentUserSession();

      if (!user?.centreId) {
        Alert.alert(tr('error'), tr('dl_pickFirst'));
        setBusy(false);
        return;
      }

      await reportCentreDelay(user.centreId, minutes, reason);

      Alert.alert(tr('done'), tr('dl_doneSub', { m: minutes }), [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert(tr('error'), trError(error, 'notRecorded'));
    } finally {
      setBusy(false);
    }
  };

  const declareYard = () => {
    Alert.alert(tr('yd_declare'), tr('yd_declareConfirm'), [
      { text: tr('no'), style: 'cancel' },
      {
        text: tr('yes'),
        style: 'destructive',
        onPress: async () => {
          setYardBusy(true);
          try {
            const user = await getCurrentUserSession();
            if (!user?.centreId) { Alert.alert(tr('error'), tr('dl_pickFirst')); return; }
            await declareYardIncident(user.centreId, true, 'floor');
            Alert.alert(tr('done'), tr('dl_yardDone'), [{ text: 'OK', onPress: () => navigation.goBack() }]);
          } catch (error) {
            Alert.alert(tr('error'), trError(error, 'notRecorded'));
          } finally {
            setYardBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />

      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle
          title={tr('dl_title')}
          subtitle={tr('dl_sub')}
        />

        <Text style={styles.label}>{tr('dl_minutes')}</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={minutes}
          onChangeText={setMinutes}
        />

        <Text style={styles.label}>{tr('dl_reason')}</Text>
        <TextInput style={styles.input} value={reason} onChangeText={setReason} />

        <PrimaryButton
          title={tr('dl_submit')}
          variant="danger"
          loading={busy}
          style={{ marginTop: 20 }}
          onPress={submit}
        />

        {/* install52: yard incident (no minutes - the farmer decides) */}
        <View style={styles.yardBox}>
          <Text style={styles.yardTitle}>{tr('yd_title')}</Text>
          <Text style={styles.yardSub}>{tr('dl_yardHint')}</Text>
          <PrimaryButton
            title={tr('dl_yardBtn')}
            variant="danger"
            loading={yardBusy}
            style={{ marginTop: 10 }}
            onPress={declareYard}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  label: { fontWeight: '700', color: Colors.navy, marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 12,
    color: Colors.text,
  },
  yardBox: { marginTop: 28, backgroundColor: Colors.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  yardTitle: { fontWeight: '800', color: Colors.navy, fontSize: 15 },
  yardSub: { color: Colors.subText, fontSize: 12, marginTop: 4, lineHeight: 17 },
});
