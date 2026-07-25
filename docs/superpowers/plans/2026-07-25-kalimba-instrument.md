# Kalimba Second Instrument Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Kalimba as a second playable instrument on a shared, instrument-agnostic touch/audio engine, without changing the Bamboo Flute's behavior.

**Architecture:** Extract `AudioEngine` (resolver-injected, round-robin-aware), a shared `ScaleInstrument` touch/gesture/calibration component, shared pad-geometry helpers, and a shared calibration-store factory. Both instruments become thin config wrappers around these. Kalimba's 8-tine sample pack resolves exactly at rate 1.0 on a MIDI match, else falls back to the Flute's existing nearest-sample `playbackRate = 2^(shift/12)` algorithm.

**Tech Stack:** Expo / React Native, TypeScript, expo-audio, expo-haptics, AsyncStorage. Plain Node.js test scripts (no Jest) compiling pure `src/music` + `src/audio` data modules via `tsconfig.test.json`.

**Reference spec:** `docs/superpowers/specs/2026-07-25-kalimba-instrument-design.md`

---

## Task 1: Extract shared WAV pitch-detection helpers (DRY prep, no behavior change)

**Files:**
- Create: `scripts/lib/wav-pitch.js`
- Modify: `scripts/test-audio-mapping.js`

The existing `parseWav`/`detectPitch` functions in `scripts/test-audio-mapping.js` only support 16-bit PCM. The Kalimba WAV files are 24-bit PCM (verified: `Kalimba-SFZ-20190723/samples/*.wav` are 1-channel, 48000 Hz, 24-bit), so the shared helper must support 16/24/32-bit before Task 3 can use it.

- [ ] **Step 1: Create the shared helper module**

```js
// scripts/lib/wav-pitch.js
// Shared WAV parsing + pitch detection for audio-mapping test scripts.
// Supports 16/24/32-bit PCM, mono or multi-channel (downmixed to mono).

function parseWav(buffer) {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Not a RIFF/WAVE file");
  }
  let offset = 12;
  let fmt = null;
  let dataOffset = -1;
  let dataSize = 0;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    if (chunkId === "fmt ") {
      fmt = {
        numChannels: buffer.readUInt16LE(offset + 10),
        sampleRate: buffer.readUInt32LE(offset + 12),
        bitsPerSample: buffer.readUInt16LE(offset + 22)
      };
    } else if (chunkId === "data") {
      dataOffset = offset + 8;
      dataSize = chunkSize;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  if (!fmt || dataOffset < 0) throw new Error("Missing fmt or data chunk");
  if (![16, 24, 32].includes(fmt.bitsPerSample)) {
    throw new Error(`Unsupported bit depth: ${fmt.bitsPerSample}`);
  }

  const bytesPerSample = fmt.bitsPerSample / 8;
  const frameCount = Math.floor(dataSize / (bytesPerSample * fmt.numChannels));
  const mono = new Float32Array(frameCount);
  const maxValue = Math.pow(2, fmt.bitsPerSample - 1);

  function readSample(byteOffset) {
    if (fmt.bitsPerSample === 16) return buffer.readInt16LE(byteOffset);
    if (fmt.bitsPerSample === 32) return buffer.readInt32LE(byteOffset);
    // 24-bit: no native readInt24LE, assemble from 3 bytes little-endian.
    const b0 = buffer[byteOffset];
    const b1 = buffer[byteOffset + 1];
    const b2 = buffer[byteOffset + 2];
    let value = b0 | (b1 << 8) | (b2 << 16);
    if (value & 0x800000) value -= 0x1000000;
    return value;
  }

  for (let i = 0; i < frameCount; i++) {
    let acc = 0;
    for (let ch = 0; ch < fmt.numChannels; ch++) {
      acc += readSample(dataOffset + (i * fmt.numChannels + ch) * bytesPerSample) / maxValue;
    }
    mono[i] = acc / fmt.numChannels;
  }
  return { sampleRate: fmt.sampleRate, samples: mono };
}

function detectPitch(samples, sampleRate) {
  const win = Math.min(8192, Math.floor(samples.length / 2));
  let bestStart = 0;
  let bestEnergy = 0;
  const hop = Math.max(1, Math.floor(samples.length / 40));
  for (let start = 0; start + win <= samples.length; start += hop) {
    let sum = 0;
    for (let i = start; i < start + win; i += 8) sum += samples[i] * samples[i];
    if (sum > bestEnergy) {
      bestEnergy = sum;
      bestStart = start;
    }
  }
  const seg = samples.subarray(bestStart, bestStart + win);

  const minLag = Math.floor(sampleRate / 2500);
  const maxLag = Math.min(Math.floor(sampleRate / 50), win - 1);
  const nsdf = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let acf = 0;
    let norm = 0;
    for (let i = 0; i + lag < win; i++) {
      acf += seg[i] * seg[i + lag];
      norm += seg[i] * seg[i] + seg[i + lag] * seg[i + lag];
    }
    nsdf[lag] = norm > 0 ? (2 * acf) / norm : 0;
  }

  let maxVal = 0;
  for (let lag = minLag; lag <= maxLag; lag++) maxVal = Math.max(maxVal, nsdf[lag]);
  const threshold = 0.9 * maxVal;
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (nsdf[lag] > nsdf[lag - 1] && nsdf[lag] >= nsdf[lag + 1] && nsdf[lag] >= threshold) {
      const y1 = nsdf[lag - 1];
      const y2 = nsdf[lag];
      const y3 = nsdf[lag + 1];
      const denom = y1 - 2 * y2 + y3;
      const shift = denom !== 0 ? (0.5 * (y1 - y3)) / denom : 0;
      return sampleRate / (lag + shift);
    }
  }
  return null;
}

module.exports = { parseWav, detectPitch };
```

- [ ] **Step 2: Point `test-audio-mapping.js` at the shared helper**

In `scripts/test-audio-mapping.js`, delete the inline `parseWav` and `detectPitch` function definitions (lines 75-155 in the current file) and replace with an import. Add near the top (after the existing `require`s):

```js
const { parseWav, detectPitch } = require("./lib/wav-pitch");
```

Leave everything else in the file (the loop over `FLUTE_SAMPLE_DEFS` calling `parseWav`/`detectPitch`) unchanged — it already calls these by the same names, so no other edits are needed.

- [ ] **Step 3: Verify the refactor is behavior-preserving**

Run: `npm run test:mapping`
Expected: `Audio mapping tests passed: 24 scales x 7 holes all resolve to EXACT samples (shift 0, rate 1.0), distinct + in-scale pitches, all scale sound-sets pairwise different, 24 samples pitch-verified against the WAV audio.` — identical to the pre-refactor output (16-bit flute files produce the same downmixed values through the generalized reader).

- [ ] **Step 4: Commit**

```bash
git add scripts/lib/wav-pitch.js scripts/test-audio-mapping.js
git commit -m "test: extract shared WAV pitch-detection helper (16/24/32-bit)"
```

---

## Task 2: Generalize the resolved-sample type and update `fluteSamples.ts`

**Files:**
- Create: `src/audio/sampleTypes.ts`
- Modify: `src/audio/fluteSamples.ts`

`AudioEngine` currently hardcodes a Flute-only resolved-sample shape with a single `source`/`sourceFilename`. Generalize it to carry a round-robin array of sources so both instruments (and later, `AudioEngine` in Task 5) share one type. Flute continues to resolve to exactly one source (an array of length 1) — no behavior change.

- [ ] **Step 1: Create `src/audio/sampleTypes.ts`**

```ts
// Instrument-agnostic resolved-sample shape shared by AudioEngine and every
// instrument's sample-resolution module (fluteSamples.ts, kalimbaSamples.ts).
export type ResolvedSample = {
  targetMidi: number;
  // Round-robin take sources for the resolved note. Length 1 for the Flute
  // (single take per note); length >= 1 for the Kalimba (multiple takes per
  // tine). AudioEngine preloads one player per source and cycles through
  // them on each note-on.
  sources: number[];
  sourceFilenames: string[];
  // Convenience aliases for the first/primary take, used by debug logging
  // that previews the mapping before any note has actually sounded.
  source: number;
  sourceFilename: string;
  sourceNoteWithOctave: string;
  sourceMidi: number;
  semitoneShift: number;
  playbackRate: number;
  volume: number;
};

export type SampleResolver = (targetMidi: number) => ResolvedSample;
```

- [ ] **Step 2: Update `src/audio/fluteSamples.ts` to return the new shape**

Replace the file's `ResolvedFluteSample` type and `resolveFluteSample` function (the parts after the `SAMPLE_SOURCES` map and its validation loop stay unchanged):

```ts
import { FLUTE_SAMPLE_DEFS, resolveFluteSampleDef } from "./fluteSampleData";
import { ResolvedSample } from "./sampleTypes";

export { getPlaybackRate } from "./fluteSampleData";

// ... SAMPLE_SOURCES map and FLUTE_SAMPLE_DEFS.forEach validation: unchanged ...

export function resolveFluteSample(targetMidi: number): ResolvedSample {
  const { def, semitoneShift, playbackRate } = resolveFluteSampleDef(targetMidi);
  const source = SAMPLE_SOURCES[def.filename];

  return {
    targetMidi,
    sources: [source],
    sourceFilenames: [def.filename],
    source,
    sourceFilename: def.filename,
    sourceNoteWithOctave: def.noteWithOctave,
    sourceMidi: def.midi,
    semitoneShift,
    playbackRate,
    volume: def.gain
  };
}
```

(Delete the old `export type ResolvedFluteSample = {...}` block entirely — it's replaced by the imported `ResolvedSample`.)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: fails right now with errors in `src/audio/audioEngine.ts` (it still imports the now-deleted `ResolvedFluteSample` from `./fluteSamples`) — that's expected, Task 5 fixes it. Confirm the *only* errors are in `audioEngine.ts` referencing `ResolvedFluteSample`, nothing in `fluteSamples.ts` or `fluteSampleData.ts` itself.

- [ ] **Step 4: Commit**

```bash
git add src/audio/sampleTypes.ts src/audio/fluteSamples.ts
git commit -m "refactor: generalize ResolvedSample to carry round-robin sources"
```

(`audioEngine.ts` is intentionally left broken between here and Task 5 within this same work session — do not skip ahead; Task 5 fixes it immediately after Tasks 3-4 land the Kalimba data it also depends on being nearby in context.)

---

## Task 3: Kalimba sample data + resolver (pure, TDD)

**Files:**
- Create: `src/audio/kalimbaSampleData.ts`
- Create: `scripts/test-kalimba-mapping.js`
- Modify: `tsconfig.test.json`
- Modify: `package.json`

This is the pure data/logic module (no `require()` of assets, per the same reason `fluteSampleData.ts` is kept asset-free: "so node test scripts can exercise it"). Tine data derived from `assets/audio/kalimba/Kalimba-SFZ-20190723/Kalimba-20190723.sfz`.

- [ ] **Step 1: Write the failing test first**

```js
// scripts/test-kalimba-mapping.js
// Audio mapping tests for the Kalimba tine catalog against the REAL
// compiled sources and the real WAV files on disk:
//  1. Every hole of every scale resolves to a tine with a correct
//     semitone shift and playback rate (2^(shift/12)); sounding pitch
//     (tine midi + shift) always equals the target midi.
//  2. All 7 holes of every scale produce 7 distinct sounding pitches.
//  3. Every tine's round-robin sample files exist on disk and are
//     pitch-verified against the catalog's nominal MIDI (real-instrument
//     natural detuning tolerated up to +-60 cents).
// Unlike the Flute, shift === 0 / rate === 1.0 is NOT asserted for every
// scale: the Kalimba's 8 tines cover only 7 pitch classes, so most scales
// legitimately fall back to the nearest tine.
const fs = require("fs");
const path = require("path");
const { compileForTests } = require("./lib/compile-for-tests");
const { parseWav, detectPitch } = require("./lib/wav-pitch");

const projectRoot = path.resolve(__dirname, "..");
const samplesDir = path.join(
  projectRoot, "assets", "audio", "kalimba", "Kalimba-SFZ-20190723", "samples"
);
const buildDir = compileForTests();
const { CHROMATIC_NOTES } = require(path.join(buildDir, "music", "scaleEngine"));
const { generatePitchedScale } = require(path.join(buildDir, "music", "noteEngine"));
const { KALIMBA_TINE_DEFS, resolveKalimbaTineDef, getKalimbaPlaybackRate } = require(
  path.join(buildDir, "audio", "kalimbaSampleData")
);

let failures = 0;
function check(label, condition) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL ${label}`);
  }
}

