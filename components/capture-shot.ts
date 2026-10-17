import { rewriteModernColor } from "@/lib/capture-color";

export interface DragBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CaptureMeasure {
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
  scrollLeft: number;
  scrollTop: number;
  left: number;
  top: number;
}

/** Full page size, and the box in that page's coordinates. The window height is not the page height. */
export function frameFor(box: DragBox, target: CaptureMeasure): { width: number; height: number; pageBox: DragBox } {
  return {
    width: Math.max(target.scrollWidth, target.clientWidth, 1),
    height: Math.max(target.scrollHeight, target.clientHeight, 1),
    pageBox: {
      x: box.x - target.left + target.scrollLeft,
      y: box.y - target.top + target.scrollTop,
      w: box.w,
      h: box.h,
    },
  };
}

function measureScroller(node: HTMLElement): CaptureMeasure {
  const rect = node.getBoundingClientRect();
  return {
    scrollWidth: node.scrollWidth,
    scrollHeight: node.scrollHeight,
    clientWidth: node.clientWidth,
    clientHeight: node.clientHeight,
    scrollLeft: node.scrollLeft,
    scrollTop: node.scrollTop,
    left: rect.left,
    top: rect.top,
  };
}

function pageScroller(): HTMLElement {
  const main = document.querySelector(".app-main");
  if (main instanceof HTMLElement) return main;
  return document.documentElement;
}

function strokeBox(context: CanvasRenderingContext2D, box: DragBox, scaleX: number, scaleY: number) {
  context.strokeStyle = "#e10600";
  context.lineWidth = Math.max(2, Math.round(2 * Math.max(scaleX, scaleY)));
  context.strokeRect(box.x * scaleX, box.y * scaleY, Math.max(1, box.w * scaleX), Math.max(1, box.h * scaleY));
}

async function canvasShot(canvas: HTMLCanvasElement): Promise<{ blob: Blob; preview: string }> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not save the screenshot.");
  return { blob, preview: canvas.toDataURL("image/png") };
}

function cssToHex(expr: string, probe: CanvasRenderingContext2D): string {
  const sentinel = "#010203";
  probe.fillStyle = sentinel;
  try {
    probe.fillStyle = expr;
  } catch {
    return expr;
  }
  const painted = String(probe.fillStyle);
  if (painted === sentinel || /oklch|oklab|color-mix|\blab\(|\blch\(|\bcolor\(/i.test(painted)) return expr;
  return painted;
}

function srgbStyles(style: CSSStyleDeclaration, probe: CanvasRenderingContext2D): CSSStyleDeclaration {
  const rewrite = (value: string) => rewriteModernColor(value, (expr) => cssToHex(expr, probe));
  return new Proxy(style, {
    get(target, prop) {
      if (prop === "getPropertyValue") {
        return (name: string) => {
          if (name === "content-visibility") return "visible";
          return rewrite(target.getPropertyValue(name));
        };
      }
      if (prop === "cssText") return rewrite(target.cssText);
      const value = Reflect.get(target, prop, target);
      if (typeof value === "function") return value.bind(target);
      if (typeof value === "string") return rewrite(value);
      return value;
    },
  });
}

async function withSrgbStyles<T>(run: () => Promise<T>): Promise<T> {
  const view = window;
  const original = view.getComputedStyle;
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return run();
  view.getComputedStyle = function (node: Element, pseudo?: string | null) {
    return srgbStyles(original.call(view, node, pseudo), probe);
  } as typeof window.getComputedStyle;
  try {
    return await run();
  } finally {
    view.getComputedStyle = original;
  }
}

function canvasIsFlat(canvas: HTMLCanvasElement): boolean {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || canvas.width < 2 || canvas.height < 2) return true;
  let min = 255 * 3;
  let max = 0;
  const sample = 20;
  try {
    for (let y = 0; y < sample; y += 1) {
      for (let x = 0; x < sample; x += 1) {
        const pixel = context.getImageData(
          Math.min(canvas.width - 1, Math.floor(((x + 0.5) * canvas.width) / sample)),
          Math.min(canvas.height - 1, Math.floor(((y + 0.5) * canvas.height) / sample)),
          1,
          1,
        ).data;
        const sum = (pixel[0] || 0) + (pixel[1] || 0) + (pixel[2] || 0);
        if (sum < min) min = sum;
        if (sum > max) max = sum;
      }
    }
  } catch {
    return false;
  }
  return max - min < 18;
}

function canvasIsExportable(canvas: HTMLCanvasElement): boolean {
  try {
    canvas.getContext("2d")?.getImageData(0, 0, 1, 1);
    return true;
  } catch {
    return false;
  }
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = "async";
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not take a screenshot."));
  });
  image.src = url;
  await loaded;
  return image;
}

