import React, { useState } from 'react';
import { ArrowUp, RotateCcw, BookmarkPlus, Eye, Loader2 } from 'lucide-react';
import { LightroomPreset } from '../types/preset';

export type PromptMode = 'modify' | 'create';

interface AiPromptStudioProps {
  preset: LightroomPreset;
  promptMode: PromptMode;
  onChangePromptMode: (mode: PromptMode) => void;
  isGenerating: boolean;
  errorMessage: string | null;
  includeActivePhoto: boolean;
  onToggleIncludePhoto: (val: boolean) => void;
  onSubmitPrompt: (prompt: string, mode: PromptMode) => void;
  onRevertIteration: (iterationId: string) => void;
  onSavePresetToLibrary: () => void;
  onUpdatePresetName: (name: string) => void;
  savedFeedback: boolean;
}

const MODIFY_QUICK_PROMPTS: Array<{ label: string; prompt: string }> = [
  {
    label: 'Dieper & filmischer',
    prompt: 'Maak de schaduwen dieper en filmischer met een lichte matte zwartlift en zachte hooglicht-rolloff.',
  },
  {
    label: 'Warm gouden uur',
    prompt: 'Voeg een warme gouden-uur gloed toe met rijke amber hooglichten en zachte, vleiende huidtinten.',
  },
  {
    label: 'Koele Scandinavische look',
    prompt: 'Verkoel de witbalans naar een ingetogen Scandinavische stijl met gedempt groen en leisteenblauwe schaduwen.',
  },
  {
    label: 'Minder verzadigd groen',
    prompt: 'Demp felle groene en gele tinten richting ingetogen olijfgroen zodat het onderwerp beter naar voren komt.',
  },
  {
    label: 'Huidtinten flatteren',
    prompt: 'Optimaliseer de oranje en rode kanalen voor natuurlijke, zachte huidtinten met iets lagere textuur.',
  },
  {
    label: 'Minder korrel',
    prompt: 'Verwijder de filmkorrel voor een schone, moderne digitale uitstraling.',
  },
];

const CREATE_QUICK_PROMPTS: Array<{ label: string; prompt: string }> = [
  {
    label: 'Kodachrome 70s Roadtrip',
    prompt: 'Een nostalgische jaren 70 Kodachrome roadtrip-stijl met rijke rode accenten, warme schaduwen, stevig contrast en analoge korrel.',
  },
  {
    label: 'Classic Chrome Reportage',
    prompt: 'Fujifilm Classic Chrome documentairestijl: ingetogen verzadiging, diepe cyaan-blauwe tinten en strakke hooglichten.',
  },
  {
    label: 'Teal & Amber Bioscoop',
    prompt: 'Dramatische bioscooplook met koele teal schaduwen, warme amber hooglichten en diep microcontrast.',
  },
  {
    label: 'Luchtige Japanse Film',
    prompt: 'Heldere, luchtige Japanse overbelichte filmlook met pastel tinten, opgelichte schaduwen en zachte hooglichten.',
  },
  {
    label: 'Donkere Noordse Kust',
    prompt: 'Sombere Noord-Europese editorial look met koele leisteen-kleuren, matte zwarttinten en gedempt groen.',
  },
  {
    label: 'Zilvergelatine Zwart-Wit',
    prompt: 'Klassiek hoog-contrast analoog zwart-wit profiel met donkere luchten, heldere huidtinten en stevige korrel.',
  },
];

