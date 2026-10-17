/**
 * Builds the Price Ranger ranger badge.
 * Shape only is borrowed from a park-badge silhouette: peaked banner,
 * angled shoulders, straight sides, pointed bottom. The figure, lettering,
 * and seal are original.
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

const peak = [512, 40];
const roofL = [236, 156];
const roofR = [788, 156];
const shoulderL = [128, 286];
const shoulderR = [896, 286];
const sideBottomL = [128, 690];
const sideBottomR = [896, 690];
const point = [512, 984];
const dividerY = 300;
const outline = `M${peak[0]} ${peak[1]} L${roofR[0]} ${roofR[1]} L${shoulderR[0]} ${shoulderR[1]} L${sideBottomR[0]} ${sideBottomR[1]} L${point[0]} ${point[1]} L${sideBottomL[0]} ${sideBottomL[1]} L${shoulderL[0]} ${shoulderL[1]} L${roofL[0]} ${roofL[1]} Z`;

const seal = { cx: 512, cy: 612, r: 214 };

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
  // PRICE sits in the peak, so it stays narrower than RANGER in the shoulder band.
  // Widths are chosen so the cap tops stay inside the rim, not clipped by it.
  const priceCap = 56;
  const rangerCap = 62;
  const priceScale = priceCap / (outfit.capHeight || 700);
  const rangerScale = rangerCap / (outfit.capHeight || 700);
  const price = textPath(outfit, "PRICE", {
    cx: 512,
    baseline: 192,
    cap: priceCap,
    tracking: trackingFor(outfit, "PRICE", 380, priceScale),
  });
  const rangerLine = textPath(outfit, "RANGER", {
    cx: 512,
    baseline: 270,
    cap: rangerCap,
    tracking: trackingFor(outfit, "RANGER", 500, rangerScale),
  });
  return `${price} ${rangerLine}`;
}

const banner = bannerText();

function stripes(color, width) {
  const lines = [];
  for (let x = 160; x <= 864; x += 36) {
    lines.push(`<line x1="${x}" y1="${dividerY + 8}" x2="${x}" y2="1000" stroke="${color}" stroke-width="${width}" />`);
  }
  return lines.join("");
}

function figure(fill, radius) {
  const box = radius * 1.55;
  const transform = place({ x: seal.cx - box / 2, y: seal.cy - box / 2 - 6, w: box, h: box });
  return `<g clip-path="url(#seal-clip)"><path fill="${fill}" fill-rule="evenodd" transform="${transform}" d="${ranger}"/></g>`;
}

function emblem({ field, ink, stripe, simplified }) {
  const rim = simplified ? 54 : 30;
  const ring = simplified ? 26 : 14;
  const inner = simplified ? 12 : 7;
  const sealR = simplified ? 250 : seal.r;
  const figR = simplified ? 210 : 176;
  const stripeMarkup = simplified
    ? ""
    : `<g clip-path="url(#badge-clip)">${stripes(stripe, 8)}</g><circle cx="${seal.cx}" cy="${seal.cy}" r="${sealR - 6}" fill="${field}"/>`;
  const words = simplified ? "" : `<g clip-path="url(#badge-clip)"><path fill="${ink}" d="${banner}"/></g>`;
  const bar = `<line x1="168" y1="${dividerY}" x2="856" y2="${dividerY}" stroke="${ink}" stroke-width="${simplified ? 16 : 8}" stroke-linecap="round"/>`;
  return `
  <defs>
    <clipPath id="badge-clip"><path d="${outline}"/></clipPath>
    <clipPath id="seal-clip"><circle cx="${seal.cx}" cy="${seal.cy}" r="${figR}"/></clipPath>
  </defs>
  <path fill="${field}" d="${outline}"/>
  ${stripeMarkup}
  <circle cx="${seal.cx}" cy="${seal.cy}" r="${sealR}" fill="none" stroke="${ink}" stroke-width="${ring}"/>
  <circle cx="${seal.cx}" cy="${seal.cy}" r="${sealR - 28}" fill="none" stroke="${ink}" stroke-width="${inner}"/>
  ${figure(ink, figR)}
  ${bar}
  ${words}
  <path fill="none" stroke="${ink}" stroke-width="${rim}" stroke-linejoin="miter" stroke-miterlimit="2.4" d="${outline}"/>
`;
}

function knockout({ simplified }) {
  const sealR = simplified ? 250 : seal.r;
  const figR = simplified ? 210 : 176;
  const holes = [];
  if (!simplified) {
    for (let x = 160; x <= 864; x += 36) {
      holes.push(`<line x1="${x}" y1="${dividerY + 8}" x2="${x}" y2="1000" stroke="#000" stroke-width="8"/>`);
    }
  }
  const box = (simplified ? 210 : 176) * 1.55;
  const transform = place({ x: seal.cx - box / 2, y: seal.cy - box / 2 - 6, w: box, h: box });
  const words = simplified ? "" : `<path fill="#000" d="${banner}"/>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}" role="img" aria-label="Price Ranger badge, one color">
  <title>Price Ranger badge, one color</title>
  <defs>
    <mask id="knock" maskUnits="userSpaceOnUse">
      <rect width="${W}" height="${W}" fill="#fff"/>
      <g clip-path="url(#badge-clip)">
        ${holes.join("")}
      </g>
      <circle cx="${seal.cx}" cy="${seal.cy}" r="${sealR}" fill="none" stroke="#000" stroke-width="${simplified ? 26 : 14}"/>
      <circle cx="${seal.cx}" cy="${seal.cy}" r="${sealR - 28}" fill="none" stroke="#000" stroke-width="${simplified ? 12 : 7}"/>
      <line x1="168" y1="${dividerY}" x2="856" y2="${dividerY}" stroke="#000" stroke-width="${simplified ? 16 : 8}" stroke-linecap="round"/>
      ${words}
      <g clip-path="url(#seal-clip)"><path fill="#000" fill-rule="evenodd" transform="${transform}" d="${ranger}"/></g>
    </mask>
    <clipPath id="badge-clip"><path d="${outline}"/></clipPath>
    <clipPath id="seal-clip"><circle cx="${seal.cx}" cy="${seal.cy}" r="${figR}"/></clipPath>
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
  dark: {
    label: "Dark, for tan and light backgrounds",
    field: pine,
    ink: cream,
    stripe: stripeDark,
  },
  light: {
    label: "Light, for dark green and dark backgrounds",
    field: paper,
    ink: pine,
    stripe: stripeLight,
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
writeFileSync(resolve(iconDir, "icon-light-192.png"), render(simple.dark, 192));
writeFileSync(resolve(iconDir, "icon-light-512.png"), render(simple.dark, 512));
writeFileSync(resolve(iconDir, "badge-inverse-160.png"), render(simple.inverse, 160));
writeFileSync(resolve(iconDir, "badge-light-160.png"), render(simple.light, 160));

await sharp({
  create: { width: 180, height: 180, channels: 4, background: cream },
})
  .composite([{ input: await sharp(render(simple.dark, 156)).png().toBuffer(), gravity: "centre" }])
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
  const key = `${name}-${size}`;
  if (!pngCache.has(key)) pngCache.set(key, render(name === "icon" ? simple.dark : svgFor(name, false), size));
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
