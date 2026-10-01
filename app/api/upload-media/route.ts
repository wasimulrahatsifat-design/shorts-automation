import { NextResponse } from 'next/server';
import { uploadToStorageWithFailover } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = file.type || 'image/jpeg';
    const isVideo = contentType.startsWith('video/');
    const ext = isVideo 
      ? (contentType.includes('webm') ? 'webm' : 'mp4') 
      : (contentType.includes('png') ? 'png' : 'jpg');
    const fileName = `aesthetic_${crypto.randomUUID()}.${ext}`;

    const { publicUrl } = await uploadToStorageWithFailover('shorts', fileName, buffer, {
      contentType,
      upsert: true,
    });

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error: any) {
    console.error('Error uploading media:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