// --- 1 + 2: resolution invariants for every scale and hole -----------------
const soundingSetByScale = new Map();

for (const root of CHROMATIC_NOTES) {
  for (const mode of ["major", "minor"]) {
    const scale = generatePitchedScale(root, mode);
    const scaleMidiSet = new Set(scale.map((d) => d.midi));
    const soundingPitches = new Set();

    scale.forEach((degree, index) => {
      const resolved = resolveKalimbaTineDef(degree.midi);
      const label = `${root} ${mode} hole ${index + 1} (${degree.noteWithOctave})`;

      const sounding = resolved.def.midi + resolved.semitoneShift;
      check(`${label}: sounding pitch equals target`, sounding === degree.midi);
      check(`${label}: sounding pitch belongs to the scale`, scaleMidiSet.has(sounding));
      check(
        `${label}: playbackRate matches shift`,
        Math.abs(resolved.playbackRate - Math.pow(2, resolved.semitoneShift / 12)) < 1e-9
      );
      soundingPitches.add(sounding);
    });

    check(`${root} ${mode}: 7 holes -> 7 distinct sounding pitches`, soundingPitches.size === 7);
    soundingSetByScale.set(`${root} ${mode}`, [...soundingPitches].sort((a, b) => a - b).join(","));
  }
}

check("getKalimbaPlaybackRate(12) doubles", Math.abs(getKalimbaPlaybackRate(12) - 2) < 1e-9);
check("getKalimbaPlaybackRate(-12) halves", Math.abs(getKalimbaPlaybackRate(-12) - 0.5) < 1e-9);

// --- 3: catalog vs the actual audio content --------------------------------
check("Kalimba has exactly 8 tines", KALIMBA_TINE_DEFS.length === 8);

for (const def of KALIMBA_TINE_DEFS) {
  check(`${def.noteWithOctave}: gain in (0, 1]`, def.gain > 0 && def.gain <= 1);
  check(`${def.noteWithOctave}: has at least one round-robin take`, def.filenames.length >= 1);

  for (const filename of def.filenames) {
    const filePath = path.join(samplesDir, filename);
    check(`${filename} exists on disk`, fs.existsSync(filePath));
    if (!fs.existsSync(filePath)) continue;

    const { sampleRate, samples } = parseWav(fs.readFileSync(filePath));
    const freq = detectPitch(samples, sampleRate);
    check(`${filename}: pitch detectable`, freq !== null);
    if (freq === null) continue;

    const detectedMidi = 69 + 12 * Math.log2(freq / 440);
    const centsOff = (detectedMidi - def.midi) * 100;
    check(
      `${filename}: catalog says MIDI ${def.midi} (${def.noteWithOctave}), audio measures ${detectedMidi.toFixed(2)} (${centsOff.toFixed(0)} cents off; tolerance 60)`,
      Math.abs(centsOff) <= 60
    );
  }
}

if (failures > 0) {
  console.error(`Kalimba mapping tests FAILED (${failures} failure(s)).`);
  process.exit(1);
}
console.log(
  `Kalimba mapping tests passed: 24 scales x 7 holes all resolve to in-scale, distinct sounding pitches; ${KALIMBA_TINE_DEFS.length} tines pitch-verified against their WAV audio.`
);
```

- [ ] **Step 2: Wire the not-yet-existing module into the test build, then run to confirm it fails**

In `tsconfig.test.json`, add the new file to `include`:

```json
{
  "compilerOptions": {
    "target": "ES2019",
    "module": "commonjs",
    "outDir": ".test-build",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": []
  },
  "include": ["src/music/**/*.ts", "src/audio/fluteSampleData.ts", "src/audio/kalimbaSampleData.ts"]
}
```

Run: `node scripts/test-kalimba-mapping.js`
Expected: FAIL — TypeScript compilation error, `src/audio/kalimbaSampleData.ts` does not exist (`error TS6053` or similar "File not found").

- [ ] **Step 3: Implement `src/audio/kalimbaSampleData.ts`**

Tine data transcribed from the SFZ's `pitch_keycenter` values (converted to nominal note names using sharps, matching `CHROMATIC_NOTES`) and each group's `seq_position` sample list:

```ts
// Pure data + resolution logic for the Kalimba sample kit.
// Kept free of require()/expo imports so node test scripts can exercise it.
//
// The kit is a REAL 8-tine instrument recording (not a full chromatic kit
// like the Flute's): assets/audio/kalimba/Kalimba-SFZ-20190723. Its SFZ file
// maps each tine across a range of MIDI keys with the standard sampler
// technique (one recording covers several semitones via pitch-shifting),
// which is what makes "every note" playable at all from just 8 tines.
//
// Every tine has several round-robin takes (multiple recordings of the same
// pluck for natural variation); AudioEngine preloads and cycles through them.
//
// `midi` is each tine's nominal MIDI note (nearest semitone to its SFZ
// pitch_keycenter). The SFZ's `tune` cents offset (natural per-tine
// detuning, up to -40/+25 cents) is intentionally NOT applied here: samples
// play at their raw recorded pitch on an exact match, which is the
// instrument's authentic character, not a correction to make.
export type KalimbaTineDef = {
  filenames: string[];
  noteWithOctave: string;
  midi: number;
  gain: number;
};

export const KALIMBA_TINE_DEFS: KalimbaTineDef[] = [
  { filenames: ["F3_01.wav", "F3_03.wav", "F3_04.wav", "F3_05.wav"], noteWithOctave: "F3", midi: 53, gain: 1.0 },
  { filenames: ["1_01.wav", "1_02.wav", "1_03.wav", "1_04.wav", "1_05.wav"], noteWithOctave: "C4", midi: 60, gain: 1.0 },
  { filenames: ["2_01.wav", "2_02.wav", "2_03.wav", "2_04.wav", "2_05.wav"], noteWithOctave: "D#4", midi: 63, gain: 1.0 },
  { filenames: ["3_01.wav", "3_02.wav", "3_03.wav", "3_04.wav", "3_05.wav", "3_06.wav", "3_07.wav"], noteWithOctave: "E4", midi: 64, gain: 1.0 },
  { filenames: ["4_01.wav", "4_02.wav", "4_03.wav", "4_04.wav", "4_05.wav", "4_06.wav", "4_07.wav"], noteWithOctave: "G4", midi: 67, gain: 1.0 },
  { filenames: ["5_01.wav", "5_02.wav", "5_03.wav", "5_04.wav", "5_05.wav", "5_06.wav", "5_07.wav"], noteWithOctave: "G#4", midi: 68, gain: 1.0 },
  { filenames: ["6_01.wav", "6_02.wav", "6_03.wav", "6_04.wav", "6_05.wav"], noteWithOctave: "C5", midi: 72, gain: 1.0 },
  { filenames: ["7_01.wav", "7_02.wav", "7_03.wav", "7_04.wav", "7_05.wav"], noteWithOctave: "C#5", midi: 73, gain: 1.0 }
];

export type ResolvedKalimbaTineDef = {
  targetMidi: number;
  def: KalimbaTineDef;
  semitoneShift: number;
  playbackRate: number;
};

export function getKalimbaPlaybackRate(semitoneShift: number) {
  return Math.pow(2, semitoneShift / 12);
}

// Nearest tine by full MIDI distance (octave-aware, never by pitch class).
// Exact matches (semitoneShift === 0) play at rate 1.0; everything else
// falls back to the nearest tine, exactly like resolveFluteSampleDef.
export function resolveKalimbaTineDef(targetMidi: number): ResolvedKalimbaTineDef {
  const def = KALIMBA_TINE_DEFS.reduce((best, tine) => {
    const bestDistance = Math.abs(targetMidi - best.midi);
    const tineDistance = Math.abs(targetMidi - tine.midi);
    return tineDistance < bestDistance ? tine : best;
  });
  const semitoneShift = targetMidi - def.midi;

  return {
    targetMidi,
    def,
    semitoneShift,
    playbackRate: getKalimbaPlaybackRate(semitoneShift)
  };
}
```

- [ ] **Step 4: Run the test again to verify it passes**

Run: `node scripts/test-kalimba-mapping.js`
Expected: `Kalimba mapping tests passed: 24 scales x 7 holes all resolve to in-scale, distinct sounding pitches; 8 tines pitch-verified against their WAV audio.`

If any tine's pitch-detection check fails (a take more than 60 cents off its catalog `midi`), re-read the reported `centsOff` and correct that tine's `midi` in `KALIMBA_TINE_DEFS` to the nearest semitone actually measured, then rerun.

- [ ] **Step 5: Wire into `npm test`**

In `package.json`, add a new script and include it in the `test` chain:

```json
"scripts": {
  "start": "expo start",
  "android": "expo start --android",
  "ios": "expo start --ios",
  "web": "expo start --web",
  "calibrate:desktop": "node scripts/desktop-calibration-server.js",
  "calibrate:desktop:kalimba": "cross-env INSTRUMENT=kalimba node scripts/desktop-calibration-server.js",
  "typecheck": "tsc --noEmit",
  "test:music": "node scripts/test-scale-engine.js",
  "test:mapping": "node scripts/test-audio-mapping.js",
  "test:mapping:kalimba": "node scripts/test-kalimba-mapping.js",
  "test": "npm run typecheck && npm run test:music && npm run test:mapping && npm run test:mapping:kalimba"
}
```

`cross-env` is not currently a dependency; Task 14 adds it (needed for `calibrate:desktop:kalimba` to set `INSTRUMENT` portably on Windows/PowerShell, which this project's shell is). For now this step only wires the mapping test into `npm test`; leave `calibrate:desktop:kalimba` as-is (added here so `package.json` is only edited once for scripts — Task 14 installs the dependency it needs).

Run: `npm run test:mapping:kalimba`
Expected: same pass output as Step 4.

Run: `npm run typecheck`
Expected: still fails only in `audioEngine.ts` (unchanged from Task 2, Task 5 fixes it next).

- [ ] **Step 6: Commit**

```bash
git add src/audio/kalimbaSampleData.ts scripts/test-kalimba-mapping.js tsconfig.test.json package.json
git commit -m "feat: add Kalimba tine catalog and resolver with mapping tests"
```

---

## Task 4: Kalimba bundled samples module

**Files:**
- Create: `src/audio/kalimbaSamples.ts`

Mirrors `fluteSamples.ts`: a static `require()` map (Metro needs static requires) joined with `KALIMBA_TINE_DEFS` by filename, exposing a `SampleResolver`.

- [ ] **Step 1: Implement `src/audio/kalimbaSamples.ts`**

```ts
import { KALIMBA_TINE_DEFS, resolveKalimbaTineDef } from "./kalimbaSampleData";
import { ResolvedSample } from "./sampleTypes";

