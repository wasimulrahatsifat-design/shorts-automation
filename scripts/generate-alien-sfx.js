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

/**
 * 1. Ripjaws: Steel Jaw Bite (steel_bite.wav)
 * Characteristics:
 * - Ferocious predatory steel clamp with razor-sharp aquatic snap
 * - High-speed jaw acceleration whoosh (0 - 60ms)
 * - Ultra-sharp metallic tooth clang & lock (at 65ms: 2200Hz + 3400Hz resonant ringing)
 * - Crushing bone/steel bite crunch (65ms - 250ms: heavy bass impact + distorted crunch transients)
 * - Deep aquatic predator reverberant jaw resonance ringout
 */
function generateSteelBite() {
  const duration = 0.58;
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);

  let phaseChomp1 = 0;
  let phaseChomp2 = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // A. Pre-bite lunge snap / water whoosh (0 to 0.07s)
    let whoosh = 0;
    if (t < 0.08) {
      const wEnv = Math.sin((t / 0.08) * Math.PI);
      const noise = (Math.random() * 2 - 1);
      whoosh = noise * wEnv * 0.35;
    }

    // B. Razor-sharp metallic clamp snap (0.065s to 0.22s)
    let metalSnap = 0;
    if (t >= 0.065 && t < 0.25) {
      const snapT = t - 0.065;
      const snapEnv = Math.exp(-snapT / 0.018);
      // Dual high-pitch metallic teeth clashing frequencies
      const f1 = 2650 * Math.exp(-snapT / 0.03) + 1400;
      const f2 = 3800 * Math.exp(-snapT / 0.02) + 2100;
      const f3 = 880;
      const tone = (
        Math.sin(2 * Math.PI * f1 * snapT) * 0.5 +
        Math.sin(2 * Math.PI * f2 * snapT) * 0.35 +
        Math.sin(2 * Math.PI * f3 * snapT) * 0.3
      );
      // Sharp metallic transient click
      const click = (Math.random() * 2 - 1) * Math.exp(-snapT / 0.005) * 0.6;
      metalSnap = (tone + click) * snapEnv * 0.9;
    }

    // C. Heavy jaw crunch & crushing bass punch (0.07s to 0.4s)
    let crunch = 0;
    if (t >= 0.07) {
      const cT = t - 0.07;
      const crunchEnv = Math.exp(-cT / 0.065);
      // Low bass jaw slam
      const bassFreq = 140 * Math.exp(-cT / 0.04) + 42;
      phaseChomp1 += (2 * Math.PI * bassFreq) / sampleRate;
      const bass = Math.sin(phaseChomp1) * crunchEnv * 0.85;

      // Grinding teeth crunch noise
      let grit = 0;
      if (cT < 0.16) {
        const gritNoise = (Math.random() * 2 - 1);
        const gritFreq = 450 + Math.sin(cT * 350) * 150;
        phaseChomp2 += (2 * Math.PI * gritFreq) / sampleRate;
        grit = (gritNoise * 0.6 + Math.sin(phaseChomp2) * 0.4) * Math.exp(-cT / 0.04) * 0.7;
      }
      crunch = bass + grit;
    }

    // D. Resonant predatory ringout tail (0.15s to 0.55s)
    let tail = 0;
    if (t >= 0.12) {
      const tailT = t - 0.12;
      const tailEnv = Math.exp(-tailT / 0.12);
      const ring1 = Math.sin(2 * Math.PI * 520 * tailT);
      const ring2 = Math.sin(2 * Math.PI * 1040 * tailT) * 0.3;
      tail = (ring1 + ring2) * tailEnv * 0.25;
    }

    const mixed = whoosh + metalSnap + crunch + tail;
    // Slight soft clip distortion for aggressive bite weight
    samples[i] = Math.tanh(mixed * 1.35) * 0.95;
  }

  return samples;
}

/**
 * 2. Wildmutt: Predator Roar (predator_roar.wav)
 * Characteristics:
 * - Aggressive guttural Vulpimancer beast roar & snarl
 * - Guttural vocal cords vibration (60Hz - 130Hz) modulated heavily with 25-45Hz flutter
 * - Menacing snarl build-up (0 - 0.25s) rising into a vicious savage predatory roar (0.25s - 0.65s)
 * - Visceral feral bite-snap & heavy panting exhale decay (0.65s - 0.95s)
 */
