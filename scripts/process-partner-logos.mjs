// Partner logo pre-processor
// ---------------------------------------------------------------------------
// Normalizes arbitrary partner logos into a consistent MONOCHROME mark on a
// transparent background, so they sit cleanly in the logo wall regardless of
// the source's background color or polarity (light-on-dark vs dark-on-light).
//
// How it works (per logo):
//   1. Detect the background color from the image corners.
//   2. For every pixel, opacity = how far its color is from the background.
//      This keys out the background (black OR white) and keeps internal detail
//      as soft anti-aliased alpha — it does NOT care about hue, so a mid-tone
//      green or pale gray survives just as well as solid black.
//   3. Recolor every surviving pixel to a single uniform INK color.
//   4. Trim to the artwork, add even padding, scale to a uniform height.
//
// Usage:
//   node scripts/process-partner-logos.mjs            # writes previews + contact sheet
//   node scripts/process-partner-logos.mjs --emit      # also writes final PNGs to public/images/partners/
//
// Tuning per partner lives in the PARTNERS array below. To onboard a new
// partner, drop their raw logo in src/assets/ and add one entry.
// ---------------------------------------------------------------------------

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src/assets');
const PREVIEW = path.join(ROOT, 'scripts/.preview');
const EMIT_DIR = path.join(ROOT, 'public/images/partners');

// ---- global defaults -------------------------------------------------------
const INK = '#374151';      // gray-700 — neutral monochrome ink for the wall
const TARGET_H = 480;       // output height in px (CSS scales down; keep crisp @2x)
const PAD = 0.08;           // even padding around the trimmed mark (fraction of size)

// ---- per-partner config ----------------------------------------------------
// bg: 'auto' detects from corners. Use an explicit [r,g,b] when the corners are
// transparent (so there's no color to sample) or detection misfires.
// scale: color-distance (0-441) that counts as "fully opaque". Lower = more
// aggressive (faint/pale parts stay solid); higher = more is keyed out.
// low/high: levels applied to the normalized signal to clean edges / boost.
const PARTNERS = [
  { id: 'cava',                    name: 'Companion Animal Veterinary Associates', input: 'partner_cava.jpg',       bg: 'auto' },
  { id: 'delaware-pet-aquamation', name: 'Delaware Pet Aquamation',                input: 'partner_aquamation.jpg', bg: 'auto' },
  // low raised to clear the faint off-white sticker-border residue around the mark.
  { id: 'delaware-vet-dental',     name: 'Delaware Veterinary Dental Practice',    input: 'partner_DVDP.webp',      bg: [255, 255, 255], low: 0.55 },
];

const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