export { getKalimbaPlaybackRate } from "./kalimbaSampleData";

// Metro needs static require() calls (plain string literals, not template
// literals or variables), so the asset table is spelled out here in full and
// joined with the pure sample metadata (kalimbaSampleData.ts) by filename —
// the exact same pattern fluteSamples.ts uses.
const SAMPLE_SOURCES: Record<string, number> = {
  "F3_01.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/F3_01.wav"),
  "F3_03.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/F3_03.wav"),
  "F3_04.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/F3_04.wav"),
  "F3_05.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/F3_05.wav"),
  "1_01.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/1_01.wav"),
  "1_02.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/1_02.wav"),
  "1_03.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/1_03.wav"),
  "1_04.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/1_04.wav"),
  "1_05.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/1_05.wav"),
  "2_01.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/2_01.wav"),
  "2_02.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/2_02.wav"),
  "2_03.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/2_03.wav"),
  "2_04.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/2_04.wav"),
  "2_05.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/2_05.wav"),
  "3_01.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/3_01.wav"),
  "3_02.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/3_02.wav"),
  "3_03.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/3_03.wav"),
  "3_04.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/3_04.wav"),
  "3_05.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/3_05.wav"),
  "3_06.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/3_06.wav"),
  "3_07.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/3_07.wav"),
  "4_01.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/4_01.wav"),
  "4_02.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/4_02.wav"),
  "4_03.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/4_03.wav"),
  "4_04.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/4_04.wav"),
  "4_05.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/4_05.wav"),
  "4_06.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/4_06.wav"),
  "4_07.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/4_07.wav"),
  "5_01.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/5_01.wav"),
  "5_02.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/5_02.wav"),
  "5_03.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/5_03.wav"),
  "5_04.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/5_04.wav"),
  "5_05.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/5_05.wav"),
  "5_06.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/5_06.wav"),
  "5_07.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/5_07.wav"),
  "6_01.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/6_01.wav"),
  "6_02.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/6_02.wav"),
  "6_03.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/6_03.wav"),
  "6_04.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/6_04.wav"),
  "6_05.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/6_05.wav"),
  "7_01.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/7_01.wav"),
  "7_02.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/7_02.wav"),
  "7_03.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/7_03.wav"),
  "7_04.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/7_04.wav"),
  "7_05.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/7_05.wav")
};

KALIMBA_TINE_DEFS.forEach((def) => {
  def.filenames.forEach((filename) => {
    if (!(filename in SAMPLE_SOURCES)) {
      throw new Error(`Missing bundled audio asset for ${filename}`);
    }
  });
});

