import React, { useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  DEFAULT_ADJUSTMENTS,
  HistogramData,
  HSLColorKey,
  PresetAdjustments,
  ToneCurvePoint,
} from '../types/preset';

interface SlidersInspectorProps {
  adjustments: PresetAdjustments;
  histogram: HistogramData | null;
  mode: 'tone' | 'hsl';
  onChange: (next: PresetAdjustments) => void;
  onResetAll: () => void;
}

const HSL_CHANNELS: Array<{ key: HSLColorKey; label: string; color: string }> = [
  { key: 'red', label: 'Rood', color: '#E05252' },
  { key: 'orange', label: 'Oranje', color: '#E88B38' },
  { key: 'yellow', label: 'Geel', color: '#E3C644' },
  { key: 'green', label: 'Groen', color: '#5DBB63' },
  { key: 'aqua', label: 'Aqua', color: '#45B8AC' },
  { key: 'blue', label: 'Blauw', color: '#4E86E4' },
  { key: 'purple', label: 'Paars', color: '#9D6AE8' },
  { key: 'magenta', label: 'Magenta', color: '#D95AA8' },
];

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  decimals?: number;
  defaultValue?: number;
  onChange: (v: number) => void;
}

const SliderRow: React.FC<SliderRowProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  decimals = 0,
  defaultValue = 0,
  onChange,
}) => {
  const formatted = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();
  const display = value > 0 ? `+${formatted}` : formatted;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span
          onDoubleClick={() => onChange(defaultValue)}
          title="Dubbelklik om te resetten"
          className="text-[#C8CCD4] select-none cursor-pointer hover:text-[#F2F2F0]"
        >
          {label}
        </span>
        <span className="font-mono tabular-nums text-[#F2F2F0]">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onDoubleClick={() => onChange(defaultValue)}
        className="studio-slider"
      />
    </div>
  );
};

interface ToneCurveEditorProps {
  points: ToneCurvePoint[];
  histogram: HistogramData | null;
  onChange: (next: ToneCurvePoint[]) => void;
}

const ToneCurveEditor: React.FC<ToneCurveEditorProps> = ({ points, histogram, onChange }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const size = 255;

  const updatePointFromEvent = (clientX: number, clientY: number, idx: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nx = Math.max(0, Math.min(255, Math.round(((clientX - rect.left) / rect.width) * 255)));
    const ny = Math.max(0, Math.min(255, Math.round(255 - ((clientY - rect.top) / rect.height) * 255)));

    const next = points.map((p) => ({ ...p }));
    const prevX = idx > 0 ? next[idx - 1].x + 6 : 0;
    const nextX = idx < next.length - 1 ? next[idx + 1].x - 6 : 255;

    if (idx === 0) {
      next[idx].x = Math.min(80, nx);
    } else if (idx === next.length - 1) {
      next[idx].x = Math.max(175, nx);
    } else {
      next[idx].x = Math.max(prevX, Math.min(nextX, nx));
    }
    next[idx].y = ny;
    onChange(next);
  };

  // Build smooth SVG polyline path
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const pathD = sorted
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${255 - pt.y}`)
    .join(' ');

  const histPath = (bins: number[]) => {
    if (!bins.length) return '';
    const step = 255 / (bins.length - 1);
    const pts = bins.map((v, i) => `${(i * step).toFixed(1)},${(255 - v * 210).toFixed(1)}`);
    return `M 0,255 L ${pts.join(' L ')} L 255,255 Z`;
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-[#C8CCD4]">RGB Tooncurve</span>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_ADJUSTMENTS.toneCurve.map((p) => ({ ...p })))}
          className="text-[11px] text-[#9A9FA8] hover:text-[#F2F2F0] transition-colors cursor-pointer"
        >
          Reset curve
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${size} ${size}`}
        onPointerMove={(e) => {
          if (activeIdx !== null) {
            updatePointFromEvent(e.clientX, e.clientY, activeIdx);
          }
        }}
        onPointerUp={() => setActiveIdx(null)}
        onPointerLeave={() => setActiveIdx(null)}
        className="w-full h-44 rounded-lg bg-[#0C0D0F] border border-white/[0.08] touch-none select-none cursor-crosshair"
      >
        {/* Grid lines */}
        {[64, 128, 192].map((g) => (
          <g key={g} stroke="rgba(255,255,255,0.06)" strokeWidth="1">
            <line x1={g} y1={0} x2={g} y2={255} />
            <line x1={0} y1={g} x2={255} y2={g} />
          </g>
        ))}

        {/* Baseline diagonal */}
        <line x1="0" y1="255" x2="255" y2="0" stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />

        {/* Live RGB Histogram */}
        {histogram && (
          <g opacity="0.28">
            <path d={histPath(histogram.r)} fill="#EF4444" />
            <path d={histPath(histogram.g)} fill="#22C55E" />
            <path d={histPath(histogram.b)} fill="#3B82F6" />
          </g>
        )}

        {/* Active Tone Curve */}
        <path d={pathD} fill="none" stroke="#E5A93C" strokeWidth="2.4" strokeLinejoin="round" />

        {/* Control Points */}
        {sorted.map((pt, idx) => (
          <circle
            key={idx}
            cx={pt.x}
            cy={255 - pt.y}
            r={activeIdx === idx ? 7 : 5.5}
            fill={activeIdx === idx ? '#E5A93C' : '#F2F2F0'}
            stroke="#0C0D0F"
            strokeWidth="2"
            className="cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => {
              e.stopPropagation();
              (e.target as Element).setPointerCapture?.(e.pointerId);
              setActiveIdx(idx);
            }}
          />
        ))}
      </svg>
    </div>
  );
};

