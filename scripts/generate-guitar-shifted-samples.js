// Pre-renders a real WAV for every playable Distortion Guitar note (MIDI
// 60..94, C4..B6 -- wider than every other instrument's 60..82 because the
// Distortion Guitar has 14 pads across two octave rows: the same scale
// degrees at their normal octave PLUS the same degrees one octave higher,
// so the combined range is [60..82] union [72..94] = [60..94]) that has no
// exact recorded sample, by resampling the nearest recorded anchor by
// 2^(shift/12) with a windowed-sinc (Lanczos) kernel -- the same
// offline-rendering approach already used for the Flute/Kalimba/Melodica/
// Synth Bass, and for the same reason: runtime playbackRate-based pitch
// shifting was already confirmed unreliable on-device for the Melodica/
// Piano, so this instrument goes straight to pre-rendering.
//
// The pack (assets/audio/DistortionGuitar/) has an SFZ (031_DistortionGuitar.sfz)
// confirming 12 real recordings spaced ~3-5 semitones apart (E2, A2, C#3,
// F3, A3, C#4, F4, A4, C#5, F5, A5, C6), all pitch-verified within +-7
// cents of their filename. The highest anchor is C6 (84), 10 semitones
// below the top of the needed range (94) -- the top ~11 notes (84..94) all
// shift up from C6, the largest shift any instrument in this app has
// needed; verify their rendered pitch carefully (see the note in
// scripts/test-guitar-mapping.js).
//
// Usage: node scripts/generate-guitar-shifted-samples.js
// Output: assets/audio/DistortionGuitar/generated/Guitar_<Note><Octave>.wav
const fs = require("fs");
const path = require("path");
const { parseWav } = require("./lib/wav-pitch");

const projectRoot = path.resolve(__dirname, "..");
const kitDir = path.join(projectRoot, "assets", "audio", "DistortionGuitar");
const outDir = path.join(kitDir, "generated");

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const midiToName = (midi) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

// The pack's recorded anchors -- see src/audio/distortionGuitarSampleData.ts
// for the authoritative, TypeScript copy of this same data -- duplicated
// here because this is a plain Node dev script with no TS build step,
// matching how the other generate-*-shifted-samples.js scripts also inline
// their own grid rather than importing from src/.
const RECORDED = [
  { midi: 40, filename: "E2.wav" },
  { midi: 45, filename: "A2.wav" },
  { midi: 49, filename: "C#3.wav" },
  { midi: 53, filename: "F3.wav" },
  { midi: 57, filename: "A3.wav" },
  { midi: 61, filename: "C#4.wav" },
  { midi: 65, filename: "F4.wav" },
  { midi: 69, filename: "A4.wav" },
  { midi: 73, filename: "C#5.wav" },
  { midi: 77, filename: "F5.wav" },
  { midi: 81, filename: "A5.wav" },
  { midi: 84, filename: "C6.wav" }
];

const MIN_TARGET = 60; // C4 (lowest tonic, lower octave row)
const MAX_TARGET = 94; // B6 (highest possible 7th degree, upper octave row)

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

  const outName = `Guitar_${noteName}.wav`;
  const { sampleRate, samples } = parseWav(fs.readFileSync(path.join(kitDir, source.filename)));
  const shifted = resample(samples, ratio);
  writeWav(path.join(outDir, outName), shifted, sampleRate);
  generated.push({ target, note: noteName, outName, from: source.filename, shift });
  console.log(`${outName}  (midi ${target}) <- ${source.filename} shift ${shift > 0 ? "+" : ""}${shift}`);
}

console.log(`\nGenerated ${generated.length} files into ${path.relative(projectRoot, outDir)}/`);
