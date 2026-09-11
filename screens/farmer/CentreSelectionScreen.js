import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import * as Location from 'expo-location';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';

import { fetchCentres, centreLabel } from '../../services/centres';
import { distanceKm, formatDistance } from '../../utils/location';
import { useLang } from '../../i18n/LanguageContext';

export default function CentreSelectionScreen({ navigation, route }) {
  const { tr, lang, trError } = useLang();
  const { crop } = route.params || {};

  const [centres, setCentres] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  // stores a translation KEY so it re-renders in the right language
  const [locationErrorKey, setLocationErrorKey] = useState('');

  const getCropValues = () => {
    if (!crop) return [];
    if (typeof crop === 'string') return [crop.trim().toLowerCase()];
    return [crop.id, crop.name, crop.cropId, crop.cropName]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase());
  };

  const centreAcceptsCrop = (centre) => {
    if (!Array.isArray(centre.acceptedCrops) || centre.acceptedCrops.length === 0) return true;
    const cropValues = getCropValues();
    if (cropValues.length === 0) return true;
    const accepted = centre.acceptedCrops
      .map((item) => {
        if (typeof item === 'string') return item.trim().toLowerCase();
        if (typeof item === 'object') {
          return [item.id, item.name, item.cropId, item.cropName]
            .filter(Boolean)
            .map((value) => String(value).trim().toLowerCase());
        }
        return String(item).trim().toLowerCase();
      })
      .flat();
    return cropValues.some((value) => accepted.includes(value));
  };

  const sortByLocation = async (centreList) => {
    setLocationLoading(true);
    setLocationErrorKey('');
    try {
      let position = await Location.getLastKnownPositionAsync();
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationEnabled(false);
        setLocationErrorKey('cs_noPermission');
        return;
      }
      setLocationEnabled(true);

      const fresh = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);
      if (fresh) position = fresh;
      if (!position) {
        setLocationErrorKey('cs_noLocation');
        return;
      }

      const { latitude, longitude } = position.coords;
      const sorted = centreList
        .map((centre) => ({
          ...centre,
          distanceKm: distanceKm(latitude, longitude, Number(centre.latitude), Number(centre.longitude)),
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm);

      setCentres(sorted);
      setSelected((current) =>
        !current ? sorted[0] : sorted.find((c) => c.id === current.id) || sorted[0]
      );
    } catch (error) {
      console.error('GPS error:', error);
      setLocationErrorKey('cs_locError');
    } finally {
      setLocationLoading(false);
    }
  };

  const loadCentres = async () => {
    setLoading(true);
    try {
      const all = await fetchCentres();
      const matching = all.filter(centreAcceptsCrop);
      setCentres(matching);
      setSelected(matching[0] || null);
      setLoading(false);
      if (matching.length > 0) await sortByLocation(matching);
    } catch (error) {
      console.error('Centre loading error:', error);
      setCentres([]);
      setSelected(null);
      setLoading(false);
      Alert.alert(tr('cs_loadFail'), trError(error, 'cs_loadFailSub'));
    }
  };

  useEffect(() => { loadCentres(); }, [crop]);

  const retryLocation = async () => {
    if (centres.length > 0) await sortByLocation(centres);
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack audioKey="audio_centre" />

      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle title={tr('selectCentre')} subtitle={tr('selectCentreSub')} />

        {locationLoading ? (
          <View style={styles.locationBox}>
            <ActivityIndicator size="small" color={Colors.secondary} />
            <Text style={styles.locationText}>{tr('cs_locating')}</Text>
          </View>
        ) : locationEnabled ? (
          <View style={styles.locationSuccess}>
            <Text style={styles.locationSuccessText}>{tr('cs_nearestByLocation')}</Text>
          </View>
        ) : locationErrorKey ? (
          <TouchableOpacity style={styles.locationError} onPress={retryLocation}>
            <Text style={styles.locationErrorText}>
              📍 {tr(locationErrorKey)}{'\n'}{tr('tapToRetry')}
            </Text>
          </TouchableOpacity>
        ) : null}

        {loading ? (
          <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 30 }} />
        ) : centres.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{tr('cs_noneForCrop')}</Text>
            <Text style={styles.emptySub}>{tr('cs_noneForCropSub')}</Text>
            <PrimaryButton title={tr('goBack')} onPress={() => navigation.goBack()} style={{ marginTop: 16 }} />
          </View>
        ) : (
          centres.map((centre, index) => {
            const isSelected = selected?.id === centre.id;
            return (
              <TouchableOpacity
                key={centre.id}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => setSelected(centre)}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{centreLabel(centre, lang)}</Text>
                    {index === 0 && locationEnabled ? (
                      <Text style={styles.nearest}>{tr('cs_nearest')}</Text>
                    ) : null}
                  </View>
                  {centre.distanceKm !== undefined ? (
                    <Text style={styles.distance}>{formatDistance(centre.distanceKm)}</Text>
                  ) : null}
                </View>

                <Text style={styles.address}>{centre.address}</Text>

                <View style={styles.infoRow}>
                  <Text style={styles.info}>{tr('cs_lanes', { n: centre.parallelLanes })}</Text>
                  <Text style={styles.info}>{tr('cs_minPerVehicle', { n: centre.avgMinutesPerEntry })}</Text>
                </View>

                <Text style={styles.hours}>
                  {tr('cs_hours', { a: centre.operatingStartTime, b: centre.operatingEndTime })}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          title={tr('continue')}
          disabled={!selected || loading}
          onPress={() => navigation.navigate('SlotSelection', { crop, centre: selected })}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 30 },
  locationBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.accent, padding: 12, borderRadius: 10, marginBottom: 12, gap: 8 },
  locationText: { flex: 1, color: Colors.secondary, fontSize: 13, fontWeight: '700' },
  locationSuccess: { backgroundColor: Colors.accent, padding: 11, borderRadius: 10, marginBottom: 12 },
  locationSuccessText: { color: Colors.secondary, fontSize: 13, fontWeight: '800' },
  locationError: { backgroundColor: Colors.primaryLight, padding: 11, borderRadius: 10, marginBottom: 12 },
  locationErrorText: { color: Colors.warning, fontSize: 13, fontWeight: '700' },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: Colors.border, marginBottom: 12 },
  cardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  name: { fontSize: 15, fontWeight: '800', color: Colors.navy },
  nearest: { marginTop: 4, color: Colors.secondary, fontSize: 11, fontWeight: '900' },
  distance: { fontSize: 15, fontWeight: '900', color: Colors.primary, marginLeft: 10 },
  address: { fontSize: 13, color: Colors.subText, marginTop: 7 },
  infoRow: { flexDirection: 'row', gap: 16, marginTop: 9 },
  info: { fontSize: 12, color: Colors.navy, fontWeight: '700' },
  hours: { fontSize: 12, color: Colors.subText, marginTop: 6 },
  empty: { backgroundColor: Colors.white, borderRadius: 16, padding: 20, alignItems: 'center', marginTop: 20, borderWidth: 1, borderColor: Colors.border },
  emptyTitle: { textAlign: 'center', fontWeight: '800', color: Colors.navy, fontSize: 15 },
  emptySub: { textAlign: 'center', color: Colors.subText, fontSize: 13, marginTop: 6 },
  footer: { padding: 20, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border },
});
