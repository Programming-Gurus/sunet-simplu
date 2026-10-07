# Sunet Simplu — Design

*by Programming Gurus. Status: draft 6, 2026-10-07. The audio-device test passed on macOS; Windows is open. No app code exists yet. `spike/audio-test/` holds the throwaway test.*

Sunet Simplu plays the music of a theatre play, one step at a time, with fades.
One person operates it from the booth, next to the lights app.

## 1. Terms

| Term | Meaning |
|---|---|
| **Project** | One play. It holds the songs, the steps and the fade times. |
| **Song** | One audio file that you added to a project. |
| **Step** | One line in the list of a project. You run steps from top to bottom during a show. |
| **Song step** | A step that starts a song. |
| **Note step** | A step with text only, for example a lighting change. It does nothing to the sound. |
| **Stop step** | A step that fades out the music. |
| **Run** | To do what a step says: start its song, stop the music, or nothing. |
| **Cursor** | The marker on the step that Space runs next. |
| **Start point / end point** | The part of a song that a song step plays. The default is the full song. |
| **Continue** | A switch of a song step. With Continue on, the step starts the song at the position where the song last stopped. |
| **Continue limit** | A point in the part of a song step. If the song last stopped after this point, the step starts from its start point. |
| **Main output** | The audio device that the audience hears. |
| **Preview output** | A second audio device, for example Bluetooth headphones, that only the operator hears. |
| **Preview** | To play the song of a step on the preview output. A preview does not change the show. |
| **Edit mode / Show mode** | Two views of the same project. Edit mode changes the project. Show mode runs it and locks all changes. |

## 2. Scope

In scope:

- Projects, one for each play.
- Add audio files to a project.
- A list of steps with notes.
- Play with fade-in, stop with fade-out, automatic crossfade, loop.
- A start point and an end point for each song step.
- Continue a song from the position where it last stopped.
- A main output and a preview output, set in the app settings.
- Romanian and English interface.
- macOS on Apple Silicon and Windows.

Not in scope for version 1:

- Two songs at the same time on the main output (other than during a crossfade).
- Effects, equalizer.
- Control of the lights app.
- Accounts, cloud sync, automatic updates.

## 3. Screens

### 3.1 Projects screen

The app opens here.

- A list of projects: name, number of steps, date of last change.
- Buttons: **New project**, **Open**, **Duplicate**, **Delete**, **Import**, **Export**, **Settings**.
- Delete asks for confirmation and shows the project name.
- The Programming Gurus mark, with the text "concept by" and the dark-mode logo. It is a link that opens programminggurus.ro in the default browser. The text stays in English in both languages. The same mark is on the Settings screen.