export function resolveKalimbaSample(targetMidi: number): ResolvedSample {
  const { def, semitoneShift, playbackRate } = resolveKalimbaTineDef(targetMidi);
  const sources = def.filenames.map((filename) => SAMPLE_SOURCES[filename]);

  return {
    targetMidi,
    sources,
    sourceFilenames: def.filenames,
    source: sources[0],
    sourceFilename: def.filenames[0],
    sourceNoteWithOctave: def.noteWithOctave,
    sourceMidi: def.midi,
    semitoneShift,
    playbackRate,
    volume: def.gain
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no new errors from `kalimbaSamples.ts` itself; still fails only in `audioEngine.ts` (Task 5 next).

- [ ] **Step 3: Commit**

```bash
git add src/audio/kalimbaSamples.ts
git commit -m "feat: add Kalimba bundled sample sources and resolver"
```

---

## Task 5: Generalize `AudioEngine` (resolver injection + round-robin cycling)

**Files:**
- Modify: `src/audio/audioEngine.ts`

This is the one piece of shared logic that cannot run under the plain-Node test scripts (it imports `expo-audio`, a native module) — same as today. Verification is `npm run typecheck` now, plus manual in-app regression testing of the Flute in Task 9 once it's wired back up as the consumer.

- [ ] **Step 1: Replace the full file contents**

```ts
import {
  AudioPlayer,
  createAudioPlayer,
  setAudioModeAsync
} from "expo-audio";
import { ResolvedSample, SampleResolver } from "./sampleTypes";

export type ActiveSoundId = string;

export type PlayableNote = {
  key: string;
  scaleName: string;
  padIndex: number;
  noteWithOctave: string;
  midi: number;
};

export type AudioNoteDebugInfo = ResolvedSample & PlayableNote;

type LoadedTake = {
  player: AudioPlayer;
  source: number;
  // Retry timer for re-applying rate/pitch config until this take's source
  // is loaded.
  configRetryTimer?: ReturnType<typeof setTimeout>;
};

type LoadedNote = {
  note: PlayableNote;
  sample: ResolvedSample;
  takes: LoadedTake[];
  // Index into `takes` most recently started; -1 before the first note-on.
  // Round-robin: each true note-on (the 0 -> 1 activeTouchCount transition)
  // advances to the next take, cycling back to 0 after the last.
  activeTakeIndex: number;
  // Number of touches currently holding this note. The note starts on the
  // 0 -> 1 transition and stops on the 1 -> 0 transition, so a second finger
  // on the same hole never retriggers and never cuts the first finger off.
  activeTouchCount: number;
  // Bumped on every note-on to cancel an in-flight release fade.
  generation: number;
};

const RELEASE_FADE_STEPS = 3;
const RELEASE_FADE_STEP_MS = 9;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class AudioEngine {
  private readonly notes = new Map<string, LoadedNote>();
  private readonly activeTouches = new Map<ActiveSoundId, string>();
  private isReady = false;

  constructor(private readonly resolveSample: SampleResolver) {}

  async preload() {
    if (this.isReady) return;

    await setAudioModeAsync({
      allowsRecording: false,
      interruptionMode: "doNotMix",
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false
    });

    this.isReady = true;
  }

  // Creates players for every note of the current scale up front (first press
  // must not pay the load cost) and drops players from previous scales.
  async prepareScale(notes: PlayableNote[]) {
    await this.preload();

    const wantedKeys = new Set(notes.map((note) => note.key));
    [...this.notes.entries()].forEach(([key, loaded]) => {
      if (wantedKeys.has(key)) return;
      this.disposeNote(loaded);
      this.notes.delete(key);
    });

    notes.forEach((note) => {
      if (!this.notes.has(note.key)) {
        this.loadNote(note);
      }
    });
  }

  getDebugInfo(note: PlayableNote): AudioNoteDebugInfo {
    const sample = this.resolveSample(note.midi);
    return {
      ...sample,
      ...note
    };
  }

  async play(id: ActiveSoundId, note: PlayableNote) {
    await this.preload();

    const currentKey = this.activeTouches.get(id);
    if (currentKey === note.key) return;
    if (currentKey) {
      // Bookkeeping runs synchronously; the release fade continues in the
      // background so a slide starts the new note without waiting on it.
      this.stop(id).catch(() => undefined);
    }

    const loaded = this.notes.get(note.key) ?? this.loadNote(note);
    this.activeTouches.set(id, note.key);
    loaded.activeTouchCount += 1;
    if (loaded.activeTouchCount > 1) return;

    loaded.generation += 1;
    loaded.activeTakeIndex = (loaded.activeTakeIndex + 1) % loaded.takes.length;
    const take = loaded.takes[loaded.activeTakeIndex];

    take.player.volume = loaded.sample.volume;
    this.applyPitchConfig(take, loaded.sample);
    await take.player.seekTo(0);
    take.player.play();

    // If the source is still loading (first press right after a scale
    // change), the rate/pitch config applied above may have landed on a
    // player item that does not exist yet; keep re-applying until loaded.
    if (!take.player.isLoaded) {
      this.ensurePitchConfig(loaded, take);
    }
    this.verifyAppliedConfig(loaded, take);
  }

  async stop(id: ActiveSoundId) {
    const key = this.activeTouches.get(id);
    if (!key) return;
    this.activeTouches.delete(id);

    const loaded = this.notes.get(key);
    if (!loaded) return;

    loaded.activeTouchCount = Math.max(0, loaded.activeTouchCount - 1);
    if (loaded.activeTouchCount > 0) return;

    const take = loaded.takes[loaded.activeTakeIndex];
    await this.fadeOutAndPause(loaded, take);
  }

  async stopAll() {
    const activeIds = [...this.activeTouches.keys()];
    await Promise.all(activeIds.map((id) => this.stop(id)));
  }

  async unload() {
    await this.stopAll();
    [...this.notes.values()].forEach((loaded) => this.disposeNote(loaded));
    this.notes.clear();
    this.isReady = false;
  }

  private disposeNote(loaded: LoadedNote) {
    loaded.takes.forEach((take) => {
      if (take.configRetryTimer) clearTimeout(take.configRetryTimer);
      take.player.remove();
    });
  }

  // Rate and pitch mode must hold on every platform quirk: expo-audio's
  // `replace()` after downloadFirst discards them (web rebuilds the media
  // element; iOS creates a new AVPlayerItem whose pitch algorithm defaults to
  // pitch-CORRECTING; Android defaults preservesPitch=true). If they are
  // lost, the pad plays the raw source pitch — which makes pads sharing a
  // source sound identical and breaks adjacent intervals.
  private applyPitchConfig(take: LoadedTake, sample: ResolvedSample) {
    take.player.loop = false;
    take.player.shouldCorrectPitch = false;
    take.player.setPlaybackRate(sample.playbackRate);
  }

  // Re-applies the config until the player reports its source as loaded, so
  // the settings are guaranteed to land on the final player item.
  private ensurePitchConfig(loaded: LoadedNote, take: LoadedTake, attempt = 0) {
    if (this.notes.get(loaded.note.key) !== loaded) return;

    this.applyPitchConfig(take, loaded.sample);
    if (take.player.isLoaded || attempt >= 20) return;

    if (take.configRetryTimer) clearTimeout(take.configRetryTimer);
    take.configRetryTimer = setTimeout(() => this.ensurePitchConfig(loaded, take, attempt + 1), 150);
  }

  // Debug evidence for every note-on: logs the rate/pitch mode the player is
  // ACTUALLY using shortly after the note starts, and heals any mismatch.
  private verifyAppliedConfig(loaded: LoadedNote, take: LoadedTake) {
    const generation = loaded.generation;
    setTimeout(() => {
      if (loaded.generation !== generation || this.notes.get(loaded.note.key) !== loaded) return;

      const intended = loaded.sample.playbackRate;
      const applied = take.player.playbackRate;
      const pitchCorrection = take.player.shouldCorrectPitch;
      const ok = Math.abs(applied - intended) < 0.005 && !pitchCorrection;
      console.log(
        [
          "[AudioEngine verify]",
          `pad=${loaded.note.padIndex}`,
          `target=${loaded.note.noteWithOctave}`,
          `source=${loaded.sample.sourceFilenames[loaded.activeTakeIndex]}`,
          `intendedRate=${intended.toFixed(4)}`,
          `appliedRate=${applied.toFixed(4)}`,
          `pitchCorrection=${pitchCorrection}`,
          `loaded=${take.player.isLoaded}`,
          ok ? "OK" : "MISMATCH -> re-applying"
        ].join(" ")
      );
      if (!ok) {
        this.ensurePitchConfig(loaded, take);
      }
    }, 150);
  }

  // Short volume ramp before pausing so releases do not click.
  private async fadeOutAndPause(loaded: LoadedNote, take: LoadedTake) {
    const generation = ++loaded.generation;
    const startVolume = loaded.sample.volume;

    for (let step = 1; step <= RELEASE_FADE_STEPS; step++) {
      take.player.volume = startVolume * (1 - step / RELEASE_FADE_STEPS);
      await delay(RELEASE_FADE_STEP_MS);
      if (loaded.generation !== generation) return;
    }

    take.player.pause();
    await take.player.seekTo(0);
    if (loaded.generation === generation) {
      take.player.volume = startVolume;
    }
  }

  private loadNote(note: PlayableNote) {
    const sample = this.resolveSample(note.midi);
    const takes: LoadedTake[] = sample.sources.map((source) => {
      const player = createAudioPlayer(source, {
        downloadFirst: true,
        keepAudioSessionActive: true,
        updateInterval: 100
      });
      player.volume = sample.volume;
      return { player, source };
    });

    const loaded: LoadedNote = {
      note,
      sample,
      takes,
      activeTakeIndex: -1,
      activeTouchCount: 0,
      generation: 0
    };
    this.notes.set(note.key, loaded);
    // Never loop (looping replays the breath/pluck attack = fake retrigger),
    // never pitch-correct; re-applied per take until each source finishes
    // loading because replace() resets these on some platforms.
    takes.forEach((take) => this.ensurePitchConfig(loaded, take));
    return loaded;
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: fails now only in `src/components/BambooFlute/BambooFluteInstrument.tsx` — it still does `new AudioEngine()` with no argument and reads `note.holeIndex` / `debug.sourceFilename` in ways that no longer type-check against the new `PlayableNote`/`ResolvedSample` shapes. That's expected; Task 9 replaces this file.

- [ ] **Step 3: Commit**

```bash
git add src/audio/audioEngine.ts
git commit -m "refactor: generalize AudioEngine with injected resolver and round-robin takes"
```

---

## Task 6: Extract shared pad geometry

**Files:**
- Create: `src/components/shared/padLayout.ts`
- Modify: `src/components/BambooFlute/holeLayout.ts`

- [ ] **Step 1: Create the shared geometry module**

```ts
// src/components/shared/padLayout.ts
// Instrument-agnostic touch-pad geometry: cover-fit framing of a
// full-screen background image, and conversions between image-source pixel
// coordinates and on-screen container coordinates.

export type CalibratedPad = {
  degree: number;
  sourceX: number;
  sourceY: number;
  visibleRadius: number;
  hitRadius: number;
  isRoot: boolean;
};

export type ImageSize = {
  width: number;
  height: number;
};

export type RenderedImageFrame = {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  scale: number;
};

export function getCoverFrame(
  containerWidth: number,
  containerHeight: number,
  imageSize: ImageSize
): RenderedImageFrame {
  const scale = Math.max(containerWidth / imageSize.width, containerHeight / imageSize.height);
  const width = imageSize.width * scale;
  const height = imageSize.height * scale;

  return {
    width,
    height,
    offsetX: (containerWidth - width) / 2,
    offsetY: (containerHeight - height) / 2,
    scale
  };
}

export function sourcePointToContainer(sourceX: number, sourceY: number, frame: RenderedImageFrame) {
  return {
    x: frame.offsetX + sourceX * frame.scale,
    y: frame.offsetY + sourceY * frame.scale
  };
}

export function containerPointToSource(containerX: number, containerY: number, frame: RenderedImageFrame) {
  return {
    sourceX: (containerX - frame.offsetX) / frame.scale,
    sourceY: (containerY - frame.offsetY) / frame.scale
  };
}
```

- [ ] **Step 2: Re-point `BambooFlute/holeLayout.ts` at the shared module, preserving its existing exports and call signatures exactly**

```ts
import {
  CalibratedPad,
  RenderedImageFrame,
  containerPointToSource,
  getCoverFrame as getSharedCoverFrame,
  sourcePointToContainer
} from "../shared/padLayout";

export type FluteHoleLayout = CalibratedPad;
export type CalibratedFluteHole = CalibratedPad;
export type { RenderedImageFrame };
export { containerPointToSource, sourcePointToContainer };

export const BAMBOO_FLUTE_IMAGE_SIZE = {
  width: 853,
  height: 1844
};

export const BAMBOO_FLUTE_HOLES: FluteHoleLayout[] = [
  { degree: 1, sourceX: 426, sourceY: 553, visibleRadius: 73, hitRadius: 96, isRoot: true },
  { degree: 2, sourceX: 426, sourceY: 720, visibleRadius: 51, hitRadius: 76, isRoot: false },
  { degree: 3, sourceX: 426, sourceY: 870, visibleRadius: 51, hitRadius: 76, isRoot: false },
  { degree: 4, sourceX: 426, sourceY: 1022, visibleRadius: 51, hitRadius: 76, isRoot: false },
  { degree: 5, sourceX: 426, sourceY: 1176, visibleRadius: 51, hitRadius: 76, isRoot: false },
  { degree: 6, sourceX: 426, sourceY: 1331, visibleRadius: 51, hitRadius: 76, isRoot: false },
  { degree: 7, sourceX: 426, sourceY: 1492, visibleRadius: 51, hitRadius: 76, isRoot: false }
];

// Preserves the Flute's original 2-argument call signature for its existing
// caller (BambooFluteInstrument.tsx, until Task 9 replaces it).
export function getCoverFrame(containerWidth: number, containerHeight: number): RenderedImageFrame {
  return getSharedCoverFrame(containerWidth, containerHeight, BAMBOO_FLUTE_IMAGE_SIZE);
}

export function cloneDefaultFluteHoles(): CalibratedFluteHole[] {
  return BAMBOO_FLUTE_HOLES.map((hole) => ({ ...hole }));
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: same single failure as after Task 5 (`BambooFluteInstrument.tsx`'s `AudioEngine()`/`holeIndex` mismatches) — no new errors from `holeLayout.ts` or its re-exports, since `BambooFluteInstrument.tsx` still imports the same names (`CalibratedFluteHole`, `RenderedImageFrame`, `containerPointToSource`, `getCoverFrame`, `sourcePointToContainer`) with the same signatures.

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/padLayout.ts src/components/BambooFlute/holeLayout.ts
git commit -m "refactor: extract shared pad geometry helpers"
```

---

## Task 7: Extract shared calibration-store factory

**Files:**
- Create: `src/components/shared/calibrationStore.ts`
- Modify: `src/components/BambooFlute/calibrationStore.ts`

- [ ] **Step 1: Create the shared factory**

```ts
// src/components/shared/calibrationStore.ts
// Instrument-agnostic calibration persistence: an AsyncStorage-backed store
// of pad positions, with a "generated calibration wins if newer than
// anything stored" rule shared by every instrument.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CalibratedPad } from "./padLayout";

export type CalibrationEnvelope = {
  updatedAt: number;
  holes: CalibratedPad[];
};

function isValidPad(value: unknown): value is CalibratedPad {
  const pad = value as Partial<CalibratedPad>;
  return (
    typeof pad.degree === "number" &&
    typeof pad.sourceX === "number" &&
    typeof pad.sourceY === "number" &&
    typeof pad.visibleRadius === "number" &&
    typeof pad.hitRadius === "number" &&
    typeof pad.isRoot === "boolean"
  );
}

export type CalibrationStoreConfig = {
  storageKey: string;
  legacyStorageKey?: string;
  padCount: number;
  generatedCalibration: unknown;
  cloneDefaultPads: () => CalibratedPad[];
};

export type CalibrationStore = {
  getGeneratedCalibration: () => CalibrationEnvelope;
  loadCalibration: () => Promise<CalibrationEnvelope>;
  saveCalibration: (holes: CalibratedPad[]) => Promise<CalibrationEnvelope>;
  resetCalibration: () => Promise<CalibrationEnvelope>;
};

export function createCalibrationStore(config: CalibrationStoreConfig): CalibrationStore {
  function normalizeEnvelope(value: unknown): CalibrationEnvelope | undefined {
    if (!value) return undefined;

    if (Array.isArray(value) && value.length === config.padCount && value.every(isValidPad)) {
      return { updatedAt: 0, holes: value };
    }

    const envelope = value as Partial<CalibrationEnvelope>;
    if (
      typeof envelope.updatedAt === "number" &&
      Array.isArray(envelope.holes) &&
      envelope.holes.length === config.padCount &&
      envelope.holes.every(isValidPad)
    ) {
      return envelope as CalibrationEnvelope;
    }

    return undefined;
  }

  function getGeneratedCalibration(): CalibrationEnvelope {
    return normalizeEnvelope(config.generatedCalibration) ?? { updatedAt: 0, holes: config.cloneDefaultPads() };
  }

  async function loadCalibration(): Promise<CalibrationEnvelope> {
    const generated = getGeneratedCalibration();

    const [stored, legacyStored] = await Promise.all([
      AsyncStorage.getItem(config.storageKey),
      config.legacyStorageKey ? AsyncStorage.getItem(config.legacyStorageKey) : Promise.resolve(null)
    ]);

    const local = normalizeEnvelope(stored ? JSON.parse(stored) : undefined);
    if (local && local.updatedAt >= generated.updatedAt) return local;

    const legacy = normalizeEnvelope(legacyStored ? JSON.parse(legacyStored) : undefined);
    if (legacy && legacy.updatedAt >= generated.updatedAt) return legacy;

    return generated;
  }

  async function saveCalibration(holes: CalibratedPad[]): Promise<CalibrationEnvelope> {
    const envelope: CalibrationEnvelope = {
      updatedAt: Date.now(),
      holes
    };
    await AsyncStorage.setItem(config.storageKey, JSON.stringify(envelope));
    return envelope;
  }

  async function resetCalibration(): Promise<CalibrationEnvelope> {
    await Promise.all([
      AsyncStorage.removeItem(config.storageKey),
      config.legacyStorageKey ? AsyncStorage.removeItem(config.legacyStorageKey) : Promise.resolve()
    ]);
    return getGeneratedCalibration();
  }

  return { getGeneratedCalibration, loadCalibration, saveCalibration, resetCalibration };
}
```

- [ ] **Step 2: Rebuild `BambooFlute/calibrationStore.ts` on top of the factory, preserving its exact exported names and storage keys**

```ts
import { CalibratedFluteHole, cloneDefaultFluteHoles } from "./holeLayout";
import { createCalibrationStore } from "../shared/calibrationStore";

export const CALIBRATION_STORAGE_KEY = "jamit:bamboo-flute:calibrated-holes:v2";
const LEGACY_STORAGE_KEY = "jamit:bamboo-flute:calibrated-holes:v1";

const generatedCalibration = require("./calibration.generated.json");

const store = createCalibrationStore({
  storageKey: CALIBRATION_STORAGE_KEY,
  legacyStorageKey: LEGACY_STORAGE_KEY,
  padCount: 7,
  generatedCalibration,
  cloneDefaultPads: cloneDefaultFluteHoles
});

export const getGeneratedCalibration = store.getGeneratedCalibration;
export const loadCalibration = store.loadCalibration;
export const saveCalibration = store.saveCalibration;
export const resetCalibration = store.resetCalibration;

export type { CalibratedFluteHole };
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: same single pre-existing failure in `BambooFluteInstrument.tsx` as before — no new errors.

- [ ] **Step 4: Manually confirm existing calibration data still loads**

This step only becomes observable once `BambooFluteInstrument.tsx` is wired back up in Task 9; note it here and re-run it as part of Task 9's manual check: with an existing saved calibration under `jamit:bamboo-flute:calibrated-holes:v2` in AsyncStorage (from prior use of the app), confirm loading the Flute screen shows the previously-calibrated hole positions, not the defaults.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/calibrationStore.ts src/components/BambooFlute/calibrationStore.ts
git commit -m "refactor: extract shared calibration-store factory"
```

---

## Task 8: Extract shared `ScaleInstrument` touch/gesture component

**Files:**
- Create: `src/components/shared/ScaleInstrument.tsx`

This is the generalized version of the current `BambooFluteInstrument.tsx` body: identical hold-to-play/slide/multi-touch/calibration logic, parameterized by instrument config instead of hardcoding the Flute's image, layout, resolver, and calibration store.

- [ ] **Step 1: Create the shared component**

```tsx
// src/components/shared/ScaleInstrument.tsx
// Shared touch/gesture engine for every scale-mapped instrument: hold-to-play,
// slide-between-pads, multi-touch, and calibration mode. Instrument-specific
// bits (image, default pad layout, sample resolver, calibration storage) are
// passed in as props so the Flute and Kalimba run on one engine, not two.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ImageBackground,
  LayoutChangeEvent,
  NativeTouchEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import * as Haptics from "expo-haptics";
import { AudioEngine, PlayableNote } from "../../audio/audioEngine";
import { SampleResolver } from "../../audio/sampleTypes";
import { RootNote, ScaleMode, getScaleName } from "../../music/scaleEngine";
import { generatePitchedScale } from "../../music/noteEngine";
import {
  CalibratedPad,
  ImageSize,
  RenderedImageFrame,
  containerPointToSource,
  getCoverFrame,
  sourcePointToContainer
} from "./padLayout";
import { CalibrationStore } from "./calibrationStore";

export type ScaleInstrumentProps = {
  rootNote: RootNote;
  mode: ScaleMode;
  initialCalibrationMode?: boolean;
  onExitCalibration?: () => void;
  instrumentLabel: string;
  imageSource: number;
  imageSize: ImageSize;
  defaultPads: CalibratedPad[];
  resolveSample: SampleResolver;
  calibrationStore: CalibrationStore;
};

type ActiveTouch = {
  degree?: number;
  note?: PlayableNote;
  isSounding: boolean;
  startTimer?: ReturnType<typeof setTimeout>;
  startedAt: number;
};

type CalibrationDragMode = "move" | "resize";

const HIT_ZONE_GAP = 4;
// A press shorter than this is a "quick tap" and stays silent; holding past
// it starts the note. Slides after this window switch notes instantly.
const NOTE_START_HOLD_MS = 90;

export function ScaleInstrument({
  rootNote,
  mode,
  initialCalibrationMode = false,
  onExitCalibration,
  instrumentLabel,
  imageSource,
  imageSize,
  defaultPads,
  resolveSample,
  calibrationStore
}: ScaleInstrumentProps) {
  const audioEngine = useRef(new AudioEngine(resolveSample)).current;
  const activeTouches = useRef(new Map<string, ActiveTouch>());
  const calibrationGesture = useRef<{ degree: number; mode: CalibrationDragMode } | null>(null);

  const initialCalibration = calibrationStore.getGeneratedCalibration();
  const [holes, setHoles] = useState<CalibratedPad[]>(initialCalibration.holes ?? defaultPads);
  const [savedHoles, setSavedHoles] = useState<CalibratedPad[]>(initialCalibration.holes ?? defaultPads);
  const [frame, setFrame] = useState<RenderedImageFrame | null>(null);
  const [isCalibrationMode, setIsCalibrationMode] = useState(initialCalibrationMode);

  const scale = useMemo(() => generatePitchedScale(rootNote, mode), [rootNote, mode]);
  const scaleName = useMemo(() => getScaleName(rootNote, mode), [rootNote, mode]);

  useEffect(() => {
    setIsCalibrationMode(initialCalibrationMode);
  }, [initialCalibrationMode]);

  useEffect(() => {
    let isMounted = true;
    calibrationStore
      .loadCalibration()
      .then((calibration) => {
        if (!isMounted) return;
        setHoles(calibration.holes);
        setSavedHoles(calibration.holes);
      })
      .catch((error) => console.warn(`Unable to load ${instrumentLabel} calibration`, error));

    return () => {
      isMounted = false;
    };
  }, [calibrationStore, instrumentLabel]);

  useEffect(() => {
    let isMounted = true;
    audioEngine.preload().catch((error) => {
      if (isMounted) {
        console.warn(`Unable to preload ${instrumentLabel} audio`, error);
      }
    });

    return () => {
      isMounted = false;
      activeTouches.current.forEach((touch) => {
        if (touch.startTimer) clearTimeout(touch.startTimer);
      });
      activeTouches.current.clear();
      audioEngine.unload().catch(() => undefined);
    };
  }, [audioEngine, instrumentLabel]);

  useEffect(() => {
    activeTouches.current.forEach((touch) => {
      if (touch.startTimer) clearTimeout(touch.startTimer);
    });
    activeTouches.current.clear();
    audioEngine.stopAll().catch(() => undefined);
  }, [audioEngine, rootNote, mode]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      setFrame(getCoverFrame(width, height, imageSize));
    },
    [imageSize]
  );

  const getEffectiveHitRadius = useCallback(
    (hole: CalibratedPad) => {
      const nearestDistance = holes.reduce((nearest, other) => {
        if (other.degree === hole.degree) return nearest;
        const distance = Math.hypot(hole.sourceX - other.sourceX, hole.sourceY - other.sourceY);
        return Math.min(nearest, distance);
      }, Number.POSITIVE_INFINITY);
      const nonOverlappingRadius = Number.isFinite(nearestDistance)
        ? Math.max(24, nearestDistance / 2 - HIT_ZONE_GAP)
        : hole.hitRadius;

      return Math.min(hole.hitRadius, nonOverlappingRadius);
    },
    [holes]
  );

  const isPointInsideHole = useCallback(
    (hole: CalibratedPad, x: number, y: number) => {
      if (!frame) return undefined;

      const point = sourcePointToContainer(hole.sourceX, hole.sourceY, frame);
      const dx = x - point.x;
      const dy = y - point.y;
      const hitRadius = getEffectiveHitRadius(hole) * frame.scale;
      return dx * dx + dy * dy <= hitRadius * hitRadius;
    },
    [frame, getEffectiveHitRadius]
  );

  const findHoleDegreeAtPoint = useCallback(
    (x: number, y: number) => {
      if (!frame) return undefined;

      const containing = holes.filter((hole) => isPointInsideHole(hole, x, y));
      if (containing.length === 0) return undefined;
      if (containing.length === 1) return containing[0].degree;

      const nearest = containing.reduce((best, hole) => {
        const point = sourcePointToContainer(hole.sourceX, hole.sourceY, frame);
        const distance = Math.hypot(x - point.x, y - point.y);
        if (distance < best.distance) {
          return { degree: hole.degree, distance };
        }
        return best;
      }, { degree: containing[0].degree, distance: Number.POSITIVE_INFINITY });

      return nearest.degree;
    },
    [frame, holes, isPointInsideHole]
  );

  const getPlayableNote = useCallback(
    (degree: number): PlayableNote | undefined => {
      const note = scale[degree - 1];
      if (!note) return undefined;

      return {
        key: `${scaleName}|pad-${degree}|${note.noteWithOctave}`,
        scaleName,
        padIndex: degree,
        noteWithOctave: note.noteWithOctave,
        midi: note.midi
      };
    },
    [scale, scaleName]
  );

  // Preload one player per scale degree so the first press has no load
  // latency, and rebuild the mapping whenever the scale changes.
  useEffect(() => {
    const notes = scale
      .map((degree) => getPlayableNote(degree.degree))
      .filter((note): note is PlayableNote => Boolean(note));
    audioEngine.prepareScale(notes).catch((error) => {
      console.warn("Unable to preload scale samples", error);
    });
  }, [audioEngine, getPlayableNote, scale]);

  const logCurrentMapping = useCallback(() => {
    const lines = scale.map((degree) => {
      const note = getPlayableNote(degree.degree);
      if (!note) return "";
      const debug = audioEngine.getDebugInfo(note);
      return [
        `pad=${degree.degree}`,
        `target=${note.noteWithOctave}`,
        `source=${debug.sourceFilename}`,
        `shift=${debug.semitoneShift}`,
        `playbackRate=${debug.playbackRate.toFixed(3)}`,
        `key=${note.key}`
      ].join(" ");
    });

    console.log(`[${instrumentLabel} mapping] ${scaleName}\n${lines.join("\n")}`);
  }, [audioEngine, getPlayableNote, instrumentLabel, scale, scaleName]);

  useEffect(() => {
    logCurrentMapping();
  }, [logCurrentMapping]);

  const logTouchEvent = useCallback(
    (eventType: "press" | "release", touchId: string, degree: number, note: PlayableNote) => {
      const debug = audioEngine.getDebugInfo(note);
      console.log(
        [
          `[${instrumentLabel} ${eventType}]`,
          `pad=${degree}`,
          `degree=${degree}`,
          `scale=${note.scaleName}`,
          `target=${note.noteWithOctave}`,
          `targetMidi=${note.midi}`,
          `source=${debug.sourceFilename}`,
          `sourceMidi=${debug.sourceMidi}`,
          `shift=${debug.semitoneShift}`,
          `playbackRate=${debug.playbackRate.toFixed(3)}`,
          `key=${note.key}`,
          `pointer=${touchId}`
        ].join(" ")
      );
    },
    [audioEngine, instrumentLabel]
  );

  const startNoteForTouch = useCallback(
    (touchId: string, active: ActiveTouch) => {
      if (!active.degree || !active.note) return;

      active.isSounding = true;
      Haptics.selectionAsync().catch(() => undefined);
      logTouchEvent("press", touchId, active.degree, active.note);
      // AudioEngine.play swaps the touch's note atomically: a slide stops the
      // old note exactly once and starts the new note exactly once.
      audioEngine.play(touchId, active.note).catch((error) => {
        console.warn(`Unable to play note ${active.note?.noteWithOctave}`, error);
      });
    },
    [audioEngine, logTouchEvent]
  );

  const stopTouchById = useCallback(
    (touchId: string) => {
      const active = activeTouches.current.get(touchId);
      activeTouches.current.delete(touchId);
      if (!active) return;

      // Quick tap: the start timer has not fired yet, so no sound at all.
      if (active.startTimer) clearTimeout(active.startTimer);
      if (!active.isSounding || !active.degree || !active.note) return;

      logTouchEvent("release", touchId, active.degree, active.note);
      audioEngine.stop(touchId).catch(() => undefined);
    },
    [audioEngine, logTouchEvent]
  );

  const handleTouchStart = useCallback(
    (touch: NativeTouchEvent) => {
      if (isCalibrationMode) return;
      const touchId = String(touch.identifier);
      if (activeTouches.current.has(touchId)) return;

      const degree = findHoleDegreeAtPoint(touch.locationX, touch.locationY);
      const note = degree ? getPlayableNote(degree) : undefined;
      const active: ActiveTouch = {
        degree: note ? degree : undefined,
        note,
        isSounding: false,
        startedAt: Date.now()
      };
      // Touches that land outside every hole are still tracked so they can
      // slide into a hole later.
      activeTouches.current.set(touchId, active);
      if (!note) return;

      active.startTimer = setTimeout(() => {
        active.startTimer = undefined;
        // Only start if this touch is still down and still aimed at a hole.
        if (activeTouches.current.get(touchId) === active && active.note) {
          startNoteForTouch(touchId, active);
        }
      }, NOTE_START_HOLD_MS);
    },
    [findHoleDegreeAtPoint, getPlayableNote, isCalibrationMode, startNoteForTouch]
  );

  const handleTouchMove = useCallback(
    (touch: NativeTouchEvent) => {
      if (isCalibrationMode) return;
      const touchId = String(touch.identifier);
      const active = activeTouches.current.get(touchId);
      if (!active) return;

      const degree = findHoleDegreeAtPoint(touch.locationX, touch.locationY);
      // Same hole (or still in the gap between holes): never retrigger.
      // Leaving a hole keeps the current note sounding (legato) until the
      // finger reaches a different hole or lifts.
      if (!degree || degree === active.degree) return;

      const note = getPlayableNote(degree);
      if (!note) return;

      active.degree = degree;
      active.note = note;

      if (active.isSounding) {
        startNoteForTouch(touchId, active);
        return;
      }

      // Not sounding yet. A pending start timer just retargets to the new
      // hole (it reads active.note when it fires). Otherwise start now if the
      // quick-tap window already passed, or schedule the remainder of it.
      if (active.startTimer) return;
      const elapsed = Date.now() - active.startedAt;
      if (elapsed >= NOTE_START_HOLD_MS) {
        startNoteForTouch(touchId, active);
        return;
      }
      active.startTimer = setTimeout(() => {
        active.startTimer = undefined;
        if (activeTouches.current.get(touchId) === active && active.note) {
          startNoteForTouch(touchId, active);
        }
      }, NOTE_START_HOLD_MS - elapsed);
    },
    [findHoleDegreeAtPoint, getPlayableNote, isCalibrationMode, startNoteForTouch]
  );

  const handleTouchEnd = useCallback(
    (touch: NativeTouchEvent) => {
      if (isCalibrationMode) return;
      stopTouchById(String(touch.identifier));
    },
    [isCalibrationMode, stopTouchById]
  );

  const saveCalibration = useCallback(async () => {
    const saved = await calibrationStore.saveCalibration(holes);
    setSavedHoles(saved.holes);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [calibrationStore, holes]);

  const resetCalibration = useCallback(async () => {
    const reset = await calibrationStore.resetCalibration();
    setHoles(reset.holes);
    setSavedHoles(reset.holes);
  }, [calibrationStore]);

  const exitCalibration = useCallback(() => {
    setIsCalibrationMode(false);
    setHoles(savedHoles);
    onExitCalibration?.();
  }, [onExitCalibration, savedHoles]);

  const updateHole = useCallback((degree: number, updater: (hole: CalibratedPad) => CalibratedPad) => {
    setHoles((current) => current.map((hole) => (hole.degree === degree ? updater(hole) : hole)));
  }, []);

  const calibrationResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => isCalibrationMode,
        onMoveShouldSetPanResponder: () => isCalibrationMode,
        onPanResponderMove: (event) => {
          if (!frame || !calibrationGesture.current) return;

          const { degree, mode: dragMode } = calibrationGesture.current;
          const touch = event.nativeEvent;
          const sourcePoint = containerPointToSource(touch.locationX, touch.locationY, frame);

          updateHole(degree, (hole) => {
            if (dragMode === "move") {
              return {
                ...hole,
                sourceX: sourcePoint.sourceX,
                sourceY: sourcePoint.sourceY
              };
            }

            const dx = sourcePoint.sourceX - hole.sourceX;
            const dy = sourcePoint.sourceY - hole.sourceY;
            const nextRadius = Math.max(36, Math.min(150, Math.sqrt(dx * dx + dy * dy)));
            return {
              ...hole,
              visibleRadius: nextRadius * 0.72,
              hitRadius: nextRadius
            };
          });
        },
        onPanResponderRelease: () => {
          calibrationGesture.current = null;
        },
        onPanResponderTerminate: () => {
          calibrationGesture.current = null;
        }
      }),
    [frame, isCalibrationMode, updateHole]
  );

  return (
    <View
      style={styles.root}
      onLayout={handleLayout}
      onTouchStart={(event) => event.nativeEvent.changedTouches.forEach(handleTouchStart)}
      onTouchMove={(event) => event.nativeEvent.changedTouches.forEach(handleTouchMove)}
      onTouchEnd={(event) => event.nativeEvent.changedTouches.forEach(handleTouchEnd)}
      onTouchCancel={(event) => event.nativeEvent.changedTouches.forEach(handleTouchEnd)}
    >
      <ImageBackground source={imageSource} resizeMode="cover" style={styles.image}>
        {frame
          ? holes.map((hole) => {
              const point = sourcePointToContainer(hole.sourceX, hole.sourceY, frame);
              const hitRadius = hole.hitRadius * frame.scale;

              return (
                <View key={hole.degree} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
                  {isCalibrationMode ? (
                    <View
                      {...calibrationResponder.panHandlers}
                      pointerEvents="auto"
                      onTouchStart={() => {
                        calibrationGesture.current = { degree: hole.degree, mode: "move" };
                      }}
                      style={[
                        styles.calibrationCircle,
                        {
                          left: point.x - hitRadius,
                          top: point.y - hitRadius,
                          width: hitRadius * 2,
                          height: hitRadius * 2,
                          borderRadius: hitRadius
                        }
                      ]}
                    >
                      <Text style={styles.calibrationNumber}>{hole.degree}</Text>
                      <View
                        pointerEvents="auto"
                        onTouchStart={(event) => {
                          event.stopPropagation();
                          calibrationGesture.current = { degree: hole.degree, mode: "resize" };
                        }}
                        style={styles.resizeHandle}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })
          : null}

        {isCalibrationMode ? (
          <View style={styles.controls}>
            <Pressable style={styles.controlButton} onPress={saveCalibration}>
              <Text style={styles.controlText}>Save</Text>
            </Pressable>
            <Pressable style={styles.controlButton} onPress={resetCalibration}>
              <Text style={styles.controlText}>Reset</Text>
            </Pressable>
            <Pressable style={styles.controlButton} onPress={exitCalibration}>
              <Text style={styles.controlText}>Exit Calibration</Text>
            </Pressable>
          </View>
        ) : null}
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#020302"
  },
  image: {
    flex: 1
  },
  calibrationCircle: {
    alignItems: "center",
    backgroundColor: "rgba(44, 227, 185, 0.08)",
    borderColor: "rgba(95, 255, 212, 0.95)",
    borderWidth: 2,
    justifyContent: "center",
    position: "absolute"
  },
  calibrationNumber: {
    color: "#effff8",
    fontSize: 22,
    fontWeight: "900",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5
  },
  resizeHandle: {
    position: "absolute",
    right: -11,
    bottom: -11,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#5fffd4",
    borderColor: "#08241e",
    borderWidth: 2
  },
  controls: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 28,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center"
  },
  controlButton: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8, 16, 13, 0.82)",
    borderColor: "rgba(255, 239, 206, 0.28)",
    borderWidth: 1
  },
  controlText: {
    color: "#fff0cf",
    fontWeight: "900",
    fontSize: 13
  }
});
```

Note: the original `BambooFluteInstrument.tsx` had two unused style keys (`feedback`, `rootFeedback`, `pressedFeedback`) not referenced anywhere in its render — they are dropped here as dead code, not a behavior change (nothing rendered using them).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: `ScaleInstrument.tsx` compiles cleanly with no errors. The pre-existing failure in `BambooFluteInstrument.tsx` (not yet rewritten) remains — expected, fixed next in Task 9.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/ScaleInstrument.tsx
git commit -m "feat: add shared ScaleInstrument touch/gesture/calibration engine"
```

