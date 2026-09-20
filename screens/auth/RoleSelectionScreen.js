import React from 'react';
import { StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryCard from '../../components/PrimaryCard';
import Colors from '../../theme/colors';
import { useLang } from '../../i18n/LanguageContext';
import { ROLE_ICON } from '../../theme/brand';

export default function RoleSelectionScreen({ navigation }) {
  const { tr } = useLang();
  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack audioKey="audio_role" />
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle title={tr('selectRole')} />
        <PrimaryCard title={tr('roleFarmer')} subtitle={tr('roleFarmerSub')} image={ROLE_ICON.farmer}
          onPress={() => navigation.navigate('UserStatus', { role: 'farmer' })} />
        <PrimaryCard title={tr('roleOfficer')} subtitle={tr('roleOfficerSub')} image={ROLE_ICON.officer}
          onPress={() => navigation.navigate('UserStatus', { role: 'officer' })} />
        {/* install55: the trader tile now registers an ARHTIYA (commission agent).
            Trader auction screens still exist for old accounts; no new traders. */}
        <PrimaryCard title={tr('roleArhtiya')} subtitle={tr('roleArhtiyaSub')} image={ROLE_ICON.trader}
          onPress={() => navigation.navigate('UserStatus', { role: 'arhtiya' })} />
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20 },
});
