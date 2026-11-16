import React, { useRef, useState } from 'react';
import { FileCode2, ImagePlus, Upload, Loader2, ArrowRight } from 'lucide-react';
import { parseImportedPreset, SAMPLE_XMP_SNIPPET } from '../lib/xmpParser';
import { LightroomPreset } from '../types/preset';

interface ImportStyleViewProps {
  onImportPreset: (preset: LightroomPreset) => void;
}

export const ImportStyleView: React.FC<ImportStyleViewProps> = ({ onImportPreset }) => {
  // XMP / lrtemplate state
  const xmpFileRef = useRef<HTMLInputElement>(null);
  const [rawCode, setRawCode] = useState<string>('');
  const [fileName, setFileName] = useState<string>('Geïmporteerde Preset');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<LightroomPreset | null>(null);

  // Photo style extraction state
  const refPhotoInputRef = useRef<HTMLInputElement>(null);
  const [refImageDataUrl, setRefImageDataUrl] = useState<string | null>(null);
  const [refMimeType, setRefMimeType] = useState<string>('image/jpeg');
  const [styleName, setStyleName] = useState<string>('');
  const [extractHint, setExtractHint] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const handleParseText = (text: string, sourceFileName?: string) => {
    setRawCode(text);
    if (sourceFileName) setFileName(sourceFileName);
    setParseError(null);

    if (!text.trim()) {
      setParsedPreview(null);
      return;
    }

    try {
      const parsed = parseImportedPreset(text, sourceFileName || fileName);
      setParsedPreview(parsed);
    } catch {
      setParseError('Kon de ingevoerde code niet herkennen als een geldig .XMP, .lrtemplate of JSON bestand.');
      setParsedPreview(null);
    }
  };

  const handleXmpFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleParseText(reader.result, file.name);
      }
    };
    reader.readAsText(file);
  };

  const handleRefPhotoFile = (file: File) => {
    setExtractError(null);
    setRefMimeType(file.type || 'image/jpeg');

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;

      // Resize large reference photos cleanly to max 960px for fast AI analysis
      const img = new Image();
      img.onload = () => {
        const maxDim = 960;
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setRefImageDataUrl(canvas.toDataURL('image/jpeg', 0.85));
          setRefMimeType('image/jpeg');
        } else {
          setRefImageDataUrl(reader.result as string);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const handleExtractStyle = async () => {
    if (!refImageDataUrl || isExtracting) return;
    setIsExtracting(true);
    setExtractError(null);

    try {
      const resp = await fetch('/api/presets/extract-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: refImageDataUrl,
          imageMimeType: refMimeType,
          styleName: styleName.trim() || undefined,
          prompt: extractHint.trim() || undefined,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Kon geen kleurstijl uit de referentiefoto halen.');
      }

      const newPreset: LightroomPreset = {
        id: `preset-${Date.now()}`,
        name: data.name,
        description: data.description,
        category: 'geimporteerd',
        source: 'photo-extract',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        adjustments: data.adjustments,
        history: [
          {
            id: `iter-${Date.now()}`,
            prompt: extractHint.trim() || 'Kleurstijl geëxtraheerd uit referentiefoto',
            reasoning: data.reasoning,
            changedFields: data.changedFields || [],
            timestamp: Date.now(),
            adjustmentsSnapshot: data.adjustments,
          },
        ],
      };

      onImportPreset(newPreset);
    } catch (err: any) {
      setExtractError(err?.message || 'Stijl-extractie mislukt.');
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
      <div className="max-w-2xl">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#F2F2F0] [text-wrap:balance]">
          Bestaande stijlen importeren of reverse-engineeren
        </h1>
        <p className="text-sm sm:text-base text-[#9A9FA8] mt-2 leading-relaxed">
          Laad een bestaand Lightroom <span className="font-mono text-[#F2F2F0]">.XMP</span> of{' '}
          <span className="font-mono text-[#F2F2F0]">.lrtemplate</span> bestand in, of upload een
          inspirerende referentiefoto zodat de AI-engine de volledige kleurgradatie vertaalt naar een
          bewerkbare preset.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Column 1: Import .XMP / .lrtemplate */}
        <section className="rounded-xl border border-white/[0.08] bg-[#14161A] p-6 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#F2F2F0]">
                1. Lightroom .XMP of .lrtemplate importeren
              </h2>
              <p className="text-xs text-[#9A9FA8] mt-1">
                Sleep een bestaand presetbestand of plak de XML-inhoud om er met prompts op voort te bouwen.
              </p>
            </div>
            <FileCode2 className="w-5 h-5 text-[#E5A93C] shrink-0" />
          </div>

          <input
            ref={xmpFileRef}
            type="file"
            accept=".xmp,.lrtemplate,.json,.xml,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleXmpFile(f);
              e.target.value = '';
            }}
            className="hidden"
          />

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleXmpFile(f);
            }}
            className="rounded-lg border border-dashed border-white/20 hover:border-[#E5A93C]/60 bg-[#0C0D0F] p-5 flex flex-col items-center justify-center text-center gap-2 transition-colors"
          >
            <Upload className="w-5 h-5 text-[#9A9FA8]" />
            <p className="text-xs text-[#C8CCD4]">
              Sleep een <span className="font-mono text-[#F2F2F0]">.xmp</span> of{' '}
              <span className="font-mono text-[#F2F2F0]">.lrtemplate</span> bestand hierheen
            </p>
            <div className="flex items-center gap-3 mt-1">
              <button
                type="button"
                onClick={() => xmpFileRef.current?.click()}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#1C1F24] hover:bg-[#252930] border border-white/[0.1] text-[#F2F2F0] transition-colors cursor-pointer"
              >
                Kies bestand
              </button>
              <button
                type="button"
                onClick={() => handleParseText(SAMPLE_XMP_SNIPPET, 'Goudzoekers Analoog 400.xmp')}
                className="text-xs font-medium text-[#E5A93C] hover:underline cursor-pointer"
              >
                Laad voorbeeld .XMP
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 flex-1">
            <label htmlFor="xmp-paste-area" className="text-xs font-medium text-[#C8CCD4]">
              Of plak XMP / lrtemplate inhoud
            </label>
            <textarea
              id="xmp-paste-area"
              rows={6}
              value={rawCode}
              onChange={(e) => handleParseText(e.target.value)}
              placeholder='<x:xmpmeta ... crs:Exposure2012="+0.25" crs:Contrast2012="-12" ...>'
              className="w-full rounded-lg border border-white/[0.1] bg-[#0C0D0F] p-3 font-mono text-xs text-[#D4D7DD] placeholder:text-[#555B66] focus:outline-none focus:border-[#E5A93C] resize-y"
            />
          </div>

          {parseError && (
            <p className="text-xs text-red-400">{parseError}</p>
          )}

          {parsedPreview && (
            <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#F2F2F0] truncate">{parsedPreview.name}</p>
                <p className="text-xs font-mono tabular-nums text-[#9A9FA8] mt-0.5 truncate">
                  EV {parsedPreview.adjustments.exposure >= 0 ? '+' : ''}
                  {parsedPreview.adjustments.exposure.toFixed(2)} · Contrast{' '}
                  {parsedPreview.adjustments.contrast} · Schaduwen {parsedPreview.adjustments.shadows} · Korrel{' '}
                  {parsedPreview.adjustments.grainAmount}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onImportPreset(parsedPreview)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#E5A93C] hover:bg-[#F0B84E] text-[#0C0D0F] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Open in Studio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </section>

        {/* Column 2: Reference Photo AI Style Extraction */}
        <section className="rounded-xl border border-white/[0.08] bg-[#14161A] p-6 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#F2F2F0]">
                2. Stijl overnemen van een referentiefoto
              </h2>
              <p className="text-xs text-[#9A9FA8] mt-1">
                Upload een foto waarvan je de kleurstijl mooi vindt. AI analyseert de curve, split toning en
                HSL-kleuren naar een eigen Lightroom preset.
              </p>
            </div>
            <ImagePlus className="w-5 h-5 text-[#E5A93C] shrink-0" />
          </div>

          <input
            ref={refPhotoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleRefPhotoFile(f);
              e.target.value = '';
            }}
            className="hidden"
          />

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleRefPhotoFile(f);
            }}
            onClick={() => refPhotoInputRef.current?.click()}
            className="relative h-48 rounded-lg border border-dashed border-white/20 hover:border-[#E5A93C]/60 bg-[#0C0D0F] overflow-hidden flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
          >
            {refImageDataUrl ? (
              <>
                <img
                  src={refImageDataUrl}
                  alt="Geüploade referentiefoto"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 flex items-center justify-between">
                  <span className="text-xs text-white font-medium">Referentiefoto gereed</span>
                  <span className="text-xs text-[#E5A93C]">Klik om te wijzigen</span>
                </div>
              </>
            ) : (
              <div className="p-5 flex flex-col items-center gap-2">
                <ImagePlus className="w-6 h-6 text-[#9A9FA8]" />
                <p className="text-xs text-[#C8CCD4]">
                  Klik of sleep hier een referentiefoto (JPG, PNG, WebP)
                </p>
                <span className="text-[11px] text-[#6B717C]">
                  Ideaal om looks uit magazines of preset-voorbeelden na te bouwen
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="extract-name" className="text-xs font-medium text-[#C8CCD4]">
                Naam van stijl (optioneel)
              </label>
              <input
                id="extract-name"
                type="text"
                value={styleName}
                onChange={(e) => setStyleName(e.target.value)}
                placeholder="Bijv. Parijs Herfstfilm"
                className="rounded-lg border border-white/[0.1] bg-[#0C0D0F] px-3 py-2 text-xs text-[#F2F2F0] placeholder:text-[#555B66] focus:outline-none focus:border-[#E5A93C]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="extract-hint" className="text-xs font-medium text-[#C8CCD4]">
                Extra aanwijzing (optioneel)
              </label>
              <input
                id="extract-hint"
                type="text"
                value={extractHint}
                onChange={(e) => setExtractHint(e.target.value)}
                placeholder="Bijv. Focus op zachte huidtinten"
                className="rounded-lg border border-white/[0.1] bg-[#0C0D0F] px-3 py-2 text-xs text-[#F2F2F0] placeholder:text-[#555B66] focus:outline-none focus:border-[#E5A93C]"
              />
            </div>
          </div>

          {extractError && (
            <p className="text-xs text-red-400">{extractError}</p>
          )}

          <div className="mt-auto pt-2 flex justify-end">
            <button
              type="button"
              disabled={!refImageDataUrl || isExtracting}
              onClick={handleExtractStyle}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-[#E5A93C] hover:bg-[#F0B84E] disabled:opacity-40 text-[#0C0D0F] transition-colors whitespace-nowrap cursor-pointer"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Kleurstijl analyseren...</span>
                </>
              ) : (
                <>
                  <span>Extraheer kleurstijl met AI</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