---

## Task 9: Rewrite `BambooFluteInstrument.tsx` as a thin wrapper (Flute regression checkpoint)

**Files:**
- Modify: `src/components/BambooFlute/BambooFluteInstrument.tsx`

This is the critical checkpoint: after this task, the Flute must sound, feel, and calibrate exactly as it did before this whole refactor started.

- [ ] **Step 1: Remove now-dead re-exports from `src/components/BambooFlute/holeLayout.ts`**

Once `BambooFluteInstrument.tsx` (Step 2 below) gets its geometry directly from `shared/ScaleInstrument.tsx` / `shared/padLayout.ts`, nothing calls `holeLayout.ts`'s `getCoverFrame` wrapper, `containerPointToSource`, `sourcePointToContainer`, or `RenderedImageFrame` re-export anymore (Task 6 kept them only so the *old* `BambooFluteInstrument.tsx` kept compiling unchanged in the interim). Replace `src/components/BambooFlute/holeLayout.ts` with just what's still needed:

```ts
import { CalibratedPad } from "../shared/padLayout";

export type FluteHoleLayout = CalibratedPad;
export type CalibratedFluteHole = CalibratedPad;

export const BAMBOO_FLUTE_IMAGE_SIZE = {
  width: 853,
  height: 1844
};

export const BAMBOO_FLUTE_HOLES: FluteHoleLayout[] = [
  { degree: 1, sourceX: 426, sourceY: 553, visibleRadius: 73, hitRadius: 96, isRoot: true },
  { degree: 2, sourceX: 426, sourceY: 720, visibleRadius: 51, hitRadius: 76, isRoot: false },
  { degree: 3, sourceX: 426, sourceY: 870, visibleRadius: 51, hitRadius: 76, isRoot: false },
  { degree: 4, sourceX: 426, sourceY: 1022, visibleRadius: 51, hitRadius: 76, isRoot: false },
  { degree: 5, sourceX: 426, sourceY: 1176, visibleRadius: 51, hitRadius: 76, isRoot: false },
  { degree: 6, sourceX: 426, sourceY: 1331, visibleRadius: 51, hitRadius: 76, isRoot: false },
  { degree: 7, sourceX: 426, sourceY: 1492, visibleRadius: 51, hitRadius: 76, isRoot: false }
];

export function cloneDefaultFluteHoles(): CalibratedFluteHole[] {
  return BAMBOO_FLUTE_HOLES.map((hole) => ({ ...hole }));
}
```

