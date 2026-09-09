import React, { useState, useCallback, useEffect, useRef } from 'react';

import {
  Alert,
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  RefreshControl,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import DashboardCard from '../../components/DashboardCard';
import QueueStatusCard from '../../components/QueueStatusCard';
import PrimaryButton from '../../components/PrimaryButton';

import Colors from '../../theme/colors';
import { useLang } from '../../i18n/LanguageContext';
import { cropLabel } from '../../services/centres';
import { requestCallback, warmUpIvr } from '../../services/ivr';
import { IVR_BASE_URL } from '../../services/config';

import {
  fetchActiveFarmerBooking,
  subscribeToBooking,
  subscribeToQueue,
  buildQueueView,
} from '../../services/bookings';

import {
  getCurrentUserSession,
  logoutUserSession,
} from '../../services/auth';

export default function FarmerDashboard({ navigation }) {
  const { tr, lang } = useLang();

  const [session, setSession] = useState(null);
  const [booking, setBooking] = useState(null);
  const [queue, setQueue] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Holds the two live listeners so we can tear them down cleanly.
  const unsubBooking = useRef(null);
  const unsubQueue = useRef(null);

  const stopListening = () => {
    if (unsubBooking.current) {
      unsubBooking.current();
      unsubBooking.current = null;
    }

    if (unsubQueue.current) {
      unsubQueue.current();
      unsubQueue.current = null;
    }
  };

  /*
   * Find the farmer's active booking once, then attach two
   * realtime listeners:
   *
   *   1. the farmer's own booking document
   *   2. the centre's single live queue document
   *
   * Everything on screen updates from those two, with no polling
   * and without ever reading another farmer's booking.
   */
  const load = async () => {
    const user = await getCurrentUserSession();
    setSession(user);

    if (!user?.uid) {
      stopListening();
      setBooking(null);
      setQueue(null);
      return;
    }

    const active = await fetchActiveFarmerBooking(user.uid);

    stopListening();

    if (!active) {
      setBooking(null);
      setQueue(null);
      return;
    }

    setBooking(active);

    unsubBooking.current = subscribeToBooking(active.tokenId, (fresh) => {
      if (fresh) setBooking(fresh);
    });

    unsubQueue.current = subscribeToQueue(
      active.centreId,
      active.date,
      (fresh) => setQueue(fresh)
    );
  };

  useFocusEffect(
    useCallback(() => {
      load();
      return () => stopListening();
    }, [])
  );

  useEffect(() => stopListening, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const logout = async () => {
    setProfileOpen(false);
    stopListening();
    await logoutUserSession();

    navigation.getParent()?.reset({
      index: 0,
      routes: [{ name: 'Auth' }],
    });
  };

  const callMe = () => {
    if (!session?.phone) return;
    warmUpIvr();
    Alert.alert(tr('ivr_callMe'), tr('ivr_callMeSub', { phone: session.phone }), [
      { text: tr('cancel'), style: 'cancel' },
      {
        text: tr('ivr_callNow'),
        onPress: async () => {
          try {
            await requestCallback(session.phone, lang);
            Alert.alert(tr('ivr_calling'), tr('ivr_callingSub'));
          } catch (e) {
            Alert.alert(tr('error'), tr('ivr_callFail'));
          }
        },
      },
    ]);
  };

  const queueView = booking ? buildQueueView(booking, queue) : null;

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        navigation={navigation}
        showBack={false}
        audioKey="audio_farmer_dashboard"
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
          />
        }
      >
        <View style={styles.profileRow}>
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => setProfileOpen(true)}
          >
            <Ionicons name="person" size={24} color={Colors.white} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.greet}>{tr('namaste')} 🙏</Text>
            <Text style={styles.name}>{session?.name || tr('farmer')}</Text>
            <Text style={styles.phone}>+91 {session?.phone || ''}</Text>
          </View>
        </View>

        {booking ? (
          <>
            {/* The live traffic light */}
            <QueueStatusCard
              view={queueView}
              token={booking.tokenNumber}
              onPress={() =>
                navigation.navigate('TokenDetail', {
                  tokenId: booking.tokenId,
                })
              }
            />

            <View style={styles.bookingCard}>
              <Text style={styles.bookingLabel}>
                {tr('activeBooking')}
              </Text>

              <Text style={styles.bookingCentre}>{booking.centreName}</Text>

              <Text style={styles.bookingMeta}>
                {booking.slotWindow} • {booking.date}
              </Text>

              <Text style={styles.bookingMeta}>
                {tr('fd_cropLine', { crop: cropLabel(booking, lang), qty: booking.approxQuantityQuintals })}
              </Text>

              <PrimaryButton
                title={tr('trackStatus')}
                style={{ marginTop: 12, height: 44 }}
                onPress={() =>
                  navigation.navigate('TokenDetail', {
                    tokenId: booking.tokenId,
                  })
                }
              />
            </View>
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {tr('noActiveBooking')}
            </Text>

            <Text style={styles.emptySub}>
              {tr('noActiveBookingSub')}
            </Text>

            <TouchableOpacity
              onPress={() => navigation.navigate('CropSelection')}
            >
              <Text style={styles.link}>
                {tr('bookASlot')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.grid}>
          <DashboardCard
            title={tr('bookSlot')}
            icon="calendar-outline"
            onPress={() => navigation.navigate('CropSelection')}
          />

          <DashboardCard
            title={tr('myToken')}
            icon="ticket-outline"
            onPress={() =>
              booking
                ? navigation.navigate('TokenDetail', {
                    tokenId: booking.tokenId,
                  })
                : navigation.navigate('History')
            }
          />

          <DashboardCard
            title={tr('payments')}
            icon="receipt-outline"
            onPress={() => navigation.navigate('Payments')}
          />

          <DashboardCard
            title={tr('history')}
            icon="time-outline"
            onPress={() => navigation.navigate('History')}
          />

          <DashboardCard
            title={tr('help')}
            icon="help-circle-outline"
            onPress={() => navigation.navigate('Help', { role: 'farmer' })}
          />

          {IVR_BASE_URL ? (
            <DashboardCard
              title={tr('ivr_callMe')}
              icon="call-outline"
              onPress={callMe}
            />
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={profileOpen} transparent animationType="fade">
        <Pressable
          style={styles.overlay}
          onPress={() => setProfileOpen(false)}
        >
          <View style={styles.modal}>
            <Text style={styles.profileName}>
              {session?.name || tr('farmer')}
            </Text>

            <Text style={styles.profilePhone}>
              +91 {session?.phone || ''}
            </Text>

            <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
              <Ionicons
                name="log-out-outline"
                size={20}
                color={Colors.error}
              />
              <Text style={styles.logoutText}>
                {tr('logout')}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 18, paddingBottom: 30 },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greet: { fontSize: 12, color: Colors.subText, fontWeight: '600' },
  name: { fontSize: 18, fontWeight: '800', color: Colors.navy },
  phone: { fontSize: 11, color: Colors.subText, marginTop: 2 },

  bookingCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 18,
  },
  bookingLabel: {
    fontSize: 11,
    color: Colors.subText,
    fontWeight: '700',
  },
  bookingCentre: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.navy,
    marginTop: 4,
  },
  bookingMeta: { fontSize: 12, color: Colors.subText, marginTop: 4 },

  emptyCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 22,
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Colors.navy },
  emptySub: {
    fontSize: 12,
    color: Colors.subText,
    textAlign: 'center',
    marginTop: 6,
  },
  link: { marginTop: 12, color: Colors.primary, fontWeight: '800' },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '80%',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
  },
  profileName: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: Colors.navy,
  },
  profilePhone: {
    textAlign: 'center',
    color: Colors.subText,
    marginTop: 4,
    marginBottom: 20,
  },
  logoutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  logoutText: { color: Colors.error, fontWeight: '800', fontSize: 16 },
});
