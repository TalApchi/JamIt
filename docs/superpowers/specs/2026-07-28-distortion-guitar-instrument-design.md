# Distortion Guitar: fifth playable instrument (14 pads, two octave rows)

Date: 2026-07-28
Status: implemented

## Goal

Add Distortion Guitar as a fifth playable instrument, reusing the shared
architecture (`ScaleEngine`, `AudioEngine`, `ScaleInstrument`, the shared
calibration system, navigation). Unlike every previous instrument, this one
has 14 pads instead of 7: the same 7 scale degrees at two octaves at once.
The Bamboo Flute, Kalimba, Melodica/Piano, and Synth Bass's behavior must not
change.

## Sample pack inspection

`assets/audio/DistortionGuitar/` was inspected exhaustively before building
anything:

- 12 raw `.wav` files plus an SFZ (`031_DistortionGuitar.sfz`, with
  `loop_mode=loop_continuous` and loop points -- a real looping-sustain
  guitar patch). `AudioEngine` never loops for any instrument
  (`loop = false` is set unconditionally); this instrument gets the same
  treatment, so notes play through their recorded length and decay
  naturally rather than sustaining forever.
- Recorded anchors (confirmed against the SFZ's `pitch_keycenter` and by
  measuring each file's actual pitch): E2(40), A2(45), C#3(49), F3(53),
  A3(57), C#4(61), F4(65), A4(69), C#5(73), F5(77), A5(81), C6(84) -- spaced
  mostly 4 semitones apart. All 12 measured within ±7 cents of their
  filename.

Sparse (not full chromatic), so this follows the same proven pipeline as the
Piano and Synth Bass: pre-render offline, verify rendered pitch, play every
note from its own dedicated file at `playbackRate = 1.0`.

## The 14-pad / two-octave-row requirement

The user's spec: pads 1-7 play scale degrees 1-7 at one octave, pads 8-14
play the same 7 degrees one octave apart -- confirmed via worked examples
(C Major, G Major) to mean the upper row is always exactly the lower row's
notes **+12 semitones**, not independently computed per-note octave
boundaries. Since the existing single-octave instruments already produce
that lower row (`generatePitchedScale` output, MIDI 60..82), the combined
range needed is `[60..82] ∪ [72..94] = [60..94]` (35 unique notes) --
confirmed by direct computation, not assumption.

Two things were clarified with the user before implementation:
1. **Debug screen size**: the spec asked for 24 buttons, but 24 (2 octaves)
   can't cover the actual 35-note range needed (the top ~11 notes, MIDI
   85..94, are unreachable from a 24-button C4-B5 layout). The user chose to
   expand it to 35 buttons so every generated note is actually verifiable.
2. **Pad ordering**: the background image turned out to be a single
   horizontal strip of 14 identical pads, not two visual rows. The user
   explicitly wants the higher octave on the **left**: pads 1-7 (left) =
   octave 5, pads 8-14 (right) = octave 4 -- the reverse of the "natural"
   ascending reading.

## Architecture change: `ScaleInstrument` gains an optional `resolveDegree`

Every prior instrument mapped pad `degree` directly to `scale[degree - 1]`
(one pad per scale degree, 7 pads = 7 degrees, no octave math). A 14-pad
instrument needs pad `degree` to map to a scale index **and** an octave
shift. `src/components/shared/ScaleInstrument.tsx` gained:

```ts
resolveDegree?: (degree: number, scaleLength: number) => { scaleIndex: number; octaveOffset: number };
```

defaulting to `defaultResolveDegree`:

```ts
(degree, scaleLength) => ({
  scaleIndex: (degree - 1) % scaleLength,
  octaveOffset: Math.floor((degree - 1) / scaleLength)
})
```

For every existing instrument (7 pads, 7-note scale), `scaleLength` always
equals the pad count, so `octaveOffset` is always 0 and `scaleIndex` is
always `degree - 1` -- byte-for-byte the old behavior, confirmed by the full
mapping-test suite passing unchanged for the Flute/Kalimba/Melodica/Synth
Bass. `getPlayableNote` was updated to apply `octaveOffset * 12` to the
resolved MIDI and re-derive `noteWithOctave` via the existing
`midiToNoteWithOctave` (already exported from `noteEngine.ts`) when the
offset is non-zero.

Distortion Guitar overrides it to get its reversed left/right mapping:

```ts
function resolveDegree(degree, scaleLength) {
  if (degree <= scaleLength) return { scaleIndex: degree - 1, octaveOffset: 1 }; // left 7 = octave 5
  return { scaleIndex: degree - scaleLength - 1, octaveOffset: 0 }; // right 7 = octave 4
}
```

Verified directly against the user's worked examples:
- C Major: left = C5 D5 E5 F5 G5 A5 B5, right = C4 D4 E4 F4 G4 A4 B4. ✓
- G Major: left = G5 A5 B5 C6 D6 E6 F#6, right = G4 A4 B4 C5 D5 E5 F#5. ✓

The preload effect and the debug mapping logger also changed from iterating
`scale` (always 7 entries) to iterating `holes` (every real pad) --
otherwise a >7-pad instrument would only ever preload/log its first 7 pads'
notes, silently dropping the other row.

No other change to `ScaleInstrument.tsx`'s touch/gesture/calibration logic,
`AudioEngine`, `padLayout.ts`, or the shared `calibrationStore.ts` factory.

