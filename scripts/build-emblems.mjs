/**
 * Builds the Price Ranger ranger badge.
 * Shape only is borrowed from a park-badge silhouette: a flat-topped banner
 * with angled shoulders, straight sides, and a pointed bottom. The figure,
 * lettering, and seal are original.
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
const stripeLight = "#D5C6B0";

// Flat top, shoulders angling in to vertical sides, pointed shield.
// The banner is its own panel: the band above the bottom rule.
const topL = [72, 56];
const topR = [952, 56];
const shoulderL = [156, 236];
const shoulderR = [868, 236];
const sideBottomL = [156, 652];
const sideBottomR = [868, 652];
const point = [512, 988];
const dividerY = 236;
const outline = `M${topL[0]} ${topL[1]} L${topR[0]} ${topR[1]} L${shoulderR[0]} ${shoulderR[1]} L${sideBottomR[0]} ${sideBottomR[1]} L${point[0]} ${point[1]} L${sideBottomL[0]} ${sideBottomL[1]} L${shoulderL[0]} ${shoulderL[1]} Z`;

const seal = { cx: 512, cy: 548 };

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
  // Both lines sit in the flat band, inside the angled shoulders and above the rule.
  const cap = 52;
  const scale = cap / (outfit.capHeight || 700);
  const price = textPath(outfit, "PRICE", {
    cx: 512,
    baseline: 128,
    cap,
    tracking: trackingFor(outfit, "PRICE", 520, scale),
  });
  const rangerLine = textPath(outfit, "RANGER", {
    cx: 512,
    baseline: 196,
    cap,
    tracking: trackingFor(outfit, "RANGER", 620, scale),
  });
  return `${price} ${rangerLine}`;
}

const banner = bannerText();

function stripes(color, width) {
  const lines = [];
  for (let x = 150; x <= 874; x += 34) {
    lines.push(`<line x1="${x}" y1="${dividerY + 10}" x2="${x}" y2="1000" stroke="${color}" stroke-width="${width}" />`);
  }
  return lines.join("");
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
  const ruleInset = simplified ? 36 : 22;
  const rule = `<line x1="${shoulderL[0] + ruleInset}" y1="${dividerY}" x2="${shoulderR[0] - ruleInset}" y2="${dividerY}" stroke="${ink}" stroke-width="${simplified ? 22 : 14}" stroke-linecap="butt"/>`;
  const discR = m.innerEdge + 1;
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
  <path fill="none" stroke="${ink}" stroke-width="${m.rim}" stroke-linejoin="miter" stroke-miterlimit="2.2" d="${outline}"/>
`;
}

function knockout({ simplified }) {
  const m = metrics(simplified);
  const holes = [];
  if (!simplified) {
    for (let x = 180; x <= 844; x += 36) {
      holes.push(`<line x1="${x}" y1="${dividerY + 12}" x2="${x}" y2="1000" stroke="#000" stroke-width="8"/>`);
    }
  }
  const box = m.figR * 1.7;
  const transform = place({ x: seal.cx - box / 2, y: m.sealCy - box / 2 - 2, w: box, h: box });
  const words = simplified ? "" : `<path fill="#000" d="${banner}"/>`;
  const ruleInset = simplified ? 36 : 22;
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
      <line x1="${shoulderL[0] + ruleInset}" y1="${dividerY}" x2="${shoulderR[0] - ruleInset}" y2="${dividerY}" stroke="#000" stroke-width="${simplified ? 22 : 14}" stroke-linecap="butt"/>
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
  // Paper field for the pine sidebar. The seal is paper and the ranger is pine.
  light: {
    label: "Light, for dark green and dark backgrounds",
    field: paper,
    ink: pine,
    stripe: stripeLight,
    sealFill: paper,
    figureFill: pine,
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
