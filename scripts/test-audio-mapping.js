// Audio mapping tests against the REAL compiled sources:
//  1. Every hole of every scale resolves to an existing sample with a
//     correct semitone shift and playback rate (2^(shift/12)).
//  2. All 7 holes of every scale produce 7 distinct sounding pitches.
//  3. The sample catalog's MIDI values match the ACTUAL pitch of each WAV
//     (autocorrelation pitch detection on the audio data itself).
const fs = require("fs");
const path = require("path");
const { compileForTests } = require("./lib/compile-for-tests");

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
  if (fmt.bitsPerSample !== 16) throw new Error(`Expected 16-bit PCM, got ${fmt.bitsPerSample}-bit`);

  const frameCount = Math.floor(dataSize / (2 * fmt.numChannels));
  const mono = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i++) {
    let acc = 0;
    for (let ch = 0; ch < fmt.numChannels; ch++) {
      acc += buffer.readInt16LE(dataOffset + (i * fmt.numChannels + ch) * 2) / 32768;
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
