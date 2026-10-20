from pptx import Presentation
import glob, os, re, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Deep Team ID search with surrounding context
for f in glob.glob(r"C:\Users\pooja\Downloads\*.pptx") + glob.glob(r"C:\Users\pooja\agrobridge\*.pptx"):
    try:
        prs = Presentation(f)
    except Exception:
        continue
    for si, slide in enumerate(prs.slides, 1):
        for sh in slide.shapes:
            texts = []
            if sh.has_text_frame:
                texts.append(sh.text_frame.text)
            if sh.has_table:
                for row in sh.table.rows:
                    for c in row.cells:
                        texts.append(c.text)
            for t in texts:
                if re.search(r"Team\s*ID", t, re.I):
                    ctx = t.replace("\n", " | ")
                    # only print if there's something after Team ID that looks like a value
                    m = re.search(r"Team\s*ID\s*[:\-]?\s*(.*)", t, re.I | re.S)
                    val = m.group(1).strip()[:80] if m else ""
                    print(f"{os.path.basename(f)} | slide {si} | VAL=[{val}] | CTX={ctx[:200]}")

print("\n===== Trinetra file full text =====")
f = r"C:\Users\pooja\Downloads\Trinetra AgroBridge Presentation.pptx"
prs = Presentation(f)
for si, slide in enumerate(prs.slides, 1):
    for sh in slide.shapes:
        if sh.has_text_frame and sh.text_frame.text.strip():
            t = sh.text_frame.text.replace("\n", " | ")
            if re.search(r"team|69110|id", t, re.I):
                print(f"slide {si}: {t[:300]}")
