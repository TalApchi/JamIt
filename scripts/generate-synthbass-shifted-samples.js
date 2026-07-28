// Pre-renders a real WAV for every playable Synth Bass note (MIDI 60..82,
// C4..A#5 -- the same range every supported Major/Natural Minor scale can
// ever target, confirmed against the compiled scale engine, and the same
// range the Flute/Kalimba/Melodica kits cover) that has no exact recorded
// sample, by resampling the nearest recorded C/E/G# take by 2^(shift/12)
// with a windowed-sinc (Lanczos) kernel -- the same offline-rendering
// approach already used for the Flute (generate-shifted-samples.js), the
// Kalimba (generate-kalimba-shifted-samples.js), and the Melodica/Piano
// (generate-melodica-shifted-samples.js), and for the same reason: runtime
// playbackRate-based pitch shifting was already confirmed unreliable
// on-device for those instruments, so every note here gets its own
// dedicated, pre-rendered WAV from the start and always plays at rate 1.0.
//
// The pack (assets/audio/SynthBass1/) has no SFZ/README -- just 14 raw WAVs,
// one octave-spanning recording each of C, E, and G# (a major-third grid,
// evenly spaced 4 semitones apart, so every target is within +-2 semitones
// of its nearest anchor -- confirmed by exhaustive directory listing and
// per-file pitch verification, all 14 within 2 cents of their filename).
//
// Usage: node scripts/generate-synthbass-shifted-samples.js
// Output: assets/audio/SynthBass1/generated/SynthBass_<Note><Octave>.wav
const fs = require("fs");
const path = require("path");
const { parseWav } = require("./lib/wav-pitch");

const projectRoot = path.resolve(__dirname, "..");
const kitDir = path.join(projectRoot, "assets", "audio", "SynthBass1");
const outDir = path.join(kitDir, "generated");

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const midiToName = (midi) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

// The pack's recorded pitch classes (C, E, G#, octaves 1-5) -- see
// src/audio/synthBassSampleData.ts for the authoritative, TypeScript copy of
// this same data -- duplicated here because this is a plain Node dev script
// with no TS build step, matching how the other generate-*-shifted-samples.js
// scripts also inline their own grid rather than importing from src/.
const RECORDED = [
  { midi: 28, filename: "E1.wav" },
  { midi: 32, filename: "G#1.wav" },
  { midi: 36, filename: "C2.wav" },
  { midi: 40, filename: "E2.wav" },
  { midi: 44, filename: "G#2.wav" },
  { midi: 48, filename: "C3.wav" },
  { midi: 52, filename: "E3.wav" },
  { midi: 56, filename: "G#3.wav" },
  { midi: 60, filename: "C4.wav" },
  { midi: 64, filename: "E4.wav" },
  { midi: 68, filename: "G#4.wav" },
  { midi: 72, filename: "C5.wav" },
  { midi: 76, filename: "E5.wav" },
  { midi: 80, filename: "G#5.wav" }
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
// every other generate-*-shifted-samples.js script's kernel.
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

  const outName = `SynthBass_${noteName}.wav`;
  const { sampleRate, samples } = parseWav(fs.readFileSync(path.join(kitDir, source.filename)));
  const shifted = resample(samples, ratio);
  writeWav(path.join(outDir, outName), shifted, sampleRate);
  generated.push({ target, note: noteName, outName, from: source.filename, shift });
  console.log(`${outName}  (midi ${target}) <- ${source.filename} shift ${shift > 0 ? "+" : ""}${shift}`);
}

console.log(`\nGenerated ${generated.length} files into ${path.relative(projectRoot, outDir)}/`);
