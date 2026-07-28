# Synth Bass: fourth playable instrument

Date: 2026-07-28
Status: implemented

## Goal

Add Synth Bass as a fourth playable instrument, implemented exactly like the
Melodica/Piano: reusing the shared instrument architecture (`ScaleEngine`,
`AudioEngine`, `ScaleInstrument`, the shared calibration system, navigation,
and the scale selection screen), rectangular calibration zones, and the
instant-trigger/ring-past-release interaction. The Bamboo Flute, Kalimba, and
Melodica/Piano's behavior must not change.

## Sample pack inspection

`assets/audio/SynthBass1/` was inspected exhaustively (directory listing +
per-file pitch verification, same rigor as the Piano's pack was inspected
after its "already contains every note" claim turned out to be wrong):

- 14 raw `.wav` files, no SFZ/README/metadata.
- Recorded pitch classes: **C, E, G#** only — a major-third grid, evenly
  spaced 4 semitones apart, across octaves 1–5 (`E1..E5`, `G#1..G#5`,
  `C2..C5`).
- Every file's measured pitch (autocorrelation, same method as every other
  instrument's mapping test) matches its filename within 2 cents.

This is a sparse pack (3 of 12 pitch classes recorded) — not a full chromatic
kit — so per the user's pre-approved fallback (identical to the
already-proven Piano fix): generate offline pitch-shifted samples for the
missing notes, verify their rendered pitch, and play every note from its own
dedicated file at `playbackRate = 1.0`. Because runtime pitch-shifting was
already confirmed unreliable on-device for the Melodica/Piano (same
underlying `expo-audio`/OS behavior applies to every instrument here), Synth
Bass went straight to pre-rendering — the runtime-shift path was never
attempted or shipped for this instrument.

Every target in MIDI 60..82 (confirmed, same as every other instrument, to be
the exact range any supported scale can ever produce) is within ±2 semitones
of its nearest recorded anchor — tighter than the Piano's ±3, since a
major-third grid is denser than a tritone grid.

## Sample resolution

`src/audio/synthBassSampleData.ts` (pure data, mirrors
`melodicaSampleData.ts` post-fix): 23 `SynthBassSampleDef` entries, one per
playable MIDI note (60..82):

- 6 exact recordings used directly: C4, E4, G#4, C5, E5, G#5.
- 17 notes pre-rendered offline into `assets/audio/SynthBass1/generated/` by
  `scripts/generate-synthbass-shifted-samples.js` (mirrors
  `generate-melodica-shifted-samples.js`: nearest-anchor Lanczos resampling,
  identical kernel). Verified: all 17 within ±5.6 cents of their target MIDI.

`resolveSynthBassSampleDef(targetMidi)`: nearest def by absolute MIDI
distance; for every in-range target this always resolves `shift = 0`,
`playbackRate = 1.0` (identical algorithm/formula to every other instrument's
resolver, but every target already has an exact pre-rendered def so the
fallback math never actually engages).

`src/audio/synthBassSamples.ts` (mirrors `melodicaSamples.ts`): static
`require()` map of all 23 files (6 real + 17 generated), joined with the data
module, exposing `resolveSynthBassSample: SampleResolver` (`sources` always
length 1 — no round-robin takes in this pack).

Gain defaults to `1.0` for all notes (no RMS analysis pass), same starting
point as the Kalimba/Melodica.

## Pad layout (7 touch zones)

The new background image (`assets/images/synth-bass.png`, renamed from
`"synth bass.png"` to match the kebab-case convention, 1536×1024) shows 7
vertical glowing pads. Default touch-zone centers were measured directly from
the image's pixels (bright-pad-vs-dark-background brightness thresholding,
not eyeballed): 7 distinct intervals at y≈244–838 (pad face vertical span),
evenly spaced ~197px apart, center-to-center:

