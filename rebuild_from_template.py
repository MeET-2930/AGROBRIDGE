# -*- coding: utf-8 -*-
"""Rebuild Round 2 deck from official Sih-26032.pptx template (in-place on output copy)."""
import copy
import sys

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

OUT = "AgroBridge_SIH_2026_Round_2_Submission.pptx"

# Template palette (from SIH rasterized slides)
DARK_GREEN = RGBColor(0x0E, 0x5C, 0x2E)
DEEP_GREEN = RGBColor(0x14, 0x53, 0x2D)
GREEN = RGBColor(0x15, 0x80, 0x3D)
ORANGE = RGBColor(0xE8, 0x77, 0x22)
BRIGHT_ORANGE = RGBColor(0xF9, 0x73, 0x16)
NAVY = RGBColor(0x1B, 0x3A, 0x6B)
SLATE = RGBColor(0x1E, 0x3A, 0x5F)
DARK = RGBColor(0x22, 0x22, 0x22)
GRAY = RGBColor(0x55, 0x55, 0x55)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
CREAM = RGBColor(0xFF, 0xF8, 0xE7)
LIGHT_GREEN = RGBColor(0xE8, 0xF5, 0xE9)
LIGHT_BLUE = RGBColor(0xE3, 0xF2, 0xFD)
LIGHT_ORANGE = RGBColor(0xFF, 0xF3, 0xE0)
LIGHT_RED = RGBColor(0xFD, 0xEB, 0xE8)
RED = RGBColor(0xB9, 0x1C, 0x1C)
LINE_GRAY = RGBColor(0xCC, 0xCC, 0xCC)
PANEL = RGBColor(0xFC, 0xFF, 0xFC)

prs = Presentation(OUT)
assert len(prs.slides) == 6, f"expected 6 slides, got {len(prs.slides)}"

SW = prs.slide_width
SH = prs.slide_height


def set_run(run, text, size=11, bold=False, color=DARK, font="Calibri", italic=False):
    run.text = text
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    run.font.name = font


def clear_tf(tf):
    tf.clear()
    # keep a single empty paragraph
    return tf.paragraphs[0]


def add_textbox(slide, x, y, w, h, lines, valign=MSO_ANCHOR.TOP, wrap=True):
    """lines: list of (text, kwargs) or list of list of (text, kwargs) for multi-run paras."""
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = wrap
    tf.vertical_anchor = valign
    tf.margin_left = Pt(2)
    tf.margin_right = Pt(2)
    tf.margin_top = Pt(1)
    tf.margin_bottom = Pt(1)
    first = True
    for line in lines:
        runs = line if isinstance(line, list) else [line]
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        meta = runs[0][1] if runs else {}
        if "align" in meta:
            p.alignment = meta["align"]
        if "space_before" in meta:
            p.space_before = Pt(meta["space_before"])
        if "space_after" in meta:
            p.space_after = Pt(meta["space_after"])
        if "line_spacing" in meta:
            p.line_spacing = meta["line_spacing"]
        para_keys = {"align", "space_before", "space_after", "line_spacing"}
        for text, kw in runs:
            r = p.add_run()
            set_run(r, text, **{k: v for k, v in kw.items() if k not in para_keys})
    return box


def add_rect(slide, x, y, w, h, fill, line=None, shape=MSO_SHAPE.RECTANGLE, line_w=1.0):
    sh = slide.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    sh.fill.solid()
    sh.fill.fore_color.rgb = fill
    if line is None:
        sh.line.fill.background()
    else:
        sh.line.color.rgb = line
        sh.line.width = Pt(line_w)
    sh.shadow.inherit = False
    return sh


def header_card(slide, x, y, w, h, title, fill=DARK_GREEN, title_size=13, title_color=WHITE):
    add_rect(slide, x, y, w, h, fill)
    add_textbox(
        slide, x, y, w, h,
        [(title, {"size": title_size, "bold": True, "color": title_color, "align": PP_ALIGN.CENTER})],
        valign=MSO_ANCHOR.MIDDLE,
    )


