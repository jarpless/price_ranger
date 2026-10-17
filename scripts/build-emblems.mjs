/**
 * Builds the Price Ranger ranger badge.
 * The outline is a few smooth curves fit to the reference silhouette:
 * a flat raised plateau, concave dips into rounded shoulders, a slight
 * side bulge, and a soft tip. Lettering, stripes, and the figure are original.
 *
 * Run: node scripts/build-emblems.mjs
 * Needs fontkit, @resvg/resvg-js, and sharp resolvable from /tmp/badge-tools
 * or from this repo's node_modules.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire("/tmp/badge-tools/package.json");
const fontkit = require("fontkit");
const { Resvg } = require("@resvg/resvg-js");
const sharp = require("sharp");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "public/brand/emblems");
const iconDir = resolve(root, "public/brand/icons");
const source = readFileSync(resolve(root, "public/images/logo-mark-light.svg"), "utf8");
const ranger = source.match(/\bd="([^"]+)"/)?.[1];
if (!ranger) throw new Error("Could not read the ranger path.");

const outfit = fontkit.openSync(resolve(root, "app/fonts/outfit-latin-700-normal.woff2"));
const serif = fontkit.openSync(resolve(root, "app/fonts/source-serif-4-latin-700-normal.woff2"));

const vb = { x: 64.6, y: -28.1, w: 792.5, h: 792.5 };
const W = 1024;

const pine = "#1E4636";
const cream = "#F3EEE4";
const paper = "#FFFDF8";
const stripeDark = "#10281C";
const stripeLight = "#8A7964";

// Clean crown, shoulder, side, and tip. Points are on the reference silhouette
// (photo pixels), then scaled into the badge. A flat plateau, a concave dip,
// and a rounded shoulder are explicit, so the stroke stays smooth.
const photoCx = 618.5;
const photoTop = 124;
const photoTip = 1402;
const badgeTop = 36;
const badgeTip = 988;
const badgeCx = 512;
const fit = (badgeTip - badgeTop) / (photoTip - photoTop);
const rightPhoto = [
  [photoCx + 165, photoTop],
  [photoCx + 182, photoTop + 22],
  [photoCx + 205, photoTop + 46],
  [photoCx + 240, photoTop + 66],
  [photoCx + 280, photoTop + 77],
  [photoCx + 315, photoTop + 79],
  [photoCx + 360, photoTop + 72],
  [photoCx + 405, photoTop + 54],
  [photoCx + 430, photoTop + 62],
  [photoCx + 460, photoTop + 108],
  [photoCx + 500, photoTop + 168],
  [photoCx + 534, photoTop + 230],
  [photoCx + 548, photoTop + 280],
  [photoCx + 534, photoTop + 500],
  [photoCx + 514, photoTop + 700],
  [photoCx + 498, photoTop + 880],
  [photoCx + 420, photoTop + 1045],
  [photoCx + 280, photoTop + 1165],
  [photoCx + 140, photoTop + 1255],
  [photoCx + 48, photoTop + 1318],
  [photoCx, photoTip],
];

function mapPoint([x, y]) {
  return [badgeCx + (x - photoCx) * fit, badgeTop + (y - photoTop) * fit];
}

function reflect([x, y]) {
  return [2 * badgeCx - x, y];
}

function outlinePath() {
  const right = rightPhoto.map(mapPoint);
  const leftPlat = mapPoint([photoCx - 165, photoTop]);
  const num = (v) => v.toFixed(2);
  const cubics = [];
  for (let i = 0; i < right.length - 1; i++) {
    const p0 = i === 0 ? mapPoint([photoCx + 60, photoTop]) : right[i - 1];
    const p1 = right[i];
    const p2 = right[i + 1];
    const p3 = right[Math.min(right.length - 1, i + 2)];
    const last = i === right.length - 2;
    let c1x;
    let c1y;
    let c2x;
    let c2y;
    if (last) {
      const dirx = p1[0] - p0[0];
      const diry = p1[1] - p0[1];
      const len = Math.hypot(dirx, diry) || 1;
      c1x = p1[0] + (dirx / len) * 28;
      c1y = p1[1] + (diry / len) * 28;
      c2x = p2[0];
      c2y = p2[1] - 18;
    } else {
      c1x = p1[0] + (p2[0] - p0[0]) / 6;
      c1y = p1[1] + (p2[1] - p0[1]) / 6;
      c2x = p2[0] - (p3[0] - p1[0]) / 6;
      c2y = p2[1] - (p3[1] - p1[1]) / 6;
    }
    cubics.push({ c1: [c1x, c1y], c2: [c2x, c2y], end: p2 });
  }
  let d = `M${num(leftPlat[0])} ${num(leftPlat[1])}L${num(right[0][0])} ${num(right[0][1])}`;
  for (const seg of cubics) {
    d += `C${num(seg.c1[0])} ${num(seg.c1[1])} ${num(seg.c2[0])} ${num(seg.c2[1])} ${num(seg.end[0])} ${num(seg.end[1])}`;
  }
  for (let i = cubics.length - 1; i >= 0; i--) {
    const seg = cubics[i];
    const start = i === 0 ? right[0] : cubics[i - 1].end;
    const c1 = reflect(seg.c2);
    const c2 = reflect(seg.c1);
    const end = reflect(start);
    d += `C${num(c1[0])} ${num(c1[1])} ${num(c2[0])} ${num(c2[1])} ${num(end[0])} ${num(end[1])}`;
  }
  return `${d}Z`;
}

const outline = outlinePath();
const dividerY = mapPoint([photoCx, 364])[1];
const shoulderX = mapPoint([photoCx + 548, photoTop])[0];
const seal = { cx: badgeCx, cy: 568 };

function place(box) {
  const scale = Math.min(box.w / vb.w, box.h / vb.h);
  const x = box.x + (box.w - vb.w * scale) / 2 - vb.x * scale;
  const y = box.y + (box.h - vb.h * scale) / 2 - vb.y * scale;
  return `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(5)})`;
}

function lineWidth(font, text, tracking) {
  const glyphs = [...text].map((ch) => font.glyphForCodePoint(ch.codePointAt(0)));
  return glyphs.reduce((sum, glyph, index) => sum + glyph.advanceWidth + (index ? tracking : 0), 0);
}

function trackingFor(font, text, width, capScale) {
  const glyphs = [...text];
  const bare = lineWidth(font, text, 0);
  const gaps = Math.max(1, glyphs.length - 1);
  const target = width / capScale;
  return Math.max(0, (target - bare) / gaps);
}

function textPath(font, text, { cx, baseline, cap, tracking, align = "center" }) {
  const capHeight = font.capHeight || 700;
  const scale = cap / capHeight;
  const width = lineWidth(font, text, tracking) * scale;
  let x = align === "left" ? cx : cx - width / 2;
  const parts = [];
  for (const ch of text) {
    const glyph = font.glyphForCodePoint(ch.codePointAt(0));
    const drawn = glyph.path.scale(scale, -scale).translate(x, baseline).toSVG();
    if (drawn) parts.push(drawn);
    x += (glyph.advanceWidth + tracking) * scale;
  }
  return parts.join(" ");
}

function bannerText() {
  // Even gaps: inner rim, PRICE, RANGER, then the shoulder rule.
  const cap = 34;
  const scale = cap / (outfit.capHeight || 700);
  const price = textPath(outfit, "PRICE", {
    cx: badgeCx,
    baseline: 126,
    cap,
    tracking: trackingFor(outfit, "PRICE", 280, scale),
  });
  const rangerLine = textPath(outfit, "RANGER", {
    cx: badgeCx,
    baseline: 184,
    cap,
    tracking: trackingFor(outfit, "RANGER", 360, scale),
  });
  return `${price} ${rangerLine}`;
}

const banner = bannerText();

function stripeXs() {
  const gap = 28;
  const reach = shoulderX - badgeCx - 36;
  const steps = Math.floor(reach / gap);
  const xs = [];
  for (let i = -steps; i <= steps; i++) xs.push(badgeCx + i * gap);
  return xs;
}

function stripes(color, width) {
  return stripeXs()
    .map((x) => `<line x1="${x.toFixed(1)}" y1="${(dividerY + 10).toFixed(1)}" x2="${x.toFixed(1)}" y2="1040" stroke="${color}" stroke-width="${width}" />`)
    .join("");
}

function metrics(simplified) {
  // Outer ring stays thin; the inner ring is heavier, with a clear gap and no lettering.
  const rim = simplified ? 70 : 30;
  const outerRing = simplified ? 16 : 7;
  const innerRing = simplified ? 22 : 14;
  const ringGap = simplified ? 40 : 28;
  const sealR = 196;
  const innerEdge = sealR - ringGap - innerRing / 2;
  const figR = innerEdge - (simplified ? 4 : 8);
  return { rim, outerRing, innerRing, ringGap, sealR, sealCy: seal.cy, innerEdge, figR };
}

function figure(fill, radius, cy) {
  const box = radius * 1.7;
  const transform = place({ x: seal.cx - box / 2, y: cy - box / 2 - 2, w: box, h: box });
  return `<g clip-path="url(#seal-clip)"><path fill="${fill}" fill-rule="evenodd" transform="${transform}" d="${ranger}"/></g>`;
}

function emblem({ field, ink, stripe, sealFill, figureFill, simplified }) {
  const m = metrics(simplified);
  const stripeMarkup = simplified
    ? ""
    : `<g clip-path="url(#badge-clip)">${stripes(stripe, 8)}</g>`;
  const words = simplified ? "" : `<g clip-path="url(#badge-clip)"><path fill="${ink}" d="${banner}"/></g>`;
  const ruleHalf = shoulderX - badgeCx - (simplified ? 64 : 56);
  const rule = `<line x1="${(badgeCx - ruleHalf).toFixed(1)}" y1="${dividerY.toFixed(1)}" x2="${(badgeCx + ruleHalf).toFixed(1)}" y2="${dividerY.toFixed(1)}" stroke="${ink}" stroke-width="${simplified ? 18 : 11}" stroke-linecap="butt"/>`;
  const discR = m.sealR + m.outerRing / 2 + 1;
  return `
  <defs>
    <clipPath id="badge-clip"><path d="${outline}"/></clipPath>
    <clipPath id="seal-clip"><circle cx="${seal.cx}" cy="${m.sealCy}" r="${m.figR}"/></clipPath>
  </defs>
  <path fill="${field}" d="${outline}"/>
  ${stripeMarkup}
  <circle cx="${seal.cx}" cy="${m.sealCy}" r="${discR}" fill="${sealFill}"/>
  <circle cx="${seal.cx}" cy="${m.sealCy}" r="${m.sealR}" fill="none" stroke="${figureFill}" stroke-width="${m.outerRing}"/>
  <circle cx="${seal.cx}" cy="${m.sealCy}" r="${m.sealR - m.ringGap}" fill="none" stroke="${figureFill}" stroke-width="${m.innerRing}"/>
  ${figure(figureFill, m.figR, m.sealCy)}
  ${rule}
  ${words}
  <g clip-path="url(#badge-clip)"><path fill="none" stroke="${ink}" stroke-width="${m.rim * 2}" stroke-linejoin="round" stroke-linecap="round" d="${outline}"/></g>
`;
}

function knockout({ simplified }) {
  const m = metrics(simplified);
  const holes = [];
  if (!simplified) {
    for (const x of stripeXs()) {
      holes.push(`<line x1="${x.toFixed(1)}" y1="${(dividerY + 10).toFixed(1)}" x2="${x.toFixed(1)}" y2="1040" stroke="#000" stroke-width="8"/>`);
    }
  }
  const box = m.figR * 1.7;
  const transform = place({ x: seal.cx - box / 2, y: m.sealCy - box / 2 - 2, w: box, h: box });
  const words = simplified ? "" : `<path fill="#000" d="${banner}"/>`;
  const ruleHalf = shoulderX - badgeCx - (simplified ? 64 : 56);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}" role="img" aria-label="Price Ranger badge, one color">
  <title>Price Ranger badge, one color</title>
  <defs>
    <mask id="knock" maskUnits="userSpaceOnUse">
      <rect width="${W}" height="${W}" fill="#fff"/>
      <g clip-path="url(#badge-clip)">
        ${holes.join("")}
      </g>
      <circle cx="${seal.cx}" cy="${m.sealCy}" r="${m.sealR}" fill="none" stroke="#000" stroke-width="${m.outerRing}"/>
      <circle cx="${seal.cx}" cy="${m.sealCy}" r="${m.sealR - m.ringGap}" fill="none" stroke="#000" stroke-width="${m.innerRing}"/>
      <line x1="${(badgeCx - ruleHalf).toFixed(1)}" y1="${dividerY.toFixed(1)}" x2="${(badgeCx + ruleHalf).toFixed(1)}" y2="${dividerY.toFixed(1)}" stroke="#000" stroke-width="${simplified ? 20 : 12}" stroke-linecap="butt"/>
      ${words}
      <g clip-path="url(#seal-clip)"><path fill="#000" fill-rule="evenodd" transform="${transform}" d="${ranger}"/></g>
    </mask>
    <clipPath id="badge-clip"><path d="${outline}"/></clipPath>
    <clipPath id="seal-clip"><circle cx="${seal.cx}" cy="${m.sealCy}" r="${m.figR}"/></clipPath>
  </defs>
  <path fill="${cream}" mask="url(#knock)" d="${outline}"/>
</svg>`;
}

function wrap(title, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}" role="img" aria-label="${title}">
  <title>${title}</title>
  ${body}
</svg>`;
}

const variants = {
  // Pine field for tan. The seal is pine and the ranger is paper.
  dark: {
    label: "Dark, for tan and light backgrounds",
    field: pine,
    ink: cream,
    stripe: stripeDark,
    sealFill: pine,
    figureFill: paper,
  },
  // Paper field for the pine sidebar. The seal matches the dark badge.
  light: {
    label: "Light, for dark green and dark backgrounds",
    field: paper,
    ink: pine,
    stripe: stripeLight,
    sealFill: pine,
    figureFill: paper,
  },
};

function svgFor(name, simplified = false) {
  if (name === "inverse") return knockout({ simplified });
  const spec = variants[name];
  return wrap(`Price Ranger badge, ${spec.label}`, emblem({ ...spec, simplified }));
}

function render(svg, size) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    background: "rgba(0,0,0,0)",
  });
  return resvg.render().asPng();
}

mkdirSync(outDir, { recursive: true });
mkdirSync(iconDir, { recursive: true });

const sizes = [64, 128, 256, 512, 1024];
const files = [];
for (const name of ["inverse", "dark", "light"]) {
  const svg = svgFor(name, false);
  const file = `badge-${name}.svg`;
  writeFileSync(resolve(outDir, file), svg);
  files.push(file);
  for (const size of sizes) {
    const png = `badge-${name}-${size}.png`;
    writeFileSync(resolve(outDir, png), render(svg, size));
    files.push(png);
  }
  writeFileSync(resolve(outDir, `badge-${name}.png`), render(svg, 1024));
}

const simple = {
  dark: svgFor("dark", true),
  light: svgFor("light", true),
  inverse: svgFor("inverse", true),
};
writeFileSync(resolve(iconDir, "badge-simplified-dark.svg"), simple.dark);
writeFileSync(resolve(iconDir, "badge-simplified-light.svg"), simple.light);
writeFileSync(resolve(iconDir, "badge-simplified-inverse.svg"), simple.inverse);

writeFileSync(resolve(iconDir, "icon-light-32.png"), render(simple.dark, 32));
writeFileSync(resolve(iconDir, "icon-dark-32.png"), render(simple.light, 32));
// Home-screen and manifest sizes are large enough for the full badge.
writeFileSync(resolve(iconDir, "icon-light-192.png"), render(svgFor("dark", false), 192));
writeFileSync(resolve(iconDir, "icon-light-512.png"), render(svgFor("dark", false), 512));
writeFileSync(resolve(iconDir, "badge-inverse-160.png"), render(simple.inverse, 160));
writeFileSync(resolve(iconDir, "badge-light-160.png"), render(simple.light, 160));

await sharp({
  create: { width: 180, height: 180, channels: 4, background: cream },
})
  .composite([{ input: await sharp(render(svgFor("dark", false), 164)).png().toBuffer(), gravity: "centre" }])
  .png()
  .toFile(resolve(iconDir, "apple-touch.png"));

const word = textPath(serif, "Price Ranger", { cx: 88, baseline: 308, cap: 64, tracking: 0, align: "left" });
const sub = textPath(outfit, "A fair price before you list it.", { cx: 90, baseline: 356, cap: 28, tracking: 4, align: "left" });
const ogBadge = render(svgFor("dark", false), 460);
const ogSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${cream}"/>
  <path fill="${pine}" d="${word}"/>
  <path fill="#5E564E" d="${sub}"/>
</svg>`;
const ogBase = render(ogSvg, 1200);
await sharp(ogBase)
  .composite([{ input: ogBadge, left: 700, top: 70 }])
  .png()
  .toFile(resolve(root, "public/brand/og.png"));

const markPng = render(svgFor("light", false), 160);
const markJpeg = await sharp(markPng).flatten({ background: pine }).jpeg({ quality: 82 }).toBuffer();
const hex = markJpeg.toString("hex");
const rows = [];
for (let i = 0; i < hex.length; i += 64) rows.push(`  "${hex.slice(i, i + 64)}",`);
rows[rows.length - 1] = rows[rows.length - 1].replace(/,$/, "");
writeFileSync(
  resolve(root, "lib/guide/mark-jpeg.ts"),
  `/** Paper ranger badge on pine, for the PDF header. Regenerated by scripts/build-emblems.mjs. */\nexport const MARK_JPEG_HEX = [\n${rows.join("\n")}\n].join("");\n`,
);

const backgrounds = [
  ["Tan", cream, "#1C1915"],
  ["White", "#FFFFFF", "#1C1915"],
  ["Dark green", pine, cream],
  ["Black", "#111111", cream],
];
const sheetSizes = [24, 32, 48, 64, 128, 256, 512];
const labelW = 168;
const gap = 18;
const rowW = sheetSizes.reduce((sum, size) => sum + size + gap, 0);
const sheetW = 48 + labelW + rowW;
const bandH = 512 + 92;
const sheetH = 88 + backgrounds.length * (bandH * 3 + 28);

const pngCache = new Map();
function pngAt(name, size) {
  const simplified = size <= 48;
  const key = `${name}-${size}-${simplified ? "s" : "f"}`;
  if (!pngCache.has(key)) {
    const svg = name === "icon" ? simple.dark : svgFor(name, simplified);
    pngCache.set(key, render(svg, size));
  }
  return pngCache.get(key);
}

const cells = [];
let y = 88;
for (const [bgName, bg] of backgrounds) {
  let row = 0;
  for (const name of ["inverse", "dark", "light"]) {
    const title = name === "inverse" ? "One color" : name === "dark" ? "Dark on tan" : "Light on green";
    cells.push({
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${labelW}" height="40"><text x="0" y="26" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="${bg === cream || bg === "#FFFFFF" ? "#1C1915" : cream}">${title}</text></svg>`,
      ),
      left: 32,
      top: y + 8,
    });
    let x = 32 + labelW;
    for (const size of sheetSizes) {
      const top = y + (512 - size);
      cells.push({ input: pngAt(name, size), left: x, top });
      x += size + gap;
    }
    y += bandH;
    row += 1;
  }
  y += 28;
  void row;
  void bgName;
}

