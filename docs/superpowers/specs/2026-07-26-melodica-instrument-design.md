# Melodica: third playable instrument

Date: 2026-07-26
Status: approved for planning

## Goal

Add a Melodica as a third playable instrument, reusing the existing shared
instrument architecture (`ScaleEngine`, `AudioEngine`, `ScaleInstrument`, the
shared calibration system, navigation, and the scale selection screen) exactly
as the Kalimba does today. Only the instrument image, default pad layout, and
sample-resolution module differ. The Bamboo Flute and Kalimba's behavior must
not change.

## Background: the sample pack is not what was assumed

The user's original request stated the Melodica sample pack "already contains
all required notes" and asked for no runtime pitch shifting. Investigation
found:

- There is no `assets/audio/melodica` folder. The only new (untracked) audio
  asset is `assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/`.
- That pack is the FreePats "FM Piano 1" kit (DX7 "E. Piano 1" emulation,
  public domain) — confirmed by its own `README.txt`.
- Exhaustive inspection of every file (36 `.wav` files total) and its `.sfz`
  mapping shows it records exactly two pitch classes, **C and F#**, across
  octaves 1–7 (C2–C7, F#1–F#6), at three velocity layers each (60/80/100).
  This is the standard sparse-multisample SFZ technique (±3 semitone key
  ranges per sample) — not a full chromatic kit.

Resolved with the user: this instrument (still named "Melodica" per the
original request) will use the audio as-is, resolved with the same
nearest-sample + runtime pitch-shift algorithm the Bamboo Flute already uses
(`resolveFluteSampleDef`), not the Kalimba's exact-match/round-robin approach.
Always the **v100** (loudest) velocity layer — neither the Flute nor Kalimba
are velocity-sensitive today, so there is no touch-pressure signal to pick a
layer by. The `assets/audio/piano` folder name is kept as-is (it accurately
describes the pack's real content); only the new sample-resolution module is
named for the Melodica instrument.

## Non-goals

- No note generation, no new WAV files, no offline pre-rendering — this
  reuses the Flute's existing *runtime* pitch-shift mechanism only.
- No changes to `scaleEngine.ts` / `noteEngine.ts`.
- No changes to `ScaleInstrument.tsx`, `AudioEngine`, `src/components/shared/padLayout.ts`,
  or `src/components/shared/calibrationStore.ts` — all already fully generic;
  Melodica is config, not new engine code.
- No changes to Bamboo Flute or Kalimba files.

## Sample resolution

`src/audio/melodicaSampleData.ts` (pure data, no requires, mirrors
`fluteSampleData.ts`): 12 `MelodicaSampleDef` entries, one per recorded pitch
class/octave, always the v100 file:

| Note | MIDI | File |
|---|---|---|
| F#1 | 30 | F#1v100.wav |
| C2 | 36 | C2v100.wav |
| F#2 | 42 | F#2v100.wav |
| C3 | 48 | C3v100.wav |
| F#3 | 54 | F#3v100.wav |
| C4 | 60 | C4v100.wav |
| F#4 | 66 | F#4v100.wav |
| C5 | 72 | C5v100.wav |
| F#5 | 78 | F#5v100.wav |
| C6 | 84 | C6v100.wav |
| F#6 | 90 | F#6v100.wav |
| C7 | 96 | C7v100.wav |

`resolveMelodicaSampleDef(targetMidi)`: nearest def by absolute MIDI distance
(octave-aware), `semitoneShift = targetMidi - def.midi`,
`playbackRate = 2^(shift/12)` — identical algorithm and formula to
`resolveFluteSampleDef`. Every scale degree will hit an exact sample only when
its target MIDI happens to be a recorded C or F#; otherwise it plays the
nearest one pitch-shifted, same as the Flute's fallback path.

`src/audio/melodicaSamples.ts` (mirrors `fluteSamples.ts`): static `require()`
map of the 12 files under
`assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/samples/`, joined with the data
module, exposing `resolveMelodicaSample: SampleResolver` (`sources` is always
length 1, like the Flute — no round-robin takes in this pack).

Gain defaults to `1.0` for all notes (no RMS analysis pass), same rationale as
the Kalimba's initial gain.

## Pad layout (7 touch zones)

The new background image (`assets/images/ChatGPT Image Jul 26, 2026, 07_47_33 PM.png`,
1536×1024, to be renamed `assets/images/melodica.png` to match the
`kalimba.png` / `bamboo-flute-final.png` convention) shows a 7-white-key
mini keyboard. Default touch-zone centers were measured directly from the
image's pixels (not eyeballed): scanning for white-key-face pixels found 7
distinct horizontal white intervals at y≈384–742 (key face vertical span),
giving 7 pad centers, left to right, all at y=563:

| Degree | sourceX | sourceY |
|---|---|---|
| 1 | 351 | 563 |
| 2 | 492 | 563 |
| 3 | 639 | 563 |
| 4 | 717 | 563 |
| 5 | 867 | 563 |
| 6 | 1015 | 563 |
| 7 | 1170 | 563 |

Pads 3 and 4 are closer together (78px apart) than the rest (~145px) — a real
piano-layout pair of adjacent white keys with no black key between them (like
E–F or B–C). `hitRadius`/`visibleRadius` default to 70/50 (same as Kalimba);
`ScaleInstrument`'s existing overlap-avoidance logic (`getEffectiveHitRadius`)
already shrinks hit zones automatically when pads sit close together, so this
pair is handled without any special-casing. Degree 1 (leftmost) is the root,
following the Flute/Kalimba "ascending left-to-right / top-to-bottom"
convention.

Defaults are a starting point, refined like every other instrument via
calibration mode (move/resize/save/reset) and the desktop calibration server.

## New files

- `src/audio/melodicaSampleData.ts` — pure data + resolver (mirrors `fluteSampleData.ts`).
- `src/audio/melodicaSamples.ts` — bundled `require()` map + `resolveMelodicaSample` (mirrors `fluteSamples.ts`).
- `src/components/Melodica/holeLayout.ts` — image size + default 7-key layout (mirrors Kalimba's).
- `src/components/Melodica/calibrationStore.ts` — thin wrapper over the shared factory, storage key `jamit:melodica:calibrated-holes:v1`.
- `src/components/Melodica/calibration.generated.json` — generated/default calibration, seeded with the measured defaults above.
- `src/components/Melodica/MelodicaInstrument.tsx` — thin wrapper around `ScaleInstrument`: `noteStartHoldMs={0}`, `stopOnRelease={false}` (explicitly requested: same instant-trigger, ring-past-release feel as the Kalimba, not the Flute's hold/sustain feel).
- `src/screens/MelodicaScreen.tsx` — mirrors `KalimbaScreen.tsx` (landscape lock/unlock, since the background image is landscape-oriented like the Kalimba's).
- `scripts/test-melodica-mapping.js` — mirrors `test-kalimba-mapping.js`.

## Modified files

- `assets/images/ChatGPT Image Jul 26, 2026, 07_47_33 PM.png` → renamed to `assets/images/melodica.png`.
- `src/screens/InstrumentSelectionScreen.tsx` — add `"melodica"` to the `Instrument` union and the instrument list.
- `App.tsx` — add `melodica` to `INSTRUMENT_LABEL`; extend the final render from a flute/kalimba ternary to a 3-way switch that also renders `MelodicaScreen`.
- `scripts/desktop-calibration-server.js` — add a `melodica` entry to `INSTRUMENTS`, accept `INSTRUMENT=melodica`.
- `tsconfig.test.json` — add `melodicaSampleData.ts` to `include`.
- `package.json` — add `test:mapping:melodica` (wired into `test`) and `calibrate:desktop:melodica`.

No changes to `ScaleInstrument.tsx`, `AudioEngine`, `padLayout.ts`, the shared
`calibrationStore.ts` factory, or any Bamboo Flute / Kalimba file.

## Testing

- `scripts/test-melodica-mapping.js`: for all 24 scales (12 roots × major/minor)
  × 7 degrees, resolves each hole via `resolveMelodicaSampleDef` and asserts:
  sounding pitch (def MIDI + shift) equals the target MIDI, `playbackRate`
  matches `2^(shift/12)`, 7 distinct sounding pitches per scale. Also
  pitch-verifies each of the 12 WAV files against its catalog MIDI (reusing
  `scripts/lib/wav-pitch.js`), with a tolerance appropriate to a synthesized
  (not acoustic) instrument — proposed ±10 cents, tighter than the Kalimba's
  ±60 since this is a clean synth recording, not a real detuned instrument.
  Unlike the Kalimba test, `shift === 0` / `rate === 1.0` is NOT asserted for
  every scale (most scales legitimately fall back to a shifted C or F#), same
  caveat as the Kalimba's own test.
- `npm run typecheck` must pass.
- Manual verification in the running app: instant tap-to-play (no hold delay),
  note keeps ringing past finger-release, slide between keys, multi-touch,
  calibration mode (move/resize/save/reset, invisible zones in normal play),
  for all three instruments (regression-check Flute and Kalimba are
  unaffected).

## Separate, already-resolved item: Kalimba touch behavior

Not part of this spec's scope, but noted for completeness since it was
verified in the same session: the previously-requested Kalimba fix ("no long
touch, no waiting for finger removal") was already fully implemented in the
working tree (`noteStartHoldMs={0}`, `stopOnRelease={false}` +
`AudioEngine.release()`), and `npm test` (typecheck + all mapping tests)
passes. It only needs to be committed.
