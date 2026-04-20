const { app, BrowserWindow, ipcMain, dialog, shell, net } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");

const APO_CONFIG = "C:\\Program Files\\EqualizerAPO\\config\\config.txt";
const APO_CONFIGURATOR = "C:\\Program Files\\EqualizerAPO\\DeviceSelector.exe";
const APO_DIR = "C:\\Program Files\\EqualizerAPO";
const APO_DOWNLOAD_URL = "https://sourceforge.net/projects/equalizerapo/files/latest/download";

// EqualizerAPO 1.4.x ships with the Qt platform plugin at qt\platforms\qwindows.dll
// instead of the default platforms\qwindows.dll. Without a qt.conf pointing Qt at the
// right folder, DeviceSelector.exe and Editor.exe die at launch with
// "no Qt platform plugin could be initialized". We patch this on demand.
const QT_PLUGIN_DEFAULT = path.join(APO_DIR, "platforms", "qwindows.dll");
const QT_PLUGIN_ALT = path.join(APO_DIR, "qt", "platforms", "qwindows.dll");
const QT_CONF = path.join(APO_DIR, "qt.conf");

function bundledAPOInstaller() {
  // In packaged app, extraResources land in process.resourcesPath.
  // In dev, fall back to the vendor/ dir next to main.js.
  const packaged = path.join(process.resourcesPath || "", "EqualizerAPO-installer.exe");
  if (fs.existsSync(packaged)) return packaged;
  const dev = path.join(__dirname, "vendor", "EqualizerAPO-installer.exe");
  if (fs.existsSync(dev)) return dev;
  return null;
}

function apoInstalled() {
  return fs.existsSync(APO_DIR);
}

function apoConfigured() {
  return fs.existsSync(APO_CONFIG);
}

function qtPatchState() {
  if (fs.existsSync(QT_PLUGIN_DEFAULT)) return "ok";
  if (fs.existsSync(QT_CONF)) {
    try {
      const conf = fs.readFileSync(QT_CONF, "utf8");
      if (/Plugins\s*=\s*qt\b/i.test(conf) && fs.existsSync(QT_PLUGIN_ALT)) {
        return "ok";
      }
    } catch {}
  }
  if (fs.existsSync(QT_PLUGIN_ALT)) return "fixable";
  return "missing";
}

async function patchQt() {
  const content = "[Paths]\r\nPlugins = qt\r\n";
  try {
    fs.writeFileSync(QT_CONF, content, "utf8");
    if (qtPatchState() === "ok") return { ok: true };
  } catch {}

  const scriptPath = path.join(os.tmpdir(), "eq-panel-patch-qt.ps1");
  const script =
    `$dest = 'C:\\Program Files\\EqualizerAPO\\qt.conf'\r\n` +
    `$content = "[Paths]\`r\`nPlugins = qt\`r\`n"\r\n` +
    `Set-Content -Path $dest -Value $content -Encoding ASCII -Force -NoNewline\r\n`;
  fs.writeFileSync(scriptPath, script, "utf8");

  return new Promise((resolve) => {
    const psCommand =
      `Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden ` +
      `-ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','${scriptPath}'`;
    execFile(
      "powershell.exe",
      ["-NoProfile", "-Command", psCommand],
      (err) => {
        if (qtPatchState() === "ok") return resolve({ ok: true });
        resolve({
          error: err
            ? "Repair cancelled or failed: " + err.message
            : "Repair did not apply (UAC cancelled?)",
        });
      }
    );
  });
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

function downloadAPO(onProgress) {
  return new Promise((resolve, reject) => {
    const tempPath = path.join(os.tmpdir(), "EqualizerAPO-installer.exe");
    const file = fs.createWriteStream(tempPath);
    const request = net.request({ url: APO_DOWNLOAD_URL, redirect: "follow" });

    request.on("response", (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        file.close();
        fs.unlink(tempPath, () => {});
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      const total = parseInt(response.headers["content-length"] || "0", 10);
      let received = 0;
      response.on("data", (chunk) => {
        received += chunk.length;
        file.write(chunk);
        if (onProgress) {
          const percent = total > 0 ? Math.round((received / total) * 100) : 0;
          onProgress({ percent, received, total });
        }
      });
      response.on("end", () => {
        file.end(() => resolve(tempPath));
      });
      response.on("error", (err) => {
        file.close();
        fs.unlink(tempPath, () => {});
        reject(err);
      });
    });
    request.on("error", (err) => {
      file.close();
      fs.unlink(tempPath, () => {});
      reject(err);
    });
    request.end();
  });
}

function waitForAPOInstall(timeoutMs = 10 * 60 * 1000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (apoInstalled()) return resolve(true);
      if (Date.now() - start > timeoutMs) return resolve(false);
      setTimeout(tick, 2000);
    };
    tick();
  });
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

  ipcMain.handle("open-configurator", async () => {
    if (!fs.existsSync(APO_CONFIGURATOR)) {
      return { error: "DeviceSelector.exe not found. Install EqualizerAPO first." };
    }

    const qt = qtPatchState();
    if (qt === "missing") {
      return {
        error:
          "EqualizerAPO Qt plugins missing. Try reinstalling EqualizerAPO via [INSTALL].",
      };
    }
    if (qt === "fixable") {
      const patched = await patchQt();
      if (patched.error) return { error: patched.error };
    }

    return new Promise((resolve) => {
      let settled = false;
      const proc = execFile(APO_CONFIGURATOR, [], { cwd: APO_DIR }, (err) => {
        if (settled) return;
        settled = true;
        if (err) {
          resolve({ error: "DeviceSelector failed: " + err.message });
        } else {
          resolve({ ok: true });
        }
      });
      proc.on("error", (err) => {
        if (settled) return;
        settled = true;
        resolve({ error: "Could not launch DeviceSelector: " + err.message });
      });
      // If it stays alive past 600ms we assume it launched successfully.
      // This catches fast-crash failures (e.g. Qt plugin errors) without
      // making the user wait for them to close DeviceSelector normally.
      setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve({ ok: true });
      }, 600);
    });
  });

  ipcMain.handle("repair-apo", async () => {
    const qt = qtPatchState();
    if (qt === "ok") return { ok: true, alreadyOk: true };
    if (qt === "missing") {
      return { error: "Qt plugins missing. Reinstall EqualizerAPO." };
    }
    return patchQt();
  });

  ipcMain.handle("open-apo-download", () => {
    shell.openExternal(APO_DOWNLOAD_URL);
    return { ok: true };
  });

  ipcMain.handle("install-apo", async (event) => {
    const send = (payload) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("apo-install-progress", payload);
      }
    };

    try {
      let installerPath = bundledAPOInstaller();
      if (!installerPath) {
        send({ stage: "downloading", percent: 0 });
        installerPath = await downloadAPO((p) => {
          send({ stage: "downloading", percent: p.percent });
        });
      }

      send({ stage: "launching" });
      // Launch installer; it will prompt for UAC elevation itself (NSIS installer).
      // Don't wait on execFile — user may sit on the installer for minutes.
      execFile(installerPath, [], (err) => {
        if (err) {
          // Installer was cancelled or failed to launch — surface it but don't crash.
          send({ stage: "error", error: err.message });
        }
      });

      send({ stage: "waiting" });
      const installed = await waitForAPOInstall();
      if (installed) {
        send({ stage: "done" });
        return { ok: true };
      }
      send({ stage: "timeout" });
      return { error: "Install not detected within 10 minutes" };
    } catch (e) {
      send({ stage: "error", error: e.message });
      return { error: e.message };
    }
  });

  createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});