export const AiPromptStudio: React.FC<AiPromptStudioProps> = ({
  preset,
  promptMode,
  onChangePromptMode,
  isGenerating,
  errorMessage,
  includeActivePhoto,
  onToggleIncludePhoto,
  onSubmitPrompt,
  onRevertIteration,
  onSavePresetToLibrary,
  onUpdatePresetName,
  savedFeedback,
}) => {
  const [promptInput, setPromptInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim() || isGenerating) return;
    onSubmitPrompt(promptInput.trim(), promptMode);
    setPromptInput('');
  };

  const latestIteration = preset.history[0] ?? null;
  const quickList = promptMode === 'create' ? CREATE_QUICK_PROMPTS : MODIFY_QUICK_PROMPTS;

  return (
    <div className="flex flex-col gap-4">
      {/* Active preset header + inline rename + save */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/[0.08]">
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={preset.name}
            onChange={(e) => onUpdatePresetName(e.target.value)}
            aria-label="Naam van preset"
            className="w-full bg-transparent font-display text-base font-semibold text-[#F2F2F0] focus:outline-none focus:bg-[#1C1F24] rounded px-1.5 py-0.5 -ml-1.5 transition-colors"
          />
          <p className="text-xs text-[#9A9FA8] mt-0.5 line-clamp-2">{preset.description}</p>
        </div>

        <button
          type="button"
          onClick={onSavePresetToLibrary}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-white/[0.12] bg-[#1C1F24] hover:bg-[#252930] text-[#F2F2F0] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <BookmarkPlus className="w-3.5 h-3.5 text-[#E5A93C]" />
          <span>{savedFeedback ? 'Opgeslagen' : 'Opslaan'}</span>
        </button>
      </div>

      {/* Mode toggle: Modify current vs Create brand new style */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#0C0D0F] border border-white/[0.08]">
        <button
          type="button"
          onClick={() => onChangePromptMode('modify')}
          className={`py-1.5 px-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            promptMode === 'modify'
              ? 'bg-[#1C1F24] text-[#F2F2F0] border border-white/[0.08]'
              : 'text-[#9A9FA8] hover:text-[#F2F2F0]'
          }`}
        >
          Bestaande aanpassen
        </button>
        <button
          type="button"
          onClick={() => onChangePromptMode('create')}
          className={`py-1.5 px-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            promptMode === 'create'
              ? 'bg-[#1C1F24] text-[#E5A93C] border border-[#E5A93C]/30'
              : 'text-[#9A9FA8] hover:text-[#F2F2F0]'
          }`}
        >
          Nieuwe stijl creëren
        </button>
      </div>

      {/* Natural language prompt form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        <label htmlFor="preset-prompt-input" className="text-xs font-medium text-[#C8CCD4]">
          {promptMode === 'create'
            ? 'Beschrijf de nieuwe stijl die je wilt creëren'
            : 'Beschrijf hoe je de huidige stijl wilt aanpassen'}
        </label>

        <div className="relative rounded-xl border border-white/[0.12] bg-[#0C0D0F] focus-within:border-[#E5A93C] transition-colors">
          <textarea
            id="preset-prompt-input"
            rows={3}
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (promptInput.trim() && !isGenerating) {
                  onSubmitPrompt(promptInput.trim(), promptMode);
                  setPromptInput('');
                }
              }
            }}
            placeholder={
              promptMode === 'create'
                ? "Bijv. 'Creëer een warme jaren 70 Kodachrome roadtrip-stijl met zachte matte schaduwen en lichte filmkorrel...'"
                : "Bijv. 'Maak de schaduwen iets koeler, bescherm de huidtinten en voeg subtiele analoge korrel toe...'"
            }
            className="w-full bg-transparent px-3.5 pt-3 pb-11 text-sm text-[#F2F2F0] placeholder:text-[#6B717C] resize-none focus:outline-none"
          />

          <div className="absolute bottom-2.5 left-3 right-2.5 flex items-center justify-between gap-2">
            <label className="inline-flex items-center gap-1.5 text-[11px] text-[#9A9FA8] hover:text-[#F2F2F0] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeActivePhoto}
                onChange={(e) => onToggleIncludePhoto(e.target.checked)}
                className="accent-[#E5A93C] rounded cursor-pointer"
              />
              <Eye className="w-3.5 h-3.5" />
              <span>Actieve foto meekijken</span>
            </label>

            <button
              type="submit"
              disabled={!promptInput.trim() || isGenerating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#E5A93C] hover:bg-[#F0B84E] disabled:opacity-40 text-[#0C0D0F] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{promptMode === 'create' ? 'Creëren...' : 'Aanpassen...'}</span>
                </>
              ) : (
                <>
                  <ArrowUp className="w-3.5 h-3.5" />
                  <span>{promptMode === 'create' ? 'Creëer stijl' : 'Pas toe'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {errorMessage && (
        <div className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-300">
          {errorMessage}
        </div>
      )}

      {/* Quick prompt buttons */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-[#9A9FA8]">
          {promptMode === 'create' ? 'Stijl-ideeën om vanaf nul te creëren' : 'Snelle stijlaanpassingen'}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {quickList.map((qp) => (
            <button
              key={qp.label}
              type="button"
              disabled={isGenerating}
              onClick={() => onSubmitPrompt(qp.prompt, promptMode)}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-white/[0.08] bg-[#1C1F24] hover:border-[#E5A93C]/50 hover:text-[#F2F2F0] text-[#C8CCD4] transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              {qp.label}
            </button>
          ))}
        </div>
      </div>

      {/* Latest AI reasoning & adjustment diff */}
      {latestIteration && (
        <div className="pt-3 border-t border-white/[0.08] flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#E5A93C]">Laatste AI-resultaat</span>
            <button
              type="button"
              onClick={() => onRevertIteration(latestIteration.id)}
              className="inline-flex items-center gap-1 text-xs text-[#9A9FA8] hover:text-[#F2F2F0] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Herstel vorige stand</span>
            </button>
          </div>
          <p className="text-xs text-[#D4D7DD] leading-relaxed">{latestIteration.reasoning}</p>
          {latestIteration.changedFields.length > 0 && (
            <p className="text-xs font-mono tabular-nums text-[#9A9FA8] leading-relaxed">
              {latestIteration.changedFields.join(' · ')}
            </p>
          )}
        </div>
      )}

      {/* Compact prompt iteration history */}
      {preset.history.length > 1 && (
        <div className="pt-3 border-t border-white/[0.08] flex flex-col gap-2">
          <span className="text-xs font-medium text-[#9A9FA8]">
            Eerdere versies ({preset.history.length})
          </span>
          <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
            {preset.history.slice(1).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-lg bg-[#0C0D0F] border border-white/[0.06]"
              >
                <span className="text-xs text-[#C8CCD4] truncate">{item.prompt}</span>
                <button
                  type="button"
                  onClick={() => onRevertIteration(item.id)}
                  className="text-[11px] font-medium text-[#E5A93C] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Zet terug
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
