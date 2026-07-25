from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math
import html

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "mockups" / "favorite-continuation"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 900, 1700
SCREEN = (82, 72, 818, 1628)


def font(size, bold=False):
    paths = [
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
    ]
    for path in paths:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()


F24, F28 = font(24), font(28)
B24, B34, B44, B64 = font(24, True), font(34, True), font(44, True), font(64, True)


def rr(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def center(draw, box, text, fnt, fill):
    b = draw.textbbox((0, 0), text, font=fnt)
    x = box[0] + (box[2] - box[0] - b[2] + b[0]) / 2
    y = box[1] + (box[3] - box[1] - b[3] + b[1]) / 2 - 4
    draw.text((x, y), text, font=fnt, fill=fill)


def phone(bg, screen):
    img = Image.new("RGBA", (W, H), bg)
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    rr(sd, (52, 46, 848, 1650), 98, (0, 0, 0, 82))
    img = Image.alpha_composite(img, sh.filter(ImageFilter.GaussianBlur(30)))
    d = ImageDraw.Draw(img, "RGBA")
    rr(d, (58, 52, 842, 1638), 100, (10, 14, 13))
    rr(d, SCREEN, 72, screen)
    rr(d, (350, 74, 550, 124), 0, (10, 14, 13))
    return img


def shadow(img, box, blur=18, alpha=55):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse((box[0], box[1] + 18, box[2], box[3] + 18), fill=(0, 0, 0, alpha))
    return Image.alpha_composite(img, layer.filter(ImageFilter.GaussianBlur(blur)))


def status(draw, dark=True):
    c = (250, 248, 235, 230) if dark else (28, 31, 28, 230)
    draw.text((132, 150), "C", font=B24, fill=c)
    center(draw, (330, 145, 570, 188), "C Major", B24, c)


def hole(img, x, y, r, note, fill, ring, text, root=False, oval=(1, 1)):
    box = (x - r * oval[0], y - r * oval[1], x + r * oval[0], y + r * oval[1])
    img = shadow(img, box, blur=18 if root else 14, alpha=62 if root else 44)
    d = ImageDraw.Draw(img, "RGBA")
    d.ellipse(box, fill=fill, outline=ring, width=13 if root else 7)
    if root:
        inset = 20
        d.ellipse((box[0] + inset, box[1] + inset, box[2] - inset, box[3] - inset), outline=(255, 255, 255, 80), width=3)
    center(d, box, note, B44 if root else B24, text)
    return img


def capsule_hole(img, x, y, w, h, note, fill, ring, text, root=False):
    box = (x - w / 2, y - h / 2, x + w / 2, y + h / 2)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    rr(ld, (box[0], box[1] + 18, box[2], box[3] + 18), min(w, h) / 2, (0, 0, 0, 48))
    img = Image.alpha_composite(img, layer.filter(ImageFilter.GaussianBlur(15)))
    d = ImageDraw.Draw(img, "RGBA")
    rr(d, box, min(w, h) / 2, fill, ring, 11 if root else 6)
    center(d, box, note, B34 if root else B24, text)
    return img


palette = {
    "sand": ((238, 230, 216), (220, 205, 184), (245, 238, 224), (88, 76, 60), (29, 28, 25)),
    "dark_metal": ((225, 226, 220), (14, 17, 18), (32, 34, 34), (196, 205, 203), (246, 246, 238)),
    "jade": ((226, 235, 229), (9, 37, 33), (38, 105, 86), (142, 235, 195), (248, 255, 246)),
    "brass": ((238, 230, 215), (58, 37, 20), (183, 124, 50), (239, 193, 86), (255, 247, 222)),
    "clay": ((240, 231, 216), (61, 36, 25), (174, 93, 58), (236, 158, 98), (255, 237, 215)),
    "pearl": ((240, 236, 226), (229, 222, 208), (246, 241, 229), (191, 184, 166), (34, 34, 31)),
    "blueblack": ((224, 230, 231), (7, 17, 21), (29, 56, 66), (116, 216, 226), (248, 255, 252)),
}

concepts = [
    ("01", "Pebble Constellation", "Seven polished stone pads float on a calm mineral surface, with root as the central boulder.", "Excellent two-thumb play around the central root; one hand can orbit naturally.", "Less wind-like unless activation adds breathy light from beneath.", [9, 9, 9, 8, 9], "constellation", "sand"),
    ("02", "Mercury Ocarina", "Liquid metal tone domes embedded in a dark hand-held plate.", "Very strong object desire and clear root dominance.", "Reflective surfaces can reduce note legibility.", [8, 10, 8, 9, 10], "mercury", "dark_metal"),
    ("03", "River Reed Favorite", "An evolved offset reed with larger carved pads and a more sculptural body.", "Best one-thumb path from top-left root to lower notes.", "Right-handed bias is visible; would need a handedness setting.", [9, 9, 10, 8, 9], "river", "jade"),
    ("04", "Handpan Ocarina", "A handpan-like oval with ocarina holes, root large at the upper center.", "Balanced for two thumbs and credible as a musical object.", "May imply percussive tapping more than sustained notes.", [9, 9, 9, 9, 9], "handpan", "brass"),
    ("05", "Center Breath Flower", "Root sits in the middle as the breath source; six notes surround it like tone vents.", "Teaches tonal center instantly without text.", "Could become decorative if the forms look too floral.", [9, 9, 9, 9, 9], "center", "jade"),
    ("06", "Quiet Brass Stem", "A key-like root chamber flows into a single vertical stem of notes.", "Most beginner-readable continuation from the favorite key concept.", "Upper root plus lower notes can be tall for one-handed reach.", [10, 8, 8, 8, 8], "stem", "brass"),
    ("07", "Ceramic Thumb Bowl", "A soft ceramic bowl holds the root, with other notes inset into its rim.", "Feels like a real held instrument and supports thumb alternation.", "Less linear; beginners may not immediately know note order.", [8, 9, 9, 9, 10], "bowl", "clay"),
    ("08", "Pebble Reed Column", "The beige pebble aesthetic becomes a vertical wind instrument.", "Large comfortable targets; calm and unintimidating.", "Can feel more wellness-product than musical instrument.", [10, 8, 9, 7, 8], "pebble_column", "sand"),
    ("09", "Molten Brass Ocarina", "A molten brass instrument plate with dark negative-space note holes.", "Warm, premium, and strong under stage lighting.", "Dark holes need glow or haptics to feel active.", [8, 9, 8, 9, 9], "molten", "brass"),
    ("10", "Black Glass Breath Stone", "A glassy black stone with raised transparent note lenses.", "Most premium and collectible of the hardware-like directions.", "Can feel cold for a social acoustic jam.", [8, 10, 8, 9, 10], "glass_stone", "dark_metal"),
    ("11", "Thumb Crescent", "Seven notes ride along a crescent shaped for the right thumb arc.", "Exceptional one-hand reach and rhythmic thumb travel.", "Needs mirrored mode for left-handed play.", [9, 9, 10, 9, 9], "crescent", "blueblack"),
    ("12", "Dual Grip Ocarina", "Root in the center, three notes for each thumb on left and right grips.", "Best two-handed performance layout in this batch.", "One-handed play is weaker than offset layouts.", [8, 9, 10, 9, 9], "dual_grip", "jade"),
    ("13", "Soft Monolith Holes", "A quiet monolith where holes are pressed into a single soft material.", "No clutter; feels physically playable and mature.", "Less visually surprising than the more sculptural options.", [10, 8, 9, 8, 8], "monolith", "pearl"),
    ("14", "Breath Compass", "Root is the north point of a compact compass-like instrument.", "Memorable hierarchy and easy mental map for beginners.", "Compass metaphor may suggest navigation, not sound.", [8, 9, 9, 8, 9], "compass", "dark_metal"),
    ("15", "Carved Reed Slab", "A stone slab with deep carved oval tone openings.", "Strong tactile identity and simple full-screen play area.", "Could feel heavy unless sound feedback is airy.", [9, 8, 9, 8, 8], "slab", "sand"),
    ("16", "Floating Pearl Holes", "Pearl-like raised pads over a subtle resonant body.", "Highly approachable while still polished and adult.", "Less strongly wind-coded than holes or tubes.", [9, 9, 9, 8, 9], "pearls", "pearl"),
    ("17", "Side-Reed Grip", "A narrow wind body shifted to the side so the thumb owns the whole instrument.", "Very strong for one-handed walking or casual jamming.", "Two-handed play is less centered.", [9, 8, 10, 8, 8], "side", "jade"),
    ("18", "Root Basin", "A huge lower root basin anchors six smaller upper tone ports.", "Root hierarchy is unmistakable and thumb-friendly.", "Higher notes can feel secondary or harder to reach.", [10, 9, 8, 8, 9], "basin", "clay"),
    ("19", "Tonal Spine Ring", "A vertical spine with a halo ring around root and smaller drilled ports below.", "Very readable and instrument-like.", "Less radical than the object-cluster references.", [10, 8, 9, 8, 8], "ring_spine", "brass"),
    ("20", "Obsidian Thumbprint", "Seven thumbprint depressions pressed into black stone.", "Feels like an artifact made for touch, not screen UI.", "Dark tone may need careful contrast outdoors.", [8, 10, 9, 9, 10], "thumbprint", "dark_metal"),
    ("21", "Clay Air Pocket", "Each note is an air pocket in a hand-formed clay vessel.", "Warm, acoustic, and beginner-friendly.", "May skew rustic unless edges are refined.", [9, 8, 9, 8, 8], "air_pocket", "clay"),
    ("22", "Jade Resonator", "A jade-like resonant body with root as a suspended central lens.", "Premium, calm, and distinct from ordinary app controls.", "Requires excellent material rendering to avoid flatness.", [9, 9, 9, 9, 9], "resonator", "jade"),
    ("23", "Seven Stones Instrument", "The original pebble reference translated into seven actual scale stones.", "Most emotionally approachable for non-musicians.", "Least explicitly wind-like and may feel too soft.", [10, 9, 9, 7, 8], "seven_stones", "sand"),
    ("24", "Chrome Breath Plate", "A dark plate with chrome domes arranged as a playable tone map.", "Strongest luxury-hardware feel; instantly memorable.", "Could intimidate beginners if it feels too precious.", [8, 10, 8, 9, 10], "chrome_plate", "dark_metal"),
]


def body(draw, kind, pal):
    bg, screen, base, accent, text = pal
    if kind in ("constellation", "seven_stones", "pearls"):
        return
    if kind in ("mercury", "chrome_plate", "thumbprint", "glass_stone"):
        rr(draw, (150, 240, 750, 1440), 80, base)
        for y in range(330, 1320, 150):
            draw.arc((120, y, 780, y + 220), 10, 170, fill=accent + (28,), width=4)
    elif kind in ("river", "crescent", "side"):
        pts = [(350, 245), (670, 470), (570, 1450), (260, 1380), (220, 540)]
        draw.polygon(pts, fill=base)
        draw.line(pts + [pts[0]], fill=accent + (180,), width=5)
    elif kind in ("handpan", "bowl", "molten", "air_pocket"):
        draw.ellipse((150, 270, 750, 1370), fill=base)
        draw.ellipse((225, 390, 675, 1210), outline=accent + (105,), width=8)
    elif kind == "center":
        draw.ellipse((210, 310, 690, 1230), fill=base)
        draw.ellipse((275, 450, 625, 1100), fill=accent + (75,))
    elif kind in ("stem", "pebble_column", "ring_spine", "monolith"):
        rr(draw, (315, 250, 585, 1440), 135, base)
    elif kind == "dual_grip":
        rr(draw, (175, 350, 370, 1240), 98, base)
        rr(draw, (530, 350, 725, 1240), 98, base)
        draw.ellipse((315, 500, 585, 820), fill=accent + (80,))
    elif kind in ("compass", "resonator"):
        draw.ellipse((180, 310, 720, 1210), fill=base)
        draw.line((450, 370, 450, 1140), fill=accent + (90,), width=5)
        draw.line((245, 760, 655, 760), fill=accent + (90,), width=5)
    elif kind in ("slab",):
        rr(draw, (180, 280, 720, 1320), 38, base)
    elif kind == "basin":
        draw.ellipse((190, 855, 710, 1470), fill=base)
        rr(draw, (330, 300, 570, 1035), 120, base)


def pos(kind):
    maps = {
        "constellation": [(450, 735, 142), (300, 410, 92), (600, 410, 92), (250, 760, 72), (650, 760, 72), (315, 1085, 86), (575, 1180, 82)],
        "mercury": [(450, 760, 148), (310, 405, 86), (590, 405, 86), (255, 690, 66), (655, 690, 66), (315, 1080, 78), (560, 1240, 70)],
        "river": [(360, 400, 118), (450, 570, 78), (545, 745, 76), (430, 915, 76), (335, 1085, 78), (455, 1245, 78), (575, 1390, 72)],
        "handpan": [(450, 430, 132), (300, 690, 88), (600, 690, 88), (450, 850, 78), (315, 1070, 88), (585, 1070, 88), (450, 1250, 78)],
        "center": [(450, 760, 138), (450, 500, 76), (640, 650, 76), (610, 925, 76), (450, 1085, 76), (290, 925, 76), (260, 650, 76)],
        "stem": [(450, 430, 140), (450, 690, 78), (450, 850, 78), (450, 1010, 78), (450, 1170, 78), (450, 1330, 78), (450, 1450, 62)],
        "bowl": [(450, 720, 132), (330, 500, 76), (570, 500, 76), (625, 780, 76), (530, 1010, 76), (370, 1010, 76), (275, 780, 76)],
        "pebble_column": [(450, 400, 128), (450, 635, 82), (450, 820, 82), (450, 1005, 82), (450, 1190, 82), (450, 1375, 82), (450, 1490, 58)],
        "molten": [(450, 430, 128), (300, 670, 82), (600, 670, 82), (450, 850, 76), (315, 1080, 82), (585, 1080, 82), (450, 1260, 76)],
        "glass_stone": [(450, 710, 150), (310, 430, 82), (590, 430, 82), (265, 755, 70), (635, 755, 70), (330, 1090, 84), (570, 1200, 76)],
        "crescent": [(320, 470, 122), (430, 625, 78), (540, 785, 76), (620, 970, 76), (520, 1150, 76), (385, 1305, 76), (270, 1420, 62)],
        "dual_grip": [(450, 655, 132), (275, 550, 76), (625, 550, 76), (275, 760, 76), (625, 760, 76), (275, 970, 76), (625, 970, 76)],
        "monolith": [(450, 405, 126), (450, 635, 76), (450, 805, 76), (450, 975, 76), (450, 1145, 76), (450, 1315, 76), (450, 1460, 62)],
        "compass": [(450, 430, 126), (450, 650, 78), (620, 760, 78), (450, 930, 78), (280, 760, 78), (335, 1085, 78), (565, 1085, 78)],
        "slab": [(450, 400, 130), (330, 620, 88), (570, 620, 88), (450, 830, 82), (330, 1045, 88), (570, 1045, 88), (450, 1260, 82)],
        "pearls": [(450, 735, 140), (305, 440, 88), (595, 440, 88), (270, 760, 76), (630, 760, 76), (330, 1090, 84), (570, 1180, 78)],
        "side": [(300, 430, 126), (300, 650, 78), (300, 825, 78), (300, 1000, 78), (300, 1175, 78), (300, 1350, 78), (300, 1480, 58)],
        "basin": [(450, 1230, 156), (450, 430, 78), (450, 590, 78), (450, 750, 78), (450, 910, 78), (350, 1050, 70), (550, 1050, 70)],
        "ring_spine": [(450, 390, 132), (450, 640, 76), (450, 805, 76), (450, 970, 76), (450, 1135, 76), (450, 1300, 76), (450, 1450, 62)],
        "thumbprint": [(430, 430, 128), (330, 650, 78), (565, 710, 78), (330, 900, 78), (565, 960, 78), (330, 1150, 78), (565, 1260, 72)],
        "air_pocket": [(450, 520, 132), (315, 735, 82), (585, 735, 82), (450, 900, 78), (320, 1110, 82), (580, 1110, 82), (450, 1280, 76)],
        "resonator": [(450, 650, 140), (450, 410, 78), (620, 650, 78), (450, 895, 78), (280, 650, 78), (345, 1080, 76), (555, 1080, 76)],
        "seven_stones": [(450, 760, 144), (315, 430, 92), (590, 455, 84), (250, 760, 80), (655, 790, 80), (340, 1110, 90), (575, 1215, 82)],
        "chrome_plate": [(450, 735, 150), (300, 410, 88), (600, 410, 88), (260, 720, 72), (640, 720, 72), (325, 1085, 84), (575, 1190, 76)],
    }
    return maps[kind]


def render(c):
    num, name, rationale, ergo, weak, scores, kind, pal_key = c
    pal = palette[pal_key]
    bg, screen, base, accent, text = pal
    img = phone(bg, screen)
    d = ImageDraw.Draw(img, "RGBA")
    status(d, dark=sum(screen) < 430)
    body(d, kind, pal)
    notes = ["C", "D", "E", "F", "G", "A", "B"]
    for i, (x, y, r) in enumerate(pos(kind)):
        root = i == 0
        fill = (9, 20, 18, 245) if sum(base) > 390 else tuple(min(255, v + 34) for v in base) + (245,)
        ring = accent + (245 if root else 205,)
        t = text
        if kind in ("stem", "ring_spine", "monolith", "side", "pebble_column"):
            img = capsule_hole(img, x, y, r * (1.85 if root else 1.35), r * 2, notes[i], fill, ring, t, root)
        else:
            oval = (1.14, 0.92) if kind in ("constellation", "seven_stones", "pearls") and not root else (1, 1)
            img = hole(img, x, y, r, notes[i], fill, ring, t, root, oval)
    d = ImageDraw.Draw(img, "RGBA")
    label_col = text if sum(screen) < 430 else (29, 28, 25)
    d.text((126, 1465), name, font=B34, fill=label_col)
    d.text((126, 1515), "Seven notes. Root is home.", font=F28, fill=label_col + (210,) if len(label_col) == 3 else label_col)
    path = OUT / f"favorite-{num}-{name.lower().replace(' ', '-')}.png"
    img.convert("RGB").save(path, quality=95)
    return path


for concept in concepts:
    render(concept)

thumb_w, thumb_h = 180, 340
cols = 8
rows = math.ceil(len(concepts) / cols)
sheet = Image.new("RGB", (cols * thumb_w, rows * thumb_h), (244, 240, 232))
for i, p in enumerate(sorted(OUT.glob("favorite-*.png"))):
    im = Image.open(p).resize((thumb_w, thumb_h))
    sheet.paste(im, ((i % cols) * thumb_w, (i // cols) * thumb_h))
sheet.save(OUT / "contact-sheet.png")

ranked = sorted(concepts, key=lambda c: (sum(c[5]), c[5][0] + c[5][2]), reverse=True)
rank_html = "".join(
    f"<li><strong>{i}. {html.escape(c[1])}</strong><span>{sum(c[5])}/50</span><p>{html.escape(c[2])}</p></li>"
    for i, c in enumerate(ranked[:8], 1)
)

cards = []
for num, name, rationale, ergo, weak, scores, kind, pal_key in concepts:
    file = f"mockups/favorite-continuation/favorite-{num}-{name.lower().replace(' ', '-')}.png"
    labels = ["Beginner", "Memorable", "Ergonomics", "Expressive", "Unique"]
    score_items = "".join(f"<li><span>{a}</span><strong>{b}/10</strong></li>" for a, b in zip(labels, scores))
    cards.append(f"""
      <article class="concept-card">
        <img src="{file}" alt="{html.escape(name)} mobile instrument mockup" />
        <div class="concept-copy">
          <p class="kicker">Continuation {num}</p>
          <h2>{html.escape(name)}</h2>
          <p>{html.escape(rationale)}</p>
          <h3>Ergonomic strengths</h3>
          <p>{html.escape(ergo)}</p>
          <h3>Weaknesses</h3>
          <p>{html.escape(weak)}</p>
          <ul class="scores">{score_items}<li><span>Total</span><strong>{sum(scores)}/50</strong></li></ul>
        </div>
      </article>
    """)

page = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Favorite-Based Instrument Directions</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <main>
      <header class="hero">
        <p>Continuation from your favorites</p>
        <h1>24 new directions based on the strongest screens</h1>
        <span>Built from the reference signals: tactile stones, dark polished hardware, sculptural reed bodies, handpan/ocarina ergonomics, and a visibly dominant root note.</span>
      </header>

      <section class="principles">
        <div><strong>What your favorites suggest</strong><span>Physical, carved, calm, premium, and almost object-like.</span></div>
        <div><strong>Main design bet</strong><span>The phone should feel like a resonant body with holes, not a screen with buttons.</span></div>
        <div><strong>Root behavior</strong><span>C is treated as home: largest, most central, or most structurally important.</span></div>
        <div><strong>Next decision</strong><span>Choose between one-thumb path, two-thumb cluster, or collectible hardware object.</span></div>
      </section>

      <section class="recommendations">
        <div>
          <h2>Top ranked in this continuation</h2>
          <ol>{rank_html}</ol>
        </div>
        <div>
          <h2>Best near-term refinement</h2>
          <p><strong>River Reed Favorite</strong> is the cleanest practical evolution of your selected direction: asymmetric, thumb-friendly, full-screen, and clearly instrument-like.</p>
          <h2>Best iconic product direction</h2>
          <p><strong>Mercury Ocarina</strong> or <strong>Chrome Breath Plate</strong> feel most like a new object category someone would remember, show a friend, and want to keep using.</p>
        </div>
      </section>

      <section class="grid">
        {''.join(cards)}
      </section>
    </main>
  </body>
</html>
"""

(ROOT / "favorite-continuation.html").write_text(page, encoding="utf-8")

index = ROOT / "index.html"
text = index.read_text(encoding="utf-8")
link = '<a class="jump-link" href="favorite-continuation.html">Open the new favorite-based continuation set</a>'
if "favorite-continuation.html" not in text:
    text = text.replace("</header>", f"  {link}\n      </header>", 1)
    index.write_text(text, encoding="utf-8")

css_path = ROOT / "styles.css"
css = css_path.read_text(encoding="utf-8")
if ".jump-link" not in css:
    css += """

.jump-link {
  display: inline-flex;
  width: fit-content;
  margin-top: 8px;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--ink);
  background: #fffdf8;
  font-weight: 800;
  text-decoration: none;
}
"""
    css_path.write_text(css, encoding="utf-8")

print(f"Created {len(concepts)} continuation mockups in {OUT}")
