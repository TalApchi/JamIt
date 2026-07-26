// Audio mapping tests for the Kalimba sample catalog against the REAL
// compiled sources and the real WAV files on disk:
//  1. Every hole of every scale resolves to an EXACT sample (shift 0, rate
//     1.0) -- exactly like the Flute's own invariant, now that every
//     playable note (MIDI 60..82) has its own dedicated, pre-rendered WAV.
//     Runtime playbackRate-based pitch shifting is no longer used for the
//     Kalimba at all: it was confirmed unreliable on-device (the Audio
//     Debug screen showed several different logged playbackRate values
//     producing identical audible pitch), so every note now gets a real,
//     offline-verified WAV instead (see
//     scripts/generate-kalimba-shifted-samples.js).
//  2. All 7 holes of every scale produce 7 distinct sounding pitches.
//  3. Every sample def's round-robin files exist on disk and are
//     pitch-verified against the catalog's target MIDI (tolerance 60 cents,
//     covering both the real tines' natural detuning and the offline
//     resampler's own measured worst case of 42 cents).
const fs = require("fs");
const path = require("path");
const { compileForTests } = require("./lib/compile-for-tests");
const { parseWav, detectPitch } = require("./lib/wav-pitch");

const projectRoot = path.resolve(__dirname, "..");
const kitDir = path.join(projectRoot, "assets", "audio", "kalimba", "Kalimba-SFZ-20190723");
const buildDir = compileForTests();
const { CHROMATIC_NOTES } = require(path.join(buildDir, "music", "scaleEngine"));
const { generatePitchedScale } = require(path.join(buildDir, "music", "noteEngine"));
const { KALIMBA_SAMPLE_DEFS, resolveKalimbaSampleDef, getKalimbaPlaybackRate } = require(
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
// Every playable note now has an EXACT pre-rendered sample, so runtime pitch
// shifting is never used: shift must be 0 and rate must be exactly 1.0.

const soundingSetByScale = new Map();

for (const root of CHROMATIC_NOTES) {
  for (const mode of ["major", "minor"]) {
    const scale = generatePitchedScale(root, mode);
    const scaleMidiSet = new Set(scale.map((d) => d.midi));
    const soundingPitches = new Set();

    scale.forEach((degree, index) => {
      const resolved = resolveKalimbaSampleDef(degree.midi);
      const label = `${root} ${mode} hole ${index + 1} (${degree.noteWithOctave})`;

      check(`${label}: exact sample (shift 0)`, resolved.semitoneShift === 0);
      check(`${label}: rate exactly 1.0`, resolved.playbackRate === 1);
      check(`${label}: sample midi equals target`, resolved.def.midi === degree.midi);

      const sounding = resolved.def.midi + resolved.semitoneShift;
      check(`${label}: sounding pitch belongs to the scale`, scaleMidiSet.has(sounding));
      soundingPitches.add(sounding);
    });

    check(`${root} ${mode}: 7 holes -> 7 distinct sounding pitches`, soundingPitches.size === 7);
    soundingSetByScale.set(`${root} ${mode}`, [...soundingPitches].sort((a, b) => a - b).join(","));
  }
}

// No two scales with different note sets may produce the same sounding set.
const scaleNames = [...soundingSetByScale.keys()];
for (let i = 0; i < scaleNames.length; i++) {
  for (let j = i + 1; j < scaleNames.length; j++) {
    check(
      `${scaleNames[i]} and ${scaleNames[j]} sound different`,
      soundingSetByScale.get(scaleNames[i]) !== soundingSetByScale.get(scaleNames[j])
    );
  }
}

check("getKalimbaPlaybackRate(12) doubles", Math.abs(getKalimbaPlaybackRate(12) - 2) < 1e-9);
check("getKalimbaPlaybackRate(-12) halves", Math.abs(getKalimbaPlaybackRate(-12) - 0.5) < 1e-9);

// --- 3: catalog vs the actual audio content --------------------------------
check("Kalimba has an exact def for every note MIDI 60..82", KALIMBA_SAMPLE_DEFS.length === 23);

for (const def of KALIMBA_SAMPLE_DEFS) {
  check(`${def.noteWithOctave}: gain in (0, 1]`, def.gain > 0 && def.gain <= 1);
  check(`${def.noteWithOctave}: has at least one round-robin take`, def.filenames.length >= 1);

  for (const filename of def.filenames) {
    const filePath = path.join(kitDir, filename);
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
  `Kalimba mapping tests passed: 24 scales x 7 holes all resolve to EXACT samples (shift 0, rate 1.0), distinct + in-scale pitches, all scale sound-sets pairwise different, ${KALIMBA_SAMPLE_DEFS.length} sample defs (${KALIMBA_SAMPLE_DEFS.reduce((n, d) => n + d.filenames.length, 0)} files) pitch-verified against their WAV audio.`
);