### 3.2 Project screen

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ← Projects   Livada de vișini     [ Edit | SHOW ]   Fade 1.0 / 1.0     ⚙  │
├────────────────────────────────────────────────────────────────────────────┤
│  1  ♪  Opening                       uvertura.mp3            [🎧] [ Play ] │
│        "Lights go down, wait 3 seconds"                                    │
│  2  ✎  Lights: warm wash, stage left                                       │
│▶ 3  ♪  The letter                    scrisoare.mp3    ▮▮▮    [🎧] [ Stop ] │
│        Trigger: "Nu mai am nimic de spus."                                 │
│  4  ■  Stop music                                                          │
│        Trigger: Ana leaves the stage                                       │
│  5  ♪  Finale                        final.mp3  0:12–2:40    [🎧] [ Play ] │
├────────────────────────────────────────────────────────────────────────────┤
│ NOW: The letter — scrisoare.mp3    01:42 / 03:10 (loop 1)    Vol ▬▬▬▬○     │
│ NEXT (Space): 4 · Stop music          Out: Headphone jack · 🎧 AirPods     │
└────────────────────────────────────────────────────────────────────────────┘
```

- Each step shows: number, type icon, title and notes.
- A song step also shows the file name, the start and end points if they are not the default, a "continues" label if Continue is on, a Preview button (🎧) and a Play or Stop button.
- The step that plays is highlighted. The cursor step has a marker (▶ above).
- The bottom bar shows the song that plays, the elapsed time, the loop count and the master volume.
- The bottom bar also shows the step that Space runs next and the two output devices.
- In Edit mode, the screen has two more panels. The panel on the right sets what a step is and holds the songs (4.3). The panel at the bottom has the fields of the selected step.
- The theme is dark. A booth is dark and a bright screen disturbs the audience.

## 4. Steps

### 4.1 Fields

| Field | Song step | Note step | Stop step |
|---|---|---|---|
| Title (one line) | yes | yes | yes |
| Notes (many lines, for trigger lines) | yes | yes | yes |
| Song (one from the project) | yes | – | – |
| Start point, default the beginning of the song | yes | – | – |
| End point, default the end of the song | yes | – | – |
| Volume, 0–100 %, default 100 | yes | – | – |
| Loop, default on | yes | – | – |
| Continue, default off (5.6) | yes | – | – |
| Continue limit, default the middle between the start point and the end point | yes | – | – |

The app numbers the steps automatically.

### 4.2 Edit operations

- Select a step to edit it. In Edit mode, the cursor step is the selected step.
- Add a step at the end or below the selected step. A new step is a note step.
- Change the fields of the selected step in the panel at the bottom.
- Set what the selected step is in the panel on the right (4.3).
- Move a step by drag, or with Alt+Up / Alt+Down.
- Duplicate a step. Delete a step (with confirmation).
- The app saves each change immediately. There is no Save button.

### 4.3 What a step is

In Edit mode, the panel on the right lists what the selected step can be:

- **Note**
- **Stop**
- Each song of the project.

One line is always selected. Choose Note or Stop, and the step becomes a note step or a stop step. Choose a song, and the step becomes a song step with that song.

- The panel at the bottom has no type switch and no song list. It shows the fields of the kind that you chose.
- The same panel adds songs and previews them (section 6).

One click changes the step, and the app saves immediately. To protect against a wrong click, a step keeps its song settings:

- The song settings are the start point, the end point, the continue limit, the volume, Loop and Continue.
- A step keeps these settings for each song that it had.
- When you choose a song that the step had before, its settings return. This is also true after a change to Note or Stop and back.
- When you choose a song for the first time on that step, the step gets the default settings.
- The project file holds the kept settings. Kept settings do not count as use of a song (section 6).

## 5. Run a show

### 5.1 Controls

| Control | Result |
|---|---|
| **Play** button on a song step that does not play | Runs that step. The cursor moves to the step below it. |
| **Stop** button on the song step that plays | Fades out the music. The cursor does not move. |
| **Preview** button (🎧) on a song step | Starts or stops the preview of that step (5.7). The cursor does not move. |
| **Space** | Runs the cursor step. The cursor moves one step down. |
| **Esc** | Fades out the music. The cursor does not move. |
| **Up / Down** | Moves the cursor. Runs nothing. |

Space on the last step runs it. After that, Space does nothing.

These controls work in Edit mode and in Show mode. In Edit mode, Space and Esc do not run while you type in a text field.

### 5.2 What "run" does

- **Song step, no music plays:** the song starts from its start point and fades in. With Continue on, it can start at a later position (5.6).
- **Song step, another song step plays:** crossfade. The old song fades out while the new song fades in.
- **Note step:** nothing changes in the sound. The music continues.
- **Stop step:** the music fades out. If no music plays, nothing changes.

The music continues through note steps until a stop step, the Stop button, Esc, or a new song step.

A song step has one button, and the button follows the state of the step:

| State of the song step | Button |
|---|---|
| Does not play | **Play** |
| Plays (fade-in included) | **Stop** |
| Fades out | Disabled, until the fade-out ends. Then **Play**. |
| Interrupted: the main output was lost while the step played (8.2) | **Play**. The song continues from the position of the loss, with a fade-in. |

A step stays interrupted until you press Play on it, run a different song step or a stop step, or press Esc.

You cannot start a song step that already plays:

- The step has no Play button while it plays.
- Space on a step that plays or fades out changes nothing in the sound. The cursor moves one step down.

Two different steps can use the same song. They are different steps, so a crossfade between them is permitted.

### 5.3 Fades

- The project has two values: **fade-in time** and **fade-out time**. Default 1.0 s each. Range 0–10 s, in steps of 0.1 s.
- A value of 0 gives an immediate start or stop.
- A fade starts from the level the song has at that moment. If you stop a song during its fade-in, the fade-out starts from the current level.
- In a crossfade, the old song uses the fade-out time and the new song uses the fade-in time.
- The fade curve is equal-power. The loudness stays even during a crossfade.

### 5.4 Start point and end point

- Each song step has its own start point and end point. Two steps can play different parts of the same song.
- The step plays only the part between the two points.
- The end point must be at least 1 s after the start point.
- **Natural points** are the beginning and the end of the file. **Cut points** are points that you moved.
- At a natural end, the song ends as the file ends. There is no fade.
- At a cut end, the song fades out with the project fade-out time. It reaches silence at the end point.
- If the part is shorter than the two fade times together, the app shortens the fades to fit.

To set the points, in Edit mode:

```
 0:00            0:12               1:26 limit          2:40        3:05
  ░░▒░░▒░░░░░░░░░┃▂▅▇▆▃▅▇█▇▅▃▂▃▅▆▇▅▃▂┊▂▃▅▇▆▅▃▂▃▅▇▆▅▃▂▁▂▃▅┃░▒░░▒░░░░░░
                 ▲ start                  │ position          ▲ end
  [ ▶ Listen ]   Start [ 0:12.0 ]   End [ 2:40.0 ]   Limit [ 1:26.0 ]   [ Reset ]
