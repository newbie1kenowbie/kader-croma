import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { transformPresetLocally } from './src/lib/localPresetEngine.ts';

dotenv.config();

const currentDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

const PORT = Number(process.env.PORT) || 3000;

function getAiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const hslChannelSchema = {
  type: Type.OBJECT,
  properties: {
    hue: { type: Type.NUMBER, description: 'Tintverschuiving (-100 tot 100)' },
    saturation: { type: Type.NUMBER, description: 'Verzadiging (-100 tot 100)' },
    luminance: { type: Type.NUMBER, description: 'Helderheid (-100 tot 100)' },
  },
  required: ['hue', 'saturation', 'luminance'],
};

const wheelSchema = {
  type: Type.OBJECT,
  properties: {
    hue: { type: Type.NUMBER, description: 'Kleurtoon in graden (0 tot 360)' },
    saturation: { type: Type.NUMBER, description: 'Verzadiging (0 tot 100)' },
    luminance: { type: Type.NUMBER, description: 'Helderheid (-100 tot 100)' },
  },
  required: ['hue', 'saturation', 'luminance'],
};

const presetResponseSchema = {
  type: Type.OBJECT,
  properties: {
    name: {
      type: Type.STRING,
      description: 'Korte, elegante Nederlandse presetnaam (max 4 woorden).',
    },
    description: {
      type: Type.STRING,
      description: 'Korte beschrijving in het Nederlands van het karakter van de preset (1 zin).',
    },
    reasoning: {
      type: Type.STRING,
      description:
        'Beknopte toelichting in het Nederlands waarom deze Lightroom-instellingen zijn gekozen of aangepast (2 korte zinnen).',
    },
    changedFields: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        'Lijst van de 3 tot 6 belangrijkste aangepaste parameters met waarde, bijv. "Schaduwen +28", "Kleurtemperatuur +14".',
    },
    adjustments: {
      type: Type.OBJECT,
      properties: {
        temperature: { type: Type.NUMBER, description: '-100 (koel blauw) tot +100 (warm amber)' },
        tint: { type: Type.NUMBER, description: '-100 (groen) tot +100 (magenta)' },
        exposure: { type: Type.NUMBER, description: '-2.5 tot +2.5 EV' },
        contrast: { type: Type.NUMBER, description: '-100 tot +100' },
        highlights: { type: Type.NUMBER, description: '-100 tot +100' },
        shadows: { type: Type.NUMBER, description: '-100 tot +100' },
        whites: { type: Type.NUMBER, description: '-100 tot +100' },
        blacks: { type: Type.NUMBER, description: '-100 tot +100' },
        texture: { type: Type.NUMBER, description: '-100 tot +100' },
        clarity: { type: Type.NUMBER, description: '-100 tot +100' },
        dehaze: { type: Type.NUMBER, description: '-100 tot +100' },
        vibrance: { type: Type.NUMBER, description: '-100 tot +100' },
        saturation: { type: Type.NUMBER, description: '-100 tot +100' },
        toneCurve: {
          type: Type.ARRAY,
          description: 'Precies 5 stijgende controlepunten (x van 0 tot 255, y van 0 tot 255) voor de RGB tooncurve.',
          items: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER },
            },
            required: ['x', 'y'],
          },
        },
        hsl: {
          type: Type.OBJECT,
          properties: {
            red: hslChannelSchema,
            orange: hslChannelSchema,
            yellow: hslChannelSchema,
            green: hslChannelSchema,
            aqua: hslChannelSchema,
            blue: hslChannelSchema,
            purple: hslChannelSchema,
            magenta: hslChannelSchema,
          },
          required: ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'],
        },
        colorGrading: {
          type: Type.OBJECT,
          properties: {
            shadows: wheelSchema,
            midtones: wheelSchema,
            highlights: wheelSchema,
            balance: { type: Type.NUMBER, description: '-100 tot +100' },
          },
          required: ['shadows', 'midtones', 'highlights', 'balance'],
        },
        grainAmount: { type: Type.NUMBER, description: '0 tot 100' },
        grainSize: { type: Type.NUMBER, description: '10 tot 80' },
        vignetteAmount: { type: Type.NUMBER, description: '-100 tot +100' },
      },
      required: [
        'temperature',
        'tint',
        'exposure',
        'contrast',
        'highlights',
        'shadows',
        'whites',
        'blacks',
        'texture',
        'clarity',
        'dehaze',
        'vibrance',
        'saturation',
        'toneCurve',
        'hsl',
        'colorGrading',
        'grainAmount',
        'grainSize',
        'vignetteAmount',
      ],
    },
  },
  required: ['name', 'description', 'reasoning', 'changedFields', 'adjustments'],
};

