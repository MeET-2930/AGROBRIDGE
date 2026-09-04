import React, { useCallback, useRef, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import Colors from '../../theme/colors';

import {
  subscribeToTodaysQueue,
  getStageById,
  markNoShow,
  gatePassCodeOf,
} from '../../services/bookings';

import { getCurrentUserSession } from '../../services/auth';

/*
 * A focused work list for ONE stage of the pipeline.
 *
 * The officer only sees vehicles that are waiting on them right
 * now, in position order, with a single obvious action. This is
 * far less error-prone at a busy gate than one long mixed list.
 */
export default function StageQueueScreen({ navigation, route }) {
  const { stageId } = route.params || {};
  const stage = getStageById(stageId);

  const [rows, setRows] = useState([]);

  const unsub = useRef(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      const start = async () => {
        const user = await getCurrentUserSession();

        if (!user?.centreId) {
          if (alive) setRows([]);
          return;
        }

        unsub.current = subscribeToTodaysQueue(user.centreId, null, (list) => {
          if (alive) setRows(list);
        });
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

  if (!stage) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader navigation={navigation} showBack />
        <Text style={styles.empty}>चरण नहीं मिला</Text>
      </SafeAreaView>
    );
  }

  const list = rows.filter((r) => stage.statuses.includes(r.status));

  const noShow = (tokenId) => {
    Alert.alert('अनुपस्थित?', 'क्या किसान नहीं आया?', [
      { text: 'रद्द', style: 'cancel' },
      {
        text: 'हाँ',
        style: 'destructive',
        onPress: async () => {
          try {
            await markNoShow(tokenId);
          } catch (error) {
            Alert.alert('त्रुटि', error?.message || 'दर्ज नहीं हुआ।');
          }
        },
      },
    ]);
  };

  const runAction = (token) => {
    if (stage.action === 'gate') {
      /*
       * Gate entry is ONLY allowed after the farmer's gate pass has
       * been scanned or its number typed. Tapping a card just opens
       * the scanner with that token highlighted as the expected one.
       */
      navigation.navigate('GateScan', { rows, expectTokenId: token.tokenId });
      return;
    }

    navigation.navigate(stage.action, { token });
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack title={stage.title} />

      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle
          title={stage.title}
          subtitle={`${list.length} वाहन लंबित • ${stage.subtitle}`}
        />

        {stage.action === 'gate' ? (
          <TouchableOpacity
            style={styles.scanBtn}
            onPress={() => navigation.navigate('GateScan', { rows })}
          >
            <Ionicons name="qr-code-outline" size={22} color={Colors.white} />
            <Text style={styles.scanBtnText}>
              गेट पास स्कैन करें / नंबर डालें
            </Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.white} />
          </TouchableOpacity>
        ) : null}

        {list.length === 0 ? (
          <View style={styles.clearBox}>
            <Ionicons name="checkmark-circle" size={40} color="#2E7D32" />
            <Text style={styles.clearText}>इस चरण में कोई काम बाकी नहीं</Text>
          </View>
        ) : (
          list.map((token, index) => (
            <View
              key={token.tokenId}
              style={[styles.card, index === 0 && styles.cardFirst]}
            >
              {index === 0 ? (
                <View style={styles.nextTag}>
                  <Text style={styles.nextTagText}>अगला</Text>
                </View>
              ) : null}

              <View style={styles.top}>
                <Text style={styles.token}>{token.tokenNumber}</Text>
                <Text style={styles.slot}>{token.slotWindow}</Text>
              </View>

              <Text style={styles.name}>{token.farmerName}</Text>
              <Text style={styles.sub}>+91 {token.farmerPhone}</Text>
              {stage.action === 'gate' ? (
                <Text style={styles.passCode}>
                  गेट पास: {gatePassCodeOf(token)}
                </Text>
              ) : null}

              <View style={styles.metaRow}>
                <Text style={styles.meta}>
                  {String(token.cropName || token.crop || '').toUpperCase()}
                </Text>
                <Text style={styles.meta}>
                  {token.vehicleNumber || 'वाहन लंबित'}
                </Text>
                <Text style={styles.meta}>
                  {token.actualQuantity || token.approxQuantityQuintals} क्विं.
                </Text>
              </View>

              {token.grade ? (
                <Text style={styles.meta}>
                  ग्रेड: {token.grade} • नमी {token.moisturePercent}%
                </Text>
              ) : null}

              <View style={styles.actions}>
                {stage.action === 'gate' ? (
                  <TouchableOpacity
                    style={styles.outline}
                    onPress={() => noShow(token.tokenId)}
                  >
                    <Text style={styles.outlineText}>अनुपस्थित</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={styles.primary}
                  onPress={() => runAction(token)}
                >
                  <Text style={styles.primaryText}>
                    {stage.action === 'gate' ? 'गेट पास स्कैन' : stage.actionLabel}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={Colors.white}
                  />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 18, paddingBottom: 30 },
  empty: { textAlign: 'center', marginTop: 40, color: Colors.subText },

  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.navy,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  scanBtnText: { flex: 1, color: Colors.white, fontWeight: '900', fontSize: 14 },
  passCode: { marginTop: 4, color: Colors.primary, fontWeight: '900', fontSize: 13 },
  sheetPass: { color: Colors.primary, fontWeight: '800', fontSize: 12, marginBottom: 10 },

  clearBox: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  clearText: { color: Colors.navy, fontWeight: '700' },

  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardFirst: { borderColor: Colors.primary, borderWidth: 2 },
  nextTag: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 8,
  },
  nextTagText: { color: Colors.white, fontWeight: '900', fontSize: 10 },

  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  token: { fontSize: 24, fontWeight: '900', color: Colors.navy },
  slot: { fontSize: 11, color: Colors.subText, fontWeight: '700' },

  name: { marginTop: 8, fontWeight: '800', color: Colors.text, fontSize: 15 },
  sub: { marginTop: 2, color: Colors.subText, fontSize: 12 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  meta: { fontSize: 11, color: Colors.navy, fontWeight: '700' },

  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  outline: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: 8,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineText: { color: Colors.error, fontWeight: '800' },
  primary: {
    flex: 1.4,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryText: { color: Colors.white, fontWeight: '800' },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    width: '88%',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 18,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: Colors.navy },
  sheetSub: { color: Colors.subText, marginBottom: 12, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  note: { fontSize: 11, color: Colors.subText, marginTop: 8, marginBottom: 14 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cancel: { color: Colors.subText, fontWeight: '700', padding: 10 },
});