def bullets_block(slide, x, y, w, h, items, size=11, color=DARK, bullet_color=ORANGE):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = Pt(2)
    tf.margin_right = Pt(2)
    tf.margin_top = Pt(1)
    tf.margin_bottom = Pt(1)
    first = True
    for it in items:
        if isinstance(it, tuple):
            head, sub = it
        else:
            head, sub = it, None
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        p.space_after = Pt(3)
        p.space_before = Pt(4) if sub is None and head.endswith(":") or (isinstance(head, str) and head.isupper() and len(head) < 24) else Pt(1)
        r = p.add_run()
        set_run(r, "• ", size=size, bold=True, color=bullet_color)
        r2 = p.add_run()
        set_run(r2, head, size=size, bold=bool(sub is None and False), color=color)
        if sub:
            r3 = p.add_run()
            set_run(r3, " — " + sub, size=size, color=color)
    return box


def card_body(slide, x, y, w, h, fill, border=LINE_GRAY):
    return add_rect(slide, x, y, w, h, fill, line=border, shape=MSO_SHAPE.ROUNDED_RECTANGLE, line_w=0.75)


def add_panel(slide, y0=1.05, y1=7.48, x0=0.12, x1=13.22):
    """White content panel covering baked-in body; leaves title band visible."""
    add_rect(slide, x0, y0, x1 - x0, y1 - y0, WHITE, line=RGBColor(0x0E, 0x5C, 0x2E), line_w=1.25)
    return x0 + 0.12, y0 + 0.08, (x1 - x0) - 0.24, (y1 - y0) - 0.16


def raise_footers(slide, color=None):
    """Move footer + slide-number placeholders to front; force visible color on white panels."""
    color = color or DEEP_GREEN
    for sh in list(slide.shapes):
        if not sh.is_placeholder:
            continue
        name = sh.name.lower()
        if "footer" in name or "slide number" in name:
            slide.shapes._spTree.append(sh._element)
            if sh.has_text_frame:
                for para in sh.text_frame.paragraphs:
                    for r in para.runs:
                        r.font.color.rgb = color
                        if not r.font.name:
                            r.font.name = "Calibri"
                    epr = para._p.find(qn("a:endParaRPr"))
                    if epr is None:
                        epr = para._p.makeelement(qn("a:endParaRPr"), {})
                        para._p.append(epr)
                    for child in list(epr):
                        if child.tag == qn("a:solidFill"):
                            epr.remove(child)
                    fill = epr.makeelement(qn("a:solidFill"), {})
                    clr = fill.makeelement(qn("a:srgbClr"), {"val": "%02X%02X%02X" % (color[0], color[1], color[2])})
                    fill.append(clr)
                    epr.append(fill)
                    epr.set("sz", "1200")


def style_table(tbl, header_fill=DARK_GREEN, header_size=10, body_size=9.5):
    for ri, row in enumerate(tbl.rows):
        for cell in row.cells:
            cell.margin_left = Pt(3)
            cell.margin_right = Pt(3)
            cell.margin_top = Pt(2)
            cell.margin_bottom = Pt(2)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            for p in cell.text_frame.paragraphs:
                for r in p.runs:
                    r.font.name = "Calibri"
                    if ri == 0:
                        r.font.size = Pt(header_size)
                        r.font.bold = True
                        r.font.color.rgb = WHITE
                    else:
                        r.font.size = Pt(body_size)
                        r.font.color.rgb = DARK
                if ri == 0:
                    p.alignment = PP_ALIGN.LEFT
            # fill
            tc = cell._tc
            tcPr = tc.get_or_add_tcPr()
            # remove existing solid fill
            for child in list(tcPr):
                if child.tag == qn("a:solidFill"):
                    tcPr.remove(child)
            solid = tcPr.makeelement(qn("a:solidFill"), {})
            srgb = solid.makeelement(qn("a:srgbClr"), {"val": "0E5C2E" if ri == 0 else ("F7FBF7" if ri % 2 else "FFFFFF")})
            solid.append(srgb)
            tcPr.append(solid)