| Degree | sourceX | sourceY |
|---|---|---|
| 1 | 179 | 541 |
| 2 | 377 | 541 |
| 3 | 574 | 541 |
| 4 | 770 | 541 |
| 5 | 967 | 541 |
| 6 | 1163 | 541 |
| 7 | 1359 | 541 |

Rectangular zones (`padShape="rectangle"`, same mechanism added for the
Melodica/Piano): `hitRadius` (half-width) = 80, comfortably under half the
~197px spacing so adjacent zones never overlap; `hitHeight` (half-height) =
280, covering most of the ~594px-tall pad face with margin top and bottom.
`visibleRadius`/`visibleHeight` = 66/230 (0.82× scale, same ratio as
Melodica's). Degree 1 (leftmost) is the root, following the existing
left-to-right convention.

Defaults are a starting point, refined like every other instrument via
calibration mode (move/resize/save/reset) and the desktop calibration server.

## New files

- `src/audio/synthBassSampleData.ts` — pure data + resolver (mirrors `melodicaSampleData.ts`).
- `src/audio/synthBassSamples.ts` — bundled `require()` map + `resolveSynthBassSample` (mirrors `melodicaSamples.ts`).
- `src/components/SynthBass/holeLayout.ts` — image size + default 7-pad rectangle layout.
- `src/components/SynthBass/calibrationStore.ts` — thin wrapper over the shared factory, storage key `jamit:synth-bass:calibrated-holes:v1`.
- `src/components/SynthBass/calibration.generated.json` — generated/default calibration, seeded with the measured defaults above.
- `src/components/SynthBass/SynthBassInstrument.tsx` — thin wrapper around `ScaleInstrument`: `noteStartHoldMs={0}`, `stopOnRelease={false}`, `padShape="rectangle"` (identical config to Melodica's, per "implement exactly like the Piano").
- `src/screens/SynthBassScreen.tsx` — mirrors `MelodicaScreen.tsx` (landscape lock/unlock, since the background image is landscape-oriented).
- `scripts/generate-synthbass-shifted-samples.js` — mirrors `generate-melodica-shifted-samples.js`.
- `scripts/test-synthbass-mapping.js` — mirrors `test-melodica-mapping.js` (exact-match assertions, ±10 cent tolerance).

## Modified files

- `assets/images/"synth bass.png"` → renamed to `assets/images/synth-bass.png`.
- `src/screens/InstrumentSelectionScreen.tsx` — add `"synthBass"` to the `Instrument` union and the instrument list.
- `App.tsx` — add `synthBass` to `INSTRUMENT_LABEL`; extend the render switch to also render `SynthBassScreen`.
- `scripts/desktop-calibration-server.js` — add a `synthBass` entry to `INSTRUMENTS` (rectangle shape), accept `INSTRUMENT=synthBass`.
- `tsconfig.test.json` — add `synthBassSampleData.ts` to `include`.
- `package.json` — add `test:mapping:synthbass` (wired into `test`) and `calibrate:desktop:synthbass`.

No changes to `ScaleInstrument.tsx`, `AudioEngine`, `padLayout.ts`, the shared
`calibrationStore.ts` factory, or any Bamboo Flute / Kalimba / Melodica file.

## Testing

- `scripts/test-synthbass-mapping.js`: for all 24 scales × 7 degrees, asserts
  `shift === 0` and `rate === 1.0` for every hole (every target has an exact
  pre-rendered def, same invariant as the Kalimba/Piano post-fix), 7 distinct
  sounding pitches per scale, all scale sound-sets pairwise different, and
  pitch-verifies all 23 WAV files (±10 cents tolerance).
- `npm run typecheck` must pass.
- `npm test` (full suite, including Flute/Kalimba/Melodica) confirmed
  unaffected.
- Manual verification in the running app: instant tap-to-play (no hold
  delay), note keeps ringing past finger-release, slide between pads,
  multi-touch, calibration mode (rectangular zones: move/resize/save/reset,
  invisible in normal play).
