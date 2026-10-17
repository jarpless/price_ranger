/**
 * Builds the Price Ranger ranger badge.
 * The outline is the extracted silhouette in scripts/badge-silhouette.
 * Stair-steps are smoothed by at most 0.12% of the height. Lettering,
 * stripes, and the figure are original.
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
const source = readFileSync(resolve(root, "scripts/ranger-bust.svg"), "utf8");
const ranger = source.match(/\bd="([^"]+)"/)?.[1];
if (!ranger) throw new Error("Could not read the ranger path.");

const outfit = fontkit.openSync(resolve(root, "app/fonts/outfit-latin-700-normal.woff2"));
const serif = fontkit.openSync(resolve(root, "app/fonts/source-serif-4-latin-700-normal.woff2"));

const W = 1024;

const pine = "#1E4636";
const cream = "#F3EEE4";
const paper = "#FFFDF8";
const stripeDark = "#10281C";
const stripeLight = "#8A7964";

// Extracted silhouette, viewBox 0 0 822.6 1000, aspect 0.8226.
// A short smooth removes pixel stairs. Points may move at most 1.2 units
// (0.12% of the height), inside the 0.5% edge limit.
const srcW = 822.6;
const srcH = 1000;
const badgeH = 940;
const badgeScale = badgeH / srcH;
const badgeLeft = (W - srcW * badgeScale) / 2;
const badgeTop = (W - badgeH) / 2;
const badgeCx = badgeLeft + 411.3 * badgeScale;
const dividerY = badgeTop + 0.24 * badgeH;
// Measured on the reference badge (gold body, straight-on):
// seal outer diameter / badge width = 0.7405
// seal center = 0.4833 of the span from the band rule to the tip.
const silhouetteW = 820.6;
const ruleSrc = 240;
const tipSrc = 998;
const sealFieldFrac = 0.4833;
const sealOuterRatio = 0.7405;
const sealCySrc = ruleSrc + sealFieldFrac * (tipSrc - ruleSrc);
const sealOuterR = (sealOuterRatio * silhouetteW * badgeScale) / 2;
const seal = { cx: badgeCx, cy: badgeTop + sealCySrc * badgeScale };

function sourcePoints() {
  const line = readFileSync(resolve(root, "scripts/badge-silhouette/outline-path.txt"), "utf8")
    .split("\n")[1]
    .trim();
  const nums = [...line.matchAll(/-?\d*\.?\d+/g)].map((match) => Number(match[0]));
  const orig = [];
  for (let i = 0; i < nums.length; i += 2) orig.push([nums[i], nums[i + 1]]);
  if (Math.hypot(orig[0][0] - orig.at(-1)[0], orig[0][1] - orig.at(-1)[1]) < 0.05) orig.pop();
  let cur = orig.map((point) => point.slice());
  const maxMove = 1.2;
  for (let pass = 0; pass < 4; pass++) {
    const next = cur.map((point, index) => {
      const count = cur.length;
      const around = [
        cur[(index - 2 + count) % count],
        cur[(index - 1 + count) % count],
        point,
        cur[(index + 1) % count],
        cur[(index + 2) % count],
      ];
      let x = (around[0][0] + around[1][0] + point[0] * 2 + around[3][0] + around[4][0]) / 6;
      let y = (around[0][1] + around[1][1] + point[1] * 2 + around[3][1] + around[4][1]) / 6;
      const dx = x - orig[index][0];
      const dy = y - orig[index][1];
      const dist = Math.hypot(dx, dy);
      if (dist > maxMove) {
        x = orig[index][0] + (dx / dist) * maxMove;
        y = orig[index][1] + (dy / dist) * maxMove;
      }
      return [x, y];
    });
    cur = next;
  }
  return cur;
}

const silhouette = sourcePoints();

function cubicPath(points) {
  const num = (value) => value.toFixed(2);
  const count = points.length;
  let d = `M${num(points[0][0])} ${num(points[0][1])}`;
  for (let index = 0; index < count; index++) {
    const p0 = points[(index - 1 + count) % count];
    const p1 = points[index];
    const p2 = points[(index + 1) % count];
    const p3 = points[(index + 2) % count];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${num(c1x)} ${num(c1y)} ${num(c2x)} ${num(c2y)} ${num(p2[0])} ${num(p2[1])}`;
  }
  return `${d}Z`;
}

const outline = cubicPath(silhouette.map(([x, y]) => [badgeLeft + x * badgeScale, badgeTop + y * badgeScale]));
const sourceOutline = cubicPath(silhouette);

function ruleHalf(simplified) {
  const outer = ((796 - 24) / 2) * badgeScale;
  return outer - (simplified ? 72 : 48);
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
  // Even gaps from the inner rim of the plateau, through both lines, to the rule.
  const cap = 32;
  const innerTop = badgeTop + 26;
  const gap = (dividerY - innerTop - cap * 2) / 3;
  const scale = cap / (outfit.capHeight || 700);
  const price = textPath(outfit, "PRICE", {
    cx: badgeCx,
    baseline: innerTop + gap + cap,
    cap,
    tracking: trackingFor(outfit, "PRICE", 250, scale),
  });
  const rangerLine = textPath(outfit, "RANGER", {
    cx: badgeCx,
    baseline: innerTop + gap * 2 + cap * 2,
    cap,
    tracking: trackingFor(outfit, "RANGER", 330, scale),
  });
  return `${price} ${rangerLine}`;
}

const banner = bannerText();

function stripeXs() {
  const gap = 28;
  const reach = 340 * badgeScale;
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
  // sealR is the outer ring's centerline, so the stroke's outer edge matches the reference.
  const rim = simplified ? 70 : 30;
  const outerRing = simplified ? 16 : 10;
  const innerRing = simplified ? 26 : 18;
  const ringGap = simplified ? 46 : 36;
  const sealR = sealOuterR - outerRing / 2;
  const innerEdge = sealR - ringGap - innerRing / 2;
  const figR = innerEdge - (simplified ? 4 : 8);
  return { rim, outerRing, innerRing, ringGap, sealR, sealCy: seal.cy, innerEdge, figR };
}

// Ink bounds of the ranger drawing (viewBox units). Spans are the bust cut,
// measured from the source path so the shirt extension welds to it.
const figInk = { left: 86.4, right: 834.3, top: 50.2, cut: 678, spans: [] };

{
  const probe = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="64.6 -28.1 792.5 792.5"><path fill="#fff" fill-rule="evenodd" d="${ranger}"/></svg>`;
  const probed = new Resvg(probe).render();
  const png = probed.asPng();
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pw = info.width;
  const ph = info.height;
  const sx = 792.5 / pw;
  const sy = 792.5 / ph;
  const vx = (px) => 64.6 + px * sx;
  const vy = (py) => -28.1 + py * sy;
  const bottom = new Array(pw).fill(-1);
  let yMax = -1;
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      if (data[(y * pw + x) * info.channels + 3] > 20) {
        bottom[x] = y;
        if (y > yMax) yMax = y;
      }
    }
  }
  figInk.cut = vy(yMax);
  const near = 16 / sy;
  const runs = [];
  let start = -1;
  for (let x = 0; x < pw; x++) {
    const on = bottom[x] >= 0 && yMax - bottom[x] <= near;
    if (on && start < 0) start = x;
    if (!on && start >= 0) {
      runs.push([start, x - 1]);
      start = -1;
    }
  }
  if (start >= 0) runs.push([start, pw - 1]);
  const merged = [];
  for (const run of runs) {
    const prev = merged.at(-1);
    if (prev && run[0] - prev[1] < 220) prev[1] = run[1];
    else merged.push(run.slice());
  }
  figInk.spans = merged
    .filter(([a, b]) => vx(b) - vx(a) > 22)
    .map(([a, b]) => {
      const edge = [];
      for (let x = a; x <= b; x += 3) {
        const onCut = bottom[x] >= 0 && yMax - bottom[x] <= near;
        const y = onCut ? bottom[x] : yMax;
        edge.push([vx(x), vy(y)]);
      }
      const endOn = bottom[b] >= 0 && yMax - bottom[b] <= near;
      edge.push([vx(b), vy(endOn ? bottom[b] : yMax)]);
      return { edge };
    });
}

function figureTransform(radius, cy) {
  const inkW = figInk.right - figInk.left;
  const scale = (radius * 1.58) / inkW;
  const hatTop = cy - radius * 0.9;
  const tx = seal.cx - ((figInk.left + figInk.right) / 2) * scale;
  const ty = hatTop - figInk.top * scale;
  return { transform: `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(5)})`, scale, ty };
}

function bustExtension(scale, ty, radius, cy) {
  const circleBottom = (cy + radius - ty) / scale + 70;
  const bottom = Math.max(circleBottom, figInk.cut + 260);
  const num = (value) => value.toFixed(1);
  const pieces = [];
  let widest = null;
  for (const span of figInk.spans) {
    const edge = span.edge;
    const top = edge.map(([x, y]) => [x, y - 12]);
    const left = top[0][0];
    const right = top[top.length - 1][0];
    const inset = Math.min(16, (right - left) * 0.04);
    let d = `M${num(top[0][0])} ${num(top[0][1])}`;
    for (const [x, y] of top.slice(1)) d += `L${num(x)} ${num(y)}`;
    d += `L${num(right - inset)} ${num(bottom)}L${num(left + inset)} ${num(bottom)}Z`;
    pieces.push(d);
    if (!widest || right - left > widest.right - widest.left) widest = { left, right, topY: Math.min(...edge.map((p) => p[1])) };
  }
  const frame = (x, y, w, h, t) =>
    `M${num(x)} ${num(y)}h${num(w)}v${num(h)}h${num(-w)}Z` +
    `M${num(x + t)} ${num(y + t)}h${num(w - 2 * t)}v${num(h - 2 * t)}h${num(-(w - 2 * t))}Z`;
  const button = (cx, y) => {
    const r = 15;
    const inner = 6;
    return (
      `M${num(cx - r)} ${num(y)}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0` +
      `M${num(cx - inner)} ${num(y)}a${inner} ${inner} 0 1 0 ${inner * 2} 0a${inner} ${inner} 0 1 0 ${-inner * 2} 0`
    );
  };
  // Pockets and buttons sit on the main torso span, below the old cut.
  const mid = (widest.left + widest.right) / 2;
  const pocketY = widest.topY + 28;
  const pocketW = Math.min(150, (widest.right - widest.left) * 0.28);
  const pocketH = 150;
  const detail =
    frame(mid - pocketW - 36, pocketY, pocketW, pocketH, 10) +
    frame(mid + 36, pocketY, pocketW, pocketH, 10) +
    `M${num(mid - 6)} ${num(widest.topY + 8)}h12V${num(bottom)}h-12Z` +
    [70, 150, 230, 310].map((dy) => button(mid, widest.topY + dy)).join("");
  return pieces.join("") + detail;
}

function figure(fill, radius, cy) {
  const { transform, scale, ty } = figureTransform(radius, cy);
  const extension = bustExtension(scale, ty, radius, cy);
  return `<g clip-path="url(#seal-clip)" transform="${transform}"><path fill="${fill}" fill-rule="evenodd" d="${ranger}"/><path fill="${fill}" fill-rule="evenodd" d="${extension}"/></g>`;
}

function emblem({ field, ink, stripe, sealFill, figureFill, simplified }) {
  const m = metrics(simplified);
  const stripeMarkup = simplified
    ? ""
    : `<g clip-path="url(#badge-clip)">${stripes(stripe, 8)}</g>`;
  const words = simplified ? "" : `<g clip-path="url(#badge-clip)"><path fill="${ink}" d="${banner}"/></g>`;
  const half = ruleHalf(simplified);
  const rule = `<line x1="${(badgeCx - half).toFixed(1)}" y1="${dividerY.toFixed(1)}" x2="${(badgeCx + half).toFixed(1)}" y2="${dividerY.toFixed(1)}" stroke="${ink}" stroke-width="${simplified ? 18 : 11}" stroke-linecap="butt"/>`;
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
  const { transform, scale, ty } = figureTransform(m.figR, m.sealCy);
  const extension = bustExtension(scale, ty, m.figR, m.sealCy);
  const words = simplified ? "" : `<path fill="#000" d="${banner}"/>`;
  const half = ruleHalf(simplified);
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
      <line x1="${(badgeCx - half).toFixed(1)}" y1="${dividerY.toFixed(1)}" x2="${(badgeCx + half).toFixed(1)}" y2="${dividerY.toFixed(1)}" stroke="#000" stroke-width="${simplified ? 18 : 11}" stroke-linecap="butt"/>
      ${words}
      <g clip-path="url(#seal-clip)" transform="${transform}"><path fill="#000" fill-rule="evenodd" d="${ranger}"/><path fill="#000" fill-rule="evenodd" d="${extension}"/></g>
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

const maskScale = 496 / srcH;
const maskOx = 62;
const maskOy = 57;
const maskW = 542;
const maskH = 606;
const fittedSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${maskW}" height="${maskH}" viewBox="0 0 ${maskW} ${maskH}"><g transform="translate(${maskOx} ${maskOy}) scale(${maskScale})"><path d="${sourceOutline}" fill="#fff"/></g></svg>`;
const fittedPng = new Resvg(fittedSvg, { fitTo: { mode: "width", value: maskW } }).render().asPng();
const fitted = await sharp(fittedPng).raw().toBuffer({ resolveWithObject: true });
const maskBuf = await sharp(resolve(root, "scripts/badge-silhouette/mask.png")).raw().toBuffer({ resolveWithObject: true });
const maskOn = new Uint8Array(maskW * maskH);
const pathOn = new Uint8Array(maskW * maskH);
let overlap = 0;
let either = 0;
for (let index = 0; index < maskW * maskH; index++) {
  const onMask = maskBuf.data[index * 3] > 127;
  const onPath = fitted.data[index * 4] > 127;
  maskOn[index] = onMask ? 1 : 0;
  pathOn[index] = onPath ? 1 : 0;
  if (onMask && onPath) overlap += 1;
  if (onMask || onPath) either += 1;
}
const iou = overlap / either;

function edgePoints(bits) {
  const points = [];
  for (let y = 1; y < maskH - 1; y++) {
    for (let x = 1; x < maskW - 1; x++) {
      const index = y * maskW + x;
      if (!bits[index]) continue;
      if (!bits[index - 1] || !bits[index + 1] || !bits[index - maskW] || !bits[index + maskW]) points.push([x, y]);
    }
  }
  return points;
}

function farthest(from, to) {
  const cell = 3;
  const buckets = new Map();
  for (const [x, y] of to) {
    const key = `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
    const list = buckets.get(key);
    if (list) list.push([x, y]);
    else buckets.set(key, [[x, y]]);
  }
  let max = 0;
  for (const [x, y] of from) {
    let best = 1e9;
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    for (let radius = 0; radius < 12 && best > radius * cell; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (radius && Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const list = buckets.get(`${cx + dx},${cy + dy}`);
          if (!list) continue;
          for (const [qx, qy] of list) best = Math.min(best, (qx - x) ** 2 + (qy - y) ** 2);
        }
      }
    }
    max = Math.max(max, Math.sqrt(best));
  }
  return max;
}

const maskEdge = edgePoints(maskOn);
const pathEdge = edgePoints(pathOn);
const edgePx = Math.max(farthest(maskEdge, pathEdge), farthest(pathEdge, maskEdge));
const edgeLimit = 0.005 * 496;
if (iou < 0.985 || edgePx > edgeLimit) {
  throw new Error(`Silhouette fit IoU ${iou.toFixed(4)}, edge ${edgePx.toFixed(2)}px, limit ${edgeLimit.toFixed(2)}px`);
}

const strokeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${maskW}" height="${maskH}" viewBox="0 0 ${maskW} ${maskH}"><g transform="translate(${maskOx} ${maskOy}) scale(${maskScale})"><path d="${sourceOutline}" fill="none" stroke="#ff2bd6" stroke-width="7" stroke-linejoin="round"/></g></svg>`;
const strokePng = new Resvg(strokeSvg, { fitTo: { mode: "width", value: maskW } }).render().asPng();
const maskGold = await sharp(resolve(root, "scripts/badge-silhouette/mask.png"))
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const gold = Buffer.alloc(maskW * maskH * 4);
for (let index = 0; index < maskW * maskH; index++) {
  const on = maskGold.data[index * 3] > 127;
  gold[index * 4] = on ? 194 : 244;
  gold[index * 4 + 1] = on ? 163 : 241;
  gold[index * 4 + 2] = on ? 106 : 234;
  gold[index * 4 + 3] = 255;
}
const silhouettePng = await sharp(gold, { raw: { width: maskW, height: maskH, channels: 4 } }).png().toBuffer();
await sharp(silhouettePng)
  .composite([{ input: strokePng }])
  .resize(maskW * 2, maskH * 2)
  .png()
  .toFile("/tmp/outline-overlay.png");

console.log(files.join("\n"));
console.log("contact sheet", sheetW, "x", bandY);
console.log(`silhouette IoU ${iou.toFixed(4)}, max edge ${edgePx.toFixed(2)}px (limit ${edgeLimit.toFixed(2)})`);