function generatePredatorRoar() {
  const duration = 0.95;
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);

  let phase1 = 0;
  let phase2 = 0;
  let phaseNoise = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // Overall envelope: quick menacing attack, intense sustained peak roar, fierce tapering decay
    let masterEnv = 0;
    if (t < 0.18) {
      masterEnv = Math.pow(t / 0.18, 1.2);
    } else if (t < 0.65) {
      masterEnv = 1.0 - (t - 0.18) * 0.15;
    } else {
      masterEnv = Math.exp(-(t - 0.65) / 0.12) * 0.93;
    }

    // Fundamental growl frequency contour: starts at 78Hz, ramps fiercely up to 135Hz, growls down to 60Hz
    let fundFreq = 78;
    if (t < 0.35) {
      fundFreq = 78 + (t / 0.35) * 55;
    } else if (t < 0.65) {
      fundFreq = 133 - ((t - 0.35) / 0.30) * 35;
    } else {
      fundFreq = 98 * Math.exp(-(t - 0.65) / 0.15) + 30;
    }

    // Deep guttural vocal fold flutter (gargle/purr modulation at 32Hz - 42Hz)
    const flutter = 1.0 + 0.55 * Math.sin(2 * Math.PI * (34 + (t > 0.3 ? 8 : 0)) * t);

    phase1 += (2 * Math.PI * fundFreq) / sampleRate;
    phase2 += (2 * Math.PI * fundFreq * 2.08) / sampleRate; // slightly inharmonic overtone

    // Sawtooth / pulse wave approximation for guttural monster vocal tract
    const saw1 = (phase1 % (2 * Math.PI)) / Math.PI - 1.0;
    const saw2 = (phase2 % (2 * Math.PI)) / Math.PI - 1.0;
    const vocalBase = (saw1 * 0.7 + saw2 * 0.45) * flutter;

    // Feral breath & snarl rasp noise (filtered turbulence)
    const rawNoise = (Math.random() * 2 - 1);
    const snarlMod = (Math.sin(phase1) > 0 ? 1.0 : 0.2); // pitch-sync modulated noise
    const rasp = rawNoise * snarlMod * (0.45 + (t > 0.25 && t < 0.65 ? 0.35 : 0.15));

    // Mid-range throat resonance (formants around 480Hz & 950Hz)
    const formant1 = Math.sin(2 * Math.PI * 520 * t) * (saw1 * 0.3);
    const formant2 = Math.sin(2 * Math.PI * 920 * t) * (saw1 * 0.2);

    let feralVoice = (vocalBase * 0.65 + rasp * 0.5 + formant1 + formant2) * masterEnv;

    // Savage jaw snapping impact punch right at the peak (at t = 0.48s)
    if (t >= 0.46 && t < 0.62) {
      const snapT = t - 0.46;
      const snapEnv = Math.exp(-snapT / 0.025);
      const snapThump = Math.sin(2 * Math.PI * 95 * snapT) * snapEnv * 0.75;
      const snapClick = (Math.random() * 2 - 1) * Math.exp(-snapT / 0.006) * 0.5;
      feralVoice += snapThump + snapClick;
    }

    // Saturation and wave folding for beastly aggression
    const saturated = Math.tanh(feralVoice * 1.5);
    samples[i] = saturated * 0.95;
  }

  return samples;
}

const audioDir = path.join(__dirname, '..', 'public', 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

// Generate Ripjaws steel bite
const biteBuf = createWavBuffer(generateSteelBite());
fs.writeFileSync(path.join(audioDir, 'steel_bite.wav'), biteBuf);
console.log('Successfully generated public/audio/steel_bite.wav (' + biteBuf.length + ' bytes)');

// Generate Wildmutt predator roar
const roarBuf = createWavBuffer(generatePredatorRoar());
fs.writeFileSync(path.join(audioDir, 'predator_roar.wav'), roarBuf);
console.log('Successfully generated public/audio/predator_roar.wav (' + roarBuf.length + ' bytes)');
