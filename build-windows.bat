@echo off
setlocal
title Kader Chroma - Windows .EXE Installer Bouwen

echo [1/5] Afhankelijkheden installeren...
call npm install --legacy-peer-deps --no-audit --no-fund
if errorlevel 1 goto :error

echo [2/5] Frontend bundelen...
call npm run build
if errorlevel 1 goto :error

echo [3/5] Express backend bundelen...
call npx esbuild server.ts --bundle --platform=node --format=cjs --external:vite --outfile=electron/server.cjs
if errorlevel 1 goto :error

echo [4/5] Electron & electron-builder installeren...
call npm install --no-save --legacy-peer-deps --no-audit --no-fund electron electron-builder
if errorlevel 1 goto :error

echo [5/5] Windows Setup.exe compileren...
call npx electron-builder --config electron-builder.yml --win nsis --publish never
if errorlevel 1 goto :error

echo.
echo Klaar! De installer staat in de map "release\".
explorer release
goto :eof

:error
echo.
echo Er is een fout opgetreden tijdens het bouwen. Controleer of Node.js 22+ is geinstalleerd.
pause
exit /b 1
