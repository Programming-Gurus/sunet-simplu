# Sunet Simplu — Design

*by Programming Gurus. Status: version 0.4.0 is in the code, 2026-10-10. This document describes the app as built. The app runs on macOS (Apple Silicon); Windows waits (section 9). `spike/audio-test/` holds the throwaway audio-device test.*

Sunet Simplu plays the music of a theatre play, one step at a time, with fades.
It also shows the operator which lights to change at each step.
One person operates it from the booth, next to the lights app.

## 1. Terms

| Term | Meaning |
|---|---|
| **Project** | One play. It holds the songs, the steps and the fade times. |
| **Song** | One audio file that you added to a project. |
| **Step** | One line in the list of a project. You run steps from top to bottom during a show. |
| **Song step** | A step that starts a song. |
| **Note step** | A step that does nothing to the sound. It holds a trigger, notes and light cues. |
| **Stop step** | A step that fades out one or more song steps. |
| **Background step** | A song step with Background on. It stops nothing, and other song steps do not stop it. |
| **Level meter** | A bar that shows the level of one sound at this moment. It moves during a fade. |
| **Trigger** | What tells the operator to run a step: a line that an actor says, an action on the stage, or both. |
| **Light group** | A set of lights that the operator switches together, for example "Left spot". It has a name and an icon. |
| **Light cue** | One light change of a step: a light group, on or off, and a colour. The operator makes the change in the lights app. |
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
- A trigger for each step: a line, an action, or both.
- Light cues: each step shows which light groups go on or off, and in which colour.
- Play with fade-in, stop with fade-out, automatic crossfade, loop.
- Fade times for the project, and for each song step that needs its own.
- Sound effects: a song step can start and stop without a fade.
- Background sound: a song step can play under the other songs.
- A start point and an end point for each song step.
- Continue a song from the position where it last stopped.
- A main output and a preview output, set in the app settings.
- Romanian and English interface.
- macOS on Apple Silicon. Windows is planned, but it is not a priority: the shows run from a 13-inch Mac.

Not in scope for version 1:

- A volume for the whole show. The sound console of the hall sets it.
- Effects, equalizer.
- Control of the lights app.
- Accounts, cloud sync, automatic updates.

## 3. Screens

### 3.1 Projects screen

The app opens here.

- A list of projects: name, number of steps, date of last change.
- Buttons: **New project**, **Open**, **Duplicate**, **Delete**, **Import**, **Export**, **Settings**.
- **New project** and **Duplicate** ask for a name.
- Delete asks for confirmation and shows the project name. The project goes to the Trash of the computer, so a wrong delete can be undone.
- The Programming Gurus mark, with the text "concept by" and the dark-mode logo. It is a link that opens programminggurus.ro in the default browser. The text stays in English in both languages. The same mark is on the Settings screen.

