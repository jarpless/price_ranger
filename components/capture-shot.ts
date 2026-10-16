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

async function raster(node: HTMLElement, width: number, height: number): Promise<string> {
  const { toPng } = await import("html-to-image");
  return toPng(node, {
    pixelRatio: 1,
    cacheBust: true,
    width,
    height,
    canvasWidth: width,
    canvasHeight: height,
    style: {
      overflow: "visible",
      height: `${height}px`,
      maxHeight: "none",
      width: `${width}px`,
    },
    filter: (candidate) => !(candidate instanceof HTMLElement && candidate.dataset.feedbackChrome === "true"),
  });
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
  const { toPng } = await import("html-to-image");
  const dataUrl = await toPng(document.body, {
    pixelRatio: 1,
    cacheBust: true,
    filter: (node) => !(node instanceof HTMLElement && node.dataset.feedbackChrome === "true"),
  });
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const canvas = document.createElement("canvas");
  if (!box) {
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not take a screenshot.");
    context.drawImage(image, 0, 0);
  } else {
    const scaleX = image.width / window.innerWidth;
    const scaleY = image.height / window.innerHeight;
    canvas.width = Math.max(1, Math.round(box.w * scaleX));
    canvas.height = Math.max(1, Math.round(box.h * scaleY));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not crop the screenshot.");
    context.drawImage(
      image,
      box.x * scaleX,
      box.y * scaleY,
      box.w * scaleX,
      box.h * scaleY,
      0,
      0,
      canvas.width,
      canvas.height,
    );
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