function paintImage(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, image.naturalWidth || image.width);
  canvas.height = Math.max(1, image.naturalHeight || image.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not take a screenshot.");
  context.fillStyle = "#f3eee4";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);
  return canvas;
}

async function drawSvg(svgUrl: string): Promise<HTMLCanvasElement> {
  const encoded = svgUrl.slice(svgUrl.indexOf(",") + 1);
  const svg = decodeURIComponent(encoded);
  const blobUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    // A blob paints on iOS, where a data URL of the same SVG comes out blank.
    // Chrome taints that blob, so fall back to the data URL when the canvas cannot be read.
    const viaBlob = paintImage(await loadImage(blobUrl));
    if (canvasIsExportable(viaBlob)) return viaBlob;
  } catch {
    // The data URL below is the other way to draw the same picture.
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
  return paintImage(await loadImage(svgUrl));
}

const CAPTURE_LAYOUT = "[data-app-shell], .ask-lane, .app-main, .shell-main";

/** Let the main column paint. Overflow clipping and container queries leave it blank next to the sidebar. */
function relaxCaptureLayout(): () => void {
  const nodes = [...document.querySelectorAll(CAPTURE_LAYOUT)].filter((node): node is HTMLElement => node instanceof HTMLElement);
  const saved = nodes.map((node) => ({ node, cssText: node.style.cssText }));
  for (const node of nodes) {
    node.style.setProperty("overflow", "visible", "important");
    node.style.setProperty("max-height", "none", "important");
    node.style.setProperty("max-width", "none", "important");
    node.style.setProperty("container-type", "normal", "important");
    if (node.classList.contains("app-main") || node.classList.contains("ask-lane")) {
      const height = Math.max(node.scrollHeight, node.getBoundingClientRect().height, 1);
      node.style.setProperty("min-height", `${height}px`, "important");
    }
  }
  return () => {
    for (const item of saved) item.node.style.cssText = item.cssText;
  };
}

export function sampleSpread(values: number[]): number {
  if (values.length === 0) return 0;
  let min = values[0] ?? 0;
  let max = values[0] ?? 0;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return max - min;
}

function regionSpread(canvas: HTMLCanvasElement, box: { x: number; y: number; w: number; h: number }): number {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || box.w < 8 || box.h < 8) return 255;
  const values: number[] = [];
  const sample = 12;
  try {
    for (let y = 0; y < sample; y += 1) {
      for (let x = 0; x < sample; x += 1) {
        const px = Math.min(canvas.width - 1, Math.max(0, Math.floor(box.x + ((x + 0.5) * box.w) / sample)));
        const py = Math.min(canvas.height - 1, Math.max(0, Math.floor(box.y + ((y + 0.5) * box.h) / sample)));
        const pixel = context.getImageData(px, py, 1, 1).data;
        values.push((pixel[0] || 0) + (pixel[1] || 0) + (pixel[2] || 0));
      }
    }
  } catch {
    return 255;
  }
  return sampleSpread(values);
}

async function paintElement(
  node: HTMLElement,
  extra: { width?: number; height?: number; style?: Partial<CSSStyleDeclaration>; skipFonts?: boolean },
): Promise<HTMLCanvasElement> {
  const restore = relaxCaptureLayout();
  const { toSvg } = await import("html-to-image");
  try {
  const svgUrl = await withSrgbStyles(() =>
    toSvg(node, {
      pixelRatio: 1,
      cacheBust: false,
      backgroundColor: "#f3eee4",
      skipFonts: extra.skipFonts,
      width: extra.width,
      height: extra.height,
      style: extra.style,
      filter: (candidate) => !(candidate instanceof HTMLElement && candidate.dataset.feedbackChrome === "true"),
    }),
  );
  return drawSvg(svgUrl);
  } finally {
    restore();
  }
}

