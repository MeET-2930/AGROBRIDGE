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

export function buildReceiptHtml(token) {
  const t = token || {};

  return `<!DOCTYPE html>
<html lang="hi">
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
      <div class="paid">भुगतान पूरा / PAID</div>
      <div class="sub" style="margin-top:8px">रसीद क्रमांक: <b>${esc(
        t.receiptId
      )}</b></div>
      <div class="sub">${esc(fmtDateTime(t.paidAt))}</div>
    </div>
  </div>

  <div class="grid" style="margin-top:18px">
    <div>
      <div class="sub">टोकन</div>
      <div class="token">${esc(t.tokenNumber)}</div>
      <div class="sub">टोकन ID: ${esc(t.id || t.tokenId)}</div>
    </div>
    <div>
      <h2 style="margin-top:0">किसान</h2>
      <table>
        ${row('नाम', t.farmerName)}
        ${row('मोबाइल', t.farmerPhone)}
        ${row('वाहन', t.vehicleNumber)}
      </table>
    </div>
  </div>

  <h2>फसल एवं गुणवत्ता</h2>
  <table>
    ${row('फसल', t.cropName || t.crop)}
    ${row('तारीख / स्लॉट', `${t.date || ''}  ${t.slotWindow || ''}`)}
    ${row('ग्रेड', t.grade)}
    ${row('नमी', t.moisturePercent != null ? `${t.moisturePercent}%` : '—')}
    ${row(
      'अन्य पदार्थ',
      t.foreignMatterPercent != null ? `${t.foreignMatterPercent}%` : '—'
    )}
  </table>

  <h2>तौल</h2>
  <table>
    ${row('कुल वजन', `${t.grossWeightQuintals ?? '—'} क्विंटल`)}
    ${row('खाली वाहन', `${t.tareWeightQuintals ?? '—'} क्विंटल`)}
    ${row('शुद्ध वजन', `${t.actualQuantity ?? '—'} क्विंटल`)}
  </table>

  <h2>भुगतान विवरण</h2>
  <table>
    ${row('दर', `${money(t.ratePerQuintal)} / क्विंटल`)}
    ${row('कुल राशि', money(t.grossAmount))}
    ${row('मंडी शुल्क', `− ${money(t.mandiFee)}`, 'ded')}
    ${row('आढ़त', `− ${money(t.commission)}`, 'ded')}
    ${row('हमाली', `− ${money(t.hamali)}`, 'ded')}
    ${row('नेट भुगतान', money(t.netPayable), 'net')}
    ${t.paymentReference ? row('संदर्भ / UTR', t.paymentReference) : ''}
    ${t.paymentMode ? row('भुगतान माध्यम', t.paymentMode) : ''}
  </table>

  <div class="stamp">✓ भुगतान सफल</div>

  <div class="foot">
    यह रसीद AGROBRIDGE ऐप द्वारा डिजिटल रूप से तैयार की गई है • ${esc(
      fmtDateTime(new Date().toISOString())
    )}
  </div>
</body>
</html>`;
}

/**
 * Generate the PDF and open the share sheet.
 * Returns the local file uri (also useful for debugging).
 */
export async function downloadReceiptPdf(token) {
  const html = buildReceiptHtml(token);

  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const canShare = await Sharing.isAvailableAsync();

  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `रसीद ${token?.receiptId || token?.tokenNumber || ''}`,
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

export function buildGatePassHtml(token) {
  const t = token || {};
  const code = gatePassCodeOf(t);
  const qr = t.gatePassQr || buildGatePassQr(t.tokenId, code);
  const codePretty = code.replace(/(\d{3})(\d{3})/, '$1 $2');

  return `<!DOCTYPE html>
<html lang="hi"><head><meta charset="utf-8" />
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
    <div class="head"><div class="t">🎫 गेट पास / GATE PASS</div><div class="tok">${esc(
      t.tokenNumber
    )}</div></div>
    <div class="body">
      <div class="qr">${qrSvg(qr, 200)}</div>
      <div class="info">
        <div class="lbl">गेट पास नंबर / GATE PASS NO.</div>
        <div class="code">${esc(codePretty)}</div>
        <div class="lbl">किसान</div><div class="val">${esc(t.farmerName)} • +91 ${esc(
    t.farmerPhone
  )}</div>
        <div class="lbl">तारीख • समय</div><div class="val">${esc(t.date)} • ${esc(
    t.slotWindow
  )}</div>
        <div class="lbl">फसल • अनुमानित मात्रा</div><div class="val">${esc(
          t.cropName || t.crop
        )} • ${esc(t.approxQuantityQuintals)} क्विंटल</div>
        <div class="lbl">वाहन</div><div class="val">${esc(
          t.vehicleNumber || 'गेट पर दर्ज होगा'
        )}</div>
        <div class="lbl">टोकन ID</div><div class="val" style="font-size:12px">${esc(
          t.tokenId
        )}</div>
      </div>
    </div>
    <div class="foot">
      <b>${esc(t.centreName)}</b>
      <span>${esc(t.centreAddress || '')}</span><br/>
      <span>गेट पर यह QR या नंबर और वाहन नंबर दिखाएँ • Show this QR or number with your vehicle number at the gate</span>
    </div>
  </div>
  <div class="brand">AGROBRIDGE • ${esc(fmtDateTime(new Date().toISOString()))}</div>
</body></html>`;
}

export async function downloadGatePassPdf(token) {
  const html = buildGatePassHtml(token);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `गेट पास ${token?.tokenNumber || ''}`,
      UTI: 'com.adobe.pdf',
    });
  } else {
    await Print.printAsync({ uri });
  }
  return uri;
}
