import { describe, expect, it } from 'vitest';
import { findSeasonLowerBound } from '../src/db/decks';
import { statsMyDecksSeasons } from '../src/db/decks';

describe('season boundary normalization', () => {
  it('findSeasonLowerBound normalizes mixed timestamp formats before sorting', async () => {
    const env = {
      DB: {
        prepare: () => ({
          all: async () => ({
            results: [
              { start_time: '2026-01-01T07:00:00.000Z' },
              { start_time: '20260202T070000.000Z' },
              { start_time: '2025-12-01T07:00:00.000Z' },
            ],
          }),
        }),
      },
    } as any;

    const since = await findSeasonLowerBound(env, 2);
    expect(since).toBe('20260101T070000.000Z');
  });

  it('statsMyDecksSeasons compares battle_time using normalized since', async () => {
    const binds: any[][] = [];
    let call = 0;
    const env = {
      DB: {
        prepare: (_sql: string) => ({
          bind: (...args: any[]) => {
            binds.push(args);
            return {
              all: async () => {
                if (call++ === 0) return { results: [{ total_battles: 3 }] };
                return {
                  results: [
                    { my_deck_key: 'deck-a', deck_name: 'A', battles: 2 },
                    { my_deck_key: 'deck-b', deck_name: 'B', battles: 1 },
                  ],
                };
              },
            };
          },
        }),
      },
    } as any;

    const out = await statsMyDecksSeasons(env, 'GYVCJJCR0', '2026-01-01T07:00:00.000Z');

    expect(out.total_battles).toBe(3);
    expect(out.decks).toHaveLength(2);
    expect(binds[0]).toEqual(['GYVCJJCR0', '20260101T070000.000Z', '20260101T070000.000Z']);
    expect(binds[1]).toEqual(['GYVCJJCR0', '20260101T070000.000Z', '20260101T070000.000Z']);
  });
});