const bands = [];
let bandY = 72;
for (const [, bg] of backgrounds) {
  const h = bandH * 3 + 16;
  bands.push({
    input: Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${h}"><rect width="100%" height="100%" fill="${bg}"/></svg>`,
    ),
    left: 0,
    top: bandY,
  });
  bandY += h + 12;
}

const header = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="72"><rect width="100%" height="100%" fill="${paper}"/><text x="32" y="46" font-family="Georgia, serif" font-size="32" fill="${pine}">Price Ranger badge</text></svg>`,
);

const sheet = sharp({
  create: { width: sheetW, height: Math.max(sheetH, bandY), channels: 4, background: paper },
});
await sheet.composite([{ input: header, left: 0, top: 0 }, ...bands, ...cells]).png().toFile(resolve(outDir, "contact-sheet.png"));

writeFileSync(
  resolve(outDir, "contact-sheet.html"),
  `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Price Ranger badge</title>
  <style>body{margin:0;background:#fffdf8}img{width:100%;height:auto}</style>
</head>
<body>
  <img src="contact-sheet.png" alt="Price Ranger badge variants on tan, white, dark green, and black, from 24 to 512 pixels">
</body>
</html>
`,
);

console.log(files.join("\n"));
console.log("contact sheet", sheetW, "x", bandY);
