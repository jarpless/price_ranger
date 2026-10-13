export interface DragBox {
  x: number;
  y: number;
  w: number;
  h: number;
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
