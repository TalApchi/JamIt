from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math
import html

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "mockups" / "wind-exploration"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 900, 1700
SCREEN = (82, 72, 818, 1628)


def load_font(size, bold=False):
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


F = {s: load_font(s) for s in [22, 26, 30, 34, 40, 52, 72]}
B = {s: load_font(s, True) for s in [24, 30, 36, 44, 58, 78, 110]}


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def center_text(draw, box, text, font, fill):
    bbox = draw.textbbox((0, 0), text, font=font)
    x = box[0] + (box[2] - box[0] - bbox[2] + bbox[0]) / 2
    y = box[1] + (box[3] - box[1] - bbox[3] + bbox[1]) / 2 - 4
    draw.text((x, y), text, font=font, fill=fill)


def phone_base(bg, screen):
    img = Image.new("RGBA", (W, H), bg)
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    rounded(sd, (52, 46, 848, 1650), 98, (0, 0, 0, 78))
    shadow = shadow.filter(ImageFilter.GaussianBlur(30))
    img = Image.alpha_composite(img, shadow)
    draw = ImageDraw.Draw(img, "RGBA")
    rounded(draw, (58, 52, 842, 1638), 100, (12, 16, 15))
    rounded(draw, SCREEN, 72, screen)
    rounded(draw, (350, 74, 550, 124), 0, (12, 16, 15))
    return img


def add_status(draw, scale="C Major", dark=True):
    color = (247, 250, 245, 225) if dark else (21, 29, 26, 230)
    draw.text((132, 150), "C", font=B[30], fill=color)
    center_text(draw, (330, 148, 570, 188), scale, B[24], color)


def ellipse_shadow(img, box, color=(0, 0, 0, 45), blur=16, offset=(0, 18)):
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    shifted = (box[0] + offset[0], box[1] + offset[1], box[2] + offset[0], box[3] + offset[1])
    sd.ellipse(shifted, fill=color)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    return Image.alpha_composite(img, sh)


def draw_hole(draw, img, x, y, r, note, fill, ring, text=(255, 255, 248), root=False):
    box = (x - r, y - r, x + r, y + r)
    img = ellipse_shadow(img, box, (0, 0, 0, 46), 15, (0, 18))
    draw = ImageDraw.Draw(img, "RGBA")
    draw.ellipse(box, fill=fill, outline=ring, width=12 if root else 7)
    if root:
        draw.ellipse((x - r + 20, y - r + 20, x + r - 20, y + r - 20), outline=(255, 255, 255, 65), width=3)
    center_text(draw, box, note, B[36] if root else B[24], text)
    return img


