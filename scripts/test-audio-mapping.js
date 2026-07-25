// Audio mapping tests against the REAL compiled sources:
//  1. Every hole of every scale resolves to an existing sample with a
//     correct semitone shift and playback rate (2^(shift/12)).
//  2. All 7 holes of every scale produce 7 distinct sounding pitches.
//  3. The sample catalog's MIDI values match the ACTUAL pitch of each WAV
//     (autocorrelation pitch detection on the audio data itself).
const fs = require("fs");
const path = require("path");
const { compileForTests } = require("./lib/compile-for-tests");
const { parseWav, detectPitch } = require("./lib/wav-pitch");

const projectRoot = path.resolve(__dirname, "..");
const buildDir = compileForTests();
const { CHROMATIC_NOTES } = require(path.join(buildDir, "music", "scaleEngine"));
const { generatePitchedScale } = require(path.join(buildDir, "music", "noteEngine"));
const { FLUTE_SAMPLE_DEFS, resolveFluteSampleDef, getPlaybackRate } = require(
  path.join(buildDir, "audio", "fluteSampleData")
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
      const resolved = resolveFluteSampleDef(degree.midi);
      const label = `${root} ${mode} hole ${index + 1} (${degree.noteWithOctave})`;

      check(`${label}: exact sample (shift 0)`, resolved.semitoneShift === 0);
      check(`${label}: rate exactly 1.0`, resolved.playbackRate === 1);
      check(`${label}: sample midi equals target`, resolved.def.midi === degree.midi);

      // Sounding pitch = source pitch + shift; must be the target itself,
      // belong to the scale, and be unique per hole.
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

check("getPlaybackRate(12) doubles", Math.abs(getPlaybackRate(12) - 2) < 1e-9);
check("getPlaybackRate(-12) halves", Math.abs(getPlaybackRate(-12) - 0.5) < 1e-9);

// --- 3: catalog vs the actual audio content --------------------------------

for (const def of FLUTE_SAMPLE_DEFS) {
  const filePath = path.join(projectRoot, "flute_sound_kit", def.filename);
  check(`${def.filename} exists on disk`, fs.existsSync(filePath));
  if (!fs.existsSync(filePath)) continue;

  check(`${def.filename}: gain in (0, 1]`, def.gain > 0 && def.gain <= 1);

  const { sampleRate, samples } = parseWav(fs.readFileSync(filePath));
  const freq = detectPitch(samples, sampleRate);
  check(`${def.filename}: pitch detectable`, freq !== null);
  if (freq === null) continue;

  const detectedMidi = 69 + 12 * Math.log2(freq / 440);
  const centsOff = (detectedMidi - def.midi) * 100;
  check(
    `${def.filename}: catalog says MIDI ${def.midi} (${def.noteWithOctave}), audio measures ${detectedMidi.toFixed(2)} (${centsOff.toFixed(0)} cents off; tolerance 30)`,
    Math.abs(centsOff) <= 30
  );
}

if (failures > 0) {
  console.error(`Audio mapping tests FAILED (${failures} failure(s)).`);
  process.exit(1);
}
console.log(
  `Audio mapping tests passed: 24 scales x 7 holes all resolve to EXACT samples (shift 0, rate 1.0), distinct + in-scale pitches, all scale sound-sets pairwise different, ${FLUTE_SAMPLE_DEFS.length} samples pitch-verified against the WAV audio.`
);
