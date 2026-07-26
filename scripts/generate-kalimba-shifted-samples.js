// Pre-renders a real WAV for every playable Kalimba note (MIDI 60..82,
// C4..A#5 -- the same range the Bamboo Flute's own kit covers, since it's
// exactly the range every supported Major/Natural Minor scale can ever
// target) that has no exact recorded tine, by resampling ALL round-robin
// takes of the nearest native tine by 2^(shift/12) with a windowed-sinc
// (Lanczos) kernel -- the same offline-rendering approach already used for
// the Flute (see generate-shifted-samples.js), and for the same reason:
// runtime playbackRate-based pitch shifting proved unreliable on-device
// (confirmed by ear via the Audio Debug screen: multiple different
// playbackRate values produced identical audible pitch), so every note now
// gets its own dedicated, pre-rendered WAV and always plays at rate 1.0.
//
// Usage: node scripts/generate-kalimba-shifted-samples.js
// Output: assets/audio/kalimba/Kalimba-SFZ-20190723/generated/Kalimba_<Note><Octave>_<NN>.wav
const fs = require("fs");
const path = require("path");
const { parseWav } = require("./lib/wav-pitch");

const projectRoot = path.resolve(__dirname, "..");
const kitDir = path.join(projectRoot, "assets", "audio", "kalimba", "Kalimba-SFZ-20190723");
const samplesDir = path.join(kitDir, "samples");
const outDir = path.join(kitDir, "generated");

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const midiToName = (midi) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

// The Kalimba's 8 real tines, transcribed from Kalimba-20190723.sfz (see
// src/audio/kalimbaSampleData.ts for the authoritative, TypeScript copy of
// this same data -- duplicated here because this is a plain Node dev
// script with no TS build step, matching how generate-shifted-samples.js
// also inlines its own grid rather than importing from src/).
const TINES = [
  { midi: 53, filenames: ["F3_01.wav", "F3_03.wav", "F3_04.wav", "F3_05.wav"] },
  { midi: 60, filenames: ["1_01.wav", "1_02.wav", "1_03.wav", "1_04.wav", "1_05.wav"] },
  { midi: 63, filenames: ["2_01.wav", "2_02.wav", "2_03.wav", "2_04.wav", "2_05.wav"] },
  { midi: 64, filenames: ["3_01.wav", "3_02.wav", "3_03.wav", "3_04.wav", "3_05.wav", "3_06.wav", "3_07.wav"] },
  { midi: 67, filenames: ["4_01.wav", "4_02.wav", "4_03.wav", "4_04.wav", "4_05.wav", "4_06.wav", "4_07.wav"] },
  { midi: 68, filenames: ["5_01.wav", "5_02.wav", "5_03.wav", "5_04.wav", "5_05.wav", "5_06.wav", "5_07.wav"] },
  { midi: 72, filenames: ["6_01.wav", "6_02.wav", "6_03.wav", "6_04.wav", "6_05.wav"] },
  { midi: 73, filenames: ["7_01.wav", "7_02.wav", "7_03.wav", "7_04.wav", "7_05.wav"] }
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
// generate-shifted-samples.js's kernel.
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
const tineMidis = new Set(TINES.map((t) => t.midi));
const generated = [];

for (let target = MIN_TARGET; target <= MAX_TARGET; target++) {
  if (tineMidis.has(target)) continue; // exact recorded tine -- used directly, nothing to generate

  const tine = TINES.reduce((best, t) => (Math.abs(target - t.midi) < Math.abs(target - best.midi) ? t : best));
  const shift = target - tine.midi;
  const ratio = Math.pow(2, shift / 12);
  const noteName = midiToName(target);

  tine.filenames.forEach((sourceFilename, takeIndex) => {
    const outName = `Kalimba_${noteName}_${String(takeIndex + 1).padStart(2, "0")}.wav`;
    const { sampleRate, samples } = parseWav(fs.readFileSync(path.join(samplesDir, sourceFilename)));
    const shifted = resample(samples, ratio);
    writeWav(path.join(outDir, outName), shifted, sampleRate);
    generated.push({ target, note: noteName, outName, from: sourceFilename, shift });
    console.log(`${outName}  (midi ${target}) <- samples/${sourceFilename} shift ${shift > 0 ? "+" : ""}${shift}`);
  });
}

console.log(`\nGenerated ${generated.length} files into ${path.relative(projectRoot, outDir)}/`);
