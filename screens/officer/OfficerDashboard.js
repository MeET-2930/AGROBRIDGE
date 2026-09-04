import React, { useCallback, useRef, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import Colors from '../../theme/colors';

import {
  subscribeToTodaysQueue,
  getStagesForDuty,
  STATUS,
  CLOSED_STATUSES,
  INSIDE_STATUSES,
} from '../../services/bookings';

import { getCurrentUserSession, logoutUserSession } from '../../services/auth';
import { useLang } from '../../i18n/LanguageContext';

const DUTY_LABEL = {
  gate: 'गेट अधिकारी',
  assay: 'गुणवत्ता निरीक्षक',
  weighbridge: 'तौल अधिकारी',
  accounts: 'लेखा व भुगतान',
  admin: 'मंडी प्रशासक',
};

export default function OfficerDashboard({ navigation }) {
  const { tr } = useLang();

  const [session, setSession] = useState(null);
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);

  const unsub = useRef(null);

  const duty = session?.officerDuty || 'admin';
  const isAdmin = duty === 'admin';
  const stages = getStagesForDuty(duty);

  // Officers only ever see their own posted mandi.
  const centreId = session?.centreId || '';
  const hasCentre = !!centreId;

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      const start = async () => {
        const user = await getCurrentUserSession();
        if (alive) setSession(user);

        if (!user?.centreId) {
          if (alive) setRows([]);
          return;
        }

        unsub.current = subscribeToTodaysQueue(
          user.centreId,
          null,
          (list) => {
            if (alive) setRows(list);
          }
        );
      };

      start();

      return () => {
        alive = false;
        if (unsub.current) {
          unsub.current();
          unsub.current = null;
        }
      };
    }, [])
  );

  const countFor = (statuses) =>
    rows.filter((r) => statuses.includes(r.status)).length;

  const totals = {
    total: rows.length,
    waiting: rows.filter((r) => r.status === STATUS.BOOKED).length,
    absent: rows.filter((r) => r.status === STATUS.NO_SHOW).length,
    inside: rows.filter((r) => INSIDE_STATUSES.includes(r.status)).length,
    paid: rows.filter((r) => r.status === STATUS.PAID).length,
    done: rows.filter((r) => CLOSED_STATUSES.includes(r.status)).length,
  };

  const myWork = stages.reduce(
    (sum, stage) => sum + countFor(stage.statuses),
    0
  );

  const logout = async () => {
    setOpen(false);
    if (unsub.current) unsub.current();
    await logoutUserSession();
    navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Auth' }] });
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        navigation={navigation}
        showBack={false}
        tag="मंडी अधिकारी पोर्टल"
        audioKey="audio_officer_queue"
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greet}>{tr('namaste') || 'नमस्ते'}</Text>
            <Text style={styles.name}>{session?.name || 'अधिकारी'}</Text>
            <View style={styles.dutyPill}>
              <Text style={styles.dutyPillText}>
                {DUTY_LABEL[duty] || duty}
              </Text>
            </View>

            <Text style={styles.centreLine} numberOfLines={1}>
              {session?.centreName || 'मंडी नहीं चुनी'}
            </Text>
          </View>

          <TouchableOpacity onPress={() => setOpen(true)}>
            <Ionicons
              name="person-circle-outline"
              size={40}
              color={Colors.navy}
            />
          </TouchableOpacity>
        </View>

        {!hasCentre ? (
          <TouchableOpacity
            style={styles.setupCard}
            onPress={() =>
              navigation.navigate('OfficerProfile', { mustPickCentre: true })
            }
          >
            <Ionicons name="business-outline" size={28} color="#E65100" />
            <View style={{ flex: 1 }}>
              <Text style={styles.setupTitle}>अपनी मंडी चुनें</Text>
              <Text style={styles.setupSub}>
                मंडी चुने बिना आपको कोई टोकन नहीं दिखेगा। सेट करने के लिए
                टैप करें।
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#E65100" />
          </TouchableOpacity>
        ) : null}

        {/* Pending work banner */}
        <View
          style={[
            styles.banner,
            myWork === 0 ? styles.bannerClear : styles.bannerBusy,
          ]}
        >
          <Ionicons
            name={myWork === 0 ? 'checkmark-circle' : 'alert-circle'}
            size={26}
            color={myWork === 0 ? '#2E7D32' : '#E65100'}
          />

          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.bannerTitle,
                { color: myWork === 0 ? '#1B5E20' : '#E65100' },
              ]}
            >
              {myWork === 0
                ? 'कोई काम बाकी नहीं'
                : `${myWork} वाहन आपके पास लंबित`}
            </Text>
            <Text style={styles.bannerSub}>
              आज कुल {totals.total} टोकन • अंदर {totals.inside}
            </Text>
          </View>
        </View>

        {/* Work cards, one per stage this officer owns */}
        <Text style={styles.sectionTitle}>आपका काम</Text>

        {stages.map((stage) => {
          const count = countFor(stage.statuses);

          return (
            <TouchableOpacity
              key={stage.id}
              style={[styles.workCard, count > 0 && styles.workCardActive]}
              activeOpacity={0.85}
              onPress={() =>
                navigation.navigate('StageQueue', { stageId: stage.id })
              }
            >
              <View
                style={[
                  styles.workIcon,
                  count > 0 && { backgroundColor: Colors.primary },
                ]}
              >
                <Ionicons
                  name={stage.icon}
                  size={24}
                  color={count > 0 ? Colors.white : Colors.secondary}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.workTitle}>{stage.title}</Text>
                <Text style={styles.workSub}>{stage.subtitle}</Text>
              </View>

              <View
                style={[
                  styles.countPill,
                  count > 0 ? styles.countPillOn : styles.countPillOff,
                ]}
              >
                <Text
                  style={[
                    styles.countText,
                    { color: count > 0 ? Colors.white : Colors.subText },
                  ]}
                >
                  {count}
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={20}
                color={Colors.subText}
              />
            </TouchableOpacity>
          );
        })}

        {/* Day summary */}
        <Text style={styles.sectionTitle}>आज का सारांश</Text>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.num}>{totals.total}</Text>
            <Text style={styles.lbl}>कुल टोकन</Text>
          </View>

          <View style={styles.stat}>
            <Text style={[styles.num, { color: '#FFD54F' }]}>
              {totals.waiting}
            </Text>
            <Text style={styles.lbl}>प्रतीक्षित</Text>
          </View>

          <View style={styles.stat}>
            <Text style={[styles.num, { color: '#90CAF9' }]}>
              {totals.inside}
            </Text>
            <Text style={styles.lbl}>अंदर</Text>
          </View>

          <View style={styles.stat}>
            <Text style={[styles.num, { color: '#A5D6A7' }]}>
              {totals.paid}
            </Text>
            <Text style={styles.lbl}>भुगतान</Text>
          </View>

          <View style={styles.stat}>
            <Text style={[styles.num, { color: '#EF9A9A' }]}>
              {totals.absent}
            </Text>
            <Text style={styles.lbl}>अनुपस्थित</Text>
          </View>
        </View>

        {/* Extra tools */}
        <Text style={styles.sectionTitle}>अन्य</Text>

        <TouchableOpacity
          style={styles.toolRow}
          onPress={() => navigation.navigate('TodaysQueue')}
        >
          <Ionicons name="list-outline" size={20} color={Colors.secondary} />
          <Text style={styles.toolText}>पूरी कतार देखें</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.subText} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolRow}
          onPress={() => navigation.navigate('Reports')}
        >
          <Ionicons
            name="bar-chart-outline"
            size={20}
            color={Colors.secondary}
          />
          <Text style={styles.toolText}>दैनिक रिपोर्ट</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.subText} />
        </TouchableOpacity>

        {isAdmin ? (
          <TouchableOpacity
            style={styles.toolRow}
            onPress={() => navigation.navigate('DelayReport')}
          >
            <Ionicons
              name="alert-circle-outline"
              size={20}
              color={Colors.error}
            />
            <Text style={styles.toolText}>विलंब रिपोर्ट</Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={Colors.subText}
            />
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <Modal visible={open} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={styles.modal}>
            <Text style={styles.modalName}>{session?.name || 'अधिकारी'}</Text>
            <Text style={styles.modalSub}>
              {DUTY_LABEL[duty] || duty} • {session?.employeeId || ''}
            </Text>

            <TouchableOpacity
              style={styles.profileLink}
              onPress={() => {
                setOpen(false);
                navigation.navigate('OfficerProfile');
              }}
            >
              <Ionicons
                name="settings-outline"
                size={18}
                color={Colors.secondary}
              />
              <Text style={styles.profileLinkText}>
                मंडी / ड्यूटी / पहचान बदलें
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logout} onPress={logout}>
              <Ionicons
                name="log-out-outline"
                size={20}
                color={Colors.error}
              />
              <Text style={styles.logoutText}>
                {tr('logout') || 'लॉग आउट'}
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
  content: { padding: 16, paddingBottom: 30 },

  headRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  greet: { color: Colors.subText, fontWeight: '600', fontSize: 12 },
  name: { fontSize: 19, fontWeight: '800', color: Colors.navy },
  dutyPill: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accent,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 5,
  },
  dutyPillText: { color: Colors.secondary, fontWeight: '800', fontSize: 11 },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1.5,
  },
  bannerBusy: { backgroundColor: '#FFF8E1', borderColor: '#FFB300' },
  bannerClear: { backgroundColor: '#E8F5E9', borderColor: '#66BB6A' },
  bannerTitle: { fontSize: 15, fontWeight: '900' },
  bannerSub: { fontSize: 11, color: Colors.subText, marginTop: 2 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.subText,
    marginBottom: 10,
    marginTop: 6,
  },

  workCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  workCardActive: { borderColor: Colors.primary },
  workIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workTitle: { fontSize: 15, fontWeight: '800', color: Colors.navy },
  workSub: { fontSize: 11, color: Colors.subText, marginTop: 2 },
  countPill: {
    minWidth: 32,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countPillOn: { backgroundColor: Colors.primary },
  countPillOff: { backgroundColor: Colors.background },
  countText: { fontWeight: '900', fontSize: 14 },

  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: Colors.navy,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  stat: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 10,
  },
  num: { color: Colors.white, fontSize: 22, fontWeight: '900' },
  lbl: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 },

  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toolText: { flex: 1, fontWeight: '700', color: Colors.navy, fontSize: 14 },

  setupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF8E1',
    borderColor: '#FFB300',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  setupTitle: { fontSize: 15, fontWeight: '900', color: '#E65100' },
  setupSub: { fontSize: 11, color: '#8D6E63', marginTop: 3, lineHeight: 15 },

  centreLine: {
    fontSize: 11,
    color: Colors.subText,
    fontWeight: '700',
    marginTop: 4,
  },

  profileLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 12,
  },
  profileLinkText: { color: Colors.secondary, fontWeight: '800', fontSize: 13 },

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
  modalName: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: Colors.navy,
  },
  modalSub: {
    textAlign: 'center',
    color: Colors.subText,
    marginTop: 4,
    marginBottom: 20,
    fontSize: 12,
  },
  logout: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  logoutText: { color: Colors.error, fontWeight: '800', fontSize: 16 },
});
