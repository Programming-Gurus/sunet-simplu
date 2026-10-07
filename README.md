# Sunet Simplu

Plays the music of a theatre play, one step at a time, with fades. By Programming Gurus.

[DESIGN.md](DESIGN.md) describes what the app does and why. Read it first.

## Run

Needs Node 24 (`.nvmrc`; with nvm, run `nvm use`).

```bash
npm install
npm run dev
```

A development run keeps its projects in the folder "Sunet Simplu Dev", away from the installed app.

## Check

```bash
npm run typecheck   # types
npm test            # unit tests of the rules that need no sound
npm run selftest    # the app drives itself, hidden and silent, on a temporary data folder
```

Set `SUNET_SELFTEST_OUT` to a folder to get pictures of the screens from the self-test.

## Build the Mac installer

```bash
npm run dist:mac
```

The result is `dist/Sunet Simplu-<version>-arm64.dmg`. It has a local signature only. On a Mac that did
not build it, approve the app one time: System Settings, Privacy & Security, "Open Anyway".

Set `APP_BUILDS_DIR` to a folder, and the build also copies the installer to its subfolder `Sunet Simplu`,
for example a shared folder from which other computers install the app. Without it, the installer stays in `dist`.

## Licence

MIT, see [LICENSE](LICENSE). The licence covers the code. It does not cover the Programming Gurus name
and logo.

## Credits

The icons of the light groups are Material Design Icons by Pictogrammers (`@mdi/js`, Apache License 2.0).
The installer holds their licence in `Resources/licenses`.

## Layout

| Folder | Content |
|---|---|
| `src/main` | Main process: window, permissions, projects on disk, export and import. |
| `src/preload` | The bridge between the interface and the main process. |
| `src/renderer` | The interface (Vue 3). `lib/engine.ts` is the sound of the main output, `lib/preview.ts` the preview. |
| `src/shared` | Data shapes and the rules that need no sound or screen. |
| `tests` | Unit tests. `tests/fixtures` holds project files that older versions wrote. |
| `spike/audio-test` | The throwaway test that proved the audio-device assumptions. |
