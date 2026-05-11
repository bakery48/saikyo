import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const OVERRIDES_PATH = path.join(process.cwd(), 'src/server/engine/cards/skills.overrides.json');

type SkillOverride = {
  name?: string;
  rarity?: string;
  nameTag?: string | null;
  description?: string;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'dev only' }, { status: 403 });
  }

  const body = await req.json() as Array<{ id: string } & SkillOverride>;

  let current: Record<string, SkillOverride> = {};
  try {
    current = JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf-8')) as Record<string, SkillOverride>;
  } catch {
    // file missing or empty — start fresh
  }

  for (const entry of body) {
    const { id, ...fields } = entry;
    current[id] = { ...current[id], ...fields };
    // Remove nulls (nameTag cleared → delete key)
    if (current[id]!.nameTag === null) delete current[id]!.nameTag;
    // Remove empty description → revert to auto
    if (current[id]!.description === '' || current[id]!.description === undefined) {
      delete current[id]!.description;
    }
    // Clean up if no overrides remain
    if (Object.keys(current[id]!).length === 0) delete current[id];
  }

  fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(current, null, 2) + '\n');
  return NextResponse.json({ ok: true, count: body.length });
}