def draw_capsule(draw, box, fill, outline=None, width=3):
    rounded(draw, box, min((box[2]-box[0])//2, (box[3]-box[1])//2), fill, outline, width)


concepts = [
    ("01", "Monolith Flute", "A single vertical sound object with the root as the first large anchor hole.", "Natural for two thumbs and readable in one glance; root sits where the player expects to begin.", "Can become too close to a literal flute unless the material language is distinctive.", [9, 8, 9, 8, 8], "spine", "obsidian"),
    ("02", "Offset River Reed", "Seven holes flow diagonally like a reed instrument shaped by water.", "Great for one-handed thumb travel because the path follows the thumb arc.", "The diagonal hierarchy is less obvious for left-handed players.", [8, 8, 9, 8, 8], "diagonal", "jade"),
    ("03", "Ocarina Palm", "A palm-held ceramic form with grouped holes rather than a vertical lane.", "Feels like holding a small object; both thumbs can alternate naturally.", "Clustered notes may require more visual learning than a linear layout.", [8, 9, 8, 8, 9], "cluster", "ceramic"),
    ("04", "Glass Breath Column", "A translucent glass column with suspended tone chambers.", "Large central root gives a clear home note; side holes invite expressive alternation.", "Glass can look delicate, which may conflict with confident tapping.", [8, 9, 8, 9, 10], "column", "glass"),
    ("05", "Bamboo Split", "A warm split-bamboo instrument with seven carved openings.", "Comforting and acoustic; thumb zones are large and easy to target.", "Natural material may feel less premium if overdone.", [9, 8, 9, 7, 8], "split", "bamboo"),
    ("06", "Nordic Bone Flute", "Quiet pale material, precise holes, and restrained hierarchy.", "Calm, uncluttered, and very readable for beginners.", "Less emotionally expressive at first glance.", [9, 7, 9, 7, 8], "minimal", "nordic"),
    ("07", "Teenage Tone Bar", "A playful hardware-inspired slab with tactile circular tone wells.", "Strong product identity; excellent one-thumb reach across staggered wells.", "Can skew gadget-like if colors become too loud.", [8, 10, 8, 8, 9], "bar", "hardware"),
    ("08", "Ceramic Seed", "Seven seed-like openings embedded in a smooth ceramic body.", "Organic form invites touch without looking childish.", "Irregular spacing needs careful testing for muscle memory.", [8, 9, 8, 8, 9], "seed", "ceramic-dark"),
    ("09", "Chrome Harmonic Rail", "A polished metal rail with machined note ports.", "Premium, durable, and easy to understand as an instrument surface.", "Reflections and contrast need discipline for accessibility.", [8, 9, 8, 8, 9], "rail", "chrome"),
    ("10", "Liquid Reed", "A vertical liquid membrane where notes feel like openings in water.", "Expressive and memorable; root feels like the source of the whole scale.", "May feel less physically believable without excellent motion.", [7, 10, 8, 10, 10], "liquid", "aqua"),
    ("11", "Handpan Spine", "Handpan-inspired dimples arranged down a phone-length resonant shell.", "Very musical metaphor; large root dimple is obvious and satisfying.", "Handpan associations may imply percussion more than sustained tones.", [8, 9, 9, 9, 9], "handpan", "bronze"),
    ("12", "Pocket Bassoon", "Alternating large and small tone keys on a matte vertical body.", "Two-handed play feels natural because each thumb gets a lane.", "Slightly more complex visually than the simplest concepts.", [8, 8, 9, 9, 8], "two-lane", "walnut"),
    ("13", "Obsidian Ocarina", "A dark asymmetric ocarina surface with root as a glowing mouthpiece.", "Feels mysterious and premium; clustered holes are compact for one hand.", "Beginner sequence is not immediately linear.", [7, 9, 8, 8, 10], "ocarina", "obsidian"),
    ("14", "Japanese Shakuhachi Glass", "Minimal vertical holes with generous negative space and quiet glow.", "Very low clutter; root emphasis is unmistakable.", "May feel too austere for a social jam if sound feedback is subtle.", [9, 8, 9, 8, 9], "zen", "glass-smoke"),
    ("15", "Industrial Breath Valve", "A machined instrument with valve-like pads instead of app buttons.", "Great tactile metaphor; root valve is a large physical control.", "Industrial styling can intimidate complete beginners.", [7, 9, 9, 8, 9], "valves", "industrial"),
    ("16", "Pearl Tone Vessel", "A soft pearl surface with seven inlaid tone cups.", "Welcoming but premium; cups are visually touchable and accessible.", "Subtle palette may need haptics or glow to feel alive.", [9, 8, 9, 8, 8], "cups", "pearl"),
    ("17", "Magnetic Reed", "Seven magnetic nodes pulled along a central force line.", "Memorable hierarchy: root is the largest magnet and tonal center.", "Abstract metaphor may need onboarding animation.", [7, 9, 8, 9, 9], "magnetic", "graphite"),
    ("18", "Split Thumb Wing", "Two side wings for thumbs with the root in the center.", "Excellent for two-handed play while remaining playable with one thumb.", "Less flute-like; may drift toward controller design.", [8, 9, 10, 8, 9], "wings", "slate"),
    ("19", "Oxygen Column", "A sci-fi breath column with illuminated air chambers.", "Feels futuristic and instrument-like, with clear vertical note order.", "Could become too sci-fi for acoustic guitar sessions.", [8, 9, 9, 9, 9], "oxygen", "sci-fi"),
    ("20", "Soft Leather Reed", "A luxury leather-wrapped sound object with inset tone holes.", "Warm and physical; feels like an object someone owns for years.", "Leather metaphor may not communicate sound as clearly.", [8, 8, 9, 7, 8], "leather", "leather"),
    ("21", "Stone River Holes", "A carved stone slab with holes eroded by flow.", "Organic but grounded; generous targets support anxious beginners.", "Stone can feel heavy and less responsive.", [8, 8, 9, 8, 8], "river", "stone"),
    ("22", "Seven Breath Petals", "Petal-like tone apertures around a central root chamber.", "Very expressive for two thumbs and encourages musical alternation.", "Could become too decorative if petals look floral.", [8, 9, 8, 9, 9], "petals", "organic"),
    ("23", "Quiet Brass Key", "A brass key-like instrument with drilled circular ports.", "Premium and memorable; root is the large bow of the key.", "The key metaphor may imply unlocking more than playing.", [8, 9, 8, 8, 9], "key", "brass"),
    ("24", "Floating Tone Totem", "Seven floating discs suspended in a dark vertical chamber.", "Very clean full-screen play; root reads as the largest planet.", "Risks looking game-like if motion is too bouncy.", [8, 9, 8, 9, 9], "totem", "dark"),
    ("25", "Bauhaus Wind Grid", "Disciplined geometric tone wells with root as a large circle.", "Beginner-friendly and visually iconic; strong system for future scales.", "More designed surface than real instrument unless material is tactile.", [9, 9, 9, 8, 8], "bauhaus", "bauhaus"),
    ("26", "Folded Reed Paper", "A folded paper-like instrument with embossed note holes.", "Approachable and elegant; folds guide thumb travel.", "Paper metaphor may feel fragile or less premium.", [8, 8, 8, 7, 8], "fold", "paper"),
    ("27", "Ink Breath Brush", "Japanese ink strokes define seven tone openings.", "Strong visual identity with minimal UI and clear root stroke.", "Brush language may be harder to translate into precise hit zones.", [8, 9, 8, 9, 10], "ink", "ink"),
    ("28", "Resonance Ladder", "Seven resonant chambers arranged like a carved acoustic ladder.", "Clear note order, strong beginner mapping, excellent thumb rhythm.", "Less radical than clustered concepts.", [10, 8, 9, 8, 8], "ladder", "wood"),
    ("29", "Crystal Ocarina", "Faceted translucent object with embedded tone holes.", "Memorable and premium; clustered holes feel object-like.", "Facets may visually compete with note targets.", [7, 10, 8, 9, 10], "facets", "crystal"),
    ("30", "Carbon Wind Blade", "A thin carbon-fiber blade with precision touch apertures.", "Modern hardware feeling; good one-handed vertical reach.", "May feel cold and less social.", [8, 8, 9, 8, 8], "blade", "carbon"),
    ("31", "Warm Clay Thumbline", "A hand-formed clay instrument with a thumb-following note path.", "Extremely human and approachable; excellent one-thumb ergonomics.", "Less futuristic and may appear handmade rather than premium.", [9, 8, 10, 8, 8], "thumbline", "clay"),
    ("32", "Lunar Reed", "Moon-crater apertures across a quiet dark surface.", "Root crater is unmistakable; strong nighttime jam identity.", "Space metaphor can drift toward novelty.", [8, 9, 8, 8, 9], "lunar", "moon"),
    ("33", "Instrument Spine Pro", "A refined pro hardware strip with seven pressure wells.", "Feels durable, credible, and scalable into a serious product family.", "Less emotionally warm for first-time non-musicians.", [8, 9, 10, 9, 8], "pro", "pro"),
    ("34", "Breath Halo", "Root note is a large halo; other notes orbit as reachable satellites.", "Root hierarchy is best-in-class and visually teaches tonal center.", "Orbit layout may be less linear for scale understanding.", [8, 10, 8, 9, 10], "halo", "halo"),
    ("35", "Reed Ribbon", "A flexible ribbon-like body with openings along its curve.", "Excellent one-handed thumb path and strong instrument silhouette.", "Curved visual order may require left/right variants.", [8, 9, 9, 9, 9], "ribbon", "teal"),
    ("36", "Tactile Silicone Pipe", "Soft-touch silicone tube with raised note wells.", "Friendly, grippy, and physically believable without feeling childish.", "Material may look less premium if too rubbery.", [9, 8, 10, 8, 8], "silicone", "soft"),
    ("37", "Brutalist Wind Block", "A monolithic block with deeply cut tone voids.", "Strong visual identity and very clear touch zones.", "Could feel severe for a beginner social product.", [8, 9, 8, 8, 9], "brutal", "concrete"),
    ("38", "Harmonic Shell", "Shell-like acoustic chambers arranged around a central root.", "Feels natural and resonant; two thumbs can alternate around the shell.", "May look ornamental without restrained styling.", [8, 9, 8, 9, 9], "shell", "shell"),
    ("39", "Copper Breathline", "A copper pipe with patinated side holes.", "Evokes real acoustic instruments while remaining modern.", "Copper may feel old-world rather than new category.", [9, 8, 9, 8, 8], "pipe", "copper"),
    ("40", "Aurora Wind Glass", "Subtle aurora color shifts inside a glass tone column.", "Premium, memorable, and emotionally expressive.", "Hard to implement beautifully without custom animation.", [8, 10, 8, 10, 10], "aurora", "aurora"),
    ("41", "Koto Breath Board", "A Japanese instrument board with seven carved acoustic islands.", "Elegant, tactile, and calmer than piano-like layouts.", "Horizontal associations may fight phone portrait ergonomics.", [8, 8, 8, 8, 9], "koto", "japan"),
    ("42", "Hollow Reed Cage", "A skeletal cage with floating tone apertures.", "Feels like a physical object, not pixels; root is structurally central.", "Visual complexity can rise quickly.", [7, 9, 8, 9, 10], "cage", "bone"),
    ("43", "Droplet Ocarina", "Water-drop body with root at the widest chamber.", "Intuitive hierarchy; very thumb-friendly lower root.", "Droplet silhouette can become too cute if rounded too much.", [9, 9, 9, 8, 9], "droplet", "water"),
    ("44", "Studio Instrument One", "Apple-like minimal hardware with seven precision depressions.", "Most premium and least intimidating; full-screen but visually calm.", "Less radical and may be less ownable.", [9, 8, 10, 8, 8], "apple", "studio"),
    ("45", "Resin Breath Stone", "Colored resin with suspended tone wells.", "Distinctive object quality; color can encode notes without theory.", "Too much translucency can reduce contrast.", [8, 9, 8, 9, 9], "resin", "resin"),
    ("46", "Finger Lake Flute", "Long lake-like touch zones instead of circular holes.", "Encourages sliding and sustaining; great expressive surface.", "Beginners may wonder where each note begins without subtle boundaries.", [7, 9, 9, 10, 9], "lakes", "blue"),
    ("47", "Twin Reed Grip", "Mirrored left/right note banks with shared root.", "Best for two-handed play and performance speed.", "More complex than seven simple targets; one-handed use is weaker.", [7, 8, 9, 9, 8], "twin", "green"),
    ("48", "Desert Ceramic Pipe", "A sun-fired ceramic pipe with asymmetrical openings.", "Warm, human, acoustic, and distinctive.", "Palette must avoid feeling rustic or lifestyle-brand generic.", [8, 8, 9, 8, 8], "desert", "sand"),
    ("49", "Neural Wind Stem", "A bio-synthetic stem with softly pulsing tone nodes.", "Ownable future-instrument identity; hierarchy is clear through node size.", "Can become too alien for mainstream comfort.", [7, 10, 8, 9, 10], "neural", "bio"),
    ("50", "Root First Totem", "A giant root chamber at the bottom, with six notes rising above it.", "Teaches the root note without theory; excellent for jamming in key.", "Upper notes may be harder to reach one-handed.", [10, 9, 8, 8, 9], "root", "root"),
]

palettes = {
    "obsidian": ((232, 232, 224), (9, 15, 15), (21, 32, 29), (110, 236, 198), (250, 252, 244)),
    "jade": ((231, 237, 230), (14, 39, 36), (42, 102, 91), (151, 228, 190), (247, 255, 248)),
    "ceramic": ((242, 237, 227), (229, 219, 202), (181, 107, 76), (77, 101, 92), (30, 38, 34)),
    "glass": ((231, 239, 238), (14, 28, 31), (118, 184, 196), (220, 255, 246), (248, 255, 250)),
    "bamboo": ((242, 236, 219), (69, 54, 34), (186, 156, 89), (96, 137, 83), (250, 246, 224)),
    "nordic": ((239, 239, 234), (223, 222, 211), (122, 132, 126), (72, 96, 104), (28, 35, 34)),
    "hardware": ((237, 235, 224), (26, 27, 25), (238, 81, 60), (244, 204, 70), (248, 248, 236)),
    "ceramic-dark": ((232, 229, 219), (31, 29, 25), (78, 67, 58), (230, 190, 123), (250, 244, 231)),
    "chrome": ((234, 236, 235), (24, 27, 28), (176, 185, 184), (88, 215, 202), (18, 25, 24)),
    "aqua": ((226, 237, 237), (7, 23, 28), (35, 118, 132), (71, 234, 207), (247, 255, 250)),
    "bronze": ((239, 233, 221), (61, 39, 25), (170, 112, 56), (238, 183, 94), (255, 245, 222)),
    "walnut": ((239, 233, 221), (43, 29, 22), (104, 65, 42), (207, 155, 87), (255, 245, 224)),
    "glass-smoke": ((235, 239, 237), (13, 19, 20), (91, 104, 111), (205, 236, 230), (250, 255, 250)),
    "industrial": ((231, 232, 226), (24, 25, 24), (91, 95, 94), (232, 122, 67), (248, 248, 236)),
    "pearl": ((244, 239, 230), (236, 232, 219), (190, 194, 188), (113, 173, 160), (28, 36, 34)),
    "graphite": ((234, 235, 230), (18, 20, 20), (47, 52, 53), (135, 194, 255), (246, 249, 245)),
    "slate": ((233, 236, 234), (18, 26, 28), (57, 79, 83), (223, 184, 85), (246, 250, 244)),
    "sci-fi": ((230, 235, 234), (6, 15, 20), (24, 59, 69), (104, 234, 255), (245, 255, 255)),
    "leather": ((238, 231, 220), (49, 32, 25), (117, 68, 45), (217, 160, 88), (255, 239, 210)),
    "stone": ((235, 233, 225), (54, 55, 50), (116, 118, 108), (170, 194, 166), (246, 244, 233)),
    "organic": ((236, 234, 224), (21, 37, 31), (66, 111, 86), (224, 147, 99), (251, 246, 232)),
    "brass": ((240, 234, 219), (47, 34, 19), (178, 132, 46), (237, 199, 99), (255, 247, 218)),
    "dark": ((229, 232, 228), (12, 14, 16), (32, 38, 42), (160, 214, 231), (250, 252, 250)),
    "bauhaus": ((240, 236, 224), (24, 27, 26), (232, 63, 48), (235, 190, 49), (250, 246, 226)),
    "paper": ((241, 238, 230), (235, 230, 216), (188, 181, 162), (90, 124, 118), (29, 36, 33)),
    "ink": ((239, 238, 232), (19, 23, 22), (35, 38, 36), (209, 71, 63), (250, 247, 236)),
    "wood": ((240, 233, 219), (59, 38, 24), (151, 92, 49), (229, 172, 82), (255, 242, 218)),
    "crystal": ((231, 238, 239), (12, 24, 28), (104, 163, 186), (221, 247, 255), (248, 255, 255)),
    "carbon": ((230, 232, 229), (14, 16, 16), (43, 46, 47), (98, 201, 185), (245, 247, 241)),
    "clay": ((242, 234, 220), (82, 49, 35), (178, 101, 67), (231, 171, 104), (255, 239, 220)),
    "moon": ((230, 232, 230), (12, 15, 19), (64, 71, 82), (189, 204, 226), (248, 249, 244)),
    "pro": ((233, 235, 232), (18, 19, 19), (54, 57, 57), (190, 225, 206), (246, 248, 243)),
    "halo": ((232, 235, 231), (9, 16, 18), (34, 48, 51), (255, 211, 107), (255, 250, 232)),
    "teal": ((229, 237, 234), (11, 33, 34), (28, 111, 116), (101, 224, 186), (245, 255, 247)),
    "soft": ((238, 236, 229), (31, 42, 39), (104, 130, 119), (238, 154, 112), (250, 244, 233)),
    "concrete": ((234, 233, 227), (35, 35, 32), (112, 113, 105), (229, 113, 82), (248, 245, 235)),
    "shell": ((241, 235, 225), (57, 43, 38), (185, 139, 117), (235, 194, 162), (255, 241, 226)),
    "copper": ((240, 232, 218), (52, 35, 23), (183, 94, 50), (95, 180, 152), (255, 241, 216)),
    "aurora": ((229, 235, 235), (8, 14, 19), (31, 54, 68), (136, 238, 186), (247, 255, 249)),
    "japan": ((241, 237, 228), (31, 25, 22), (167, 42, 42), (217, 190, 139), (250, 245, 232)),
    "bone": ((239, 237, 228), (27, 25, 21), (198, 190, 170), (103, 163, 151), (250, 247, 232)),
    "water": ((228, 237, 237), (8, 28, 35), (50, 143, 158), (111, 225, 216), (247, 255, 250)),
    "studio": ((240, 240, 236), (232, 232, 226), (142, 148, 145), (79, 118, 108), (24, 31, 29)),
    "resin": ((235, 232, 228), (24, 21, 26), (114, 75, 133), (238, 166, 106), (255, 244, 229)),
    "blue": ((230, 235, 238), (10, 24, 35), (37, 93, 131), (111, 200, 236), (248, 255, 255)),
    "green": ((232, 237, 231), (13, 32, 24), (48, 102, 72), (155, 220, 133), (247, 255, 243)),
    "sand": ((242, 233, 218), (79, 49, 34), (191, 119, 70), (235, 183, 114), (255, 240, 216)),
    "bio": ((230, 235, 231), (8, 22, 17), (28, 84, 65), (138, 241, 158), (247, 255, 244)),
    "root": ((234, 235, 229), (11, 18, 18), (38, 56, 54), (238, 177, 74), (255, 247, 225)),
}


def positions(pattern):
    if pattern == "spine":
        return [(450, 410, 98), (450, 585, 70), (450, 725, 70), (450, 865, 70), (450, 1005, 70), (450, 1145, 70), (450, 1285, 70)]
    if pattern == "diagonal":
        return [(350, 390, 105), (430, 555, 72), (515, 710, 72), (430, 865, 72), (350, 1020, 72), (440, 1175, 72), (540, 1330, 72)]
    if pattern in ("cluster", "ocarina", "facets"):
        return [(360, 520, 118), (550, 465, 72), (585, 660, 72), (430, 760, 72), (290, 700, 72), (330, 935, 72), (535, 945, 72)]
    if pattern == "column":
        return [(450, 405, 112), (325, 610, 68), (575, 610, 68), (450, 780, 76), (325, 980, 68), (575, 980, 68), (450, 1190, 74)]
    if pattern == "split":
        return [(450, 430, 108), (330, 610, 72), (570, 610, 72), (330, 800, 72), (570, 800, 72), (330, 990, 72), (570, 990, 72)]
    if pattern == "minimal":
        return [(450, 420, 112), (450, 630, 64), (450, 780, 64), (450, 930, 64), (450, 1080, 64), (450, 1230, 64), (450, 1380, 64)]
    if pattern in ("bar", "valves", "pro", "apple"):
        return [(450, 445, 112), (330, 650, 74), (570, 650, 74), (330, 850, 74), (570, 850, 74), (330, 1050, 74), (570, 1050, 74)]
    if pattern == "seed":
        return [(452, 435, 120), (315, 620, 68), (512, 665, 68), (610, 830, 68), (380, 895, 68), (275, 1070, 68), (525, 1115, 68)]
    if pattern == "rail":
        return [(450, 375, 110), (305, 575, 66), (595, 575, 66), (305, 775, 66), (595, 775, 66), (305, 975, 66), (595, 975, 66)]
    if pattern == "liquid":
        return [(450, 500, 128), (315, 680, 66), (575, 710, 72), (415, 875, 70), (565, 1020, 68), (330, 1135, 70), (480, 1310, 72)]
    if pattern == "handpan":
        return [(450, 480, 132), (305, 710, 82), (595, 710, 82), (450, 850, 76), (315, 1050, 82), (585, 1050, 82), (450, 1215, 76)]
    if pattern == "two-lane":
        return [(450, 405, 110), (330, 595, 72), (570, 595, 72), (330, 785, 72), (570, 785, 72), (330, 975, 72), (570, 975, 72)]
    if pattern == "zen":
        return [(450, 420, 118), (450, 650, 66), (450, 820, 66), (450, 990, 66), (450, 1160, 66), (450, 1330, 66), (450, 1450, 52)]
    if pattern == "wings":
        return [(450, 745, 124), (260, 500, 72), (640, 500, 72), (240, 700, 72), (660, 700, 72), (260, 905, 72), (640, 905, 72)]
    if pattern == "oxygen":
        return [(450, 385, 108), (450, 560, 70), (450, 720, 70), (450, 880, 70), (450, 1040, 70), (450, 1200, 70), (450, 1360, 70)]
    if pattern == "petals":
        return [(450, 760, 128), (450, 495, 74), (625, 625, 74), (600, 900, 74), (450, 1035, 74), (300, 900, 74), (275, 625, 74)]
    if pattern == "key":
        return [(450, 430, 130), (450, 665, 70), (450, 820, 70), (450, 975, 70), (450, 1130, 70), (450, 1285, 70), (450, 1420, 58)]
    if pattern == "totem":
        return [(450, 430, 118), (450, 630, 78), (450, 800, 78), (450, 970, 78), (450, 1140, 78), (450, 1310, 78), (450, 1450, 56)]
    if pattern == "bauhaus":
        return [(320, 430, 112), (580, 430, 74), (320, 670, 74), (580, 670, 74), (320, 910, 74), (580, 910, 74), (450, 1160, 84)]
    if pattern == "fold":
        return [(405, 430, 108), (520, 595, 70), (380, 745, 70), (540, 895, 70), (365, 1045, 70), (520, 1195, 70), (390, 1345, 70)]
    if pattern == "ink":
        return [(365, 400, 110), (500, 575, 68), (395, 740, 68), (540, 905, 68), (380, 1070, 68), (500, 1220, 68), (420, 1380, 62)]
    if pattern == "ladder":
        return [(450, 350, 110), (335, 560, 72), (565, 560, 72), (335, 765, 72), (565, 765, 72), (335, 970, 72), (565, 970, 72)]
    if pattern == "blade":
        return [(450, 410, 112), (385, 610, 70), (515, 750, 70), (385, 890, 70), (515, 1030, 70), (385, 1170, 70), (515, 1310, 70)]
    if pattern == "thumbline":
        return [(315, 500, 120), (410, 655, 72), (515, 800, 72), (600, 960, 72), (520, 1120, 72), (405, 1265, 72), (300, 1390, 62)]
    if pattern == "halo":
        return [(450, 730, 150), (450, 430, 72), (640, 585, 72), (610, 880, 72), (450, 1050, 72), (290, 880, 72), (260, 585, 72)]
    if pattern == "ribbon":
        return [(360, 430, 112), (500, 600, 70), (560, 780, 70), (500, 960, 70), (360, 1130, 70), (300, 1300, 70), (420, 1420, 60)]
    if pattern == "brutal":
        return [(450, 430, 116), (300, 630, 72), (600, 630, 72), (450, 820, 72), (300, 1010, 72), (600, 1010, 72), (450, 1200, 72)]
    if pattern == "shell":
        return [(450, 680, 130), (320, 460, 72), (575, 510, 72), (650, 760, 72), (520, 980, 72), (305, 930, 72), (250, 675, 72)]
    if pattern == "aurora":
        return [(450, 400, 112), (330, 610, 72), (570, 670, 72), (330, 840, 72), (570, 900, 72), (330, 1070, 72), (570, 1130, 72)]
    if pattern == "cage":
        return [(450, 460, 120), (300, 660, 70), (600, 660, 70), (330, 860, 70), (570, 860, 70), (300, 1060, 70), (600, 1060, 70)]
    if pattern == "droplet":
        return [(450, 1180, 138), (330, 955, 72), (570, 955, 72), (310, 750, 72), (590, 750, 72), (360, 545, 72), (540, 545, 72)]
    if pattern == "lakes":
        return [(450, 420, 118), (310, 620, 66), (590, 650, 66), (330, 850, 66), (570, 890, 66), (350, 1090, 66), (550, 1170, 66)]
    if pattern == "twin":
        return [(450, 430, 120), (275, 650, 70), (625, 650, 70), (275, 850, 70), (625, 850, 70), (275, 1050, 70), (625, 1050, 70)]
    if pattern == "neural":
        return [(450, 460, 116), (355, 650, 70), (535, 720, 70), (325, 890, 70), (575, 980, 70), (380, 1160, 70), (540, 1320, 70)]
    if pattern == "root":
        return [(450, 1240, 158), (450, 430, 70), (450, 580, 70), (450, 730, 70), (450, 880, 70), (450, 1030, 70), (450, 1125, 54)]
    return positions("spine")


def draw_body(img, draw, pattern, pal):
    bg, screen, body, accent, text = pal
    if pattern in ("spine", "minimal", "zen", "oxygen", "totem", "root"):
        rounded(draw, (272, 260, 628, 1465), 178, body)
        rounded(draw, (318, 300, 582, 1425), 132, tuple(min(255, v + 26) for v in body[:3]) + (130,))
    elif pattern in ("diagonal", "ribbon", "thumbline", "ink"):
        pts = [(350, 260), (595, 470), (520, 1410), (300, 1455), (235, 520)]
        draw.polygon(pts, fill=body)
        draw.line(pts + [pts[0]], fill=accent + (120,), width=5)
    elif pattern in ("cluster", "ocarina", "facets"):
        draw.ellipse((170, 270, 745, 1135), fill=body)
        draw.ellipse((250, 370, 665, 1035), fill=tuple(min(255, v + 24) for v in body[:3]) + (90,))
    elif pattern == "column":
        rounded(draw, (220, 250, 680, 1390), 230, body + (150,))
        draw.line((450, 320, 450, 1320), fill=accent + (120,), width=10)
    elif pattern in ("split", "two-lane", "bar", "valves", "pro", "apple", "ladder"):
        rounded(draw, (190, 300, 710, 1325), 54, body)
        draw.line((450, 360, 450, 1260), fill=(255, 255, 255, 55), width=4)
    elif pattern == "rail":
        rounded(draw, (235, 285, 665, 1370), 74, body)
        rounded(draw, (395, 315, 505, 1335), 50, accent + (80,))
    elif pattern in ("liquid", "aurora"):
        rounded(draw, (180, 260, 720, 1420), 240, body + (185,))
        for i in range(8):
            y = 330 + i * 130
            draw.arc((180, y, 720, y + 190), 0, 180, fill=accent + (70,), width=5)
    elif pattern == "handpan":
        draw.ellipse((145, 300, 755, 1340), fill=body)
        draw.ellipse((230, 430, 670, 1190), outline=accent + (90,), width=8)
    elif pattern == "wings":
        rounded(draw, (160, 310, 370, 1210), 90, body)
        rounded(draw, (530, 310, 740, 1210), 90, body)
        rounded(draw, (350, 555, 550, 930), 100, accent + (90,))
    elif pattern == "petals":
        draw.ellipse((210, 315, 690, 1210), fill=body)
        for a in range(0, 360, 60):
            cx = 450 + math.cos(math.radians(a)) * 145
            cy = 760 + math.sin(math.radians(a)) * 230
            draw.ellipse((cx - 95, cy - 125, cx + 95, cy + 125), fill=accent + (45,))
    elif pattern == "key":
        rounded(draw, (380, 480, 520, 1450), 70, body)
        draw.ellipse((250, 260, 650, 660), fill=body)
    elif pattern == "bauhaus":
        rounded(draw, (185, 280, 715, 1260), 32, body)
        draw.rectangle((185, 770, 715, 1010), fill=accent + (120,))
    elif pattern == "fold":
        draw.polygon([(235, 260), (660, 360), (610, 1440), (260, 1320)], fill=body)
        draw.line((445, 310, 420, 1370), fill=(255, 255, 255, 80), width=8)
    elif pattern == "blade":
        draw.polygon([(410, 240), (610, 420), (535, 1440), (300, 1320)], fill=body)
    elif pattern == "brutal":
        rounded(draw, (205, 300, 695, 1280), 28, body)
        for y in range(390, 1190, 210):
            draw.line((245, y, 655, y), fill=(255, 255, 255, 38), width=3)
    elif pattern == "shell":
        draw.ellipse((170, 290, 730, 1220), fill=body)
        for i in range(6):
            draw.arc((190+i*24, 350+i*30, 710-i*24, 1220-i*70), 205, 340, fill=accent + (70,), width=5)
    elif pattern == "cage":
        rounded(draw, (190, 280, 710, 1270), 90, body + (70,), outline=body, width=9)
        for x in [280, 450, 620]:
            draw.line((x, 320, x, 1230), fill=body + (150,), width=6)
    elif pattern == "droplet":
        pts = [(450, 275), (660, 735), (650, 1140), (450, 1430), (250, 1140), (240, 735)]
        draw.polygon(pts, fill=body)
        draw.ellipse((240, 610, 660, 1430), fill=body)
    elif pattern == "lakes":
        rounded(draw, (190, 280, 710, 1370), 140, body)
    elif pattern == "twin":
        rounded(draw, (155, 340, 380, 1250), 112, body)
        rounded(draw, (520, 340, 745, 1250), 112, body)
        draw.ellipse((330, 270, 570, 510), fill=accent + (80,))
    else:
        rounded(draw, (210, 280, 690, 1320), 80, body)


def render_concept(item):
    num, name, rationale, ergo, weak, scores, pattern, pal_key = item
    pal = palettes[pal_key]
    bg, screen, body, accent, text = pal
    img = phone_base(bg, screen)
    draw = ImageDraw.Draw(img, "RGBA")
    add_status(draw, dark=sum(screen[:3]) < 390)
    draw_body(img, draw, pattern, pal)
    draw = ImageDraw.Draw(img, "RGBA")

    pos = positions(pattern)
    notes = ["C", "D", "E", "F", "G", "A", "B"]
    for idx, (x, y, r) in enumerate(pos):
        root = idx == 0
        fill = (8, 18, 17) if sum(body[:3]) > 330 else tuple(min(255, v + 45) for v in body[:3])
        ring = accent + (230 if root else 180,)
        tfill = text
        if pattern in ("lakes",):
            box = (x - r - 65, y - r, x + r + 65, y + r)
            img = ellipse_shadow(img, box, (0, 0, 0, 40), 15, (0, 16))
            draw = ImageDraw.Draw(img, "RGBA")
            draw_capsule(draw, box, accent + (150 if root else 100,), (255, 255, 255, 100), 4)
            center_text(draw, box, notes[idx], B[36] if root else B[24], text)
        else:
            img = draw_hole(draw, img, x, y, r, notes[idx], fill + (245,), ring, tfill, root)
            draw = ImageDraw.Draw(img, "RGBA")

    draw.text((126, 1465), name, font=B[36], fill=text if sum(screen[:3]) < 390 else (23, 31, 28))
    draw.text((126, 1515), "Root note larger. Seven notes only.", font=F[26], fill=text if sum(screen[:3]) < 390 else (82, 94, 89))
    img.convert("RGB").save(OUT / f"wind-{num}-{name.lower().replace(' ', '-')}.png", quality=95)


for concept in concepts:
    render_concept(concept)


ranked = sorted(concepts, key=lambda c: (sum(c[5]), c[5][0] + c[5][2]), reverse=True)
top10 = ranked[:10]

html_cards = []
for num, name, rationale, ergo, weak, scores, pattern, pal_key in concepts:
    filename = f"mockups/wind-exploration/wind-{num}-{name.lower().replace(' ', '-')}.png"
    total = sum(scores)
    labels = ["Beginner", "Memorable", "Ergonomics", "Expressive", "Unique"]
    score_html = "".join(f"<li><span>{label}</span><strong>{score}/10</strong></li>" for label, score in zip(labels, scores))
    html_cards.append(f"""
      <article class="concept-card">
        <img src="{filename}" alt="{html.escape(name)} mobile instrument mockup" />
        <div class="concept-copy">
          <p class="kicker">Concept {num}</p>
          <h2>{html.escape(name)}</h2>
          <p>{html.escape(rationale)}</p>
          <h3>Ergonomic strengths</h3>
          <p>{html.escape(ergo)}</p>
          <h3>Weaknesses</h3>
          <p>{html.escape(weak)}</p>
          <ul class="scores">{score_html}<li><span>Total</span><strong>{total}/50</strong></li></ul>
        </div>
      </article>
    """)

rank_html = "".join(
    f"<li><strong>{i}. {html.escape(c[1])}</strong><span>{sum(c[5])}/50</span><p>{html.escape(c[2])}</p></li>"
    for i, c in enumerate(top10, 1)
)

page = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Digital Wind Instrument Deep Exploration</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <main>
      <header class="hero">
        <p>Digital Wind Instrument deep exploration</p>
        <h1>50 directions for a new playable instrument category</h1>
        <span>Full-screen play area. Seven scale notes. Root note hierarchy. No menus, piano, DAW, or game language.</span>
      </header>

      <section class="principles">
        <div><strong>Design lens</strong><span>Think physical object first, screen second.</span></div>
        <div><strong>Playable surface</strong><span>Almost the entire phone becomes the instrument body.</span></div>
        <div><strong>Beginner promise</strong><span>No wrong notes, no theory, root note always visually important.</span></div>
        <div><strong>Product character</strong><span>Premium, modern, tactile, and worth returning to for years.</span></div>
      </section>

      <section class="recommendations">
        <div>
          <h2>Top 10 ranked concepts</h2>
          <ol>{rank_html}</ol>
        </div>
        <div>
          <h2>Strongest MVP direction</h2>
          <p><strong>Resonance Ladder</strong> is the most practical MVP base. It preserves the instrument metaphor, keeps the scale order obvious, makes the root note unmistakable, and gives both thumbs a natural rhythm without adding explanation.</p>
          <h2>Strongest long-term product direction</h2>
          <p><strong>Breath Halo</strong> is the most ownable long-term direction. It teaches tonal center visually, looks unlike a conventional app, and can grow into gestures, session presence, reactive light, pressure, and expressive sound behavior.</p>
        </div>
      </section>

      <section class="grid">
        {''.join(html_cards)}
      </section>
    </main>
  </body>
</html>
"""

(ROOT / "index.html").write_text(page, encoding="utf-8")

css = """
:root {
  --ink: #151d1a;
  --muted: #5f6c66;
  --paper: #f3f0e8;
  --card: #fffdf8;
  --line: rgba(21, 29, 26, 0.13);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  color: var(--ink);
  background: var(--paper);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

main {
  width: min(1880px, calc(100% - 32px));
  margin: 0 auto;
  padding: 38px 0 64px;
}

.hero {
  display: grid;
  gap: 12px;
  margin-bottom: 24px;
}

.hero p,
.kicker {
  margin: 0;
  color: #26766f;
  font-size: 0.78rem;
  font-weight: 850;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero h1 {
  max-width: 1180px;
  margin: 0;
  font-size: clamp(2.4rem, 5.8vw, 5.4rem);
  line-height: 0.96;
  letter-spacing: 0;
}

.hero span {
  max-width: 860px;
  color: var(--muted);
  font-size: 1.04rem;
  font-weight: 700;
  line-height: 1.45;
}

.principles,
.recommendations {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.principles div,
.recommendations > div,
.concept-card {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--card);
  box-shadow: 0 16px 44px rgba(28, 35, 32, 0.07);
}

.principles div {
  padding: 18px;
}

.principles strong,
.principles span {
  display: block;
}

.principles strong {
  margin-bottom: 6px;
}

.principles span,
p {
  color: var(--muted);
  line-height: 1.55;
}

.recommendations {
  grid-template-columns: minmax(320px, 1.2fr) minmax(320px, 0.8fr);
}

.recommendations > div {
  padding: 22px;
}

.recommendations h2 {
  margin: 0 0 10px;
  font-size: 1.3rem;
}

ol {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

ol li {
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #f8f4eb;
}

ol strong,
ol span {
  display: block;
}

ol span {
  margin-top: 3px;
  color: #25766f;
  font-weight: 850;
}

ol p {
  margin: 8px 0 0;
  font-size: 0.88rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(260px, 1fr));
  gap: 16px;
  align-items: start;
}

.concept-card {
  overflow: hidden;
}

img {
  display: block;
  width: 100%;
  height: auto;
  background: #e9e3d8;
}

.concept-copy {
  padding: 18px;
}

h2,
h3,
p {
  margin-top: 0;
}

.concept-copy h2 {
  margin: 7px 0 10px;
  font-size: 1.36rem;
  line-height: 1.08;
  letter-spacing: 0;
}

h3 {
  margin: 18px 0 6px;
  font-size: 0.74rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.concept-copy p {
  margin-bottom: 0;
  font-size: 0.93rem;
}

.scores {
  display: grid;
  gap: 6px;
  margin: 18px 0 0;
  padding: 0;
  list-style: none;
}

.scores li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 0;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 0.9rem;
}

.scores strong {
  color: var(--ink);
}

@media (max-width: 1500px) {
  .grid { grid-template-columns: repeat(4, minmax(250px, 1fr)); }
}

@media (max-width: 1180px) {
  .principles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .recommendations { grid-template-columns: 1fr; }
  .grid { grid-template-columns: repeat(3, minmax(240px, 1fr)); }
}

@media (max-width: 820px) {
  main { width: min(100% - 18px, 1880px); padding-top: 24px; }
  .principles,
  .grid,
  ol { grid-template-columns: 1fr; }
}
"""

(ROOT / "styles.css").write_text(css, encoding="utf-8")

print(f"Created {len(concepts)} mockups in {OUT}")
