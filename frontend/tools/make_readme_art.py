"""README art for GreenTrace, drawn with Pillow from the product's own design tokens.

    .venv/bin/python -m tools.make_readme_art            write every image to assets/readme/
    .venv/bin/python -m tools.make_readme_art --check    report what would change, write nothing
    .venv/bin/python -m tools.make_readme_art --palette  print the light palette as JSON

Setup once: python3 -m venv .venv && .venv/bin/pip install pillow

Why it is built this way (each rule exists because the alternative was measured and broke):
- The accent is read from `--primary` in src/app/globals.css, never re-typed, so a brand change
  moves the figures with it. Every other light colour is a fixed palette shared across projects.
- Text in the accent uses `readable_accent()`, which searches outward in value until the colour
  clears 4.5:1 on every surface it can land on. The raw green is decorative only.
- `audit()` runs before anything is written and exits 1 if any text/surface pair misses AA.
- Translucent washes are pre-composited with `blend()`, because ImageDraw overwrites alpha.
- Everything is drawn at SCALE 2 and reduced with LANCZOS, at 960 nominal width (the README column),
  with even canvas heights so x and y scale by the same factor.
- `flow()` is the single layout pass that both `measure()` and drawing use; two copies of the cursor
  arithmetic once drifted 16px apart. Gutters widen to the widest arrow label. Wrapping is measured.
- SF Pro and SF Mono are variable fonts; a missing font exits 2 rather than letting Pillow
  substitute one and invalidate every measurement.
"""
from __future__ import annotations

import colorsys
import io
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT.parent / "assets" / "readme"  # README figures live at the repo root
TOKENS = ROOT / "src" / "app" / "globals.css"
MARK = ROOT / "public" / "logo.png"
FONTS = {
    "regular": ("/System/Library/Fonts/SFNS.ttf", b"Regular"),
    "semibold": ("/System/Library/Fonts/SFNS.ttf", b"Semibold"),
    "bold": ("/System/Library/Fonts/SFNS.ttf", b"Bold"),
    "mono": ("/System/Library/Fonts/SFNSMono.ttf", b"Regular"),
}

SCALE = 2
FIGURE_WIDTH = 960
PAD = 30
PANEL_PAD = 15
ITEM_GAP = 10
PANEL_GAP = 14
MIN_GUTTER = 26
BULLET_COLUMN = 13
HERO_HEIGHT = 232


def px(value: float) -> int:
    return int(round(value * SCALE))


# ---------------------------------------------------------------- colour


def parse_hex(colour: str) -> tuple[int, int, int]:
    text = colour.strip().lstrip("#")
    if len(text) != 6:
        raise ValueError(f"expected #RRGGBB, got {colour!r}")
    return tuple(int(text[i:i + 2], 16) for i in (0, 2, 4))


def to_hex(rgb) -> str:
    return "#%02X%02X%02X" % tuple(max(0, min(255, round(c))) for c in rgb)


def relative_luminance(colour: str) -> float:
    def channel(value: int) -> float:
        c = value / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (channel(v) for v in parse_hex(colour))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(foreground: str, background: str) -> float:
    a, b = relative_luminance(foreground), relative_luminance(background)
    lighter, darker = max(a, b), min(a, b)
    return (lighter + 0.05) / (darker + 0.05)


def meets_aa(foreground: str, background: str) -> bool:
    return contrast_ratio(foreground, background) >= 4.5


def blend(top: str, bottom: str, alpha: float) -> str:
    """`top` at `alpha` over `bottom`, as an opaque hex colour."""
    t, b = parse_hex(top), parse_hex(bottom)
    return to_hex(t[i] * alpha + b[i] * (1 - alpha) for i in range(3))


def readable_accent(accent: str, *surfaces: str) -> str:
    """Nearest colour to `accent` (same hue and saturation) that clears AA on EVERY surface."""
    hue, saturation, value = colorsys.rgb_to_hsv(*[c / 255 for c in parse_hex(accent)])

    def at(v: float) -> str:
        return to_hex(c * 255 for c in colorsys.hsv_to_rgb(hue, saturation, v))

    def passes(colour: str) -> bool:
        return all(meets_aa(colour, surface) for surface in surfaces)

    if passes(accent):
        return accent
    for step in range(1, 46):
        for direction in (-1, 1):
            v = value + direction * step * 0.02
            if 0.0 <= v <= 1.0 and passes(at(v)):
                return at(v)
    return accent


def css_token(block: str, name: str) -> str:
    """An `H S% L%` custom property from globals.css, as #RRGGBB."""
    css = TOKENS.read_text()
    selector = r":root\s*\{" if block == "root" else r"\.dark\s*\{"
    body = re.search(selector + r"(.*?)\}", css, re.S)
    if not body:
        raise SystemExit(f"ERROR: no {block} block in {TOKENS}")
    match = re.search(rf"--{name}:\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%", body.group(1))
    if not match:
        raise SystemExit(f"ERROR: --{name} is missing from the {block} block of {TOKENS}")
    h, s, l = (float(v) for v in match.groups())
    return to_hex(c * 255 for c in colorsys.hls_to_rgb(h / 360, l / 100, s / 100))


