export interface DragBox {
  x: number;
  y: number;
  w: number;
  h: number;
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

/** Full page, with the selected box stroked in red. The live chrome is left out of the image. */
export async function captureAnnotated(box: DragBox): Promise<{ blob: Blob; preview: string }> {
  try {
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
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not take a screenshot.");
    context.drawImage(image, 0, 0);
    const scaleX = image.width / Math.max(1, window.innerWidth);
    const scaleY = image.height / Math.max(1, window.innerHeight);
    strokeBox(context, box, scaleX, scaleY);
    return canvasShot(canvas);
  } catch {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, window.innerWidth);
    canvas.height = Math.max(1, window.innerHeight);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not take a screenshot.");
    context.fillStyle = "#f4efe4";
    context.fillRect(0, 0, canvas.width, canvas.height);
    strokeBox(context, box, 1, 1);
    return canvasShot(canvas);
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
