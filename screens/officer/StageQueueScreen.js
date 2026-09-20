import React, { useCallback, useRef, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Pressable,
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
  passLabel,
  yardRef,
  slotState,
  expireMissedPasses,
  fetchRebookRequests,
  rebookLate,
  isSoon,
  passLabel as passLabelOf,
  transferState,
  expireTransferPasses,
  markHeaped,
  markBagged,
  markLiftedByTruck,
  fetchAwaitingLift,
  settleDueCredits,
  setAssayRound,
  subscribeToCentre,
  stageOf,
  STATUS,
} from '../../services/bookings';

import { getCurrentUserSession } from '../../services/auth';
import { cacheRows, loadCachedRows, loadPending, syncPending, onOfflineState, getState, markOnline, dismissConflict } from '../../services/offlineGate';
import { markGateEntry, reportGateConflict } from '../../services/bookings';

import { useLang } from '../../i18n/LanguageContext';
import { cropLabel, gradeLabel, normalizePlate } from '../../services/centres';
/*
 * A focused work list for ONE stage of the pipeline.
 *
 * The officer only sees vehicles that are waiting on them right
 * now, in position order, with a single obvious action. This is
 * far less error-prone at a busy gate than one long mixed list.
 */
export default function StageQueueScreen({ navigation, route }) {
  const { tr, lang, trError } = useLang();
  const { stageId } = route.params || {};
  const stage = getStageById(stageId);

  const [rows, setRows] = useState([]);
  const [lateReqs, setLateReqs] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const centreRef = useRef(null);
  // install55: optional steps (heap / bag / lift / credited) + inspector round + paid list for cashier
  const [centre, setCentre] = useState(null);
  const unsubCentre = useRef(null);
  const [ask, setAsk] = useState(null);          // { kind:'shed'|'bags'|'round'|'utr', token }
  const [askText, setAskText] = useState('');
  const [showDone, setShowDone] = useState(false);
  // install56: offline gate - cached list, pending entries, connectivity banner
  const [net, setNet] = useState(getState());
  const [pending, setPending] = useState([]);
  const [cacheAt, setCacheAt] = useState(null);
  const [syncing, setSyncing] = useState(false);
  // install59: lifting recorded at the gate, per truck
  const [awaitLift, setAwaitLift] = useState([]);
  const [liftPick, setLiftPick] = useState({});
  const [liftPlate, setLiftPlate] = useState('');
  const [liftOpen, setLiftOpen] = useState(false);
  const refreshLift = async (cid) => { if (!cid) return; try { await settleDueCredits(cid); setAwaitLift(await fetchAwaitingLift(cid)); } catch (e) { /* offline */ } };
  const doLift = async () => {
    const ids = Object.keys(liftPick).filter((k) => liftPick[k]);
    if (!ids.length) return;
    const plate = liftPlate.trim() ? normalizePlate(liftPlate) : '';
    setBusyId('lift');
    try {
      const n = await markLiftedByTruck(centreRef.current, ids, { plate });
      setLiftPick({}); setLiftPlate('');
      Alert.alert(tr('sq_liftDone'), tr('sq_liftDoneSub', { n, p: plate || '—' }));
      await refreshLift(centreRef.current);
    } catch (e) { Alert.alert(tr('error'), trError(e, 'notRecorded')); }
    finally { setBusyId(null); }
  };

  const refreshPending = async (cid) => { if (cid) setPending(await loadPending(cid)); };
  const doSync = async () => {
    const cid = centreRef.current;
    if (!cid) return;
    setSyncing(true);
    try {
      const res = await syncPending(cid, (rec) => markGateEntry(rec.tokenId, rec.plates[0], rec.verifiedBy, rec.plates.map((p, i) => ({ serial: i + 1, plate: p })), rec.presentedBy, rec.at));
      // install57: tell the admin (Reports -> Conflicts) about every rejected entry
      for (const c of res.conflictRows || []) { try { await reportGateConflict(cid, c); } catch (e) { /* offline again - stays on device */ } }
      await refreshPending(cid);
      if (res.synced || res.conflicts) Alert.alert(tr('og_syncDone'), tr('og_syncBody', { s: res.synced, c: res.conflicts, l: res.left }));
      else if (res.left) Alert.alert(tr('og_stillOffline'), tr('og_stillOfflineSub'));
    } finally { setSyncing(false); }
  };

  const runOptional = async (kind, token, value) => {
    setBusyId(token?.tokenId || kind);
    try {
      if (kind === 'shed') await markHeaped(token.tokenId, value);
      else if (kind === 'bags') await markBagged(token.tokenId, value);
      else if (kind === 'round') await setAssayRound(centreRef.current, value);
      setAsk(null); setAskText('');
    } catch (e) {
      Alert.alert(tr('error'), trError(e, 'notRecorded'));
    } finally {
      setBusyId(null);
    }
  };

  // install49: officer presses "Re-book" on a late farmer's request.
  // System looks at the WHOLE remaining day; if nothing fits, asks the
  // officer to offer the farmer the next date with room.
  const handleLateRebook = async (req) => {
    setBusyId(req.tokenId);
    try {
      const res = await rebookLate(req.tokenId);
      if (!res.needsNextDay) {
        Alert.alert(tr('sq_lateDone'), tr('sq_lateDoneBody', { pass: passLabelOf(res.booking) }));
        setLateReqs((l) => l.filter((x) => x.tokenId !== req.tokenId));
        return;
      }
      if (!res.next?.date) {
        Alert.alert(tr('sq_lateNone'), tr('sq_lateNoneBody'));
        return;
      }
      Alert.alert(
        tr('sq_lateNextTitle'),
        tr('sq_lateNextBody', { date: res.next.date, hour: res.next.label || '' }),
        [
          { text: tr('sq_lateGoHome'), style: 'cancel' },
          {
            text: tr('sq_lateBookIt'),
            onPress: async () => {
              try {
                const r2 = await rebookLate(req.tokenId, { date: res.next.date });
                if (r2.booking) {
                  Alert.alert(tr('sq_lateDone'), tr('sq_lateDoneBody', { pass: passLabelOf(r2.booking) }));
                  setLateReqs((l) => l.filter((x) => x.tokenId !== req.tokenId));
                } else Alert.alert(tr('sq_lateNone'), tr('sq_lateNoneBody'));
              } catch (e) { Alert.alert(tr('error'), trError(e, 'notRecorded')); }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert(tr('error'), trError(e, 'notRecorded'));
    } finally {
      setBusyId(null);
    }
  };

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

        centreRef.current = user.centreId;
        // install56: show the cached list at once (works with no network), then live data replaces it
        if (stage?.action === 'gate') {
          const cached = await loadCachedRows(user.centreId, new Date().toISOString().slice(0, 10));
          if (alive && cached.rows.length && !rows.length) { setRows(cached.rows); setCacheAt(cached.at); }
          refreshPending(user.centreId);
          refreshLift(user.centreId);
        }
        if (stage?.id === 'payment') settleDueCredits(user.centreId).catch(() => {});
        unsubCentre.current = subscribeToCentre(user.centreId, (c) => alive && setCentre(c));
        unsub.current = subscribeToTodaysQueue(user.centreId, null, (list) => {
          if (alive) setRows(list);
          markOnline(true);
          if (stage?.action === 'gate') { cacheRows(user.centreId, list[0]?.date || new Date().toISOString().slice(0, 10), list); setCacheAt(new Date().toISOString()); }
          // install49: refresh the "I'm late, re-book me" requests box
          if (stage?.action === 'gate') fetchRebookRequests(user.centreId).then((r) => alive && setLateReqs(r)).catch(() => {});
          // install42: passes whose hour ended without entry expire here
          // (room goes back to the hour). No-op in TESTING_MODE.
          if (stage?.action === 'gate') expireMissedPasses(list).catch(() => {});
          // install53: transfer passes whose 90-min window is over expire (no penalty)
          if (stage?.action === 'gate') expireTransferPasses(list).catch(() => {});
        });
      };

      start();

      const offNet = onOfflineState((st) => { if (alive) { setNet(st); if (st.pending != null) refreshPending(centreRef.current); } });
      return () => {
        alive = false;
        offNet();
        if (unsub.current) {
          unsub.current();
          unsub.current = null;
        }
        if (unsubCentre.current) {
          unsubCentre.current();
          unsubCentre.current = null;
        }
      };
    }, [])
  );

  if (!stage) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader navigation={navigation} showBack />
        <Text style={styles.empty}>{tr('sq_notFound')}</Text>
      </SafeAreaView>
    );
  }

  const list = rows.filter((r) => stage.statuses.includes(r.status));
  // install55: cashier / admin also see today's PAID lots to mark lifted / credited
  const doneList = stage.id === 'payment' ? rows.filter((r) => r.status === STATUS.PAID) : [];
  const sheds = Array.isArray(centre?.sheds) ? centre.sheds : [];

  const noShow = (tokenId) => {
    Alert.alert(tr('noShowQ'), tr('noShowSub'), [
      { text: tr('cancel'), style: 'cancel' },
      {
        text: tr('yes'),
        style: 'destructive',
        onPress: async () => {
          try {
            await markNoShow(tokenId);
          } catch (error) {
            Alert.alert(tr('error'), trError(error, 'notRecorded'));
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
      <AppHeader navigation={navigation} showBack title={tr(stage.titleKey || stage.title)} />

      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle
          title={tr(stage.titleKey || stage.title)}
          subtitle={tr('sq_pendingLine', { n: list.length, sub: tr(stage.subtitleKey || stage.subtitle) })}
        />

        {/* install59: lifting trucks leave through the gate - tick the lots a truck carries */}
        {stage.action === 'gate' && awaitLift.length > 0 ? (
          <View style={styles.liftBox}>
            <TouchableOpacity style={styles.doneHead} onPress={() => setLiftOpen((v) => !v)}>
              <Text style={styles.doneTitle}>{tr('sq_liftTitle', { n: awaitLift.length })}</Text>
              <Ionicons name={liftOpen ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.subText} />
            </TouchableOpacity>
            {liftOpen ? (
              <>
                <Text style={styles.liftSub}>{tr('sq_liftSub')}</Text>
                <TextInput style={styles.liftPlate} placeholder={tr('sq_liftPlate')} autoCapitalize="characters" value={liftPlate} onChangeText={setLiftPlate} />
                {awaitLift.map((b) => {
                  const on = Boolean(liftPick[b.tokenId]);
                  return (
                    <TouchableOpacity key={b.tokenId} style={styles.liftRow} onPress={() => setLiftPick((p) => ({ ...p, [b.tokenId]: !on }))}>
                      <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? Colors.secondary : Colors.subText} />
                      <Text style={styles.liftName}>{b.farmerName} · #{yardRef(b)}</Text>
                      <Text style={styles.liftQ}>{b.actualQuantity || b.approxQuantityQuintals} {tr('quintalShort')}{b.bags ? ` · ${b.bags} ${tr('sq_bagsShort')}` : ''}</Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity style={[styles.syncBtn, { alignSelf: 'flex-start', marginTop: 8 }]} disabled={busyId === 'lift' || !Object.values(liftPick).some(Boolean)} onPress={doLift}>
                  <Text style={{ color: Colors.white, fontWeight: '800' }}>{tr('sq_liftGo', { n: Object.values(liftPick).filter(Boolean).length })}</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        ) : null}

        {/* install56: offline banner + pending entries */}
        {stage.action === 'gate' && (!net.online || pending.length > 0) ? (
          <View style={[styles.offBox, net.online && styles.offBoxOk]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name={net.online ? 'cloud-upload-outline' : 'cloud-offline-outline'} size={20} color={net.online ? Colors.secondary : '#B45309'} />
              <Text style={styles.offTitle}>{net.online ? tr('og_backOnline') : tr('og_offline')}</Text>
            </View>
            <Text style={styles.offSub}>
              {net.online ? tr('og_pendingN', { n: pending.filter((p) => p.status === 'pending').length }) : tr('og_offlineSub', { t: cacheAt ? String(cacheAt).slice(11, 16) : '—' })}
            </Text>
            {pending.filter((p) => p.status === 'conflict').map((p) => (
              <View key={p.id} style={styles.conflictRow}>
                <Text style={styles.conflictText}>{tr('og_conflict', { t: p.tokenId.slice(-6), e: p.error })}</Text>
                <TouchableOpacity onPress={async () => { await dismissConflict(centreRef.current, p.id); refreshPending(centreRef.current); }}>
                  <Ionicons name="close-circle" size={20} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={[styles.syncBtn, syncing && styles.primaryDim]} disabled={syncing} onPress={doSync}>
              <Ionicons name="sync-outline" size={16} color={Colors.white} />
              <Text style={styles.primaryText}>{syncing ? '…' : tr('og_syncNow')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {stage.action === 'gate' ? (
          <TouchableOpacity
            style={styles.scanBtn}
            onPress={() => navigation.navigate('GateScan', { rows, centreId: centreRef.current, lanes: centre?.parallelLanes || 2 })}
          >
            <Ionicons name="qr-code-outline" size={22} color={Colors.white} />
            <Text style={styles.scanBtnText}>
              {tr('sq_scanBtn')}
            </Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.white} />
          </TouchableOpacity>
        ) : null}

        {stage.id === 'assay' ? (
          <TouchableOpacity style={styles.roundBox} onPress={() => { setAskText(centre?.assayRound?.at || ''); setAsk({ kind: 'round' }); }}>
            <Ionicons name="walk-outline" size={20} color={Colors.secondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.roundTitle}>{tr('sq_roundTitle')}</Text>
              <Text style={styles.roundSub}>{centre?.assayRound?.at ? tr('sq_roundAt', { t: centre.assayRound.at }) : tr('sq_roundNone')}</Text>
            </View>
            <Ionicons name="create-outline" size={18} color={Colors.subText} />
          </TouchableOpacity>
        ) : null}

        {list.length === 0 ? (
          <View style={styles.clearBox}>
            <Ionicons name="checkmark-circle" size={40} color="#2E7D32" />
            <Text style={styles.clearText}>{tr('sq_clear')}</Text>
          </View>
        ) : stage.action === 'gate' ? (
          /*
           * install43: the gate list is three COLOUR BLOCKS, readable
           * from a metre away: green = hour open (admit in arrival
           * order), red = hour passed (rebook on arrival), grey = later.
           */
          [
            { key: 'late', style: styles.blockLate, title: tr('sq_blockLate'), rows: lateReqs },
            // install53: transfer passes are valid for a window, not an hour -> they sit in the green block while valid
            { key: 'open', style: styles.blockOpen, title: tr('sq_blockOpen'), rows: list.filter((t) => transferState(t) === 'valid' || (!transferState(t) && slotState(t) === 'open')) },
            { key: 'soon', style: styles.blockSoon, title: tr('sq_blockSoon'), rows: list.filter((t) => !transferState(t) && slotState(t) === 'before' && isSoon(t)) },
            { key: 'passed', style: styles.blockPassed, title: tr('sq_blockPassed'), rows: list.filter((t) => transferState(t) === 'expired' || (!transferState(t) && slotState(t) === 'passed')) },
            { key: 'before', style: styles.blockLater, title: tr('sq_blockLater'), rows: list.filter((t) => !transferState(t) && slotState(t) === 'before' && !isSoon(t)) },
          ].filter((b) => b.key !== 'late' || b.rows.length > 0).map((block) => (
            <View key={block.key} style={[styles.block, block.style]}>
              <View style={styles.blockHead}>
                <Text style={styles.blockTitle}>{block.title}</Text>
                <View style={styles.blockCount}><Text style={styles.blockCountText}>{block.rows.length}</Text></View>
              </View>
              {block.rows.length === 0 ? (
                <Text style={styles.blockEmpty}>{tr('sq_blockEmpty')}</Text>
              ) : (
                block.rows.map((token) => (
                  <View key={token.tokenId} style={styles.card}>
                    <View style={styles.top}>
                      <Text style={styles.token}>#{yardRef(token)}</Text>
                      <Text style={styles.slot}>{passLabel(token)}</Text>
                    </View>
                    <Text style={styles.name}>{token.farmerName}</Text>
                    {token.transferFrom ? (
                      <Text style={styles.tag}>{tr('gl_transfer')} · {tr('tf_badgeFrom', { from: token.transferFromName || token.transferFrom })} · {tr('tf_badge', { t: String(token.transferValidUntil || '').slice(11, 16) })}</Text>
                    ) : token.walkIn ? (
                      <Text style={styles.tag}>{tr('gl_walkIn')}</Text>
                    ) : null}
                    <Text style={styles.sub}>+91 {token.farmerPhone}</Text>
                    <Text style={styles.passCode}>{tr('sq_gatePass', { code: gatePassCodeOf(token) })}</Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.meta}>{cropLabel(token, lang)}</Text>
                      <Text style={styles.meta}>{token.approxQuantityQuintals} {tr('quintalShort')}</Text>
                    </View>
                    <View style={styles.actions}>
                      {block.key === 'late' ? (
                        <TouchableOpacity style={[styles.primary, busyId === token.tokenId && styles.primaryDim]} disabled={busyId === token.tokenId} onPress={() => handleLateRebook(token)}>
                          <Text style={styles.primaryText}>{busyId === token.tokenId ? '…' : tr('sq_lateRebookBtn')}</Text>
                          <Ionicons name="calendar-outline" size={16} color={Colors.white} />
                        </TouchableOpacity>
                      ) : block.key === 'passed' ? (
                        <TouchableOpacity style={styles.primary} onPress={() => navigation.navigate('GateRebook', { previous: token })}>
                          <Text style={styles.primaryText}>{tr('gs_rebook')}</Text>
                          <Ionicons name="arrow-forward" size={16} color={Colors.white} />
                        </TouchableOpacity>
                      ) : (
                        <>
                          <TouchableOpacity style={styles.outline} onPress={() => noShow(token.tokenId)}>
                            <Text style={styles.outlineText}>{tr('markNoShow')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.primary, block.key === 'before' && styles.primaryDim]} onPress={() => runAction(token)}>
                            <Text style={styles.primaryText}>{tr('sq_scanShort')}</Text>
                            <Ionicons name="arrow-forward" size={16} color={Colors.white} />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>
          ))
        ) : (
          list.map((token, index) => (
            <View
              key={token.tokenId}
              style={[styles.card, index === 0 && styles.cardFirst]}
            >
              {index === 0 ? (
                <View style={styles.nextTag}>
                  <Text style={styles.nextTagText}>{tr('sq_next')}</Text>
                </View>
              ) : null}

              <View style={styles.top}>
                <Text style={styles.token}>#{yardRef(token)}</Text>
                <Text style={styles.slot}>{passLabel(token)}</Text>
              </View>

              <Text style={styles.name}>{token.farmerName}</Text>
              <Text style={styles.sub}>+91 {token.farmerPhone}</Text>

              <View style={styles.metaRow}>
                <Text style={styles.meta}>
                  {cropLabel(token, lang)}
                </Text>
                <Text style={styles.meta}>
                  {token.vehicleCount > 1 ? tr('gs_nVehicles', { n: token.vehicleCount }) : (token.vehicleNumber || tr('vehiclePending'))}
                </Text>
                <Text style={styles.meta}>
                  {token.actualQuantity || token.approxQuantityQuintals} {tr('quintalShort')}
                </Text>
              </View>

              {token.grade ? (
                <Text style={styles.meta}>
                  {tr('sq_gradeLine', { g: gradeLabel(token.grade, lang), m: token.moisturePercent })}
                </Text>
              ) : null}

              {token.ratePerQuintal ? (
                <Text style={[styles.meta, { color: '#16A34A' }]}>
                  {tr('sq_priceLine', { rate: token.ratePerQuintal, mode: token.priceMode === 'auction' ? tr('sq_auctionBy', { who: token.buyerName }) : 'MSP' })}
                </Text>
              ) : null}

              {/* install55: fine stage + optional steps */}
              <Text style={styles.meta}>
                {tr('sq_stageLine', { s: tr(`fs_${stageOf(token)}`) })}
                {token.shedId ? ` • ${tr('sq_shed', { s: token.shedId })}` : ''}
                {token.bags ? ` • ${tr('sq_bags', { n: token.bags })}` : ''}
                {token.arhtiyaName ? ` • ${tr('sq_viaArhtiya', { a: token.arhtiyaName })}` : ''}
              </Text>
              {stage.id === 'assay' && !token.heapedAt ? (
                <TouchableOpacity style={styles.optBtn} onPress={() => (sheds.length ? setAsk({ kind: 'shed', token }) : runOptional('shed', token, token.arhtiyaShedId || 'YARD'))}>
                  <Ionicons name="layers-outline" size={16} color={Colors.secondary} />
                  <Text style={styles.optText}>{tr('sq_markHeaped')}</Text>
                </TouchableOpacity>
              ) : null}
              {stage.id === 'weighing' && !token.baggedAt ? (
                <TouchableOpacity style={styles.optBtn} onPress={() => { setAskText(''); setAsk({ kind: 'bags', token }); }}>
                  <Ionicons name="cube-outline" size={16} color={Colors.secondary} />
                  <Text style={styles.optText}>{tr('sq_markBagged')}</Text>
                </TouchableOpacity>
              ) : null}

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.primary}
                  onPress={() => runAction(token)}
                >
                  <Text style={styles.primaryText}>
                    {tr(stage.actionKey || stage.actionLabel)}
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

        {doneList.length > 0 ? (
          <View style={{ marginTop: 18 }}>
            <TouchableOpacity style={styles.doneHead} onPress={() => setShowDone((v) => !v)}>
              <Text style={styles.doneTitle}>{tr('sq_paidToday', { n: doneList.length })}</Text>
              <Ionicons name={showDone ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.subText} />
            </TouchableOpacity>
            {showDone ? doneList.map((token) => (
              <View key={token.tokenId} style={styles.card}>
                <View style={styles.top}>
                  <Text style={styles.token}>#{yardRef(token)}</Text>
                  <Text style={styles.slot}>{tr(`fs_${stageOf(token)}`)}</Text>
                </View>
                <Text style={styles.name}>{token.farmerName}</Text>
                <Text style={styles.meta}>{tr('sq_jformLine', { j: token.jformNo || '—', u: token.utr || '—' })}</Text>
                <Text style={styles.meta}>{token.liftedAt ? tr('sq_liftedAt', { t: String(token.liftedAt).slice(11, 16) }) : tr('sq_awaitLift')}  ·  {token.creditedAt ? tr('sq_creditedAuto') : tr('sq_creditPending')}</Text>
              </View>
            )) : null}
          </View>
        ) : null}
      </ScrollView>


      {/* install55: small input pop-up for shed / bags / round time / UTR */}
      <Modal visible={Boolean(ask)} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setAsk(null)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              {ask?.kind === 'shed' ? tr('sq_pickShed') : ask?.kind === 'bags' ? tr('sq_askBags') : ask?.kind === 'round' ? tr('sq_askRound') : tr('sq_askUtr')}
            </Text>
            {ask?.kind === 'shed' ? (
              sheds.map((sh) => (
                <TouchableOpacity key={sh.id} style={styles.shedRow} onPress={() => runOptional('shed', ask.token, sh.id)}>
                  <Text style={styles.shedName}>{sh.name || sh.id}</Text>
                  <Text style={styles.meta}>{Math.round(Number(centre?.shedUsedQ?.[sh.id]) || 0)} / {sh.floorCapacityQ} {tr('quintalShort')}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <>
                <TextInput
                  style={styles.modalInput}
                  value={askText}
                  onChangeText={setAskText}
                  keyboardType={ask?.kind === 'bags' ? 'numeric' : 'default'}
                  placeholder={ask?.kind === 'bags' ? '120' : ask?.kind === 'round' ? '11:30' : 'UTR / PFMS ref'}
                  placeholderTextColor="#999"
                  autoCapitalize="characters"
                />
                <TouchableOpacity style={styles.primary} onPress={() => runOptional(ask.kind, ask.token, askText)}>
                  <Text style={styles.primaryText}>{tr('save')}</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  liftBox: { backgroundColor: Colors.white, borderColor: Colors.border, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  liftSub: { color: Colors.subText, fontSize: 12, marginBottom: 8, lineHeight: 17 },
  liftPlate: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 8, fontSize: 15, fontWeight: '800', color: Colors.navy, marginBottom: 8, backgroundColor: Colors.white },
  liftRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  liftName: { flex: 1, fontSize: 14, fontWeight: '700', color: Colors.navy },
  liftQ: { fontSize: 12, color: Colors.subText },
  offBox: { backgroundColor: '#FEF3C7', borderColor: '#D97706', borderWidth: 1.5, borderRadius: 12, padding: 12, marginBottom: 12 },
  offBoxOk: { backgroundColor: '#E8F5E9', borderColor: '#A5D6A7' },
  offTitle: { fontWeight: '900', color: Colors.navy, fontSize: 15 },
  offSub: { color: Colors.text, fontSize: 13, marginTop: 4, lineHeight: 18 },
  conflictRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, backgroundColor: '#FEE2E2', borderRadius: 8, padding: 8 },
  conflictText: { flex: 1, color: '#991B1B', fontSize: 12, fontWeight: '700' },
  syncBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.secondary, borderRadius: 8, paddingVertical: 9, marginTop: 10 },
  roundBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#E8F5E9', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#A5D6A7' },
  roundTitle: { fontWeight: '800', color: Colors.navy, fontSize: 14 },
  roundSub: { color: Colors.subText, fontSize: 13, marginTop: 2 },
  optBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1.5, borderColor: Colors.secondary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 8, marginRight: 8 },
  optText: { color: Colors.secondary, fontWeight: '800', fontSize: 13 },
  doneHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  doneTitle: { fontWeight: '800', color: Colors.navy, fontSize: 15 },
  modal: { width: '85%', backgroundColor: Colors.white, borderRadius: 16, padding: 20 },
  modalTitle: { fontWeight: '800', color: Colors.navy, fontSize: 16, marginBottom: 12 },
  modalInput: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, height: 48, paddingHorizontal: 12, fontSize: 16, color: Colors.text, marginBottom: 12, backgroundColor: Colors.white },
  shedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  shedName: { fontWeight: '800', color: Colors.navy, fontSize: 15 },
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
  passCode: { marginTop: 4, color: Colors.primary, fontWeight: '900', fontSize: 14 },
  sheetPass: { color: Colors.primary, fontWeight: '800', fontSize: 13, marginBottom: 10 },

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
  nextTagText: { color: Colors.white, fontWeight: '900', fontSize: 11 },

  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  token: { fontSize: 22, fontWeight: '900', color: Colors.navy },
  block: { borderRadius: 16, padding: 12, marginBottom: 14, borderWidth: 2 },
  blockOpen: { backgroundColor: '#DCFCE7', borderColor: '#16A34A' },
  tag: { alignSelf: 'flex-start', backgroundColor: '#1D4ED8', color: '#FFFFFF', fontWeight: '800', fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 2, overflow: 'hidden' },
  blockPassed: { backgroundColor: '#FECACA', borderColor: '#B91C1C', borderWidth: 2 },
  blockSoon: { backgroundColor: '#FFEDD5', borderColor: '#F59E0B' },
  blockLate: { backgroundColor: '#FFF1F2', borderColor: '#E11D48', borderWidth: 2 },
  blockLater: { backgroundColor: '#F1F5F9', borderColor: '#94A3B8' },
  blockHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  blockTitle: { fontSize: 16, fontWeight: '900', color: Colors.navy, flex: 1 },
  blockCount: { minWidth: 30, height: 30, borderRadius: 15, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  blockCountText: { color: Colors.white, fontWeight: '900' },
  blockEmpty: { color: Colors.subText, fontWeight: '700', paddingVertical: 6 },
  primaryDim: { backgroundColor: '#94A3B8' },
  hourHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ECEFF1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
    marginTop: 4,
  },
  hourHeadOpen: { backgroundColor: '#E8F5E9' },
  hourHeadPassed: { backgroundColor: '#FFF3E0' },
  hourHeadText: { fontWeight: '900', color: Colors.navy, fontSize: 14 },
  hourHeadState: { fontWeight: '800', color: Colors.subText, fontSize: 12 },
  slot: { fontSize: 12, color: Colors.subText, fontWeight: '700' },

  name: { marginTop: 8, fontWeight: '800', color: Colors.text, fontSize: 15 },
  sub: { marginTop: 2, color: Colors.subText, fontSize: 13 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  meta: { fontSize: 12, color: Colors.navy, fontWeight: '700' },

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
    backgroundColor: Colors.error,
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: 8,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineText: { color: Colors.white, fontWeight: '800' },
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
  sheetSub: { color: Colors.subText, marginBottom: 12, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  note: { fontSize: 12, color: Colors.subText, marginTop: 8, marginBottom: 14 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cancel: { color: Colors.subText, fontWeight: '700', padding: 10 },
});
