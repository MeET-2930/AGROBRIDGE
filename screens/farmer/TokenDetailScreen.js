import React, { useEffect, useRef, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import StatusBadge from '../../components/StatusBadge';
import QueueStatusCard from '../../components/QueueStatusCard';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';

import {
  subscribeToBooking,
  subscribeToTodaysQueue,
  laneAhead,
  passLabel,
  subscribeToQueue,
  buildQueueView,
  cancelBooking,
  markLateChoice,
  canCancel,
  CANCEL_HOURS,
  fixPrice,
  STATUS,
} from '../../services/bookings';
import { CROP_LIST, cropLabel, gradeLabel, centreLabel, gradedMsp } from '../../services/centres';
import { useLang } from '../../i18n/LanguageContext';
import {
  subscribeToAuction,
  openAuction,
  acceptHighestBid,
  rejectAuction,
  extendAuction,
  closeAuctionIfDue,
  isBiddingOpen,
  secondsLeft,
  formatCountdown,
  AUCTION_STATUS,
} from '../../services/auctions';
import { downloadReceiptPdf, downloadGatePassPdf } from '../../services/receipt';
import GatePassCard from '../../components/GatePassCard';

const GREEN = '#16A34A';
const AMBER = '#F59E0B';

/*
 * Stage checklist shown to the farmer so they always know
 * where they are in the process.
 */
const STAGES = [
  { key: STATUS.BOOKED, label: 'stage_booked' },
  { key: STATUS.IN_GATE, label: 'stage_gate' },
  { key: STATUS.ASSAY, label: 'stage_assay' },
  { key: STATUS.PRICE_FIXED, label: 'stage_price' },
  { key: STATUS.WEIGHING, label: 'stage_weigh' },
  { key: STATUS.PAYMENT_PENDING, label: 'stage_payReady' },
  { key: STATUS.PAID, label: 'stage_paid' },
];

const STAGE_ORDER = STAGES.map((s) => s.key);

export default function TokenDetailScreen({ navigation, route }) {
  const { tr, lang, trError } = useLang();
  const { tokenId } = route.params || {};

  const [token, setToken] = useState(null);
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingPass, setDownloadingPass] = useState(false);
  const [parchiOpen, setParchiOpen] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [auction, setAuction] = useState(null);
  const [tick, setTick] = useState(0);
  const [auctionBusy, setAuctionBusy] = useState(false);
  const [showTrucks, setShowTrucks] = useState(false);   // install43 per-truck toggle (must be above any early return)

  // Live auction doc for this token + 1s ticker for the countdown.
  useEffect(() => {
    if (!tokenId) return undefined;
    const unsub = subscribeToAuction(tokenId, setAuction);
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, [tokenId]);

  // When the timer hits zero, flip the lot to 'closed' once.
  useEffect(() => {
    if (auction?.status === AUCTION_STATUS.OPEN && secondsLeft(auction) === 0) {
      closeAuctionIfDue(tokenId).catch(() => {});
    }
  }, [tick, auction?.status]);

  const unsubQueue = useRef(null);
  const unsubYard = useRef(null);
  const [yardRows, setYardRows] = useState([]);

  useEffect(() => {
    if (!tokenId) {
      setLoading(false);
      return;
    }

    const unsubBooking = subscribeToBooking(tokenId, (fresh) => {
      setToken(fresh);
      setLoading(false);

      // Attach the queue listener once we know the centre and date.
      if (fresh && !unsubQueue.current) {
        unsubQueue.current = subscribeToQueue(
          fresh.centreId,
          fresh.date,
          setQueue
        );
        unsubYard.current = subscribeToTodaysQueue(fresh.centreId, fresh.date, setYardRows);
      }
    });

    return () => {
      unsubBooking();

      if (unsubQueue.current) {
        unsubQueue.current();
        unsubQueue.current = null;
      }
      if (unsubYard.current) {
        unsubYard.current();
        unsubYard.current = null;
      }
    };
  }, [tokenId]);

  const [lateBusy, setLateBusy] = useState(false);
  const choose = async (choice) => {
    setLateBusy(true);
    try {
      await markLateChoice(tokenId, choice);
      if (choice === 'notComing') navigation.goBack();
    } catch (error) {
      Alert.alert(tr('error'), trError(error, 'notRecorded'));
    } finally {
      setLateBusy(false);
    }
  };

  const confirmCancel = () => {
    Alert.alert(tr('td_cancelConfirm'), tr('td_cancelConfirmSub'), [
      { text: tr('no'), style: 'cancel' },
      {
        text: tr('td_yesCancel'),
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);

          try {
            await cancelBooking(tokenId);
            navigation.goBack();
          } catch (error) {
            Alert.alert(tr('error'), trError(error, 'td_cancelFail'));
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader navigation={navigation} showBack />
        <ActivityIndicator
          color={Colors.primary}
          size="large"
          style={{ marginTop: 40 }}
        />
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader navigation={navigation} showBack />
        <View style={styles.content}>
          <Text style={styles.notFound}>{tr('td_notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const view = buildQueueView(token, queue);
  const currentIndex = STAGE_ORDER.indexOf(token.status);

  // install43: MSP depends on grade. `priced` = { advertised, deduction, rate, reasonKey, factors }
  const priced = gradedMsp(token?.crop, token?.grade || 'FAQ', token || {});
  const msp = priced.rate;
  const advertisedMsp = priced.advertised;

  const acceptMsp = () => {
    Alert.alert(
      tr('td_sellMspConfirm'),
      tr('td_sellMspConfirmSub', { msp }),
      [
        { text: tr('no'), style: 'cancel' },
        {
          text: tr('td_yesMsp'),
          onPress: async () => {
            setFixing(true);
            try {
              await fixPrice(tokenId, {
                mode: 'msp',
                ratePerQuintal: msp,
                pricing: { advertised: priced.advertised, deduction: priced.deduction, grade: token?.grade || 'FAQ', reasonKey: priced.reasonKey, factors: priced.factors },
              });
            } catch (error) {
              Alert.alert(tr('error'), trError(error, 'td_priceFail'));
            } finally {
              setFixing(false);
            }
          },
        },
      ]
    );
  };

  const startAuction = () => {
    Alert.alert(
      tr('td_startConfirm'),
      tr('td_startConfirmSub', { msp }),
      [
        { text: tr('no'), style: 'cancel' },
        {
          text: tr('td_yesStart'),
          onPress: async () => {
            setAuctionBusy(true);
            try {
              await openAuction({ ...token, tokenId });
            } catch (error) {
              Alert.alert(tr('error'), trError(error, 'td_startFail'));
            } finally {
              setAuctionBusy(false);
            }
          },
        },
      ]
    );
  };

  const acceptBid = () => {
    if (!auction?.highestBid) return;
    Alert.alert(
      tr('td_acceptConfirm'),
      tr('td_acceptConfirmSub', { who: auction.highestBidderName, amt: auction.highestBid }),
      [
        { text: tr('no'), style: 'cancel' },
        {
          text: tr('td_accept'),
          onPress: async () => {
            setAuctionBusy(true);
            try {
              const lot = await acceptHighestBid(tokenId, token.farmerId);
              await fixPrice(tokenId, {
                mode: 'auction',
                ratePerQuintal: lot.highestBid,
                buyerId: lot.highestBidderId,
                buyerName: lot.highestBidderName,
              });
            } catch (error) {
              Alert.alert(tr('error'), trError(error, 'td_acceptFail'));
            } finally {
              setAuctionBusy(false);
            }
          },
        },
      ]
    );
  };

  const rejectBids = () => {
    Alert.alert(tr('td_rejectConfirm'), tr('td_rejectConfirmSub'), [
      { text: tr('no'), style: 'cancel' },
      {
        text: tr('td_reject'),
        style: 'destructive',
        onPress: async () => {
          try {
            await rejectAuction(tokenId);
          } catch (error) {
            Alert.alert(tr('error'), trError(error, 'td_failed'));
          }
        },
      },
    ]);
  };

  const extend = async () => {
    try {
      await extendAuction(tokenId, 5);
    } catch (error) {
      Alert.alert(tr('error'), trError(error, 'td_failed'));
    }
  };

  const handleGatePass = async () => {
    setDownloadingPass(true);
    try {
      await downloadGatePassPdf({ ...token, id: token.id || tokenId }, lang);
    } catch (error) {
      console.error('Gate pass PDF error:', error);
      Alert.alert(tr('pdfFailed'), trError(error, 'pleaseRetry'));
    } finally {
      setDownloadingPass(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadReceiptPdf({ ...token, id: token.id || tokenId }, lang);
    } catch (error) {
      console.error('Receipt PDF error:', error);
      Alert.alert(tr('pdfFailed'), trError(error, 'pleaseRetry'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.tokenHeader}>
          <View>
            <Text style={styles.tokenLabel}>{tr('td_yourPass')}</Text>
            <Text style={styles.tokenNumber}>{passLabel(token)}</Text>
            <Text style={styles.tokenLabel}>{token.date}</Text>
          </View>

          <StatusBadge status={token.status} />
        </View>

        <QueueStatusCard view={view} lane={token.status === STATUS.IN_GATE ? laneAhead(token, queue, yardRows) : null} />

        {/* install49: hour missed -> farmer chooses */}
        {view?.slotState === 'passed' && !token.lateChoice && [STATUS.BOOKED, STATUS.MISSED].includes(token.status) ? (
          <View style={styles.lateBox}>
            <Text style={styles.lateTitle}>{tr('td_lateTitle')}</Text>
            <Text style={styles.lateSub}>{tr('td_lateSub')}</Text>
            <PrimaryButton
              title={tr('td_lateYes')}
              loading={lateBusy}
              onPress={() => choose('late')}
              style={{ marginTop: 10 }}
            />
            <PrimaryButton
              title={tr('td_lateNo')}
              variant="danger"
              loading={lateBusy}
              onPress={() => Alert.alert(tr('td_lateNo'), tr('td_lateNoConfirm'), [
                { text: tr('no'), style: 'cancel' },
                { text: tr('yes'), style: 'destructive', onPress: () => choose('notComing') },
              ])}
              style={{ marginTop: 8 }}
            />
          </View>
        ) : null}
        {token.lateChoice === 'late' && token.status === STATUS.MISSED && !token.rebookedTo ? (
          <View style={styles.lateBox}>
            <Text style={styles.lateTitle}>{tr('td_lateWaiting')}</Text>
            <Text style={styles.lateSub}>{tr('td_lateWaitingSub')}</Text>
          </View>
        ) : null}

        {/* Gate pass: only useful until the vehicle is inside */}
        {token.status === STATUS.BOOKED ? (
          <View>
            <GatePassCard token={token} />
            <PrimaryButton
              title={tr('td_downloadPass')}
              variant="outline"
              loading={downloadingPass}
              onPress={handleGatePass}
              style={{ marginBottom: 14 }}
            />
          </View>
        ) : null}

        {/* Stage progress */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tr('td_progress')}</Text>

          {STAGES.map((stage, index) => {
            /*
             * Each status means "this step is DONE". So the step
             * matching the current status is green, and the NEXT
             * step is the amber "in progress" one. Booking is
             * complete the moment the token exists.
             */
            const isPaid = token.status === STATUS.PAID;
            const done = isPaid || (currentIndex >= 0 && index <= currentIndex);
            const active = !isPaid && index === currentIndex + 1;
            const isLast = index === STAGES.length - 1;

            return (
              <View key={stage.key} style={styles.stageRow}>
                <View style={styles.stageLeft}>
                  {done ? (
                    <View style={[styles.stageDot, styles.stageDotDone]}>
                      <Text style={styles.stageTick}>✓</Text>
                    </View>
                  ) : active ? (
                    <PulsingDot />
                  ) : (
                    <View style={styles.stageDot} />
                  )}

                  {!isLast ? (
                    <View
                      style={[
                        styles.stageLine,
                        done && styles.stageLineDone,
                      ]}
                    />
                  ) : null}
                </View>

                <View style={styles.stageTextBox}>
                  <Text
                    style={[
                      styles.stageLabel,
                      done && styles.stageLabelDone,
                      active && styles.stageLabelActive,
                    ]}
                  >
                    {tr(stage.label)}
                  </Text>

                  <Text style={styles.stageSub}>
                    {done ? tr('stage_done') : active ? tr('stage_now') : tr('stage_pending')}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Booking details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tr('td_bookingDetails')}</Text>

          <Row label={tr('mandi')} value={centreLabel(token.centreName, lang)} />
          <Row label={tr('address')} value={token.centreAddress} />
          <Row label={tr('date')} value={token.date} />
          <Row label={tr('time')} value={passLabel(token)} />
          <Row label={tr('crop')} value={cropLabel(token, lang)} />
          <Row
            label={tr('approxQuantity')}
            value={`${token.approxQuantityQuintals} ${tr('quintal')}`}
          />
          <Row label={tr('vehicle')} value={Array.isArray(token.vehicles) && token.vehicles.length > 1 ? token.vehicles.map((v) => v.plate).join(', ') : (token.vehicleNumber || tr('td_atGate'))} />
        </View>

        {/* Price decision: after assay, before weighing */}
        {token.status === STATUS.ASSAY ? (
          <View style={[styles.card, styles.priceCard]}>
            <Text style={styles.cardTitle}>{tr('td_fixPrice')}</Text>
            <Text style={styles.priceHint}>
              {tr('td_fixPriceHint', { grade: gradeLabel(token.grade, lang) })}
            </Text>

            {advertisedMsp > 0 ? (
            <View style={styles.priceOption}>
              <View style={{ flex: 1 }}>
                <Text style={styles.priceTitle}>{tr('td_mspTitle')}</Text>
                <Text style={styles.priceBig}>₹{msp} {tr('perQuintal')}</Text>
                {priced.deduction > 0 ? (
                  <View style={styles.deductBox}>
                    <Text style={styles.deductLine}>{tr('msp_advertised', { a: advertisedMsp })}</Text>
                    <Text style={[styles.deductLine, { color: Colors.error }]}>{tr('msp_deduction', { d: priced.deduction, g: gradeLabel(token.grade, lang) })}</Text>
                    <Text style={styles.deductWhy}>{tr(priced.reasonKey)}</Text>
                    {priced.factors.map((f) => (
                      <Text key={f.key} style={styles.deductWhy}>• {tr(f.key, f.params)}</Text>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.priceSub}>{tr('msp_fullFaq')}</Text>
                )}
              </View>
              <PrimaryButton
                title={tr('td_sellMsp')}
                loading={fixing}
                onPress={acceptMsp}
                style={{ height: 44, paddingHorizontal: 14 }}
              />
            </View>
            ) : (
              <Text style={styles.priceHint}>{tr('td_noMsp')}</Text>
            )}

            {/* ---- e-Auction ---- */}
            {!auction || auction.status === AUCTION_STATUS.REJECTED ? (
              <View style={styles.priceOption}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.priceTitle}>{tr('td_auctionTitle')}</Text>
                  <Text style={styles.priceSub}>
                    {tr('td_auctionSub', { msp })}
                  </Text>
                  {auction?.status === AUCTION_STATUS.REJECTED ? (
                    <Text style={[styles.priceSub, { color: Colors.error }]}>
                      {tr('td_prevRejected')}
                    </Text>
                  ) : null}
                </View>
                <PrimaryButton
                  title={auction ? tr('td_reAuction') : tr('td_startAuction')}
                  variant="outline"
                  loading={auctionBusy}
                  onPress={startAuction}
                  style={{ height: 44, paddingHorizontal: 14 }}
                />
              </View>
            ) : (
              <View style={[styles.priceOption, styles.auctionLive]}>
                <View style={{ flex: 1 }}>
                  <View style={styles.auctionHead}>
                    <Text style={styles.priceTitle}>
                      {isBiddingOpen(auction) ? tr('td_live') : tr('td_ended')}
                    </Text>
                    <Text style={styles.countdown}>
                      {formatCountdown(secondsLeft(auction))}
                    </Text>
                  </View>

                  {auction.highestBid ? (
                    <>
                      <Text style={styles.priceBig}>₹{auction.highestBid} {tr('perQuintal')}</Text>
                      <Text style={styles.priceSub}>
                        {tr('td_highest', { who: auction.highestBidderName, n: auction.bidCount })}
                      </Text>
                      {auction.highestBid > msp ? (
                        <Text style={[styles.priceSub, { color: '#16A34A', fontWeight: '800' }]}>
                          {tr('td_aboveMsp', { d: auction.highestBid - msp })}
                        </Text>
                      ) : null}
                    </>
                  ) : (
                    <Text style={styles.priceSub}>{tr('td_noBids')}</Text>
                  )}

                  <View style={styles.auctionActions}>
                    {auction.highestBid ? (
                      <PrimaryButton
                        title={tr('td_acceptBid')}
                        loading={auctionBusy}
                        onPress={acceptBid}
                        style={{ flex: 1, height: 42 }}
                      />
                    ) : null}
                    {!isBiddingOpen(auction) && !auction.highestBid ? (
                      <PrimaryButton
                        title={tr('td_more5')}
                        variant="outline"
                        onPress={extend}
                        style={{ height: 42, paddingHorizontal: 12 }}
                      />
                    ) : null}
                    <PrimaryButton
                      title={tr('td_reject')}
                      variant="danger"
                      onPress={rejectBids}
                      style={{ height: 42, paddingHorizontal: 12 }}
                    />
                  </View>
                </View>
              </View>
            )}
          </View>
        ) : null}

        {token.ratePerQuintal && token.status !== STATUS.ASSAY ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{tr('td_fixedPrice')}</Text>
            <Row
              label={tr('price')}
              value={`₹${token.ratePerQuintal} ${tr('perQuintal')}`}
              bold
            />
            <Row
              label={tr('td_mode')}
              value={token.priceMode === 'auction' ? tr('td_auction') : 'MSP'}
            />
            <Row label={tr('td_buyer')} value={token.priceMode === 'msp' || !token.buyerName || /\(MSP\)/.test(token.buyerName) ? tr('td_govBuyer') : token.buyerName} />
            {token.pricing && token.pricing.deduction > 0 ? (
              <View style={styles.deductBox}>
                <Text style={styles.deductLine}>{tr('msp_advertised', { a: token.pricing.advertised })}</Text>
                <Text style={[styles.deductLine, { color: Colors.error }]}>{tr('msp_deduction', { d: token.pricing.deduction, g: gradeLabel(token.pricing.grade, lang) })}</Text>
                <Text style={styles.deductWhy}>{tr(token.pricing.reasonKey)}</Text>
                {(token.pricing.factors || []).map((f) => (
                  <Text key={f.key} style={styles.deductWhy}>• {tr(f.key, f.params)}</Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Assay results, once recorded */}
        {token.assayAt ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{tr('as_title')}</Text>
            <Row label={tr('grade')} value={gradeLabel(token.grade, lang)} />
            <Row label={tr('moisture')} value={`${token.moisturePercent}%`} />
            <Row
              label={tr('foreignMatter')}
              value={`${token.foreignMatterPercent}%`}
            />
            {token.assayNotes ? (
              <Row label={tr('notes')} value={token.assayNotes} />
            ) : null}
          </View>
        ) : null}

        {/* Weighing, once recorded */}
        {token.weighedAt ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{tr('td_weighing')}</Text>
            <Row
              label={tr('td_gross')}
              value={`${token.grossWeightQuintals} ${tr('quintal')}`}
            />
            <Row
              label={tr('td_tare')}
              value={`${token.tareWeightQuintals} ${tr('quintal')}`}
            />
            <Row
              label={tr('td_net')}
              value={`${token.actualQuantity} ${tr('quintal')}`}
              bold
            />
            <Row
              label={tr('td_declared')}
              value={`${token.declaredQuintals || token.approxQuantityQuintals} ${tr('quintal')}`}
            />
            {token.quantityVariancePercent != null ? (
              <Row
                label={tr('td_difference')}
                value={`${token.quantityVariancePercent > 0 ? '+' : ''}${token.quantityVariancePercent}%`}
              />
            ) : null}
            {token.overDeclaredTolerance ? (
              <View style={styles.varianceNote}>
                <Ionicons name="information-circle-outline" size={18} color="#92400E" />
                <Text style={styles.varianceNoteText}>
                  {tr(token.quantityVariancePercent > 0 ? 'td_varianceOver' : 'td_varianceUnder', { d: token.declaredQuintals || token.approxQuantityQuintals, a: token.actualQuantity, p: Math.abs(Math.round(token.quantityVariancePercent)) })}
                </Text>
              </View>
            ) : null}
            {Array.isArray(token.vehicles) && token.vehicles.length > 0 ? (
              <View>
                <TouchableOpacity onPress={() => setShowTrucks((v) => !v)} style={styles.trucksToggle}>
                  <Text style={styles.trucksToggleText}>
                    {showTrucks ? tr('td_hideTrucks') : tr('td_showTrucks', { n: token.vehicles.length })}
                  </Text>
                  <Ionicons name={showTrucks ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.primary} />
                </TouchableOpacity>
                {showTrucks ? token.vehicles.map((v) => {
                  const perDeclared = Math.round(((token.declaredQuintals || token.approxQuantityQuintals || 0) / token.vehicles.length) * 10) / 10;
                  return (
                    <View key={v.serial} style={styles.truckRow}>
                      <Text style={styles.truckTitle}>{tr('gs_vehicleN', { n: v.serial })} • {v.plate || '—'}</Text>
                      <Text style={styles.truckLine}>{tr('td_gross')}: {v.grossWeightQuintals} • {tr('td_tare')}: {v.tareWeightQuintals}</Text>
                      <Text style={styles.truckLine}>{tr('td_net')}: <Text style={{ fontWeight: '900' }}>{v.netQuintals} {tr('quintalShort')}</Text>  •  {tr('td_declaredShare', { q: perDeclared })}</Text>
                    </View>
                  );
                }) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Payment receipt */}
        {token.status === STATUS.PAID ? (
          <View style={[styles.card, styles.receiptCard]}>
            <Text style={styles.cardTitle}>{tr('td_receipt')}</Text>
            {token.parchi?.imageBase64 ? (
              <View style={styles.twoSlips}>
                <Ionicons name="documents-outline" size={18} color={Colors.secondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.twoSlipsTitle}>{tr('pc_bothSlips')}</Text>
                  <Text style={styles.twoSlipsSub}>{tr('pc_bothSlipsSub')}</Text>
                </View>
              </View>
            ) : null}
            <Text style={styles.slipLabel}>{tr('pc_officialTitle')}</Text>

            <Row label={tr('td_receiptNo')} value={token.receiptId} />
            <Row label={tr('quantity')} value={`${token.actualQuantity} ${tr('quintal')}`} />
            <Row label={tr('rate')} value={`₹${token.ratePerQuintal} ${tr('perQuintal')}`} />
            <Row label={tr('td_total')} value={`₹${token.grossAmount}`} />
            <Row label={tr('td_mandiFee')} value={`− ₹${token.mandiFee}`} />
            <Row label={tr('td_commission')} value={`− ₹${token.commission}`} />
            <Row label={tr('td_hamali')} value={`− ₹${token.hamali}`} />

            <View style={styles.netRow}>
              <Text style={styles.netLabel}>{tr('td_netPay')}</Text>
              <Text style={styles.netValue}>
                ₹{Number(token.netPayable).toLocaleString('en-IN')}
              </Text>
            </View>

            {token.paymentReference ? (
              <Text style={styles.utr}>
                {tr('td_ref', { ref: token.paymentReference })}
              </Text>
            ) : null}

            {token.parchi?.imageBase64 ? (
              <View style={styles.parchiCard}>
                <Text style={styles.slipLabel}>{tr('pc_farmerTitle')}</Text>
                <Text style={styles.parchiHint}>{tr('pc_farmerHint')}</Text>
                <TouchableOpacity onPress={() => setParchiOpen(true)} activeOpacity={0.9}>
                  <Image
                    source={{ uri: token.parchi.imageBase64 }}
                    style={styles.parchiThumb}
                    resizeMode="cover"
                  />
                  <Text style={styles.parchiTap}>{tr('pc_tapToView')}</Text>
                </TouchableOpacity>
                <View style={styles.compareRow}>
                  <View style={styles.compareBox}>
                    <Text style={styles.compareLbl}>{tr('pc_parchiRate')}</Text>
                    <Text style={styles.compareVal}>₹{token.parchi.rate}</Text>
                  </View>
                  <Ionicons
                    name={token.parchi.matchesFixedRate ? 'checkmark-circle' : 'alert-circle'}
                    size={28}
                    color={token.parchi.matchesFixedRate ? '#16A34A' : '#DC2626'}
                  />
                  <View style={styles.compareBox}>
                    <Text style={styles.compareLbl}>{tr('pc_paidRate')}</Text>
                    <Text style={styles.compareVal}>₹{token.ratePerQuintal}</Text>
                  </View>
                </View>
                {token.parchi.capturedBy || token.parchi.capturedAt ? (
                  <Text style={styles.utr}>
                    {tr('pc_capturedBy', {
                      by: token.parchi.capturedBy || 'APMC',
                      at: new Date(token.parchi.capturedAt).toLocaleString('en-IN'),
                    })}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <PrimaryButton
              title={token.parchi?.imageBase64 ? tr('pc_downloadBoth') : tr('td_downloadReceipt')}
              loading={downloading}
              onPress={handleDownload}
              style={{ marginTop: 14 }}
            />
          </View>
        ) : null}

        <Modal visible={parchiOpen} transparent animationType="fade" onRequestClose={() => setParchiOpen(false)}>
          <View style={styles.viewer}>
            <TouchableOpacity style={styles.viewerClose} onPress={() => setParchiOpen(false)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            {token.parchi?.imageBase64 ? (
              <Image source={{ uri: token.parchi.imageBase64 }} style={styles.viewerImg} resizeMode="contain" />
            ) : null}
          </View>
        </Modal>

        {token.status === STATUS.BOOKED && view?.slotState !== 'passed' ? (
          canCancel(token) ? (
            <PrimaryButton
              title={tr('td_cancelBooking')}
              variant="danger"
              loading={cancelling}
              onPress={confirmCancel}
              style={{ marginTop: 4 }}
            />
          ) : (
            <Text style={styles.cancelNote}>{tr('td_cancelClosed', { h: CANCEL_HOURS })}</Text>
          )
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function PulsingDot() {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.35,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);

  return (
    <View style={styles.pulseWrap}>
      <Animated.View
        style={[styles.pulseHalo, { transform: [{ scale }] }]}
      />
      <View style={[styles.stageDot, styles.stageDotActive]} />
    </View>
  );
}

function Row({ label, value, bold }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.rowValueBold]}>
        {value || '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 18, paddingBottom: 30 },

  notFound: { textAlign: 'center', color: Colors.subText, marginTop: 40 },

  tokenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tokenLabel: { fontSize: 12, color: Colors.subText, fontWeight: '700' },
  tokenNumber: { fontSize: 24, fontWeight: '900', color: Colors.navy },

  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  receiptCard: { borderColor: Colors.secondary, borderWidth: 2 },
  priceCard: { borderColor: '#F59E0B', borderWidth: 2 },
  priceHint: { color: Colors.subText, fontSize: 13, marginBottom: 12 },
  lateBox: { backgroundColor: '#FEE2E2', borderColor: '#DC2626', borderWidth: 1.5, borderRadius: 14, padding: 14, marginBottom: 16 },
  lateTitle: { fontWeight: '900', color: '#991B1B', fontSize: 15 },
  lateSub: { color: '#991B1B', fontSize: 13, marginTop: 4, lineHeight: 18 },
  cancelNote: { color: Colors.subText, fontSize: 12, textAlign: 'center', marginTop: 4, lineHeight: 17 },
  varianceNote: { flexDirection: 'row', gap: 8, backgroundColor: '#FEF3C7', borderRadius: 8, padding: 10, marginTop: 8 },
  varianceNoteText: { flex: 1, color: '#92400E', fontSize: 12, lineHeight: 17 },
  deductBox: { marginTop: 6, backgroundColor: '#FFF7ED', borderRadius: 8, padding: 8 },
  deductLine: { fontSize: 12, fontWeight: '800', color: Colors.navy },
  deductWhy: { fontSize: 12, color: Colors.subText, marginTop: 2, lineHeight: 16 },
  trucksToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  trucksToggleText: { color: Colors.primary, fontWeight: '800', fontSize: 13 },
  truckRow: { backgroundColor: Colors.background, borderRadius: 8, padding: 10, marginBottom: 8 },
  truckTitle: { fontWeight: '900', color: Colors.navy, fontSize: 13 },
  truckLine: { color: Colors.subText, fontSize: 12, marginTop: 2 },
  priceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  priceTitle: { fontWeight: '800', color: Colors.navy, fontSize: 14 },
  priceBig: { fontWeight: '900', color: '#16A34A', fontSize: 20 },
  priceSub: { color: Colors.subText, fontSize: 12 },
  auctionLive: { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  auctionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  countdown: { fontSize: 18, fontWeight: '900', color: '#B45309', fontVariant: ['tabular-nums'] },
  auctionActions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.navy,
    marginBottom: 12,
  },

  stageRow: { flexDirection: 'row', alignItems: 'flex-start' },
  stageLeft: { width: 28, alignItems: 'center' },
  stageDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageDotDone: { backgroundColor: GREEN, borderColor: GREEN },
  stageDotActive: { backgroundColor: AMBER, borderColor: AMBER },
  stageTick: { color: Colors.white, fontSize: 14, fontWeight: '900' },
  stageLine: {
    width: 3,
    height: 22,
    backgroundColor: Colors.border,
    marginVertical: 2,
  },
  stageLineDone: { backgroundColor: GREEN },
  pulseWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseHalo: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: AMBER,
    opacity: 0.3,
  },
  stageTextBox: { flex: 1, marginLeft: 10, paddingBottom: 12 },
  stageLabel: { fontSize: 14, color: Colors.subText, fontWeight: '600' },
  stageLabelDone: { color: GREEN, fontWeight: '800' },
  stageLabelActive: { color: AMBER, fontWeight: '900' },
  stageSub: { fontSize: 12, color: Colors.subText, marginTop: 1 },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 12,
  },
  rowLabel: { fontSize: 13, color: Colors.subText, flex: 1 },
  rowValue: {
    fontSize: 13,
    color: Colors.navy,
    fontWeight: '700',
    flex: 1.4,
    textAlign: 'right',
  },
  rowValueBold: { fontSize: 14, fontWeight: '900' },

  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  netLabel: { fontSize: 14, fontWeight: '800', color: Colors.navy },
  netValue: { fontSize: 20, fontWeight: '900', color: Colors.secondary },
  utr: { fontSize: 11, color: Colors.subText, marginTop: 8 },
  twoSlips: {
    flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: Colors.accent,
    borderRadius: 10, padding: 10, marginBottom: 10,
  },
  twoSlipsTitle: { fontWeight: '900', color: Colors.secondary, fontSize: 14 },
  twoSlipsSub: { fontSize: 12, color: Colors.navy, marginTop: 2 },
  slipLabel: { fontSize: 12, fontWeight: '800', color: Colors.subText, textTransform: 'uppercase', marginBottom: 6 },
  parchiCard: {
    marginTop: 14, backgroundColor: '#FFFBEB', borderWidth: 1.5, borderColor: '#F59E0B',
    borderRadius: 12, padding: 12,
  },
  parchiHint: { fontSize: 13, color: '#92400E', lineHeight: 17, marginBottom: 8 },
  parchiThumb: { width: '100%', height: 180, borderRadius: 10, backgroundColor: '#111' },
  parchiTap: { textAlign: 'center', fontSize: 12, color: Colors.subText, marginTop: 4 },
  compareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 },
  compareBox: { flex: 1, backgroundColor: Colors.white, borderRadius: 10, padding: 10, alignItems: 'center' },
  compareLbl: { fontSize: 11, color: Colors.subText, fontWeight: '700' },
  compareVal: { fontSize: 18, fontWeight: '900', color: Colors.navy, marginTop: 2 },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  viewerImg: { width: '100%', height: '85%' },
  viewerClose: { position: 'absolute', top: 44, right: 16, zIndex: 2, padding: 8 },
});
