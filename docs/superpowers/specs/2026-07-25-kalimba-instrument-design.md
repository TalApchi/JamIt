# Kalimba: second playable instrument

Date: 2026-07-25
Status: approved for planning

## Goal

Add the Kalimba as a second playable instrument, using the same scale engine,
touch engine (hold-to-play / slide / multi-touch), scale selection screen, and
overall navigation pattern as the Bamboo Flute. Only the instrument UI image
and the audio samples differ. The Bamboo Flute's behavior must not change.

## Non-goals

- No note generation, no runtime or offline pitch-shifting *beyond* the same
  nearest-sample fallback mechanism the Flute already uses for out-of-range
  targets (see "Sample resolution" below) — this is a reuse of an existing,
  already-approved mechanism, not new pitch-shifting.
- No changes to `scaleEngine.ts` / `noteEngine.ts` (root/mode/scale-degree
  logic is instrument-agnostic already and needs no changes).
- EAS Build / EAS Update / dev-client / TestFlight preparation is explicitly
  out of scope for this spec. The user has requested it as a follow-on piece
  of work to start *after* the Kalimba ships; it will get its own spec.

## Background: why pitch-shift fallback is needed

The Kalimba sample pack (`assets/audio/kalimba/Kalimba-SFZ-20190723/`) is a
real-instrument recording with only 8 physical tines, not a full chromatic
kit like the Flute's. Its SFZ file maps each tine across a range of MIDI keys
(the standard sampler technique: one recording covers several semitones via
pitch-shifting), which is what makes "all notes" playable at all. The 8 tines,
by nominal MIDI note (ignoring each tine's small natural detuning, given as
`tune` cents in the SFZ):

| Tine | Nominal note | MIDI | SFZ `tune` (cents) | Round-robin takes |
|---|---|---|---|---|
| 1 | F3 | 53 | 0 | F3_01, F3_03, F3_04, F3_05 |
| 2 | C4 | 60 | +25 | 1_01..1_05 (5 takes) |
| 3 | Eb4 | 63 | +5 | 2_01..2_05 (5 takes) |
| 4 | E4 | 64 | -40 | 3_01..3_07 (7 takes) |
| 5 | G4 | 67 | +7 | 4_01..4_07 (7 takes) |
| 6 | Ab4 | 68 | +17 | 5_01..5_07 (7 takes) |
| 7 | C5 | 72 | +22 | 6_01..6_05 (5 takes) |
| 8 | Db5 | 73 | -15 | 7_01..7_05 (5 takes) |

Only 7 unique pitch classes exist (C, Db, Eb, E, F, G, Ab), so most requested
scales (e.g. G Major needs A, B, D) cannot be produced from exact samples
alone. Per the user's direction, the Kalimba reuses the Flute's existing
nearest-sample resolver algorithm as-is:

- If a scale note's target MIDI exactly matches a tine's nominal MIDI, play
  that tine's sample(s) at `playbackRate = 1.0` (no shift).
- Otherwise, play the nearest tine (by absolute MIDI distance) at
  `playbackRate = 2^(shift/12)`, exactly like `resolveFluteSampleDef`.

The natural per-tine detuning (`tune` cents in the SFZ) is *not* applied —
samples play at their raw recorded pitch, which is part of the instrument's
authentic character. `tune` cents were only used above to identify each
tine's nearest nominal semitone.

## Architecture

Extract a shared, instrument-agnostic engine so the Flute and Kalimba share
one touch system and one audio engine, instead of two parallel copies:

