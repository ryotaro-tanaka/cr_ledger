import { describe, expect, it } from 'vitest';
import {
  handleDeckDefenseThreats,
  handleDeckOffenseCounters,
  handleDeckSummary,
} from '../src/handlers/decks';

describe('Deck handlers: invalid my_deck_key handling', () => {
  it('returns 400 for invalid URI encoding in summary', async () => {
    const res = await handleDeckSummary({} as any, '%E0%A4%A');
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, error: 'invalid my_deck_key' });
  });

  it('returns 400 for invalid URI encoding in offense/counters', async () => {
    const url = new URL('https://example.com/api/decks/%E0%A4%A/offense/counters');
    const res = await handleDeckOffenseCounters({} as any, url, url.pathname);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, error: 'invalid my_deck_key' });
  });

  it('returns 400 for invalid URI encoding in defense/threats', async () => {
    const url = new URL('https://example.com/api/decks/%E0%A4%A/defense/threats');
    const res = await handleDeckDefenseThreats({} as any, url, url.pathname);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, error: 'invalid my_deck_key' });
  });
});
