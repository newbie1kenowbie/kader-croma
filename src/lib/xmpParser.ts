import {
  DEFAULT_ADJUSTMENTS,
  HSLColorKey,
  LightroomPreset,
  PresetAdjustments,
  ToneCurvePoint,
} from '../types/preset';

const HSL_XMP_MAP: Record<HSLColorKey, string> = {
  red: 'Red',
  orange: 'Orange',
  yellow: 'Yellow',
  green: 'Green',
  aqua: 'Aqua',
  blue: 'Blue',
  purple: 'Purple',
  magenta: 'Magenta',
};

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function cloneDefaultAdjustments(): PresetAdjustments {
  return JSON.parse(JSON.stringify(DEFAULT_ADJUSTMENTS)) as PresetAdjustments;
}

function extractNumericAttr(content: string, keys: string[]): number | undefined {
  for (const key of keys) {
    // Match XML attribute crs:Key="12.5" or crs:Key="+12"
    const xmlAttrRegex = new RegExp(`crs:${key}="([^"]+)"`, 'i');
    const xmlMatch = content.match(xmlAttrRegex);
    if (xmlMatch) {
      const parsed = parseFloat(xmlMatch[1]);
      if (!Number.isNaN(parsed)) return parsed;
    }

    // Match XML element <crs:Key>12</crs:Key>
    const xmlTagRegex = new RegExp(`<crs:${key}>([^<]+)</crs:${key}>`, 'i');
    const tagMatch = content.match(xmlTagRegex);
    if (tagMatch) {
      const parsed = parseFloat(tagMatch[1]);
      if (!Number.isNaN(parsed)) return parsed;
    }

    // Match .lrtemplate Lua key = value
    const luaRegex = new RegExp(`\\b${key}\\s*=\\s*([+-]?\\d+(?:\\.\\d+)?)`, 'i');
    const luaMatch = content.match(luaRegex);
    if (luaMatch) {
      const parsed = parseFloat(luaMatch[1]);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return undefined;
}

function extractToneCurve(content: string): ToneCurvePoint[] | undefined {
  // Check XMP ToneCurvePV2012 sequence
  const seqMatch = content.match(
    /<crs:ToneCurvePV2012(?:2012)?>[\s\S]*?<rdf:Seq>([\s\S]*?)<\/rdf:Seq>[\s\S]*?<\/crs:ToneCurvePV2012(?:2012)?>/i
  );
  if (seqMatch) {
    const items = [...seqMatch[1].matchAll(/<rdf:li>\s*(\d+)\s*,\s*(\d+)\s*<\/rdf:li>/gi)];
    if (items.length >= 2) {
      return items
        .map((m) => ({
          x: clamp(parseInt(m[1], 10), 0, 255),
          y: clamp(parseInt(m[2], 10), 0, 255),
        }))
        .sort((a, b) => a.x - b.x);
    }
  }

  // Check .lrtemplate ToneCurvePV2012 = { 0, 0, 64, 58, ... }
  const luaCurveMatch = content.match(/ToneCurvePV2012\s*=\s*\{([^}]+)\}/i);
  if (luaCurveMatch) {
    const nums = luaCurveMatch[1]
      .split(',')
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !Number.isNaN(n));
    if (nums.length >= 4 && nums.length % 2 === 0) {
      const points: ToneCurvePoint[] = [];
      for (let i = 0; i < nums.length; i += 2) {
        points.push({
          x: clamp(Math.round(nums[i]), 0, 255),
          y: clamp(Math.round(nums[i + 1]), 0, 255),
        });
      }
      return points.sort((a, b) => a.x - b.x);
    }
  }

  return undefined;
}

