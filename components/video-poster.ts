/** A JPEG frame from the start of a clip, so the carousel can show the video before it plays. */
export function posterFromVideo(file: File): Promise<File | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    const finish = (result: File | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
      resolve(result);
    };
    const timer = window.setTimeout(() => finish(null), 2500);
    const draw = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) {
        finish(null);
        return;
      }
      const scale = Math.min(1, 960 / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        finish(null);
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          finish(blob && blob.size > 32 ? new File([blob], "poster.jpg", { type: "image/jpeg" }) : null);
        },
        "image/jpeg",
        0.8,
      );
    };
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onerror = () => finish(null);
    video.onloadeddata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      if (duration > 0.2) {
        video.currentTime = Math.min(0.25, duration / 3);
        return;
      }
      draw();
    };
    video.onseeked = () => draw();
    video.src = url;
  });
}