function detectBg(data, info) {
  const { width, height, channels } = info;
  const block = Math.max(4, Math.round(Math.min(width, height) * 0.03));
  const corners = [[0, 0], [width - block, 0], [0, height - block], [width - block, height - block]];
  let r = 0, g = 0, b = 0, n = 0;
  for (const [cx, cy] of corners) {
    for (let y = cy; y < cy + block; y++) for (let x = cx; x < cx + block; x++) {
      const i = (y * width + x) * channels;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
  }
  return [r / n, g / n, b / n];
}

async function toMono(inputPath, opts = {}) {
  const ink = hexToRgb(opts.ink || INK);
  const scale = opts.scale ?? 140;     // distance -> fully opaque
  const low = opts.low ?? 0.05;        // signal below this -> transparent (kills bg noise)
  const high = opts.high ?? 0.85;      // signal above this -> fully opaque
  const targetH = opts.targetH || TARGET_H;

  const meta = await sharp(inputPath).metadata();
  const workW = Math.min(meta.width, 1024);
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .resize({ width: workW })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info; // channels === 4
  const bg = opts.bg && opts.bg !== 'auto' ? opts.bg : detectBg(data, info);

  const out = Buffer.alloc(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2], srcA = data[i + 3] / 255;
    const dist = Math.sqrt((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2);
    let s = dist / scale;
    s = (s - low) / (high - low);
    s = Math.max(0, Math.min(1, s));
    out[i] = ink[0]; out[i + 1] = ink[1]; out[i + 2] = ink[2];
    out[i + 3] = Math.round(s * 255 * srcA);
  }

  // raw mono -> trim transparent border -> pad evenly -> scale to uniform height
  let buf = await sharp(out, { raw: { width, height, channels: 4 } }).trim({ threshold: 6 }).png().toBuffer();
  const tm = await sharp(buf).metadata();
  const padX = Math.round(tm.width * PAD), padY = Math.round(tm.height * PAD);
  buf = await sharp(buf)
    .extend({ top: padY, bottom: padY, left: padX, right: padX, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ height: targetH })
    .png()
    .toBuffer();

  return { buf, bg };
}

// Render a logo buffer centered on a colored panel (for the contact sheet).
async function panel(logoBuf, w, h, bg) {
  const inner = await sharp(logoBuf).resize({ height: Math.round(h * 0.62), fit: 'inside' }).toBuffer();
  const im = await sharp(inner).metadata();
  return sharp({ create: { width: w, height: h, channels: 4, background: bg } })
    .composite([{ input: inner, left: Math.round((w - im.width) / 2), top: Math.round((h - im.height) / 2) }])
    .png().toBuffer();
}

async function originalPanel(inputPath, w, h, bg) {
  const inner = await sharp(inputPath).resize({ height: Math.round(h * 0.62), fit: 'inside' }).toBuffer();
  const im = await sharp(inner).metadata();
  return sharp({ create: { width: w, height: h, channels: 4, background: bg } })
    .composite([{ input: inner, left: Math.round((w - im.width) / 2), top: Math.round((h - im.height) / 2) }])
    .png().toBuffer();
}

async function main() {
  const emit = process.argv.includes('--emit');
  await mkdir(PREVIEW, { recursive: true });
  if (emit) await mkdir(EMIT_DIR, { recursive: true });

  const CW = 300, CH = 150, COLGAP = 18, ROWLABEL = 34, ROWGAP = 24, ML = 24, MT = 92;
  const cols = ['Original (on gray)', 'Monochrome · white', 'Monochrome · violet-50'];
  const sheetW = ML * 2 + CW * 3 + COLGAP * 2;
  const sheetH = MT + PARTNERS.length * (ROWLABEL + CH + ROWGAP);
  const colX = (c) => ML + c * (CW + COLGAP);
  const rowY = (r) => MT + r * (ROWLABEL + CH + ROWGAP);

  const composites = [];
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}">`;
  svg += `<text x="${ML}" y="40" font-family="Inter,Arial,sans-serif" font-size="22" font-weight="700" fill="#111">Partner logo pre-processing — preview</text>`;
  svg += `<text x="${ML}" y="62" font-family="Inter,Arial,sans-serif" font-size="13" fill="#666">ink ${INK} · color-distance keying · transparent output</text>`;
  cols.forEach((c, ci) => {
    svg += `<text x="${colX(ci) + CW / 2}" y="84" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="13" font-weight="600" fill="#444">${c}</text>`;
  });

  for (let r = 0; r < PARTNERS.length; r++) {
    const p = PARTNERS[r];
    const inputPath = path.join(SRC, p.input);
    const { buf, bg } = await toMono(inputPath, p);

    // save individual preview + optional final asset
    await writeFile(path.join(PREVIEW, `${p.id}.png`), buf);
    if (emit) await writeFile(path.join(EMIT_DIR, `${p.id}.png`), buf);

    const cellTop = rowY(r) + ROWLABEL;
    svg += `<text x="${colX(0)}" y="${rowY(r) + 22}" font-family="Inter,Arial,sans-serif" font-size="14" font-weight="600" fill="#222">${p.name}</text>`;
    svg += `<text x="${colX(0) + 360}" y="${rowY(r) + 22}" font-family="Inter,Arial,sans-serif" font-size="11" fill="#999">bg detected: rgb(${bg.map(v => Math.round(v)).join(',')})</text>`;

    const oCell = await originalPanel(inputPath, CW, CH, '#e5e7eb');
    const wCell = await panel(buf, CW, CH, '#ffffff');
    const vCell = await panel(buf, CW, CH, '#f5f3ff');
    composites.push(
      { input: oCell, left: colX(0), top: cellTop },
      { input: wCell, left: colX(1), top: cellTop },
      { input: vCell, left: colX(2), top: cellTop },
    );
  }
  svg += `</svg>`;
  composites.push({ input: Buffer.from(svg), left: 0, top: 0 });

  const sheet = await sharp({ create: { width: sheetW, height: sheetH, channels: 4, background: '#ffffff' } })
    .composite(composites).png().toBuffer();
  const sheetPath = path.join(PREVIEW, 'contact-sheet.png');
  await writeFile(sheetPath, sheet);

  console.log('Wrote previews to', PREVIEW);
  console.log('Contact sheet:', sheetPath);
  if (emit) console.log('Emitted final PNGs to', EMIT_DIR);
}

main().catch((e) => { console.error(e); process.exit(1); });
