from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
FRAME_DIR = ROOT / "public" / "pet" / "frames" / "cutout"
SOURCE = FRAME_DIR / "idle-1.png"

SKIN = (246, 192, 150, 255)
SKIN_SHADOW = (218, 154, 116, 255)
SKIN_LINE = (124, 82, 58, 210)
SLEEVE = (214, 70, 64, 255)
SLEEVE_DARK = (126, 45, 48, 255)


def rounded(draw: ImageDraw.ImageDraw, xy: tuple[int, int, int, int], radius: int, fill, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def rotated_ellipse(size: tuple[int, int], bbox: tuple[int, int, int, int], angle: float, fill, outline=None, width=1):
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.ellipse(bbox, fill=fill, outline=outline, width=width)
    return layer.rotate(angle, resample=Image.Resampling.BICUBIC, center=((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2))


def transform_pet(base: Image.Image, angle: float, dx: int, dy: int, scale: float) -> Image.Image:
    width, height = base.size
    scaled = base.resize((round(width * scale), round(height * scale)), Image.Resampling.LANCZOS)
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    layer.alpha_composite(scaled, ((width - scaled.width) // 2 + dx, (height - scaled.height) // 2 + dy))
    return layer.rotate(angle, resample=Image.Resampling.BICUBIC, center=(width / 2, height * 0.18), fillcolor=(0, 0, 0, 0))


def draw_hand(canvas: Image.Image, sway: int, squeeze: int) -> None:
    draw = ImageDraw.Draw(canvas)
    cx = canvas.width // 2

    rounded(draw, (cx - 68, 8, cx + 68, 96), 34, SLEEVE, SLEEVE_DARK, 7)
    rounded(draw, (cx - 48, 22, cx + 48, 124), 30, SKIN, SKIN_LINE, 6)
    draw.arc((cx - 50, 96, cx + 50, 174), 188, 352, fill=SKIN_SHADOW, width=7)

    finger_top = 112
    finger_bottom = 242 + squeeze
    finger_width = 42
    for index, offset in enumerate((-66, -22, 22, 66)):
        length_offset = (index % 2) * 12
        x = cx + offset + sway // 2
        rounded(
            draw,
            (x - finger_width // 2, finger_top + length_offset, x + finger_width // 2, finger_bottom - length_offset),
            21,
            SKIN,
            SKIN_LINE,
            5,
        )
        draw.line(
            (x - 7, finger_top + 34 + length_offset, x + 9, finger_top + 64 + length_offset),
            fill=SKIN_SHADOW,
            width=4,
        )

    thumb = rotated_ellipse(canvas.size, (cx + 76 + sway, 102, cx + 156 + sway, 214), -28, SKIN, SKIN_LINE, 5)
    canvas.alpha_composite(thumb)
    draw.line((cx - 84, 238 + squeeze, cx + 84, 238 + squeeze), fill=SKIN_SHADOW, width=6)


def main() -> None:
    base = Image.open(SOURCE).convert("RGBA")
    variants = [
        (-1.2, -8, 58, 0.965, -6, 0),
        (0.0, 0, 64, 0.965, 0, 6),
        (1.2, 8, 58, 0.965, 6, 0),
    ]

    for index, (angle, dx, dy, scale, sway, squeeze) in enumerate(variants, start=1):
        frame = Image.new("RGBA", base.size, (0, 0, 0, 0))
        frame.alpha_composite(transform_pet(base, angle, dx, dy, scale))
        draw_hand(frame, sway, squeeze)
        frame.save(FRAME_DIR / f"dragging-{index}.png")


if __name__ == "__main__":
    main()
