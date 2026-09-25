const fs = require('fs');
const path = require('path');

function createWavBuffer(samples, sampleRate = 44100) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF identifier
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // FMT sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // SubChunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // DATA sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write samples (clamp to -1..1 and scale to 16-bit signed integer)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const intSample = s < 0 ? s * 0x8000 : s * 0x7fff;
    buffer.writeInt16LE(Math.floor(intSample), 44 + i * 2);
  }

  return buffer;
}

const sampleRate = 44100;

// 1. Omnitrix Open / Dial Pop-Up Sound (~0.45s)
// Characteristics:
// - Initial mechanical latch release (spring pop: short snappy click 0-30ms)
// - Rising high-tech energy / servo frequency sweep from ~340Hz up to ~1550Hz with 2nd harmonic
// - Dual crystal resonant activation ping at 1550Hz & 2100Hz that rings smoothly
function generateOmnitrixOpen() {
  const duration = 0.48;
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);

  let phaseSweep = 0;
  let phaseHarmonic = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // A. Spring pop click (0 to 0.04s)
    let pop = 0;
    if (t < 0.04) {
      const popEnv = Math.exp(-t / 0.008);
      const popFreq = 480 * Math.exp(-t / 0.012) + 60;
      pop = Math.sin(2 * Math.PI * popFreq * t) * popEnv * 0.7;
      // White noise tap for mechanical texture
      pop += (Math.random() * 2 - 1) * popEnv * 0.4;
    }

    // B. Rising futuristic energy whine (0.02s to 0.38s)
    let servo = 0;
    if (t >= 0.02 && t < 0.38) {
      const relT = (t - 0.02) / 0.36; // 0 to 1
      // Exponential/cubic rising frequency curve from 340Hz to 1520Hz
      const freq = 340 + Math.pow(relT, 1.8) * 1180;
      phaseSweep += (2 * Math.PI * freq) / sampleRate;
      phaseHarmonic += (2 * Math.PI * freq * 1.618) / sampleRate;

      // Envelope: smooth attack, sustained, smooth transition to ping
      let env = 1;
      if (relT < 0.15) env = relT / 0.15;
      else if (relT > 0.8) env = (1 - relT) / 0.2;

      // Blend sine and slight triangle for sci-fi texture
      const sineWave = Math.sin(phaseSweep);
      const harmWave = Math.sin(phaseHarmonic) * 0.35;
      const mod = 1 + 0.15 * Math.sin(2 * Math.PI * 65 * t); // subtle 65Hz vibrato/purr
      servo = (sineWave + harmWave) * env * mod * 0.55;
    }

    // C. High-tech activation lock chime (0.28s to 0.48s)
    let chime = 0;
    if (t >= 0.28) {
      const cT = t - 0.28;
      const chimeEnv = Math.exp(-cT / 0.06);
      const tone1 = Math.sin(2 * Math.PI * 1520 * cT);
      const tone2 = Math.sin(2 * Math.PI * 2280 * cT) * 0.4;
      chime = (tone1 + tone2) * chimeEnv * 0.45;
    }

    samples[i] = pop + servo + chime;
  }

  return samples;
}

// 2. Omnitrix Rotate / Dial Turn Sound (~0.08s)
// Characteristics:
// - Iconic mechanical ratcheting click
// - Crisp high transient metallic tick (2200Hz - 1600Hz snap)
// - Dual resonant body click (880Hz / 440Hz fast damped pulse)
function generateOmnitrixTurn() {
  const duration = 0.09;
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // Transient tick 1 (0 to 0.02s) - high snap
    let tick1 = 0;
    if (t < 0.025) {
      const env = Math.exp(-t / 0.0035);
      const f = 2400 * Math.exp(-t / 0.004) + 800;
      tick1 = Math.sin(2 * Math.PI * f * t) * env * 0.75;
      tick1 += (Math.random() * 2 - 1) * env * 0.3; // tactile snap noise
    }

    // Ratchet mechanical resonance (0.008s to 0.085s)
    let body = 0;
    if (t >= 0.006) {
      const bT = t - 0.006;
      const env = Math.exp(-bT / 0.016);
      const f1 = 1100 * Math.exp(-bT / 0.02) + 320;
      const f2 = 1760;
      body = (Math.sin(2 * Math.PI * f1 * bT) * 0.6 + Math.sin(2 * Math.PI * f2 * bT) * 0.3) * env * 0.65;
    }

    samples[i] = tick1 + body;
  }

  return samples;
}

// 3. Omnitrix Slam / Transformation Sound (~0.4s)
// Characteristics:
// - Heavy mechanical core impact (bass slam)
// - Alien energy release whoosh / green flash surge
function generateOmnitrixSlam() {
  const duration = 0.42;
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);

  let phaseEnergy = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // Heavy mechanical slam punch (0 to 0.18s)
    let slam = 0;
    if (t < 0.18) {
      const slamEnv = Math.exp(-t / 0.035);
      const slamFreq = 160 * Math.exp(-t / 0.04) + 48;
      slam = Math.sin(2 * Math.PI * slamFreq * t) * slamEnv * 0.85;
      // Impact crunch
      if (t < 0.03) {
        slam += (Math.random() * 2 - 1) * Math.exp(-t / 0.006) * 0.4;
      }
    }

    // Alien energy surge (0.02s to 0.4s)
    let energy = 0;
    if (t >= 0.02) {
      const eT = t - 0.02;
      const energyEnv = Math.exp(-eT / 0.09);
      const f = 420 * Math.exp(-eT / 0.1) + 120;
      phaseEnergy += (2 * Math.PI * f) / sampleRate;
      // Warm modulated square/saw wave
      const wave = Math.sin(phaseEnergy) > 0 ? 0.6 : -0.6;
      energy = (Math.sin(phaseEnergy) * 0.5 + wave * 0.3) * energyEnv * 0.5;
    }

    samples[i] = slam + energy;
  }

  return samples;
}

const audioDir = path.join(__dirname, '..', 'public', 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

fs.writeFileSync(path.join(audioDir, 'omnitrix_open.wav'), createWavBuffer(generateOmnitrixOpen()));
console.log('Generated omnitrix_open.wav');

fs.writeFileSync(path.join(audioDir, 'omnitrix_turn.wav'), createWavBuffer(generateOmnitrixTurn()));
console.log('Generated omnitrix_turn.wav');

fs.writeFileSync(path.join(audioDir, 'omnitrix_slam.wav'), createWavBuffer(generateOmnitrixSlam()));
console.log('Generated omnitrix_slam.wav');