const STUDIO_SYSTEM_INSTRUCTION = `Je bent een meester-kleurspecialist (colorist) en Adobe Lightroom Classic / Camera Raw expert.
Je helpt fotografen om bestaande Lightroom presets aan te passen of referentie-stijlen te vertalen naar nauwkeurige, smaakvolle, direct bruikbare Lightroom-instellingen zonder dat ze dure presetpakketten hoeven te kopen.

Richtlijnen voor realistische, professionele Lightroom presets:
- Werk subtiel en gebalanceerd, zoals professionele fotografen en kleurspecialisten (vermijd overdreven cartoon-verzadiging of kapotgeblazen hooglichten).
- Gebruik de Tone Curve verstandig: voor een matte filmlook til je het eerste punt (x: 0) op naar y: 14–26 en demp je de witte top (x: 255) naar y: 238–248. Houd de x-waarden strikt oplopend (0, ~64, 128, ~192, 255).
- Gebruik HSL-kanalen gericht: bijv. voor warme huidtinten (oranje subtiel +luminantie, -verzadiging), voor filmisch groen (groen/geel verschuiven richting smaragd of herfst en verzadiging verlagen).
- Gebruik Color Grading (Split Toning) voor sfeer (bijv. koele cyaan/blauwe schaduwen hue 195-220 met sat 10-25 en warme gouden hooglichten hue 35-50 met sat 10-24).
- Als de gebruiker een bestaande preset aanpast, behoud dan het fundament van de huidige instellingen en pas specifiek aan wat de gebruiker vraagt.
- Reageer altijd met valide JSON volgens het gevraagde schema, met Nederlandse tekst in name, description, reasoning en changedFields.`;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(v) ? v : 0));
}

