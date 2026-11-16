const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const PORT = 3489;
let mainWindow = null;
let serverProcess = null;

function waitForServer(url, retries = 40) {
  return new Promise((resolve, reject) => {
    const attempt = (left) => {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on('error', () => {
          if (left <= 0) {
            reject(new Error('Lokale server startte niet op tijd.'));
            return;
          }
          setTimeout(() => attempt(left - 1), 250);
        });
    };
    attempt(retries);
  });
}

function startLocalBackend() {
  const unpackedDir = __dirname.includes('app.asar')
    ? __dirname.replace('app.asar', 'app.asar.unpacked')
    : __dirname;
  const serverEntry = path.join(unpackedDir, 'server.cjs');

  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: 'production',
    PORT: String(PORT),
  };

  serverProcess = spawn(process.execPath, [serverEntry], {
    env,
    stdio: 'ignore',
    windowsHide: true,
  });
}

async function createWindow() {
  startLocalBackend();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0C0D0F',
    title: 'Kader Chroma — AI Lightroom Preset Engine',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'public', 'pwa-512x512.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const targetUrl = `http://127.0.0.1:${PORT}`;
  try {
    await waitForServer(`${targetUrl}/api/health`);
    await mainWindow.loadURL(targetUrl);
  } catch {
    await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
