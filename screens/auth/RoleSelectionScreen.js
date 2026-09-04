import React from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryCard from '../../components/PrimaryCard';
import Colors from '../../theme/colors';
import { useLang } from '../../i18n/LanguageContext';

export default function RoleSelectionScreen({ navigation }) {
  const { tr } = useLang();
  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack audioKey="audio_role" />
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle title={tr('selectRole') || 'अपनी भूमिका चुनें'} />
        <PrimaryCard title={tr('roleFarmer') || 'किसान'} subtitle={tr('roleFarmerSub')} icon="leaf-outline"
          onPress={() => navigation.navigate('UserStatus', { role: 'farmer' })} />
        <PrimaryCard title={tr('roleOfficer') || 'मंडी अधिकारी'} subtitle={tr('roleOfficerSub')} icon="shield-checkmark-outline"
          onPress={() => navigation.navigate('UserStatus', { role: 'officer' })} />
        <PrimaryCard title={tr('roleTrader') || 'व्यापारी'} subtitle={tr('roleTraderSub')} icon="cart-outline"
          onPress={() => navigation.navigate('UserStatus', { role: 'trader' })} />
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20 },
});