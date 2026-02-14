import { describe, expect, it } from 'vitest';
import { handleCommonClasses, handleCommonTraits } from '../src/handlers/common';

function makeEnvWithResults(resultsQueue: any[]) {
  let idx = 0;
  return {
    DB: {
      prepare: () => ({
        bind: () => ({
          all: async () => ({ results: resultsQueue[idx++] ?? [] }),
        }),
        all: async () => ({ results: resultsQueue[idx++] ?? [] }),
      }),
    },
  } as any;
}

describe('Common handlers', () => {
  it('returns classes grouped by class_key', async () => {
    const env = makeEnvWithResults([
      [
        { class_key: 'tank', card_id: 122201 },
        { class_key: 'tank', card_id: 10000 },
        { class_key: 'win_condition', card_id: 26000001 },
      ],
    ]);

    const res = await handleCommonClasses(env);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      classes: [
        { class_key: 'tank', card_ids: [10000, 122201] },
        { class_key: 'win_condition', card_ids: [26000001] },
      ],
    });
  });

  it('returns traits grouped by trait_key using traits resolve rules', async () => {
    const env = makeEnvWithResults([
      [
        { card_id: 10000, is_air: 0, can_damage_air: 0, primary_target_buildings: 0, is_aoe: 0, is_swarm_like: 0 },
        { card_id: 10001, is_air: 1, can_damage_air: 0, primary_target_buildings: 0, is_aoe: 0, is_swarm_like: 0 },
      ],
      [
        { card_id: 10000, slot_kind: 'all', trait_key: 'stun', trait_value: 1 },
        { card_id: 10000, slot_kind: 'evolution', trait_key: 'is_aoe', trait_value: 1 },
        { card_id: 10001, slot_kind: 'all', trait_key: 'stun', trait_value: 0 },
      ],
    ]);

    const res = await handleCommonTraits(env);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      traits: [
        { trait_key: 'is_air', card_ids: [10001] },
        { trait_key: 'is_aoe', card_ids: [10000] },
        { trait_key: 'stun', card_ids: [10000] },
      ],
    });
  });
});