function extractPresetTitle(content: string, fallbackName: string): string {
  const xmpTitle = content.match(/<crs:Name>[\s\S]*?<rdf:li[^>]*>([^<]+)<\/rdf:li>/i);
  if (xmpTitle && xmpTitle[1].trim()) return xmpTitle[1].trim();

  const luaTitle = content.match(/\btitle\s*=\s*"([^"]+)"/i);
  if (luaTitle && luaTitle[1].trim()) return luaTitle[1].trim();

  return fallbackName.replace(/\.(xmp|lrtemplate|json)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Geïmporteerde Stijl';
}

export function parseImportedPreset(rawText: string, fileName = 'Geïmporteerde Preset'): LightroomPreset {
  const trimmed = rawText.trim();

  // Check if JSON preset exported from Kader Atelier
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Partial<LightroomPreset> & { adjustments?: Partial<PresetAdjustments> };
      const base = cloneDefaultAdjustments();
      const adj = parsed.adjustments ?? (parsed as unknown as Partial<PresetAdjustments>);
      return {
        id: `preset-${Date.now()}`,
        name: parsed.name || extractPresetTitle(trimmed, fileName),
        description: parsed.description || 'Geïmporteerde JSON presetconfiguratie.',
        category: 'geimporteerd',
        source: 'xmp-import',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        adjustments: {
          ...base,
          ...adj,
          hsl: { ...base.hsl, ...(adj.hsl || {}) },
          colorGrading: { ...base.colorGrading, ...(adj.colorGrading || {}) },
          toneCurve: Array.isArray(adj.toneCurve) && adj.toneCurve.length >= 2 ? adj.toneCurve : base.toneCurve,
        },
        history: [],
      };
    } catch {
      // Fall through to XMP/lrtemplate parsing
    }
  }

  const adjustments = cloneDefaultAdjustments();

  // Temperature: XMP uses either relative IncrementalTemperature or absolute Kelvin (baseline ~5500K)
  const incTemp = extractNumericAttr(trimmed, ['IncrementalTemperature']);
  const absTemp = extractNumericAttr(trimmed, ['Temperature']);
  if (incTemp !== undefined) {
    adjustments.temperature = clamp(incTemp, -100, 100);
  } else if (absTemp !== undefined) {
    if (absTemp > 1000) {
      adjustments.temperature = clamp(Math.round((absTemp - 5500) / 40), -100, 100);
    } else {
      adjustments.temperature = clamp(absTemp, -100, 100);
    }
  }

  const incTint = extractNumericAttr(trimmed, ['IncrementalTint', 'Tint']);
  if (incTint !== undefined) adjustments.tint = clamp(incTint, -100, 100);

  const exposure = extractNumericAttr(trimmed, ['Exposure2012', 'Exposure']);
  if (exposure !== undefined) adjustments.exposure = clamp(Number(exposure.toFixed(2)), -5, 5);

  const contrast = extractNumericAttr(trimmed, ['Contrast2012', 'Contrast']);
  if (contrast !== undefined) adjustments.contrast = clamp(Math.round(contrast), -100, 100);

  const highlights = extractNumericAttr(trimmed, ['Highlights2012', 'Highlights']);
  if (highlights !== undefined) adjustments.highlights = clamp(Math.round(highlights), -100, 100);

  const shadows = extractNumericAttr(trimmed, ['Shadows2012', 'Shadows']);
  if (shadows !== undefined) adjustments.shadows = clamp(Math.round(shadows), -100, 100);

  const whites = extractNumericAttr(trimmed, ['Whites2012', 'Whites']);
  if (whites !== undefined) adjustments.whites = clamp(Math.round(whites), -100, 100);

  const blacks = extractNumericAttr(trimmed, ['Blacks2012', 'Blacks']);
  if (blacks !== undefined) adjustments.blacks = clamp(Math.round(blacks), -100, 100);

  const texture = extractNumericAttr(trimmed, ['Texture']);
  if (texture !== undefined) adjustments.texture = clamp(Math.round(texture), -100, 100);

  const clarity = extractNumericAttr(trimmed, ['Clarity2012', 'Clarity']);
  if (clarity !== undefined) adjustments.clarity = clamp(Math.round(clarity), -100, 100);

  const dehaze = extractNumericAttr(trimmed, ['Dehaze']);
  if (dehaze !== undefined) adjustments.dehaze = clamp(Math.round(dehaze), -100, 100);

  const vibrance = extractNumericAttr(trimmed, ['Vibrance']);
  if (vibrance !== undefined) adjustments.vibrance = clamp(Math.round(vibrance), -100, 100);

  const saturation = extractNumericAttr(trimmed, ['Saturation']);
  if (saturation !== undefined) adjustments.saturation = clamp(Math.round(saturation), -100, 100);

  // HSL Adjustments
  (Object.keys(HSL_XMP_MAP) as HSLColorKey[]).forEach((key) => {
    const suffix = HSL_XMP_MAP[key];
    const h = extractNumericAttr(trimmed, [`HueAdjustment${suffix}`]);
    const s = extractNumericAttr(trimmed, [`SaturationAdjustment${suffix}`]);
    const l = extractNumericAttr(trimmed, [`LuminanceAdjustment${suffix}`]);
    if (h !== undefined) adjustments.hsl[key].hue = clamp(Math.round(h), -100, 100);
    if (s !== undefined) adjustments.hsl[key].saturation = clamp(Math.round(s), -100, 100);
    if (l !== undefined) adjustments.hsl[key].luminance = clamp(Math.round(l), -100, 100);
  });

  // Color Grading / Split Toning
  const shHue = extractNumericAttr(trimmed, ['ColorGradeShadowHue', 'SplitToningShadowHue']);
  const shSat = extractNumericAttr(trimmed, ['ColorGradeShadowSat', 'SplitToningShadowSaturation']);
  const shLum = extractNumericAttr(trimmed, ['ColorGradeShadowLum']);
  if (shHue !== undefined) adjustments.colorGrading.shadows.hue = clamp(Math.round(shHue), 0, 360);
  if (shSat !== undefined) adjustments.colorGrading.shadows.saturation = clamp(Math.round(shSat), 0, 100);
  if (shLum !== undefined) adjustments.colorGrading.shadows.luminance = clamp(Math.round(shLum), -100, 100);

  const midHue = extractNumericAttr(trimmed, ['ColorGradeMidtoneHue']);
  const midSat = extractNumericAttr(trimmed, ['ColorGradeMidtoneSat']);
  const midLum = extractNumericAttr(trimmed, ['ColorGradeMidtoneLum']);
  if (midHue !== undefined) adjustments.colorGrading.midtones.hue = clamp(Math.round(midHue), 0, 360);
  if (midSat !== undefined) adjustments.colorGrading.midtones.saturation = clamp(Math.round(midSat), 0, 100);
  if (midLum !== undefined) adjustments.colorGrading.midtones.luminance = clamp(Math.round(midLum), -100, 100);

  const hiHue = extractNumericAttr(trimmed, ['ColorGradeHighlightHue', 'SplitToningHighlightHue']);
  const hiSat = extractNumericAttr(trimmed, ['ColorGradeHighlightSat', 'SplitToningHighlightSaturation']);
  const hiLum = extractNumericAttr(trimmed, ['ColorGradeHighlightLum']);
  if (hiHue !== undefined) adjustments.colorGrading.highlights.hue = clamp(Math.round(hiHue), 0, 360);
  if (hiSat !== undefined) adjustments.colorGrading.highlights.saturation = clamp(Math.round(hiSat), 0, 100);
  if (hiLum !== undefined) adjustments.colorGrading.highlights.luminance = clamp(Math.round(hiLum), -100, 100);

  const balance = extractNumericAttr(trimmed, ['ColorGradeBalance', 'SplitToningBalance']);
  if (balance !== undefined) adjustments.colorGrading.balance = clamp(Math.round(balance), -100, 100);

  // Grain & Vignette
  const grainAmount = extractNumericAttr(trimmed, ['GrainAmount']);
  if (grainAmount !== undefined) adjustments.grainAmount = clamp(Math.round(grainAmount), 0, 100);
  const grainSize = extractNumericAttr(trimmed, ['GrainSize']);
  if (grainSize !== undefined) adjustments.grainSize = clamp(Math.round(grainSize), 0, 100);
  const vignette = extractNumericAttr(trimmed, ['PostCropVignetteAmount', 'VignetteAmount']);
  if (vignette !== undefined) adjustments.vignetteAmount = clamp(Math.round(vignette), -100, 100);

  const parsedCurve = extractToneCurve(trimmed);
  if (parsedCurve) adjustments.toneCurve = parsedCurve;

  const title = extractPresetTitle(trimmed, fileName);

  return {
    id: `preset-${Date.now()}`,
    name: title,
    description: `Geïmporteerd uit ${fileName} met volledige Lightroom-parameters.`,
    category: 'geimporteerd',
    source: 'xmp-import',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    adjustments,
    history: [],
  };
}

