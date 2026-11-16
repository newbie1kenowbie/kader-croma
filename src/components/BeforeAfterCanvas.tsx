import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Columns2, Eye, ImagePlus, Download } from 'lucide-react';
import { applyPresetToImageData } from '../lib/colorEngine';
import { HistogramData, PresetAdjustments, SamplePhoto } from '../types/preset';

interface BeforeAfterCanvasProps {
  imageSrc: string;
  imageTitle: string;
  imageExif: string;
  adjustments: PresetAdjustments;
  samplePhotos: SamplePhoto[];
  activeSampleId: string;
  onSelectSample: (sample: SamplePhoto) => void;
  onUploadOwnPhoto: (dataUrl: string, fileName: string) => void;
  onHistogramUpdate: (histogram: HistogramData | null) => void;
  onBase64Ready: (base64: string, mimeType: string) => void;
}

type CompareMode = 'split' | 'graded' | 'original';

export const BeforeAfterCanvas: React.FC<BeforeAfterCanvasProps> = ({
  imageSrc,
  imageTitle,
  imageExif,
  adjustments,
  samplePhotos,
  activeSampleId,
  onSelectSample,
  onUploadOwnPhoto,
  onHistogramUpdate,
  onBase64Ready,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const gradedCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceImageDataRef = useRef<ImageData | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [compareMode, setCompareMode] = useState<CompareMode>('split');
  const [splitPercent, setSplitPercent] = useState<number>(50);
  const [isHoldingOriginal, setIsHoldingOriginal] = useState<boolean>(false);
  const [isDraggingDivider, setIsDraggingDivider] = useState<boolean>(false);
  const [imageReady, setImageReady] = useState<boolean>(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number>(4 / 3);

  // Load source image onto offscreen buffer and draw original canvas
  useEffect(() => {
    let cancelled = false;
    setImageReady(false);
    setImageError(null);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      loadedImageRef.current = img;

      const maxDim = 1080;
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      setAspectRatio(w / h);

      const origCanvas = originalCanvasRef.current;
      const gradCanvas = gradedCanvasRef.current;
      if (!origCanvas || !gradCanvas) return;

      origCanvas.width = w;
      origCanvas.height = h;
      gradCanvas.width = w;
      gradCanvas.height = h;

      const ctx = origCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      sourceImageDataRef.current = imgData;

      // Provide compressed JPEG base64 (~640px max) for AI Vision context
      const aiMax = 640;
      const aiScale = Math.min(1, aiMax / Math.max(img.naturalWidth, img.naturalHeight));
      const aiCanvas = document.createElement('canvas');
      aiCanvas.width = Math.max(1, Math.round(img.naturalWidth * aiScale));
      aiCanvas.height = Math.max(1, Math.round(img.naturalHeight * aiScale));
      const aiCtx = aiCanvas.getContext('2d');
      if (aiCtx) {
        aiCtx.drawImage(img, 0, 0, aiCanvas.width, aiCanvas.height);
        const dataUrl = aiCanvas.toDataURL('image/jpeg', 0.82);
        onBase64Ready(dataUrl, 'image/jpeg');
      }

      setImageReady(true);
    };
    img.onerror = () => {
      if (cancelled) return;
      setImageError('Voorbeeldafbeelding kon niet worden geladen.');
      onHistogramUpdate(null);
    };
    img.src = imageSrc;

    return () => {
      cancelled = true;
    };
  }, [imageSrc, onBase64Ready, onHistogramUpdate]);

  // Re-run pixel color grading whenever adjustments or loaded image change
  useEffect(() => {
    if (!imageReady || !sourceImageDataRef.current || !gradedCanvasRef.current) return;

    const rafId = requestAnimationFrame(() => {
      const src = sourceImageDataRef.current;
      const canvas = gradedCanvasRef.current;
      if (!src || !canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { graded, histogram } = applyPresetToImageData(src, adjustments);
      ctx.putImageData(graded, 0, 0);
      onHistogramUpdate(histogram);
    });

    return () => cancelAnimationFrame(rafId);
  }, [imageReady, adjustments, onHistogramUpdate]);

  // Spacebar shortcut to preview original
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        e.code === 'Space' &&
        target &&
        target.tagName !== 'INPUT' &&
        target.tagName !== 'TEXTAREA' &&
        !target.isContentEditable
      ) {
        e.preventDefault();
        setIsHoldingOriginal(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsHoldingOriginal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const updateSplitFromPointer = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSplitPercent(Math.max(2, Math.min(98, pct)));
  }, []);

  useEffect(() => {
    if (!isDraggingDivider) return;
    const onMove = (e: PointerEvent) => updateSplitFromPointer(e.clientX);
    const onUp = () => setIsDraggingDivider(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [isDraggingDivider, updateSplitFromPointer]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUploadOwnPhoto(reader.result, file.name);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDownloadGradedPhoto = () => {
    const img = loadedImageRef.current;
    if (!img) return;
    const exportCanvas = document.createElement('canvas');
    const maxExport = 2200;
    const scale = Math.min(1, maxExport / Math.max(img.naturalWidth, img.naturalHeight));
    exportCanvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    exportCanvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, exportCanvas.width, exportCanvas.height);
    const srcData = ctx.getImageData(0, 0, exportCanvas.width, exportCanvas.height);
    const { graded } = applyPresetToImageData(srcData, adjustments);
    ctx.putImageData(graded, 0, 0);

    const url = exportCanvas.toDataURL('image/jpeg', 0.94);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${imageTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-bewerkt.jpg`;
    a.click();
  };

  const effectiveMode: CompareMode = isHoldingOriginal ? 'original' : compareMode;

  return (
    <section className="flex flex-col gap-3 min-w-0">
      {/* Top toolbar over canvas */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-[#9A9FA8] min-w-0">
          <span className="font-medium text-[#F2F2F0] truncate">{imageTitle}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums whitespace-nowrap">{imageExif}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Segmented compare controls */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-[#14161A] border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setCompareMode('split')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                compareMode === 'split'
                  ? 'bg-[#232730] text-[#F2F2F0]'
                  : 'text-[#9A9FA8] hover:text-[#F2F2F0]'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>Split</span>
            </button>
            <button
              type="button"
              onClick={() => setCompareMode('graded')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                compareMode === 'graded'
                  ? 'bg-[#232730] text-[#F2F2F0]'
                  : 'text-[#9A9FA8] hover:text-[#F2F2F0]'
              }`}
            >
              Bewerkt
            </button>
            <button
              type="button"
              onClick={() => setCompareMode('original')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                compareMode === 'original'
                  ? 'bg-[#232730] text-[#F2F2F0]'
                  : 'text-[#9A9FA8] hover:text-[#F2F2F0]'
              }`}
            >
              Origineel
            </button>
          </div>

          {/* Hold-for-original button */}
          <button
            type="button"
            onPointerDown={() => setIsHoldingOriginal(true)}
            onPointerUp={() => setIsHoldingOriginal(false)}
            onPointerLeave={() => setIsHoldingOriginal(false)}
            title="Houd ingedrukt (of druk op Spatiebalk) om het origineel te zien"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isHoldingOriginal
                ? 'bg-[#E5A93C]/20 border-[#E5A93C] text-[#E5A93C]'
                : 'bg-[#14161A] border-white/[0.08] text-[#9A9FA8] hover:text-[#F2F2F0]'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Origineel (Spatie)</span>
          </button>

          {/* Download graded JPG */}
          <button
            type="button"
            onClick={handleDownloadGradedPhoto}
            disabled={!imageReady}
            title="Download bewerkte foto als JPG"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-[#14161A] border border-white/[0.08] text-[#9A9FA8] hover:text-[#F2F2F0] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">JPG</span>
          </button>
        </div>
      </div>

      {/* Main Darkroom Preview Viewport */}
      <div
        ref={containerRef}
        onPointerDown={(e) => {
          if (effectiveMode === 'split') {
            setIsDraggingDivider(true);
            updateSplitFromPointer(e.clientX);
          }
        }}
        className={`relative w-full overflow-hidden rounded-xl border border-white/[0.08] bg-[#08090B] select-none flex items-center justify-center ${
          effectiveMode === 'split' ? 'cursor-ew-resize' : 'cursor-default'
        }`}
        style={{
          aspectRatio: `${aspectRatio}`,
          maxHeight: '66vh',
        }}
      >
        {imageError ? (
          <div className="p-8 text-center text-sm text-[#9A9FA8]">{imageError}</div>
        ) : (
          <>
            {/* Original Canvas (Bottom Layer) */}
            <canvas
              ref={originalCanvasRef}
              className="w-full h-full object-contain block"
              style={{
                opacity: imageReady ? 1 : 0,
              }}
            />

            {/* Graded Canvas (Top Clipped Layer) */}
            <canvas
              ref={gradedCanvasRef}
              className="absolute inset-0 w-full h-full object-contain block pointer-events-none"
              style={{
                opacity: !imageReady || effectiveMode === 'original' ? 0 : 1,
                clipPath:
                  effectiveMode === 'split'
                    ? `inset(0 0 0 ${splitPercent}%)`
                    : 'inset(0 0 0 0)',
              }}
            />

            {/* Loading placeholder */}
            {!imageReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#14161A]/60">
                <span className="text-xs text-[#9A9FA8]">Foto voorbereiden in kleurengine...</span>
              </div>
            )}

            {/* Split Divider & Labels */}
            {imageReady && effectiveMode === 'split' && (
              <>
                <div
                  className="absolute top-0 bottom-0 w-px bg-white/85 shadow-[0_0_8px_rgba(0,0,0,0.65)] pointer-events-none"
                  style={{ left: `${splitPercent}%` }}
                >
                  <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#0C0D0F]/90 border border-white/40 flex items-center justify-center shadow-lg">
                    <div className="flex items-center gap-0.5">
                      <span className="w-0.5 h-3 bg-white/80 rounded-full" />
                      <span className="w-0.5 h-3 bg-white/80 rounded-full" />
                    </div>
                  </div>
                </div>
                <span className="absolute top-3 left-3 px-2 py-0.5 text-[11px] font-medium bg-black/65 text-white/90 rounded backdrop-blur-sm pointer-events-none">
                  Origineel
                </span>
                <span className="absolute top-3 right-3 px-2 py-0.5 text-[11px] font-medium bg-black/65 text-[#E5A93C] rounded backdrop-blur-sm pointer-events-none">
                  Preset
                </span>
              </>
            )}
          </>
        )}
      </div>

      {/* Filmstrip: Sample Photos & Own Photo Upload */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
        {samplePhotos.map((photo) => {
          const isActive = activeSampleId === photo.id;
          return (
            <button
              key={photo.id}
              type="button"
              onClick={() => onSelectSample(photo)}
              className={`group relative shrink-0 w-24 h-16 rounded-lg overflow-hidden border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5A93C] ${
                isActive
                  ? 'border-[#E5A93C] ring-1 ring-[#E5A93C]/50'
                  : 'border-white/[0.08] opacity-75 hover:opacity-100'
              }`}
              title={photo.title}
            >
              <img
                src={photo.url}
                alt={photo.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-1.5 py-1 text-left">
                <span className="block text-[10px] font-medium text-white truncate">
                  {photo.title}
                </span>
              </div>
            </button>
          );
        })}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 h-16 px-4 rounded-lg border border-dashed border-white/20 hover:border-[#E5A93C]/70 bg-[#14161A] hover:bg-[#1A1D23] text-xs font-medium text-[#C8CCD4] hover:text-[#F2F2F0] inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
        >
          <ImagePlus className="w-4 h-4 text-[#E5A93C]" />
          <span>Eigen foto testen</span>
        </button>
      </div>
    </section>
  );
};
