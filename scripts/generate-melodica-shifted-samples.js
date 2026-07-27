// Pre-renders a real WAV for every playable Melodica/Piano note (MIDI 60..82,
// C4..A#5 -- the same range every supported Major/Natural Minor scale can
// ever target, confirmed against the compiled scale engine) that has no
// exact recorded sample, by resampling the nearest recorded C/F# v100 take
// by 2^(shift/12) with a windowed-sinc (Lanczos) kernel -- the same
// offline-rendering approach already used for the Flute
// (generate-shifted-samples.js) and the Kalimba
// (generate-kalimba-shifted-samples.js), and for the same reason: runtime
// playbackRate-based pitch shifting was confirmed unreliable on-device via
// the Piano Audio Debug screen (multiple different playbackRate values
// produced identical audible pitch within each C/F# group), so every note
// now gets its own dedicated, pre-rendered WAV and always plays at rate 1.0.
//
// Usage: node scripts/generate-melodica-shifted-samples.js
// Output: assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/generated/Melodica_<Note><Octave>.wav
const fs = require("fs");
const path = require("path");
const { parseWav } = require("./lib/wav-pitch");

const projectRoot = path.resolve(__dirname, "..");
const kitDir = path.join(projectRoot, "assets", "audio", "piano", "FM-Piano1 SFZ+WAV-20190916");
const samplesDir = path.join(kitDir, "samples");
const outDir = path.join(kitDir, "generated");

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const midiToName = (midi) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

// The pack's recorded pitch classes (C and F# only, v100 layer -- see
// src/audio/melodicaSampleData.ts for the authoritative, TypeScript copy of
// this same data -- duplicated here because this is a plain Node dev script
// with no TS build step, matching how generate-shifted-samples.js and
// generate-kalimba-shifted-samples.js also inline their own grid rather than
// importing from src/).
const RECORDED = [
  { midi: 30, filename: "F#1v100.wav" },
  { midi: 36, filename: "C2v100.wav" },
  { midi: 42, filename: "F#2v100.wav" },
  { midi: 48, filename: "C3v100.wav" },
  { midi: 54, filename: "F#3v100.wav" },
  { midi: 60, filename: "C4v100.wav" },
  { midi: 66, filename: "F#4v100.wav" },
  { midi: 72, filename: "C5v100.wav" },
  { midi: 78, filename: "F#5v100.wav" },
  { midi: 84, filename: "C6v100.wav" },
  { midi: 90, filename: "F#6v100.wav" },
  { midi: 96, filename: "C7v100.wav" }
];

const MIN_TARGET = 60; // C4 (lowest tonic)
const MAX_TARGET = 82; // A#5 (B major 7th degree)

function writeWav(filePath, samples, sampleRate) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filePath, buffer);
}

// Lanczos-windowed sinc interpolation; ratio > 1 raises pitch. Identical to
// generate-shifted-samples.js's/generate-kalimba-shifted-samples.js's kernel.
const LANCZOS_A = 16;
function lanczos(x) {
  if (x === 0) return 1;
  if (Math.abs(x) >= LANCZOS_A) return 0;
  const px = Math.PI * x;
  return (LANCZOS_A * Math.sin(px) * Math.sin(px / LANCZOS_A)) / (px * px);
}

function resample(samples, ratio) {
  const outLength = Math.floor(samples.length / ratio);
  const out = new Float64Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const srcPos = i * ratio;
    const center = Math.floor(srcPos);
    let acc = 0;
    for (let j = center - LANCZOS_A + 1; j <= center + LANCZOS_A; j++) {
      if (j < 0 || j >= samples.length) continue;
      acc += samples[j] * lanczos(srcPos - j);
    }
    out[i] = acc;
  }
  return out;
}

fs.mkdirSync(outDir, { recursive: true });
const recordedMidis = new Set(RECORDED.map((r) => r.midi));
const generated = [];

for (let target = MIN_TARGET; target <= MAX_TARGET; target++) {
  if (recordedMidis.has(target)) continue; // exact recorded sample -- used directly, nothing to generate

  const source = RECORDED.reduce((best, r) => (Math.abs(target - r.midi) < Math.abs(target - best.midi) ? r : best));
  const shift = target - source.midi;
  const ratio = Math.pow(2, shift / 12);
  const noteName = midiToName(target);

  const outName = `Melodica_${noteName}.wav`;
  const { sampleRate, samples } = parseWav(fs.readFileSync(path.join(samplesDir, source.filename)));
  const shifted = resample(samples, ratio);
  writeWav(path.join(outDir, outName), shifted, sampleRate);
  generated.push({ target, note: noteName, outName, from: source.filename, shift });
  console.log(`${outName}  (midi ${target}) <- samples/${source.filename} shift ${shift > 0 ? "+" : ""}${shift}`);
}

console.log(`\nGenerated ${generated.length} files into ${path.relative(projectRoot, outDir)}/`);
