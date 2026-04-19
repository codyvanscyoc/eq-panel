# EQ Panel

A retro-styled, system-wide audio equalizer for Windows. Powered by [EqualizerAPO](https://sourceforge.net/projects/equalizerapo/).

Works with any audio output — Bluetooth speakers, wired headphones, USB DACs, whatever you've got.

![EQ Panel Screenshot](screenshot.png)

## Features

- **10-band parametric EQ** — 32 Hz to 16 KHz with vertical sliders
- **Low Cut / High Cut filters** — toggle on/off with adjustable frequency
- **One-click presets** — Bass Boost, Heavy Bass, V-Shape, Vocal Clarity, Treble Boost, Loudness
- **Preamp control** — prevent clipping when boosting
- **Device selector** — open EqualizerAPO Configurator to pick your output device
- **Retro terminal UI** — green-on-black CRT aesthetic
- **Real-time** — changes apply instantly, no restart needed

## Requirements

- Windows 10/11
- [EqualizerAPO](https://sourceforge.net/projects/equalizerapo/) (free, open-source)

## Install

1. Download and install [EqualizerAPO](https://sourceforge.net/projects/equalizerapo/)
   - During install, **check the box next to your audio output device** (speakers, headphones, etc.)
   - Reboot if prompted
2. Download `EQ Panel Setup 1.0.0.exe` from [Releases](../../releases)
3. Run and enjoy

## Portable Version

Download `EQ Panel 1.0.0.exe` from [Releases](../../releases) — no install needed, just run it.

## How It Works

EqualizerAPO is a system-wide Audio Processing Object (APO) that hooks into the Windows audio pipeline at the driver level. EQ Panel provides a GUI that writes parametric EQ filter settings to EqualizerAPO's config file. Changes take effect in real-time.

## Dev Setup

```bash
npm install
npm start
```

## Build

```bash
npm run build
```

Outputs to `dist/`.

## License

MIT
