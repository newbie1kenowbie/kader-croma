import React, { useState } from 'react';
import { MonitorDown } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={
          compact
            ? 'inline-flex items-center gap-1.5 text-xs font-medium text-[#E5A93C] hover:underline whitespace-nowrap cursor-pointer'
            : 'inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-[#E5A93C] hover:bg-[#F0B84E] text-[#0C0D0F] transition-colors whitespace-nowrap cursor-pointer'
        }
      >
        <MonitorDown className="w-4 h-4 shrink-0" />
        <span>Installeer als Desktop-app</span>
      </button>
    );
  }

  if (isIOS && !compact) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-white/[0.12] bg-[#1C1F24] hover:bg-[#252930] text-[#F2F2F0] transition-colors whitespace-nowrap cursor-pointer"
        >
          <MonitorDown className="w-4 h-4 shrink-0 text-[#E5A93C]" />
          <span>Installeer op iPhone / iPad</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
            <div className="w-full max-w-sm rounded-xl border border-white/[0.12] bg-[#14161A] p-6">
              <h3 className="font-display text-base font-semibold text-[#F2F2F0]">
                Installeren op iPhone / iPad
              </h3>
              <p className="mt-2 text-xs text-[#C8CCD4] leading-relaxed">
                1. Tik op de <strong>Deel</strong>-knop in de Safari-werkbalk.
                <br />
                2. Kies <strong>Zet op beginscherm</strong> om Kader Chroma als app te openen.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-lg bg-[#E5A93C] py-2 text-xs font-semibold text-[#0C0D0F] hover:bg-[#F0B84E] transition-colors cursor-pointer"
              >
                Sluiten
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-[#E5A93C]/40 bg-[#14161A] px-3 py-2 text-xs font-medium text-[#F2F2F0] shadow-lg">
      <span>Offline modus — Kleurengine, eigen foto’s en .XMP-export blijven beschikbaar.</span>
    </div>
  );
};
