const fs = require('fs');
const path = require('path');

async function extractGifFrames() {
  const gifPath = path.join(process.cwd(), 'public', 'thinking.gif');
  const framesDir = path.join(process.cwd(), 'public', 'thinking_frames');

  if (!fs.existsSync(gifPath)) {
    console.log('[extract-gif-frames] No thinking.gif found in public/');
    return;
  }

  try {
    const sharp = require('sharp');
    if (!fs.existsSync(framesDir)) {
      fs.mkdirSync(framesDir, { recursive: true });
    }

    const meta = await sharp(gifPath, { animated: true }).metadata();
    const pageCount = meta.pages || 1;
    console.log(`[extract-gif-frames] Extracting ${pageCount} frames from thinking.gif...`);

    const promises = [];
    for (let page = 0; page < pageCount; page++) {
      const outputPath = path.join(framesDir, `frame_${page}.png`);
      promises.push(
        sharp(gifPath, { page })
          .png()
          .toFile(outputPath)
      );
    }
    await Promise.all(promises);
    
    // Write metadata file with total frame count
    fs.writeFileSync(
      path.join(framesDir, 'metadata.json'), 
      JSON.stringify({ frameCount: pageCount, width: meta.width, height: meta.pageHeight || meta.height }, null, 2)
    );
    console.log(`[extract-gif-frames] Successfully extracted ${pageCount} frames to public/thinking_frames/`);
  } catch (err) {
    console.error('[extract-gif-frames] Error extracting frames:', err.message);
  }
}

extractGifFrames();