### 3.2 Project screen

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ← Projects   Livada de vișini     [ Edit | SHOW ]   Fade 10.0 / 5.0    ⚙  │
├────────────────────────────────────────────────────────────────────────────┤
│  1  ♪  Opening                       uvertura.mp3            [🎧] [ Play ] │
│        ☺ The hall doors close                                              │
│  2  ✎  ☺ The third gong                                                    │
│        ( Hall · off )  ( Stage · on · warm white )                         │
│▶ 3  ♪  The letter                    scrisoare.mp3    ▮▮▮    [🎧] [ Stop ] │
│        ▭ „Nu mai am nimic de spus.”                                        │
│  4  ■  Stop music                                      stops 3    [ Stop ] │
│        ☺ Ana leaves the stage                                              │
│  5  ♪  Finale                        final.mp3  0:12–2:40    [🎧] [ Play ] │
├────────────────────────────────────────────────────────────────────────────┤
│ NOW: The letter — scrisoare.mp3    01:42 / 03:10 (loop 1)    Level ▬▬▬▬▭   │
│ NEXT (Space): 4 · Stop music          Out: Headphone jack · 🎧 AirPods     │
└────────────────────────────────────────────────────────────────────────────┘
```

- Each step shows: number, type icon, title, trigger, notes and light cues.
- The trigger is below the title. A line is in the quotation marks of the language. A small icon tells a line from an action.
- A note step without a title shows its trigger as its first line.
- Each light cue is a chip: the icon of the group in the colour of the cue, the name of the group, "on" or "off", and the name of a palette colour (4.5).
- In Edit mode, the triggers and the notes share one line. In Show mode, each trigger has its own line and the chips are large.
- A song step also shows the file name, the start and end points if they are not the default, a "continues" label if Continue is on, a Preview button (🎧) and a Play or Stop button.
- A song step shows a "background" label if Background is on, and a "no fade" label if a fade switch is off.
- A song step shows a fade time if the step has its own (5.3), for example "fade out 20.0 s".
- A song step that plays or fades out has a thin progress bar at the bottom of its row. The bar shows the position between the start point and the end point. It starts again at each loop.
- A stop step shows the numbers of the steps that it stops, and a Stop button.
- Each step that plays is highlighted. A step that fades out has the label "Fades out". The cursor step has a marker (▶ above).
- The bottom bar shows the song that plays, the elapsed time and the loop count. If a normal song and a background play together, it shows the normal song.
- The bottom bar has one level meter for each sound that plays or fades out. A meter moves during a fade. It uses the scale of the volume slider of a step, so it stops at the volume of the step.
- The bottom bar shows "No music plays in the hall" only when no sound plays and no sound fades out. During a fade-out, it keeps the song, with "Fades out".
- The app has no volume for the whole show. The sound console of the hall sets it.
- The bottom bar also shows the step that Space runs next and the two output devices.
- In Edit mode, the screen has two more panels. The panel on the right sets what a step is and holds the songs (4.3). The panel at the bottom has the fields of the selected step.
- In Edit mode, the bottom bar is one thin line: the song that plays, a Stop button and the level meters. This Stop button fades out all sound, as Esc does.
- In Edit mode, the project name at the top is a text field. Change it there.
- The smallest window is 1280 × 720, so all panels fit a 13-inch screen.
- The theme is dark. A booth is dark and a bright screen disturbs the audience.

## 4. Steps

### 4.1 Fields

| Field | Song step | Note step | Stop step |
|---|---|---|---|
| Title (one line) | yes | yes | yes |
| Trigger: Line and Action, each with a switch and a text (4.4) | yes | yes | yes |
| Notes (many lines) | yes | yes | yes |
| Light cues, one at most for each light group (4.5) | yes | yes | yes |
| Song (one from the project) | yes | – | – |
| Start point, default the beginning of the song | yes | – | – |
| End point, default the end of the song | yes | – | – |
| Volume, 0–100 %, default 100 | yes | – | – |
| Loop, default on | yes | – | – |
| Continue, default off (5.6) | yes | – | – |
| Continue limit, default the middle between the start point and the end point | yes | – | – |
| Fade in, default on (5.3) | yes | – | – |
| Fade out, default on (5.3) | yes | – | – |
| Fade-in time, default the time of the project (5.3) | yes | – | – |
| Fade-out time, default the time of the project (5.3) | yes | – | – |
| Background, default off (5.2) | yes | – | – |
| The steps that it stops, default the nearest song step above it (5.2) | – | – | yes |

The app numbers the steps automatically.

### 4.2 Edit operations

- Select a step to edit it. In Edit mode, the cursor step is the selected step.
- Add a step at the end (**Add step**, below the list) or below the selected step (**Add below**). A new step is a note step.
- Change the fields of the selected step in the panel at the bottom.
- Set what the selected step is in the panel on the right (4.3).
- Move a step by drag, or with Alt+Up / Alt+Down.
- Duplicate a step. Delete a step (with confirmation).
- While a step plays or fades out, you cannot delete it, change what it is or change its Background switch. Stop it first.
- A change to the volume of the step that plays is heard immediately. A change to a fade-out time applies at the next stop. Other changes apply when the step starts again.
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

- The song settings are the start point, the end point, the continue limit, the volume, Loop, Continue, Fade in, Fade out, the two fade times and Background.
- A step keeps these settings for each song that it had.
- When you choose a song that the step had before, its settings return. This is also true after a change to Note or Stop and back.
- When you choose a song for the first time on that step, the step gets the default settings.
- The project file holds the kept settings. Kept settings do not count as use of a song (section 6).

### 4.4 Trigger

The trigger tells you when to run the step.

- A step has two switches, **Line** and **Action**. Each one has a text field.
- Line: the line that an actor says. Action: what happens on the stage.
- A step can have one of them, both, or none.
- Most of the time a line triggers a step. A new step has Line on and Action off.
- The text field of a switch that is off is disabled. The step keeps its text.
- The step list shows only a trigger that is on and has text.
- Title and Notes do not change. Use Title for the name of the step and Notes for all other text.

A project from before version 0.4.0 has no triggers. There, the title of a step was the line:

- When the app reads such a step, its title becomes the text of Line, and Title becomes empty.
- This is true for the three kinds of step.
- The step list then shows the song name, "Stop music" or the line as the first line of the step.
- The project file changes at the next save.

### 4.5 Light cues

A light cue tells you what to change in the lights app. The app does not control the lights.

- In Edit mode, the editor lists the light groups (8.3). Each group has three choices: no change (–), **On**, **Off**.
- On and Off make a light cue for that group. No change removes it.
- A step has one light cue at most for each group. A step can change many groups.
- A cue that turns a group on has a colour. The colour button of the group opens a palette.
- The palette has 10 stage colours: warm white, cold white, red, orange, yellow, green, cyan, blue, purple, pink.
- **Other colour** gives any colour. The step list shows such a colour only as the tint of the chip, without a name.
- A new cue has warm white.
- A cue that turns a group off shows no colour. It keeps its colour for the next time that you turn it on.
- Esc closes an open palette. It does not stop the music.
- Without light groups, the editor shows a link to Settings.
- The lights are a column next to the other fields. For a song step in a small window, they are a strip below the fields.
- The app has no intensity value and no display of the lights that are on at this moment.

## 5. Run a show

### 5.1 Controls

| Control | Result |
|---|---|
| **Play** button on a song step that does not play | Runs that step. In Show mode, the cursor moves to the step below it. In Edit mode, the cursor goes to that step (see below). |
| **Stop** button on a song step that plays | Fades out that step only. The cursor can then skip a stop step (see below). |
| **Stop** button on a stop step | Runs that step: its steps fade out (5.2). The cursor moves to the step below it. |
| **Preview** button (🎧) on a song step | Starts or stops the preview of that step (5.7). The cursor does not move. |
| **Space** | Runs the cursor step. The cursor moves one step down. In Edit mode, the cursor stays on a song step that starts (see below). |
| **Esc** | Fades out all sound, the background included. The cursor moves as for the Stop button of a song step. |
| **Up / Down** | Moves the cursor. Runs nothing. |

Space on the last step runs it. After that, Space does nothing.

The cursor in Edit mode, when a song step starts:

- In a rehearsal, you start a song and then you write its trigger. The step that started must stay selected.
- Space on a song step that does not play starts it. The cursor stays on that step.
- The Play button of a song step starts it. That step becomes the selected step.
- A second Space on the step that plays changes nothing in the sound. The cursor moves one step down (5.2).
- Stop steps and note steps do not change: the cursor moves one step down.
- Show mode does not change: the cursor always moves one step down.

The cursor after a stop by hand (a Stop button of a song step, or Esc):

- A stop step at the cursor can have nothing left to stop: none of its steps plays. The cursor then moves to the first step below it that is not such a stop step.
- The cursor stays on a stop step that can still stop a sound.
- The cursor does not skip a note step, because a note can hold a cue for the lights.
- For the same reason, the cursor does not skip a stop step that has a light cue.
- Without sound, Esc changes nothing and the cursor does not move.

These controls work in Edit mode and in Show mode. In Edit mode, Space and Esc do not run while you type in a text field. Esc then leaves the text field.

Space always runs the cursor step, also when a button or a switch has the focus. To set a switch from the keyboard, use Enter.

A click on a step moves the cursor to it, in both modes. It runs nothing.

### 5.2 What "run" does

- **Song step, no music plays:** the song starts from its start point and fades in. With Continue on, it can start at a later position (5.6).
- **Normal song step, another normal song step plays:** crossfade. The old song fades out while the new song fades in.
- **Background step:** its song starts. Nothing stops.
- **Note step:** nothing changes in the sound. The music continues.
- **Stop step:** the steps that it names fade out. Other sound continues. If none of its steps plays, nothing changes.

The sound has two layers:

- A song step is a normal step, or a background step if its Background switch is on.
- Only one normal step plays at a time. A new normal step crossfades with the old one.
- A background step stops nothing, and a song step never stops it. A background and a normal song play together. Two background steps also play together.
- Use Background for music or an ambience that continues while sound effects or other songs play.

A normal song continues through note steps until a stop step that names it, its Stop button, Esc, or a new normal song step.
A background step continues until a stop step that names it, its Stop button, Esc, or its end with Loop off.

What a stop step stops:

- In Edit mode, a stop step lists the song steps above it, nearest first. Each one has a checkbox.
- Without a choice, the stop step stops the nearest song step above it. This default follows when you move or add steps.
- After you set a checkbox, the stop step stops the steps that you chose. At least one step stays checked.
- **Back to automatic** returns the default.
- A stop step never stops a step below it.
- A consequence: in "music, sound effect, stop", the default stops the sound effect. Check the music step.

A song step has one button, and the button follows the state of the step:

| State of the song step | Button |
|---|---|
| Does not play | **Play** |
| Plays (fade-in included) | **Stop** |
| Fades out | Disabled, until the fade-out ends. Then **Play**. |
| Interrupted: the main output was lost while the step played (8.2) | **Play**. The song continues from the position of the loss, with a fade-in. |

A step stays interrupted until you press Play on it, run a stop step that names it, or press Esc. A normal step that runs also ends the interrupted state of a normal step.

The cursor after a run that starts no song:

- The main output is lost (8.2): the cursor does not move. Connect the device and run the step again.
- The file of the step is missing (5.8): the cursor moves one step down.

You cannot start a song step that already plays:

- The step has no Play button while it plays.
- Space on a step that plays or fades out changes nothing in the sound. The cursor moves one step down.

Two different steps can use the same song. They are different steps, so a crossfade between them is permitted.

### 5.3 Fades

- The project has two values: **fade-in time** and **fade-out time**. The default is 10.0 s for the fade-in and 5.0 s for the fade-out. Range 0–300 s, in steps of 0.1 s.
- A value of 0 gives an immediate start or stop.
- A fade starts from the level the song has at that moment. If you stop a song during its fade-in, the fade-out starts from the current level.
- In a crossfade, the old song uses its fade-out time and the new song uses its fade-in time.
- The fade curve is equal-power. The loudness stays even during a crossfade.

Each song step can have its own fade times:

- A song step has a **fade-in time** and a **fade-out time**. Without a value, the step uses the time of the project.
- In Edit mode, each time has a field next to its fade switch. An empty field shows the time of the project, dimmed.
- Type a time to give the step its own. The range is the same as for the project.
- A reset button next to the field returns the step to the time of the project. An empty field does the same.
- A step with its own time does not follow a later change to the project time.
- Each song fades out with the fade-out time of its step: at its Stop button, a stop step, Esc, a crossfade and a cut end point.

Sound effects must not fade. For this, each song step has two switches, **Fade in** and **Fade out**. Default on.

- With Fade in off, the step starts at full level.
- With Fade out off, the step stops immediately: at its Stop button, a stop step, Esc, a crossfade and a cut end point.
- In a crossfade, each song uses its own switches.
- An immediate start or stop in the middle of a sound has a fade of 0.02 s. It removes the click, and you do not hear it as a fade.

### 5.4 Start point and end point

- Each song step has its own start point and end point. Two steps can play different parts of the same song.
- The step plays only the part between the two points.
- The end point must be at least 1 s after the start point.
- **Natural points** are the beginning and the end of the file. **Cut points** are points that you moved.
- At a natural end, the song ends as the file ends. There is no fade.
- With Loop off, at a cut end the song fades out with its fade-out time, if Fade out is on. It reaches silence at the end point.
- With Loop on, the end point is a loop point. A loop point has no fade (5.5).
- With Loop off, if the part is shorter than the two fade times together, the app shortens the fades to fit.

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
- A click on the waveform puts the position there. **Listen** plays from the position to the end point.
- Listen is a preview (5.7). It plays only on the preview output. It does not fade.
- With Loop on, Listen starts again from the start point, as the step does in the hall. Put the position some seconds before the end point to hear the loop point.
- With Loop off, Listen stops at the end point.
- Without a valid preview output, you can set the points by eye and then check them with Play.
- The app makes the waveform one time, when you add the song, and keeps it in the project.

### 5.5 Loop

- A song step with Loop on starts again from its start point when it reaches its end point.
- A loop point has no fade. A looped song fades only at its start and at its stop.
- A fade-in or a fade-out that is longer than the time to the end point continues over the loop point.
- A restart at a cut point has the fade of 0.02 s that removes the click (5.3). You do not hear it as a fade.
- A song step with Loop off plays one time. When it ends and no other sound plays, the app shows that no music plays.
- Known limit: an mp3 file can give a short silence at a natural loop point (the format adds padding). WAV and FLAC loop without a gap.

### 5.6 Continue

Use Continue when many steps use the same song. The audience then does not hear the same beginning each time.

- Each song step has a **Continue** switch. Default off.
- The switch is available only if a step above it in the list uses the same song. If not, the switch is disabled and has no effect.
- The app remembers, for each song, the position where the song last stopped on the main output.
- A song stops with the Stop button, Esc, a stop step, a crossfade to a different step, its end with Loop off, or the loss of the main output.
- The song plays during a fade-out. The remembered position is the position at the end of the fade-out, where the song reached silence. Example: Stop at 1:00 with a fade-out of 5 s gives 1:05.
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

- If the same song plays on a different step at that moment, the new step starts at the same position. The music continues without a jump. This is also true while the song fades out.
- A preview does not use Continue and does not change the remembered position.
- The app does not save the remembered positions. It clears them when the project opens.

### 5.7 Preview

- The Preview button (🎧) plays the song of that step on the preview output.
- A preview starts at the start point of the step. It uses the volume of the step. It does not fade.
- With Loop on, a preview loops as the step does in the hall: at the end point it starts again from the start point, without a fade. It plays until you stop it.
- With Loop off, a preview stops at the end point.
- A preview does not use Continue (5.6). It always starts at the start point.
- The Preview button becomes a Stop button while the preview plays.
- Only one preview plays at a time. A new preview stops the old one.
- A preview changes nothing in the show: not the music on the main output, not the cursor, not the state of a step.
- You can preview any song step, also the one that plays on the main output.
- The app has no volume for the preview. Use the volume of the headphones.

A preview plays only when the preview output is valid. If it is not valid, all Preview and Listen buttons are disabled, in Edit mode and in Show mode.

The preview output is valid when all of these are true:

- The main output is a named device, not "System default".
- The preview output is a named device, and it is not the main output.
- The preview device is connected.

**A preview never reaches the main output.** If the preview device disconnects during a preview, the preview stops.

### 5.8 Protections during a show

- Show mode locks all edit operations. Only Play, Stop, Preview, Space, Esc, Up and Down work.
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
- Each song in the song list has a Preview button (🎧) in Edit mode. It plays the full song one time, by the rules of 5.7.
- Each song in the song list has a Delete button. A deleted file goes to the Trash of the computer.
- If two files have the same name, the second one gets a number: `vals (2).mp3`.

## 7. Storage and sharing

- The app keeps all projects in its own data folder. The user does not manage files.
- **Export** writes one file, `<project name>.sunetsimplu`. It holds the steps, the project settings and the songs.
- **Import** reads that file on any computer, Mac or Windows.
- An import is always a new project. It never replaces a project. If the name is in use, the import gets a number: "Livada de vișini (2)".
- The app settings (section 8) stay on the computer and are not exported. The light groups are the exception:
  - The project file holds a copy of each light group that its steps use: id, name and icon.
  - The app refreshes the copy from the settings at each save and at each export.
  - On a different computer, the steps show their light cues from this copy (8.3).
- A newer version of the app opens the projects and the export files of an older version with every value kept. A setting that an older file does not have gets its default.
- One value moves: the title of a step from before version 0.4.0 becomes its line (4.4).
- An older version of the app does not know the triggers. It shows a step that version 0.4.0 saved without the moved title.

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
- If you change the main output while music plays, the app asks for confirmation. The music then moves to the new device and continues.

Why "System default" is a risk: when Bluetooth headphones connect, macOS and Windows can make them the system default. The show music would then move to the headphones. For this reason, a preview needs a named main output.

If a device disconnects:

- **Main output lost:** the music stops immediately, without a fade. The app shows a red warning. The app does not move the music to a different device.
- Each step that played becomes interrupted (5.2). The app keeps the position that each song had.
- While the main output is lost, a run does not start a song. The warning flashes.
- **Main output returns:** the warning goes away. The app stays silent. Press Play on the interrupted step, and its song continues from the position of the loss, with a fade-in.
- **Preview output lost:** the preview stops. The Preview and Listen buttons become disabled.
- **Preview output returns:** the buttons work again. The preview does not start again by itself.

### 8.3 Light groups

A light group is a set of lights that you switch together. The steps of all projects use the same groups.

- Settings has a list of light groups. Each group has a name and an icon.
- **Add group** adds a group with a light-bulb icon and puts the cursor in its name.
- A click on the icon opens the icon picker.
- The icon picker has all the icons of Material Design Icons, about 7,400. Without a search, it shows the icons of stage lights.
- The search field finds icons by name. The names are in English, for example "spotlight", "lamp", "led".
- The picker shows 240 icons at most. Type more of the name to see fewer icons.
- A new name or a new icon shows immediately on all steps.
- You cannot delete a group that a step of a project on this computer uses. The app names those projects.
- Delete of a group that no project uses asks for confirmation.

Light groups and a second computer:

- A project holds a copy of the groups that its steps use (section 7).
- When a project opens, the app adds to Settings each group of the project that Settings does not have.
- For a group that Settings has, the name and the icon of Settings win.
- The app knows a group by its id, not by its name. Two computers that each made a group "Spot" have two different groups.
  After an import, Settings then has two groups with that name. Change the steps to one of them and delete the other.

## 9. Technology

| Part | Choice | Reason |
|---|---|---|
| Shell | Electron | Requested. One code base for Mac and Windows. |
| Interface | Vue 3 + TypeScript, built with electron-vite | Same family as the Nuxt work at Programming Gurus. |
| Audio | Web Audio API: one audio element and one gain node for each step that plays | Fades are exact and do not depend on the interface. Low memory use. |
| Output devices | Two audio contexts, one for each output, each sent to its device with `setSinkId` | The preview and the show are fully separate. |
| Waveform | wavesurfer.js with its regions part | It draws the waveform and gives the handles. |
| Icons of light groups | Material Design Icons (`@mdi/js`, Apache License 2.0) | About 7,400 icons with many stage lights. A group keeps the drawing of its icon, so a project shows it without the library. |
| Colour palette, icon picker | The browser's own popover with anchor positioning, and the `<dialog>` element | No extra library. The app has one browser engine, so no fallback is needed. |
| Project data | One JSON file and one `audio/` folder for each project | Easy to read, easy to export. |
| Export file | ZIP archive with the extension `.sunetsimplu` | One file to send. |
| Packaging | electron-builder: DMG for macOS arm64. Later: installer for Windows x64 | Windows x64 also runs on Windows ARM. |

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

Windows waits (decision by Cornel, 2026-10-07). The app code has no Mac-only part, but nobody ran it on Windows. When Windows is needed:

- Run the audio-device test and the self-test on a Windows computer.
- Decide the packaging: electron-builder needs Wine on the Mac to build the Windows installer. The other ways are a build on a Windows computer, or a plain folder with the .exe from `@electron/packager`.

How the app is checked:

| Command | What it does |
|---|---|
| `npm run typecheck` | Checks the types of all code. |
| `npm test` | Unit tests of the rules that need no sound: points, fades, Continue, kept settings, triggers, light cues, output rules, time formats. They also open project files that versions 0.2.0 and 0.3.0 wrote (`tests/fixtures/`). |
| `npm run selftest` | The app runs hidden on a temporary data folder and drives itself: projects, light groups, edit operations, the keys, the sound rules on the real audio engine, the output devices, export and import. It makes no sound: its main output is silent. |
| `npm run dist:mac` | Builds `dist/Sunet Simplu-<version>-arm64.dmg`. |

The self-test measures fade levels and song positions. It does not hear. A person must check the sound by ear, and a real cable pull.

The DMG has a local signature only, with no Apple developer certificate.

Known limits:

- The time precision of a cut end point and of a loop restart is some tens of milliseconds. With Loop off, the fade hides it. A loop restart at a cut point can have a short gap. A loop of the full file has the smallest gap.
- When a step continues a song that plays at that moment, the crossfade is a little louder in its middle. The two copies play the same sound.
- Bluetooth headphones add a delay of about 0.2 s. This is not important for a preview.
- macOS shows a warning at first open for an app that Apple did not notarize. On each computer that did not build the app, approve it one time: System Settings, Privacy & Security, "Open Anyway".
- A song step starts about 0.02 s after the key (measured on a MacBook Pro).
- Windows SmartScreen shows a warning at first run. The colleague must click "Run anyway".
- The icons of the light groups are filled shapes. The other icons of the app are thin lines.
- The names of the icons are in English only. A search in Romanian finds nothing.
- With a song step selected in the smallest window (1280 × 720), the step list shows about three steps. A larger window shows more.

## 10. Later, if needed

- Print the step list as a cue sheet.
