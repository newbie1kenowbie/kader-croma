import React, { useState } from 'react';
import { Check, Copy, Laptop, Terminal } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { usePWAInstall } from '../hooks/usePWAInstall';

const BUILD_COMMANDS = `npm install
npm install --save-dev electron electron-builder
npm run build
npx electron-builder --config electron-builder.yml --win nsis`;

export const DesktopInstallView: React.FC = () => {
  const { isInstallable, isInstalled } = usePWAInstall();
  const [copied, setCopied] = useState(false);

  const handleCopyCommands = async () => {
    try {
      await navigator.clipboard.writeText(BUILD_COMMANDS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <div className="max-w-[1160px] mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
      <div className="max-w-2xl">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#F2F2F0] [text-wrap:balance]">
          Kader Chroma installeren op Windows
        </h1>
        <p className="text-sm sm:text-base text-[#9A9FA8] mt-2 leading-relaxed">
          Deze cloud-ontwikkelomgeving draait op Linux en kan daarom geen direct uitvoerbare{' '}
          <span className="font-mono text-[#F2F2F0]">.exe</span>-binary voor je compileren. Je kunt de studio wel
          meteen als losstaande Windows Desktop-app installeren, of de meegeleverde Electron-configuratie
          gebruiken om op Windows zelf een <span className="font-mono text-[#F2F2F0]">Setup.exe</span> te bouwen.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Option 1: Direct Windows Desktop App (PWA) */}
        <section className="rounded-xl border border-white/[0.08] bg-[#14161A] p-6 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#F2F2F0]">
                1. Direct installeren als Windows Desktop-app
              </h2>
              <p className="text-xs text-[#9A9FA8] mt-1">
                Aanbevolen — werkt direct via Microsoft Edge of Google Chrome zonder handmatig compileren.
              </p>
            </div>
            <Laptop className="w-5 h-5 text-[#E5A93C] shrink-0" />
          </div>

          <div className="flex flex-col gap-2.5 text-xs text-[#C8CCD4] leading-relaxed">
            <p>
              <span className="font-mono text-[#E5A93C]">01.</span> Open Kader Chroma in Microsoft Edge of Chrome op Windows 10/11.
            </p>
            <p>
              <span className="font-mono text-[#E5A93C]">02.</span> Klik hieronder op{' '}
              <strong className="text-[#F2F2F0]">Installeer als Desktop-app</strong> of klik rechts in de adresbalk op het app-installatie-icoon.
            </p>
            <p>
              <span className="font-mono text-[#E5A93C]">03.</span> Windows plaatst Kader Chroma in je Startmenu, op het bureaublad en bij geïnstalleerde apps — met een eigen venster zonder browserbalk.
            </p>
          </div>

          <div className="mt-auto pt-4 border-t border-white/[0.08] flex items-center justify-between gap-3">
            {isInstalled ? (
              <span className="text-xs font-medium text-[#E5A93C]">
                Kader Chroma draait al als geïnstalleerde Desktop-app.
              </span>
            ) : isInstallable ? (
              <PWAInstallButton />
            ) : (
              <span className="text-xs text-[#9A9FA8]">
                Gebruik in Edge of Chrome de optie “App installeren” in het browsermenu (⋯).
              </span>
            )}
          </div>
        </section>

        {/* Option 2: Electron NSIS .exe build configuration */}
        <section className="rounded-xl border border-white/[0.08] bg-[#14161A] p-6 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#F2F2F0]">
                2. Zelf een losstaande Setup.exe bouwen (Electron)
              </h2>
              <p className="text-xs text-[#9A9FA8] mt-1">
                De bestanden <span className="font-mono text-[#F2F2F0]">electron/main.cjs</span> en{' '}
                <span className="font-mono text-[#F2F2F0]">electron-builder.yml</span> staan al klaar in dit project.
              </p>
            </div>
            <Terminal className="w-5 h-5 text-[#E5A93C] shrink-0" />
          </div>

          <p className="text-xs text-[#C8CCD4] leading-relaxed">
            Voer deze commando’s uit op een Windows-pc met Node.js 22+ om een officiële NSIS-installer (
            <span className="font-mono text-[#F2F2F0]">Kader-Chroma-Setup.exe</span>) in de map{' '}
            <span className="font-mono text-[#F2F2F0]">release/</span> te genereren:
          </p>

          <div className="rounded-lg border border-white/[0.08] bg-[#08090B] overflow-hidden">
            <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between text-[11px] text-[#9A9FA8]">
              <span className="font-mono">Windows PowerShell / Terminal</span>
              <button
                type="button"
                onClick={handleCopyCommands}
                className="inline-flex items-center gap-1 text-[#C8CCD4] hover:text-[#F2F2F0] transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-[#E5A93C]" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Gekopieerd' : 'Kopieer'}</span>
              </button>
            </div>
            <pre className="p-3 text-xs font-mono text-[#D4D7DD] overflow-x-auto leading-relaxed">
              <code>{BUILD_COMMANDS}</code>
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
};
