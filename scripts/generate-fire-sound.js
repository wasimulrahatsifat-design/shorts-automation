const fs = require('fs');
const path = require('path');

function generateFireblastWav() {
  const sampleRate = 44100;
  const duration = 1.2; // seconds
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate
  buffer.writeUInt16LE(2, 32); // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  // Noise generator state
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  let lp = 0, bp = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // Amplitude envelope: quick punchy rise, roaring body, smooth dissipation
    let env = 0;
    if (t < 0.06) {
      env = t / 0.06;
    } else {
      env = Math.exp(-(t - 0.06) / 0.35);
    }

    // White noise source
    const white = Math.random() * 2 - 1;

    // Pink noise filter (Paul Kellet's filter)
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;

    // Dynamic bandpass flame sweep
    const centerFreq = 220 + 450 * Math.sin(Math.min(Math.PI, t * 3.5));
    const q = 1.8;
    const f = (2 * Math.PI * centerFreq) / sampleRate;
    bp += f * (pink - bp - (1 / q) * lp);
    lp += f * bp;

    // Low rumble (sub-bass flame explosion)
    const rumbleFreq = 85 - 35 * Math.min(1, t * 1.5);
    const rumble = Math.sin(2 * Math.PI * rumbleFreq * t) * Math.exp(-t / 0.28) * 0.45;

    // Fire crackles (random sharp pops & sparks)
    let crackle = 0;
    if (Math.random() < 0.018 * env) {
      crackle = (Math.random() * 2 - 1) * 0.85;
    }

    // Blend: Roaring flame body + Low Rumble + Fire Crackles
    let sample = (bp * 0.65 + rumble + crackle * 0.35) * env * 1.4;

    // Soft saturation clipping to give burning warmth
    sample = Math.tanh(sample * 1.3);

    const int16 = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    buffer.writeInt16LE(int16, 44 + i * 2);
  }

  const outPath = path.join(__dirname, '..', 'public', 'audio', 'fireblast.wav');
  fs.writeFileSync(outPath, buffer);
  console.log('Successfully generated:', outPath, 'Bytes:', buffer.length);
}

generateFireblastWav();
