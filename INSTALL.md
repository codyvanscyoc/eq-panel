# EQ Panel — Install Guide

This is the short, friendly, "my buddy sent me this" version.

## 1. Download

Grab **`EQ Panel Setup 1.0.0.exe`** from the [Releases page](../../releases).
(The other file, `EQ Panel 1.0.0.exe`, is the portable version — no install needed, but skip it unless you know you want portable.)

## 2. Run it — and get past Windows SmartScreen

Because this app isn't code-signed (signing certs cost $$), Windows will show a
**blue "Windows protected your PC" popup** the first time you run it.

This is normal. Here's how to get past it:

1. Click the small **"More info"** link on the blue popup.
2. A **"Run anyway"** button appears at the bottom — click it.
3. The installer opens. Click through it like any normal app.

That's it. Windows remembers the app after the first run, so you won't see the
popup again.

### Antivirus flagged it?

Some AV software is aggressive about unsigned Electron apps. If yours quarantines
the exe:

- Add an exception for the EQ Panel install folder (usually
  `C:\Users\<you>\AppData\Local\Programs\EQ Panel\`).
- Or scan it at [virustotal.com](https://virustotal.com) first to confirm it's clean.

## 3. First launch

When EQ Panel opens, it checks if **EqualizerAPO** (the engine that actually
processes your audio) is installed. If not, you'll see a setup screen:

1. Click **"INSTALL EQUALIZERAPO"**.
2. EQ Panel downloads the installer (~3 MB) and launches it.
3. Approve the Windows UAC prompt.
4. In the EqualizerAPO installer, **check the box next to your audio device**
   (speakers, headphones, whatever you want EQ applied to).
5. Finish the install. It'll ask you to **reboot** — do it.

After reboot, launch EQ Panel again and you're good. Pick a preset, move some
sliders, changes apply instantly to all system audio.

## 4. Adding/changing devices later

Click the **[ DEVICES ]** button at the bottom right of EQ Panel to open the
EqualizerAPO Configurator any time.

## Troubleshooting

**App opens but nothing happens when I move sliders**
→ EqualizerAPO didn't hook into your active audio device. Click **[ DEVICES ]**,
check the box next to your current output, reboot.

**"Install not detected within 10 minutes"**
→ You cancelled the EqualizerAPO installer or it's still open. Finish or retry.

**Nothing happens when I double-click the exe**
→ Check Windows Defender / your AV's quarantine. Restore the file and add an
exception.

**SmartScreen shows no "More info" link**
→ Right-click the exe → Properties → check **"Unblock"** at the bottom → OK.
Then run it.