ACCENT = css_token("root", "primary")


@dataclass(frozen=True)
class Palette:
    name: str
    page: str
    surface: str
    border: str
    border_strong: str
    text: str
    text_secondary: str
    text_muted: str
    accent: str
    accent_text: str
    band: str
    rule: str


LIGHT_SURFACE = "#FAFAFB"
LIGHT_BAND = blend(ACCENT, LIGHT_SURFACE, 0.10)
LIGHT = Palette(
    name="light",
    page="#FFFFFF",
    surface=LIGHT_SURFACE,
    border="#DFDFE4",
    border_strong="#B9B9C2",
    text="#131316",
    text_secondary="#43434E",
    text_muted="#5F5F6B",
    accent=ACCENT,
    accent_text=readable_accent(ACCENT, LIGHT_SURFACE, LIGHT_BAND, "#FFFFFF"),
    band=LIGHT_BAND,
    rule="#E4E4E9",
)

# The dark palette (hero only) comes from the app's own .dark tokens.
DARK_PAGE = css_token("dark", "background")
DARK_TEXT = css_token("dark", "foreground")
DARK_SURFACE = blend(DARK_TEXT, DARK_PAGE, 0.045)
DARK_BAND = blend(ACCENT, DARK_SURFACE, 0.14)
DARK = Palette(
    name="dark",
    page=DARK_PAGE,
    surface=DARK_SURFACE,
    border=css_token("dark", "border"),
    border_strong=blend(DARK_TEXT, DARK_PAGE, 0.22),
    text=DARK_TEXT,
    text_secondary=blend(DARK_TEXT, DARK_PAGE, 0.80),
    text_muted=css_token("dark", "muted-foreground"),
    accent=ACCENT,
    accent_text=readable_accent(ACCENT, DARK_SURFACE, DARK_BAND, DARK_PAGE),
    band=DARK_BAND,
    rule=css_token("dark", "border"),
)


def audit(palette: Palette) -> list[str]:
    """Every text role against every surface it can land on. AA or it is a defect."""
    problems = []
    for surface_name, surface in (("card", palette.surface), ("band", palette.band), ("page", palette.page)):
        for role in ("text", "text_secondary", "text_muted", "accent_text"):
            colour = getattr(palette, role)
            ratio = contrast_ratio(colour, surface)
            mark = "ok  " if ratio >= 4.5 else "FAIL"
            line = f"  {mark}  {palette.name:5} {role:15} {colour} on the {surface_name:4} {surface}  {ratio:5.2f}:1"
            print(line)
            if ratio < 4.5:
                problems.append(line.strip())
    return problems


# ---------------------------------------------------------------- type


_font_cache: dict[tuple[str, int], ImageFont.FreeTypeFont] = {}


def font(kind: str, size: float) -> ImageFont.FreeTypeFont:
    key = (kind, int(size * SCALE))
    if key not in _font_cache:
        path, variation = FONTS[kind]
        f = ImageFont.truetype(path, key[1])
        f.set_variation_by_name(variation)
        _font_cache[key] = f
    return _font_cache[key]


def line_height(f: ImageFont.FreeTypeFont) -> int:
    ascent, descent = f.getmetrics()
    return int((ascent + descent) * 1.32)


def ink_middle(f: ImageFont.FreeTypeFont) -> int:
    """Vertical centre of a capital, measured from the text origin."""
    box = f.getbbox("H")
    return (box[1] + box[3]) // 2


def wrap(text: str, f, max_width: int, draw: ImageDraw.ImageDraw) -> list[str]:
    """Wrap on real measured widths. A token wider than the line breaks after `/`, `.` or `_`,
    and its pieces rejoin without a space, so an identifier never gains one."""
    if not text:
        return []
    tokens: list[tuple[str, str]] = []          # (glue before, piece)
    for word in text.split():
        if draw.textlength(word, font=f) <= max_width:
            tokens.append((" ", word))
            continue
        for n, piece in enumerate(p for p in re.split(r"(?<=[/._])", word) if p):
            tokens.append((" " if n == 0 else "", piece))
    lines, current = [], tokens[0][1]
    for glue, piece in tokens[1:]:
        candidate = current + glue + piece
        if draw.textlength(candidate, font=f) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = piece
    lines.append(current)
    return lines


_probe = ImageDraw.Draw(Image.new("RGB", (8, 8)))


# ---------------------------------------------------------------- mark


