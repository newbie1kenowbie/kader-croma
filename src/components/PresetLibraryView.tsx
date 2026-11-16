import React, { useEffect, useRef, useState } from 'react';
import { Download, Copy, Trash2, ArrowRight } from 'lucide-react';
import { applyPresetToImageData } from '../lib/colorEngine';
import { LightroomPreset } from '../types/preset';

interface PresetLibraryViewProps {
  starterPresets: LightroomPreset[];
  customPresets: LightroomPreset[];
  activePresetId: string;
  previewPhotoUrl: string;
  onSelectPreset: (preset: LightroomPreset) => void;
  onDownloadXmp: (preset: LightroomPreset) => void;
  onDuplicatePreset: (preset: LightroomPreset) => void;
  onDeleteCustomPreset: (id: string) => void;
}

type LibraryFilter = 'all' | 'custom' | 'film' | 'moody' | 'portret' | 'geimporteerd';

const CATEGORY_LABELS: Record<string, string> = {
  film: 'Film & Analoog',
  moody: 'Moody',
  portret: 'Portret & Interieur',
  landschap: 'Landschap',
  geimporteerd: 'Geïmporteerd',
  aangepast: 'Aangepast',
};

const PresetThumbnail: React.FC<{ imageUrl: string; preset: LightroomPreset }> = ({
  imageUrl,
  preset,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled || !canvasRef.current) return;
      const w = 320;
      const h = Math.round((img.naturalHeight / img.naturalWidth) * w) || 240;
      const canvas = canvasRef.current;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      const { graded } = applyPresetToImageData(data, preset.adjustments);
      ctx.putImageData(graded, 0, 0);
    };
    img.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl, preset.adjustments]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-44 object-cover block bg-[#08090B]"
    />
  );
};

export const PresetLibraryView: React.FC<PresetLibraryViewProps> = ({
  starterPresets,
  customPresets,
  activePresetId,
  previewPhotoUrl,
  onSelectPreset,
  onDownloadXmp,
  onDuplicatePreset,
  onDeleteCustomPreset,
}) => {
  const [filter, setFilter] = useState<LibraryFilter>('all');

  const customIds = new Set(customPresets.map((p) => p.id));
  const combined = [...customPresets, ...starterPresets];

  const filtered = combined.filter((p) => {
    if (filter === 'all') return true;
    if (filter === 'custom') return customIds.has(p.id);
    return p.category === filter;
  });

  const filters: Array<{ id: LibraryFilter; label: string }> = [
    { id: 'all', label: 'Alle stijlen' },
    { id: 'custom', label: `Mijn presets (${customPresets.length})` },
    { id: 'film', label: 'Film' },
    { id: 'moody', label: 'Moody' },
    { id: 'portret', label: 'Portret' },
    { id: 'geimporteerd', label: 'Geïmporteerd' },
  ];

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#F2F2F0] [text-wrap:balance]">
            Stijlbibliotheek & Opgeslagen Presets
          </h1>
          <p className="text-sm text-[#9A9FA8] mt-1">
            Kies een basisstijl om aan te passen met AI-prompts, of beheer je eigen opgeslagen Lightroom presets.
          </p>
        </div>

        {/* Segmented filter bar */}
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#14161A] border border-white/[0.08]">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filter === f.id
                  ? 'bg-[#232730] text-[#F2F2F0]'
                  : 'text-[#9A9FA8] hover:text-[#F2F2F0]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-[#14161A] p-10 text-center flex flex-col items-center gap-2">
          <p className="text-sm font-medium text-[#F2F2F0]">
            Geen presets gevonden in deze categorie
          </p>
          <p className="text-xs text-[#9A9FA8] max-w-md">
            Pas een bestaande stijl aan in de Studio en klik op Opslaan, of importeer een bestaand .XMP bestand.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((preset) => {
            const isCustom = customIds.has(preset.id);
            const isActive = preset.id === activePresetId;

            return (
              <article
                key={preset.id}
                className={`rounded-xl border bg-[#14161A] overflow-hidden flex flex-col transition-colors ${
                  isActive ? 'border-[#E5A93C]' : 'border-white/[0.08] hover:border-white/20'
                }`}
              >
                <div className="relative overflow-hidden border-b border-white/[0.06]">
                  <PresetThumbnail imageUrl={previewPhotoUrl} preset={preset} />
                </div>

                <div className="p-4 flex flex-col gap-2.5 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-display text-base font-semibold text-[#F2F2F0] leading-snug">
                      {preset.name}
                    </h2>
                  </div>

                  {/* Unboxed clean metadata with typographic separators */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#9A9FA8] font-mono tabular-nums">
                    <span className="font-sans text-[#C8CCD4]">
                      {isCustom ? 'Opgeslagen' : CATEGORY_LABELS[preset.category] || 'Basis'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      EV {preset.adjustments.exposure >= 0 ? '+' : ''}
                      {preset.adjustments.exposure.toFixed(1)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Contrast {preset.adjustments.contrast}</span>
                    <span aria-hidden="true">·</span>
                    <span>Korrel {preset.adjustments.grainAmount}</span>
                  </div>

                  <p className="text-xs text-[#9A9FA8] leading-relaxed line-clamp-2">
                    {preset.description}
                  </p>

                  <div className="mt-auto pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectPreset(preset)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#E5A93C] hover:bg-[#F0B84E] text-[#0C0D0F] transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <span>{isActive ? 'Actief in Studio' : 'Openen in Studio'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onDuplicatePreset(preset)}
                        title="Dupliceer naar Mijn Presets"
                        className="p-2 rounded-lg text-[#9A9FA8] hover:text-[#F2F2F0] hover:bg-[#1C1F24] transition-colors cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDownloadXmp(preset)}
                        title="Download .XMP bestand"
                        className="p-2 rounded-lg text-[#9A9FA8] hover:text-[#F2F2F0] hover:bg-[#1C1F24] transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => onDeleteCustomPreset(preset.id)}
                          title="Verwijder opgeslagen preset"
                          className="p-2 rounded-lg text-[#9A9FA8] hover:text-red-400 hover:bg-[#1C1F24] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
