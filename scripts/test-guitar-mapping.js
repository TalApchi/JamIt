// Audio mapping tests for the Distortion Guitar sample catalog and its
// 14-pad, two-octave-row layout, against the REAL compiled sources and the
// real WAV files on disk:
//  1. Every one of the 14 pads of every scale resolves to an EXACT sample
//     (shift 0, rate 1.0) -- same invariant as every other instrument, now
//     that every playable note (MIDI 60..94) has its own dedicated,
//     pre-rendered WAV.
//  2. Pads 1-7 (left, octave 5) sound exactly one octave above pads 8-14
//     (right, octave 4) for the same degree, matching the user's exact
//     mapping spec (verified against the C Major / G Major examples).
//  3. All 14 pads of every scale produce 14 distinct sounding pitches.
//  4. Every sample def's file exists on disk and is pitch-verified against
//     the catalog's target MIDI (tolerance 10 cents -- these are clean
//     resamples of a real but clean guitar recording; the top ~11 notes
//     shift as much as +10 semitones off their nearest anchor, the largest
//     shift any instrument in this app uses, so this also confirms Lanczos
//     resampling still holds up at that extreme).
const fs = require("fs");
const path = require("path");
const { compileForTests } = require("./lib/compile-for-tests");
const { parseWav, detectPitch } = require("./lib/wav-pitch");

const projectRoot = path.resolve(__dirname, "..");
const kitDir = path.join(projectRoot, "assets", "audio", "DistortionGuitar");
const buildDir = compileForTests();
const { CHROMATIC_NOTES } = require(path.join(buildDir, "music", "scaleEngine"));
const { generatePitchedScale } = require(path.join(buildDir, "music", "noteEngine"));
const {
  DISTORTION_GUITAR_SAMPLE_DEFS,
  resolveDistortionGuitarSampleDef,
  getDistortionGuitarPlaybackRate
} = require(path.join(buildDir, "audio", "distortionGuitarSampleData"));

let failures = 0;
function check(label, condition) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL ${label}`);
  }
}

// Mirrors DistortionGuitarInstrument.tsx's resolveDegree exactly: pads 1-7
// (left) play octave 5 (scale degree N, +1 octave); pads 8-14 (right) play
// octave 4 (scale degree N-7, unshifted).
function resolveDegree(degree, scaleLength) {
  if (degree <= scaleLength) {
    return { scaleIndex: degree - 1, octaveOffset: 1 };
  }
  return { scaleIndex: degree - scaleLength - 1, octaveOffset: 0 };
}

// --- 1 + 2 + 3: resolution invariants for every scale and pad -------------
const soundingSetByScale = new Map();

for (const root of CHROMATIC_NOTES) {
  for (const mode of ["major", "minor"]) {
    const scale = generatePitchedScale(root, mode);
    const scaleMidiSet = new Set(scale.map((d) => d.midi));
    const soundingPitches = new Set();
    const soundingByDegree = new Map();

    for (let pad = 1; pad <= 14; pad++) {
      const { scaleIndex, octaveOffset } = resolveDegree(pad, scale.length);
      const targetMidi = scale[scaleIndex].midi + octaveOffset * 12;
      const resolved = resolveDistortionGuitarSampleDef(targetMidi);
      const label = `${root} ${mode} pad ${pad} (target midi ${targetMidi})`;

      check(`${label}: exact sample (shift 0)`, resolved.semitoneShift === 0);
      check(`${label}: rate exactly 1.0`, resolved.playbackRate === 1);
      check(`${label}: sample midi equals target`, resolved.def.midi === targetMidi);

      const expectedScaleMidi = octaveOffset === 0 ? targetMidi : targetMidi - 12;
      check(`${label}: target belongs to the scale (at its base octave)`, scaleMidiSet.has(expectedScaleMidi));

      soundingPitches.add(targetMidi);
      soundingByDegree.set(pad, targetMidi);
    }

    check(`${root} ${mode}: 14 pads -> 14 distinct sounding pitches`, soundingPitches.size === 14);

    // Left (1-7) must be exactly one octave above right (8-14) for the same degree.
    for (let d = 1; d <= 7; d++) {
      check(
        `${root} ${mode}: pad ${d} (left) is exactly +12 vs pad ${d + 7} (right)`,
        soundingByDegree.get(d) === soundingByDegree.get(d + 7) + 12
      );
    }

    soundingSetByScale.set(`${root} ${mode}`, [...soundingPitches].sort((a, b) => a - b).join(","));
  }
}

const scaleNames = [...soundingSetByScale.keys()];
for (let i = 0; i < scaleNames.length; i++) {
  for (let j = i + 1; j < scaleNames.length; j++) {
    check(
      `${scaleNames[i]} and ${scaleNames[j]} sound different`,
      soundingSetByScale.get(scaleNames[i]) !== soundingSetByScale.get(scaleNames[j])
    );
  }
}

check("getDistortionGuitarPlaybackRate(12) doubles", Math.abs(getDistortionGuitarPlaybackRate(12) - 2) < 1e-9);
check("getDistortionGuitarPlaybackRate(-12) halves", Math.abs(getDistortionGuitarPlaybackRate(-12) - 0.5) < 1e-9);

// --- 4: catalog vs the actual audio content --------------------------------
check("Distortion Guitar has an exact def for every note MIDI 60..94", DISTORTION_GUITAR_SAMPLE_DEFS.length === 35);

for (const def of DISTORTION_GUITAR_SAMPLE_DEFS) {
  check(`${def.noteWithOctave}: gain in (0, 1]`, def.gain > 0 && def.gain <= 1);

  const filePath = path.join(kitDir, def.filename);
  check(`${def.filename} exists on disk`, fs.existsSync(filePath));
  if (!fs.existsSync(filePath)) continue;

  const { sampleRate, samples } = parseWav(fs.readFileSync(filePath));
  const freq = detectPitch(samples, sampleRate);
  check(`${def.filename}: pitch detectable`, freq !== null);
  if (freq === null) continue;

  const detectedMidi = 69 + 12 * Math.log2(freq / 440);
  const centsOff = (detectedMidi - def.midi) * 100;
  check(
    `${def.filename}: catalog says MIDI ${def.midi} (${def.noteWithOctave}), audio measures ${detectedMidi.toFixed(2)} (${centsOff.toFixed(0)} cents off; tolerance 10)`,
    Math.abs(centsOff) <= 10
  );
}

if (failures > 0) {
  console.error(`Distortion Guitar mapping tests FAILED (${failures} failure(s)).`);
  process.exit(1);
}
console.log(
  `Distortion Guitar mapping tests passed: 24 scales x 14 pads all resolve to EXACT samples (shift 0, rate 1.0), left row always +12 vs right row, distinct + in-scale pitches, all scale sound-sets pairwise different, ${DISTORTION_GUITAR_SAMPLE_DEFS.length} sample defs pitch-verified against their WAV audio.`
);
