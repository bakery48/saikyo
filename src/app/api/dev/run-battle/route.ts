import { NextRequest, NextResponse } from 'next/server';
import { runBattle } from '../../../../server/engine/battle';
import { MONSTERS } from '../../../../server/engine/cards/monsters';
import { SKILLS } from '../../../../server/engine/cards/skills';
import type { Monster, Stats } from '../../../../server/engine/types';

export type DevBattleSideInput = {
  baseId: string;
  stats: Stats;
  activeIds: string[];
};

export type DevBattleRequest = {
  a: DevBattleSideInput;
  b: DevBattleSideInput;
  seed?: number;
};

function buildMonster(side: DevBattleSideInput, ownerId: string): Monster {
  const base = MONSTERS.find((m) => m.baseId === side.baseId);
  if (!base) throw new Error(`Unknown monster: ${side.baseId}`);

  const actives = side.activeIds.map((id, idx) => {
    const card = SKILLS.find((s) => s.id === id);
    if (!card || !card.active) throw new Error(`Unknown active skill: ${id}`);
    return {
      id: `${ownerId}-${card.id}`,
      order: idx + 1,
      name: card.name,
      nameTag: card.nameTag,
      rarity: card.rarity,
      effect: card.active.effect,
    };
  });

  return {
    ownerId,
    baseId: base.baseId,
    name: base.name,
    stats: { ...side.stats },
    passives: base.passives.map((p) => ({ ...p })),
    actives,
    attackKind: base.attackKind,
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'dev only' }, { status: 403 });
  }

  const body = (await req.json()) as DevBattleRequest;
  const seed = body.seed ?? Math.floor(Math.random() * 0xffffffff);

  const a = buildMonster(body.a, 'dev-a');
  const b = buildMonster(body.b, 'dev-b');

  const result = runBattle(a, b, seed);

  return NextResponse.json({
    result,
    aName: a.name,
    bName: b.name,
    seed,
    startHpA: body.a.stats.hp,
    startHpB: body.b.stats.hp,
  });
}
