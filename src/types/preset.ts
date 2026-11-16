export type HSLColorKey =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'aqua'
  | 'blue'
  | 'purple'
  | 'magenta';

export interface HSLAdjustment {
  hue: number;        // -100 to +100
  saturation: number; // -100 to +100
  luminance: number;  // -100 to +100
}

export interface ColorGradingWheel {
  hue: number;        // 0 to 360
  saturation: number; // 0 to 100
  luminance: number;  // -100 to +100
}

export interface ToneCurvePoint {
  x: number; // 0 to 255
  y: number; // 0 to 255
}

export interface PresetAdjustments {
  // White Balance
  temperature: number; // -100 to +100 (relative shift for presets, mapped to Kelvin delta)
  tint: number;        // -100 to +100

  // Tone
  exposure: number;    // -5.0 to +5.0 EV
  contrast: number;    // -100 to +100
  highlights: number;  // -100 to +100
  shadows: number;     // -100 to +100
  whites: number;      // -100 to +100
  blacks: number;      // -100 to +100

  // Presence
  texture: number;     // -100 to +100
  clarity: number;     // -100 to +100
  dehaze: number;      // -100 to +100
  vibrance: number;    // -100 to +100
  saturation: number;  // -100 to +100

  // Tone Curve (RGB)
  toneCurve: ToneCurvePoint[];

  // HSL Mixer
  hsl: Record<HSLColorKey, HSLAdjustment>;

  // Color Grading (Split Toning)
  colorGrading: {
    shadows: ColorGradingWheel;
    midtones: ColorGradingWheel;
    highlights: ColorGradingWheel;
    balance: number; // -100 to +100
  };

  // Effects
  grainAmount: number;    // 0 to 100
  grainSize: number;      // 0 to 100
  vignetteAmount: number; // -100 to +100
}

export type PresetCategory = 'film' | 'moody' | 'portret' | 'landschap' | 'geimporteerd' | 'aangepast';

export interface PresetIteration {
  id: string;
  prompt: string;
  reasoning: string;
  changedFields: string[];
  timestamp: number;
  adjustmentsSnapshot: PresetAdjustments;
}

export interface LightroomPreset {
  id: string;
  name: string;
  description: string;
  category: PresetCategory;
  source: 'starter' | 'xmp-import' | 'photo-extract' | 'ai-generated';
  createdAt: number;
  updatedAt: number;
  adjustments: PresetAdjustments;
  history: PresetIteration[];
}

export interface SamplePhoto {
  id: string;
  title: string;
  subtitle: string;
  url: string;
  exif: string;
}

export interface HistogramData {
  r: number[];
  g: number[];
  b: number[];
  l: number[];
}

export const DEFAULT_ADJUSTMENTS: PresetAdjustments = {
  temperature: 0,
  tint: 0,
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  texture: 0,
  clarity: 0,
  dehaze: 0,
  vibrance: 0,
  saturation: 0,
  toneCurve: [
    { x: 0, y: 0 },
    { x: 64, y: 64 },
    { x: 128, y: 128 },
    { x: 192, y: 192 },
    { x: 255, y: 255 },
  ],
  hsl: {
    red: { hue: 0, saturation: 0, luminance: 0 },
    orange: { hue: 0, saturation: 0, luminance: 0 },
    yellow: { hue: 0, saturation: 0, luminance: 0 },
    green: { hue: 0, saturation: 0, luminance: 0 },
    aqua: { hue: 0, saturation: 0, luminance: 0 },
    blue: { hue: 0, saturation: 0, luminance: 0 },
    purple: { hue: 0, saturation: 0, luminance: 0 },
    magenta: { hue: 0, saturation: 0, luminance: 0 },
  },
  colorGrading: {
    shadows: { hue: 0, saturation: 0, luminance: 0 },
    midtones: { hue: 0, saturation: 0, luminance: 0 },
    highlights: { hue: 0, saturation: 0, luminance: 0 },
    balance: 0,
  },
  grainAmount: 0,
  grainSize: 25,
  vignetteAmount: 0,
};
