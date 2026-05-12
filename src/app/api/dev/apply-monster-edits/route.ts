import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const OVERRIDES_PATH = path.join(process.cwd(), 'src/server/engine/cards/monsters.overrides.json');

type PassiveOverride = {
  description?: string;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'dev only' }, { status: 403 });
  }

  const body = await req.json() as Array<{ passiveId: string } & PassiveOverride>;

  let current: Record<string, PassiveOverride> = {};
  try {
    current = JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf-8')) as Record<string, PassiveOverride>;
  } catch {
    // file missing or empty — start fresh
  }

  for (const entry of body) {
    const { passiveId, ...fields } = entry;
    current[passiveId] = { ...current[passiveId], ...fields };
    if (current[passiveId]!.description === '' || current[passiveId]!.description === undefined) {
      delete current[passiveId]!.description;
    }
    if (Object.keys(current[passiveId]!).length === 0) delete current[passiveId];
  }

  fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(current, null, 2) + '\n');
  return NextResponse.json({ ok: true, count: body.length });
}
