import React, { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { presetToXmp } from '../lib/xmpParser';
import { LightroomPreset } from '../types/preset';

interface XmpInspectorViewProps {
  preset: LightroomPreset;
  onDownloadXmp: () => void;
}

export const XmpInspectorView: React.FC<XmpInspectorViewProps> = ({ preset, onDownloadXmp }) => {
  const [copied, setCopied] = useState(false);
  const xmpXml = presetToXmp(preset);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(xmpXml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <div className="max-w-[1160px] mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#F2F2F0]">
            Adobe Camera Raw .XMP Uitvoer
          </h1>
          <p className="text-sm text-[#9A9FA8] mt-1">
            Volledige Camera Raw XML-definitie voor <span className="text-[#F2F2F0] font-medium">{preset.name}</span>,
            direct klaar voor Lightroom Classic, Lightroom CC en Photoshop.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border border-white/[0.12] bg-[#14161A] hover:bg-[#1C1F24] text-[#F2F2F0] transition-colors whitespace-nowrap cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#E5A93C]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Gekopieerd' : 'Kopieer XML'}</span>
          </button>

          <button
            type="button"
            onClick={onDownloadXmp}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[#E5A93C] hover:bg-[#F0B84E] text-[#0C0D0F] transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .XMP</span>
          </button>
        </div>
      </div>

      {/* 3-step import guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/[0.08] bg-[#14161A] p-4">
          <span className="text-xs font-mono text-[#E5A93C]">01.</span>
          <h2 className="font-display text-sm font-semibold text-[#F2F2F0] mt-1">
            Download het .XMP bestand
          </h2>
          <p className="text-xs text-[#9A9FA8] mt-1 leading-relaxed">
            Sla de gegenereerde preset op als standaard Adobe Camera Raw XMP-profiel op je computer of telefoon.
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#14161A] p-4">
          <span className="text-xs font-mono text-[#E5A93C]">02.</span>
          <h2 className="font-display text-sm font-semibold text-[#F2F2F0] mt-1">
            Importeer in Lightroom
          </h2>
          <p className="text-xs text-[#9A9FA8] mt-1 leading-relaxed">
            Open de module Ontwikkelen → Voorinstellingen (+) → Voorinstellingen importeren en selecteer je .XMP.
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#14161A] p-4">
          <span className="text-xs font-mono text-[#E5A93C]">03.</span>
          <h2 className="font-display text-sm font-semibold text-[#F2F2F0] mt-1">
            Pas aan per shoot
          </h2>
          <p className="text-xs text-[#9A9FA8] mt-1 leading-relaxed">
            De preset blijft 100% non-destructief en alle schuifregelaars zijn in Lightroom verder fijn te stellen.
          </p>
        </div>
      </div>

      {/* Formatted XML view */}
      <div className="rounded-xl border border-white/[0.08] bg-[#08090B] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/[0.08] bg-[#14161A] flex items-center justify-between text-xs text-[#9A9FA8]">
          <span className="font-mono">
            {preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.xmp
          </span>
          <span className="font-mono tabular-nums">{xmpXml.split('\n').length} regels</span>
        </div>
        <pre className="p-4 overflow-x-auto text-xs font-mono text-[#D4D7DD] leading-relaxed max-h-[520px]">
          <code>{xmpXml}</code>
        </pre>
      </div>
    </div>
  );
};
