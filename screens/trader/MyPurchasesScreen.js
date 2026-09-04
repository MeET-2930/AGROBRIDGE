import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import AppHeader from '../../components/AppHeader';
import Colors from '../../theme/colors';

export default function MyPurchasesScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack title="मेरी खरीदारी" />
      <View style={styles.content}>
        <Text style={styles.title}>सफल नीलामी खरीद रिकॉर्ड</Text>
        <Text style={styles.sub}>आपके द्वारा जीती गई फसलों और भुगतान स्थिति का इतिहास</Text>
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