function sanitizeAdjustments(raw: any): any {
  const safeHsl = (ch: any) => ({
    hue: Math.round(clamp(ch?.hue ?? 0, -100, 100)),
    saturation: Math.round(clamp(ch?.saturation ?? 0, -100, 100)),
    luminance: Math.round(clamp(ch?.luminance ?? 0, -100, 100)),
  });
  const safeWheel = (w: any) => ({
    hue: Math.round(clamp(w?.hue ?? 0, 0, 360)),
    saturation: Math.round(clamp(w?.saturation ?? 0, 0, 100)),
    luminance: Math.round(clamp(w?.luminance ?? 0, -100, 100)),
  });

  let curve = Array.isArray(raw?.toneCurve) ? raw.toneCurve : [];
  if (curve.length < 2) {
    curve = [
      { x: 0, y: 0 },
      { x: 64, y: 64 },
      { x: 128, y: 128 },
      { x: 192, y: 192 },
      { x: 255, y: 255 },
    ];
  } else {
    curve = curve
      .map((pt: any) => ({
        x: Math.round(clamp(pt?.x ?? 0, 0, 255)),
        y: Math.round(clamp(pt?.y ?? 0, 0, 255)),
      }))
      .sort((a: any, b: any) => a.x - b.x);
    curve[0].x = 0;
    curve[curve.length - 1].x = 255;
  }

  return {
    temperature: Math.round(clamp(raw?.temperature ?? 0, -100, 100)),
    tint: Math.round(clamp(raw?.tint ?? 0, -100, 100)),
    exposure: Number(clamp(raw?.exposure ?? 0, -5, 5).toFixed(2)),
    contrast: Math.round(clamp(raw?.contrast ?? 0, -100, 100)),
    highlights: Math.round(clamp(raw?.highlights ?? 0, -100, 100)),
    shadows: Math.round(clamp(raw?.shadows ?? 0, -100, 100)),
    whites: Math.round(clamp(raw?.whites ?? 0, -100, 100)),
    blacks: Math.round(clamp(raw?.blacks ?? 0, -100, 100)),
    texture: Math.round(clamp(raw?.texture ?? 0, -100, 100)),
    clarity: Math.round(clamp(raw?.clarity ?? 0, -100, 100)),
    dehaze: Math.round(clamp(raw?.dehaze ?? 0, -100, 100)),
    vibrance: Math.round(clamp(raw?.vibrance ?? 0, -100, 100)),
    saturation: Math.round(clamp(raw?.saturation ?? 0, -100, 100)),
    toneCurve: curve,
    hsl: {
      red: safeHsl(raw?.hsl?.red),
      orange: safeHsl(raw?.hsl?.orange),
      yellow: safeHsl(raw?.hsl?.yellow),
      green: safeHsl(raw?.hsl?.green),
      aqua: safeHsl(raw?.hsl?.aqua),
      blue: safeHsl(raw?.hsl?.blue),
      purple: safeHsl(raw?.hsl?.purple),
      magenta: safeHsl(raw?.hsl?.magenta),
    },
    colorGrading: {
      shadows: safeWheel(raw?.colorGrading?.shadows),
      midtones: safeWheel(raw?.colorGrading?.midtones),
      highlights: safeWheel(raw?.colorGrading?.highlights),
      balance: Math.round(clamp(raw?.colorGrading?.balance ?? 0, -100, 100)),
    },
    grainAmount: Math.round(clamp(raw?.grainAmount ?? 0, 0, 100)),
    grainSize: Math.round(clamp(raw?.grainSize ?? 25, 0, 100)),
    vignetteAmount: Math.round(clamp(raw?.vignetteAmount ?? 0, -100, 100)),
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Transform or refine an existing Lightroom preset using a natural-language prompt
  app.post('/api/presets/transform', async (req, res) => {
    try {
      const { currentPreset, prompt, imageBase64, imageMimeType } = req.body ?? {};
      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        res.status(400).json({ error: 'Geef een duidelijke tekstprompt op om de preset aan te passen.' });
        return;
      }

      const ai = getAiClient();
      if (!ai) {
        const localResult = transformPresetLocally(
          currentPreset?.name || 'Aangepaste Stijl',
          currentPreset?.description || 'Lokale Lightroom preset.',
          sanitizeAdjustments(currentPreset?.adjustments ?? {}),
          prompt.trim()
        );
        res.json({ ...localResult, mode: 'local' });
        return;
      }

      const textPrompt = `Huidige preset: "${currentPreset?.name ?? 'Onbenoemd'}" (${currentPreset?.description ?? ''}).
Huidige Lightroom-instellingen (JSON):
${JSON.stringify(currentPreset?.adjustments ?? {}, null, 2)}

Opdracht van de fotograaf:
"${prompt.trim()}"

Pas de huidige Lightroom-instellingen aan volgens de opdracht van de fotograaf. Behoud bestaande sterke aspecten tenzij de gebruiker om iets compleet nieuws vraagt.`;

      const parts: any[] = [];
      if (imageBase64 && typeof imageBase64 === 'string') {
        const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
        parts.push({
          inlineData: {
            mimeType: imageMimeType || 'image/jpeg',
            data: cleanBase64,
          },
        });
      }
      parts.push({ text: textPrompt });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          systemInstruction: STUDIO_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: presetResponseSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        throw new Error('Leeg antwoord ontvangen van het AI-model.');
      }

      const parsed = JSON.parse(rawText);
      res.json({
        name: parsed.name || currentPreset?.name || 'Aangepaste Stijl',
        description: parsed.description || 'Door AI aangepaste Lightroom preset.',
        reasoning: parsed.reasoning || 'Instellingen bijgewerkt op basis van je tekstprompt.',
        changedFields: Array.isArray(parsed.changedFields) ? parsed.changedFields.slice(0, 6) : [],
        adjustments: sanitizeAdjustments(parsed.adjustments),
      });
    } catch (err: any) {
      console.error('Fout bij /api/presets/transform:', err);
      const status = err?.status || 500;
      res.status(status >= 400 && status < 600 ? status : 500).json({
        error: err?.message || 'Kon de preset niet aanpassen. Controleer je verzoek en probeer opnieuw.',
      });
    }
  });

  // Reverse-engineer a Lightroom preset from an uploaded reference photograph
  app.post('/api/presets/extract-style', async (req, res) => {
    try {
      const { imageBase64, imageMimeType, styleName, prompt } = req.body ?? {};
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'Upload eerst een referentiefoto om de stijl te analyseren.' });
        return;
      }

      const ai = getAiClient();
      if (!ai) {
        res.json({
          mode: 'local-fallback-required',
        });
        return;
      }

      const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

      const extractPrompt = `Analyseer de kleurgradatie (color grading), witbalans, contrastverhouding, schaduwlift/matte zwartpunten, hooglicht-rolloff, HSL-kleurverschuivingen, split toning (kleur in schaduwen en hooglichten) en filmkorrel van deze referentiefoto.

Vertaal deze visuele stijl naar een nauwkeurige, herbruikbare Adobe Lightroom Preset die dit uiterlijk op andere foto's reproduceert.
${styleName ? `Gewenste stijlnaam (optioneel): "${styleName}"` : ''}
${prompt ? `Extra aanwijzing van de fotograaf: "${prompt}"` : ''}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: imageMimeType || 'image/jpeg',
                data: cleanBase64,
              },
            },
            { text: extractPrompt },
          ],
        },
        config: {
          systemInstruction: STUDIO_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: presetResponseSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        throw new Error('Leeg antwoord ontvangen bij het analyseren van de referentiefoto.');
      }

      const parsed = JSON.parse(rawText);
      res.json({
        name: styleName?.trim() || parsed.name || 'Geëxtraheerde Referentiestijl',
        description: parsed.description || 'Kleurstijl geëxtraheerd uit referentiefoto.',
        reasoning: parsed.reasoning || 'Tooncurve, split toning en HSL-kleuren zijn geanalyseerd uit de referentiefoto.',
        changedFields: Array.isArray(parsed.changedFields) ? parsed.changedFields.slice(0, 6) : [],
        adjustments: sanitizeAdjustments(parsed.adjustments),
      });
    } catch (err: any) {
      console.error('Fout bij /api/presets/extract-style:', err);
      const status = err?.status || 500;
      res.status(status >= 400 && status < 600 ? status : 500).json({
        error: err?.message || 'Kon de stijl niet uit de foto extraheren.',
      });
    }
  });

  const httpServer = http.createServer(app);
  const disableHmr = process.env.DISABLE_HMR === 'true' || process.env.ENABLE_HMR !== 'true';
  if (disableHmr && !process.env.DISABLE_HMR) {
    process.env.DISABLE_HMR = 'true';
  }

  if (process.env.NODE_ENV !== 'production') {
    if (disableHmr) {
      app.get('/@vite/client', (_req, res) => {
        res.type('application/javascript').send(`
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    accept() {},
    dispose() {},
    prune() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
    data: {},
  };
}
export function injectQuery(url) {
  return url;
}
export class ErrorOverlay {}
`);
      });
    }

    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: disableHmr ? false : { server: httpServer },
        ws: disableHmr ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const envDist = process.env.KADER_DIST_DIR;
    const rootDist = path.resolve(currentDir, 'dist');
    const parentDist = path.resolve(currentDir, '..', 'dist');
    const distPath =
      envDist && fs.existsSync(envDist)
        ? envDist
        : fs.existsSync(rootDist)
          ? rootDist
          : parentDist;
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Kader Chroma server draait op http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server opstartfout:', err);
  process.exit(1);
});
