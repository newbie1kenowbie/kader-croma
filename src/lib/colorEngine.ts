import { HistogramData, HSLColorKey, PresetAdjustments, ToneCurvePoint } from '../types/preset';

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function buildToneCurveLut(points: ToneCurvePoint[]): Uint8Array {
  const lut = new Uint8Array(256);
  const sorted = [...points].sort((a, b) => a.x - b.x);
  if (sorted.length < 2) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }

  for (let x = 0; x < 256; x++) {
    if (x <= sorted[0].x) {
      lut[x] = clampByte(Math.round(sorted[0].y));
      continue;
    }
    if (x >= sorted[sorted.length - 1].x) {
      lut[x] = clampByte(Math.round(sorted[sorted.length - 1].y));
      continue;
    }

    // Find segment
    let seg = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      if (x >= sorted[i].x && x <= sorted[i + 1].x) {
        seg = i;
        break;
      }
    }

    // Catmull-Rom smooth spline interpolation
    const p0 = sorted[Math.max(0, seg - 1)];
    const p1 = sorted[seg];
    const p2 = sorted[seg + 1];
    const p3 = sorted[Math.min(sorted.length - 1, seg + 2)];

    const dx = p2.x - p1.x;
    const t = dx === 0 ? 0 : (x - p1.x) / dx;
    const t2 = t * t;
    const t3 = t2 * t;

    const y =
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

    lut[x] = clampByte(Math.round(y));
  }

  return lut;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return [hue2rgb(hue + 1 / 3), hue2rgb(hue), hue2rgb(hue - 1 / 3)];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = r > g ? (r > b ? r : b) : g > b ? g : b;
  const min = r < g ? (r < b ? r : b) : g < b ? g : b;
  const l = (max + min) * 0.5;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) {
    h = (g - b) / d + (g < b ? 6 : 0);
  } else if (max === g) {
    h = (b - r) / d + 2;
  } else {
    h = (r - g) / d + 4;
  }
  return [h * 60, s, l];
}

// Lightroom 8-channel hue centers in degrees
const CHANNEL_CENTERS: Array<{ key: HSLColorKey; center: number; width: number }> = [
  { key: 'red', center: 0, width: 32 },
  { key: 'orange', center: 30, width: 28 },
  { key: 'yellow', center: 60, width: 32 },
  { key: 'green', center: 120, width: 48 },
  { key: 'aqua', center: 180, width: 36 },
  { key: 'blue', center: 230, width: 42 },
  { key: 'purple', center: 278, width: 32 },
  { key: 'magenta', center: 322, width: 34 },
];

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// Fast separable box blur for local contrast (Clarity / Texture)
function boxBlurLuminance(lum: Float32Array, w: number, h: number, radius: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const div = radius * 2 + 1;

  for (let y = 0; y < h; y++) {
    const rowOffset = y * w;
    let sum = 0;
    for (let i = -radius; i <= radius; i++) {
      const idx = Math.max(0, Math.min(w - 1, i));
      sum += lum[rowOffset + idx];
    }
    for (let x = 0; x < w; x++) {
      tmp[rowOffset + x] = sum / div;
      const removeIdx = Math.max(0, x - radius);
      const addIdx = Math.min(w - 1, x + radius + 1);
      sum += lum[rowOffset + addIdx] - lum[rowOffset + removeIdx];
    }
  }

  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let i = -radius; i <= radius; i++) {
      const idy = Math.max(0, Math.min(h - 1, i));
      sum += tmp[idy * w + x];
    }
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / div;
      const removeIdx = Math.max(0, y - radius);
      const addIdx = Math.min(h - 1, y + radius + 1);
      sum += tmp[addIdx * w + x] - tmp[removeIdx * w + x];
    }
  }

  return out;
}

