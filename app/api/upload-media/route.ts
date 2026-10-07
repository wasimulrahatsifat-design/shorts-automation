import { NextResponse } from 'next/server';
import { uploadToStorageWithFailover } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB Supabase Storage Limit
    if (file.size > MAX_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        {
          success: false,
          error: `The file is ${sizeMB} MB, which exceeds the 50 MB cloud storage limit. Please compress the video to under 50 MB before uploading.`,
        },
        { status: 413 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = file.type || 'image/jpeg';
    const isVideo = contentType.startsWith('video/');
    const ext = isVideo 
      ? (contentType.includes('webm') ? 'webm' : 'mp4') 
      : (contentType.includes('png') ? 'png' : 'jpg');
    const fileName = `aesthetic_${crypto.randomUUID()}.${ext}`;

    try {
      const { publicUrl } = await uploadToStorageWithFailover('shorts', fileName, buffer, {
        contentType,
        upsert: true,
      });

      return NextResponse.json({ success: true, url: publicUrl });
    } catch (cloudError: any) {
      console.warn('[Upload Media] Supabase storage failed, falling back to local /public/uploads/ storage:', cloudError.message);

      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const localFilePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(localFilePath, buffer);

      const localUrl = `/uploads/${fileName}`;
      return NextResponse.json({
        success: true,
        url: localUrl,
        warning: 'Saved locally because Supabase storage has exceeded its monthly egress quota.',
      });
    }
  } catch (error: any) {
    console.error('Error uploading media:', error);
    const msg = error?.message || 'Error uploading media';
    const status = msg.includes('50MB') || msg.includes('exceeded the maximum allowed size') ? 413 : 500;
    return NextResponse.json({ success: false, error: msg }, { status });
  }
}
