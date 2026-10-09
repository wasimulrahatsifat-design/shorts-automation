/**
 * lib/audio-duration.ts
 * Accurately parses MP3 MPEG audio frame headers in pure JavaScript
 * to return the exact duration in seconds (to the millisecond).
 */

export function getMp3Duration(buffer: Buffer): number {
  if (!buffer || buffer.length < 10) return 0;

  const bitrateTable: Record<number, number[]> = {
    1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  };
  const sampleRateTable: Record<number, number[]> = {
    1: [44100, 48000, 32000],
  };

  let totalSamples = 0;
  let sampleRate = 44100;
  let offset = 0;

  // Skip ID3v2 tag if present
  if (buffer.toString('utf8', 0, 3) === 'ID3') {
    const size =
      ((buffer[6] & 0x7f) << 21) |
      ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7) |
      (buffer[9] & 0x7f);
    offset = 10 + size;
  }

  while (offset < buffer.length - 4) {
    if (buffer[offset] === 0xff && (buffer[offset + 1] & 0xe0) === 0xe0) {
      const b1 = buffer[offset + 1];
      const b2 = buffer[offset + 2];
      const version = (b1 >> 3) & 3; // 3 = MPEG 1
      const layer = (b1 >> 1) & 3; // 1 = Layer III
      const bitrateIdx = (b2 >> 4) & 15;
      const srIdx = (b2 >> 2) & 3;
      const padding = (b2 >> 1) & 1;

      if (version === 3 && layer === 1 && bitrateIdx > 0 && bitrateIdx < 15 && srIdx < 3) {
        const br = bitrateTable[1][bitrateIdx] * 1000;
        sampleRate = sampleRateTable[1][srIdx];
        const frameLen = Math.floor((144 * br) / sampleRate) + padding;
        if (frameLen > 0) {
          totalSamples += 1152;
          offset += frameLen;
          continue;
        }
      }
    }
    offset++;
  }

  return totalSamples > 0 ? Number((totalSamples / sampleRate).toFixed(2)) : 0;
}
