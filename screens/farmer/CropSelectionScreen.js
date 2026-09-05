import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';
import { CROP_LIST } from '../../services/centres';
import { useLang } from '../../i18n/LanguageContext';

export default function CropSelectionScreen({ navigation }) {
  const { tr } = useLang();
  const [selected, setSelected] = useState(CROP_LIST[0]);

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack audioKey="audio_crop" />
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle title={tr('selectCrop')} subtitle={tr('selectCropSub')} />
        {CROP_LIST.map((crop) => {
          const on = selected.id === crop.id;
          return (
            <TouchableOpacity key={crop.id} style={[styles.card, on && styles.cardOn]} onPress={() => setSelected(crop)}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, on && { color: Colors.primary }]}>{tr(crop.nameKey)}</Text>
                <Text style={styles.msp}>MSP ₹{crop.msp} {tr('perQuintal')}</Text>
              </View>
              {on ? <Ionicons name="checkmark-circle" size={22} color={Colors.primary} /> : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton title={tr('continue')} onPress={() => navigation.navigate('CentreSelection', { crop: selected })} />
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20 },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: Colors.border, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  cardOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  name: { fontSize: 16, fontWeight: '800', color: Colors.navy },
  msp: { fontSize: 12, color: Colors.secondary, fontWeight: '700', marginTop: 4 },
  footer: { padding: 20, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border },
});
