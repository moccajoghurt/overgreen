"""
Download representative plant images from Wikimedia Commons and compose
them into a single labeled reference sheet organized by archetype.
"""

import os
import re
import requests
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO
import json
import time

# ── Plant data ──────────────────────────────────────────────────────────
ARCHETYPES = {
    "GRASSES": [
        ("1.1", "Turfgrass",       "Poa pratensis"),        # Kentucky bluegrass
        ("1.2", "Tallgrass",       "Andropogon gerardii"),  # Big bluestem
        ("1.3", "Bunch grass",     "Festuca idahoensis"),   # Idaho fescue
        ("1.4", "Bamboo",          "Phyllostachys edulis"), # Moso bamboo
        ("1.5", "Spreading grass",  "Cynodon dactylon"),     # Bermuda grass
        ("1.6", "Sedge/Rush",      "Cyperus papyrus"),      # Papyrus
    ],
    "TREES": [
        ("2.1", "Broadleaf deciduous", "Quercus robur"),       # English oak
        ("2.2", "Broadleaf evergreen", "Magnolia grandiflora"), # Southern magnolia
        ("2.3", "Conifer",             "Pinus sylvestris"),     # Scots pine
        ("2.4", "Tropical hardwood",   "Swietenia mahagoni"),   # Mahogany
        ("2.5", "Palm",                "Cocos nucifera"),       # Coconut palm
        ("2.6", "Pioneer/fast-growth", "Betula pendula"),       # Silver birch
    ],
    "SHRUBS": [
        ("3.1", "Evergreen shrub",  "Buxus sempervirens"),    # Boxwood
        ("3.2", "Deciduous shrub",  "Sambucus nigra"),        # Elderberry
        ("3.3", "Mediterranean",    "Rosmarinus officinalis"), # Rosemary
        ("3.4", "Thorny/Armed",     "Ulex europaeus"),        # Gorse
        ("3.5", "Desert shrub",     "Larrea tridentata"),     # Creosote bush
        ("3.6", "Mangrove",         "Rhizophora mangle"),     # Red mangrove
    ],
    "SUCCULENTS": [
        ("4.1", "Stem succulent (Cactus)", "Carnegiea gigantea"),  # Saguaro
        ("4.2", "Leaf succulent",          "Aloe vera"),           # Aloe
        ("4.3", "Caudiciform",             "Adenium obesum"),      # Desert rose
        ("4.4", "Euphorbia",               "Euphorbia ingens"),    # Candelabra tree
        ("4.5", "Ice plant/Mesemb",        "Lithops"),             # Living stones
        ("4.6", "Epiphytic succulent",     "Schlumbergera"),       # Christmas cactus
    ],
    "FORBS": [
        ("5.1", "Broadleaf wildflower",  "Taraxacum officinale"),   # Dandelion
        ("5.2", "Tall herb",             "Solidago canadensis"),    # Goldenrod
        ("5.3", "Fern",                  "Dryopteris filix-mas"),   # Male fern
        ("5.4", "Vine/Climber",          "Hedera helix"),           # English ivy
        ("5.5", "Ground cover",          "Trifolium repens"),       # White clover
        ("5.6", "Aquatic herb",          "Nymphaea alba"),          # White water lily
    ],
}

CACHE_DIR = os.path.join(os.path.dirname(__file__), ".plant_img_cache")
os.makedirs(CACHE_DIR, exist_ok=True)

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "OvergreenPlantRefSheet/1.0 (https://github.com; educational use)"
})

