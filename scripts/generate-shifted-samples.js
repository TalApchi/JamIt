// Pre-renders every playable note (MIDI 60..82) that has no exact FluteClean2
// sample as a real WAV, by resampling the nearest grid sample by
// 2^(shift/12) with a windowed-sinc (Lanczos) kernel. This is mathematically
// the same transform runtime varispeed playback would apply, done offline so
// playback never depends on platform pitch-shift behavior (iOS AVPlayer's
// per-item audioTimePitchAlgorithm proved unreliable and unverifiable).
//
// Usage: node scripts/generate-shifted-samples.js
// Output: flute_sound_kit/generated/Flute_<Note><Octave>.wav (true pitch names)
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const kitDir = path.join(projectRoot, "flute_sound_kit");
const outDir = path.join(kitDir, "generated");

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const midiToName = (midi) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

// FluteClean2 grid: filename -> actual sounding MIDI (filenames are 2 octaves
// below true pitch; see fluteSampleData.ts).
const GRID = [
  { filename: "FluteClean2_C2.wav", midi: 60 },
  { filename: "FluteClean2_D#2.wav", midi: 63 },
  { filename: "FluteClean2_F#2.wav", midi: 66 },
  { filename: "FluteClean2_A2.wav", midi: 69 },
  { filename: "FluteClean2_C3.wav", midi: 72 },
  { filename: "FluteClean2_D#3.wav", midi: 75 },
  { filename: "FluteClean2_F#3.wav", midi: 78 },
  { filename: "FluteClean2_A3.wav", midi: 81 },
  { filename: "FluteClean2_C4.wav", midi: 84 }
];

const MIN_TARGET = 60; // C4 (lowest tonic)
const MAX_TARGET = 82; // A#5 (B major 7th degree)

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
  if (fmt.bitsPerSample !== 16 || fmt.numChannels !== 1) {
    throw new Error(`Expected 16-bit mono PCM, got ${fmt.bitsPerSample}-bit ${fmt.numChannels}ch`);
  }

  const frameCount = Math.floor(dataSize / 2);
  const samples = new Float64Array(frameCount);
  for (let i = 0; i < frameCount; i++) {
    samples[i] = buffer.readInt16LE(dataOffset + i * 2) / 32768;
  }
  return { sampleRate: fmt.sampleRate, samples };
}

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

// Lanczos-windowed sinc interpolation; ratio > 1 raises pitch.
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
const gridMidis = new Set(GRID.map((g) => g.midi));
const generated = [];

for (let target = MIN_TARGET; target <= MAX_TARGET; target++) {
  if (gridMidis.has(target)) continue;

  const source = GRID.reduce((best, g) =>
    Math.abs(target - g.midi) < Math.abs(target - best.midi) ? g : best
  );
  const shift = target - source.midi;
  const ratio = Math.pow(2, shift / 12);
  const outName = `Flute_${midiToName(target)}.wav`;

  const { sampleRate, samples } = parseWav(fs.readFileSync(path.join(kitDir, source.filename)));
  const shifted = resample(samples, ratio);
  writeWav(path.join(outDir, outName), shifted, sampleRate);
  generated.push({ target, note: midiToName(target), outName, from: source.filename, shift });
  console.log(`${outName}  (midi ${target}) <- ${source.filename} shift ${shift > 0 ? "+" : ""}${shift}`);
}

console.log(`\nGenerated ${generated.length} files into flute_sound_kit/generated/`);
