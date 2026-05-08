import { NextResponse } from 'next/server';
import { getStore } from '../../../server/db';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const store = getStore();
  const champions = store.list();
  return NextResponse.json({ champions });
}