def fill_cell(cell, text, bold=False, size=9.5, color=DARK):
    tf = cell.text_frame
    tf.clear()
    tf.word_wrap = True
    p = tf.paragraphs[0]
    r = p.add_run()
    set_run(r, text, size=size, bold=bold, color=color)


# ===================== SLIDE 1 — COVER (edit in place) =====================
s1 = prs.slides[0]

# Subtitle: keep template wording (Round 1 idea title is official template text)
# Optionally append Round 2 marker without redesigning title block.
for sh in s1.shapes:
    if sh.name == "Subtitle 3" and sh.has_text_frame:
        # keep as-is (template wording preserved)
        pass
    if sh.name == "TextBox 9" and sh.has_text_frame:
        tf = sh.text_frame
        tf.clear()
        specs = [
            ("Problem Statement ID- 26032", 19, True, DARK),
            ("Problem Statement Title- Farmers often face long waiting times, lack of information regarding procurement schedules and uncertainty about procurement status.", 19, True, DARK),
            ("Theme- Smart automation", 19, True, DARK),
            ("PS Category- Software", 19, True, DARK),
            ("Ministry- Ministry of Consumer Affairs, Food & Public Distribution", 19, True, DARK),
            ("Team ID- ", 19, True, RED),  # clearly pending — do not invent
            ("Team Name- AgroBridge", 19, True, DARK),
        ]
        first = True
        for text, size, bold, color in specs:
            p = tf.paragraphs[0] if first else tf.add_paragraph()
            first = False
            p.alignment = PP_ALIGN.JUSTIFY
            p.space_after = Pt(6)
            r = p.add_run()
            set_run(r, text, size=size, bold=bold, color=color, font="Arial")
            if text.startswith("Team ID-") and text.strip() == "Team ID-":
                r2 = p.add_run()
                set_run(r2, "[PENDING — provide before final submission]", size=size, bold=True, color=RED, font="Arial", italic=True)

# ===================== SLIDE 2 — IDEA TITLE =====================
s2 = prs.slides[1]
add_panel(s2, y0=1.10, y1=7.48, x0=0.12, x1=13.22)

