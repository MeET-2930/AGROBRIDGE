/* Generates AgroBridge_SIH_2026_Round_2_Submission.pptx (SIH 6-slide structure) */
const PptxGenJS = require("pptxgenjs");

const pptx = new PptxGenJS();
pptx.defineLayout({ name: "SIH", width: 13.333, height: 7.5 });
pptx.layout = "SIH";

const SAFFRON = "FF9933";
const GREEN = "138808";
const NAVY = "1B2A4A";
const DARK = "222222";
const GRAY = "555555";
const LIGHT = "F4F6F8";
const WHITE = "FFFFFF";
const BLUE = "0B5394";

function headerBar(slide, title) {
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.9, fill: { color: NAVY } });
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0.9, w: 13.333, h: 0.06, fill: { color: SAFFRON } });
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0.96, w: 13.333, h: 0.04, fill: { color: GREEN } });
  slide.addText(title, {
    x: 0.4, y: 0.12, w: 9.5, h: 0.66, fontSize: 26, bold: true, color: WHITE,
    fontFace: "Calibri", align: "left", valign: "middle",
  });
  slide.addText("SMART INDIA HACKATHON 2026  |  PS ID 26032  |  Team: AgroBridge", {
    x: 0.4, y: 1.06, w: 12.5, h: 0.3, fontSize: 11, color: GRAY, fontFace: "Calibri", italic: true,
  });
}

function footer(slide, n) {
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 7.28, w: 13.333, h: 0.22, fill: { color: NAVY } });
  slide.addText(`AgroBridge  |  Ministry of Consumer Affairs, Food & Public Distribution  |  Theme: Smart Automation  |  ${n}/6`, {
    x: 0.4, y: 7.28, w: 12.5, h: 0.22, fontSize: 9, color: WHITE, fontFace: "Calibri", valign: "middle",
  });
}

function bullets(slide, items, opt) {
  const rows = [];
  items.forEach((it) => {
    rows.push({ text: it.h ? it.h : it.t, options: { bullet: it.h ? { code: "25AA" } : { code: "2022" }, indentLevel: it.h ? 0 : 1, bold: Boolean(it.h), fontSize: it.h ? (opt.fontSize || 13) : (opt.subSize || 12), color: it.h ? NAVY : DARK, breakLine: !it.h, paraSpaceAfter: it.h ? 4 : 2, paraSpaceBefore: it.h ? 8 : 0 } });
    if (it.h && it.sub) it.sub.forEach((s) => rows.push({ text: s, options: { bullet: { code: "2022" }, indentLevel: 1, fontSize: opt.subSize || 12, color: DARK, breakLine: true, paraSpaceAfter: 2 } }));
  });
  slide.addText(rows, { x: opt.x, y: opt.y, w: opt.w, h: opt.h, fontFace: "Calibri", valign: "top", lineSpacingMultiple: 1.05 });
}

/* ============ SLIDE 1 — COVER ============ */
let s = pptx.addSlide();
s.background = { color: WHITE };
s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.35, fill: { color: SAFFRON } });
s.addShape(pptx.ShapeType.rect, { x: 0, y: 0.35, w: 13.333, h: 0.12, fill: { color: WHITE } });
s.addShape(pptx.ShapeType.rect, { x: 0, y: 0.47, w: 13.333, h: 0.35, fill: { color: GREEN } });
s.addShape(pptx.ShapeType.rect, { x: 0, y: 7.15, w: 13.333, h: 0.35, fill: { color: NAVY } });

s.addText("SMART INDIA HACKATHON 2026", {
  x: 0.6, y: 1.1, w: 12.1, h: 0.7, fontSize: 36, bold: true, color: NAVY, fontFace: "Calibri", align: "center",
});
s.addText("Round 2 Submission", {
  x: 0.6, y: 1.75, w: 12.1, h: 0.4, fontSize: 18, color: SAFFRON, fontFace: "Calibri", align: "center", bold: true,
});

s.addText("AgroBridge \u2013 Smart Mandi Access & Management Platform", {
  x: 0.8, y: 2.3, w: 11.7, h: 0.7, fontSize: 26, bold: true, color: DARK, fontFace: "Calibri", align: "center",
});