# Hardcoded Wikimedia Commons file titles — verified whole-plant images for
# entries where automated search consistently returns fruit/seed closeups.
EXACT_FILES: dict[str, str] = {
    "1.1": "File:Poa pratensis lawn.jpg",               # Turfgrass lawn
    "2.1": "File:Solitary Quercus robur.jpg",            # Whole oak tree silhouette
    "2.2": "File:Starr-070618-7344-Magnolia grandiflora-habit-Kula-Maui (24261533914).jpg",
    "2.3": "File:Skuleskogen_pine.jpg",                  # Scots pine in landscape
    "2.4": "File:Tree_in_new_leaves_I_IMG_6222.jpg",     # Mahogany whole tree
    "3.2": "File:Starr-090623-1368-Sambucus nigra-habit-Nahiku-Maui (40610102884).jpg",
    "3.3": "File:Rosmarinus officinalis in Vieussan.jpg",  # Rosemary bush in Mediterranean
    "3.5": "File:Larrea tridentata, Red Hills Desert Garden, St. George, UT, USA.jpg",
    "4.3": "File:Starr 070906-8774 Adenium obesum.jpg",  # Desert rose whole plant
    "1.6": "File:Cyperus papyrus.jpg",
    "4.4": "File:Euphorbia ingens, parque nacional de Tarangire, Tanzania, 2024-05-25, DD 85.jpg",
    "4.5": "File:Lithops, living stones, at Nuthurst, West Sussex, England 1.jpg",
    "4.6": "File:Christmas Cactus October 2022.jpg",
    "5.1": "File:Paardenbloem Taraxacum officinale.JPG",             # Dandelion whole rosette with flowers
    "5.3": "File:Dryopteris filix-mas 0001.JPG",                     # Male fern whole plant photo
    "5.5": "File:White clover (Trifolium repens) 001.jpg",             # White clover ground cover patch
    "5.6": "File:Nymphaea alba 1.JPG",                               # Water lily with pads in pond
}

# Override search queries to get whole-plant silhouettes instead of fruit/seed closeups.
# Each entry is a list of search attempts tried in order.
SEARCH_OVERRIDES: dict[str, list[str]] = {
    "1.1": ["Poa pratensis grass lawn", "Kentucky bluegrass turf"],
    "1.5": ["Cynodon dactylon grass lawn", "bermuda grass spreading"],
    "2.1": ["Quercus robur tree", "oak tree standing whole"],
    "2.2": ["Magnolia grandiflora tree whole", "southern magnolia tree"],
    "2.3": ["Pinus sylvestris tree forest standing", "Scots pine tree"],
    "3.3": ["Arctostaphylos manzanita shrub", "manzanita bush whole plant"],
    "3.4": ["Ulex europaeus bush gorse", "gorse shrub thorny"],
    "5.1": ["Taraxacum officinale plant flower", "dandelion whole plant"],
    "5.4": ["Hedera helix climbing wall", "english ivy plant"],
    "5.5": ["Trifolium repens clover field", "white clover ground cover"],
    "5.6": ["Nymphaea alba water lily pond", "white water lily flower"],
}

# Words in filenames that indicate fruit/seed/closeup — skip these
REJECT_WORDS = {
    "acorn", "seed", "fruit", "nut", "cone", "bonsai", "bark", "leaf ",
    "pollen", "stamen", "pistil", "cross section", "closeup", "close-up",
    "microscop", "herbar", "dried", "pressed",
}

# ── Wikimedia Commons helpers ───────────────────────────────────────────

def _is_good_filename(title: str) -> bool:
    """Return False if the filename suggests a closeup/fruit/seed rather than whole plant."""
    lower = title.lower()
    if not any(lower.endswith(ext) for ext in (".jpg", ".jpeg", ".png")):
        return False
    for bad in REJECT_WORDS:
        if bad in lower:
            return False
    return True


def _search_once(query: str, limit: int = 20) -> str | None:
    """Single Wikimedia Commons search, returning first good File: title."""
    url = "https://commons.wikimedia.org/w/api.php"
    params = {
        "action": "query",
        "list": "search",
        "srnamespace": "6",
        "srsearch": query,
        "srinfo": "",
        "srprop": "",
        "srlimit": str(limit),
        "format": "json",
    }
    resp = SESSION.get(url, params=params, timeout=15)
    data = resp.json()
    results = data.get("query", {}).get("search", [])
    for r in results:
        if _is_good_filename(r["title"]):
            return r["title"]
    return None


def _get_wikipedia_image(species: str) -> str | None:
    """Get the main image from the Wikipedia article for a species (usually whole-plant)."""
    url = "https://en.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "titles": species,
        "prop": "pageimages",
        "piprop": "original",
        "format": "json",
    }
    try:
        resp = SESSION.get(url, params=params, timeout=15)
        data = resp.json()
        pages = data.get("query", {}).get("pages", {})
        for page in pages.values():
            orig = page.get("original", {})
            src = orig.get("source")
            if src:
                # Extract the Commons file title from the URL
                fname = src.split("/")[-1]
                return f"File:{fname}"
    except Exception as e:
        print(f"    Wikipedia fallback failed: {e}")
    return None


