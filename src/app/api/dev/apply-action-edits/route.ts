import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const OVERRIDES_PATH = path.join(process.cwd(), 'src/server/engine/cards/actions.overrides.json');

type ActionOverride = { description?: string };

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'dev only' }, { status: 403 });
  }

  const body = await req.json() as Array<{ id: string } & ActionOverride>;

  let current: Record<string, ActionOverride> = {};
  try {
    current = JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf-8')) as Record<string, ActionOverride>;
  } catch {
    // file missing or empty — start fresh
  }

  for (const entry of body) {
    const { id, ...fields } = entry;
    current[id] = { ...current[id], ...fields };
    if (current[id]!.description === '' || current[id]!.description === undefined) {
      delete current[id]!.description;
    }
    if (Object.keys(current[id]!).length === 0) delete current[id];
  }

  fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(current, null, 2) + '\n');
  return NextResponse.json({ ok: true, count: body.length });
}
