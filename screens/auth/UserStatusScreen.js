import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryCard from '../../components/PrimaryCard';
import Colors from '../../theme/colors';
import { useLang } from '../../i18n/LanguageContext';

export default function UserStatusScreen({ navigation, route }) {
  const { tr } = useLang();
  const role = route?.params?.role || 'farmer';
  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />
      <View style={styles.content}>
        <ScreenTitle title={tr('status_title')} subtitle={tr('status_sub')} />
        <PrimaryCard title={tr('login')} subtitle={tr('status_loginSub')}
          icon="log-in-outline" onPress={() => navigation.navigate('Login', { role })} />
        <PrimaryCard title={tr('register')} subtitle={tr('status_registerSub')}
          icon="person-add-outline" onPress={() => navigation.navigate('Register', { role })} />
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, padding: 20 },
});
