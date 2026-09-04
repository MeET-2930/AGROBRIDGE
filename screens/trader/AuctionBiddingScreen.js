import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import AppHeader from '../../components/AppHeader';
import Colors from '../../theme/colors';

export default function AuctionBiddingScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack title="लाइव नीलामी बोलियां" />
      <View style={styles.content}>
        <Text style={styles.title}>मंडी लाइव फसल लॉट</Text>
        <Text style={styles.sub}>वर्तमान में जांचे गए और ग्रेडेड गेहूं/धान के लॉट यहां सूचीबद्ध होंगे</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, alignItems: 'center', justifyContent: 'center', flex: 1 },
  title: { fontSize: 18, fontWeight: '800', color: Colors.navy },
  sub: { fontSize: 13, color: Colors.subText, textAlign: 'center', marginTop: 6 },
});