def search_commons_image(query: str, idx: str = "") -> str | None:
    """Search Wikimedia Commons for a whole-plant image. Uses overrides when available."""

    # 1) Try hardcoded exact file titles first
    if idx in EXACT_FILES:
        return EXACT_FILES[idx]

    # 2) Try explicit search overrides
    if idx in SEARCH_OVERRIDES:
        for q in SEARCH_OVERRIDES[idx]:
            result = _search_once(q)
            if result:
                return result

    # 3) Try Wikipedia article main image (usually a good whole-plant photo)
    wp_result = _get_wikipedia_image(query)
    if wp_result and _is_good_filename(wp_result):
        return wp_result

    # 4) Standard search: species + "plant", then species + "tree"/"bush", then plain
    for suffix in ["plant", "tree", "bush", "habit", ""]:
        sq = f"{query} {suffix}".strip()
        result = _search_once(sq)
        if result:
            return result

    return None


def get_image_url(file_title: str, width: int = 400) -> str | None:
    """Get a thumbnail URL for a Wikimedia Commons file."""
    url = "https://commons.wikimedia.org/w/api.php"
    params = {
        "action": "query",
        "titles": file_title,
        "prop": "imageinfo",
        "iiprop": "url",
        "iiurlwidth": str(width),
        "format": "json",
    }
    resp = SESSION.get(url, params=params, timeout=15)
    data = resp.json()
    pages = data.get("query", {}).get("pages", {})
    for page in pages.values():
        ii = page.get("imageinfo", [{}])[0]
        return ii.get("thumburl") or ii.get("url")
    return None


def download_image(species: str, label: str, idx: str) -> Image.Image | None:
    """Download and cache an image for a species."""
    safe_name = re.sub(r'[^a-zA-Z0-9]', '_', f"{idx}_{species}")
    cache_path = os.path.join(CACHE_DIR, f"{safe_name}.jpg")

    if os.path.exists(cache_path):
        print(f"  [cache] {idx} {label}")
        return Image.open(cache_path).convert("RGB")

    print(f"  [fetch] {idx} {label} ({species})...")

    file_title = search_commons_image(species, idx)
    if not file_title:
        print(f"    !! No image found for {species}")
        return None

    img_url = get_image_url(file_title, width=400)
    if not img_url:
        print(f"    !! No URL for {file_title}")
        return None

    resp = SESSION.get(img_url, timeout=20)
    if resp.status_code != 200:
        print(f"    !! HTTP {resp.status_code}")
        return None

    img = Image.open(BytesIO(resp.content)).convert("RGB")
    img.save(cache_path, "JPEG", quality=90)
    time.sleep(0.3)  # Be nice to Wikimedia
    return img


# ── Composition ─────────────────────────────────────────────────────────

THUMB_W = 280
THUMB_H = 280
PADDING = 16
LABEL_H = 60    # Space for text below each image
HEADER_H = 70   # Space for archetype header row
COLS = 6        # Subtypes per archetype
ROWS = 5        # Archetypes

# Colors
BG_COLOR = (245, 243, 238)
HEADER_COLORS = {
    "GRASSES":    (76, 135, 56),
    "TREES":      (101, 67, 33),
    "SHRUBS":     (140, 120, 60),
    "SUCCULENTS": (85, 140, 100),
    "FORBS":      (180, 90, 140),
}
TEXT_COLOR = (30, 30, 30)
SUBTEXT_COLOR = (90, 90, 90)
BORDER_COLOR = (200, 195, 185)


def get_font(size: int, bold: bool = False):
    """Try to load a nice font, fall back to default."""
    font_candidates = [
        "C:/Windows/Fonts/segoeui.ttf" if not bold else "C:/Windows/Fonts/segoeuib.ttf",
        "C:/Windows/Fonts/arial.ttf" if not bold else "C:/Windows/Fonts/arialbd.ttf",
    ]
    for f in font_candidates:
        if os.path.exists(f):
            try:
                return ImageFont.truetype(f, size)
            except:
                pass
    return ImageFont.load_default()