# Idea name band
add_rect(s2, 0.35, 1.28, 12.7, 0.62, LIGHT_GREEN, line=DARK_GREEN, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
add_textbox(s2, 0.45, 1.30, 12.5, 0.58, [
    ("AgroBridge – Smart Mandi Access & Management Platform", {"size": 18, "bold": True, "color": DEEP_GREEN, "align": PP_ALIGN.CENTER, "space_after": 0}),
    ("Digitalizing mandi access, queues and procurement for faster, more transparent farmer transactions (working prototype, SIH 2026 Round 2)", {"size": 11, "bold": False, "color": ORANGE, "align": PP_ALIGN.CENTER, "italic": True}),
], valign=MSO_ANCHOR.MIDDLE)

# Three columns: PROBLEM | SOLUTION | DIFFERENTIATORS
col_w = 4.05
cols = [
    (0.35, "PROBLEM", DEEP_GREEN, LIGHT_ORANGE if False else CREAM, [
        "Long waiting times / crowding at mandi gates",
        "No universal pre-booked arrival slots",
        "Limited real-time queue visibility for farmers",
        "Fragmented procurement schedules & status info",
        "Manual weightment / records → errors & disputes",
        "Uncertainty about payment timing",
    ]),
    (4.60, "SOLUTION", GREEN, LIGHT_GREEN, [
        "Role-based app: Farmer, Mandi Staff, Trader, Arhtiya",
        "Slot booking + live queue / token visibility",
        "Gate scan → stage queues → assay → weigh → mark paid",
        "Capacity-aware yard / slot engine (JS)",
        "Multilingual UI: EN / HI / PA / MR",
        "Gemini chatbot + IVR path for feature phones (prototype)",
    ]),
    (8.85, "DIFFERENTIATORS", NAVY, LIGHT_BLUE, [
        "Crop / quintal-aware slot allocation model",
        "End-to-end mandi workflow in one prototype",
        "Offline-tolerant gate pass (QR / code)",
        "SMS outbox + Expo push notifications",
        "Mock gov adapters (govRail) for staged e-Kharid / MFMB",
        "Honest scope: prototype — not a live mandi deployment",
    ]),
]
for x, title, hdr, body_fill, items in cols:
    header_card(s2, x, 2.05, col_w, 0.36, title, fill=hdr, title_size=13)
    card_body(s2, x, 2.45, col_w, 3.05, body_fill, border=hdr)
    bullets_block(s2, x + 0.12, 2.55, col_w - 0.24, 2.85, items, size=12, bullet_color=ORANGE if hdr != NAVY else GREEN)

# Round 1 → Round 2 progress strip
add_rect(s2, 0.35, 5.65, 12.7, 1.05, CREAM, line=ORANGE, shape=MSO_SHAPE.ROUNDED_RECTANGLE, line_w=1.25)
add_textbox(s2, 0.50, 5.72, 12.4, 0.95, [
    [("ROUND 1 → ROUND 2  ", {"size": 12, "bold": True, "color": DEEP_GREEN}),
     ("concept → working multi-role prototype", {"size": 12, "bold": True, "color": ORANGE})],
    [("Delivered in repo: ", {"size": 11, "bold": True, "color": NAVY, "space_before": 3}),
     ("React Native / Expo app + Firebase / Firestore + capacity & queue engine + Node IVR/chatbot services (Render) + Gemini assistant + Firebase Hosting web build. ", {"size": 11, "color": DARK}),
     ("Still pending: ", {"size": 11, "bold": True, "color": RED}),
     ("live telephony account (sim mode active), SMS gateway, production Firestore rules (Mode B), real government / MFMB / e-Kharid integration (mock adapters only), measured field impact.", {"size": 11, "color": RED})],
], valign=MSO_ANCHOR.TOP)

# ===================== SLIDE 3 — TECHNICAL APPROACH =====================
s3 = prs.slides[2]
add_panel(s3, y0=0.96, y1=7.48, x0=0.12, x1=13.22)

# Left: architecture
header_card(s3, 0.35, 1.28, 6.3, 0.36, "SYSTEM ARCHITECTURE (CURRENT IMPLEMENTATION)", fill=DEEP_GREEN, title_size=12)

arch = [
    (0.55, 1.78, 5.9, 0.42, "Users: Farmer / Trader / Mandi Staff / Arhtiya", NAVY),
    (0.55, 2.30, 5.9, 0.42, "React Native + Expo app (iOS / Android / Web)", GREEN),
    (0.55, 2.82, 5.9, 0.42, "App services + capacity / queue engine (JS)", ORANGE),
]
for x, y, w, h, t, fill in arch:
    add_rect(s3, x, y, w, h, fill, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    add_textbox(s3, x, y, w, h, [(t, {"size": 11, "bold": True, "color": WHITE, "align": PP_ALIGN.CENTER})], valign=MSO_ANCHOR.MIDDLE)

# arrows
for ay in (2.22, 2.74, 3.24):
    add_textbox(s3, 3.2, ay, 0.6, 0.22, [("▼", {"size": 12, "bold": True, "color": DEEP_GREEN, "align": PP_ALIGN.CENTER})])

# data / voice split
add_rect(s3, 0.55, 3.40, 2.85, 0.72, DEEP_GREEN, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
add_textbox(s3, 0.55, 3.40, 2.85, 0.72, [
    ("Firebase / Firestore", {"size": 11, "bold": True, "color": WHITE, "align": PP_ALIGN.CENTER, "space_after": 0}),
    ("bookings, queues, users, rules", {"size": 9, "color": WHITE, "align": PP_ALIGN.CENTER}),
], valign=MSO_ANCHOR.MIDDLE)

add_rect(s3, 3.60, 3.40, 2.85, 0.72, DEEP_GREEN, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
add_textbox(s3, 3.60, 3.40, 2.85, 0.72, [
    ("Node.js (Express) on Render", {"size": 11, "bold": True, "color": WHITE, "align": PP_ALIGN.CENTER, "space_after": 0}),
    ("IVR + chatbot: /health /voice /chat…", {"size": 9, "color": WHITE, "align": PP_ALIGN.CENTER}),
], valign=MSO_ANCHOR.MIDDLE)

add_rect(s3, 0.55, 4.28, 2.85, 0.58, NAVY, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
add_textbox(s3, 0.55, 4.28, 2.85, 0.58, [
    ("Queue / slot data + notifications", {"size": 9.5, "bold": True, "color": WHITE, "align": PP_ALIGN.CENTER, "space_after": 0}),
    ("Expo push + SMS outbox (gateway pending)", {"size": 8.5, "color": WHITE, "align": PP_ALIGN.CENTER}),
], valign=MSO_ANCHOR.MIDDLE)

add_rect(s3, 3.60, 4.28, 2.85, 0.58, NAVY, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
add_textbox(s3, 3.60, 4.28, 2.85, 0.58, [
    ("Telephony: sim (active)", {"size": 9.5, "bold": True, "color": WHITE, "align": PP_ALIGN.CENTER, "space_after": 0}),
    ("Plivo / Twilio coded, not live", {"size": 8.5, "color": WHITE, "align": PP_ALIGN.CENTER}),
], valign=MSO_ANCHOR.MIDDLE)

add_rect(s3, 0.55, 5.02, 5.9, 0.52, RGBColor(0x6A, 0x1B, 0x9A), shape=MSO_SHAPE.ROUNDED_RECTANGLE)
add_textbox(s3, 0.55, 5.02, 5.9, 0.52, [
    ("Chatbot: ChatbotScreen → Node /chat → Gemini API", {"size": 11, "bold": True, "color": WHITE, "align": PP_ALIGN.CENTER}),
], valign=MSO_ANCHOR.MIDDLE)

add_rect(s3, 0.55, 5.70, 5.9, 0.95, LIGHT_GREEN, line=GREEN, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
add_textbox(s3, 0.68, 5.78, 5.65, 0.82, [
    [("Honest stack notes: ", {"size": 10.5, "bold": True, "color": DEEP_GREEN}),
     ("Firebase project agrobridge-sih26; TESTING_MODE=true; government rail = mock adapters; hosting = Firebase Hosting (dist) + Render free tier.", {"size": 10.5, "color": DARK})],
], valign=MSO_ANCHOR.TOP)

# Right: tech stack table
header_card(s3, 6.85, 1.28, 6.2, 0.36, "TECH STACK", fill=DEEP_GREEN, title_size=12)

stack_rows = [
    ("Layer", "Technology", "Purpose"),
    ("Frontend", "React Native 0.86 / Expo ~57 (JS)", "Multi-role mobile app"),
    ("Backend", "Node.js Express on Render", "IVR + chatbot services"),
    ("Database", "Firebase / Firestore", "Bookings, queues, users, rules"),
    ("AI", "Gemini API", "Assistant chatbot (EN/HI/Hinglish)"),
    ("IVR / Voice", "sim active; Plivo, Twilio coded", "Feature-phone booking path"),
    ("Web", "Firebase Hosting", "Static web build (dist)"),
    ("Push / SMS", "Expo push; SMS outbox queued", "Notifications (SMS GW pending)"),
    ("Engine", "JS capacity / queue / noshow models", "Slot & throughput logic"),
    ("Testing", "Firebase Emulator Suite", "Local functions / firestore tests"),
]
tbl_shape = s3.shapes.add_table(len(stack_rows), 3, Inches(6.85), Inches(1.74), Inches(6.2), Inches(3.55))
tbl = tbl_shape.table
tbl.columns[0].width = Inches(1.2)
tbl.columns[1].width = Inches(2.5)
tbl.columns[2].width = Inches(2.5)
for ri, row in enumerate(stack_rows):
    for ci, val in enumerate(row):
        fill_cell(tbl.cell(ri, ci), val, bold=(ri == 0 or ci == 0), size=9.5 if ri else 10, color=WHITE if ri == 0 else DARK)
style_table(tbl)

# User roles
header_card(s3, 6.85, 5.42, 6.2, 0.34, "USER ROLES (IMPLEMENTED)", fill=NAVY, title_size=11)
card_body(s3, 6.85, 5.78, 6.2, 0.88, LIGHT_BLUE, border=NAVY)
add_textbox(s3, 6.98, 5.84, 5.95, 0.78, [
    [("Farmer: ", {"size": 9.5, "bold": True, "color": NAVY}), ("register, book slot, queue/token, status, chatbot.  ", {"size": 9.5, "color": DARK}),
     ("Mandi Staff: ", {"size": 9.5, "bold": True, "color": NAVY}), ("gate scan, stages, assay, weigh, mark paid, reports.", {"size": 9.5, "color": DARK})],
    [("Trader: ", {"size": 9.5, "bold": True, "color": NAVY}), ("auction board & bidding (prototype).  ", {"size": 9.5, "color": DARK}),
     ("Arhtiya: ", {"size": 9.5, "bold": True, "color": NAVY}), ("bulk booking for linked farmers (prototype).", {"size": 9.5, "color": DARK})],
], valign=MSO_ANCHOR.TOP)

# ===================== SLIDE 4 — FEASIBILITY AND VIABILITY =====================
s4 = prs.slides[3]
add_panel(s4, y0=1.05, y1=7.48, x0=0.12, x1=13.22)

feas_cols = [
    (0.35, "WHY IT IS FEASIBLE?", GREEN, LIGHT_GREEN, [
        "Working multi-role prototype already in repo",
        "Modular RN/Expo + Node + Firestore architecture",
        "Firebase Hosting web build + emulator tests present",
        "Capacity / queue engine + noshow models implemented",
        "Gemini chatbot wired through Node /chat",
        "SIM-based IVR path coded (default PROVIDER=sim)",
        "Mock govRail adapters ready for staged integration",
    ]),
    (4.60, "CHALLENGES", RED, LIGHT_RED, [
        "Farmer digital literacy & rural connectivity",
        "Adoption by mandi staff on legacy workflows",
        "IVR reliability — Twilio/Plivo accounts not live yet",
        "SMS gateway still queued in outbox (not delivered)",
        "External govt systems mocked (no live MFMB/e-Kharid)",
        "Data sync & scale during harvest peaks",
        "Firestore rules still Mode A (open) for testing",
    ]),
    (8.85, "MITIGATION STRATEGIES", NAVY, LIGHT_BLUE, [
        "Multilingual UI (EN / HI / PA / MR)",
        "IVR / keypad path for basic-phone users",
        "Simple farmer booking flow + QR gate pass",
        "Offline-tolerant gate pass verification",
        "Staged integration via mock adapters → live APIs",
        "Telemetry + report screens for monitoring",
        "Plan Mode B rules hardening before production",
        "Free-tier cloud (Firebase + Render) for cost control",
    ]),
]
for x, title, hdr, body_fill, items in feas_cols:
    header_card(s4, x, 1.30, 4.05, 0.36, title, fill=hdr, title_size=13)
    card_body(s4, x, 1.72, 4.05, 3.55, body_fill, border=hdr)
    bullets_block(s4, x + 0.12, 1.82, 3.8, 3.35, items, size=12.5, bullet_color=hdr)

add_rect(s4, 0.35, 5.48, 12.7, 1.25, CREAM, line=ORANGE, shape=MSO_SHAPE.ROUNDED_RECTANGLE, line_w=1.25)
add_textbox(s4, 0.52, 5.56, 12.4, 1.1, [
    [("ROUND 1 → ROUND 2: ", {"size": 12, "bold": True, "color": DEEP_GREEN}),
     ("concept → working multi-role prototype (app + backend + engine + IVR/chatbot prototype).", {"size": 12, "bold": True, "color": DARK})],
    [("Viability notes: ", {"size": 11, "bold": True, "color": NAVY, "space_before": 4}),
     ("cloud on free tiers for demo scale; telephony/SMS costs need paid accounts before production; no claimed government or mandi deployment yet.", {"size": 11, "color": DARK})],
    [("Still pending: ", {"size": 11, "bold": True, "color": RED}),
     ("production security rules, SMS gateway, live Twilio/Plivo, real e-Kharid / MFMB integration, field pilot data.", {"size": 11, "color": RED})],
], valign=MSO_ANCHOR.TOP)

# ===================== SLIDE 5 — IMPACT AND BENEFITS =====================
# Editable title already on layout; content image starts ~0.94" — overlay below title (~1.10")
# Slide 5 panel ends at 6.93 so SIH landscape branding remains at bottom
s5 = prs.slides[4]
add_panel(s5, y0=1.12, y1=6.93, x0=0.12, x1=13.22)  # keep SIH landscape footer strip on slide 5

impact_cols = [
    (0.35, "FARMERS", ORANGE, CREAM, [
        "Know when to arrive via booked slot & live queue",
        "Less uncertainty on procurement schedule / status",
        "App + chatbot + IVR access path (prototype)",
        "Digital gate pass & downloadable receipts (in-app)",
        "Clearer visibility of assay / weigh / payment stages",
    ]),
    (4.60, "MANDI STAFF", GREEN, LIGHT_GREEN, [
        "Stage-wise queue visibility (gate → assay → weigh → paid)",
        "Capacity / yard setup tools for planned inflow",
        "Gate scan reduces manual headcounts",
        "Reports & telemetry screens for operations",
        "Less ad-hoc coordination on peak days",
    ]),
    (8.85, "SYSTEM / TRANSPARENCY", NAVY, LIGHT_BLUE, [
        "Digital records across the procurement chain",
        "Status visible to farmer, trader & staff together",
        "Modular workflow ready for staged govt integration",
        "Audit-friendly bookings, auctions & receipts (prototype)",
    ]),
]
for x, title, hdr, body_fill, items in impact_cols:
    header_card(s5, x, 1.24, 4.05, 0.36, title, fill=hdr, title_size=13)
    card_body(s5, x, 1.66, 4.05, 2.55, body_fill, border=hdr)
    bullets_block(s5, x + 0.12, 1.76, 3.8, 2.35, items, size=12, bullet_color=hdr)

# Quantification honesty box
add_rect(s5, 0.35, 4.40, 12.7, 2.30, LIGHT_ORANGE, line=ORANGE, shape=MSO_SHAPE.ROUNDED_RECTANGLE, line_w=1.5)
header_card(s5, 0.55, 4.55, 12.3, 0.36, "IMPACT QUANTIFICATION — HONEST STATUS", fill=DEEP_GREEN, title_size=12)
add_textbox(s5, 0.70, 5.02, 12.0, 1.55, [
    [("Current prototype: ", {"size": 12, "bold": True, "color": NAVY}),
     ("no measured waiting-time, manpower or economic-impact results yet. Demo runs on seeded test accounts / simulator mode — not live mandi field data.", {"size": 12, "color": DARK})],
    [("Projected / modelled benefits ", {"size": 12, "bold": True, "color": DEEP_GREEN, "space_before": 6}),
     ("(to be validated with pilot data — not measured claims): scheduled arrival → fewer pre-dawn road queues; live status → fewer counter enquiries; capacity-aware slots → smoother peak-day flow; digital records → greater transparency.", {"size": 12, "color": DARK})],
    [("Do not cite as achieved reductions: ", {"size": 11.5, "bold": True, "color": RED, "space_before": 4}),
     ("“less waiting time”, “saves time & costs”, “reduced manpower” are design goals only until pilot metrics exist.", {"size": 11.5, "italic": True, "color": RED})],
], valign=MSO_ANCHOR.TOP)

# ===================== SLIDE 6 — RESEARCH AND REFERENCES =====================
s6 = prs.slides[5]
add_panel(s6, y0=1.10, y1=7.48, x0=0.12, x1=13.22)

ref_rows = [
    ("Area", "Source"),
    ("APMC / mandi process", "State APMC Act summaries; AgriStack & state marketing-board guidance (e.g., Haryana Agricultural Produce Markets Act) — agriharyana.gov.in"),
    ("Govt procurement & MSP", "Dept. of Food & Public Distribution; CACP MSP notifications — dfpd.gov.in; acac.gov.in"),
    ("eNAM national e-trading", "National Agriculture Market (eNAM), Ministry of Agriculture — enam.gov.in"),
    ("Farmer registration", "Meri Fasal Mera Byora (Haryana) & e-Kharid portals — mfmb.haryana.gov.in; ekharid.in"),
    ("Quality norms (FAQ)", "FCI / Govt of India FAQ norms for foodgrains — fci.gov.in"),
    ("Digital agriculture context", "ICAR / Ministry of Agriculture digital-agriculture material; NASSCOM & NABARD digital-inclusion studies"),
    ("Technical: mobile & data", "React Native / Expo docs (docs.expo.dev); Firebase / Firestore docs (firebase.google.com/docs)"),
    ("Technical: AI & voice", "Google Gemini API docs (ai.google.dev); Twilio & Plivo voice API docs (twilio.com/docs/voice; plivo.com/voice/api/)"),
    ("In-product references", "Kisan Suvidha & Kisan Sarathi (farmer services); eNAM — used as competitive/landscape research in Round 1"),
]
tbl6 = s6.shapes.add_table(len(ref_rows), 2, Inches(0.40), Inches(1.28), Inches(12.55), Inches(4.92)).table
tbl6.columns[0].width = Inches(3.0)
tbl6.columns[1].width = Inches(9.55)
for ri, (a, b) in enumerate(ref_rows):
    fill_cell(tbl6.cell(ri, 0), a, bold=True, size=11 if ri == 0 else 10.5, color=WHITE if ri == 0 else DEEP_GREEN)
    fill_cell(tbl6.cell(ri, 1), b, bold=(ri == 0), size=11 if ri == 0 else 10.5, color=WHITE if ri == 0 else DARK)
style_table(tbl6, header_size=11, body_size=10.5)

add_rect(s6, 0.40, 6.34, 12.55, 0.50, LIGHT_GREEN, line=GREEN, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
add_textbox(s6, 0.55, 6.36, 12.25, 0.46, [
    ("All sources are public government portals or official technical documentation. Round 1 background also used Kisan Suvidha / Kisan Sarathi / eNAM and mentor guidance — no fabricated references.", {"size": 11, "italic": True, "color": DEEP_GREEN, "align": PP_ALIGN.CENTER}),
], valign=MSO_ANCHOR.MIDDLE)

for i, sl in enumerate(prs.slides, 1):
    if i == 1:
        continue  # cover: no footer/slide number in template
    # slide 5 footer sits on green landscape → white; others on white panel → deep green
    raise_footers(sl, color=WHITE if i == 5 else DEEP_GREEN)

# Slide 1: nudge body box down so it clears the wrapped subtitle (no content redesign)
for sh in prs.slides[0].shapes:
    if sh.name == "TextBox 9" and sh.top is not None and sh.top < Inches(2.1):
        sh.top = Inches(2.15)
        sh.height = Inches(5.20)

prs.save(OUT)
print("Saved", OUT, "slides=", len(prs.slides))

# Verification dump
prs2 = Presentation(OUT)
assert len(prs2.slides) == 6
print("slide size in:", prs2.slide_width / 914400, prs2.slide_height / 914400)
for i, s in enumerate(prs2.slides, 1):
    texts = []
    for sh in s.shapes:
        if sh.has_text_frame and sh.text_frame.text.strip():
            texts.append(sh.text_frame.text.strip().replace("\n", " | ")[:80])
    print(f"S{i}: {len(s.shapes)} shapes; sample: {texts[:3]}")
