/*
 * services/receipt.js
 * ---------------------------------------------------------------
 * Builds a PDF payment receipt for a paid token and opens the
 * phone's share / save sheet (WhatsApp, Files, Drive, print...).
 *
 * Uses expo-print (HTML -> PDF) and expo-sharing. Both work in
 * Expo Go. Install once:
 *     npx expo install expo-print expo-sharing
 * ---------------------------------------------------------------
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildGatePassQr, gatePassCodeOf } from './bookings';
import { translate } from '../i18n/translations';
import { cropLabel, gradeLabel } from './centres';

function money(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`;
}

function esc(v) {
  return String(v ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function row(label, value, cls = '') {
  return `<tr class="${cls}"><td>${esc(label)}</td><td class="v">${esc(
    value
  )}</td></tr>`;
}

export function buildReceiptHtml(token, lang = 'hi') {
  const t = token || {};
  const T = (k, p) => translate(k, lang, p);
  const Q = T('quintal');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Roboto, "Noto Sans Devanagari", sans-serif;
         color: #10233F; margin: 0; padding: 28px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start;
         border-bottom: 3px solid #1B7F3B; padding-bottom: 14px; }
  .brand { font-size: 24px; font-weight: 900; color: #1B7F3B; letter-spacing: 1px; }
  .sub { font-size: 12px; color: #5B6B82; margin-top: 2px; }
  .paid { background: #16A34A; color: #fff; font-weight: 800; padding: 6px 14px;
          border-radius: 20px; font-size: 13px; }
  h2 { font-size: 15px; margin: 22px 0 8px; color: #10233F;
       border-left: 4px solid #1B7F3B; padding-left: 8px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 7px 4px; font-size: 13px; border-bottom: 1px solid #E6EAF0; }
  td.v { text-align: right; font-weight: 700; }
  tr.ded td.v { color: #B42318; }
  tr.net td { font-size: 17px; font-weight: 900; color: #1B7F3B;
              border-top: 2px solid #1B7F3B; border-bottom: none; padding-top: 12px; }
  .token { font-size: 34px; font-weight: 900; color: #10233F; }
  .grid { display: flex; gap: 20px; }
  .grid > div { flex: 1; }
  .foot { margin-top: 30px; font-size: 11px; color: #5B6B82; text-align: center;
          border-top: 1px dashed #C9D1DC; padding-top: 12px; }
  .stamp { display:inline-block; margin-top:18px; border:2px solid #16A34A; color:#16A34A;
           font-weight:900; padding:6px 16px; border-radius:6px; transform: rotate(-4deg); }
</style>
</head>
<body>
  <div class="top">
    <div>
      <div class="brand">AGROBRIDGE</div>
      <div class="sub">${esc(t.centreName)}</div>
      <div class="sub">${esc(t.centreAddress || '')}</div>
    </div>
    <div style="text-align:right">
      <div class="paid">${T('st_paid')} / PAID</div>
      <div class="sub" style="margin-top:8px">${T('td_receiptNo')}: <b>${esc(
        t.receiptId
      )}</b></div>
      <div class="sub">${esc(fmtDateTime(t.paidAt))}</div>
    </div>
  </div>

  <div class="grid" style="margin-top:18px">
    <div>
      <div class="sub">${T('token')}</div>
      <div class="token">${esc(t.tokenNumber)}</div>
      <div class="sub">${T('token')} ID: ${esc(t.id || t.tokenId)}</div>
    </div>
    <div>
      <h2 style="margin-top:0">${T('farmer')}</h2>
      <table>
        ${row(T('name'), t.farmerName)}
        ${row(T('mobile'), t.farmerPhone)}
        ${row(T('vehicle'), t.vehicleNumber)}
      </table>
    </div>
  </div>

  <h2>${T('crop')} • ${T('grade')}</h2>
  <table>
    ${row(T('crop'), cropLabel(t, lang))}
    ${row(T('date') + ' / ' + T('pdf_slot'), `${t.date || ''}  ${t.slotWindow || ''}`)}
    ${row(T('grade'), gradeLabel(t.grade, lang))}
    ${row(T('moisture'), t.moisturePercent != null ? `${t.moisturePercent}%` : '—')}
    ${row(
      T('foreignMatter'),
      t.foreignMatterPercent != null ? `${t.foreignMatterPercent}%` : '—'
    )}
  </table>

  <h2>${T('td_weighing')}</h2>
  <table>
    ${row(T('td_gross'), `${t.grossWeightQuintals ?? '—'} ${Q}`)}
    ${row(T('td_tare'), `${t.tareWeightQuintals ?? '—'} ${Q}`)}
    ${row(T('td_net'), `${t.actualQuantity ?? '—'} ${Q}`)}
  </table>

  <h2>${T('td_receipt')}</h2>
  <table>
    ${row(T('rate'), `${money(t.ratePerQuintal)} / ${Q}`)}
    ${row(T('td_total'), money(t.grossAmount))}
    ${row(T('td_mandiFee'), `− ${money(t.mandiFee)}`, 'ded')}
    ${row(T('td_commission'), `− ${money(t.commission)}`, 'ded')}
    ${row(T('td_hamali'), `− ${money(t.hamali)}`, 'ded')}
    ${row(T('td_netPay'), money(t.netPayable), 'net')}
    ${t.paymentReference ? row(T('td_ref', { ref: '' }).replace(/[:：]\s*$/, '') + ' / UTR', t.paymentReference) : ''}
    ${t.paymentMode ? row(T('td_mode'), t.paymentMode) : ''}
  </table>

  <div class="stamp">✓ ${T('qv_paid_h')}</div>

  <div class="foot">
    ${T('pdf_generated')} • ${esc(
      fmtDateTime(new Date().toISOString())
    )}
  </div>
  ${parchiPage(t, lang)}
</body>
</html>`;
}

/*
 * Page 2 of the receipt: the arhtiya's hand-written parchi, only
 * when the payment was an offline bid. Gives the farmer both slips
 * in one file - the cashier's official receipt and the munim's slip.
 */