const coverRows = [
  ["Problem Statement ID:", "26032"],
  ["Problem Statement Title:", "Farmers often face long waiting times, lack of information regarding procurement schedules and uncertainty about procurement status."],
  ["Theme:", "Smart automation"],
  ["PS Category:", "Software"],
  ["Ministry:", "Ministry of Consumer Affairs, Food & Public Distribution"],
  ["Team Name:", "AgroBridge"],
  ["Team ID:", "[MISSING \u2013 to be provided by team before final submission]"],
];
const coverTbl = coverRows.map(([k, v]) => ([
  { text: k, options: { bold: true, color: NAVY, fontSize: 13, fill: { color: LIGHT }, fontFace: "Calibri", valign: "middle" } },
  { text: v, options: { color: v.startsWith("[MISSING") ? "C00000" : DARK, fontSize: 13, fontFace: "Calibri", valign: "middle", italic: v.startsWith("[MISSING") } },
]));
s.addTable(coverTbl, {
  x: 1.3, y: 3.15, w: 10.7, colW: [3.2, 7.5],
  border: { type: "solid", pt: 0.75, color: "CCCCCC" },
  rowH: 0.42, margin: 0.08,
});
s.addText("Idea: AgroBridge \u2013 Smart Queue and Slot Management for APMC Procurement Centres", {
  x: 1.3, y: 6.5, w: 10.7, h: 0.4, fontSize: 14, italic: true, color: GRAY, fontFace: "Calibri", align: "center",
});

/* ============ SLIDE 2 — IDEA TITLE ============ */
s = pptx.addSlide();
headerBar(s, "IDEA TITLE");
footer(s, 2);

s.addText("AgroBridge \u2013 Smart Mandi Access & Management Platform", {
  x: 0.4, y: 1.4, w: 12.5, h: 0.45, fontSize: 20, bold: true, color: NAVY, fontFace: "Calibri",
});
s.addText("Digitising Mandi Access, Queues and Procurement for Faster, More Transparent Farmer Transactions", {
  x: 0.4, y: 1.82, w: 12.5, h: 0.32, fontSize: 13, italic: true, color: SAFFRON, fontFace: "Calibri",
});

s.addShape(pptx.ShapeType.rect, { x: 0.4, y: 2.25, w: 4.0, h: 0.34, fill: { color: BLUE } });
s.addText("PROBLEM", { x: 0.4, y: 2.25, w: 4.0, h: 0.34, fontSize: 13, bold: true, color: WHITE, fontFace: "Calibri", align: "center", valign: "middle" });
bullets(s, [
  "Long waiting times at procurement centres",
  "Lack of visibility into procurement schedules",
  "Static / manual capacity management",
  "Uncertainty regarding procurement status",
  "Quality and price uncertainty",
  "Fragmented communication between farmers and mandi stakeholders",
], { x: 0.4, y: 2.65, w: 4.0, h: 3.3, subSize: 11.5 });

s.addShape(pptx.ShapeType.rect, { x: 4.65, y: 2.25, w: 4.0, h: 0.34, fill: { color: GREEN } });
s.addText("SOLUTION", { x: 4.65, y: 2.25, w: 4.0, h: 0.34, fontSize: 13, bold: true, color: WHITE, fontFace: "Calibri", align: "center", valign: "middle" });
bullets(s, [
  { h: "Farmer", sub: ["Registration \u2192 mandi selection \u2192 slot booking", "Queue / token visibility, mandi arrival", "Procurement workflow status \u2192 payment visibility"] },
  { h: "Mandi Staff", sub: ["Capacity / slot & queue management", "Arrival & processing visibility", "Procurement status updates"] },
  { h: "Trader / Buyer", sub: ["Auction board & bidding (prototype)"] },
], { x: 4.65, y: 2.65, w: 4.0, h: 3.3, subSize: 11 });

s.addShape(pptx.ShapeType.rect, { x: 8.9, y: 2.25, w: 4.0, h: 0.34, fill: { color: NAVY } });
s.addText("DIFFERENTIATORS", { x: 8.9, y: 2.25, w: 4.0, h: 0.34, fontSize: 13, bold: true, color: WHITE, fontFace: "Calibri", align: "center", valign: "middle" });
bullets(s, [
  "Crop / quintal / quantity-aware slot allocation",
  "Real-time queue & mandi capacity visibility",
  "Farmer mobile interface with multilingual UI",
  "AI chatbot assistance (Gemini) \u2013 prototype",
  "IVR path for basic-phone users \u2013 prototype",
  "Digital procurement-status visibility",
  "Integrated farmer / mandi workflow",
], { x: 8.9, y: 2.65, w: 4.0, h: 3.3, subSize: 11.5 });

