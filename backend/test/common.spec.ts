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

  it('resolves slot_kind=all by card_type and card catalog slots for common traits response', async () => {
    const env = makeEnvWithResults([
      [
        {
          card_id: 10000,
          card_type: 'unit',
          is_air: 0,
          can_damage_air: 0,
          primary_target_buildings: 0,
          is_aoe: 0,
          is_swarm_like: 0,
        },
        {
          card_id: 10001,
          card_type: 'unit',
          is_air: 1,
          can_damage_air: 0,
          primary_target_buildings: 0,
          is_aoe: 0,
          is_swarm_like: 0,
        },
        {
          card_id: 10002,
          card_type: 'support',
          is_air: 0,
          can_damage_air: 0,
          primary_target_buildings: 0,
          is_aoe: 0,
          is_swarm_like: 0,
        },
      ],
      [
        { card_id: 10000, slot_kind: 'all', trait_key: 'stun', trait_value: 1 },
        { card_id: 10000, slot_kind: 'evolution', trait_key: 'is_aoe', trait_value: 1 },
        { card_id: 10001, slot_kind: 'all', trait_key: 'stun', trait_value: 0 },
        { card_id: 10002, slot_kind: 'all', trait_key: 'stun', trait_value: 1 },
      ],
    ]);

    env.CR_API_TOKEN = 'test-token';

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          items: [
            { id: 10000, iconUrls: { medium: 'm', evolutionMedium: 'e' } },
            { id: 10001, iconUrls: { medium: 'm', heroMedium: 'h' } },
          ],
          supportItems: [{ id: 10002, iconUrls: { medium: 'm' } }],
        }),
        { status: 200 }
      )) as any;

    try {
      const res = await handleCommonTraits(env);
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({
      ok: true,
      traits: [
        {
          trait_key: 'is_air',
          cards: [
            { card_id: 10001, slot_kind: 'normal' },
            { card_id: 10001, slot_kind: 'hero' },
          ],
        },
        {
          trait_key: 'is_aoe',
          cards: [{ card_id: 10000, slot_kind: 'evolution' }],
        },
        {
          trait_key: 'stun',
          cards: [
            { card_id: 10000, slot_kind: 'normal' },
            { card_id: 10000, slot_kind: 'evolution' },
            { card_id: 10002, slot_kind: 'support' },
          ],
        },
      ],
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