function parchiPage(t, lang) {
  const p = t?.parchi;
  if (!p?.imageBase64) return '';
  const T = (k, q) => translate(k, lang, q);
  const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
  return `
  <div style="page-break-before: always;"></div>
  <h1 style="margin-top:0">${T('pc_pdfPage')}</h1>
  <table>
    ${row(T('token'), t.tokenNumber || '')}
    ${row(T('farmer'), t.farmerName || '')}
    ${row(T('pc_parchiRate'), `${money(p.rate)} / ${T('quintal')}`)}
    ${row(T('pc_paidRate'), `${money(t.ratePerQuintal)} / ${T('quintal')}`, p.matchesFixedRate ? 'net' : 'ded')}
    ${p.note ? row(T('pc_note'), esc(p.note)) : ''}
    ${row(T('pc_capturedBy').replace(/\{by\}.*$/, '').trim() || T('pc_attached'),
      esc(`${p.capturedBy || '—'} • ${fmtDateTime(p.capturedAt)}`))}
  </table>
  <div style="text-align:center;margin-top:14px">
    <img src="${p.imageBase64}" style="max-width:100%;max-height:820px;border:1px solid #ccc;border-radius:8px" />
  </div>
  <div class="foot">${T('pc_bothSlipsSub')}</div>`;
}

/**
 * Generate the PDF and open the share sheet.
 * Returns the local file uri (also useful for debugging).
 */
export async function downloadReceiptPdf(token, lang = 'hi') {
  const html = buildReceiptHtml(token, lang);

  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const canShare = await Sharing.isAvailableAsync();

  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `${translate('td_receipt', lang)} ${token?.receiptId || token?.tokenNumber || ''}`,
      UTI: 'com.adobe.pdf',
    });
  } else {
    // Very rare (some emulators). Fall back to the system print dialog.
    await Print.printAsync({ uri });
  }

  return uri;
}


/* ------------------------------------------------------------------ */
/*  Gate pass PDF                                                      */
/* ------------------------------------------------------------------ */

/**
 * QR as an SVG string. Uses the same tiny generator as the on-screen
 * QR (react-native-qrcode-svg depends on the 'qrcode' package), so
 * no network is needed to build the PDF.
 */
