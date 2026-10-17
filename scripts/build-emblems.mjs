import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "public/brand/emblems");
const source = readFileSync(resolve(root, "public/images/logo-mark-light.svg"), "utf8");
const ranger = source.match(/\bd="([^"]+)"/)?.[1];
if (!ranger) throw new Error("Could not read the ranger path.");

const vb = { x: 64.6, y: -28.1, w: 792.5, h: 792.5 };

function place(box) {
  const scale = Math.min(box.w / vb.w, box.h / vb.h);
  const x = box.x + (box.w - vb.w * scale) / 2 - vb.x * scale;
  const y = box.y + (box.h - vb.h * scale) / 2 - vb.y * scale;
  return `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(5)})`;
}

const shapes = {
  shield: {
    name: "Shield",
    box: { x: 196, y: 132, w: 632, h: 560 },
    d: "M512 48C790 48 932 168 932 392C932 628 770 812 512 988C254 812 92 628 92 392C92 168 234 48 512 48Z",
  },
  round: {
    name: "Round patch",
    box: { x: 232, y: 196, w: 560, h: 560 },
    d: "M512 64A448 448 0 1 0 512 960A448 448 0 1 0 512 64Z",
  },
  badge: {
    name: "Ranger badge",
    box: { x: 248, y: 168, w: 528, h: 520 },
    d: "M512 36L744 132L948 292L892 548L736 748L512 996L288 748L132 548L76 292L280 132Z",
  },
};

const variants = {
  inverse: { label: "One color", field: "#F3EEE4", ink: null, stroke: 0 },
  dark: { label: "Dark backgrounds", field: "#132E24", ink: "#F3EEE4", stroke: 44 },
  light: { label: "Light backgrounds", field: "#FFFDF8", ink: "#1E4636", stroke: 56 },
};

function emblem(shape, variant) {
  const spec = variants[variant];
  const figure = shapes[shape];
  const transform = place(figure.box);
  const rangerPath = `<path fill-rule="evenodd" transform="${transform}" d="${ranger}"/>`;
  if (variant === "inverse") {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" role="img" aria-label="Price Ranger ${figure.name}, one color">
  <title>Price Ranger ${figure.name}, one color</title>
  <defs>
    <mask id="knockout" maskUnits="userSpaceOnUse">
      <rect width="1024" height="1024" fill="#fff"/>
      <path fill="#000" fill-rule="evenodd" transform="${transform}" d="${ranger}"/>
    </mask>
  </defs>
  <path fill="${spec.field}" mask="url(#knockout)" d="${figure.d}"/>
</svg>
`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" role="img" aria-label="Price Ranger ${figure.name}, ${spec.label.toLowerCase()}">
  <title>Price Ranger ${figure.name}, ${spec.label.toLowerCase()}</title>
  <path fill="${spec.field}" stroke="${spec.ink}" stroke-width="${spec.stroke}" stroke-linejoin="round" d="${figure.d}"/>
  <g fill="${spec.ink}">${rangerPath}</g>
</svg>
`;
}

mkdirSync(outDir, { recursive: true });
const files = [];
for (const shape of Object.keys(shapes)) {
  for (const variant of Object.keys(variants)) {
    const name = `${shape}-${variant}.svg`;
    writeFileSync(resolve(outDir, name), emblem(shape, variant));
    files.push(name);
  }
}

const backgrounds = [
  ["Green", "#1E4636", "#F3EEE4"],
  ["Dark", "#111111", "#F3EEE4"],
  ["White", "#FFFFFF", "#1C1915"],
  ["Tan", "#F3EEE4", "#1C1915"],
];

const cards = Object.keys(shapes)
  .map((shape) => {
    const cells = Object.keys(variants)
      .map((variant) => {
        const file = `${shape}-${variant}.png`;
        return `<figure>
          <img src="${file}" width="220" height="220" alt="${shapes[shape].name}, ${variants[variant].label}">
          <figcaption>${shapes[shape].name}<br>${variants[variant].label}</figcaption>
        </figure>`;
      })
      .join("\n");
    return `<div class="row">${cells}</div>`;
  })
  .join("\n");

const bands = backgrounds
  .map(
    ([name, bg, fg]) => `<section style="background:${bg};color:${fg}">
      <h2>${name}</h2>
      ${cards}
    </section>`,
  )
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Price Ranger emblem options</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #fffdf8; color: #1c1915; font-family: Georgia, "Iowan Old Style", serif; }
    header { padding: 36px 40px 12px; }
    h1 { margin: 0; font-size: 40px; font-weight: 600; }
    header p { max-width: 46rem; font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.5; }
    section { padding: 28px 40px 36px; }
    h2 { margin: 0 0 18px; font-size: 22px; letter-spacing: 0.04em; text-transform: uppercase; }
    .row { display: flex; gap: 28px; margin-bottom: 18px; }
    figure { margin: 0; width: 220px; text-align: center; }
    img { display: block; width: 220px; height: 220px; }
    figcaption { margin-top: 8px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.35; }
  </style>
</head>
<body>
  <header>
    <h1>Price Ranger emblem options</h1>
    <p>Three badge shapes for the flat-bottomed ranger. Each one is shown as a one-color knockout, a two-color mark for dark backgrounds, and a two-color mark for light backgrounds including the brand tan. These are proposals. The app logo is unchanged.</p>
  </header>
  ${bands}
</body>
</html>
`;

writeFileSync(resolve(outDir, "contact-sheet.html"), html);
console.log(files.join("\n"));