export function applyPresetToImageData(
  source: ImageData,
  adj: PresetAdjustments
): { graded: ImageData; histogram: HistogramData } {
  const { width, height, data } = source;
  const outData = new Uint8ClampedArray(data.length);

  // Precompute parameters
  const expGain = Math.pow(2, adj.exposure * 0.72);
  const tempShift = adj.temperature / 100; // warm (+R, -B) or cool (-R, +B)
  const tintShift = adj.tint / 100;        // magenta (+R/+B, -G) or green (+G)
  const contrastFactor = 1 + (adj.contrast / 100) * 0.65;
  const dehazeAmt = adj.dehaze / 100;
  const highlightsAmt = adj.highlights / 100;
  const shadowsAmt = adj.shadows / 100;
  const whitesAmt = adj.whites / 100;
  const blacksAmt = adj.blacks / 100;
  const vibranceAmt = adj.vibrance / 100;
  const satAmt = adj.saturation / 100;

  const curveLut = buildToneCurveLut(adj.toneCurve);

  // Precompute Color Grading RGB tints
  const shadowRgb = hslToRgb(adj.colorGrading.shadows.hue, 1, 0.5);
  const shadowStrength = (adj.colorGrading.shadows.saturation / 100) * 0.36;
  const shadowLum = (adj.colorGrading.shadows.luminance / 100) * 0.14;

  const midRgb = hslToRgb(adj.colorGrading.midtones.hue, 1, 0.5);
  const midStrength = (adj.colorGrading.midtones.saturation / 100) * 0.28;
  const midLum = (adj.colorGrading.midtones.luminance / 100) * 0.12;

  const hiRgb = hslToRgb(adj.colorGrading.highlights.hue, 1, 0.5);
  const hiStrength = (adj.colorGrading.highlights.saturation / 100) * 0.34;
  const hiLum = (adj.colorGrading.highlights.luminance / 100) * 0.14;

  const balanceShift = (adj.colorGrading.balance / 100) * 0.25;

  // Check if HSL mixer has any non-zero edits
  const hasHsl = CHANNEL_CENTERS.some(({ key }) => {
    const c = adj.hsl[key];
    return c.hue !== 0 || c.saturation !== 0 || c.luminance !== 0;
  });

  // Check if clarity/texture local contrast is needed
  const clarityAmt = (adj.clarity * 0.65 + adj.texture * 0.35) / 100;
  let highPass: Float32Array | null = null;
  if (Math.abs(clarityAmt) > 0.02) {
    const lumArr = new Float32Array(width * height);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      lumArr[p] = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
    }
    const radius = Math.max(3, Math.round(Math.min(width, height) * 0.015));
    const blurred = boxBlurLuminance(lumArr, width, height, radius);
    highPass = new Float32Array(width * height);
    for (let p = 0; p < lumArr.length; p++) {
      highPass[p] = lumArr[p] - blurred[p];
    }
  }

  const bins = 64;
  const histR = new Array<number>(bins).fill(0);
  const histG = new Array<number>(bins).fill(0);
  const histB = new Array<number>(bins).fill(0);
  const histL = new Array<number>(bins).fill(0);

  const halfW = width * 0.5;
  const halfH = height * 0.5;
  const vigAmt = adj.vignetteAmount / 100;
  const grainAmt = (adj.grainAmount / 100) * 28;
  const grainScale = adj.grainSize > 45 ? 2 : 1;

  // Deterministic fast PRNG for clean grain texture without flickering jitter across unrelated sliders
  let seed = 133742;

  for (let y = 0; y < height; y++) {
    const ny = (y - halfH) / halfH;
    const ny2 = ny * ny;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const pIdx = y * width + x;

      // 1. Normalize + Exposure + White Balance
      let r = (data[idx] / 255) * expGain;
      let g = (data[idx + 1] / 255) * expGain;
      let b = (data[idx + 2] / 255) * expGain;

      // White balance temperature & tint
      r *= 1 + tempShift * 0.24 + tintShift * 0.1;
      g *= 1 - tintShift * 0.15;
      b *= 1 - tempShift * 0.24 + tintShift * 0.1;

      // Soft highlight rolloff (filmic shoulder before clipping)
      r = r > 0.85 ? 0.85 + (r - 0.85) / (1 + (r - 0.85) * 1.6) : r;
      g = g > 0.85 ? 0.85 + (g - 0.85) / (1 + (g - 0.85) * 1.6) : g;
      b = b > 0.85 ? 0.85 + (b - 0.85) / (1 + (b - 0.85) * 1.6) : b;

      r = clamp01(r);
      g = clamp01(g);
      b = clamp01(b);

      // 2. Dehaze (black-point compression + saturation boost)
      if (dehazeAmt !== 0) {
        if (dehazeAmt > 0) {
          const blackCut = dehazeAmt * 0.08;
          r = clamp01((r - blackCut) / (1 - blackCut));
          g = clamp01((g - blackCut) / (1 - blackCut));
          b = clamp01((b - blackCut) / (1 - blackCut));
        } else {
          const hazeLift = -dehazeAmt * 0.14;
          r = clamp01(r * (1 - hazeLift) + hazeLift);
          g = clamp01(g * (1 - hazeLift) + hazeLift);
          b = clamp01(b * (1 - hazeLift) + hazeLift);
        }
      }

      // 3. Highlights, Shadows, Whites, Blacks
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const shadowWeight = Math.pow(1 - lum, 2.2);
      const highlightWeight = Math.pow(lum, 2.0);
      const blackWeight = Math.pow(1 - lum, 4.0);
      const whiteWeight = Math.pow(lum, 3.6);

      const toneDelta =
        shadowsAmt * 0.32 * shadowWeight +
        highlightsAmt * 0.34 * highlightWeight +
        blacksAmt * 0.22 * blackWeight +
        whitesAmt * 0.22 * whiteWeight;

      if (toneDelta !== 0) {
        const scale = lum > 0.005 ? clamp01(lum + toneDelta) / lum : 1;
        if (lum <= 0.005 && toneDelta > 0) {
          r += toneDelta * 0.6;
          g += toneDelta * 0.6;
          b += toneDelta * 0.6;
        } else {
          r = clamp01(r * scale);
          g = clamp01(g * scale);
          b = clamp01(b * scale);
        }
      }

      // 4. Contrast S-curve
      if (contrastFactor !== 1) {
        r = clamp01((r - 0.5) * contrastFactor + 0.5);
        g = clamp01((g - 0.5) * contrastFactor + 0.5);
        b = clamp01((b - 0.5) * contrastFactor + 0.5);
      }

      // 5. Local Clarity / Texture
      if (highPass !== null) {
        const hp = highPass[pIdx] * clarityAmt * 1.45;
        r = clamp01(r + hp);
        g = clamp01(g + hp);
        b = clamp01(b + hp);
      }

      // 6. RGB Tone Curve LUT
      r = curveLut[Math.round(r * 255)] / 255;
      g = curveLut[Math.round(g * 255)] / 255;
      b = curveLut[Math.round(b * 255)] / 255;

      // 7. HSL Color Mixer + Vibrance + Saturation
      if (hasHsl || vibranceAmt !== 0 || satAmt !== 0) {
        let [h, s, l] = rgbToHsl(r, g, b);

        if (hasHsl && s > 0.015) {
          let dh = 0;
          let ds = 0;
          let dl = 0;
          for (let c = 0; c < CHANNEL_CENTERS.length; c++) {
            const ch = CHANNEL_CENTERS[c];
            const dist = hueDistance(h, ch.center);
            if (dist < ch.width) {
              const weight = 0.5 * (1 + Math.cos((Math.PI * dist) / ch.width));
              const adjCh = adj.hsl[ch.key];
              dh += (adjCh.hue / 100) * 32 * weight;
              ds += (adjCh.saturation / 100) * weight;
              dl += (adjCh.luminance / 100) * 0.24 * weight;
            }
          }
          h = (h + dh + 360) % 360;
          s = clamp01(s * (1 + ds));
          l = clamp01(l + dl * Math.min(1, s * 2.5));
        }

        // Vibrance (boosts muted tones while protecting skin-ish orange hues)
        if (vibranceAmt !== 0) {
          const skinProtect = hueDistance(h, 28) < 28 ? 0.55 : 1.0;
          const vibBoost = vibranceAmt * (1 - s) * 0.75 * skinProtect;
          s = clamp01(s + vibBoost * s * 1.6 + (vibranceAmt > 0 ? vibBoost * 0.15 : 0));
        }

        // Global Saturation
        if (satAmt !== 0) {
          s = clamp01(s * (1 + satAmt));
        }

        [r, g, b] = hslToRgb(h, s, l);
      }

      // 8. 3-Way Color Grading (Shadows / Midtones / Highlights)
      if (shadowStrength > 0 || midStrength > 0 || hiStrength > 0 || shadowLum !== 0 || midLum !== 0 || hiLum !== 0) {
        const lAfter = clamp01(0.2126 * r + 0.7152 * g + 0.0722 * b - balanceShift);
        const wShadow = Math.pow(1 - lAfter, 2.0);
        const wHi = Math.pow(lAfter, 2.0);
        const wMid = Math.max(0, 1 - Math.abs(lAfter - 0.5) * 2.1);

        r = clamp01(
          r +
            (shadowRgb[0] - 0.5) * shadowStrength * wShadow +
            (midRgb[0] - 0.5) * midStrength * wMid +
            (hiRgb[0] - 0.5) * hiStrength * wHi +
            shadowLum * wShadow +
            midLum * wMid +
            hiLum * wHi
        );
        g = clamp01(
          g +
            (shadowRgb[1] - 0.5) * shadowStrength * wShadow +
            (midRgb[1] - 0.5) * midStrength * wMid +
            (hiRgb[1] - 0.5) * hiStrength * wHi +
            shadowLum * wShadow +
            midLum * wMid +
            hiLum * wHi
        );
        b = clamp01(
          b +
            (shadowRgb[2] - 0.5) * shadowStrength * wShadow +
            (midRgb[2] - 0.5) * midStrength * wMid +
            (hiRgb[2] - 0.5) * hiStrength * wHi +
            shadowLum * wShadow +
            midLum * wMid +
            hiLum * wHi
        );
      }

      // 9. Post-Crop Vignette
      if (vigAmt !== 0) {
        const nx = (x - halfW) / halfW;
        const distSq = nx * nx + ny2;
        const vigFactor = Math.max(0, (distSq - 0.35) / 1.45);
        const vigDelta = vigAmt * vigFactor * 0.55;
        r = clamp01(r * (1 + vigDelta));
        g = clamp01(g * (1 + vigDelta));
        b = clamp01(b * (1 + vigDelta));
      }

      // 10. Film Grain
      let r255 = r * 255;
      let g255 = g * 255;
      let b255 = b * 255;

      if (grainAmt > 0.5) {
        if (grainScale === 1 || (x % 2 === 0 && y % 2 === 0)) {
          seed = (seed * 1664525 + 1013904223) >>> 0;
        }
        const noise = ((seed & 0xffff) / 65535 - 0.5) * grainAmt;
        const midWeight = 1 - Math.abs((r + g + b) / 3 - 0.5) * 0.9;
        const grain = noise * midWeight;
        r255 += grain;
        g255 += grain;
        b255 += grain;
      }

      const rb = clampByte(Math.round(r255));
      const gb = clampByte(Math.round(g255));
      const bb = clampByte(Math.round(b255));

      outData[idx] = rb;
      outData[idx + 1] = gb;
      outData[idx + 2] = bb;
      outData[idx + 3] = data[idx + 3];

      // Sample every 2nd pixel for histogram speed
      if ((pIdx & 1) === 0) {
        histR[rb >> 2]++;
        histG[gb >> 2]++;
        histB[bb >> 2]++;
        const lumByte = Math.round(0.2126 * rb + 0.7152 * gb + 0.0722 * bb);
        histL[clampByte(lumByte) >> 2]++;
      }
    }
  }

  // Normalize histogram to 0..1
  let maxBin = 1;
  for (let i = 1; i < bins - 1; i++) {
    if (histR[i] > maxBin) maxBin = histR[i];
    if (histG[i] > maxBin) maxBin = histG[i];
    if (histB[i] > maxBin) maxBin = histB[i];
  }
  const normalize = (arr: number[]) => arr.map((v) => Math.min(1, v / maxBin));

  return {
    graded: new ImageData(outData, width, height),
    histogram: {
      r: normalize(histR),
      g: normalize(histG),
      b: normalize(histB),
      l: normalize(histL),
    },
  };
}
