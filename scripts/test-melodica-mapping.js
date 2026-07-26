// Audio mapping tests for the Melodica sample catalog against the REAL
// compiled sources and the real WAV files on disk:
//  1. Every hole of every scale resolves to a sample def with a correct
//     semitone shift and playback rate (2^(shift/12)); sounding pitch
//     (sample midi + shift) always equals the target midi. Unlike the
//     Flute/Kalimba (both fully pre-rendered to exact samples now), the
//     Melodica pack only has recordings for C and F# (see
//     melodicaSampleData.ts), so shift === 0 / rate === 1.0 is NOT asserted
//     for every scale -- most degrees legitimately fall back to the nearest
//     recorded C or F#, resolved via runtime pitch-shifting exactly like the
//     Flute's own fallback path.
//  2. All 7 holes of every scale produce 7 distinct sounding pitches.
//  3. Every sample file exists on disk and is pitch-verified against the
//     catalog's target MIDI (tolerance 10 cents -- this is a clean digital
//     FM-synth recording, not a real detuned acoustic instrument, so a much
//     tighter tolerance than the Flute/Kalimba is appropriate).
const fs = require("fs");
const path = require("path");
const { compileForTests } = require("./lib/compile-for-tests");
const { parseWav, detectPitch } = require("./lib/wav-pitch");

const projectRoot = path.resolve(__dirname, "..");
const samplesDir = path.join(
  projectRoot, "assets", "audio", "piano", "FM-Piano1 SFZ+WAV-20190916", "samples"
);
const buildDir = compileForTests();
const { CHROMATIC_NOTES } = require(path.join(buildDir, "music", "scaleEngine"));
const { generatePitchedScale } = require(path.join(buildDir, "music", "noteEngine"));
const { MELODICA_SAMPLE_DEFS, resolveMelodicaSampleDef, getMelodicaPlaybackRate } = require(
  path.join(buildDir, "audio", "melodicaSampleData")
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
      const resolved = resolveMelodicaSampleDef(degree.midi);
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

check("getMelodicaPlaybackRate(12) doubles", Math.abs(getMelodicaPlaybackRate(12) - 2) < 1e-9);
check("getMelodicaPlaybackRate(-12) halves", Math.abs(getMelodicaPlaybackRate(-12) - 0.5) < 1e-9);

// --- 3: catalog vs the actual audio content --------------------------------
check("Melodica has exactly 12 sample defs (C/F# x 6 octaves)", MELODICA_SAMPLE_DEFS.length === 12);

for (const def of MELODICA_SAMPLE_DEFS) {
  check(`${def.noteWithOctave}: gain in (0, 1]`, def.gain > 0 && def.gain <= 1);

  const filePath = path.join(samplesDir, def.filename);
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
  console.error(`Melodica mapping tests FAILED (${failures} failure(s)).`);
  process.exit(1);
}
console.log(
  `Melodica mapping tests passed: 24 scales x 7 holes all resolve to in-scale, distinct sounding pitches; ${MELODICA_SAMPLE_DEFS.length} sample defs pitch-verified against their WAV audio.`
);
