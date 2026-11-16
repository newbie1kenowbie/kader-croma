import {
  DEFAULT_ADJUSTMENTS,
  HSLColorKey,
  PresetAdjustments,
  ToneCurvePoint,
} from '../types/preset.ts';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function cloneAdj(adj: PresetAdjustments): PresetAdjustments {
  return JSON.parse(JSON.stringify(adj)) as PresetAdjustments;
}

export interface LocalTransformResult {
  name: string;
  description: string;
  reasoning: string;
  changedFields: string[];
  adjustments: PresetAdjustments;
}

/**
 * Local deterministic Dutch/English Lightroom prompt parser so users can adjust
 * presets via text prompts even without a Gemini API key or internet connection.
 */
export function transformPresetLocally(
  currentName: string,
  currentDescription: string,
  currentAdjustments: PresetAdjustments,
  prompt: string
): LocalTransformResult {
  const p = prompt.toLowerCase();
  const next = cloneAdj(currentAdjustments);
  const changes: string[] = [];
  let nextName = currentName;

  const note = (label: string, val: number, decimals = 0) => {
    const formatted = decimals > 0 ? val.toFixed(decimals) : Math.round(val).toString();
    changes.push(`${label} ${val > 0 ? '+' : ''}${formatted}`);
  };

  // Reset / neutral
  if (/\b(reset|neutraal|opnieuw|begin|vlak)\b/.test(p)) {
    return {
      name: 'Neutraal Basisprofiel',
      description: 'Teruggezet naar neutrale basisinstellingen.',
      reasoning: 'Lokale preset-engine (zonder API-sleutel): alle regelaars teruggezet naar neutraal.',
      changedFields: ['Reset naar 0'],
      adjustments: cloneAdj(DEFAULT_ADJUSTMENTS),
    };
  }

  // Black & white / monochrome
  if (/\b(zwart[-\s]?wit|monochroom|mono|black\s*&?\s*white|b&w|tri-x|zilvergelatine)\b/.test(p)) {
    next.saturation = -100;
    next.contrast = clamp(next.contrast + 26, -100, 100);
    next.clarity = clamp(next.clarity + 18, -100, 100);
    next.highlights = clamp(next.highlights - 18, -100, 100);
    next.blacks = clamp(next.blacks - 14, -100, 100);
    next.grainAmount = clamp(Math.max(next.grainAmount, 28), 0, 100);
    next.hsl.blue.luminance = clamp(next.hsl.blue.luminance - 20, -100, 100);
    next.hsl.orange.luminance = clamp(next.hsl.orange.luminance + 14, -100, 100);
    nextName = `${currentName.split(' (')[0]} (Zwart-Wit)`;
    changes.push('Verzadiging -100', `Contrast ${next.contrast}`, `Korrel ${next.grainAmount}`);
  }

  // Warm / golden hour / sunlight
  if (/\b(warm|warmer|gouden|golden|zonlicht|zon|amber|zomer|herfst)\b/.test(p)) {
    next.temperature = clamp(next.temperature + 14, -100, 100);
    next.tint = clamp(next.tint + 3, -100, 100);
    next.colorGrading.highlights.hue = 42;
    next.colorGrading.highlights.saturation = clamp(next.colorGrading.highlights.saturation + 14, 0, 100);
    next.colorGrading.balance = clamp(next.colorGrading.balance + 12, -100, 100);
    note('Temperatuur', next.temperature);
    changes.push(`Hooglicht-tint ${next.colorGrading.highlights.saturation}`);
  }

  // Cool / Nordic / moody blue / twilight
  if (/\b(koel|koeler|koud|scandinav|noords|blauw|cyaan|schemering|winter|nacht)\b/.test(p)) {
    next.temperature = clamp(next.temperature - 15, -100, 100);
    next.colorGrading.shadows.hue = 212;
    next.colorGrading.shadows.saturation = clamp(next.colorGrading.shadows.saturation + 18, 0, 100);
    next.colorGrading.balance = clamp(next.colorGrading.balance - 16, -100, 100);
    next.vibrance = clamp(next.vibrance - 10, -100, 100);
    note('Temperatuur', next.temperature);
    changes.push(`Schaduw-tint ${next.colorGrading.shadows.saturation}`);
  }

  // Portra / Kodak / analog film
  if (/\b(portra|kodak|analoog|film|filmisch|cinematic|cinema)\b/.test(p)) {
    next.highlights = clamp(next.highlights - 24, -100, 100);
    next.shadows = clamp(next.shadows + 22, -100, 100);
    next.clarity = clamp(next.clarity - 6, -100, 100);
    next.grainAmount = clamp(Math.max(next.grainAmount, 20), 0, 100);
    next.hsl.green.hue = clamp(next.hsl.green.hue - 18, -100, 100);
    next.hsl.green.saturation = clamp(next.hsl.green.saturation - 22, -100, 100);
    next.hsl.orange.luminance = clamp(next.hsl.orange.luminance + 8, -100, 100);
    // Lift matte black point slightly
    if (next.toneCurve.length > 0 && next.toneCurve[0].y < 16) {
      next.toneCurve[0].y = 16;
    }
    note('Hooglichten', next.highlights);
    note('Schaduwen', next.shadows);
    changes.push(`Korrel ${next.grainAmount}`);
  }

  // Matte / faded / deep shadows / moody
  if (/\b(mat|matte|fade|faded|somber|moody|diep|dieper)\b/.test(p)) {
    if (next.toneCurve.length > 0) {
      next.toneCurve[0].y = clamp(Math.max(next.toneCurve[0].y, 20), 0, 42);
    }
    const lastIdx = next.toneCurve.length - 1;
    if (lastIdx > 0) {
      next.toneCurve[lastIdx].y = clamp(Math.min(next.toneCurve[lastIdx].y, 242), 215, 255);
    }
    next.blacks = clamp(next.blacks - 12, -100, 100);
    next.vignetteAmount = clamp(next.vignetteAmount - 14, -100, 100);
    changes.push(`Zwartlift ${next.toneCurve[0]?.y ?? 20}`, `Zwarte tinten ${next.blacks}`);
  }

  // Skin tones / portrait flattering
  if (/\b(huid|huidtint|portret|gezicht|flatter)\b/.test(p)) {
    next.hsl.orange.luminance = clamp(next.hsl.orange.luminance + 10, -100, 100);
    next.hsl.orange.saturation = clamp(next.hsl.orange.saturation - 8, -100, 100);
    next.hsl.red.saturation = clamp(next.hsl.red.saturation - 6, -100, 100);
    next.texture = clamp(next.texture - 10, -100, 100);
    changes.push('Oranje lum +10', 'Textuur ' + next.texture);
  }

  // Muted green / foliage
  if (/\b(groen|blad|natuur|bos|olijf|smaragd)\b/.test(p)) {
    const shiftDown = /\b(minder|demp|zacht|ingetogen|desatur|olijf)\b/.test(p);
    next.hsl.green.saturation = clamp(next.hsl.green.saturation + (shiftDown ? -28 : 15), -100, 100);
    next.hsl.green.hue = clamp(next.hsl.green.hue + (/\bolijf\b/.test(p) ? -28 : -14), -100, 100);
    next.hsl.yellow.saturation = clamp(next.hsl.yellow.saturation + (shiftDown ? -20 : 10), -100, 100);
    note('Groen verzadiging', next.hsl.green.saturation);
  }

  // Exposure brighter / darker
  if (/\b(lichter|helder|ophelderen|belicht|overbelicht|fris)\b/.test(p)) {
    next.exposure = Number(clamp(next.exposure + 0.3, -3, 3).toFixed(2));
    next.shadows = clamp(next.shadows + 16, -100, 100);
    note('Belichting', next.exposure, 2);
  } else if (/\b(donker|donkerder|onderbelicht|dramatisch)\b/.test(p)) {
    next.exposure = Number(clamp(next.exposure - 0.3, -3, 3).toFixed(2));
    next.highlights = clamp(next.highlights - 18, -100, 100);
    note('Belichting', next.exposure, 2);
  }

  // Contrast up / down
  if (/\b(meer contrast|hoger contrast|stevig contrast|contrastrijk|punch)\b/.test(p)) {
    next.contrast = clamp(next.contrast + 20, -100, 100);
    next.clarity = clamp(next.clarity + 10, -100, 100);
    note('Contrast', next.contrast);
  } else if (/\b(minder contrast|zachter contrast|zacht|soft|luchtig)\b/.test(p)) {
    next.contrast = clamp(next.contrast - 16, -100, 100);
    next.shadows = clamp(next.shadows + 14, -100, 100);
    next.highlights = clamp(next.highlights - 16, -100, 100);
    note('Contrast', next.contrast);
  }

  // Grain up / down
  if (/\b(minder korrel|geen korrel|schoon|clean|ruisvrij)\b/.test(p)) {
    next.grainAmount = 0;
    changes.push('Korrel 0');
  } else if (/\b(korrel|grain|ruis|korrelig)\b/.test(p)) {
    next.grainAmount = clamp(next.grainAmount + 18, 0, 100);
    changes.push(`Korrel ${next.grainAmount}`);
  }

  // Saturation / vibrance
  if (/\b(minder verzadig|desatur|ingetogen|pastel)\b/.test(p)) {
    next.saturation = clamp(next.saturation - 16, -100, 100);
    next.vibrance = clamp(next.vibrance - 10, -100, 100);
    note('Verzadiging', next.saturation);
  } else if (/\b(levendig|kleurrijk|verzadig|vibrant|pop)\b/.test(p)) {
    next.vibrance = clamp(next.vibrance + 18, -100, 100);
    note('Levendigheid', next.vibrance);
  }

  // Vignette
  if (/\b(vignet|randen donker)\b/.test(p)) {
    const remove = /\b(minder|geen|weg)\b/.test(p);
    next.vignetteAmount = remove ? 0 : clamp(next.vignetteAmount - 18, -100, 100);
    note('Vignet', next.vignetteAmount);
  }

  // Kodachrome / 70s vintage / retro
  if (/\b(kodachrome|70s|retro|vintage|roadtrip|warm analoog)\b/.test(p)) {
    next.temperature = clamp(next.temperature + 10, -100, 100);
    next.contrast = clamp(next.contrast + 18, -100, 100);
    next.highlights = clamp(next.highlights - 22, -100, 100);
    next.shadows = clamp(next.shadows + 14, -100, 100);
    next.hsl.red.saturation = clamp(next.hsl.red.saturation + 16, -100, 100);
    next.hsl.yellow.hue = clamp(next.hsl.yellow.hue - 16, -100, 100);
    next.hsl.green.hue = clamp(next.hsl.green.hue - 20, -100, 100);
    next.hsl.green.saturation = clamp(next.hsl.green.saturation - 18, -100, 100);
    next.colorGrading.shadows.hue = 38;
    next.colorGrading.shadows.saturation = 12;
    next.grainAmount = clamp(Math.max(next.grainAmount, 24), 0, 100);
    changes.push('Rood +16', `Contrast ${next.contrast}`, `Korrel ${next.grainAmount}`);
  }

  // Fujifilm Classic Chrome / documentary
  if (/\b(fuji|fujifilm|classic chrome|documentaire|reportage)\b/.test(p)) {
    next.contrast = clamp(next.contrast + 14, -100, 100);
    next.highlights = clamp(next.highlights - 28, -100, 100);
    next.shadows = clamp(next.shadows + 10, -100, 100);
    next.saturation = clamp(next.saturation - 14, -100, 100);
    next.hsl.aqua.hue = clamp(next.hsl.aqua.hue - 14, -100, 100);
    next.hsl.blue.saturation = clamp(next.hsl.blue.saturation - 18, -100, 100);
    next.hsl.green.saturation = clamp(next.hsl.green.saturation - 24, -100, 100);
    next.grainAmount = clamp(Math.max(next.grainAmount, 16), 0, 100);
    changes.push('Classic Chrome tint', `Verzadiging ${next.saturation}`, `Hooglichten ${next.highlights}`);
  }

  // Teal & Orange / cinema blockbuster
  if (/\b(teal|orange|oranje|bioscoop|blockbuster|neon|cyber)\b/.test(p)) {
    next.contrast = clamp(next.contrast + 20, -100, 100);
    next.highlights = clamp(next.highlights - 24, -100, 100);
    next.shadows = clamp(next.shadows + 18, -100, 100);
    next.hsl.aqua.hue = -16;
    next.hsl.blue.hue = -24;
    next.hsl.orange.saturation = clamp(next.hsl.orange.saturation + 18, -100, 100);
    next.colorGrading.shadows.hue = 194;
    next.colorGrading.shadows.saturation = 28;
    next.colorGrading.highlights.hue = 34;
    next.colorGrading.highlights.saturation = 22;
    changes.push('Teal schaduwen', 'Amber hooglichten', `Contrast ${next.contrast}`);
  }

  // Pastel / wedding / Japanese airy
  if (/\b(pastel|bruiloft|wedding|japans|luchtig|airy|dromerig)\b/.test(p)) {
    next.exposure = Number(clamp(next.exposure + 0.35, -3, 3).toFixed(2));
    next.contrast = clamp(next.contrast - 16, -100, 100);
    next.highlights = clamp(next.highlights - 30, -100, 100);
    next.shadows = clamp(next.shadows + 32, -100, 100);
    next.saturation = clamp(next.saturation - 12, -100, 100);
    next.clarity = clamp(next.clarity - 12, -100, 100);
    next.colorGrading.highlights.hue = 44;
    next.colorGrading.highlights.saturation = 10;
    note('Belichting', next.exposure, 2);
    changes.push(`Schaduwen ${next.shadows}`, `Helderheid ${next.clarity}`);
  }

  // Generic gentle polish if user wrote a custom phrase not matching keywords above
  if (changes.length === 0) {
    next.contrast = clamp(next.contrast + 8, -100, 100);
    next.highlights = clamp(next.highlights - 14, -100, 100);
    next.shadows = clamp(next.shadows + 14, -100, 100);
    next.vibrance = clamp(next.vibrance + 8, -100, 100);
    changes.push(
      `Contrast ${next.contrast}`,
      `Hooglichten ${next.highlights}`,
      `Schaduwen ${next.shadows}`,
      `Levendigheid ${next.vibrance}`
    );
  }

  const dedupedChanges = Array.from(new Set(changes)).slice(0, 6);

  return {
    name: nextName,
    description: currentDescription,
    reasoning: `Lokale preset-engine (zonder API-sleutel): stijl aangepast op basis van "${prompt.trim()}".`,
    changedFields: dedupedChanges,
    adjustments: next,
  };
}

