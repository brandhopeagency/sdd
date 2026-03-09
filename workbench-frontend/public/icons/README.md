# PWA Icons

This directory contains the source SVG icon for the MHG Chat PWA. The manifest references PNG icons that must be generated from this SVG.

## Required PNG Outputs

Generate the following PNG files from `icon.svg`:

| File | Size | Purpose |
|------|------|---------|
| `icon-192x192.png` | 192×192 | Standard app icon |
| `icon-512x512.png` | 512×512 | Standard app icon |
| `icon-512x512-maskable.png` | 512×512 | Maskable icon (safe zone: center 80% of canvas) |

## Maskable Variant

For `icon-512x512-maskable.png`, ensure the important content (circle, chat bubble, heart) fits within the center 80% of the canvas (≈102px padding from edges). This prevents cropping when the icon is displayed with adaptive masks on various devices.

## Generation Options

- **ImageMagick**: `convert -background none icon.svg -resize 192x192 icon-192x192.png`
- **Inkscape** (CLI): `inkscape icon.svg --export-filename=icon-192x192.png --export-width=192 --export-height=192`
- **Online tools**: Use an SVG-to-PNG converter, then resize to the required dimensions