def load_mark() -> Image.Image:
    """The logo cropped to its visible artwork and padded to a square."""
    source = Image.open(MARK).convert("RGBA")
    art = source.crop(source.getchannel("A").getbbox())
    side = max(art.size)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(art, ((side - art.width) // 2, (side - art.height) // 2))
    return square


# ---------------------------------------------------------------- column figures


@dataclass
class Item:
    label: str
    note: str = ""
    mono: bool = False
    accent: bool = False


@dataclass
class Panel:
    title: str
    items: list[Item]
    subtitle: str = ""
    emphasis: bool = False
    x: int = 0
    y: int = 0
    width: int = 0
    height: int = 0


@dataclass
class ColumnFigure:
    filename: str
    title: str
    subtitle: str
    columns: list[list[Panel]]
    arrows: list[tuple[str, str, str]] = field(default_factory=list)
    alt: str = ""

    f_title = property(lambda self: font("semibold", 12))
    f_sub = property(lambda self: font("regular", 9))
    f_label = property(lambda self: font("semibold", 10))
    f_mono = property(lambda self: font("mono", 9))
    f_note = property(lambda self: font("regular", 9))
    f_arrow = property(lambda self: font("regular", 8))

    def header_left(self) -> int:
        return px(PAD) + px(30) + px(12)

    def subtitle_width(self) -> int:
        return px(FIGURE_WIDTH) - px(PAD) - self.header_left()

    def header_height(self) -> int:
        lines = max(1, len(wrap(self.subtitle, self.f_sub, self.subtitle_width(), _probe)))
        return px(PAD) + line_height(font("bold", 18)) + lines * line_height(self.f_sub) + px(20)

    def measure_gutter(self) -> int:
        needed = px(MIN_GUTTER)
        for _, _, label in self.arrows:
            if label:
                needed = max(needed, int(_probe.textlength(label, font=self.f_arrow)) + px(26))
        return needed

    def flow(self, panel: Panel, width: int) -> list[tuple[int, int, ImageFont.FreeTypeFont, str, str, bool]]:
        """Every line as (dx, dy, font, text, role, bullet), relative to the panel's padding."""
        inner = width - 2 * px(PANEL_PAD)
        lines, y = [], 0
        for text in wrap(panel.title, self.f_title, inner, _probe):
            lines.append((0, y, self.f_title, text, "title", False))
            y += line_height(self.f_title)
        for text in wrap(panel.subtitle, self.f_sub, inner, _probe):
            lines.append((0, y, self.f_sub, text, "subtitle", False))
            y += line_height(self.f_sub)
        y += px(9)
        indent = px(BULLET_COLUMN)
        for index, item in enumerate(panel.items):
            if index:
                y += px(ITEM_GAP)
            f = self.f_mono if item.mono else self.f_label
            role = "label-accent" if item.accent else "label"
            for n, text in enumerate(wrap(item.label, f, inner - indent, _probe)):
                lines.append((indent, y, f, text, role, n == 0))
                y += line_height(f)
            if item.note:
                y += px(1)
                for text in wrap(item.note, self.f_note, inner - indent, _probe):
                    lines.append((indent, y, self.f_note, text, "note", False))
                    y += line_height(self.f_note)
        return lines

    def measure(self, panel: Panel, width: int) -> int:
        _, last_y, last_font, *_ = self.flow(panel, width)[-1]
        return px(PANEL_PAD) + last_y + line_height(last_font) + px(PANEL_PAD)

    def layout(self) -> int:
        gutter = self.measure_gutter()
        count = len(self.columns)
        width = (px(FIGURE_WIDTH) - 2 * px(PAD) - gutter * (count - 1)) // count
        top = self.header_height()
        tallest = 0
        for c, column in enumerate(self.columns):
            y = top
            for panel in column:
                panel.x = px(PAD) + c * (width + gutter)
                panel.y = y
                panel.width = width
                panel.height = self.measure(panel, width)
                y += panel.height + px(PANEL_GAP)
            tallest = max(tallest, y - px(PANEL_GAP))
        height = tallest + px(PAD)
        return height + (height % SCALE)

    def render(self, palette: Palette, mark: Image.Image) -> Image.Image:
        height = self.layout()
        image = Image.new("RGB", (px(FIGURE_WIDTH), height), palette.page)
        draw = ImageDraw.Draw(image)
        draw_header(image, draw, palette, mark, self.title, self.subtitle, self.f_sub,
                    self.header_left(), self.subtitle_width(), self.header_height())
        colours = {
            "title": None,
            "subtitle": palette.text_muted,
            "label": palette.text,
            "label-accent": palette.accent_text,
            "note": palette.text_secondary,
        }
        for column in self.columns:
            for panel in column:
                draw.rounded_rectangle(
                    (panel.x, panel.y, panel.x + panel.width, panel.y + panel.height),
                    radius=px(12), fill=palette.surface,
                    outline=palette.accent if panel.emphasis else palette.border,
                    width=SCALE * (2 if panel.emphasis else 1),
                )
                ox, oy = panel.x + px(PANEL_PAD), panel.y + px(PANEL_PAD)
                for dx, dy, f, text, role, bullet in self.flow(panel, panel.width):
                    fill = colours[role] or (palette.accent_text if panel.emphasis else palette.text)
                    if bullet:
                        mid = oy + dy + ink_middle(f)
                        draw.ellipse([ox + px(2), mid - px(2), ox + px(6), mid + px(2)], fill=palette.accent)
                    draw.text((ox + dx, oy + dy), text, font=f, fill=fill)
        self.draw_arrows(draw, palette)
        return image.resize((FIGURE_WIDTH, height // SCALE), Image.LANCZOS)

    def draw_arrows(self, draw: ImageDraw.ImageDraw, palette: Palette) -> None:
        lookup = {panel.title: panel for column in self.columns for panel in column}
        f = self.f_arrow
        for source, target, label in self.arrows:
            a, b = lookup[source], lookup[target]
            top, bottom = max(a.y, b.y), min(a.y + a.height, b.y + b.height)
            if top >= bottom:
                raise SystemExit(f"ERROR: '{source}' and '{target}' do not overlap vertically; no straight arrow fits")
            y = a.y + a.height // 2 if top <= a.y + a.height // 2 <= bottom else (top + bottom) // 2
            x1, x2 = a.x + a.width, b.x
            draw.line([(x1 + px(4), y), (x2 - px(7), y)], fill=palette.border_strong, width=SCALE)
            draw.polygon([(x2 - px(7), y - px(4)), (x2 - px(1), y), (x2 - px(7), y + px(4))], fill=palette.border_strong)
            if label:
                width = int(draw.textlength(label, font=f))
                draw.text(((x1 + x2) // 2 - width // 2, y - line_height(f) - px(2)), label, font=f, fill=palette.text_muted)


def draw_header(image, draw, palette, mark, title, subtitle, f_sub, left, sub_width, header_height) -> None:
    size = px(30)
    image.paste(mark.resize((size, size), Image.LANCZOS), (px(PAD), px(PAD)), mark.resize((size, size), Image.LANCZOS))
    f_title = font("bold", 18)
    draw.text((left, px(PAD) - px(2)), title, font=f_title, fill=palette.text)
    y = px(PAD) + line_height(f_title)
    for text in wrap(subtitle, f_sub, sub_width, _probe):
        draw.text((left, y), text, font=f_sub, fill=palette.text_muted)
        y += line_height(f_sub)
    rule = header_height - px(11)
    draw.line([(px(PAD), rule), (px(FIGURE_WIDTH) - px(PAD), rule)], fill=palette.rule, width=SCALE)


# ---------------------------------------------------------------- tree


@dataclass
class Row:
    depth: int
    name: str
    note: str = ""
    band: bool = False


@dataclass
class TreeFigure:
    filename: str
    title: str
    subtitle: str
    rows: list[Row]
    alt: str = ""

    INDENT = 16
    STUB = 8
    NAME_GAP = 20
    ROW_GAP = 6

    f_name = property(lambda self: font("mono", 9))
    f_note = property(lambda self: font("regular", 9))
    f_sub = property(lambda self: font("regular", 9))

    header_left = ColumnFigure.header_left
    subtitle_width = ColumnFigure.subtitle_width

    def header_height(self) -> int:
        lines = max(1, len(wrap(self.subtitle, self.f_sub, self.subtitle_width(), _probe)))
        return px(PAD) + line_height(font("bold", 18)) + lines * line_height(self.f_sub) + px(20)

    def name_column(self) -> int:
        return max(px(self.INDENT) * row.depth + int(_probe.textlength(row.name, font=self.f_name))
                   for row in self.rows) + px(self.NAME_GAP)

    def flow(self) -> tuple[list[tuple[int, int, list[str]]], int]:
        """(top, height, note lines) per row, relative to the card's padding, and the total height."""
        note_width = px(FIGURE_WIDTH) - 2 * px(PAD) - 2 * px(PANEL_PAD) - self.name_column()
        out, y = [], 0
        for index, row in enumerate(self.rows):
            if index:
                y += px(self.ROW_GAP)
            notes = wrap(row.note, self.f_note, note_width, _probe)
            height = max(line_height(self.f_name), len(notes) * line_height(self.f_note))
            out.append((y, height, notes))
            y += height
        return out, y

    def continues(self, index: int, depth: int) -> bool:
        """Whether a later row at `depth` shares the ancestor of row `index` at that depth."""
        for row in self.rows[index + 1:]:
            if row.depth < depth:
                return False
            if row.depth == depth:
                return True
        return False

    def render(self, palette: Palette, mark: Image.Image) -> Image.Image:
        rows, body = self.flow()
        top = self.header_height()
        card = (px(PAD), top, px(FIGURE_WIDTH) - px(PAD), top + body + 2 * px(PANEL_PAD))
        height = card[3] + px(PAD)
        height += height % SCALE
        image = Image.new("RGB", (px(FIGURE_WIDTH), height), palette.page)
        draw = ImageDraw.Draw(image)
        draw_header(image, draw, palette, mark, self.title, self.subtitle, self.f_sub,
                    self.header_left(), self.subtitle_width(), top)
        draw.rounded_rectangle(card, radius=px(12), fill=palette.surface, outline=palette.border, width=SCALE)
        ox, oy = card[0] + px(PANEL_PAD), card[1] + px(PANEL_PAD)

        # Bands first, so connectors and glyphs land on top of them.
        index = 0
        while index < len(self.rows):
            if not self.rows[index].band:
                index += 1
                continue
            start = index
            while index < len(self.rows) and self.rows[index].band:
                index += 1
            first, last = rows[start], rows[index - 1]
            draw.rounded_rectangle(
                (card[0] + px(6), oy + first[0] - px(3), card[2] - px(6), oy + last[0] + last[1] + px(1)),
                radius=px(6), fill=palette.band)

        mid = ink_middle(self.f_name)
        name_col = self.name_column()
        for index, row in enumerate(self.rows):
            y, h, notes = rows[index]
            row_top, row_bottom = oy + y, oy + y + h + px(self.ROW_GAP)
            for level in range(1, row.depth + 1):
                gx = ox + px(self.INDENT) * (level - 1) + px(4)
                if level < row.depth:
                    if self.continues(index, level):
                        draw.line([(gx, row_top - px(self.ROW_GAP)), (gx, row_bottom)], fill=palette.border_strong, width=SCALE)
                    continue
                start = row_top - px(self.ROW_GAP)
                if index and self.rows[index - 1].depth == row.depth - 1:
                    start = oy + rows[index - 1][0] + line_height(self.f_name) - px(3)
                end = row_bottom if self.continues(index, level) else row_top + mid
                draw.line([(gx, start), (gx, end)], fill=palette.border_strong, width=SCALE)
                draw.line([(gx, row_top + mid), (gx + px(self.STUB), row_top + mid)], fill=palette.border_strong, width=SCALE)
            fill = palette.accent_text if row.name.endswith("/") else palette.text
            draw.text((ox + px(self.INDENT) * row.depth, row_top), row.name, font=self.f_name, fill=fill)
            ny = row_top
            for text in notes:
                draw.text((ox + name_col, ny), text, font=self.f_note, fill=palette.text_secondary)
                ny += line_height(self.f_note)
        return image.resize((FIGURE_WIDTH, height // SCALE), Image.LANCZOS)


# ---------------------------------------------------------------- hero


def render_hero(palette: Palette, mark: Image.Image, tagline: str) -> Image.Image:
    width, height = px(FIGURE_WIDTH), px(HERO_HEIGHT)
    inset = px(2)
    card = (inset, inset, width - inset - 1, height - inset - 1)

    gradient = Image.new("RGB", (width, height))
    fill = ImageDraw.Draw(gradient)
    top, bottom = parse_hex(palette.surface), parse_hex(palette.page)
    for row in range(height):
        t = row / max(1, height - 1)
        fill.line([(0, row), (width, row)], fill=tuple(int(top[c] + (bottom[c] - top[c]) * t) for c in range(3)))
    mask = Image.new("L", (width, height), 0)
    ImageDraw.Draw(mask).rounded_rectangle(card, radius=px(22), fill=255)
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    image.paste(gradient, (0, 0), mask)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(card, radius=px(22), outline=palette.border_strong, width=SCALE)

    mark_size = px(108)
    logo = mark.resize((mark_size, mark_size), Image.LANCZOS)
    art = logo.getchannel("A").getbbox()
    art_left, art_top = art[0], art[1]
    art_width, art_height = art[2] - art[0], art[3] - art[1]

    f_word, f_tag = font("bold", 60), font("regular", 14)
    green, trace = "Green", "Trace"
    green_w = draw.textlength(green, font=f_word)
    word_box = draw.textbbox((0, 0), green + trace, font=f_word)
    tag_box = draw.textbbox((0, 0), tagline, font=f_tag)
    gap, tag_gap, rule_gap, rule_h = px(20), px(18), px(20), px(3)

    block_height = art_height + tag_gap + (tag_box[3] - tag_box[1]) + rule_gap + rule_h
    art_y = inset + (height - inset * 2 - block_height) // 2
    block_width = art_width + gap + (word_box[2] - word_box[0])
    art_x = (width - block_width) // 2

    image.alpha_composite(logo, (art_x - art_left, art_y - art_top))
    word_x = art_x + art_width + gap - word_box[0]
    word_y = art_y + art_height // 2 - (word_box[1] + word_box[3]) // 2
    draw.text((word_x, word_y), green, font=f_word, fill=palette.text)
    draw.text((word_x + green_w, word_y), trace, font=f_word, fill=palette.accent_text)

    tag_y = art_y + art_height + tag_gap - tag_box[1]
    draw.text(((width - (tag_box[2] - tag_box[0])) // 2 - tag_box[0], tag_y), tagline, font=f_tag, fill=palette.text_muted)
    rule_y = art_y + art_height + tag_gap + (tag_box[3] - tag_box[1]) + rule_gap
    draw.rounded_rectangle(((width - px(46)) // 2, rule_y, (width + px(46)) // 2, rule_y + rule_h), radius=px(2), fill=palette.accent)
    return image.resize((FIGURE_WIDTH, HERO_HEIGHT), Image.LANCZOS)


# ---------------------------------------------------------------- content

TAGLINE = "Carbon accounting you can verify, not just trust."

PIPELINE = ColumnFigure(
    filename="pipeline.png",
    title="From a utility bill to a retired tonne",
    subtitle="Every step is either computed by code or checked by code, and leaves a record on the Hedera audit topic "
             "that anyone can recheck.",
    alt="From a bill to a retired tonne: AI reads bills into an inventory, rules and an AI auditor gate certification "
        "on Hedera, then credits are rated, bought through a contract and retired by wiping the tokens",
    columns=[
        [Panel("Measure", subtitle="About a minute per bill", items=[
            Item("Drop in bills", "PDFs or phone photos of electricity, gas and fuel bills; identical files are never read twice"),
            Item("AI reads each bill", "Quantity, unit, billing period, the exact evidence text and a confidence score"),
            Item("gpt-5.4-mini", "Matched gpt-5.5 on 17 of 17 lines in the bill-reading test", mono=True),
            Item("A person reviews every value", "Edits are marked and stay visible to the auditor"),
            Item("Emissions computed by code", "Quantity × catalog factor, never a number from the model"),
        ])],
        [Panel("Audit, then certify", subtitle="Nothing high risk reaches the chain", emphasis=True, items=[
            Item("9 rule checks always run", "Duplicate bills, overlapping periods, outliers, unreviewed low-confidence values, scope coverage", accent=True),
            Item("AI auditor", "Can add findings; cannot remove a rule finding or set the risk score"),
            Item("High risk blocks minting", "The planted duplicate in testing scored 100 and was blocked", accent=True),
            Item("sha256(canonical JSON)", "Inventory hash, IPFS CID and NFT serial written to the topic", mono=True),
            Item("Certificate NFT", "Public page re-checks 5 of 5: hash, topic, NFT, metadata, audit"),
        ])],
        [Panel("Offset and retire", subtitle="Credits a tonne can only use once", items=[
            Item("AI rates every project", "Five quality dimensions; the grade is computed by code"),
            Item("AI builds a basket", "Within stock and the buyer's HBAR budget"),
            Item("purchase(orderRef)", "Pays the treasury once per order; a second payment reverts", mono=True),
            Item("requestRetirement()", "Tokens wiped from the holder and from total supply", mono=True),
        ]),
         Panel("What it will not do", items=[
             Item("Use a number the model wrote", "Emissions, tonnes, grades and baskets come from tested code"),
             Item("Deliver before the payment is seen", "The mirror node must show the contract event first"),
         ])],
    ],
    arrows=[("Measure", "Audit, then certify", "inventory"), ("Audit, then certify", "Offset and retire", "certificate")],
)

AI_LAYER = ColumnFigure(
    filename="ai-guardrails.png",
    title="Where the model stops and code takes over",
    subtitle="Six AI features, each one schema-checked call. The numbers that matter are computed in code, and every "
             "result is hashed with its model and prompt version and logged on Hedera.",
    alt="Where the model stops and code takes over: six AI features propose structured JSON, deterministic code "
        "validates and computes every number, and each result is hashed and recorded on the Hedera audit topic",
    columns=[
        [Panel("The model proposes", subtitle="OpenAI or Claude, structured output", items=[
            Item("Bill reading", "Values, units, periods and evidence quotes; the source is picked from a fixed enum"),
            Item("Audit review", "Plausibility, misclassification and weak evidence"),
            Item("Credit rating", "Five dimension scores with reasons"),
            Item("Offset advisor", "Listings and tonnes for a basket"),
            Item("Reduction planner", "Measures and the share of a source each one removes"),
            Item("GRI drafter", "Disclosure text; unknown facts become [DATA NEEDED]"),
        ])],
        [Panel("Code decides", subtitle="Deterministic and unit tested", emphasis=True, items=[
            Item("zod schema, strict mode", "Output that fails validation is rejected, never patched by guessing", mono=True),
            Item("lib/emissions/catalog.ts", "Fuel factors, official grid factors for 14 regions, unit conversion within one dimension", mono=True),
            Item("lib/audit/rules.ts", "9 rules; the risk score is computed from every finding", mono=True),
            Item("lib/ai-math.ts", "Weighted grades, tonnes per measure, baskets within stock and budget", mono=True),
            Item("Per-user hourly limits", "On every AI feature, so cost cannot be abused", accent=True),
        ])],
        [Panel("Hedera records", subtitle="Audit topic 0.0.11116480", items=[
            Item("AI_EXTRACTION", "One message per bill reading", mono=True),
            Item("AI_AUDIT", "Findings, risk score and the rules that ran", mono=True),
            Item("AI_CREDIT_RATING", "Six listings rated in testing", mono=True),
            Item("AI_REDUCTION_PLAN", mono=True),
            Item("AI_GRI_DRAFT", mono=True),
            Item("Each message", "sha256 of the output, the model and the prompt version, so a disputed result can be proved"),
        ])],
    ],
    arrows=[("The model proposes", "Code decides", "JSON"), ("Code decides", "Hedera records", "hash")],
)

INTEGRITY = ColumnFigure(
    filename="double-counting.png",
    title="Three places a tonne cannot be counted twice",
    subtitle="Double counting is blocked when a bill comes in, when a credit is sold and when it is retired. Each guard "
             "is enforced by the database or the ledger, not by the interface.",
    alt="Three places a tonne cannot be counted twice: bill fingerprints before certification, one payment per order "
        "in the exchange contract, and token wipes on retirement",
    columns=[
        [Panel("When a bill comes in", items=[
            Item("Bill fingerprint", "Supplier, account or invoice number and billing period"),
            Item("Same file twice", "SHA-256 of the bytes; the earlier reading is reused"),
            Item("Same bill, different file", "A phone photo of a certified PDF is flagged and held back", accent=True),
            Item("emission_data_id unique", "One inventory backs one certificate", mono=True),
        ])],
        [Panel("When a credit is sold", emphasis=True, items=[
            Item("paidOrders[orderRef]", "The contract reverts OrderAlreadyPaid on a second payment", mono=True),
            Item("Mirror node check", "Contract, event, order, payer and amount verified before any token moves"),
            Item("payment_tx_hash unique", "One transaction settles one order", mono=True),
            Item("reserve_credits()", "Stock reserved atomically in Postgres", mono=True),
            Item("One delivery", "Only the caller that moves the order out of awaiting_payment delivers", accent=True),
        ])],
        [Panel("When a credit is retired", items=[
            Item("requestRetirement()", "Signed by the certificate owner's linked wallet", mono=True),
            Item("Token wipe", "Removed from the holder and from supply: 100,000 to 99,972 in testing", accent=True),
            Item("request_tx_hash unique", "A replayed event is recognised and skipped", mono=True),
            Item("Certificate status", "Partially offset, then offset; anchored as CREDITS_RETIRED"),
        ])],
    ],
    arrows=[("When a bill comes in", "When a credit is sold", "certificate"), ("When a credit is sold", "When a credit is retired", "credits")],
)

REPOSITORY = ColumnFigure(
    filename="repository.png",
    title="What lives where",
    subtitle="One Next.js repository holds the app, the server, the contract and the schema; Supabase pg_cron runs the exchange scan.",
    alt="Repository components: the web app, the server-only modules that hold the treasury key and the AI services, "
        "and the ledger and data layer with the contract, the schema and the scheduled scan",
    columns=[
        [Panel("Web app", subtitle="src/app, src/components, src/hooks", items=[
            Item("app/upload", "Drop zone, AI reading review, duplicate warnings", mono=True),
            Item("app/certificates/[id]", "Public verification, five checks re-run on load", mono=True),
            Item("app/marketplace", "AI ratings, offset advisor, buy and retire", mono=True),
            Item("app/reduce, app/sema", "Reduction plans, materiality and GRI drafts", mono=True),
            Item("lib/wallet.ts", "MetaMask on chain 296; gas limits 90k purchase, 45k retire", mono=True),
        ])],
        [Panel("Server", subtitle="src/server, imports server-only", emphasis=True, items=[
            Item("hedera.ts", "The only module that reads the treasury key: anchor, mint, deliver, wipe", mono=True, accent=True),
            Item("ai/provider.ts", "OpenAI or Claude; separate extraction and reasoning models", mono=True),
            Item("ai/extract.ts ... gri.ts", "Six features, one structured call each", mono=True),
            Item("services/orders.ts", "Server-fixed price, mirror-verified payment, idempotent delivery", mono=True),
            Item("services/certificates.ts", "Hash, IPFS pin, NFT, topic record, verification", mono=True),
        ])],
        [Panel("Ledger and data", subtitle="contracts, supabase, scheduled scan", items=[
            Item("GreenTraceExchange.sol", "purchase and requestRetirement; 6 Hardhat tests", mono=True),
            Item("scripts/setup-hedera.ts", "Creates the topic, the CO2e token with a wipe key, the NFT collection and the contract", mono=True),
            Item("supabase/migrations", "20 tables, row level security on all of them", mono=True, accent=True),
            Item("supabase/tests/rls.test.sql", "Cross-user reads and forged certificates rejected", mono=True),
            Item("supabase/schedule-scan.sql", "pg_cron calls /api/internal/scan every minute; finishes payments if the tab closed", mono=True),
        ])],
    ],
    arrows=[("Web app", "Server", "bearer token"), ("Server", "Ledger and data", "treasury key")],
)

TREE = TreeFigure(
    filename="tree.png",
    title="The files that matter",
    subtitle="Server-only code is separated from the browser by the build; the AI layer is banded.",
    alt="Annotated file tree of the GreenTrace repository, with the AI services under src/server/ai highlighted",
    rows=[
        Row(0, "frontend/", "Next.js 14 app, server, contract and schema"),
        Row(1, "src/app/", "Pages and thin API routes: authenticate, validate with zod, call src/server"),
        Row(2, "certificates/[id]/", "Public verification page anyone can open"),
        Row(2, "api/internal/scan/", "Scheduled scan: completes payments the browser never reported"),
        Row(1, "src/server/", "Imports server-only, so a browser import fails the build"),
        Row(2, "hedera.ts", "Treasury key: anchor to the topic, mint NFTs, deliver and wipe credits"),
        Row(2, "mirror.ts", "Reads payments and events back from the mirror node"),
        Row(2, "ai/", "One structured-output call per feature, each anchored on Hedera", band=True),
        Row(3, "provider.ts", "OpenAI or Claude; gpt-5.4-mini for bills, gpt-5.5 for judgement", band=True),
        Row(3, "extract.ts", "Bill reading, fingerprints and duplicate twins", band=True),
        Row(3, "audit.ts", "AI review layered on the nine rules", band=True),
        Row(3, "rating.ts", "Five-dimension credit quality scores", band=True),
        Row(3, "advisor.ts", "Offset basket within stock and budget", band=True),
        Row(3, "reduction.ts", "Measures; tonnes computed from the inventory", band=True),
        Row(3, "gri.ts", "GRI disclosures with [DATA NEEDED] gaps", band=True),
        Row(3, "rate-limit.ts", "Per user, per feature, per hour", band=True),
        Row(2, "services/", "Inventories, certificates, orders, retirements; idempotent"),
        Row(1, "src/lib/", "Shared, unit-tested arithmetic"),
        Row(2, "emissions/catalog.ts", "Emission factors and unit conversion"),
        Row(2, "audit/rules.ts", "The nine deterministic audit checks"),
        Row(2, "ai-math.ts", "Grades, tonnes per measure, basket limits"),
        Row(1, "src/data/gridFactors.ts", "Official national grid factors with publisher, year and gas basis"),
        Row(1, "contracts/", "GreenTraceExchange.sol and its tests"),
        Row(1, "supabase/", "Migrations with row level security, and Postgres tests"),
        Row(1, "scripts/", "setup-hedera, seed, db-migrate, submission PDF"),
        Row(0, "backend-listener/", "Optional self-hosted listener, for completion within seconds"),
        Row(0, "docs/", "IEEE ClimateChain deliverables"),
        Row(0, "assets/", "README figures and rendered diagrams"),
    ],
)

FIGURES = [PIPELINE, AI_LAYER, INTEGRITY, REPOSITORY, TREE]


# ---------------------------------------------------------------- main


def png_bytes(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def same_pixels(path: Path, image: Image.Image) -> bool:
    if not path.is_file():
        return False
    existing = Image.open(path)
    return existing.size == image.size and existing.mode == image.mode and existing.tobytes() == image.tobytes()


def main(argv: list[str]) -> int:
    if "--palette" in argv:
        # The system diagrams (scripts/render-diagrams.mjs) take their colours from here, so the
        # two kinds of figure cannot drift apart.
        import json
        print(json.dumps({"light": LIGHT.__dict__, "fonts": {k: v[0] for k, v in FONTS.items()}}))
        return 0
    check = "--check" in argv
    if not MARK.is_file():
        print(f"ERROR: {MARK} is missing.")
        return 2
    for kind, (path, _) in FONTS.items():
        if not Path(path).is_file():
            print(f"ERROR: the {kind} font is missing at {path}.")
            return 2
    print(f"accent {ACCENT} (from --primary in {TOKENS.relative_to(ROOT)}), "
          f"text accent light {LIGHT.accent_text}, dark {DARK.accent_text}")
    problems = audit(DARK) + audit(LIGHT)
    if problems:
        print("\nContrast below AA, nothing written:")
        for line in problems:
            print("  " + line)
        return 1

    mark = load_mark()
    images = {
        "hero-light.png": render_hero(LIGHT, mark, TAGLINE),
        "hero-dark.png": render_hero(DARK, mark, TAGLINE),
    }
    for figure in FIGURES:
        images[figure.filename] = figure.render(LIGHT, mark)
    # The square-cropped mark, for the system diagrams and the submission PDF.
    images["mark.png"] = mark.resize((256, 256), Image.LANCZOS)

    OUT.mkdir(parents=True, exist_ok=True)
    changed = 0
    for name, image in images.items():
        path = OUT / name
        if same_pixels(path, image):
            print(f"  unchanged  {name}  {image.width}x{image.height}")
            continue
        changed += 1
        if check:
            print(f"  would write  {name}  {image.width}x{image.height}")
        else:
            path.write_bytes(png_bytes(image))
            print(f"  wrote  {name}  {image.width}x{image.height}")
    print(f"{changed} of {len(images)} images {'would change' if check else 'written'}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
