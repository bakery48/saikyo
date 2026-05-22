import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  if (!/^[a-z0-9_-]+\.png$/i.test(filename)) {
    return new NextResponse(null, { status: 404 });
  }
  try {
    const data = await readFile(join(process.cwd(), 'public', 'monsters', filename));
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