`BambooFlute/calibrationStore.ts` (Task 7) only imports `CalibratedFluteHole` and `cloneDefaultFluteHoles` from this file, both preserved above, so it needs no changes here.

- [ ] **Step 2: Replace the full contents of `BambooFluteInstrument.tsx`**

```tsx
import React from "react";
import { ScaleInstrument } from "../shared/ScaleInstrument";
import { resolveFluteSample } from "../../audio/fluteSamples";
import { RootNote, ScaleMode } from "../../music/scaleEngine";
import { BAMBOO_FLUTE_IMAGE_SIZE, cloneDefaultFluteHoles } from "./holeLayout";
import * as fluteCalibrationStore from "./calibrationStore";

type Props = {
  rootNote: RootNote;
  mode: ScaleMode;
  initialCalibrationMode?: boolean;
  onExitCalibration?: () => void;
};

const fluteImage = require("../../../assets/images/bamboo-flute-final.png");

export function BambooFluteInstrument(props: Props) {
  return (
    <ScaleInstrument
      {...props}
      instrumentLabel="BambooFlute"
      imageSource={fluteImage}
      imageSize={BAMBOO_FLUTE_IMAGE_SIZE}
      defaultPads={cloneDefaultFluteHoles()}
      resolveSample={resolveFluteSample}
      calibrationStore={fluteCalibrationStore}
    />
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean, no errors anywhere in the project.

- [ ] **Step 4: Run the automated regression suite**

Run: `npm test`
Expected: `typecheck`, `test:music`, `test:mapping`, and `test:mapping:kalimba` all pass, with the Flute's mapping output identical to before this refactor (`24 scales x 7 holes all resolve to EXACT samples (shift 0, rate 1.0)...`).

- [ ] **Step 5: Manual Flute regression check (per this project's `verify` skill)**

Launch the app (`npm start`, or the project's existing dev workflow) and on the Bamboo Flute:
- Hold a hole: note starts after a brief hold, not on quick tap.
- Slide a held finger between holes: notes change instantly, legato (no gap/click).
- Two fingers on two different holes: both sound independently; lifting one leaves the other sounding.
- Two fingers on the *same* hole: does not retrigger or double up.
- Enter calibration mode (existing "Calibrate touch zones" entry point): circles are visible, numbered, draggable (move) and resizable (bottom-right handle); Save persists; Reset restores generated defaults; Exit Calibration returns to normal play with saved positions applied and circles hidden.
- If a previously-saved calibration exists in AsyncStorage from before this refactor, confirm it still loads (per Task 7 Step 4).

- [ ] **Step 6: Commit**

```bash
git add src/components/BambooFlute/holeLayout.ts src/components/BambooFlute/BambooFluteInstrument.tsx
git commit -m "refactor: rewrite BambooFluteInstrument as a thin ScaleInstrument wrapper"
```

---

## Task 10: Kalimba pad layout and calibration defaults

**Files:**
- Create: `src/components/Kalimba/holeLayout.ts`
- Create: `src/components/Kalimba/calibration.generated.json`
- Create: `src/components/Kalimba/calibrationStore.ts`

The supplied `assets/images/kalimba.png` (1857×847) shows exactly 7 tines in a fan layout — a 1:1 match for the 7 required pads. Default touch-zone centers below are estimated from the tine tips (evenly spaced left-to-right, y following the fan shape: shorter at the edges, longest in the center) and are refined later via calibration mode / the desktop calibration server, exactly like the Flute's.

Pad numbering convention (stated explicitly per the design spec): degree 1 (root) → degree 7, left to right — the same "ascending through the pads" convention the Flute uses top (root) → bottom (7th).

- [ ] **Step 1: Create `src/components/Kalimba/holeLayout.ts`**

```ts
import { CalibratedPad, ImageSize } from "../shared/padLayout";

