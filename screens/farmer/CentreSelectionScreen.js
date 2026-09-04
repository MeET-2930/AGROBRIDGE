import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';

import * as Location from 'expo-location';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';

import { fetchCentres } from '../../services/centres';
import { distanceKm, formatDistance } from '../../utils/location';
import { useLang } from '../../i18n/LanguageContext';

export default function CentreSelectionScreen({ navigation, route }) {
  const { tr } = useLang();

  const { crop } = route.params || {};

  const [centres, setCentres] = useState([]);
  const [selected, setSelected] = useState(null);

  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationError, setLocationError] = useState('');

  /*
   * Convert whatever crop format we receive into
   * several possible values that can be compared
   * with Firestore's acceptedCrops.
   */
  const getCropValues = () => {
    if (!crop) return [];

    if (typeof crop === 'string') {
      return [crop.trim().toLowerCase()];
    }

    return [
      crop.id,
      crop.name,
      crop.cropId,
      crop.cropName,
    ]
      .filter(Boolean)
      .map((value) =>
        String(value).trim().toLowerCase()
      );
  };

  const centreAcceptsCrop = (centre) => {
    /*
     * If Firestore doesn't have acceptedCrops for a centre,
     * don't hide the centre. This prevents the entire
     * booking system from becoming unusable because of
     * incomplete master data.
     */
    if (
      !Array.isArray(centre.acceptedCrops) ||
      centre.acceptedCrops.length === 0
    ) {
      return true;
    }

    const cropValues = getCropValues();

    if (cropValues.length === 0) {
      return true;
    }

    const accepted = centre.acceptedCrops.map((item) => {
      if (typeof item === 'string') {
        return item.trim().toLowerCase();
      }

      if (typeof item === 'object') {
        return [
          item.id,
          item.name,
          item.cropId,
          item.cropName,
        ]
          .filter(Boolean)
          .map((value) =>
            String(value).trim().toLowerCase()
          );
      }

      return String(item).trim().toLowerCase();
    });

    const flattenedAccepted = accepted.flat();

    return cropValues.some((value) =>
      flattenedAccepted.includes(value)
    );
  };

  const sortByLocation = async (centreList) => {
    setLocationLoading(true);
    setLocationError('');

    try {
      let position =
        await Location.getLastKnownPositionAsync();

      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        setLocationEnabled(false);
        setLocationError(
          'लोकेशन अनुमति नहीं मिली।'
        );
        return;
      }

      setLocationEnabled(true);

      const freshLocationPromise =
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

      const timeoutPromise = new Promise((resolve) =>
        setTimeout(() => resolve(null), 5000)
      );

      const freshPosition = await Promise.race([
        freshLocationPromise,
        timeoutPromise,
      ]);

      if (freshPosition) {
        position = freshPosition;
      }

      if (!position) {
        setLocationError(
          'आपकी वर्तमान लोकेशन नहीं मिल सकी।'
        );
        return;
      }

      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      const sorted = centreList
        .map((centre) => ({
          ...centre,
          distanceKm: distanceKm(
            latitude,
            longitude,
            Number(centre.latitude),
            Number(centre.longitude)
          ),
        }))
        .sort(
          (a, b) =>
            a.distanceKm - b.distanceKm
        );

      setCentres(sorted);

      setSelected((current) => {
        if (!current) return sorted[0];

        return (
          sorted.find(
            (centre) =>
              centre.id === current.id
          ) || sorted[0]
        );
      });
    } catch (error) {
      console.error('GPS error:', error);

      setLocationError(
        'लोकेशन प्राप्त नहीं हो सकी।'
      );
    } finally {
      setLocationLoading(false);
    }
  };

  const loadCentres = async () => {
    setLoading(true);

    try {
      const allCentres = await fetchCentres();

      console.log(
        'CENTRES FROM FIRESTORE:',
        allCentres
      );

      console.log(
        'CURRENT CROP:',
        crop
      );

      const matchingCentres =
        allCentres.filter(
          centre =>
            centreAcceptsCrop(centre)
        );

      console.log(
        'MATCHING CENTRES:',
        matchingCentres
      );

      setCentres(matchingCentres);
      setSelected(
        matchingCentres[0] || null
      );

      setLoading(false);

      if (matchingCentres.length > 0) {
        await sortByLocation(
          matchingCentres
        );
      }
    } catch (error) {
      console.error(
        'Centre loading error:',
        error
      );

      setCentres([]);
      setSelected(null);
      setLoading(false);

      Alert.alert(
        'मंडी लोड नहीं हुई',
        error?.message ||
          'मंडियों की जानकारी प्राप्त नहीं हो सकी।'
      );
    }
  };

  useEffect(() => {
    loadCentres();
  }, [crop]);

  const retryLocation = async () => {
    if (centres.length > 0) {
      await sortByLocation(centres);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        navigation={navigation}
        showBack
        audioKey="audio_centre"
      />

      <ScrollView
        contentContainerStyle={styles.content}
      >
        <ScreenTitle
          title={
            tr('selectCentre') ||
            'मंडी चुनें'
          }
          subtitle={
            tr('selectCentreSub') ||
            'आपके स्थान के अनुसार निकटतम मंडियां'
          }
        />

        {locationLoading ? (
          <View style={styles.locationBox}>
            <ActivityIndicator
              size="small"
              color={Colors.secondary}
            />

            <Text style={styles.locationText}>
              आपकी लोकेशन से मंडियों की दूरी
              पता की जा रही है...
            </Text>
          </View>
        ) : locationEnabled ? (
          <View style={styles.locationSuccess}>
            <Text style={styles.locationSuccessText}>
              📍 आपके स्थान के अनुसार निकटतम मंडियां
            </Text>
          </View>
        ) : locationError ? (
          <TouchableOpacity
            style={styles.locationError}
            onPress={retryLocation}
          >
            <Text style={styles.locationErrorText}>
              📍 {locationError}
              {'\n'}
              दोबारा प्रयास करने के लिए टैप करें
            </Text>
          </TouchableOpacity>
        ) : null}

        {loading ? (
          <ActivityIndicator
            color={Colors.primary}
            size="large"
            style={{ marginTop: 30 }}
          />
        ) : centres.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              इस फसल के लिए कोई मंडी उपलब्ध
              नहीं है।
            </Text>

            <Text style={styles.emptySub}>
              अगर यह समस्या बनी रहती है तो
              Firebase Console में Centres
              collection की जानकारी जांचें।
            </Text>

            <PrimaryButton
              title="वापस जाएं"
              onPress={() =>
                navigation.goBack()
              }
              style={{ marginTop: 16 }}
            />
          </View>
        ) : (
          centres.map((centre, index) => {
            const isSelected =
              selected?.id === centre.id;

            return (
              <TouchableOpacity
                key={centre.id}
                style={[
                  styles.card,
                  isSelected &&
                    styles.cardSelected,
                ]}
                onPress={() =>
                  setSelected(centre)
                }
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>
                      {centre.name}
                    </Text>

                    {index === 0 &&
                    locationEnabled ? (
                      <Text style={styles.nearest}>
                        सबसे नजदीकी
                      </Text>
                    ) : null}
                  </View>

                  {centre.distanceKm !==
                  undefined ? (
                    <Text style={styles.distance}>
                      {formatDistance(
                        centre.distanceKm
                      )}
                    </Text>
                  ) : null}
                </View>

                <Text style={styles.address}>
                  {centre.address}
                </Text>

                <View style={styles.infoRow}>
                  <Text style={styles.info}>
                    🛣️ {centre.parallelLanes} लेन
                  </Text>

                  <Text style={styles.info}>
                    ⏱️ {centre.avgMinutesPerEntry}{' '}
                    मिनट/वाहन
                  </Text>
                </View>

                <Text style={styles.hours}>
                  समय: {centre.operatingStartTime} -{' '}
                  {centre.operatingEndTime}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          title={
            tr('continue') ||
            'आगे बढ़ें'
          }
          disabled={!selected || loading}
          onPress={() =>
            navigation.navigate(
              'SlotSelection',
              {
                crop,
                centre: selected,
              }
            )
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  content: {
    padding: 20,
    paddingBottom: 30,
  },

  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    gap: 8,
  },

  locationText: {
    flex: 1,
    color: Colors.secondary,
    fontSize: 12,
    fontWeight: '700',
  },

  locationSuccess: {
    backgroundColor: Colors.accent,
    padding: 11,
    borderRadius: 10,
    marginBottom: 12,
  },

  locationSuccessText: {
    color: Colors.secondary,
    fontSize: 12,
    fontWeight: '800',
  },

  locationError: {
    backgroundColor: Colors.primaryLight,
    padding: 11,
    borderRadius: 10,
    marginBottom: 12,
  },

  locationErrorText: {
    color: Colors.warning,
    fontSize: 12,
    fontWeight: '700',
  },

  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 12,
  },

  cardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  name: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.navy,
  },

  nearest: {
    marginTop: 4,
    color: Colors.secondary,
    fontSize: 10,
    fontWeight: '900',
  },

  distance: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.primary,
    marginLeft: 10,
  },

  address: {
    fontSize: 12,
    color: Colors.subText,
    marginTop: 7,
  },

  infoRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 9,
  },

  info: {
    fontSize: 11,
    color: Colors.navy,
    fontWeight: '700',
  },

  hours: {
    fontSize: 11,
    color: Colors.subText,
    marginTop: 6,
  },

  empty: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  emptyTitle: {
    textAlign: 'center',
    fontWeight: '800',
    color: Colors.navy,
    fontSize: 15,
  },

  emptySub: {
    textAlign: 'center',
    color: Colors.subText,
    fontSize: 12,
    marginTop: 6,
  },

  footer: {
    padding: 20,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});