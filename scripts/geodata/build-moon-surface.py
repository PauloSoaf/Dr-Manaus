"""Offline NASA SVS CGI Moon Kit ingestion. Requires Pillow (requirements-lunar.txt).

Run: .geodata-venv/Scripts/python.exe scripts/geodata/build-moon-surface.py
Sources stay in ignored data/raw-geodata/moon; gameplay reads only the bundled JSON.
"""
import argparse
import base64
import hashlib
import json
import struct
import urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
BASE = "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/"
SOURCES = ("ldem_4_uint.tif", "lroc_color_poles_2k.tif")
SOURCE_HASHES = (
    "e6668bec27fc9b8fbb02d198c7ddfb08eedeeb790167b494f95e6b34201da05e",
    "13b797422e8c4b8607ff2b2623ac3a046a6da0132d567c2d272d92fad7052c4a",
)


def build(cache: Path, output: Path):
    cache.mkdir(parents=True, exist_ok=True)
    provenance = []
    for name, expected_hash in zip(SOURCES, SOURCE_HASHES):
        path = cache / name
        if not path.exists():
            urllib.request.urlretrieve(BASE + name, path)
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != expected_hash:
            raise ValueError(f"Source changed: audit NASA provenance before ingesting {name}")
        provenance.append({"url": BASE + name, "sha256": digest})
    with Image.open(cache / SOURCES[0]) as image:
        if image.size != (1440, 720) or image.mode not in ("I;16", "I;16L", "I"):
            raise ValueError("Expected NASA unsigned 16-bit LOLA 4-pixel/degree TIFF")
        source = list(image.get_flattened_data())
        # Average 2x2 cells, retaining half-metre units; source zero is 1727400 m.
        width, height = 720, 360
        elevation = [round(sum(source[(y * 2 + dy) * 1440 + x * 2 + dx]
            for dy in range(2) for dx in range(2)) / 4) - 20000
            for y in range(height) for x in range(width)]
        if not all(-32768 <= value <= 32767 for value in elevation):
            raise ValueError("Elevation does not fit signed half-metres")
    with Image.open(cache / SOURCES[1]) as image:
        if image.size != (2048, 1024):
            raise ValueError("Expected NASA 2019 LROC/LOLA colour TIFF")
        # Neutral lunar reflectance retains the measured maria, highlands and crater rays.
        albedo = image.convert("L").resize((1024, 512), Image.Resampling.BOX).tobytes()
    payload = {
        "version": 1, "source": "NASA SVS CGI Moon Kit (2019 LROC WAC + LOLA)",
        "sourcePage": "https://svs.gsfc.nasa.gov/4720/",
        "licence": "Public domain (NASA SVS; no exception noted for these maps)",
        "retrievedAt": "2026-10-02",
        "usageBasis": "NASA SVS public domain; no exception noted for these maps",
        "usageUrl": "https://svs.gsfc.nasa.gov/help/",
        "credit": "NASA's Scientific Visualization Studio; Ernie Wright (USRA), Noah Petro (NASA/GSFC); LRO/LOLA and LROC teams",
        "sources": provenance, "referenceRadiusM": 1737400,
        "projection": "equirectangular pixel centres; west -180, east +180, north +90; east-positive longitude",
        "elevation": {"width": width, "height": height, "unitM": 0.5,
            "minM": min(elevation) * 0.5, "maxM": max(elevation) * 0.5,
            "encoding": "base64 signed int16 little-endian",
            "values": base64.b64encode(struct.pack("<" + "h" * len(elevation), *elevation)).decode("ascii")},
        "albedo": {"width": 1024, "height": 512, "encoding": "base64 uint8 sRGB luminance",
            "values": base64.b64encode(albedo).decode("ascii")},
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"output": str(output), "bytes": output.stat().st_size,
        "elevationRangeM": [min(elevation) * .5, max(elevation) * .5], "sources": provenance}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache", type=Path, default=ROOT / "data/raw-geodata/moon")
    parser.add_argument("--output", type=Path, default=ROOT / "src/world/geodata/moon-surface.json")
    args = parser.parse_args()
    build(args.cache, args.output)