export type CalibratedKalimbaPad = CalibratedPad;

export const KALIMBA_IMAGE_SIZE: ImageSize = {
  width: 1857,
  height: 847
};

export const KALIMBA_PADS: CalibratedKalimbaPad[] = [
  { degree: 1, sourceX: 475, sourceY: 402, visibleRadius: 50, hitRadius: 70, isRoot: true },
  { degree: 2, sourceX: 628, sourceY: 454, visibleRadius: 50, hitRadius: 70, isRoot: false },
  { degree: 3, sourceX: 781, sourceY: 503, visibleRadius: 50, hitRadius: 70, isRoot: false },
  { degree: 4, sourceX: 934, sourceY: 539, visibleRadius: 50, hitRadius: 70, isRoot: false },
  { degree: 5, sourceX: 1087, sourceY: 503, visibleRadius: 50, hitRadius: 70, isRoot: false },
  { degree: 6, sourceX: 1240, sourceY: 454, visibleRadius: 50, hitRadius: 70, isRoot: false },
  { degree: 7, sourceX: 1393, sourceY: 402, visibleRadius: 50, hitRadius: 70, isRoot: false }
];

export function cloneDefaultKalimbaHoles(): CalibratedKalimbaPad[] {
  return KALIMBA_PADS.map((pad) => ({ ...pad }));
}
```

- [ ] **Step 2: Create `src/components/Kalimba/calibration.generated.json`**

Mirrors the Flute's generated-calibration file shape (`updatedAt: 0` so any real calibration a user saves always takes precedence):

```json
{
  "updatedAt": 0,
  "holes": [
    { "degree": 1, "sourceX": 475, "sourceY": 402, "visibleRadius": 50, "hitRadius": 70, "isRoot": true },
    { "degree": 2, "sourceX": 628, "sourceY": 454, "visibleRadius": 50, "hitRadius": 70, "isRoot": false },
    { "degree": 3, "sourceX": 781, "sourceY": 503, "visibleRadius": 50, "hitRadius": 70, "isRoot": false },
    { "degree": 4, "sourceX": 934, "sourceY": 539, "visibleRadius": 50, "hitRadius": 70, "isRoot": false },
    { "degree": 5, "sourceX": 1087, "sourceY": 503, "visibleRadius": 50, "hitRadius": 70, "isRoot": false },
    { "degree": 6, "sourceX": 1240, "sourceY": 454, "visibleRadius": 50, "hitRadius": 70, "isRoot": false },
    { "degree": 7, "sourceX": 1393, "sourceY": 402, "visibleRadius": 50, "hitRadius": 70, "isRoot": false }
  ]
}
```

- [ ] **Step 3: Create `src/components/Kalimba/calibrationStore.ts`**

Brand-new instrument, so no legacy storage key:

```ts
import { cloneDefaultKalimbaHoles } from "./holeLayout";
import { createCalibrationStore } from "../shared/calibrationStore";

export const CALIBRATION_STORAGE_KEY = "jamit:kalimba:calibrated-holes:v1";

const generatedCalibration = require("./calibration.generated.json");

const store = createCalibrationStore({
  storageKey: CALIBRATION_STORAGE_KEY,
  padCount: 7,
  generatedCalibration,
  cloneDefaultPads: cloneDefaultKalimbaHoles
});

export const getGeneratedCalibration = store.getGeneratedCalibration;
export const loadCalibration = store.loadCalibration;
export const saveCalibration = store.saveCalibration;
export const resetCalibration = store.resetCalibration;
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: clean, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/Kalimba/holeLayout.ts src/components/Kalimba/calibration.generated.json src/components/Kalimba/calibrationStore.ts
git commit -m "feat: add Kalimba default pad layout and calibration store"
```

---

## Task 11: `KalimbaInstrument.tsx` and `KalimbaScreen.tsx`

**Files:**
- Create: `src/components/Kalimba/KalimbaInstrument.tsx`
- Create: `src/screens/KalimbaScreen.tsx`

- [ ] **Step 1: Create `src/components/Kalimba/KalimbaInstrument.tsx`**

```tsx
import React from "react";
import { ScaleInstrument } from "../shared/ScaleInstrument";
import { resolveKalimbaSample } from "../../audio/kalimbaSamples";
import { RootNote, ScaleMode } from "../../music/scaleEngine";
import { KALIMBA_IMAGE_SIZE, cloneDefaultKalimbaHoles } from "./holeLayout";
import * as kalimbaCalibrationStore from "./calibrationStore";

type Props = {
  rootNote: RootNote;
  mode: ScaleMode;
  initialCalibrationMode?: boolean;
  onExitCalibration?: () => void;
};

const kalimbaImage = require("../../../assets/images/kalimba.png");

export function KalimbaInstrument(props: Props) {
  return (
    <ScaleInstrument
      {...props}
      instrumentLabel="Kalimba"
      imageSource={kalimbaImage}
      imageSize={KALIMBA_IMAGE_SIZE}
      defaultPads={cloneDefaultKalimbaHoles()}
      resolveSample={resolveKalimbaSample}
      calibrationStore={kalimbaCalibrationStore}
    />
  );
}
```

- [ ] **Step 2: Create `src/screens/KalimbaScreen.tsx`** (mirrors `BambooFluteScreen.tsx` exactly, same styling, different component/copy)

```tsx
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { KalimbaInstrument } from "../components/Kalimba/KalimbaInstrument";
import { RootNote, ScaleMode } from "../music/scaleEngine";

type Props = {
  rootNote: RootNote;
  mode: ScaleMode;
  initialCalibrationMode?: boolean;
  onExit: () => void;
  onExitCalibration?: () => void;
};

export function KalimbaScreen({
  rootNote,
  mode,
  initialCalibrationMode = false,
  onExit,
  onExitCalibration
}: Props) {
  return (
    <View style={styles.screen}>
      <KalimbaInstrument
        rootNote={rootNote}
        mode={mode}
        initialCalibrationMode={initialCalibrationMode}
        onExitCalibration={onExitCalibration}
      />
      <Pressable style={styles.backButton} onPress={onExit} hitSlop={8}>
        <Text style={styles.backText}>Back to Scale Selection</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#020302"
  },
  backButton: {
    position: "absolute",
    top: 14,
    left: 14,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8, 16, 13, 0.82)",
    borderColor: "rgba(255, 239, 206, 0.28)",
    borderWidth: 1
  },
  backText: {
    color: "#fff0cf",
    fontWeight: "900",
    fontSize: 13
  }
});
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/Kalimba/KalimbaInstrument.tsx src/screens/KalimbaScreen.tsx
git commit -m "feat: add KalimbaInstrument and KalimbaScreen"
```

---

## Task 12: Instrument selection screen

**Files:**
- Create: `src/screens/InstrumentSelectionScreen.tsx`

- [ ] **Step 1: Create the screen**

```tsx
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type Instrument = "flute" | "kalimba";

type Props = {
  instrument: Instrument;
  onInstrumentChange: (instrument: Instrument) => void;
};

const INSTRUMENTS: Array<{ id: Instrument; label: string }> = [
  { id: "flute", label: "Bamboo Flute" },
  { id: "kalimba", label: "Kalimba" }
];