s.addShape(pptx.ShapeType.rect, { x: 0.4, y: 6.1, w: 12.5, h: 1.0, fill: { color: LIGHT }, line: { color: "DDDDDD", width: 1 } });
s.addText("AGROBRIDGE \u2013 Bridging the gap between farmers, mandi stakeholders and buyers by digitalizing fragmented agricultural market processes into a unified, transparent and intelligent digital ecosystem", {
  x: 0.55, y: 6.18, w: 12.2, h: 0.85, fontSize: 13, italic: true, color: DARK, fontFace: "Calibri", valign: "middle", align: "center",
});

/* ============ SLIDE 3 — TECHNICAL APPROACH ============ */
s = pptx.addSlide();
headerBar(s, "TECHNICAL APPROACH");
footer(s, 3);

s.addText("Architecture (current implementation)", {
  x: 0.4, y: 1.35, w: 6.5, h: 0.3, fontSize: 14, bold: true, color: NAVY, fontFace: "Calibri",
});

const boxOpt = (fill) => ({ fill: { color: fill }, line: { color: NAVY, width: 1 }, rectRadius: 0.05 });
const lblOpt = (t, y) => ({ x: 0.7, y, w: 5.6, h: 0.5, fontSize: 11, bold: true, color: WHITE, fontFace: "Calibri", align: "center", valign: "middle" });

s.addShape(pptx.ShapeType.roundRect, { x: 0.7, y: 1.7, w: 5.6, h: 0.5, ...boxOpt("0B5394") });
s.addText("FARMER / TRADER / MANDI STAFF / ARHTIYA", lblOpt("", 1.7));
s.addText("\u25BC", { x: 3.2, y: 2.2, w: 0.6, h: 0.28, fontSize: 14, color: NAVY, align: "center", fontFace: "Calibri" });

s.addShape(pptx.ShapeType.roundRect, { x: 0.7, y: 2.48, w: 5.6, h: 0.5, ...boxOpt("138808") });
s.addText("React Native + Expo Mobile App (iOS / Android / Web)", lblOpt("", 2.48));
s.addText("\u25BC", { x: 3.2, y: 2.98, w: 0.6, h: 0.28, fontSize: 14, color: NAVY, align: "center", fontFace: "Calibri" });

s.addShape(pptx.ShapeType.roundRect, { x: 0.7, y: 3.26, w: 5.6, h: 0.5, ...boxOpt("FF9933") });
s.addText("App Services + Capacity / Queue Engine (JS)", lblOpt("", 3.26));
s.addText("\u25BC", { x: 3.2, y: 3.76, w: 0.6, h: 0.28, fontSize: 14, color: NAVY, align: "center", fontFace: "Calibri" });

s.addShape(pptx.ShapeType.roundRect, { x: 0.7, y: 4.04, w: 2.7, h: 0.7, ...boxOpt("1B2A4A") });
s.addText("Firebase / Firestore\n(bookings, queues, users)", { x: 0.7, y: 4.04, w: 2.7, h: 0.7, fontSize: 10, bold: true, color: WHITE, fontFace: "Calibri", align: "center", valign: "middle" });
s.addShape(pptx.ShapeType.roundRect, { x: 3.6, y: 4.04, w: 2.7, h: 0.7, ...boxOpt("1B2A4A") });
s.addText("Node.js Services on Render\n(IVR + Chatbot backend)", { x: 3.6, y: 4.04, w: 2.7, h: 0.7, fontSize: 10, bold: true, color: WHITE, fontFace: "Calibri", align: "center", valign: "middle" });

s.addText("\u25BC", { x: 4.6, y: 4.74, w: 0.6, h: 0.26, fontSize: 13, color: NAVY, align: "center", fontFace: "Calibri" });
s.addShape(pptx.ShapeType.roundRect, { x: 3.6, y: 5.0, w: 2.7, h: 0.55, ...boxOpt("0B5394") });
s.addText("Telephony: sim / Plivo / Twilio\n(outbound calls \u2013 sim active)", { x: 3.6, y: 5.0, w: 2.7, h: 0.55, fontSize: 9.5, color: WHITE, fontFace: "Calibri", align: "center", valign: "middle" });

s.addText("\u25BC", { x: 1.7, y: 4.74, w: 0.6, h: 0.26, fontSize: 13, color: NAVY, align: "center", fontFace: "Calibri" });
s.addShape(pptx.ShapeType.roundRect, { x: 0.7, y: 5.0, w: 2.7, h: 0.55, ...boxOpt("0B5394") });
s.addText("Queue / Slot / Procurement Data\n+ Notifications + SMS outbox", { x: 0.7, y: 5.0, w: 2.7, h: 0.55, fontSize: 9.5, color: WHITE, fontFace: "Calibri", align: "center", valign: "middle" });