function qrSvg(value, size = 180) {
  // eslint-disable-next-line global-require
  const QR = require('qrcode');
  const data = QR.create(value, { errorCorrectionLevel: 'M' });
  const n = data.modules.size;
  const bits = data.modules.data;
  const cell = size / (n + 8); // 4-module quiet zone
  let rects = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (bits[r * n + c]) {
        rects += `<rect x="${((c + 4) * cell).toFixed(2)}" y="${(
          (r + 4) *
          cell
        ).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(
          2
        )}"/>`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}

export function buildGatePassHtml(token, lang = 'hi') {
  const t = token || {};
  const T = (k, p) => translate(k, lang, p);
  const code = gatePassCodeOf(t);
  const qr = t.gatePassQr || buildGatePassQr(t.tokenId, code);
  const codePretty = code.replace(/(\d{3})(\d{3})/, '$1 $2');

  return `<!DOCTYPE html>
<html lang="${lang}"><head><meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Roboto, "Noto Sans Devanagari", sans-serif;
         color:#10233F; margin:0; padding:28px; }
  .pass { border:3px solid #10233F; border-radius:18px; overflow:hidden; max-width:640px; margin:0 auto; }
  .head { background:#10233F; color:#fff; padding:14px 20px; display:flex; justify-content:space-between; align-items:center; }
  .head .t { font-size:16px; font-weight:900; letter-spacing:1px; }
  .head .tok { font-size:30px; font-weight:900; }
  .body { display:flex; gap:24px; padding:22px; }
  .qr { border:1px solid #E6EAF0; border-radius:12px; padding:10px; }
  .info { flex:1; }
  .lbl { font-size:11px; color:#5B6B82; font-weight:700; margin-top:10px; }
  .val { font-size:15px; font-weight:700; }
  .code { font-size:40px; font-weight:900; color:#1B7F3B; letter-spacing:4px; }
  .foot { border-top:2px dashed #C9D1DC; padding:14px 20px; text-align:center; }
  .foot b { display:block; font-size:14px; }
  .foot span { font-size:12px; color:#5B6B82; }
  .brand { text-align:center; margin-top:18px; color:#1B7F3B; font-weight:900; font-size:13px; }
</style></head>
<body>
  <div class="pass">
    <div class="head"><div class="t">🎫 ${T('pdf_gatePassTitle')}</div><div class="tok">${esc(
      t.tokenNumber
    )}</div></div>
    <div class="body">
      <div class="qr">${qrSvg(qr, 200)}</div>
      <div class="info">
        <div class="lbl">${T('pdf_gatePassNo')}</div>
        <div class="code">${esc(codePretty)}</div>
        <div class="lbl">${T('farmer')}</div><div class="val">${esc(t.farmerName)} • +91 ${esc(
    t.farmerPhone
  )}</div>
        <div class="lbl">${T('gp_dateTime')}</div><div class="val">${esc(t.date)} • ${esc(
    t.slotWindow
  )}</div>
        <div class="lbl">${T('crop')} • ${T('approxQuantity')}</div><div class="val">${esc(
          cropLabel(t, lang)
        )} • ${esc(t.approxQuantityQuintals)} ${T('quintal')}</div>
        <div class="lbl">${T('vehicle')}</div><div class="val">${esc(
          t.vehicleNumber || T('td_atGate')
        )}</div>
        <div class="lbl">${T('token')} ID</div><div class="val" style="font-size:12px">${esc(
          t.tokenId
        )}</div>
      </div>
    </div>
    <div class="foot">
      <b>${esc(t.centreName)}</b>
      <span>${esc(t.centreAddress || '')}</span><br/>
      <span>${T('gp_hint')}</span>
    </div>
  </div>
  <div class="brand">AGROBRIDGE • ${esc(fmtDateTime(new Date().toISOString()))}</div>
</body></html>`;
}

export async function downloadGatePassPdf(token, lang = 'hi') {
  const html = buildGatePassHtml(token, lang);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `${translate('pdf_gatePassTitle', lang)} ${token?.tokenNumber || ''}`,
      UTI: 'com.adobe.pdf',
    });
  } else {
    await Print.printAsync({ uri });
  }
  return uri;
}
