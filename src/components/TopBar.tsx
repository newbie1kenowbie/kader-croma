import React from 'react';
import { Download } from 'lucide-react';
import { BrandMark } from './BrandMark';

export type AppView = 'studio' | 'import' | 'library' | 'xmp' | 'windows';

interface TopBarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  onExportXmp: () => void;
}

const NAV_ITEMS: Array<{ id: AppView; label: string }> = [
  { id: 'studio', label: 'Studio' },
  { id: 'import', label: 'Importeren' },
  { id: 'library', label: 'Bibliotheek' },
  { id: 'xmp', label: 'XMP Code' },
  { id: 'windows', label: 'Windows App' },
];

export const TopBar: React.FC<TopBarProps> = ({ activeView, onNavigate, onExportXmp }) => {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#0C0D0F]/95 backdrop-blur-md">
      <div className="max-w-[1480px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
        {/* Zone 1: Brand pictogram + single-line wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('studio')}
          className="flex items-center gap-2.5 text-[#F2F2F0] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5A93C] rounded-md px-1 py-1"
        >
          <BrandMark className="w-6 h-6 text-[#F2F2F0] shrink-0" />
          <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap shrink-0">
            Kader Chroma
          </span>
        </button>

        {/* Zone 2: 4 concise single-line text nav links */}
        <nav className="flex items-center gap-5 sm:gap-7 overflow-x-auto no-scrollbar" aria-label="Hoofdnavigatie">
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`relative py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5A93C] rounded ${
                  isActive
                    ? 'text-[#F2F2F0]'
                    : 'text-[#9A9FA8] hover:text-[#F2F2F0]'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E5A93C] rounded-full"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onExportXmp}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-[#0C0D0F] bg-[#E5A93C] hover:bg-[#F0B84E] active:scale-[0.98] rounded-lg transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5A93C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0C0D0F] cursor-pointer"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Exporteer .XMP</span>
          </button>
        </div>
      </div>
    </header>
  );
};