s.addShape(pptx.ShapeType.roundRect, { x: 0.7, y: 5.75, w: 5.6, h: 0.5, ...boxOpt("6A1B9A") });
s.addText("Chatbot: React Native ChatbotScreen \u2192 Node /chat \u2192 Gemini API", { x: 0.7, y: 5.75, w: 5.6, h: 0.5, fontSize: 10.5, bold: true, color: WHITE, fontFace: "Calibri", align: "center", valign: "middle" });

s.addText("Tech Stack", { x: 6.7, y: 1.35, w: 6.2, h: 0.3, fontSize: 14, bold: true, color: NAVY, fontFace: "Calibri" });
const stackHdr = ["Layer", "Technology", "Purpose"].map((t) => ({ text: t, options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 10.5, fontFace: "Calibri" } }));
const stackRows = [
  ["Frontend", "React Native / Expo (JS)", "Farmer, officer, trader, arhtiya mobile app"],
  ["Backend", "Node.js (Express)", "IVR + chatbot services"],
  ["Database", "Firebase / Firestore", "Bookings, live queues, users, rules"],
  ["AI", "Gemini API", "Assistant chatbot (EN / HI / Hinglish)"],
  ["IVR / Voice", "sim (active), Plivo, Twilio", "Voice booking & status for feature phones"],
  ["Hosting", "Render (free tier)", "IVR + chatbot deployment"],
  ["Hosting", "Firebase Hosting", "Web build (dist)"],
  ["Push / SMS", "Expo push; SMS outbox queued", "Notifications (SMS gateway pending)"],
  ["Testing", "Firebase Emulator Suite", "Local functions/firestore testing"],
].map((r) => r.map((c) => ({ text: c, options: { fontSize: 9.5, color: DARK, fontFace: "Calibri", fill: { color: WHITE } } })));
s.addTable([stackHdr, ...stackRows], {
  x: 6.7, y: 1.7, w: 6.2, colW: [1.15, 2.15, 2.9],
  border: { type: "solid", pt: 0.5, color: "BBBBBB" }, rowH: 0.33, margin: 0.05,
});

s.addText("User Roles (implemented)", { x: 6.7, y: 5.1, w: 6.2, h: 0.3, fontSize: 14, bold: true, color: NAVY, fontFace: "Calibri" });
s.addText([
  { text: "Farmer: ", options: { bold: true, fontSize: 10.5, color: NAVY } },
  { text: "registration, mandi selection, slot booking, queue/token visibility, procurement status, payment/status info, chatbot assistance\n", options: { fontSize: 10.5, color: DARK, breakLine: true } },
  { text: "Mandi Staff: ", options: { bold: true, fontSize: 10.5, color: NAVY } },
  { text: "gate scan, stage queues, assay, weighing, mark paid, capacity/yard setup, reports, telemetry\n", options: { fontSize: 10.5, color: DARK, breakLine: true } },
  { text: "Trader: ", options: { bold: true, fontSize: 10.5, color: NAVY } },
  { text: "auction board, bidding, purchase history (prototype)\n", options: { fontSize: 10.5, color: DARK, breakLine: true } },
  { text: "Arhtiya: ", options: { bold: true, fontSize: 10.5, color: NAVY } },
  { text: "bulk booking for linked farmers (prototype)", options: { fontSize: 10.5, color: DARK } },
], { x: 6.7, y: 5.45, w: 6.2, h: 1.7, fontFace: "Calibri", valign: "top", lineSpacingMultiple: 1.05 });

/* ============ SLIDE 4 — FEASIBILITY AND VIABILITY ============ */
s = pptx.addSlide();
headerBar(s, "FEASIBILITY AND VIABILITY");
footer(s, 4);

s.addShape(pptx.ShapeType.rect, { x: 0.4, y: 1.35, w: 4.0, h: 0.34, fill: { color: GREEN } });
s.addText("WHY FEASIBLE", { x: 0.4, y: 1.35, w: 4.0, h: 0.34, fontSize: 13, bold: true, color: WHITE, align: "center", valign: "middle", fontFace: "Calibri" });
bullets(s, [
  "Working prototype: React Native / Expo app with multi-role portals",
  "Modular mobile + backend architecture",
  "Cloud-ready Firebase / Firestore data layer",
  "Node.js IVR + chatbot services (Render deployment config present)",
  "AI assistance via Gemini chatbot (EN / HI / Hinglish)",
  "Transaction-safe queue / slot booking workflow (Firestore transactions)",
  "Mock government adapters (govRail) ready for incremental e-Kharid / MFMB integration",
], { x: 0.4, y: 1.8, w: 4.0, h: 5.2, subSize: 11.5 });

