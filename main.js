const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const APO_CONFIG = "C:\\Program Files\\EqualizerAPO\\config\\config.txt";
const APO_CONFIGURATOR = "C:\\Program Files\\EqualizerAPO\\DeviceSelector.exe";
const APO_DIR = "C:\\Program Files\\EqualizerAPO";

function apoInstalled() {
  return fs.existsSync(APO_DIR);
}

function apoConfigured() {
  return fs.existsSync(APO_CONFIG);
}

function writeEQ({ bands, preamp, lowCut, highCut }) {
  const lines = [`Preamp: ${preamp} dB`];

  if (lowCut && lowCut.enabled && lowCut.freq > 20) {
    lines.push(
      `Filter: ON HP Fc ${lowCut.freq} Hz Q ${lowCut.q || 0.707}`
    );
  }

  for (const b of bands) {
    lines.push(
      `Filter: ON PK Fc ${b.freq} Hz Gain ${b.gain} dB Q ${b.q}`
    );
  }

  if (highCut && highCut.enabled && highCut.freq < 20000) {
    lines.push(
      `Filter: ON LP Fc ${highCut.freq} Hz Q ${highCut.q || 0.707}`
    );
  }

  fs.writeFileSync(APO_CONFIG, lines.join("\r\n") + "\r\n", "utf8");
}

function readEQ() {
  if (!apoConfigured()) return null;
  const text = fs.readFileSync(APO_CONFIG, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  let preamp = 0;
  const bands = [];
  let lowCut = { enabled: false, freq: 20, q: 0.707 };
  let highCut = { enabled: false, freq: 20000, q: 0.707 };

  for (const line of lines) {
    const preampMatch = line.match(/^Preamp:\s*([-\d.]+)\s*dB/i);
    if (preampMatch) {
      preamp = parseFloat(preampMatch[1]);
      continue;
    }
    const hpMatch = line.match(
      /^Filter:\s*ON\s+HP\s+Fc\s+([\d.]+)\s*Hz(?:\s+Q\s+([\d.]+))?/i
    );
    if (hpMatch) {
      lowCut = {
        enabled: true,
        freq: parseFloat(hpMatch[1]),
        q: hpMatch[2] ? parseFloat(hpMatch[2]) : 0.707,
      };
      continue;
    }
    const lpMatch = line.match(
      /^Filter:\s*ON\s+LP\s+Fc\s+([\d.]+)\s*Hz(?:\s+Q\s+([\d.]+))?/i
    );
    if (lpMatch) {
      highCut = {
        enabled: true,
        freq: parseFloat(lpMatch[1]),
        q: lpMatch[2] ? parseFloat(lpMatch[2]) : 0.707,
      };
      continue;
    }
    const filterMatch = line.match(
      /^Filter:\s*ON\s+PK\s+Fc\s+([\d.]+)\s*Hz\s+Gain\s+([-\d.]+)\s*dB\s+Q\s+([\d.]+)/i
    );
    if (filterMatch) {
      bands.push({
        freq: parseFloat(filterMatch[1]),
        gain: parseFloat(filterMatch[2]),
        q: parseFloat(filterMatch[3]),
      });
    }
  }
  return { preamp, bands, lowCut, highCut };
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 880,
    height: 700,
    minWidth: 700,
    minHeight: 600,
    backgroundColor: "#0d0d0d",
    title: "EQ Panel",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile("index.html");
}

app.whenReady().then(() => {
  // IPC handlers
  ipcMain.handle("get-status", () => {
    return { installed: apoInstalled(), configured: apoConfigured(), eq: readEQ() };
  });

  ipcMain.handle("apply-eq", (_, data) => {
    try {
      writeEQ(data);
      return { ok: true };
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle("open-configurator", () => {
    if (fs.existsSync(APO_CONFIGURATOR)) {
      execFile(APO_CONFIGURATOR, [], { cwd: APO_DIR });
      return { ok: true };
    }
    return { error: "Configurator not found" };
  });

  ipcMain.handle("open-apo-download", () => {
    shell.openExternal(
      "https://sourceforge.net/projects/equalizerapo/files/latest/download"
    );
    return { ok: true };
  });

  createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});