export function createPresetLocally(prompt: string): LocalTransformResult {
  const cleaned = prompt.trim();
  const words = cleaned
    .replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  const generatedName = words.length > 0 ? words.join(' ') : 'Nieuwe AI Stijl';

  const result = transformPresetLocally(
    generatedName,
    `Nieuwe stijl gecreëerd op basis van: "${cleaned}".`,
    cloneAdj(DEFAULT_ADJUSTMENTS),
    cleaned
  );

  return {
    ...result,
    name: result.name === 'Neutraal Basisprofiel' ? generatedName : result.name,
    description: `Nieuwe stijl gecreëerd op basis van: "${cleaned}".`,
    reasoning: `Lokale preset-engine (zonder API-sleutel): nieuwe stijl vanaf nul opgebouwd voor "${cleaned}".`,
  };
}

/**
 * Client-side pixel-based reference photo style extraction when no Gemini API key is present.
 * Measures luminance percentiles, shadow/highlight RGB tinting, warmth, and saturation.
 */
export async function extractStyleFromPhotoLocally(
  dataUrl: string,
  customName?: string
): Promise<LocalTransformResult> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Kon de referentiefoto niet laden.'));
    el.src = dataUrl;
  });

  const sampleW = 160;
  const sampleH = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * sampleW));
  const canvas = document.createElement('canvas');
  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context niet beschikbaar.');

  ctx.drawImage(img, 0, 0, sampleW, sampleH);
  const { data } = ctx.getImageData(0, 0, sampleW, sampleH);

  let sumR = 0, sumG = 0, sumB = 0;
  let shR = 0, shG = 0, shB = 0, shCount = 0;
  let hiR = 0, hiG = 0, hiB = 0, hiCount = 0;
  let satSum = 0;
  const lums: number[] = [];

  const totalPixels = sampleW * sampleH;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    lums.push(lum);

    sumR += r;
    sumG += g;
    sumB += b;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    satSum += max === 0 ? 0 : (max - min) / max;

    if (lum < 0.28) {
      shR += r; shG += g; shB += b; shCount++;
    } else if (lum > 0.72) {
      hiR += r; hiG += g; hiB += b; hiCount++;
    }
  }

  lums.sort((a, b) => a - b);
  const p05 = lums[Math.floor(totalPixels * 0.05)] ?? 0.05;
  const p50 = lums[Math.floor(totalPixels * 0.5)] ?? 0.5;
  const p95 = lums[Math.floor(totalPixels * 0.95)] ?? 0.95;

  const avgR = sumR / totalPixels;
  const avgG = sumG / totalPixels;
  const avgB = sumB / totalPixels;
  const avgSat = satSum / totalPixels;

  const adj = cloneAdj(DEFAULT_ADJUSTMENTS);

  // Warmth & Tint from global R-B and G offset
  const warmth = clamp(Math.round((avgR - avgB) * 95), -35, 35);
  const tint = clamp(Math.round(((avgR + avgB) * 0.5 - avgG) * 70), -20, 20);
  adj.temperature = warmth;
  adj.tint = tint;

  // Contrast & matte lift from p05 / p95 spread
  const matteLift = p05 > 0.06 ? Math.round(clamp((p05 - 0.04) * 180, 0, 24)) : 0;
  const highlightRoll = p95 < 0.93 ? Math.round(clamp(255 - (0.95 - p95) * 90, 234, 255)) : 255;
  const contrastDelta = Math.round(clamp(((p95 - p05) - 0.76) * 85, -24, 32));

  adj.contrast = contrastDelta;
  adj.highlights = highlightRoll < 252 ? -24 : -10;
  adj.shadows = matteLift > 8 ? 22 : 8;
  adj.exposure = Number(clamp((p50 - 0.46) * 0.65, -0.45, 0.45).toFixed(2));

  const curve: ToneCurvePoint[] = [
    { x: 0, y: matteLift },
    { x: 64, y: Math.round(64 - contrastDelta * 0.22 + matteLift * 0.4) },
    { x: 128, y: 128 },
    { x: 192, y: Math.round(192 + contrastDelta * 0.22) },
    { x: 255, y: highlightRoll },
  ];
  adj.toneCurve = curve;

  // Saturation profile (monochrome vs muted vs vibrant)
  if (avgSat < 0.06) {
    adj.saturation = -100;
  } else {
    adj.saturation = Math.round(clamp((avgSat - 0.34) * 75, -32, 22));
    adj.vibrance = Math.round(clamp((0.36 - avgSat) * 45, -12, 20));
  }

  // Split toning from shadow and highlight cast
  const rgbToHue = (r: number, g: number, b: number): { hue: number; sat: number } => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    if (d < 0.015) return { hue: 0, sat: 0 };
    let h = 0;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return {
      hue: Math.round((h * 60 + 360) % 360),
      sat: Math.round(clamp((d / Math.max(0.1, max)) * 65, 0, 32)),
    };
  };

  if (shCount > 20 && avgSat >= 0.06) {
    const shCast = rgbToHue(shR / shCount, shG / shCount, shB / shCount);
    adj.colorGrading.shadows.hue = shCast.hue;
    adj.colorGrading.shadows.saturation = shCast.sat;
  }
  if (hiCount > 20 && avgSat >= 0.06) {
    const hiCast = rgbToHue(hiR / hiCount, hiG / hiCount, hiB / hiCount);
    adj.colorGrading.highlights.hue = hiCast.hue;
    adj.colorGrading.highlights.saturation = hiCast.sat;
  }

  adj.grainAmount = matteLift > 8 ? 16 : 8;
  adj.vignetteAmount = -12;

  const styleDesc =
    avgSat < 0.06
      ? 'Monochroom profiel lokaal afgeleid uit de referentiefoto.'
      : `Lokaal geëxtraheerde kleurstijl (${warmth >= 0 ? 'warme' : 'koele'} balans, ${
          matteLift > 8 ? 'zachte matte schaduwlift' : 'helder contrast'
        }).`;

  return {
    name: customName?.trim() || 'Referentiestijl (Lokaal)',
    description: styleDesc,
    reasoning:
      'Lokale pixelanalyse (zonder API-sleutel): tooncurve, schaduw/hooglicht-tinten, witbalans en verzadiging zijn direct uit het kleurenpalet van de referentiefoto afgeleid.',
    changedFields: [
      `Temperatuur ${warmth > 0 ? '+' : ''}${warmth}`,
      `Contrast ${contrastDelta > 0 ? '+' : ''}${contrastDelta}`,
      `Zwartlift ${matteLift}`,
      `Verzadiging ${adj.saturation > 0 ? '+' : ''}${adj.saturation}`,
    ],
    adjustments: adj,
  };
}

export const LOCAL_HSL_KEYS: HSLColorKey[] = [
  'red',
  'orange',
  'yellow',
  'green',
  'aqua',
  'blue',
  'purple',
  'magenta',
];