s.addShape(pptx.ShapeType.rect, { x: 4.65, y: 1.35, w: 4.0, h: 0.34, fill: { color: "C0392B" } });
s.addText("CHALLENGES", { x: 4.65, y: 1.35, w: 4.0, h: 0.34, fontSize: 13, bold: true, color: WHITE, align: "center", valign: "middle", fontFace: "Calibri" });
bullets(s, [
  "Farmer digital literacy",
  "Connectivity limitations in rural areas",
  "Adoption by mandi staff",
  "Legacy / manual mandi workflows",
  "IVR reliability & telephony account pending (sim mode active)",
  "Integration with external / government systems (mocked today)",
  "Data synchronisation at scale",
  "Scaling during harvest peaks",
], { x: 4.65, y: 1.8, w: 4.0, h: 5.2, subSize: 11.5 });

s.addShape(pptx.ShapeType.rect, { x: 8.9, y: 1.35, w: 4.0, h: 0.34, fill: { color: BLUE } });
s.addText("MITIGATION", { x: 8.9, y: 1.35, w: 4.0, h: 0.34, fontSize: 13, bold: true, color: WHITE, align: "center", valign: "middle", fontFace: "Calibri" });
bullets(s, [
  "Multilingual UI (EN / HI / PA / MR)",
  "IVR / basic-phone access path",
  "Simple farmer booking workflow",
  "Modular APIs & mock adapters for staged integration",
  "Offline-tolerant gate pass (QR / code works without network)",
  "Cloud backend (Firebase + Render free tier)",
  "Staged rollout; monitoring & telemetry screens",
  "Security rules hardening (Mode B) before production",
], { x: 8.9, y: 1.8, w: 4.0, h: 5.2, subSize: 11.5 });

s.addText("Round 1 \u2192 Round 2: concept \u2192 working multi-role prototype (app + backend + engine + IVR/chatbot prototype); government integration, SMS gateway & production rules remain pending.", {
  x: 0.4, y: 6.75, w: 12.5, h: 0.45, fontSize: 11.5, italic: true, color: NAVY, fontFace: "Calibri", align: "center",
});

/* ============ SLIDE 5 — IMPACT AND BENEFITS ============ */
s = pptx.addSlide();
headerBar(s, "IMPACT AND BENEFITS");
footer(s, 5);

s.addShape(pptx.ShapeType.rect, { x: 0.4, y: 1.35, w: 4.0, h: 0.34, fill: { color: SAFFRON } });
s.addText("FARMERS", { x: 0.4, y: 1.35, w: 4.0, h: 0.34, fontSize: 13, bold: true, color: WHITE, align: "center", valign: "middle", fontFace: "Calibri" });
bullets(s, [
  "Reduced uncertainty about when to arrive",
  "Better schedule visibility before travel",
  "Less unnecessary waiting via booked slots",
  "Easier access to mandi information (app + chatbot + IVR)",
  "Better procurement-status & payment visibility",
], { x: 0.4, y: 1.8, w: 4.0, h: 2.6, subSize: 12 });

s.addShape(pptx.ShapeType.rect, { x: 4.65, y: 1.35, w: 4.0, h: 0.34, fill: { color: GREEN } });
s.addText("MANDI STAFF", { x: 4.65, y: 1.35, w: 4.0, h: 0.34, fontSize: 13, bold: true, color: WHITE, align: "center", valign: "middle", fontFace: "Calibri" });
bullets(s, [
  "Better queue visibility per stage",
  "Better capacity utilisation planning",
  "Reduced manual coordination",
  "More predictable arrivals by hour",
], { x: 4.65, y: 1.8, w: 4.0, h: 2.6, subSize: 12 });

s.addShape(pptx.ShapeType.rect, { x: 8.9, y: 1.35, w: 4.0, h: 0.34, fill: { color: NAVY } });
s.addText("SYSTEM", { x: 8.9, y: 1.35, w: 4.0, h: 0.34, fontSize: 13, bold: true, color: WHITE, align: "center", valign: "middle", fontFace: "Calibri" });
bullets(s, [
  "Digital records across the procurement chain",
  "Real-time status for all stakeholders",
  "Better transparency (queue, assay, price, payment)",
  "Scalable, modular workflow",
], { x: 8.9, y: 1.8, w: 4.0, h: 2.6, subSize: 12 });

