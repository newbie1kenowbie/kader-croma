import React, { useState } from 'react';
import { Check, Copy, GitBranch, Laptop, Terminal } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { usePWAInstall } from '../hooks/usePWAInstall';

const BUILD_COMMANDS = `npm install
npm run build
npx esbuild server.ts --bundle --platform=node --format=cjs --external:vite --outfile=electron/server.cjs
npm install --no-save electron electron-builder
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
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
      <div className="max-w-2xl">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#F2F2F0] [text-wrap:balance]">
          Kader Chroma op Windows & GitHub
        </h1>
        <p className="text-sm sm:text-base text-[#9A9FA8] mt-2 leading-relaxed">
          Deze cloudomgeving draait op Linux zonder Windows-compilers, maar je kunt de studio direct als
          Windows Desktop-app installeren of via de meegeleverde GitHub Actions workflow automatisch een{' '}
          <span className="font-mono text-[#F2F2F0]">Setup.exe</span> laten bouwen.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Option 1: Direct Windows Desktop App (PWA) */}
        <section className="rounded-xl border border-white/[0.08] bg-[#14161A] p-6 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-[#F2F2F0]">
                1. Direct als Windows Desktop-app
              </h2>
              <p className="text-xs text-[#9A9FA8] mt-1">
                Snelste manier via Microsoft Edge of Chrome.
              </p>
            </div>
            <Laptop className="w-5 h-5 text-[#E5A93C] shrink-0" />
          </div>

          <div className="flex flex-col gap-2 text-xs text-[#C8CCD4] leading-relaxed">
            <p>
              <span className="font-mono text-[#E5A93C]">01.</span> Open Kader Chroma in Edge of Chrome op Windows 10/11.
            </p>
            <p>
              <span className="font-mono text-[#E5A93C]">02.</span> Klik op{' '}
              <strong className="text-[#F2F2F0]">Installeer als Desktop-app</strong> of gebruik het installatie-icoon in de adresbalk.
            </p>
            <p>
              <span className="font-mono text-[#E5A93C]">03.</span> Start direct vanuit het Startmenu in een eigen app-venster.
            </p>
          </div>

          <div className="mt-auto pt-4 border-t border-white/[0.08]">
            {isInstalled ? (
              <span className="text-xs font-medium text-[#E5A93C]">
                Draait momenteel als geïnstalleerde Desktop-app.
              </span>
            ) : isInstallable ? (
              <PWAInstallButton />
            ) : (
              <span className="text-xs text-[#9A9FA8]">
                Kies in het browsermenu (⋯) voor “App installeren”.
              </span>
            )}
          </div>
        </section>

        {/* Option 2: Automated GitHub Actions .exe */}
        <section className="rounded-xl border border-white/[0.08] bg-[#14161A] p-6 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-[#F2F2F0]">
                2. Automatische .EXE via GitHub
              </h2>
              <p className="text-xs text-[#9A9FA8] mt-1">
                Workflow klaar in <span className="font-mono text-[#F2F2F0]">.github/workflows/</span>
              </p>
            </div>
            <GitBranch className="w-5 h-5 text-[#E5A93C] shrink-0" />
          </div>

          <div className="flex flex-col gap-2 text-xs text-[#C8CCD4] leading-relaxed">
            <p>
              <span className="font-mono text-[#E5A93C]">01.</span> Exporteer of push dit project naar je eigen GitHub-repository.
            </p>
            <p>
              <span className="font-mono text-[#E5A93C]">02.</span> Open op GitHub het tabblad <strong className="text-[#F2F2F0]">Actions</strong> →{' '}
              <strong className="text-[#F2F2F0]">Build Windows Installer (.exe)</strong>.
            </p>
            <p>
              <span className="font-mono text-[#E5A93C]">03.</span> GitHub bouwt op een Windows-runner automatisch{' '}
              <span className="font-mono text-[#F2F2F0]">Kader-Chroma-Setup.exe</span> onder Artifacts (en Releases bij een{' '}
              <span className="font-mono text-[#F2F2F0]">v*</span> tag).
            </p>
          </div>

          <div className="mt-auto pt-4 border-t border-white/[0.08] text-xs text-[#9A9FA8]">
            Workflow-bestand: <span className="font-mono text-[#F2F2F0]">build-windows-exe.yml</span>
          </div>
        </section>

        {/* Option 3: Local Windows build */}
        <section className="rounded-xl border border-white/[0.08] bg-[#14161A] p-6 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-[#F2F2F0]">
                3. Lokaal .EXE bouwen op Windows
              </h2>
              <p className="text-xs text-[#9A9FA8] mt-1">
                Vereist Node.js 22+ op een Windows-pc.
              </p>
            </div>
            <Terminal className="w-5 h-5 text-[#E5A93C] shrink-0" />
          </div>

          <div className="rounded-lg border border-white/[0.08] bg-[#08090B] overflow-hidden flex-1 flex flex-col">
            <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between text-[11px] text-[#9A9FA8]">
              <span className="font-mono">PowerShell</span>
              <button
                type="button"
                onClick={handleCopyCommands}
                className="inline-flex items-center gap-1 text-[#C8CCD4] hover:text-[#F2F2F0] transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-[#E5A93C]" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Gekopieerd' : 'Kopieer'}</span>
              </button>
            </div>
            <pre className="p-3 text-[11px] font-mono text-[#D4D7DD] overflow-x-auto leading-relaxed">
              <code>{BUILD_COMMANDS}</code>
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
};
