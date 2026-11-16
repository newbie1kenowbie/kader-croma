# Kader Chroma — Windows `.exe` Installer Bouwen

In deze repository zijn twee manieren voorzien om **Kader Chroma** als Windows-applicatie te gebruiken:

## 1. Direct installeren op Windows 10/11 (Edge / Chrome Desktop-app)
Open de app in **Microsoft Edge** of **Google Chrome** en klik op **Installeer als Desktop-app** in de app (of via het installeer-icoon in de adresbalk). Windows maakt automatisch een Startmenu- en bureaublad-snelkoppeling aan en opent Kader Chroma in een eigen donker app-venster.

## 2. Zelf een losstaand `.exe` installatiebestand bouwen (Electron + NSIS)
Omdat een binaire Windows `.exe` niet in een Linux-cloudsandbox gecompileerd kan worden, staat de volledige Electron-configuratie klaar in `electron/main.cjs` en `electron-builder.yml`.

Voer op een **Windows 10/11** computer (met Node.js 22+) de volgende stappen uit:

```bash
# 1. Afhankelijkheden installeren
npm install

# 2. Electron & electron-builder eenmalig toevoegen
npm install --save-dev electron electron-builder

# 3. Frontend bundelen
npm run build

# 4. Windows NSIS installer (.exe) compileren
npx electron-builder --config electron-builder.yml --win nsis
```

Het uitvoerbare installatiebestand verschijnt in de map `release/`:
`release/Kader-Chroma-Setup-0.0.0.exe`

> Tip: Zet je `GEMINI_API_KEY` als omgevingsvariabele in Windows (of in een `.env` bestand naast de installatie) als je ook AI-aanpassingen lokaal vanuit het `.exe`-venster wilt draaien.
