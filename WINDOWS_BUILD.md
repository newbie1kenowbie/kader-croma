# Kader Chroma — Windows `.exe` Installer Bouwen (Lokaal & via GitHub)

## Optie A: Automatisch via GitHub Actions (geen lokale buildtools nodig)
Dit project bevat een kant-en-klare workflow in `.github/workflows/build-windows-exe.yml`:

1. Exporteer of push dit project naar je eigen GitHub-repository.
2. Open in GitHub het tabblad **Actions** → **Build Windows Installer (.exe)**.
3. De workflow draait automatisch bij elke push naar `main`/`master` (of klik op **Run workflow**).
4. Download na ~2 minuten de kant-en-klare `Kader-Chroma-Setup-*.exe` onder **Artifacts** (of bij **Releases** als je een tag zoals `v1.0.0` pusht).

## Optie B: Direct installeren vanuit Edge / Chrome (Desktop-app)
Open Kader Chroma in **Microsoft Edge** of **Google Chrome** en klik op **Installeer als Desktop-app** in het tabblad **Windows App**.

## Optie C: Lokaal een `.exe` bouwen op Windows 10/11
Op een Windows-pc met Node.js 22+:

```bash
npm install --legacy-peer-deps
npm run build
npx esbuild server.ts --bundle --platform=node --format=cjs --external:vite --outfile=electron/server.cjs
npm install --no-save --legacy-peer-deps electron electron-builder
npx electron-builder --config electron-builder.yml --win nsis
```

Het installatiebestand verschijnt in `release/Kader-Chroma-Setup-0.0.0.exe`.