export function InstrumentSelectionScreen({ instrument, onInstrumentChange }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Instrument</Text>
      <View style={styles.row}>
        {INSTRUMENTS.map((item) => {
          const isSelected = item.id === instrument;
          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.82}
              onPress={() => onInstrumentChange(item.id)}
              style={[styles.button, isSelected && styles.selectedButton]}
            >
              <Text style={[styles.buttonText, isSelected && styles.selectedText]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12
  },
  sectionTitle: {
    color: "rgba(255, 243, 220, 0.72)",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase"
  },
  row: {
    flexDirection: "row",
    gap: 10
  },
  button: {
    alignItems: "center",
    backgroundColor: "rgba(255, 244, 221, 0.08)",
    borderColor: "rgba(255, 244, 221, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    height: 56,
    justifyContent: "center"
  },
  selectedButton: {
    backgroundColor: "#d89c4a",
    borderColor: "#f1c273"
  },
  buttonText: {
    color: "#fff3dc",
    fontSize: 16,
    fontWeight: "900"
  },
  selectedText: {
    color: "#170f06"
  }
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/screens/InstrumentSelectionScreen.tsx
git commit -m "feat: add InstrumentSelectionScreen"
```

---

## Task 13: Wire navigation in `App.tsx`

**Files:**
- Modify: `App.tsx`

New flow: Instrument Selection → Scale Selection (existing UI, now instrument-aware) → Play (`KalimbaScreen` or `BambooFluteScreen`). A "Change instrument" link on the Scale Selection screen goes back a step.

- [ ] **Step 1: Replace the full file contents**

```tsx
import React, { useMemo, useState } from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { BambooFluteScreen } from "./src/screens/BambooFluteScreen";
import { KalimbaScreen } from "./src/screens/KalimbaScreen";
import { InstrumentSelectionScreen, Instrument } from "./src/screens/InstrumentSelectionScreen";
import { ScaleSelectionScreen } from "./src/screens/ScaleSelectionScreen";
import { RootNote, ScaleMode, getScaleName } from "./src/music/scaleEngine";

type Phase = "instrument" | "setup" | "playing";

const INSTRUMENT_LABEL: Record<Instrument, string> = {
  flute: "flute",
  kalimba: "kalimba"
};

export default function App() {
  const [phase, setPhase] = useState<Phase>("instrument");
  const [startsInCalibration, setStartsInCalibration] = useState(false);
  const [instrument, setInstrument] = useState<Instrument>("flute");
  const [rootNote, setRootNote] = useState<RootNote>("C");
  const [mode, setMode] = useState<ScaleMode>("major");

  const scaleName = useMemo(() => getScaleName(rootNote, mode), [rootNote, mode]);

  if (phase === "instrument") {
    return (
      <View style={styles.app}>
        <StatusBar hidden />
        <SafeAreaView style={styles.safe}>
          <View style={styles.welcome}>
            <Text style={styles.eyebrow}>JamIt</Text>
            <Text style={styles.title}>Choose an instrument.</Text>
            <InstrumentSelectionScreen instrument={instrument} onInstrumentChange={setInstrument} />
            <TouchableOpacity
              style={styles.startButton}
              activeOpacity={0.85}
              onPress={() => setPhase("setup")}
            >
              <Text style={styles.startText}>Next</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (phase === "setup") {
    return (
      <View style={styles.app}>
        <StatusBar hidden />
        <SafeAreaView style={styles.safe}>
          <View style={styles.welcome}>
            <Text style={styles.eyebrow}>JamIt</Text>
            <Text style={styles.title}>Choose a scale, then play the {INSTRUMENT_LABEL[instrument]}.</Text>
            <ScaleSelectionScreen
              rootNote={rootNote}
              mode={mode}
              onRootNoteChange={setRootNote}
              onModeChange={setMode}
            />
            <TouchableOpacity
              style={styles.startButton}
              activeOpacity={0.85}
              onPress={() => {
                setStartsInCalibration(false);
                setPhase("playing");
              }}
            >
              <Text style={styles.startText}>Start {scaleName}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.calibrateButton}
              activeOpacity={0.85}
              onPress={() => {
                setStartsInCalibration(true);
                setPhase("playing");
              }}
            >
              <Text style={styles.calibrateText}>Calibrate touch zones</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.changeInstrumentButton}
              activeOpacity={0.85}
              onPress={() => setPhase("instrument")}
            >
              <Text style={styles.changeInstrumentText}>Change instrument</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <>
      <StatusBar hidden />
      {instrument === "kalimba" ? (
        <KalimbaScreen
          rootNote={rootNote}
          mode={mode}
          initialCalibrationMode={startsInCalibration}
          onExit={() => setPhase("setup")}
          onExitCalibration={() => setStartsInCalibration(false)}
        />
      ) : (
        <BambooFluteScreen
          rootNote={rootNote}
          mode={mode}
          initialCalibrationMode={startsInCalibration}
          onExit={() => setPhase("setup")}
          onExitCalibration={() => setStartsInCalibration(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: "#090b08"
  },
  safe: {
    flex: 1
  },
  welcome: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingVertical: 28
  },
  eyebrow: {
    color: "#d8b16f",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 3,
    marginBottom: 12,
    textTransform: "uppercase"
  },
  title: {
    color: "#fff3dc",
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 39,
    marginBottom: 28
  },
  startButton: {
    alignItems: "center",
    backgroundColor: "#d89c4a",
    borderRadius: 8,
    marginTop: 28,
    minHeight: 56,
    justifyContent: "center"
  },
  startText: {
    color: "#170f06",
    fontSize: 17,
    fontWeight: "900"
  },
  calibrateButton: {
    alignItems: "center",
    borderColor: "rgba(255, 243, 220, 0.22)",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    minHeight: 50,
    justifyContent: "center"
  },
  calibrateText: {
    color: "#fff3dc",
    fontSize: 15,
    fontWeight: "800"
  },
  changeInstrumentButton: {
    alignItems: "center",
    marginTop: 16,
    minHeight: 32,
    justifyContent: "center"
  },
  changeInstrumentText: {
    color: "rgba(255, 243, 220, 0.62)",
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline"
  }
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean, no errors.

- [ ] **Step 3: Manual navigation + Kalimba playability check**

Launch the app and walk the full flow:
- Instrument Selection shows, defaults to Bamboo Flute selected; tap Kalimba, tap Next.
- Scale Selection shows "Choose a scale, then play the kalimba."; pick a few different root/mode combinations (including ones far from the Kalimba's native notes, e.g. G Major, D Major) and tap Start.
- Kalimba screen shows the `kalimba.png` background full-screen; the 7 tines are visible but the touch zones are NOT (no visible circles/outlines in normal play).
- Hold a tine: note starts after a brief hold; slide between tines: notes change instantly; two fingers on two different tines sound independently; two fingers on the same tine does not retrigger.
- Pluck the same tine several times in a row: the takes audibly rotate (not the exact same recording every time) where the tine has multiple round-robin files.
- Tap "Back to Scale Selection", then "Calibrate touch zones": circles become visible over each tine, numbered 1-7, draggable/resizable; Save/Reset/Exit work; after Exit, circles are hidden again.
- Tap "Change instrument", switch back to Bamboo Flute, confirm it still starts and plays correctly (no cross-instrument state leakage).

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat: wire instrument selection into app navigation"
```

---

## Task 14: Generalize the desktop calibration server

**Files:**
- Modify: `scripts/desktop-calibration-server.js`
- Modify: `package.json`

- [ ] **Step 1: Install `cross-env`** (needed to set `INSTRUMENT` portably in this project's PowerShell/Windows dev environment)

Run: `npm install --save-dev cross-env`
Expected: adds `cross-env` to `devDependencies` in `package.json` and `package-lock.json`.

- [ ] **Step 2: Replace the top of `scripts/desktop-calibration-server.js`** (before the `page` template literal) with an instrument-config lookup

```js
const fs = require("fs");
const http = require("http");
const path = require("path");

const root = path.resolve(__dirname, "..");

const INSTRUMENTS = {
  flute: {
    label: "Bamboo Flute",
    imagePath: path.join(root, "assets", "images", "bamboo-flute-final.png"),
    calibrationPath: path.join(root, "src", "components", "BambooFlute", "calibration.generated.json"),
    imageSize: { width: 853, height: 1844 },
    defaults: [
      { degree: 1, sourceX: 426, sourceY: 553, visibleRadius: 73, hitRadius: 96, isRoot: true },
      { degree: 2, sourceX: 426, sourceY: 720, visibleRadius: 51, hitRadius: 76, isRoot: false },
      { degree: 3, sourceX: 426, sourceY: 870, visibleRadius: 51, hitRadius: 76, isRoot: false },
      { degree: 4, sourceX: 426, sourceY: 1022, visibleRadius: 51, hitRadius: 76, isRoot: false },
      { degree: 5, sourceX: 426, sourceY: 1176, visibleRadius: 51, hitRadius: 76, isRoot: false },
      { degree: 6, sourceX: 426, sourceY: 1331, visibleRadius: 51, hitRadius: 76, isRoot: false },
      { degree: 7, sourceX: 426, sourceY: 1492, visibleRadius: 51, hitRadius: 76, isRoot: false }
    ]
  },
  kalimba: {
    label: "Kalimba",
    imagePath: path.join(root, "assets", "images", "kalimba.png"),
    calibrationPath: path.join(root, "src", "components", "Kalimba", "calibration.generated.json"),
    imageSize: { width: 1857, height: 847 },
    defaults: [
      { degree: 1, sourceX: 475, sourceY: 402, visibleRadius: 50, hitRadius: 70, isRoot: true },
      { degree: 2, sourceX: 628, sourceY: 454, visibleRadius: 50, hitRadius: 70, isRoot: false },
      { degree: 3, sourceX: 781, sourceY: 503, visibleRadius: 50, hitRadius: 70, isRoot: false },
      { degree: 4, sourceX: 934, sourceY: 539, visibleRadius: 50, hitRadius: 70, isRoot: false },
      { degree: 5, sourceX: 1087, sourceY: 503, visibleRadius: 50, hitRadius: 70, isRoot: false },
      { degree: 6, sourceX: 1240, sourceY: 454, visibleRadius: 50, hitRadius: 70, isRoot: false },
      { degree: 7, sourceX: 1393, sourceY: 402, visibleRadius: 50, hitRadius: 70, isRoot: false }
    ]
  }
};

const instrumentId = process.env.INSTRUMENT === "kalimba" ? "kalimba" : "flute";
const instrumentConfig = INSTRUMENTS[instrumentId];
const calibrationPath = instrumentConfig.calibrationPath;
const imagePath = instrumentConfig.imagePath;
const port = Number(process.env.PORT || 4174);
```

Delete the old top-of-file `const calibrationPath = ...` / `const imagePath = ...` / `const port = ...` lines this replaces (everything from the original `const root = ...` through the original `const port = ...`).

- [ ] **Step 3: Template the instrument-specific parts of the HTML page**

In the `page` template literal:

- Replace `<title>JamIt Bamboo Flute Calibration</title>` with `` <title>JamIt ${instrumentConfig.label} Calibration</title> ``
- Replace `aspect-ratio: 853 / 1844;` (in the `.stage` CSS rule) with `` aspect-ratio: ${instrumentConfig.imageSize.width} / ${instrumentConfig.imageSize.height}; ``
- Replace `<img src="/image" alt="Bamboo flute app background" />` with `` <img src="/image" alt="${instrumentConfig.label} app background" /> ``
- Replace the client-side `const IMAGE_SIZE = { width: 853, height: 1844 };` with `` const IMAGE_SIZE = ${JSON.stringify(instrumentConfig.imageSize)}; ``
- Replace the client-side `const defaults = [ ... ];` array literal with `` const defaults = ${JSON.stringify(instrumentConfig.defaults)}; ``

- [ ] **Step 4: Update the log line at the bottom of the file**

```js
server.listen(port, "127.0.0.1", () => {
  console.log(`Desktop ${instrumentConfig.label} calibration running at http://127.0.0.1:${port}`);
});
```

- [ ] **Step 5: Fix the `calibrate:desktop:kalimba` script added in Task 3 to actually use `cross-env`**

In `package.json`, confirm/update:

```json
"calibrate:desktop": "node scripts/desktop-calibration-server.js",
"calibrate:desktop:kalimba": "cross-env INSTRUMENT=kalimba node scripts/desktop-calibration-server.js",
```

- [ ] **Step 6: Manually verify both calibration servers start and serve the right image**

Run: `npm run calibrate:desktop` — open `http://127.0.0.1:4174`, confirm it shows the Flute image with 7 circles, title "JamIt Bamboo Flute Calibration". Stop it.
Run: `npm run calibrate:desktop:kalimba` — open `http://127.0.0.1:4174`, confirm it shows the `kalimba.png` image with 7 circles roughly over the 7 tines, title "JamIt Kalimba Calibration". Stop it.

- [ ] **Step 7: Commit**

```bash
git add scripts/desktop-calibration-server.js package.json package-lock.json
git commit -m "feat: generalize desktop calibration server for the Kalimba"
```

---

## Task 15: Final full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated test suite**

Run: `npm test`
Expected: all four steps pass —
```
> tsc --noEmit
> node scripts/test-scale-engine.js
Scale engine tests passed: 4 spec scales + invariants for all 12 roots in Major and Natural Minor.
> node scripts/test-audio-mapping.js
Audio mapping tests passed: 24 scales x 7 holes all resolve to EXACT samples (shift 0, rate 1.0), distinct + in-scale pitches, all scale sound-sets pairwise different, 24 samples pitch-verified against the WAV audio.
> node scripts/test-kalimba-mapping.js
Kalimba mapping tests passed: 24 scales x 7 holes all resolve to in-scale, distinct sounding pitches; 8 tines pitch-verified against their WAV audio.
```

- [ ] **Step 2: Final manual walkthrough (per this project's `verify` skill)**

Repeat Task 9 Step 4 (Flute) and Task 13 Step 3 (Kalimba + navigation) once more, end to end, in a single app session, including switching between instruments more than once, to confirm no state leaks between them (e.g., Kalimba's calibration mode toggling does not affect the Flute's, changing scale on one instrument doesn't affect the other's remembered scale/calibration).

- [ ] **Step 3: No commit for this task** — it is a verification-only checkpoint. If anything fails, return to the relevant earlier task, fix it there, and re-run this task's checks.

---

## Deferred (explicitly out of scope for this plan)

Per the approved design spec, EAS Build / EAS Update / expo-dev-client / TestFlight preparation is a separate follow-on piece of work the user asked to start *after* this plan ships. It needs its own spec (brainstorming) and plan — do not fold it into this one.
