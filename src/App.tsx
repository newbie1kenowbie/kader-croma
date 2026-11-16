import React, { useCallback, useEffect, useState } from 'react';
import { AppView, TopBar } from './components/TopBar';
import { BeforeAfterCanvas } from './components/BeforeAfterCanvas';
import { AiPromptStudio } from './components/AiPromptStudio';
import { SlidersInspector } from './components/SlidersInspector';
import { ImportStyleView } from './components/ImportStyleView';
import { PresetLibraryView } from './components/PresetLibraryView';
import { XmpInspectorView } from './components/XmpInspectorView';
import { DesktopInstallView } from './components/DesktopInstallView';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { SAMPLE_PHOTOS, STARTER_PRESETS } from './lib/starterPresets';
import { transformPresetLocally } from './lib/localPresetEngine';
import { presetToXmp } from './lib/xmpParser';
import {
  DEFAULT_ADJUSTMENTS,
  HistogramData,
  LightroomPreset,
  PresetAdjustments,
  SamplePhoto,
} from './types/preset';

const STORAGE_KEY = 'kader_chroma_custom_presets_v1';

type InspectorTab = 'prompt' | 'tone' | 'hsl';

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('studio');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('prompt');

  const [customPresets, setCustomPresets] = useState<LightroomPreset[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore storage error
    }
    return [];
  });

  const [activePreset, setActivePreset] = useState<LightroomPreset>(() =>
    JSON.parse(JSON.stringify(STARTER_PRESETS[0]))
  );

  // Sample or uploaded photo state
  const [activeSampleId, setActiveSampleId] = useState<string>(SAMPLE_PHOTOS[0].id);
  const [imageSrc, setImageSrc] = useState<string>(SAMPLE_PHOTOS[0].url);
  const [imageTitle, setImageTitle] = useState<string>(SAMPLE_PHOTOS[0].title);
  const [imageExif, setImageExif] = useState<string>(SAMPLE_PHOTOS[0].exif);
  const [activePhotoBase64, setActivePhotoBase64] = useState<{ data: string; mimeType: string } | null>(null);

  const [histogram, setHistogram] = useState<HistogramData | null>(null);
  const [includeActivePhoto, setIncludeActivePhoto] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [savedFeedback, setSavedFeedback] = useState<boolean>(false);

  // Persist custom presets in localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customPresets));
    } catch {
      // Ignore quota errors
    }
  }, [customPresets]);

  const handleBase64Ready = useCallback((base64: string, mimeType: string) => {
    setActivePhotoBase64({ data: base64, mimeType });
  }, []);

  const handleSelectSample = (sample: SamplePhoto) => {
    setActiveSampleId(sample.id);
    setImageSrc(sample.url);
    setImageTitle(sample.title);
    setImageExif(sample.exif);
  };

  const handleUploadOwnPhoto = (dataUrl: string, fileName: string) => {
    setActiveSampleId('custom');
    setImageSrc(dataUrl);
    setImageTitle(fileName.replace(/\.[^.]+$/, ''));
    setImageExif('Eigen opname');
  };

  const handleExportXmp = (targetPreset: LightroomPreset = activePreset) => {
    const xml = presetToXmp(targetPreset);
    const blob = new Blob([xml], { type: 'application/rdf+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = targetPreset.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    a.download = `${safeName || 'kader-chroma-preset'}.xmp`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSavePresetToLibrary = () => {
    const presetToSave: LightroomPreset = {
      ...JSON.parse(JSON.stringify(activePreset)),
      updatedAt: Date.now(),
    };

    // If modifying a starter preset ID, fork it into a new custom ID so starters remain intact
    const isStarter = STARTER_PRESETS.some((s) => s.id === presetToSave.id);
    if (isStarter) {
      presetToSave.id = `custom-${Date.now()}`;
      presetToSave.category = 'aangepast';
      presetToSave.source = 'ai-generated';
    }

    setActivePreset(presetToSave);
    setCustomPresets((prev) => {
      const exists = prev.some((p) => p.id === presetToSave.id);
      if (exists) {
        return prev.map((p) => (p.id === presetToSave.id ? presetToSave : p));
      }
      return [presetToSave, ...prev];
    });

    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 1800);
  };

  const handleSubmitPrompt = async (prompt: string) => {
    setIsGenerating(true);
    setAiError(null);

    const previousAdjustments: PresetAdjustments = JSON.parse(
      JSON.stringify(activePreset.adjustments)
    );

    try {
      const response = await fetch('/api/presets/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPreset: activePreset,
          prompt,
          imageBase64: includeActivePhoto ? activePhotoBase64?.data : undefined,
          imageMimeType: includeActivePhoto ? activePhotoBase64?.mimeType : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Kon de preset niet aanpassen.');
      }

      setActivePreset((prev) => ({
        ...prev,
        name: data.name || prev.name,
        description: data.description || prev.description,
        updatedAt: Date.now(),
        adjustments: data.adjustments,
        history: [
          {
            id: `iter-${Date.now()}`,
            prompt,
            reasoning: data.reasoning,
            changedFields: data.changedFields || [],
            timestamp: Date.now(),
            adjustmentsSnapshot: previousAdjustments,
          },
          ...prev.history,
        ].slice(0, 15),
      }));
    } catch {
      const localResult = transformPresetLocally(
        activePreset.name,
        activePreset.description,
        activePreset.adjustments,
        prompt
      );
      setActivePreset((prev) => ({
        ...prev,
        name: localResult.name,
        description: localResult.description,
        updatedAt: Date.now(),
        adjustments: localResult.adjustments,
        history: [
          {
            id: `iter-${Date.now()}`,
            prompt,
            reasoning: localResult.reasoning,
            changedFields: localResult.changedFields,
            timestamp: Date.now(),
            adjustmentsSnapshot: previousAdjustments,
          },
          ...prev.history,
        ].slice(0, 15),
      }));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevertIteration = (iterationId: string) => {
    const idx = activePreset.history.findIndex((h) => h.id === iterationId);
    if (idx === -1) return;
    const target = activePreset.history[idx];
    setActivePreset((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      adjustments: JSON.parse(JSON.stringify(target.adjustmentsSnapshot)),
      history: prev.history.slice(idx + 1),
    }));
  };

  const handleImportPreset = (imported: LightroomPreset) => {
    setActivePreset(imported);
    setCustomPresets((prev) => [imported, ...prev]);
    setActiveView('studio');
    setInspectorTab('prompt');
  };

  const handleSelectLibraryPreset = (preset: LightroomPreset) => {
    setActivePreset(JSON.parse(JSON.stringify(preset)));
    setActiveView('studio');
  };

  const handleDuplicatePreset = (preset: LightroomPreset) => {
    const copy: LightroomPreset = {
      ...JSON.parse(JSON.stringify(preset)),
      id: `custom-${Date.now()}`,
      name: `${preset.name} (Kopie)`,
      category: 'aangepast',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setCustomPresets((prev) => [copy, ...prev]);
  };

  const handleDeleteCustomPreset = (id: string) => {
    setCustomPresets((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0C0D0F] text-[#F2F2F0]">
      <TopBar
        activeView={activeView}
        onNavigate={setActiveView}
        onExportXmp={() => handleExportXmp(activePreset)}
      />

      <main className="flex-1">
        {activeView === 'studio' && (
          <div className="max-w-[1480px] mx-auto px-4 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_410px] gap-6 items-start">
            {/* Left / Dominant Canvas Viewport */}
            <BeforeAfterCanvas
              imageSrc={imageSrc}
              imageTitle={imageTitle}
              imageExif={imageExif}
              adjustments={activePreset.adjustments}
              samplePhotos={SAMPLE_PHOTOS}
              activeSampleId={activeSampleId}
              onSelectSample={handleSelectSample}
              onUploadOwnPhoto={handleUploadOwnPhoto}
              onHistogramUpdate={setHistogram}
              onBase64Ready={handleBase64Ready}
            />

            {/* Right / Studio Inspector Panel */}
            <aside className="rounded-xl border border-white/[0.08] bg-[#14161A] flex flex-col overflow-hidden lg:sticky lg:top-20 lg:max-h-[calc(100vh-6.25rem)]">
              {/* Segmented tab selector */}
              <div className="p-2 border-b border-white/[0.08] bg-[#101215]">
                <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-[#0C0D0F] border border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setInspectorTab('prompt')}
                    className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      inspectorTab === 'prompt'
                        ? 'bg-[#232730] text-[#F2F2F0]'
                        : 'text-[#9A9FA8] hover:text-[#F2F2F0]'
                    }`}
                  >
                    AI Prompt
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectorTab('tone')}
                    className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      inspectorTab === 'tone'
                        ? 'bg-[#232730] text-[#F2F2F0]'
                        : 'text-[#9A9FA8] hover:text-[#F2F2F0]'
                    }`}
                  >
                    Licht & Curve
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectorTab('hsl')}
                    className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      inspectorTab === 'hsl'
                        ? 'bg-[#232730] text-[#F2F2F0]'
                        : 'text-[#9A9FA8] hover:text-[#F2F2F0]'
                    }`}
                  >
                    HSL & Grading
                  </button>
                </div>
              </div>

              {/* Active Inspector Content */}
              <div className="p-4 overflow-y-auto flex-1">
                {inspectorTab === 'prompt' && (
                  <AiPromptStudio
                    preset={activePreset}
                    isGenerating={isGenerating}
                    errorMessage={aiError}
                    includeActivePhoto={includeActivePhoto}
                    onToggleIncludePhoto={setIncludeActivePhoto}
                    onSubmitPrompt={handleSubmitPrompt}
                    onRevertIteration={handleRevertIteration}
                    onSavePresetToLibrary={handleSavePresetToLibrary}
                    onUpdatePresetName={(name) =>
                      setActivePreset((prev) => ({ ...prev, name, updatedAt: Date.now() }))
                    }
                    savedFeedback={savedFeedback}
                  />
                )}

                {(inspectorTab === 'tone' || inspectorTab === 'hsl') && (
                  <SlidersInspector
                    adjustments={activePreset.adjustments}
                    histogram={histogram}
                    mode={inspectorTab}
                    onChange={(next) =>
                      setActivePreset((prev) => ({
                        ...prev,
                        adjustments: next,
                        updatedAt: Date.now(),
                      }))
                    }
                    onResetAll={() =>
                      setActivePreset((prev) => ({
                        ...prev,
                        adjustments: JSON.parse(JSON.stringify(DEFAULT_ADJUSTMENTS)),
                        updatedAt: Date.now(),
                      }))
                    }
                  />
                )}
              </div>

              {/* Clean bottom bar inside inspector for quick preset switch, import, or desktop install */}
              <div className="px-4 py-2.5 border-t border-white/[0.08] bg-[#101215] flex items-center justify-between gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveView('import')}
                  className="text-[#9A9FA8] hover:text-[#F2F2F0] transition-colors whitespace-nowrap cursor-pointer"
                >
                  + Stijl importeren
                </button>
                <PWAInstallButton compact />
                <button
                  type="button"
                  onClick={() => setActiveView('library')}
                  className="text-[#E5A93C] hover:underline font-medium whitespace-nowrap cursor-pointer"
                >
                  Wissel basisstijl
                </button>
              </div>
            </aside>
          </div>
        )}

        {activeView === 'import' && (
          <ImportStyleView onImportPreset={handleImportPreset} />
        )}

        {activeView === 'library' && (
          <PresetLibraryView
            starterPresets={STARTER_PRESETS}
            customPresets={customPresets}
            activePresetId={activePreset.id}
            previewPhotoUrl={imageSrc}
            onSelectPreset={handleSelectLibraryPreset}
            onDownloadXmp={handleExportXmp}
            onDuplicatePreset={handleDuplicatePreset}
            onDeleteCustomPreset={handleDeleteCustomPreset}
          />
        )}

        {activeView === 'xmp' && (
          <XmpInspectorView
            preset={activePreset}
            onDownloadXmp={() => handleExportXmp(activePreset)}
          />
        )}

        {activeView === 'windows' && <DesktopInstallView />}
      </main>
      <OfflineIndicator />
    </div>
  );
}
