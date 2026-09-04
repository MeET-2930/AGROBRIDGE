import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../../components/AppHeader';
import DashboardCard from '../../components/DashboardCard';
import Colors from '../../theme/colors';
import { useLang } from '../../i18n/LanguageContext';

export default function TraderDashboard({ navigation }) {
  const { tr } = useLang();
  const [profileModalVisible, setProfileModalVisible] = useState(false);

  const handleLogout = () => {
    setProfileModalVisible(false);
    navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Auth' }] });
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack={false} tag="व्यापारी एवं आढ़तिया पोर्टल" />
      <ScrollView contentContainerStyle={styles.content}>
        
        <View style={styles.profileRow}>
          <View>
            <Text style={styles.greetingText}>{tr('namaste')} 🙏</Text>
            <Text style={styles.nameText}>रामलाल आढ़तिया (TRD-9921)</Text>
            <Text style={styles.subText}>खन्ना अनाज मंडी यार्ड</Text>
          </View>
          <TouchableOpacity onPress={() => setProfileModalVisible(true)}>
            <Ionicons name="person-circle-outline" size={40} color={Colors.navy} />
          </TouchableOpacity>
        </View>

        {/* Live Bidding Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>आज की मंडी बोली और नीलामी</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>12</Text>
              <Text style={styles.statLabel}>उपलब्ध लॉट (Lots)</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: Colors.primary }]}>4</Text>
              <Text style={styles.statLabel}>सक्रिय बोलियां</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>व्यापारी सेवाएं</Text>

        <View style={styles.gridContainer}>
          <DashboardCard
            title="लाइव फसल बोली"
            icon="cash-outline"
            badge="LIVE"
            onPress={() => navigation.navigate('AuctionBidding')}
          />
          <DashboardCard
            title="मेरी खरीदारी"
            icon="bag-check-outline"
            onPress={() => navigation.navigate('MyPurchases')}
          />
          <DashboardCard
            title="मंडी भाव सूची"
            icon="trending-up-outline"
            onPress={() => {}}
          />
          <DashboardCard
            title="सहायता केंद्र"
            icon="call-outline"
            onPress={() => {}}
          />
        </View>
      </ScrollView>

      {/* Logout Modal */}
      <Modal visible={profileModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setProfileModalVisible(false)}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.logoutOption} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color={Colors.error} />
              <Text style={styles.logoutText}>{tr('logout')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 18 },
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  greetingText: { fontSize: 12, color: Colors.subText, fontWeight: '600' },
  nameText: { fontSize: 18, fontWeight: '800', color: Colors.navy },
  subText: { fontSize: 12, color: Colors.primary, fontWeight: '700', marginTop: 2 },
  summaryCard: { backgroundColor: Colors.navy, borderRadius: 16, padding: 18, marginBottom: 20 },
  summaryTitle: { color: Colors.white, fontSize: 14, fontWeight: '700', marginBottom: 12 },
  summaryGrid: { flexDirection: 'row', gap: 12 },
  statBox: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 10, flex: 1 },
  statNum: { color: Colors.white, fontSize: 24, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.navy, marginBottom: 12 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: Colors.white, borderRadius: 16, padding: 20 },
  logoutOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logoutText: { fontSize: 16, fontWeight: '700', color: Colors.error },
});