function formatSigned(val: number, decimals = 0): string {
  const fixed = decimals > 0 ? val.toFixed(decimals) : Math.round(val).toString();
  return val > 0 ? `+${fixed}` : fixed;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function presetToXmp(preset: LightroomPreset): string {
  const a = preset.adjustments;
  const uuid = `KADER-${preset.id.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase()}`;
  const curveItems = a.toneCurve
    .map((pt) => `          <rdf:li>${Math.round(pt.x)}, ${Math.round(pt.y)}</rdf:li>`)
    .join('\n');

  const hslAttrs = (Object.keys(HSL_XMP_MAP) as HSLColorKey[])
    .map((key) => {
      const cap = HSL_XMP_MAP[key];
      const ch = a.hsl[key];
      return [
        `      crs:HueAdjustment${cap}="${Math.round(ch.hue)}"`,
        `      crs:SaturationAdjustment${cap}="${Math.round(ch.saturation)}"`,
        `      crs:LuminanceAdjustment${cap}="${Math.round(ch.luminance)}"`,
      ].join('\n');
    })
    .join('\n');

  return `<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 7.0-c000 1.000000">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
      crs:PresetType="Normal"
      crs:Cluster=""
      crs:UUID="${escapeXml(uuid)}"
      crs:SupportsAmount2="True"
      crs:SupportsAmount="True"
      crs:SupportsColor="True"
      crs:SupportsMonochrome="True"
      crs:SupportsHighDynamicRange="True"
      crs:SupportsNormalDynamicRange="True"
      crs:SupportsSceneReferred="True"
      crs:SupportsOutputReferred="True"
      crs:Version="16.0"
      crs:ProcessVersion="15.4"
      crs:WhiteBalance="Custom"
      crs:IncrementalTemperature="${Math.round(a.temperature)}"
      crs:IncrementalTint="${Math.round(a.tint)}"
      crs:Exposure2012="${formatSigned(a.exposure, 2)}"
      crs:Contrast2012="${Math.round(a.contrast)}"
      crs:Highlights2012="${Math.round(a.highlights)}"
      crs:Shadows2012="${Math.round(a.shadows)}"
      crs:Whites2012="${Math.round(a.whites)}"
      crs:Blacks2012="${Math.round(a.blacks)}"
      crs:Texture="${Math.round(a.texture)}"
      crs:Clarity2012="${Math.round(a.clarity)}"
      crs:Dehaze="${Math.round(a.dehaze)}"
      crs:Vibrance="${Math.round(a.vibrance)}"
      crs:Saturation="${Math.round(a.saturation)}"
${hslAttrs}
      crs:SplitToningShadowHue="${Math.round(a.colorGrading.shadows.hue)}"
      crs:SplitToningShadowSaturation="${Math.round(a.colorGrading.shadows.saturation)}"
      crs:SplitToningHighlightHue="${Math.round(a.colorGrading.highlights.hue)}"
      crs:SplitToningHighlightSaturation="${Math.round(a.colorGrading.highlights.saturation)}"
      crs:SplitToningBalance="${Math.round(a.colorGrading.balance)}"
      crs:ColorGradeShadowHue="${Math.round(a.colorGrading.shadows.hue)}"
      crs:ColorGradeShadowSat="${Math.round(a.colorGrading.shadows.saturation)}"
      crs:ColorGradeShadowLum="${Math.round(a.colorGrading.shadows.luminance)}"
      crs:ColorGradeMidtoneHue="${Math.round(a.colorGrading.midtones.hue)}"
      crs:ColorGradeMidtoneSat="${Math.round(a.colorGrading.midtones.saturation)}"
      crs:ColorGradeMidtoneLum="${Math.round(a.colorGrading.midtones.luminance)}"
      crs:ColorGradeHighlightHue="${Math.round(a.colorGrading.highlights.hue)}"
      crs:ColorGradeHighlightSat="${Math.round(a.colorGrading.highlights.saturation)}"
      crs:ColorGradeHighlightLum="${Math.round(a.colorGrading.highlights.luminance)}"
      crs:ColorGradeBalance="${Math.round(a.colorGrading.balance)}"
      crs:GrainAmount="${Math.round(a.grainAmount)}"
      crs:GrainSize="${Math.round(a.grainSize)}"
      crs:GrainFrequency="50"
      crs:PostCropVignetteAmount="${Math.round(a.vignetteAmount)}"
      crs:PostCropVignetteMidpoint="50"
      crs:PostCropVignetteFeather="50"
      crs:PostCropVignetteRoundness="0"
      crs:ToneCurveName2012="Custom"
      crs:HasSettings="True">
      <crs:Name>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${escapeXml(preset.name)}</rdf:li>
        </rdf:Alt>
      </crs:Name>
      <crs:ShortName>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${escapeXml(preset.name)}</rdf:li>
        </rdf:Alt>
      </crs:ShortName>
      <crs:Group>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">Kader Atelier</rdf:li>
        </rdf:Alt>
      </crs:Group>
      <crs:Description>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${escapeXml(preset.description)}</rdf:li>
        </rdf:Alt>
      </crs:Description>
      <crs:ToneCurvePV2012>
        <rdf:Seq>
${curveItems}
        </rdf:Seq>
      </crs:ToneCurvePV2012>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
`;
}

export const SAMPLE_XMP_SNIPPET = `<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
      crs:IncrementalTemperature="14"
      crs:IncrementalTint="4"
      crs:Exposure2012="+0.25"
      crs:Contrast2012="-12"
      crs:Highlights2012="-38"
      crs:Shadows2012="+28"
      crs:Whites2012="-15"
      crs:Blacks2012="+18"
      crs:Clarity2012="-8"
      crs:Vibrance="+12"
      crs:Saturation="-10"
      crs:HueAdjustmentGreen="-24"
      crs:SaturationAdjustmentGreen="-35"
      crs:ColorGradeShadowHue="215"
      crs:ColorGradeShadowSat="14"
      crs:ColorGradeHighlightHue="42"
      crs:ColorGradeHighlightSat="18"
      crs:GrainAmount="22"
      crs:PostCropVignetteAmount="-16">
      <crs:Name><rdf:Alt><rdf:li xml:lang="x-default">Goudzoekers Analoog 400</rdf:li></rdf:Alt></crs:Name>
      <crs:ToneCurvePV2012>
        <rdf:Seq>
          <rdf:li>0, 18</rdf:li>
          <rdf:li>64, 58</rdf:li>
          <rdf:li>128, 134</rdf:li>
          <rdf:li>192, 198</rdf:li>
          <rdf:li>255, 242</rdf:li>
        </rdf:Seq>
      </crs:ToneCurvePV2012>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>`;
