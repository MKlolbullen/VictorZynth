# AetherWave in REAPER on Linux

This package is for **Linux x86-64**, built on Ubuntu 24.04. It is not a Windows
VST3 and is not guaranteed to run on distributions with an older glibc/libstdc++.
The synth, MIDI input and embedded UI work without an API key or Node server.

## Install

1. Download the `AetherWave-linux-vst3` artifact from a successful **Native VST3 CI**
   run for the source commit you want. Unzip the outer GitHub artifact ZIP.
2. Verify `sha256sum -c SHA256SUMS`, then extract `AetherWave-linux-x86_64.tar.gz`.
3. Close REAPER. In the extracted package directory, run:

   ```bash
   python3 install-linux.py --check
   python3 install-linux.py
   ```

   The installer verifies the module checksum and runtime dependencies, then
   installs the complete bundle in `~/.vst3/`. It requires Python 3.9 or newer.
   No sudo is needed. For an update, run `python3 install-linux.py --replace`.
   This preserves the old bundle under `${XDG_DATA_HOME:-~/.local/share}/AetherWave/backups/`
   and prints its exact path. Keep that backup directory outside all REAPER scan paths.
   `--destination /your/vst3/path` selects another scan directory.
4. Open REAPER, go to **Preferences → Plug-ins → VST**, ensure `~/.vst3` is in the
   scan paths, and rescan. If a previous scan failed, use **Re-scan → Clear cache
   and re-scan**. Insert **VST3i: AetherWave** on a track.

The installed file must be:

```text
~/.vst3/AetherWave.vst3/Contents/x86_64-linux/AetherWave.so
```

Do not install just `AetherWave.so`, or a bare `Contents` directory. Older artifact
ZIPs lacked the enclosing bundle directory: extract those into a newly created
`AetherWave.vst3` directory before installing. Prefer the newly validated package.
The ZIP checked into the repository root is historical (its manifest reports
0.2.0); it is not a build of current main. Release `v.0.1.7` also predates the
validated installation pipeline. Use a new validated CI package or a release
created from it, and check the source commit in `build-info.json`.

For an older package without the installer, manually copy the entire bundle to
`~/.vst3/`. Move an existing installation outside every scan path first; do not
merge old and new bundle contents. To restore an installer backup, close REAPER,
move the current bundle out of the scan path, and copy the printed backup
directory back as `~/.vst3/AetherWave.vst3`.

The `standalone/AetherWave` executable is optional and is not the VST3 plugin.

## Runtime libraries

On Ubuntu 24.04, the WebView needs `libwebkit2gtk-4.1-0` and GTK 3. The build also
uses ALSA/X11/font libraries and curl. Install the runtime packages if missing:

```bash
sudo apt-get install libwebkit2gtk-4.1-0 libgtk-3-0t64 libasound2t64 \
  libfreetype6 libfontconfig1 libx11-6 libxext6 libxinerama1 libxrandr2 \
  libxcursor1 libxrender1 libxcomposite1 libcurl4t64 libgl1
ldd ~/.vst3/AetherWave.vst3/Contents/x86_64-linux/AetherWave.so
```

Resolve every `not found` entry. WebKit/GTK are loaded dynamically, so a clean
`ldd` alone is not proof the editor can open. Other distributions use different
package names; build locally on older distributions rather than replacing glibc.

## First sound and host acceptance test

- Add AetherWave to a track, arm recording, choose a MIDI keyboard or REAPER's
  virtual MIDI keyboard as input, and enable input monitoring. Play a note.
- Open/close/reopen and resize the editor. Confirm its controls affect the sound.
- Record or draw a MIDI clip and play it back, then stop/start playback.
- Save the project with a changed patch, quit/reopen REAPER, and check recall.
- Render a short MIDI clip offline; check for audible, finite output and no stuck notes.
- For hum-to-MIDI, select microphone audio input and enable HUM → MIDI; keep it off
  for the initial ordinary MIDI test. Use headphones to avoid acoustic feedback.

CI installs the extracted package, then loads the installed module and checks MIDI audio, state recall, layouts and
sample rates, then runs pluginval including GUI tests under a virtual display.
This is host-compatibility evidence, not a substitute for the REAPER steps above.