1. **`AudioEngine`** (`src/audio/audioEngine.ts`) generalizes from a
   hardcoded `resolveFluteSample` import to an injected resolver:
   `(midi: number) => ResolvedSample`. It also gains round-robin support:
   a `ResolvedSample` carries the full list of round-robin asset sources for
   the chosen tine (length 1 for every Flute note, length 1-7 for Kalimba
   tines). `AudioEngine` preloads one `AudioPlayer` per take up front (no
   note-on load latency) and cycles to the next take on each true note-on
   (the existing 0→1 `activeTouchCount` transition — multi-touch on an
   already-sounding pad still doesn't retrigger, unchanged from today).
   Flute is unaffected: with exactly one take per note, "cycling" always
   picks the same single player, so its behavior and existing tests
   (`shift === 0`, `rate === 1` for every scale/hole) are unchanged.

2. **Shared touch/gesture/calibration component**
   (`src/components/shared/ScaleInstrument.tsx`, new) is extracted from the
   current `BambooFluteInstrument.tsx` body: hold-to-play timing, slide
   detection, multi-touch bookkeeping, calibration-mode drag/resize, save
   /reset. It takes instrument config as props (image source, native image
   size, default pad layout, calibration storage keys, sample resolver,
   instrument label for logs). `BambooFluteInstrument.tsx` and the new
   `KalimbaInstrument.tsx` shrink to thin wrappers supplying their config.

3. **Shared geometry helpers** (`getCoverFrame`, `sourcePointToContainer`,
   `containerPointToSource`) move from `BambooFlute/holeLayout.ts` to
   `src/components/shared/padLayout.ts`. Each instrument keeps its own
   default pad-position constants and image size in its own small
   `holeLayout.ts` (kept for the Flute unchanged; new for the Kalimba),
   re-exporting the shared geometry functions plus its own defaults.

4. **Shared calibration storage logic**
   (`src/components/shared/calibrationStore.ts`) generalizes
   `BambooFlute/calibrationStore.ts` into a factory
   `createCalibrationStore({ storageKey, legacyStorageKey, generatedCalibration, cloneDefaultHoles, padCount })`
   used by both instruments, so save/load/reset behavior (including the
   "generated calibration wins if newer than stored" rule) is identical and
   defined once.

## New files

- `src/components/shared/ScaleInstrument.tsx` — shared touch engine + render.
- `src/components/shared/padLayout.ts` — shared geometry helpers.
- `src/components/shared/calibrationStore.ts` — shared calibration store factory.
- `src/components/Kalimba/KalimbaInstrument.tsx` — thin wrapper (image, layout, resolver).
- `src/components/Kalimba/holeLayout.ts` — Kalimba image size + default 7-tine layout.
- `src/components/Kalimba/calibrationStore.ts` — Kalimba's calibration store instance (own storage key).
- `src/components/Kalimba/calibration.generated.json` — Kalimba's generated/default calibration.
- `src/audio/kalimbaSampleData.ts` — pure tine data + resolver (mirrors `fluteSampleData.ts`).
- `src/audio/kalimbaSamples.ts` — bundled `require()` map + `resolveKalimbaSample` (mirrors `fluteSamples.ts`).
- `src/screens/KalimbaScreen.tsx` — mirrors `BambooFluteScreen.tsx`.
- `src/screens/InstrumentSelectionScreen.tsx` — new first navigation step.

## Modified files

- `src/audio/audioEngine.ts` — inject sample resolver; round-robin take cycling.
- `src/components/BambooFlute/holeLayout.ts` — re-export shared geometry, keep Flute-only defaults.
- `src/components/BambooFlute/calibrationStore.ts` — build on the shared factory (same storage key/behavior, no user-visible change).
- `src/components/BambooFlute/BambooFluteInstrument.tsx` — shrink to a thin wrapper around `ScaleInstrument`.
- `App.tsx` — add an `instrument` phase before scale selection; render `KalimbaScreen` or `BambooFluteScreen` based on the pick.
- `scripts/desktop-calibration-server.js` — accept a target instrument (env var or CLI arg) instead of hardcoding the Flute image/calibration path.
- `package.json` — add `calibrate:desktop:kalimba` script; extend `test:mapping` (or add `test:mapping:kalimba`) to cover the Kalimba resolver.

The Flute's own behavior (audio output, touch feel, calibration data, files
under `flute_sound_kit/`) must not change. The refactor extracts and reuses
its logic; it does not rewrite its behavior.

## Pad layout (7 touch zones)

The supplied `kalimba.png` (1857×847) already shows exactly 7 tines in a
fan/graduated layout — a 1:1 match for "7 touch pads," no extra or missing
pad. Default touch-zone centers are estimated from the tine tips (visually,
left-to-right, roughly evenly spaced, y increasing toward the center tine and
decreasing toward the edges, matching the fan shape) and will be refined
using the same calibration mode / desktop calibration server the Flute uses.

**Assumption to confirm:** pads are numbered 1→7 left-to-right, mapping to
scale degree 1 (root) → degree 7, the same "ascending through the pads"
convention the Flute uses top (root) → bottom (7th). This can be changed
trivially by reordering the default layout array if a different physical
tine should carry the root.

## Sample gain

The Flute's `gain` field normalizes each file's sustained RMS, computed
per-file. For the initial Kalimba implementation, gain defaults to `1.0` for
all tines/takes (no RMS analysis pass) since it's a real, already-mixed
instrument recording — this can be tuned later by ear without any structural
changes.

## Navigation

`App.tsx` gains an instrument-selection phase before the existing
Welcome+ScaleSelection screen:

`Instrument Selection → Scale Selection (existing, parameterized by instrument) → Play (Flute or Kalimba screen) `

Back navigation from the play screen returns to Scale Selection as today;
changing instrument requires going back further to Instrument Selection.

## Testing

- `scripts/test-scale-engine.js` — unaffected (scale engine untouched).
- `scripts/test-audio-mapping.js` — Flute assertions unchanged (shift always
  0, rate always 1.0 for every scale/hole).
- New Kalimba mapping test (mirrors the Flute one) asserts: every scale/hole
  resolves to a valid tine, sounding pitch always equals the target (by
  construction), 7 distinct sounding pitches per scale, gain in (0,1], and
  pitch-detection of each raw tine file is within a wider tolerance of its
  catalog MIDI (real-instrument detuning reaches ~40 cents on one tine, so
  tolerance is looser than the Flute's ±30 cents — proposed ±60 cents).
  Unlike the Flute test, this does NOT assert `shift === 0` / `rate === 1.0`
  for every scale, since most scales legitimately fall back to the nearest
  tine.
- `npm run typecheck` must pass.
- Manual verification in the running app (per this project's `verify`
  skill): hold-to-play, slide between pads, multi-touch, calibration mode
  visibility toggle, round-robin cycling audible across repeated plucks of
  the same pad, for both instruments.
