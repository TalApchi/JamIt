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
