import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, SafeAreaView, Alert } from 'react-native';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';

import { reportCentreDelay } from '../../services/bookings';
import { getCurrentUserSession } from '../../services/auth';

import { useLang } from '../../i18n/LanguageContext';
export default function DelayReportScreen({ navigation }) {
  const { tr, lang, trError } = useLang();
  const [minutes, setMinutes] = useState('20');
  const [reason, setReason] = useState(tr('dl_reasonDefault'));
  const [busy, setBusy] = useState(false);

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

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />

      <View style={styles.content}>
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20 },
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
});
