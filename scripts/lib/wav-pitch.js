// scripts/lib/wav-pitch.js
// Shared WAV parsing + pitch detection for audio-mapping test scripts.
// Supports 16/24/32-bit PCM, mono or multi-channel (downmixed to mono).

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
  if (![16, 24, 32].includes(fmt.bitsPerSample)) {
    throw new Error(`Unsupported bit depth: ${fmt.bitsPerSample}`);
  }

  const bytesPerSample = fmt.bitsPerSample / 8;
  const frameCount = Math.floor(dataSize / (bytesPerSample * fmt.numChannels));
  const mono = new Float32Array(frameCount);
  const maxValue = Math.pow(2, fmt.bitsPerSample - 1);

  function readSample(byteOffset) {
    if (fmt.bitsPerSample === 16) return buffer.readInt16LE(byteOffset);
    if (fmt.bitsPerSample === 32) return buffer.readInt32LE(byteOffset);
    // 24-bit: no native readInt24LE, assemble from 3 bytes little-endian.
    const b0 = buffer[byteOffset];
    const b1 = buffer[byteOffset + 1];
    const b2 = buffer[byteOffset + 2];
    let value = b0 | (b1 << 8) | (b2 << 16);
    if (value & 0x800000) value -= 0x1000000;
    return value;
  }

  for (let i = 0; i < frameCount; i++) {
    let acc = 0;
    for (let ch = 0; ch < fmt.numChannels; ch++) {
      acc += readSample(dataOffset + (i * fmt.numChannels + ch) * bytesPerSample) / maxValue;
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

module.exports = { parseWav, detectPitch };
