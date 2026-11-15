// Real, local image checks for an uploaded ultrasound picture (runs in the browser, offline).
// Shrinks the image to ≤640 px, then measures the scan area only (near-black border ignored):
//   brightness = mean gray level, contrast = spread of gray levels, sharpness = mean edge strength.
// The backend decides what counts as too dark / blurry; these are just the measurements.
import { sha256 } from '../audit/sha256.js';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('This file is not an image the browser can open.'));
    img.src = src;
  });
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read the file.'));
    r.readAsDataURL(file);
  });
}

export async function imageStats(fileOrUrl) {
  const src = typeof fileOrUrl === 'string' ? fileOrUrl : await readAsDataUrl(fileOrUrl);
  const img = await loadImage(src);
  const k = Math.min(1, 640 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k));
  const h = Math.max(1, Math.round(img.naturalHeight * k));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i += 1) gray[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];

  let n = 0, sum = 0, sum2 = 0, lap = 0, nl = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const v = gray[y * w + x];
      if (v <= 4) continue; // outside the scan fan
      n += 1; sum += v; sum2 += v * v;
      if (x > 0 && y > 0 && x < w - 1 && y < h - 1) {
        const i = y * w + x;
        lap += Math.abs(4 * v - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w]);
        nl += 1;
      }
    }
  }
  const mean = n ? sum / n : 0;
  const dataUrl = c.toDataURL('image/jpeg', 0.82);
  return {
    dataUrl,
    width: img.naturalWidth,
    height: img.naturalHeight,
    brightness: +mean.toFixed(1),
    contrast: +(n ? Math.sqrt(Math.max(0, sum2 / n - mean * mean)) : 0).toFixed(1),
    sharpness: +(nl ? lap / nl : 0).toFixed(2),
    scanAreaPercent: Math.round((n / (w * h)) * 100),
    sha256: sha256(dataUrl),
  };
}