async function paintMainIfBlank(canvas: HTMLCanvasElement, target: HTMLElement): Promise<HTMLCanvasElement> {
  const main = document.querySelector(".app-main");
  if (!(main instanceof HTMLElement) || main === target) return canvas;
  const targetRect = target.getBoundingClientRect();
  const mainRect = main.getBoundingClientRect();
  const scaleX = canvas.width / Math.max(1, targetRect.width);
  const scaleY = canvas.height / Math.max(1, targetRect.height);
  const box = {
    x: (mainRect.left - targetRect.left) * scaleX,
    y: (mainRect.top - targetRect.top) * scaleY,
    w: mainRect.width * scaleX,
    h: mainRect.height * scaleY,
  };
  if (regionSpread(canvas, box) >= 18) return canvas;
  const mainCanvas = await paintElement(main, {
    width: Math.max(main.scrollWidth, main.clientWidth, 1),
    height: Math.max(main.scrollHeight, main.clientHeight, mainRect.height, 1),
  });
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  context.drawImage(mainCanvas, box.x, box.y, Math.max(1, box.w), Math.max(1, box.h));
  return canvas;
}

async function raster(node: HTMLElement, width: number, height: number): Promise<string> {
  const style = {
    overflow: "visible",
    height: `${height}px`,
    maxHeight: "none",
    width: `${width}px`,
  };
  let canvas = await paintElement(node, { width, height, style });
  if (canvasIsFlat(canvas)) canvas = await paintElement(node, { width, height, style, skipFonts: true });
  if (canvasIsFlat(canvas)) throw new Error("Could not capture this screen.");
  return canvas.toDataURL("image/png");
}

/** Full page, with the selected box stroked in red. The live chrome is left out of the image. */
export async function captureAnnotated(box: DragBox): Promise<{ blob: Blob; preview: string }> {
  const target = pageScroller();
  const frame = frameFor(box, measureScroller(target));
  const lane = target.closest(".ask-lane");
  const previous = {
    height: target.style.height,
    maxHeight: target.style.maxHeight,
    overflow: target.style.overflow,
  };
  const lanePrevious = lane instanceof HTMLElement ? { height: lane.style.height, overflow: lane.style.overflow } : null;
  target.style.overflow = "visible";
  target.style.maxHeight = "none";
  target.style.height = `${frame.height}px`;
  if (lane instanceof HTMLElement) {
    lane.style.overflow = "visible";
    lane.style.height = "auto";
  }
  try {
    const dataUrl = await raster(target, frame.width, frame.height);
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    if (image.height + 8 < frame.height) {
      throw new Error("Could not capture the full page.");
    }
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not take a screenshot.");
    context.drawImage(image, 0, 0);
    const scaleX = image.width / Math.max(1, frame.width);
    const scaleY = image.height / Math.max(1, frame.height);
    strokeBox(context, frame.pageBox, scaleX, scaleY);
    return canvasShot(canvas);
  } finally {
    target.style.height = previous.height;
    target.style.maxHeight = previous.maxHeight;
    target.style.overflow = previous.overflow;
    if (lane instanceof HTMLElement && lanePrevious) {
      lane.style.height = lanePrevious.height;
      lane.style.overflow = lanePrevious.overflow;
    }
  }
}

export async function captureShot(box: DragBox | null): Promise<{ blob: Blob; preview: string }> {
  const shell = document.querySelector("[data-app-shell]");
  const target = shell instanceof HTMLElement ? shell : document.body;
  const width = Math.max(target.scrollWidth, target.clientWidth, window.innerWidth, 1);
  const height = Math.max(target.scrollHeight, target.clientHeight, window.innerHeight, 1);
  let canvas = await paintElement(target, { width, height });
  if (canvasIsFlat(canvas)) canvas = await paintElement(target, { width, height, skipFonts: true });
  canvas = await paintMainIfBlank(canvas, target);
  if (canvasIsFlat(canvas)) throw new Error("Could not capture this screen.");
  if (box) {
    const scaleX = canvas.width / window.innerWidth;
    const scaleY = canvas.height / window.innerHeight;
    const cropped = document.createElement("canvas");
    cropped.width = Math.max(1, Math.round(box.w * scaleX));
    cropped.height = Math.max(1, Math.round(box.h * scaleY));
    const context = cropped.getContext("2d");
    if (!context) throw new Error("Could not crop the screenshot.");
    context.drawImage(
      canvas,
      box.x * scaleX,
      box.y * scaleY,
      box.w * scaleX,
      box.h * scaleY,
      0,
      0,
      cropped.width,
      cropped.height,
    );
    canvas = cropped;
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not save the screenshot.");
  return { blob, preview: canvas.toDataURL("image/png") };
}

export function deviceId(): string {
  const key = "pr-device-id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID();
  window.localStorage.setItem(key, next);
  return next;
}
