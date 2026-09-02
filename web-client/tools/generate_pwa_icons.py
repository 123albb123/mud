from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


OUTPUT_DIR = Path(__file__).resolve().parent.parent / "public" / "icons"
FONT_CANDIDATES = (
    Path("C:/Windows/Fonts/msyh.ttc"),
    Path("C:/Windows/Fonts/simhei.ttf"),
    Path("C:/Windows/Fonts/simsun.ttc"),
)


def get_font(size: int) -> ImageFont.FreeTypeFont:
    for candidate in FONT_CANDIDATES:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def draw_icon(size: int, filename: str, maskable: bool = False) -> None:
    image = Image.new("RGBA", (size, size), (8, 10, 11, 255))
    draw = ImageDraw.Draw(image)
    margin = round(size * (0.045 if maskable else 0.075))
    radius = round(size * (0.22 if maskable else 0.2))
    draw.rounded_rectangle(
        (margin, margin, size - margin, size - margin),
        radius=radius,
        fill=(17, 22, 23, 255),
        outline=(183, 131, 69, 255),
        width=max(3, round(size * 0.024)),
    )

    center = size // 2
    ring_radius = round(size * 0.34)
    draw.ellipse(
        (center - ring_radius, center - ring_radius, center + ring_radius, center + ring_radius),
        outline=(108, 167, 160, 120),
        width=max(1, round(size * 0.008)),
    )

    flame = [
        (center, round(size * 0.17)),
        (round(size * 0.59), round(size * 0.38)),
        (round(size * 0.76), round(size * 0.46)),
        (round(size * 0.58), round(size * 0.55)),
        (round(size * 0.53), round(size * 0.77)),
        (round(size * 0.45), round(size * 0.59)),
        (round(size * 0.22), round(size * 0.49)),
        (round(size * 0.4), round(size * 0.42)),
    ]
    draw.polygon(flame, fill=(227, 182, 108, 255))
    draw.line(
        [(round(size * 0.29), round(size * 0.73)), (center, round(size * 0.59)), (round(size * 0.71), round(size * 0.73))],
        fill=(242, 211, 154, 255),
        width=max(2, round(size * 0.025)),
        joint="curve",
    )

    font = get_font(round(size * 0.25))
    draw.text(
        (center, round(size * 0.68)),
        "炎",
        font=font,
        anchor="mm",
        fill=(17, 22, 23, 255),
        stroke_width=max(1, round(size * 0.006)),
        stroke_fill=(242, 211, 154, 255),
    )
    image.save(OUTPUT_DIR / filename, format="PNG", optimize=True)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    draw_icon(192, "icon-192.png")
    draw_icon(512, "icon-512.png")
    draw_icon(512, "icon-maskable-512.png", maskable=True)
    draw_icon(180, "apple-touch-icon.png")


if __name__ == "__main__":
    main()