export const SlidersInspector: React.FC<SlidersInspectorProps> = ({
  adjustments,
  histogram,
  mode,
  onChange,
  onResetAll,
}) => {
  const [activeHslKey, setActiveHslKey] = useState<HSLColorKey>('orange');

  const update = <K extends keyof PresetAdjustments>(key: K, val: PresetAdjustments[K]) => {
    onChange({ ...adjustments, [key]: val });
  };

  if (mode === 'hsl') {
    const activeCh = adjustments.hsl[activeHslKey];
    const updateHsl = (field: 'hue' | 'saturation' | 'luminance', val: number) => {
      onChange({
        ...adjustments,
        hsl: {
          ...adjustments.hsl,
          [activeHslKey]: {
            ...activeCh,
            [field]: val,
          },
        },
      });
    };

    const updateWheel = (
      zone: 'shadows' | 'midtones' | 'highlights',
      field: 'hue' | 'saturation' | 'luminance',
      val: number
    ) => {
      onChange({
        ...adjustments,
        colorGrading: {
          ...adjustments.colorGrading,
          [zone]: {
            ...adjustments.colorGrading[zone],
            [field]: val,
          },
        },
      });
    };

    return (
      <div className="flex flex-col gap-5">
        {/* HSL Color Mixer */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#F2F2F0]">HSL Kleurenmixer</span>
            <button
              type="button"
              onClick={() => onChange({ ...adjustments, hsl: DEFAULT_ADJUSTMENTS.hsl })}
              className="text-[11px] text-[#9A9FA8] hover:text-[#F2F2F0] cursor-pointer"
            >
              Reset HSL
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {HSL_CHANNELS.map((ch) => {
              const isSelected = activeHslKey === ch.key;
              const vals = adjustments.hsl[ch.key];
              const isModified = vals.hue !== 0 || vals.saturation !== 0 || vals.luminance !== 0;
              return (
                <button
                  key={ch.key}
                  type="button"
                  onClick={() => setActiveHslKey(ch.key)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#232730] border-[#E5A93C] text-[#F2F2F0]'
                      : 'bg-[#0C0D0F] border-white/[0.08] text-[#9A9FA8] hover:text-[#F2F2F0]'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: ch.color }}
                  />
                  <span className="truncate">{ch.label}</span>
                  {isModified && <span className="w-1 h-1 rounded-full bg-[#E5A93C] ml-auto shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2.5 pt-1">
            <SliderRow
              label="Kleurtoon (Hue)"
              value={activeCh.hue}
              min={-100}
              max={100}
              onChange={(v) => updateHsl('hue', v)}
            />
            <SliderRow
              label="Verzadiging"
              value={activeCh.saturation}
              min={-100}
              max={100}
              onChange={(v) => updateHsl('saturation', v)}
            />
            <SliderRow
              label="Luminantie"
              value={activeCh.luminance}
              min={-100}
              max={100}
              onChange={(v) => updateHsl('luminance', v)}
            />
          </div>
        </div>

        {/* 3-Way Color Grading */}
        <div className="pt-4 border-t border-white/[0.08] flex flex-col gap-3.5">
          <span className="text-xs font-medium text-[#F2F2F0]">Color Grading (Split Toning)</span>

          {(['shadows', 'midtones', 'highlights'] as const).map((zone) => {
            const labels = {
              shadows: 'Schaduwen',
              midtones: 'Middentonen',
              highlights: 'Hooglichten',
            };
            const w = adjustments.colorGrading[zone];
            return (
              <div key={zone} className="flex flex-col gap-2 pb-2.5 border-b border-white/[0.05] last:border-b-0 last:pb-0">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#C8CCD4] font-medium">{labels[zone]}</span>
                  <span
                    className="w-4 h-4 rounded-full border border-white/20"
                    style={{
                      backgroundColor: `hsl(${w.hue}, ${Math.max(15, w.saturation)}%, 52%)`,
                      opacity: w.saturation === 0 ? 0.25 : 1,
                    }}
                  />
                </div>
                <SliderRow
                  label="Tint (°)"
                  value={w.hue}
                  min={0}
                  max={360}
                  onChange={(v) => updateWheel(zone, 'hue', v)}
                />
                <SliderRow
                  label="Intensiteit"
                  value={w.saturation}
                  min={0}
                  max={100}
                  onChange={(v) => updateWheel(zone, 'saturation', v)}
                />
              </div>
            );
          })}

          <SliderRow
            label="Balans (Schaduw ↔ Hooglicht)"
            value={adjustments.colorGrading.balance}
            min={-100}
            max={100}
            onChange={(v) =>
              onChange({
                ...adjustments,
                colorGrading: { ...adjustments.colorGrading, balance: v },
              })
            }
          />
        </div>

        {/* Grain & Vignette */}
        <div className="pt-4 border-t border-white/[0.08] flex flex-col gap-2.5">
          <span className="text-xs font-medium text-[#F2F2F0]">Effecten</span>
          <SliderRow
            label="Filmkorrel"
            value={adjustments.grainAmount}
            min={0}
            max={100}
            onChange={(v) => update('grainAmount', v)}
          />
          <SliderRow
            label="Korrelgrootte"
            value={adjustments.grainSize}
            min={0}
            max={100}
            defaultValue={25}
            onChange={(v) => update('grainSize', v)}
          />
          <SliderRow
            label="Vignettering"
            value={adjustments.vignetteAmount}
            min={-100}
            max={100}
            onChange={(v) => update('vignetteAmount', v)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#F2F2F0]">Basis & Lichtbalans</span>
        <button
          type="button"
          onClick={onResetAll}
          className="inline-flex items-center gap-1 text-xs text-[#9A9FA8] hover:text-[#F2F2F0] transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Alles resetten</span>
        </button>
      </div>

      <ToneCurveEditor
        points={adjustments.toneCurve}
        histogram={histogram}
        onChange={(curve) => update('toneCurve', curve)}
      />

      {/* White Balance */}
      <div className="pt-3 border-t border-white/[0.08] flex flex-col gap-2.5">
        <span className="text-xs font-medium text-[#9A9FA8]">Witbalans</span>
        <SliderRow
          label="Temperatuur"
          value={adjustments.temperature}
          min={-100}
          max={100}
          onChange={(v) => update('temperature', v)}
        />
        <SliderRow
          label="Kleurtoon (Tint)"
          value={adjustments.tint}
          min={-100}
          max={100}
          onChange={(v) => update('tint', v)}
        />
      </div>

      {/* Tone */}
      <div className="pt-3 border-t border-white/[0.08] flex flex-col gap-2.5">
        <span className="text-xs font-medium text-[#9A9FA8]">Toon</span>
        <SliderRow
          label="Belichting (EV)"
          value={adjustments.exposure}
          min={-3}
          max={3}
          step={0.05}
          decimals={2}
          onChange={(v) => update('exposure', v)}
        />
        <SliderRow
          label="Contrast"
          value={adjustments.contrast}
          min={-100}
          max={100}
          onChange={(v) => update('contrast', v)}
        />
        <SliderRow
          label="Hooglichten"
          value={adjustments.highlights}
          min={-100}
          max={100}
          onChange={(v) => update('highlights', v)}
        />
        <SliderRow
          label="Schaduwen"
          value={adjustments.shadows}
          min={-100}
          max={100}
          onChange={(v) => update('shadows', v)}
        />
        <SliderRow
          label="Witte tinten"
          value={adjustments.whites}
          min={-100}
          max={100}
          onChange={(v) => update('whites', v)}
        />
        <SliderRow
          label="Zwarte tinten"
          value={adjustments.blacks}
          min={-100}
          max={100}
          onChange={(v) => update('blacks', v)}
        />
      </div>

      {/* Presence */}
      <div className="pt-3 border-t border-white/[0.08] flex flex-col gap-2.5">
        <span className="text-xs font-medium text-[#9A9FA8]">Aanwezigheid</span>
        <SliderRow
          label="Textuur"
          value={adjustments.texture}
          min={-100}
          max={100}
          onChange={(v) => update('texture', v)}
        />
        <SliderRow
          label="Helderheid (Clarity)"
          value={adjustments.clarity}
          min={-100}
          max={100}
          onChange={(v) => update('clarity', v)}
        />
        <SliderRow
          label="Nevel verwijderen"
          value={adjustments.dehaze}
          min={-100}
          max={100}
          onChange={(v) => update('dehaze', v)}
        />
        <SliderRow
          label="Levendigheid (Vibrance)"
          value={adjustments.vibrance}
          min={-100}
          max={100}
          onChange={(v) => update('vibrance', v)}
        />
        <SliderRow
          label="Verzadiging"
          value={adjustments.saturation}
          min={-100}
          max={100}
          onChange={(v) => update('saturation', v)}
        />
      </div>
    </div>
  );
};