s.addShape(pptx.ShapeType.rect, { x: 0.4, y: 4.6, w: 12.5, h: 2.4, fill: { color: LIGHT }, line: { color: "CCCCCC", width: 1 } });
s.addText("Quantification", { x: 0.6, y: 4.7, w: 12.1, h: 0.3, fontSize: 14, bold: true, color: NAVY, fontFace: "Calibri" });
s.addText([
  { text: "Current prototype: ", options: { bold: true, fontSize: 12, color: DARK } },
  { text: "no measured waiting-time or economic-impact data yet \u2013 testing is on seeded Haryana mandi test accounts (simulator / demo mode).\n", options: { fontSize: 12, color: DARK, breakLine: true, paraSpaceAfter: 6 } },
  { text: "Projected / modelled impact: ", options: { bold: true, fontSize: 12, color: DARK } },
  { text: "scheduled arrival hours \u2192 fewer pre-dawn road queues; live status \u2192 fewer repeated enquiries at counters; capacity-aware slots \u2192 smoother peak-day flow. ", options: { fontSize: 12, color: DARK } },
  { text: "(Projections \u2013 to be validated with pilot mandi data; not measured results.)", options: { fontSize: 12, color: "C00000", italic: true } },
], { x: 0.6, y: 5.05, w: 12.1, h: 1.8, fontFace: "Calibri", valign: "top", lineSpacingMultiple: 1.1 });

/* ============ SLIDE 6 — RESEARCH & REFERENCES ============ */
s = pptx.addSlide();
headerBar(s, "RESEARCH & REFERENCES");
footer(s, 6);

const refs = [
  ["APMC / mandi procurement process", "AgriStack & state marketing-board guidance; state APMC Act summaries (e.g., Haryana Agricultural Produce Markets Act) \u2013 e.g. https://agriharyana.gov.in"],
  ["Government procurement & MSP", "Department of Food & Public Distribution / CACP MSP notifications \u2013 https://dfpd.gov.in , https://acac.gov.in"],
  ["eNAM \u2013 national e-trading of produce", "National Agriculture Market (eNAM), Ministry of Agriculture \u2013 https://enam.gov.in"],
  ["Farmer registration (MFMB / e-Kharid)", "Meri Fasal Mera Byora (Haryana) & e-Kharid state portals \u2013 https://mfmb.haryana.gov.in , https://ekharid.in"],
  ["Digital agriculture & connectivity", "ICAR / Ministry of Agriculture digital-agriculture reports; NASSCOM & NABARD digital-inclusion studies on farmer connectivity"],
  ["Quality norms (FAQ for wheat/paddy)", "FCI / Government of India FAQ norms for foodgrains \u2013 https://fci.gov.in"],
  ["Technical: queue & slot systems", "React Native / Expo docs (https://docs.expo.dev), Firebase/Firestore docs (https://firebase.google.com/docs), Google Gemini API docs (https://ai.google.dev)"],
  ["Telephony / IVR", "Twilio & Plivo voice API documentation (https://www.twilio.com/docs/voice, https://www.plivo.com/voice/api/)"],
];
const refTbl = [
  [
    { text: "Area", options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 11, fontFace: "Calibri" } },
    { text: "Source", options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 11, fontFace: "Calibri" } },
  ],
  ...refs.map(([a, b]) => [
    { text: a, options: { bold: true, fontSize: 11, color: NAVY, fontFace: "Calibri", fill: { color: LIGHT } } },
    { text: b, options: { fontSize: 11, color: DARK, fontFace: "Calibri" } },
  ]),
];
s.addTable(refTbl, {
  x: 0.5, y: 1.5, w: 12.3, colW: [3.4, 8.9],
  border: { type: "solid", pt: 0.5, color: "BBBBBB" }, rowH: 0.55, margin: 0.07,
});

s.addText("All sources are public government / official technical documentation. No fabricated references.", {
  x: 0.5, y: 6.6, w: 12.3, h: 0.4, fontSize: 12, italic: true, color: GRAY, fontFace: "Calibri", align: "center",
});

pptx.writeFile({ fileName: "AgroBridge_SIH_2026_Round_2_Submission.pptx" })
  .then(() => console.log("PPTX created: AgroBridge_SIH_2026_Round_2_Submission.pptx"))
  .catch((e) => { console.error(e); process.exit(1); });