## Sample resolution

`src/audio/distortionGuitarSampleData.ts` (pure data, mirrors
`synthBassSampleData.ts`): 35 `DistortionGuitarSampleDef` entries, MIDI
60..94:

- 7 exact recordings used directly: C#4, F4, A4, C#5, F5, A5, C6.
- 28 notes pre-rendered offline into
  `assets/audio/DistortionGuitar/generated/` by
  `scripts/generate-guitar-shifted-samples.js` (Lanczos resampling, same
  kernel as every other instrument's generator). The highest anchor (C6,
  midi 84) is 10 semitones below the top of the range -- the top 11 notes
  (84..94) all shift up from C6, the largest shift used anywhere in this
  app. Verified: all 28 within ±5.4 cents of target, including the +10
  semitone case (Guitar_A#6.wav, 4.5 cents off) -- confirms Lanczos
  resampling holds up even at that extreme (audible timbre at +10 semitones
  is naturally more "chipmunked" than a small shift, which is an inherent
  limit of the source material, not a bug; verify by ear via the debug
  screen).

`resolveDistortionGuitarSampleDef(targetMidi)`: identical nearest-def +
`2^(shift/12)` algorithm as every other instrument, but every target in
60..94 already has an exact def, so the fallback math never actually
engages (confirmed: all 35 targets resolve `shift === 0`).

`src/audio/distortionGuitarSamples.ts` (mirrors `synthBassSamples.ts`):
static `require()` map of all 35 files, exposing
`resolveDistortionGuitarSample: SampleResolver`.

## Pad layout (14 touch zones)

Background image `assets/images/distortion-guitar.png` (renamed from
`"distortion guitar.png"`, 1536×1024): a single horizontal strip of 14
fret-shaped pads (not two visual rows). Centers measured from the image
(brightness thresholding): 14 evenly spaced columns from x≈170 to x≈1520,
~96-97px apart, y≈700 (fret area spans y≈430-980).

Rectangular zones (`padShape="rectangle"`): `hitRadius` (half-width) = 40,
`hitHeight` (half-height) = 260. `visibleRadius`/`visibleHeight` = 33/213
(0.82× scale, same ratio as every other rectangle instrument).

Per the user's explicit direction: pads 1-7 (left, x=218..796) are octave 5;
pads 8-14 (right, x=893..1471) are octave 4. Degree 1 and degree 8 (each
row's tonic) are marked `isRoot: true`.

## New files

- `src/audio/distortionGuitarSampleData.ts`, `src/audio/distortionGuitarSamples.ts`.
- `src/components/DistortionGuitar/holeLayout.ts`, `calibrationStore.ts`, `calibration.generated.json`, `DistortionGuitarInstrument.tsx`.
- `src/screens/DistortionGuitarScreen.tsx` (mirrors `SynthBassScreen.tsx`).
- `src/screens/GuitarAudioDebugScreen.tsx` -- 35 buttons (C4..A#6), same bypass-everything pattern as `PianoAudioDebugScreen.tsx`, scrollable grid since 35 buttons don't fit one screen.
- `scripts/generate-guitar-shifted-samples.js`, `scripts/test-guitar-mapping.js`.

## Modified files

- `src/components/shared/ScaleInstrument.tsx` -- `resolveDegree` prop (see above); preload/mapping-log effects iterate `holes` instead of `scale`.
- `assets/images/"distortion guitar.png"` → renamed `assets/images/distortion-guitar.png`.
- `src/screens/InstrumentSelectionScreen.tsx` -- add `"distortionGuitar"`; instrument-picker row switched to `flexWrap` (5 instruments no longer fit one row).
- `App.tsx` -- add `distortionGuitar` label, `DistortionGuitarScreen` render branch, `guitar-audio-debug` phase + button.
- `scripts/desktop-calibration-server.js` -- add `distortionGuitar` entry (rectangle, 14 pads); the two hardcoded `=== 7` / `!== 7` hole-count checks generalized to the selected instrument's own pad count (needed for any instrument with pad count != 7, not just this one).
- `tsconfig.test.json`, `package.json` -- add the new sample-data include and `test:mapping:guitar`/`calibrate:desktop:guitar` scripts.

No changes to `AudioEngine`, `padLayout.ts`, the shared `calibrationStore.ts`
factory, or any Bamboo Flute / Kalimba / Melodica / Synth Bass file.

## Testing

- `scripts/test-guitar-mapping.js`: for all 24 scales × 14 pads, asserts
  `shift === 0` / `rate === 1.0` for every pad, 14 distinct sounding
  pitches per scale, **pad N (left) is always exactly +12 vs pad N+7
  (right)** for N in 1..7, all scale sound-sets pairwise different, and
  pitch-verifies all 35 WAV files (±10 cents).
- `npm run typecheck` passes.
- Full regression: `test:mapping` (Flute), `test:mapping:kalimba`,
  `test:mapping:melodica`, `test:mapping:synthbass` all re-run and confirmed
  passing unchanged after the `ScaleInstrument.tsx` generalization.
- Manual verification in the running app: instant tap-to-play, rings past
  release, slide/multi-touch, calibration (rectangular zones,
  move/resize/save/reset, invisible in normal play), Guitar Audio Debug
  screen's 35 buttons for verifying every note (including the extreme +10
  semitone ones) before testing the full instrument.