```

- The editor of a song step shows the waveform of the full song. A waveform is a picture of the loudness of the song over time.
- Two handles on the waveform mark the start point and the end point. Drag a handle to move its point.
- The parts outside the two handles are dimmed.
- If Continue is on, a third handle marks the continue limit (5.6). It has a different shape, and it stays between the two points. If Continue is off, the handle and its field are hidden.
- You can also type each point as `minutes:seconds.tenths`.
- **Reset** returns both points to the natural points and the continue limit to the middle.
- A click on the waveform puts the position there. **Listen** plays from the position and stops at the end point.
- Listen is a preview (5.7). It plays only on the preview output. It does not fade and does not loop.
- Without a valid preview output, you can set the points by eye and then check them with Play.
- The app makes the waveform one time, when you add the song, and keeps it in the project.

### 5.5 Loop

- A song step with Loop on starts again from its start point when it reaches its end point.
- At a natural start, the restart has no fade. At a cut start, the restart fades in with the project fade-in time.
- A song step with Loop off plays one time. When it ends, the app shows that no music plays.
- Known limit: an mp3 file can give a short silence at a natural loop point (the format adds padding). WAV and FLAC loop without a gap.

### 5.6 Continue

Use Continue when many steps use the same song. The audience then does not hear the same beginning each time.

- Each song step has a **Continue** switch. Default off.
- The switch is available only if a step above it in the list uses the same song. If not, the switch is disabled and has no effect.
- The app remembers, for each song, the position where the song last stopped on the main output.
- A song stops with the Stop button, Esc, a stop step, a crossfade to a different step, its end with Loop off, or the loss of the main output.
- If the stop is a fade-out, the remembered position is the position at the start of the fade-out.
- With Continue on, the step starts the song at the remembered position, with a fade-in.
- After the start, the step plays as usual. It goes to its end point and then loops, if Loop is on.

The step starts from its start point, as with Continue off, in each of these conditions:

- The song did not play since the project opened.
- The remembered position is after the **continue limit** of the step.
- The remembered position is before the start point of the step.

The continue limit:

- It is a point between the start point and the end point. You set it on the waveform (5.4), or you type it.
- Its purpose: a start too near the end point gives only a short time of music before the end or the loop.
- The default is the middle between the start point and the end point.
- Until you move the limit, it stays in the middle when you move the two points.

Other rules:

- If the same song plays on a different step at that moment, the new step starts at the same position. The music continues without a jump.
- A preview does not use Continue and does not change the remembered position.
- The app does not save the remembered positions. It clears them when the project opens.

### 5.7 Preview

- The Preview button (🎧) plays the song of that step on the preview output.
- A preview starts at the start point of the step and stops at its end point. It uses the volume of the step. It does not fade and does not loop.
- A preview does not use Continue (5.6). It always starts at the start point.
- The Preview button becomes a Stop button while the preview plays.
- Only one preview plays at a time. A new preview stops the old one.
- A preview changes nothing in the show: not the music on the main output, not the cursor, not the state of a step.
- You can preview any song step, also the one that plays on the main output.
- The master volume does not change the preview. Use the volume of the headphones.

A preview plays only when the preview output is valid. If it is not valid, all Preview and Listen buttons are disabled, in Edit mode and in Show mode.

The preview output is valid when all of these are true:

- The main output is a named device, not "System default".
- The preview output is a named device, and it is not the main output.
- The preview device is connected.

**A preview never reaches the main output.** If the preview device disconnects during a preview, the preview stops.

### 5.8 Protections during a show

- Show mode locks all edit operations. Only Play, Stop, Preview, Space, Esc, Up, Down and the master volume work.
- One switch at the top of the Project screen changes the mode. A project opens in Edit mode.
- The app asks for confirmation if you close the window or go back to Projects while music plays.
- The app keeps the computer awake while a project is in Show mode.
- A song step whose file is missing shows a warning. If you run it, the sound does not change and the warning flashes.
- The app loads all the songs of a project when the project opens. A step never waits for a file during the show.
- If the main output is "System default" in Show mode, the app shows a warning (see 8.2).

## 6. Songs

- The song list is in the panel on the right of the Project screen, in Edit mode (4.3).
- Add songs by file picker or by drag onto the window.
- The app copies each file into the project. The original file can move or disappear.
- Formats: MP3, WAV, M4A/AAC, FLAC, OGG, Opus. These are the formats that Electron plays without extra parts.
- The app tests each file at import. It refuses a file that it cannot play, with a clear message.
- One song can serve many steps.
- You cannot delete a song that a step uses. The app lists the steps that use it.
- Each song in the song list has a Preview button (🎧) in Edit mode. It plays the full song by the rules of 5.7.

## 7. Storage and sharing

- The app keeps all projects in its own data folder. The user does not manage files.
- **Export** writes one file, `<project name>.sunetsimplu`. It holds the steps, the project settings and the songs.
- **Import** reads that file on any computer, Mac or Windows.
- The app settings (section 8) stay on the computer and are not exported.

## 8. App settings

The settings apply to the app on this computer, not to a project.
The **Settings** button (⚙) is on the Projects screen and on the Project screen, in both modes.

### 8.1 Language

- Romanian is the default. English is the second language.
- The app remembers the choice.
- Only the interface is translated. The app never changes titles and notes.
- In Romanian, the Play and Stop buttons keep the English words "Play" and "Stop". The Loop switch is "Buclă" and the Continue switch is "Continuă".

### 8.2 Output devices

| Setting | Values | Default |
|---|---|---|
| **Main output** | "System default", or one named device | System default |
| **Preview output** | "None", or one named device | None |

- The lists show the devices that are connected at that moment. Each setting has a **Test** button that plays a short sound on that device.
- The app remembers each device by its name. If a remembered device is not connected, the setting shows its name with "not connected".
- The app does not let you set the same device for both outputs.
- If you change the main output while music plays, the app asks for confirmation.

Why "System default" is a risk: when Bluetooth headphones connect, macOS and Windows can make them the system default. The show music would then move to the headphones. For this reason, a preview needs a named main output.

If a device disconnects:

- **Main output lost:** the music stops immediately, without a fade. The app shows a red warning. The app does not move the music to a different device.
- The step that played becomes interrupted (5.2). The app keeps the position that the song had.
- While the main output is lost, a run does not start a song. The warning flashes.
- **Main output returns:** the warning goes away. The app stays silent. Press Play on the interrupted step, and its song continues from the position of the loss, with a fade-in.
- **Preview output lost:** the preview stops. The Preview and Listen buttons become disabled.
- **Preview output returns:** the buttons work again. The preview does not start again by itself.

## 9. Technology

| Part | Choice | Reason |
|---|---|---|
| Shell | Electron | Requested. One code base for Mac and Windows. |
| Interface | Vue 3 + TypeScript, built with electron-vite | Same family as the Nuxt work at Programming Gurus. |
| Audio | Web Audio API: one audio element and one gain node for each step that plays | Fades are exact and do not depend on the interface. Low memory use. |
| Output devices | Two audio contexts, one for each output, each sent to its device with `setSinkId` | The preview and the show are fully separate. |
| Waveform | wavesurfer.js with its regions part | It draws the waveform and gives the handles. |
| Project data | One JSON file and one `audio/` folder for each project | Easy to read, easy to export. |
| Export file | ZIP archive with the extension `.sunetsimplu` | One file to send. |
| Packaging | electron-builder: DMG for macOS arm64, installer for Windows x64 | Windows x64 also runs on Windows ARM. |

Confirmed by Cornel: the stack above, wavesurfer.js included.

The audio-device test is a throwaway app in `spike/audio-test/` (Electron 44.6, wavesurfer.js 8.0). Its results:

| Assumption | macOS, 2026-10-07 | Windows |
|---|---|---|
| Electron lists the output devices by name and plays on a named device | Proven | Open |
| Two outputs play at the same time, one of them Bluetooth | Proven | Open |
| The app detects that a device disconnected | Proven | Open |
| A lost device gives silence. The music does not move to a different device | Proven | Open |
| The waveform library plays on the preview output | Proven | Open |

Facts from the test, for the build:

- Chromium asks the app for two permissions: `media` and `speaker-selection`. The test granted both.
- A device name has a suffix, for example "External Headphones (Built-in)".
- When an output device disappears, its audio context reports an error and goes to the `suspended` state. Its device setting does not change.
- The context does not start again by itself when the device returns. The app must call `resume()` on it before the next play.
- Not tested: a Bluetooth device that is switched off while it plays, and "System default" as main output.

Open decision on packaging: electron-builder needs Wine on the Mac to build the Windows installer. The other ways are a build on a Windows computer, or a plain folder with the .exe from `@electron/packager`.

Known limits:

- The time precision of a cut end point and of a loop restart is some tens of milliseconds. The fades hide it.
- When a step continues a song that plays at that moment, the crossfade is a little louder in its middle. The two copies play the same sound.
- Bluetooth headphones add a delay of about 0.2 s. This is not important for a preview.
- macOS shows a warning at first open for an app that Apple did not notarize. The colleague must approve it once in System Settings.
- Windows SmartScreen shows a warning at first run. The colleague must click "Run anyway".

## 10. Later, if needed

- A second layer for sound effects over the music.
- Print the step list as a cue sheet.