def fit_image(img: Image.Image, w: int, h: int) -> Image.Image:
    """Resize image to fit within w×h, centered on white background."""
    img.thumbnail((w, h), Image.Resampling.LANCZOS)
    result = Image.new("RGB", (w, h), (255, 255, 255))
    x = (w - img.width) // 2
    y = (h - img.height) // 2
    result.paste(img, (x, y))
    return result


def make_placeholder(w: int, h: int, text: str) -> Image.Image:
    """Create a placeholder image when download fails."""
    img = Image.new("RGB", (w, h), (230, 225, 220))
    draw = ImageDraw.Draw(img)
    font = get_font(14)
    draw.text((w // 2, h // 2), text, fill=(150, 140, 130), font=font, anchor="mm")
    return img


def compose_sheet():
    cell_w = THUMB_W + PADDING * 2
    cell_h = THUMB_H + LABEL_H + PADDING * 2
    total_w = PADDING + COLS * cell_w + PADDING
    total_h = PADDING  # top margin

    for _ in ARCHETYPES:
        total_h += HEADER_H + COLS // COLS * cell_h  # 1 row per archetype

    total_h += PADDING  # bottom margin
    # Title
    title_h = 80
    total_h += title_h

    sheet = Image.new("RGB", (total_w, total_h), BG_COLOR)
    draw = ImageDraw.Draw(sheet)

    # Fonts
    title_font = get_font(32, bold=True)
    header_font = get_font(24, bold=True)
    idx_font = get_font(18, bold=True)
    label_font = get_font(14, bold=True)
    species_font = get_font(12)

    # Title
    draw.text(
        (total_w // 2, PADDING + title_h // 2),
        "OVERGREEN — Plant Archetype Reference Sheet",
        fill=TEXT_COLOR, font=title_font, anchor="mm"
    )

    y_offset = PADDING + title_h

    for arch_name, subtypes in ARCHETYPES.items():
        color = HEADER_COLORS[arch_name]

        # Archetype header bar
        draw.rounded_rectangle(
            [PADDING, y_offset, total_w - PADDING, y_offset + HEADER_H - 8],
            radius=8, fill=color
        )
        arch_num = list(ARCHETYPES.keys()).index(arch_name) + 1
        draw.text(
            (PADDING + 20, y_offset + (HEADER_H - 8) // 2),
            f"{arch_num}. {arch_name}",
            fill=(255, 255, 255), font=header_font, anchor="lm"
        )
        y_offset += HEADER_H

        # Subtype cells
        for col, (idx, label, species) in enumerate(subtypes):
            x = PADDING + col * cell_w

            # Download/load image
            img = download_image(species, label, idx)
            if img:
                thumb = fit_image(img, THUMB_W, THUMB_H)
            else:
                thumb = make_placeholder(THUMB_W, THUMB_H, species)

            # Draw cell background + border
            cx = x + PADDING
            cy = y_offset + PADDING
            draw.rounded_rectangle(
                [cx - 2, cy - 2, cx + THUMB_W + 2, cy + THUMB_H + 2],
                radius=6, outline=BORDER_COLOR, width=2
            )

            sheet.paste(thumb, (cx, cy))

            # Index badge
            badge_w = 40
            badge_h = 24
            draw.rounded_rectangle(
                [cx, cy, cx + badge_w, cy + badge_h],
                radius=4, fill=color
            )
            draw.text(
                (cx + badge_w // 2, cy + badge_h // 2),
                idx, fill=(255, 255, 255), font=idx_font, anchor="mm"
            )

            # Labels below image
            text_y = cy + THUMB_H + 6
            draw.text((cx + THUMB_W // 2, text_y), label,
                      fill=TEXT_COLOR, font=label_font, anchor="mt")
            draw.text((cx + THUMB_W // 2, text_y + 18), species,
                      fill=SUBTEXT_COLOR, font=species_font, anchor="mt")

        y_offset += cell_h

    output_path = os.path.join(os.path.dirname(__file__), "..", "plant_reference_sheet.png")
    output_path = os.path.abspath(output_path)
    sheet.save(output_path, "PNG", optimize=True)
    print(f"\nSaved: {output_path}")
    print(f"Size: {sheet.width}×{sheet.height}px")
    return output_path


if __name__ == "__main__":
    compose_sheet()
