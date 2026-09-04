import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Colors from '../theme/colors';
import { buildGatePassQr, gatePassCodeOf } from '../services/bookings';

/*
 * Gate pass shown to the farmer. The QR and the 6-digit number
 * mean the same thing; the number exists for keypad phones (SMS).
 */
export default function GatePassCard({ token, compact = false }) {
  if (!token) return null;

  const code = gatePassCodeOf(token);
  const qrValue = token.gatePassQr || buildGatePassQr(token.tokenId, code);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.headText}>🎫 गेट पास / GATE PASS</Text>
        <Text style={styles.headToken}>{token.tokenNumber}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.qrBox}>
          <QRCode value={qrValue} size={compact ? 120 : 150} />
        </View>

        <View style={styles.info}>
          <Text style={styles.label}>गेट पास नंबर</Text>
          <Text style={styles.code}>{code.replace(/(\d{3})(\d{3})/, '$1 $2')}</Text>

          <Text style={styles.label}>किसान</Text>
          <Text style={styles.value}>{token.farmerName || '—'}</Text>

          <Text style={styles.label}>तारीख • समय</Text>
          <Text style={styles.value}>
            {token.date} • {token.slotWindow}
          </Text>

          <Text style={styles.label}>फसल</Text>
          <Text style={styles.value}>{token.cropName || token.crop}</Text>
        </View>
      </View>

      <View style={styles.foot}>
        <Text style={styles.footText}>{token.centreName}</Text>
        <Text style={styles.footHint}>
          गेट पर यह QR या नंबर और वाहन नंबर दिखाएँ
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.navy,
    overflow: 'hidden',
    marginBottom: 14,
  },
  head: {
    backgroundColor: Colors.navy,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headText: { color: Colors.white, fontWeight: '900', fontSize: 13 },
  headToken: { color: Colors.white, fontWeight: '900', fontSize: 20 },
  body: { flexDirection: 'row', padding: 14, gap: 14 },
  qrBox: {
    padding: 8,
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignSelf: 'flex-start',
  },
  info: { flex: 1 },
  label: { fontSize: 10, color: Colors.subText, fontWeight: '700', marginTop: 6 },
  code: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 2,
  },
  value: { fontSize: 13, fontWeight: '700', color: Colors.navy },
  foot: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    borderStyle: 'dashed',
    padding: 10,
    alignItems: 'center',
  },
  footText: { fontSize: 12, fontWeight: '800', color: Colors.navy },
  footHint: { fontSize: 11, color: Colors.subText, marginTop: 2 },
});
